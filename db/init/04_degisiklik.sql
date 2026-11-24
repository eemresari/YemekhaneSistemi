-- =====================================================================
-- Yemekhane Otomasyonu · Aşama 4 değişiklik talebi (migration)
--   1. Yarım porsiyon: öğle ve akşamda seçilebilir, ücret tam fiyatın %60'ı.
--      Kahvaltıda yarım porsiyon yoktur. Geçmiş rezervasyonlar tam porsiyon sayılır.
--   2. Alerjen uyarısı: kullanıcı profilinde alerjenlerini seçer.
--
-- Mevcut veriyi bozmadan KAYNAKTA (mysql-primary) çalışır; değişiklik binlog üzerinden
-- replikaya kendiliğinden geçer.
--   Sıfırdan kurulum: docker-entrypoint-initdb.d bu dosyayı 01 ve 02'den sonra çalıştırır.
--   Çalışan sistem:   docker compose exec -T mysql-primary mysql -uroot -pyemekhane_kok yemekhane < db/init/04_degisiklik.sql
-- Bir kez çalıştırılır.
-- =====================================================================
SET NAMES utf8mb4;
USE yemekhane;

-- ---------------------------------------------------------------------
-- 1a. Hangi öğünde yarım porsiyon var? Kural veride durur, kodda değil.
-- ---------------------------------------------------------------------
ALTER TABLE ogunler
    ADD COLUMN yarim_porsiyon TINYINT(1) NOT NULL DEFAULT 1
        COMMENT '1: yarım porsiyon seçilebilir'
        AFTER servis_bitis;

UPDATE ogunler SET yarim_porsiyon = 0 WHERE ad = 'Kahvaltı';

-- ---------------------------------------------------------------------
-- 1b. Rezervasyonun porsiyonu. DEFAULT 'tam' sayesinde mevcut bütün
--     rezervasyonlar tam porsiyon olur (ödenen ücret zaten tam fiyattır).
-- ---------------------------------------------------------------------
ALTER TABLE rezervasyonlar
    ADD COLUMN porsiyon ENUM('tam','yarim') NOT NULL DEFAULT 'tam'
        AFTER durum;

