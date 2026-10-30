// import redis
const redis = require('ioredis');

let redisClient = null;

// Avoid connecting to Redis during test runs to prevent open handles, connection errors, and test cross-contamination
if (process.env.NODE_ENV !== 'test') {
    try {
        redisClient = new redis({
            // Redis Server Location
            host: process.env.REDIS_HOST || 'localhost',
            // port where redis runs
            port: process.env.REDIS_PORT || 6379,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false, // Don't hang requests if Redis is offline
            retryStrategy(times) {
                if (times > 3) {
                    return null; // Stop retrying if Redis is unavailable
                }
                return Math.min(times * 100, 2000);
            },
        });

        // connect
        redisClient.on('connect', () => {
            console.log('Redis Database Connected!');
        });

        // error
        redisClient.on('error', (err) => {
            // Gracefully log Redis error without crashing the process
            // console.log("Redis Error:", err.message);
        });
    } catch (error) {
        redisClient = null;
    }
}

// export
module.exports = redisClient;