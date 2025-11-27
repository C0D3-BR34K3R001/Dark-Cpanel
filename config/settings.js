const fs = require('fs-extra');
const path = require('path');

module.exports = {
    // Bot Settings
    BOT_TOKEN: "8415816270:AAFxcLS8c7Zd3rStEG3DuwxSf7LKqqVt9UA",
    ADMIN_IDS: ["7030626048"],
    ownerName: "CODEBREAKER",
    ownerLink: "https://wa.me/2347030626048",
    
    // Channel Verification
    CHANNELS: {
        TELEGRAM_MAIN: "@darkemp",
        TELEGRAM_BACKUP: "@darkempsbackup", 
        WHATSAPP_LINK: "https://whatsapp.com/channel/0029Vb70IdY60eBmvtGRT00R"
    },
    
    // Pterodactyl Panel
    PTERODACTYL: {
        DOMAIN: "http://darkempire-panels.duckdns.org",
        API_KEY: "ptla_CWN2fU2VGEhk3VdIF8aGzYA8zKR6dupnShYeoTCuaYo",
        CLIENT_KEY: "ptlc_JSe3o9re02gH89pgqg0vaEChQqhTmrkeebLU6F9JQQt",
        EGG: "15",
        NEST: "5",
        LOCATION: "1"
    },
    
    // Payment Settings
    PAYMENTS: {
        OPAY: "7030626048",
        FIRSTBANK: {
            accountNumber: "3225456249",
            accountName: "Wealth Mbaneme Chukuwemeka"
        }
    },
    
    // Points System
    POINTS: {
        FREE_SERVER_COST: 500,
        REFERRAL_POINTS: 100,
        DAILY_MATH_POINTS: 50,
        CHANNEL_JOIN_POINTS: 100,
        WHATSAPP_VERIFY_POINTS: 150
    },
    
    // Server Tiers
    SERVER_TIERS: {
        FREE: {
            name: "1GB Free",
            ram: 1024,
            disk: 5120,
            cpu: 100,
            duration: 24,
            cost: 500
        },
        BASIC: {
            name: "2GB Basic", 
            ram: 2048,
            disk: 10240,
            cpu: 200,
            duration: 168,
            cost: 1000
        },
        PRO: {
            name: "4GB Pro",
            ram: 4096, 
            disk: 20480,
            cpu: 400,
            duration: 720,
            cost: 2500
        },
        PREMIUM: {
            name: "8GB Premium",
            ram: 8192,
            disk: 40960, 
            cpu: 800,
            duration: 720,
            cost: 5000
        }
    },
    
    // Admin Settings
    ADMIN_FEATURES: {
        INFINITE_MONEY: true,
        INFINITE_POINTS: true,
        CAN_GIFT_USERS: true,
        CAN_GRANT_ADMIN: true
    }
};
