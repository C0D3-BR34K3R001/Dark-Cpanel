const moment = require('moment');
const logger = require('./logger');

module.exports = {
    // Format time remaining
    formatTimeRemaining: (milliseconds) => {
        const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
        const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },
    
    // Format currency
    formatCurrency: (amount) => {
        return `₦${amount.toLocaleString()}`;
    },
    
    // Validate user ID
    isValidUserId: (userId) => {
        return /^\d+$/.test(userId) && userId.length >= 8;
    },
    
    // Generate random string
    generateRandomString: (length = 8) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    // Calculate server expiry time
    calculateExpiryTime: (durationHours) => {
        return Date.now() + (durationHours * 60 * 60 * 1000);
    },
    
    // Check if server is expired
    isServerExpired: (server) => {
        return Date.now() > server.expires;
    },
    
    // Get server status
    getServerStatus: (server) => {
        if (this.isServerExpired(server)) return 'Expired';
        if (server.status === 'suspended') return 'Suspended';
        return 'Active';
    },
    
    // Sanitize user input
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return '';
        return input.replace(/[<>]/g, '').trim().substring(0, 500);
    },
    
    // Parse command arguments
    parseCommandArgs: (text) => {
        const parts = text.split(' ').filter(part => part.trim() !== '');
        return {
            command: parts[0],
            args: parts.slice(1)
        };
    },
    
    // Delay function
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};