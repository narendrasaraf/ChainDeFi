const mongoose = require('mongoose');
const { createClient } = require('redis');


const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            // Recommended options
            // Short server selection timeout helps surface DNS/connection issues faster
            serverSelectionTimeoutMS: 10000,
            // Force IPv4 in some environments where IPv6/DNS causes SRV resolution issues
            family: 4
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        console.error('MongoDB error code:', error.code);
        console.error(error.stack);

        // Helpful hint for SRV/DNS failures
        if (error.message && error.message.includes('querySrv')) {
            console.warn('SRV DNS lookup failed. Try running:');
            console.warn(`  nslookup -type=SRV _mongodb._tcp.${extractHostFromUri(process.env.MONGO_URI)}`);
            console.warn('Or obtain the standard (mongodb://) connection string from MongoDB Atlas and set `MONGO_URI` accordingly.');
        }

        // If SRV/DNS failed and a non-SRV fallback is provided, try it once
        if (process.env.MONGO_URI_FALLBACK && error.message && error.message.includes('querySrv')) {
            try {
                console.log('Attempting MongoDB fallback using MONGO_URI_FALLBACK');
                const fallbackConn = await mongoose.connect(process.env.MONGO_URI_FALLBACK, {
                    serverSelectionTimeoutMS: 10000,
                    family: 4
                });
                console.log(`MongoDB Connected (fallback): ${fallbackConn.connection.host}`);
                return;
            } catch (fbErr) {
                console.error('Fallback MongoDB connection failed:', fbErr.message);
                console.error(fbErr.stack);
            }
        }

        // If the initial connection fails, retry after a few seconds
        setTimeout(connectDB, 5000);
    }
};

function extractHostFromUri(uri) {
    try {
        // remove prefix like mongodb+srv:// and credentials
        const stripped = uri.replace(/^mongodb(?:\+srv)?:\/\//, '');
        // remove credentials if present
        const afterCreds = stripped.includes('@') ? stripped.split('@')[1] : stripped;
        // host is up to first slash
        return afterCreds.split('/')[0];
    } catch (e) {
        return '<your-atlas-host>';
    }
}
let redisClient;

const connectRedis = async () => {
    try {
        redisClient = createClient({
            url: process.env.REDIS_URL
        });

        redisClient.on('error', (err) => console.log('Redis Client Error', err));

        await redisClient.connect();
        console.log('Redis connected successfully');
    } catch (err) {
        console.error(`Error connecting to Redis: ${err.message}`);
    }
}

module.exports = { connectDB, connectRedis, getRedisClient: () => redisClient };
