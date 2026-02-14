const Redis = require('ioredis');

const redisConnection = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

function createRedisClient() {
  const client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisConnection);

  client.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  client.on('connect', () => {
    console.log('Redis connected successfully');
  });

  return client;
}

module.exports = { createRedisClient, redisConnection };
