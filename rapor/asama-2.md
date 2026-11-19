# Aşama 2 · Uygulama

Tarih: 19.11.2026 · Ortam: macOS (Darwin 27.0), Docker 29.8.0, Docker Compose v5.5.1, Node.js 22

## Seçilen yol

**Web API + arayüz.** Uygulama yalnızca JSON döner. HTML5 + CSS3 arayüz `frontend/` klasöründe
durur ve veriyi JavaScript `fetch` ile alır. Apache `/api/` ile başlayan istekleri uygulamaya iletir.
Framework olarak **Node.js + Express 5** kullanıldı.

## 1. Uygulama iskeleti

`uygulama/` klasöründe bir Node projesi oluşturuldu ve Express kuruldu:

```
> npm init -y
> npm install express
```

`package.json` içindeki bağımlılık: `"express": "^5.3.0"`. `package-lock.json` bağımlılık
sürümlerini kilitler; Docker imajı aynı sürümleri kurar.

İlk sürüm `uygulama/index.js`, tek bir uç içerir. Uygulama container içinde 8000 portunu dinler:

```js
const express = require('express');

const app = express();
const PORT = 8000;

app.get('/api/saglik', (req, res) => {
  res.json({ durum: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Uygulama ${PORT} portunda dinliyor`);
});
```

Docker'sız yerel denemede tanımlı uç 200, tanımsız uç 404 döndü:

```
> curl -i http://localhost:8000/api/saglik
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"durum":"ok"}

> curl -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/api/yok
HTTP 404
```

## 2. Dockerfile

`uygulama/Dockerfile`:

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Önce yalnızca bağımlılık dosyaları: kod değişince npm ci yeniden çalışmasın
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Sonra uygulama kodu
COPY . .

EXPOSE 8000

# root yerine node kullanıcısıyla çalış
USER node

CMD ["node", "index.js"]
```

- Bağımlılıklar koddan önce kopyalanır; böylece `index.js` değişince Docker `npm ci` katmanını
  önbellekten kullanır.
- `npm ci`, `package-lock.json`'daki sürümleri birebir kurar.
- `.dockerignore` içinde `node_modules` var: macOS'ta kurulmuş paketler Linux imajına girmez
  (`bcrypt` gibi paketler işletim sistemine özgü derlenir).
- Uygulama `root` yerine yetkisiz `node` kullanıcısıyla çalışır. Geçici imajla yapılan denemede
  `docker exec ... whoami` çıktısı `node` oldu.

## 3. Compose'a uygulama servisi

`docker-compose.yml` içindeki hazır `uygulama:` bloğunun yorum işaretleri kaldırıldı:

```yaml
  uygulama:
    build: ./uygulama
    restart: unless-stopped
    environment:
      <<: *uygulama-ortam
    depends_on:
      mysql-primary:
        condition: service_healthy
      redis:
        condition: service_healthy
      replica-setup:
        condition: service_completed_successfully
```

- `environment`, dosyanın başındaki `x-uygulama-ortam` bloğunu (`DB_YAZMA_HOST`, `DB_OKUMA_HOST`,
  `REDIS_HOST` vb.) uygulamaya aktarır.
- `depends_on`, uygulamanın kaynak veritabanı ve Redis sağlıklı olmadan, replika kurulumu da
  başarıyla bitmeden başlamasını engeller.
- `uygulama` servisine `ports:` verilmedi. 8000 portu yalnızca Docker'ın iç ağında açıktır;
  dışarıdan tek giriş Apache'dir (8080).
- Apache modu için `frontend` servisinde `-D WEBAPI` zaten ayarlıydı. `apache/yemekhane.conf`
  içinde bu mod `/api/` isteklerini `http://uygulama:8000/api/` adresine iletir.

```
> docker compose up -d --build
> docker compose ps -a
SERVICE         STATUS                      PORTS
frontend        Up 2 days (healthy)         0.0.0.0:8080->80/tcp, [::]:8080->80/tcp
mysql-primary   Up 2 days (healthy)         0.0.0.0:3307->3306/tcp, [::]:3307->3306/tcp
mysql-replica   Up 51 minutes (healthy)     0.0.0.0:3308->3306/tcp, [::]:3308->3306/tcp
redis           Up 2 days (healthy)         0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
replica-setup   Exited (0) 12 minutes ago
uygulama        Up 12 minutes               8000/tcp
```

Mevcut beş container yeniden oluşturulmadı, veritabanı verileri korundu. `replica-setup`
`uygulama`'nın bağımlılığı olduğu için yeniden çalıştı ve "Replika zaten yapılandırılmış, işlem
yapılmadı" çıktısıyla bitti (betik tekrar çalıştırılabilir).

## 4. Apache üzerinden doğrulama

```
> curl -i http://localhost:8080/api/saglik
HTTP/1.1 200 OK
Server: Apache/2.4.71 (Unix)
X-Powered-By: Express
Content-Type: application/json; charset=utf-8

{"durum":"ok"}
```

`Server: Apache` ve `X-Powered-By: Express` başlıklarının birlikte görünmesi, isteğin Apache'den
geçip Express tarafından yanıtlandığını gösterir.

```
> curl -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8080/
HTTP 200
> curl -m 3 http://localhost:8000/api/saglik
(bağlantı kurulamadı)
```

Ana sayfa Apache'nin `frontend/` klasöründen sunulmaya devam ediyor. Uygulamanın 8000 portuna
dışarıdan ulaşılamıyor; istekler yalnızca Apache üzerinden geliyor.

Uygulama günlüğü:

```
> docker compose logs uygulama
uygulama-1  | Uygulama 8000 portunda dinliyor
```

Ekran görüntüsü: tarayıcıda `http://localhost:8080/api/saglik` adresi.

![Apache üzerinden /api/saglik](png/p2_saglik.png)
