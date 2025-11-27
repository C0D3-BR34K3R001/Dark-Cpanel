const moment = require('moment');
const logger = require('./logger');

// Helper function to create beautiful menu
function createMenu(title, items) {
    let menu = `╭━━〔 ${title} 〕━━┈⊷\n`;
    items.forEach((item, index) => {
        if (item === '') {
            menu += `┃✮│➣ \n`;
        } else {
            menu += `┃✮│➣ ${item}\n`;
        }
    });
    menu += `╰━━━━━━━━━━━━━┈⊷`;
    return menu;
}

module.exports = {
    formatTimeRemaining: (milliseconds) => {
        const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
        const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    },
    
    formatCurrency: (amount) => {
        return `₦${amount.toLocaleString()}`;
    },
    
    isValidUserId: (userId) => {
        return /^\d+$/.test(userId) && userId.length >= 8;
    },
    
    generateRandomString: (length = 8) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },
    
    calculateExpiryTime: (durationHours) => {
        return Date.now() + (durationHours * 60 * 60 * 1000);
    },
    
    isServerExpired: (server) => {
        return Date.now() > server.expires;
    },
    
    getServerStatus: (server) => {
        if (module.exports.isServerExpired(server)) return 'Expired';
        if (server.status === 'suspended') return 'Suspended';
        return 'Active';
    },
    
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return '';
        return input.replace(/[<>]/g, '').trim().substring(0, 500);
    },
    
    parseCommandArgs: (text) => {
        const parts = text.split(' ').filter(part => part.trim() !== '');
        return {
            command: parts[0],
            args: parts.slice(1)
        };
    },
    
    delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    
    createServerMenu: (server) => {
        const timeLeft = server.expires - Date.now();
        const hoursLeft = Math.max(0, Math.floor(timeLeft / (60 * 60 * 1000)));
        const status = module.exports.getServerStatus(server);
        
        return createMenu('SERVER DETAILS', [
            `Name: ${server.name}`,
            `RAM: ${server.ram}MB | Disk: ${server.disk}MB`,
            `Tier: ${server.tier}`,
            `Status: ${status}`,
            `Time Left: ${hoursLeft} hours`,
            `Created: ${new Date(server.created).toLocaleDateString()}`,
            `Expires: ${new Date(server.expires).toLocaleDateString()}`
        ]);
    },
    
    createUserStatsMenu: (user) => {
        return createMenu('USER STATISTICS', [
            `Name: ${user.first_name}`,
            `Tier: ${user.tier}`,
            `Balance: ₦${user.balance}`,
            `Points: ${user.points}`,
            `Servers: ${user.servers.length}`,
            `Referrals: ${user.referrals.length}`,
            `Joined: ${new Date(user.joined_date).toLocaleDateString()}`,
            `Status: ${user.verified ? 'Verified' : 'Not Verified'}`
        ]);
    },
    
    createErrorMenu: (errorMessage) => {
        return createMenu('ERROR', [
            'An error occurred',
            '',
            errorMessage,
            '',
            'Please try again or',
            'contact support'
        ]);
    },
    
    createSuccessMenu: (message) => {
        return createMenu('SUCCESS', [
            'Operation completed',
            '',
            message
        ]);
    }
};
