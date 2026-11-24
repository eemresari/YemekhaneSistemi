const { createClient } = require('redis');

// Uygulamanın tek Redis bağlantısı. Menü önbelleği ve oturum deposu bunu ortak kullanır.
// Adres docker-compose.yml'den ortam değişkeni olarak gelir (servis adı + iç port).
const redis = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
});

// 'error' olayını dinlemek zorunlu: dinleyici yoksa Node bağlantı hatasında uygulamayı çökertir.
// Bağlantı koparsa istemci kendiliğinden yeniden bağlanmayı dener.
redis.on('error', (err) => console.error(`Redis hatası: ${err.message}`));
redis.on('ready', () => console.log('Redis\'e bağlanıldı'));

module.exports = redis;
