// import redis

const redis = require("ioredis")
// Redis in an in memory db - store data in the server's memory temporarily
// setup

const redisClient = new redis({
    // Redis Server Location
    host: "localhost",
    // port where redis runs
    port: 6379
})

// connect

redisClient.on("connect", () => {
    console.log("Redis Database Connected!")
})

// error
redisClient.on("error", (err) => {
    console.log("Redis Error:", err)
})

// export
module.exports = redisClient