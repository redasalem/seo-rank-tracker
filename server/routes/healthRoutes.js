import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', (req, res) => {
    const dbStatus = mongoose.connection.readyState;
    // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting

    let dbStateString = 'disconnected';
    if (dbStatus === 1) dbStateString = 'connected';
    else if (dbStatus === 2) dbStateString = 'connecting';
    else if (dbStatus === 3) dbStateString = 'disconnecting';

    const healthCheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        database: dbStateString,
    };

    try {
        if (dbStatus === 1) {
            res.status(200).json(healthCheck);
        } else {
            // DB is not connected, but server is responding. We return 503 Service Unavailable.
            healthCheck.message = 'Service Unavailable - Database connection issue';
            res.status(503).json(healthCheck);
        }
    } catch (error) {
        healthCheck.message = error.message;
        res.status(503).json(healthCheck);
    }
});

export default router;
