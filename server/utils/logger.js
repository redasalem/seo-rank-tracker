import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const sensitiveKeys = ['password', 'newPassword', 'currentPassword', 'token', 'accessToken', 'refreshToken'];

const maskSensitiveData = winston.format((info) => {
    const clone = { ...info };
    
    const maskObject = (obj) => {
        if (!obj || typeof obj !== 'object') return obj;
        for (const key in obj) {
            if (sensitiveKeys.includes(key) && typeof obj[key] === 'string') {
                obj[key] = '***MASKED***';
            } else if (typeof obj[key] === 'object') {
                obj[key] = maskObject({ ...obj[key] });
            }
        }
        return obj;
    };
    
    return maskObject(clone);
});

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
    let output = message;
    if (typeof message === 'object') {
        output = JSON.stringify(message);
    }
    return `${timestamp} ${level}: ${stack || output}`;
});

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: combine(
        maskSensitiveData(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }), // Allows logging error stacks
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                logFormat
            )
        }),
    ],
});

export default logger;