-- ---------------------------------------------------------------------
-- 2. Kullanıcının alerjenleri (çoka çok: bir kullanıcı birden çok alerjen seçer)
-- ---------------------------------------------------------------------
CREATE TABLE kullanici_alerjenleri (
    kullanici_id  INT UNSIGNED     NOT NULL,
    alerjen_id    TINYINT UNSIGNED NOT NULL,
    PRIMARY KEY (kullanici_id, alerjen_id),
    CONSTRAINT fk_ka_kullanici FOREIGN KEY (kullanici_id) REFERENCES kullanicilar (id) ON DELETE CASCADE,
    CONSTRAINT fk_ka_alerjen   FOREIGN KEY (alerjen_id)   REFERENCES alerjenler (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. sp_rezervasyon_yap: porsiyon parametresi eklendi.
--    Değişen yerler "AŞAMA 4" ile işaretlidir; geri kalanı önceki sürümle aynıdır.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_rezervasyon_yap;

DELIMITER $$

-- sp_rezervasyon_yap(kullanici_id, menu_id, porsiyon)
-- porsiyon: 'tam' ya da 'yarim'
-- Dönen satır: rezervasyon_id, ucret, bakiye, porsiyon
CREATE PROCEDURE sp_rezervasyon_yap(
    IN p_kullanici_id INT UNSIGNED,
    IN p_menu_id      INT UNSIGNED,
    IN p_porsiyon     VARCHAR(5)
)
BEGIN
    DECLARE v_rol          VARCHAR(10)  DEFAULT NULL;
    DECLARE v_aktif        TINYINT      DEFAULT NULL;
    DECLARE v_bakiye       DECIMAL(10,2) DEFAULT NULL;
    DECLARE v_son          DATETIME     DEFAULT NULL;
    DECLARE v_kapasite     INT          DEFAULT NULL;
    DECLARE v_ogr_fiyat    DECIMAL(8,2) DEFAULT NULL;
    DECLARE v_per_fiyat    DECIMAL(8,2) DEFAULT NULL;
    DECLARE v_yarim_var    TINYINT      DEFAULT NULL;   -- AŞAMA 4
    DECLARE v_ucret        DECIMAL(8,2) DEFAULT NULL;
    DECLARE v_dolu         INT          DEFAULT 0;
    DECLARE v_mevcut_id    INT UNSIGNED DEFAULT NULL;
    DECLARE v_mevcut_durum VARCHAR(12)  DEFAULT NULL;
    DECLARE v_rez_id       INT UNSIGNED DEFAULT NULL;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

    -- AŞAMA 4: porsiyon değeri denetimi (transaction açılmadan)
    IF p_porsiyon IS NULL OR p_porsiyon NOT IN ('tam', 'yarim') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Geçersiz porsiyon.';
    END IF;

    START TRANSACTION;

    -- Kullanıcı satırını kilitle (eşzamanlı bakiye işlemlerine karşı)
    SELECT rol, aktif, bakiye INTO v_rol, v_aktif, v_bakiye
      FROM kullanicilar WHERE id = p_kullanici_id FOR UPDATE;
    IF v_rol IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Kullanıcı bulunamadı.';
    END IF;
    IF v_aktif = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hesabınız pasif durumda.';
    END IF;

    -- Menü satırını kilitle (eşzamanlı kapasite kontrolüne karşı)
    SELECT TIMESTAMP(m.tarih, o.son_saat), yh.kapasite, m.ogrenci_fiyati, m.personel_fiyati,
           o.yarim_porsiyon                                                   -- AŞAMA 4
      INTO v_son, v_kapasite, v_ogr_fiyat, v_per_fiyat, v_yarim_var
      FROM menuler m
      JOIN ogunler o       ON o.id  = m.ogun_id
      JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
     WHERE m.id = p_menu_id
       FOR UPDATE;
    IF v_son IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menü bulunamadı.';
    END IF;
    IF NOW() >= v_son THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için rezervasyon süresi doldu.';
    END IF;
    -- AŞAMA 4: kahvaltıda yarım porsiyon yok
    IF p_porsiyon = 'yarim' AND v_yarim_var = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu öğünde yarım porsiyon yoktur.';
    END IF;

    SELECT id, durum INTO v_mevcut_id, v_mevcut_durum
      FROM rezervasyonlar
     WHERE kullanici_id = p_kullanici_id AND menu_id = p_menu_id
       FOR UPDATE;
    IF v_mevcut_durum IN ('aktif', 'kullanildi') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bu menü için zaten rezervasyonunuz var.';
    END IF;

    -- Yarım porsiyon da kapasiteden bir kişilik yer düşer
    SELECT COUNT(*) INTO v_dolu
      FROM rezervasyonlar
     WHERE menu_id = p_menu_id AND durum IN ('aktif', 'kullanildi');
    IF v_dolu >= v_kapasite THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Yemekhane kapasitesi dolu.';
    END IF;

    SET v_ucret = IF(v_rol = 'ogrenci', v_ogr_fiyat, v_per_fiyat);
    -- AŞAMA 4: yarım porsiyon tam fiyatın %60'ı (kuruşa yuvarlanır)
    IF p_porsiyon = 'yarim' THEN
        SET v_ucret = ROUND(v_ucret * 0.60, 2);
    END IF;
    IF v_bakiye < v_ucret THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bakiye yetersiz.';
    END IF;

    IF v_mevcut_id IS NULL THEN
        INSERT INTO rezervasyonlar (kullanici_id, menu_id, durum, porsiyon, ucret)   -- AŞAMA 4
        VALUES (p_kullanici_id, p_menu_id, 'aktif', p_porsiyon, v_ucret);
        SET v_rez_id = LAST_INSERT_ID();
    ELSE
        -- Daha önce iptal edilmiş kayıt yeniden etkinleşir
        UPDATE rezervasyonlar
           SET durum = 'aktif', porsiyon = p_porsiyon, ucret = v_ucret, olusturma = NOW(),  -- AŞAMA 4
               iptal_zamani = NULL, kullanma_zamani = NULL
         WHERE id = v_mevcut_id;
        SET v_rez_id = v_mevcut_id;
    END IF;

    UPDATE kullanicilar SET bakiye = bakiye - v_ucret WHERE id = p_kullanici_id;

    INSERT INTO bakiye_hareketleri (kullanici_id, tur, tutar, rezervasyon_id, aciklama)
    VALUES (p_kullanici_id, 'rezervasyon', -v_ucret, v_rez_id,
            IF(p_porsiyon = 'yarim', 'Rezervasyon (yarım porsiyon)', 'Rezervasyon'));  -- AŞAMA 4

    COMMIT;

    SELECT v_rez_id AS rezervasyon_id, v_ucret AS ucret, v_bakiye - v_ucret AS bakiye,
           p_porsiyon AS porsiyon;                                             -- AŞAMA 4
END$$

DELIMITER ;
