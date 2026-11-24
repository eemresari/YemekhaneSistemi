# Aşama 3 · Redis

Tarih: 24.11.2026 · Ortam: macOS (Darwin 27.0), Docker 29.8.0, Docker Compose v5.5.1, Node.js 22, Redis 7.4

Redis iki iş için kullanılır:

| Görev | Anahtar | Süre | Ne zaman silinir |
|---|---|---|---|
| Menü önbelleği | `menu:{yemekhane_id}:{tarih}:{ogun_id}` | o günün sonuna kadar | yönetici o menüyü değiştirdiğinde |
| Oturum | `oturum:{token}` | 30 dakika, her istekte yenilenir | çıkış yapıldığında |

Redis servisi başlangıç paketinde hazırdı (`redis:7.4-alpine`, AOF açık). Uygulama servisi
compose'ta Redis `healthy` olana kadar bekler ve adresi ortam değişkenlerinden alır
(`REDIS_HOST: redis`, `REDIS_PORT: "6379"`).

## 1. Redis bağlantısı

Resmî Node istemcisi kuruldu:

```
> npm install redis@^6
```

`package.json` içindeki bağımlılık: `"redis": "^6.4.0"`. Docker imajı `npm ci` ile kurduğu için
`package-lock.json` da güncellendi.

Uygulamanın tek Redis bağlantısı `uygulama/veri/redis.js` dosyasındadır. Oturum deposu ve
menü önbelleği bu bağlantıyı ortak kullanır:

```js
const { createClient } = require('redis');

const redis = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

redis.on('error', (err) => console.error(`Redis hatası: ${err.message}`));
redis.on('ready', () => console.log('Redis\'e bağlanıldı'));

module.exports = redis;
```

`'error'` olayını dinlemek zorunludur: dinleyici yoksa Node, bağlantı hatasında uygulamayı
kapatır. Dinleyici varken hata günlüğe yazılır ve istemci kendiliğinden yeniden bağlanmayı dener.

`uygulama/index.js` önce Redis'e bağlanır, sonra istek kabul etmeye başlar. Böylece Redis
hazır olmadan gelen bir istek oturum ya da önbellek işleminde takılmaz:

```js
async function basla() {
  await redis.connect();
  app.listen(PORT, () => {
    console.log(`Uygulama ${PORT} portunda dinliyor`);
  });
}

basla();
```

Doğrulama: uygulama günlüğünde önce Redis bağlantısı, sonra dinleme satırı görünür.
`redis-cli PING` `PONG` döner. `CLIENT LIST` çıktısındaki `lib-name=node-redis lib-ver=6.4.0`
satırı bizim uygulamamızdır; adresi (`172.20.0.6`) Docker ağının içindendir, yani uygulama
Redis'e dışarıdaki 6379 portundan değil servis adıyla bağlanır.

```
> docker compose logs --tail 5 uygulama
> docker compose exec redis redis-cli PING
> docker compose exec redis redis-cli CLIENT LIST
```

![Redis bağlantısı](png/p3_redis_baglanti.png)
