const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
fs.ensureDirSync(logsDir);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'dark-server-bot' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'errors.log'), 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'bot.log'),
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'admin.log'),
      level: 'info',
      maxsize: 5242880,
      maxFiles: 3
    })
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
