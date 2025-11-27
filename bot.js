const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const moment = require('moment');
const cron = require('node-cron');

// Load config
global.config = require('./config/settings');
global.messages = require('./config/messages');

// Initialize bot
const bot = new TelegramBot(global.config.BOT_TOKEN, { polling: true });

// Load database
const databasePath = path.join(__dirname, 'database/users.json');
let database = { users: {}, servers: {}, payments: {}, broadcastMode: {}, tempAdmins: {} };

// Load handlers and utils
const commandsHandler = require('./handlers/commands');
const adminHandler = require('./handlers/admin'); 
const verificationHandler = require('./handlers/verification');
const pterodactyl = require('./utils/pterodactyl');
const pointsSystem = require('./utils/points');
const helpers = require('./utils/helpers');
const backup = require('./utils/backup');
const logger = require('./utils/logger');

// Initialize database
async function initializeDatabase() {
    try {
        if (await fs.pathExists(databasePath)) {
            database = await fs.readJson(databasePath);
            logger.info('Database loaded successfully');
        } else {
            await fs.writeJson(databasePath, database);
            logger.info('New database created');
        }
        console.log(chalk.green('✅ Database initialized'));
    } catch (error) {
        logger.error('Database initialization failed', error);
        console.log(chalk.red('❌ Database error:'), error);
    }
}

// Save database
async function saveDatabase() {
    try {
        await fs.writeJson(databasePath, database, { spaces: 2 });
    } catch (error) {
        logger.error('Failed to save database', error);
        console.log(chalk.red('❌ Save database error:'), error);
    }
}

// Get user data
function getUser(userId) {
    if (!database.users[userId]) {
        database.users[userId] = {
            id: userId,
            username: '',
            first_name: '',
            balance: 0,
            points: 0,
            tier: 'free',
            verified: false,
            channels: {
                telegramMain: false,
                telegramBackup: false,
                whatsapp: false
            },
            servers: [],
            referrals: [],
            joined_date: Date.now(),
            last_daily_math: 0,
            telegramMainAwarded: false,
            telegramBackupAwarded: false,
            whatsappAwarded: false,
            completionBonusAwarded: false,
            referredBy: null
        };
    }
    return database.users[userId];
}

// Check if user is admin
function isUserAdmin(userId) {
    // Check permanent admins
    if (global.config.ADMIN_IDS.includes(userId)) {
        return { isAdmin: true, isPermanent: true };
    }
    
    // Check temporary admins
    if (database.tempAdmins && database.tempAdmins[userId]) {
        const adminData = database.tempAdmins[userId];
        
        // Check if expired
        if (Date.now() > adminData.expiresAt) {
            delete database.tempAdmins[userId];
            saveDatabase();
            logger.info(`Temporary admin expired: ${userId}`);
            return { isAdmin: false, isPermanent: false };
        }
        
        return { isAdmin: true, isPermanent: false, data: adminData };
    }
    
    return { isAdmin: false, isPermanent: false };
}

// Clean expired temporary admins
function cleanExpiredAdmins() {
    if (!database.tempAdmins) return;
    
    const now = Date.now();
    let cleaned = 0;
    
    for (const [adminId, adminData] of Object.entries(database.tempAdmins)) {
        if (now > adminData.expiresAt) {
            delete database.tempAdmins[adminId];
            cleaned++;
            logger.info(`Cleaned expired admin: ${adminId}`);
        }
    }
    
    if (cleaned > 0) {
        saveDatabase();
        console.log(chalk.yellow(`🧹 Cleaned ${cleaned} expired temporary admins`));
    }
}

// Helper function to send images
async function sendImage(chatId, imageName, caption = '', parseMode = 'Markdown') {
    try {
        const imagePath = path.join(__dirname, 'assets/images', imageName);
        if (await fs.pathExists(imagePath)) {
            await bot.sendPhoto(chatId, imagePath, {
                caption: caption,
                parse_mode: parseMode
            });
            return true;
        }
    } catch (error) {
        logger.error(`Failed to send image ${imageName}`, error);
    }
    return false;
}

// Start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    // Update user info
    user.username = msg.from.username || '';
    user.first_name = msg.from.first_name || '';
    
    await saveDatabase();
    
    logger.info(`User started bot: ${userId} - ${user.first_name}`);
    
    // Check if this is a referral start
    const parts = msg.text.split(' ');
    if (parts.length > 1) {
        const referralCode = parts[1];
        await handleReferralStart(msg, referralCode);
    }
    
    // Send welcome image if available
    const welcomeCaption = `👋 *Welcome to Dark Server Manager!*\n\nI can help you create and manage game servers instantly!\n\nUse /menu to get started!`;
    await sendImage(chatId, 'welcome.jpg', welcomeCaption);
    
    // Check verification
    if (!user.verified) {
        await bot.sendMessage(chatId, global.messages.VERIFICATION_REQUIRED, { parse_mode: 'Markdown' });
    }
});

// Menu command
bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    if (!user.verified) {
        return await bot.sendMessage(chatId, global.messages.NOT_VERIFIED, { parse_mode: 'Markdown' });
    }
    
    const menuText = `🏠 *Dark Panel Manager*

🤖 *Bot Status:* ✅ Online
👤 *Your Tier:* ${user.tier}
💰 *Balance:* ₦${user.balance}
⭐ *Points:* ${user.points}

*Available Commands:*
🔄 /verify - Verify channels & earn points
🚀 /create - Create new server  
📊 /myservers - View your servers
💰 /balance - Fund your account
🎯 /tasks - Earn more points
👥 /referral - Refer friends
📞 /contact - Contact owner

*Use buttons below for quick access:*`;
    
    const menuButtons = {
        reply_markup: {
            keyboard: [
                ['🚀 Create Server', '📊 My Servers'],
                ['💰 Fund Balance', '⭐ Earn Points'],
                ['🔗 Refer Friends', '📞 Contact Owner']
            ],
            resize_keyboard: true
        }
    };
    
    await bot.sendMessage(chatId, menuText, { parse_mode: 'Markdown', ...menuButtons });
});

// Admin commands
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Check if user is admin (permanent or temporary)
    const adminCheck = isUserAdmin(userId);
    if (!adminCheck.isAdmin) {
        return await bot.sendMessage(chatId, global.messages.ACCESS_DENIED);
    }
    
    logger.info(`Admin command used by: ${userId}`);
    
    // Load admin handler
    await adminHandler.handleAdminCommand(bot, msg, database);
});

// Grant command
bot.onText(/\/grant/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    // Only permanent admins can use /grant
    const adminCheck = isUserAdmin(userId);
    if (!adminCheck.isAdmin || !adminCheck.isPermanent) {
        return await bot.sendMessage(chatId, '❌ Only permanent admins can use /grant command.');
    }
    
    await adminHandler.handleAdminCommand(bot, msg, database);
});

// Verification command
bot.onText(/\/verify/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    // Send verification image first
    const verificationCaption = `🔐 *Channel Verification Required*\n\nJoin our channels to unlock server creation and earn points!\n\n*Complete all verifications to get 350 points!*`;
    await sendImage(chatId, 'verification.jpg', verificationCaption);
    
    // Then show verification status
    await verificationHandler.handleVerification(bot, msg, database);
});

// Create server command
bot.onText(/\/create/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    if (!user.verified) {
        return await bot.sendMessage(chatId, global.messages.NOT_VERIFIED, { parse_mode: 'Markdown' });
    }
    
    // Send server tiers image if available
    const serverCaption = `🚀 *Choose Your Server Plan*\n\nSelect from free (points) or paid tiers below!`;
    await sendImage(chatId, 'server_tiers.jpg', serverCaption);
    
    await showServerTiers(bot, chatId, user);
});

// Balance command
bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    // Send payment methods image if available
    const paymentCaption = `💰 *Fund Your Account*\n\nYour balance: ₦${user.balance}\n\nSend payment to the accounts below and contact us with proof!`;
    await sendImage(chatId, 'payment_methods.jpg', paymentCaption);
    
    const balanceText = `💰 *Your Balance*

💵 Cash Balance: ₦${user.balance}
⭐ Points Balance: ${user.points}

*Payment Methods:*
• OPay: ${global.config.PAYMENTS.OPAY}
• First Bank: ${global.config.PAYMENTS.FIRSTBANK.accountNumber} (${global.config.PAYMENTS.FIRSTBANK.accountName})

*How to Fund:*
1. Send money to any of the accounts above
2. Use /contact to send payment proof
3. We'll credit your balance within minutes`;

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '💳 Fund Account', callback_data: 'fund_account' }],
                [{ text: '📞 Contact Owner', callback_data: 'contact_owner' }]
            ]
        }
    };

    await bot.sendMessage(chatId, balanceText, { parse_mode: 'Markdown', ...buttons });
});

// Tasks command
bot.onText(/\/tasks/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    const tasksText = `🎯 *Earn Points*

Complete tasks to earn points and get FREE servers!

📊 *Your Points:* ${user.points}
🎯 *Target:* ${global.config.POINTS.FREE_SERVER_COST} points for FREE 1GB server

*Available Tasks:*

🔐 *Channel Verification* (350 points total)
• Join Telegram channels: 200 points
• Verify WhatsApp: 150 points

🧮 *Daily Math Challenge* (50 points/day)
Solve a simple math problem

👥 *Refer Friends* (100 points each)
Get points when friends join and verify

📢 *Watch Ads* (25 points each)
Watch short advertisements`;

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🧮 Daily Math', callback_data: 'daily_math' }],
                [{ text: '👥 Refer Friends', callback_data: 'refer_friends' }],
                [{ text: '🔐 Verify Channels', callback_data: 'verify_channels' }]
            ]
        }
    };

    await bot.sendMessage(chatId, tasksText, { parse_mode: 'Markdown', ...buttons });
});

// Contact command
bot.onText(/\/contact/, async (msg) => {
    const chatId = msg.chat.id;
    
    // Send contact image if available
    const contactCaption = `📞 *Contact Support*\n\nNeed help? Contact us below!`;
    await sendImage(chatId, 'contact_info.jpg', contactCaption);
    
    await bot.sendMessage(chatId, 
        `📞 *Contact Owner*\n\n` +
        `For support, payments, or questions:\n\n` +
        `👤 Owner: ${global.config.ownerName}\n` +
        `📱 WhatsApp: ${global.config.ownerLink}\n\n` +
        `Please allow up to 30 minutes for responses during business hours.`,
        { parse_mode: 'Markdown' }
    );
});

// My servers command
bot.onText(/\/myservers/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    if (!user.verified) {
        return await bot.sendMessage(chatId, global.messages.NOT_VERIFIED, { parse_mode: 'Markdown' });
    }
    
    if (user.servers.length === 0) {
        return await bot.sendMessage(chatId, '❌ You have no active servers. Use /create to get started!');
    }
    
    let serversText = `📊 *Your Servers*\n\n`;
    
    for (const serverId of user.servers) {
        const server = database.servers[serverId];
        if (server) {
            const expires = new Date(server.expires).toLocaleString();
            const created = new Date(server.created).toLocaleString();
            const timeLeft = server.expires - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (60 * 60 * 1000)));
            
            serversText += `🖥️ *${server.name}*\n`;
            serversText += `💾 RAM: ${server.ram}MB\n`;
            serversText += `📦 Disk: ${server.disk}MB\n`;
            serversText += `⏰ Time Left: ${hoursLeft} hours\n`;
            serversText += `📅 Expires: ${expires}\n`;
            serversText += `🔗 Status: ${server.status || 'Active'}\n\n`;
        }
    }
    
    await bot.sendMessage(chatId, serversText, { parse_mode: 'Markdown' });
});

// Referral command
bot.onText(/\/referral/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    // Send referral image if available
    const referralCaption = `👥 *Referral Program*\n\nEarn points by inviting friends!`;
    await sendImage(chatId, 'referral_guide.jpg', referralCaption);
    
    const referralCode = `DARK${userId.slice(-6)}`;
    
    const referralText = `👥 *Referral Program*

Earn ${global.config.POINTS.REFERRAL_POINTS} points for each friend who joins and verifies!

📋 *How it works:*
1. Share your referral link with friends
2. They join using your link
3. They complete verification
4. You get ${global.config.POINTS.REFERRAL_POINTS} points!

🔗 *Your Referral Link:*
https://t.me/${(await bot.getMe()).username}?start=${referralCode}

📊 *Your Stats:*
• Total Referrals: ${user.referrals.length}
• Points Earned: ${user.referrals.length * global.config.POINTS.REFERRAL_POINTS}

Share your link and start earning!`;

    await bot.sendMessage(chatId, referralText, { parse_mode: 'Markdown' });
});

// Handle all messages (for broadcast mode and screenshot uploads)
bot.on('message', async (msg) => {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    
    // Check if admin is in broadcast mode
    if (database.broadcastMode && database.broadcastMode[userId]) {
        await adminHandler.handleAdminCommand(bot, msg, database);
        return;
    }
    
    // Check if user is sending screenshot for verification
    if (msg.photo && !msg.text?.startsWith('/')) {
        await verificationHandler.handleScreenshotUpload(bot, msg, database);
        return;
    }
});

// Handle callback queries
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id.toString();
    const chatId = msg.chat.id;
    
    try {
        // Handle verification callbacks
        if (data.startsWith('verify_')) {
            await verificationHandler.handleVerificationCallback(bot, callbackQuery, database);
        }
        
        // Handle admin callbacks
        if (data.startsWith('admin_')) {
            // Check if user is admin
            const adminCheck = isUserAdmin(userId);
            if (!adminCheck.isAdmin) {
                return await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Access Denied' });
            }
            await adminHandler.handleAdminCallback(bot, callbackQuery, database);
        }
        
        // Handle create server callbacks
        if (data.startsWith('create_')) {
            await handleCreateCallback(bot, callbackQuery, database);
        }
        
        // Handle other callbacks
        if (data === 'fund_account') {
            const paymentCaption = `💳 *Fund Your Account*\n\nSend payment to the accounts below!`;
            await sendImage(chatId, 'payment_methods.jpg', paymentCaption);
            
            await bot.sendMessage(chatId, 
                `💳 *Fund Your Account*\n\n` +
                `Send payment to:\n\n` +
                `📱 *OPay:* ${global.config.PAYMENTS.OPAY}\n` +
                `🏦 *First Bank:* ${global.config.PAYMENTS.FIRSTBANK.accountNumber}\n` +
                `👤 *Account Name:* ${global.config.PAYMENTS.FIRSTBANK.accountName}\n\n` +
                `After payment, send screenshot to @${global.config.ADMIN_IDS[0]} for confirmation.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        if (data === 'contact_owner') {
            const contactCaption = `📞 *Contact Support*\n\nGet in touch with us!`;
            await sendImage(chatId, 'contact_info.jpg', contactCaption);
            
            await bot.sendMessage(chatId, 
                `📞 *Contact Owner*\n\n` +
                `WhatsApp: ${global.config.ownerLink}\n` +
                `Telegram: @${global.config.ADMIN_IDS[0]}\n\n` +
                `For payment confirmations and support.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        if (data === 'verify_channels') {
            const verificationCaption = `🔐 *Channel Verification*\n\nComplete verification to unlock features!`;
            await sendImage(chatId, 'verification.jpg', verificationCaption);
            
            await verificationHandler.handleVerification(bot, msg, database);
        }
        
        if (data === 'daily_math') {
            await handleDailyMath(bot, msg, database);
        }
        
        if (data === 'refer_friends') {
            const referralCaption = `👥 *Refer Friends*\n\nEarn points by inviting friends!`;
            await sendImage(chatId, 'referral_guide.jpg', referralCaption);
            
            await bot.sendMessage(chatId, 
                `Use /referral to get your referral link and start earning points!`,
                { parse_mode: 'Markdown' }
            );
        }
        
        if (data === 'fund_balance') {
            const paymentCaption = `💳 *Fund Your Account*\n\nAdd balance to create paid servers!`;
            await sendImage(chatId, 'payment_methods.jpg', paymentCaption);
            
            await bot.sendMessage(chatId, 
                `💳 *Fund Your Account*\n\n` +
                `Send payment to:\n\n` +
                `📱 *OPay:* ${global.config.PAYMENTS.OPAY}\n` +
                `🏦 *First Bank:* ${global.config.PAYMENTS.FIRSTBANK.accountNumber}\n` +
                `👤 *Account Name:* ${global.config.PAYMENTS.FIRSTBANK.accountName}\n\n` +
                `After payment, contact @${global.config.ADMIN_IDS[0]} with screenshot for confirmation.`,
                { parse_mode: 'Markdown' }
            );
        }
        
        if (data === 'earn_points') {
            await bot.sendMessage(chatId, 
                `Use /tasks to see all available ways to earn points!`,
                { parse_mode: 'Markdown' }
            );
        }
        
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        logger.error('Callback query error', error);
        console.log(chalk.red('Callback error:'), error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: '❌ An error occurred' });
    }
});

// Show server tiers
async function showServerTiers(bot, chatId, user) {
    const tiersText = `🚀 *Create Server*

Choose your server plan:

🆓 *FREE TIER* (Points)
• RAM: 1GB • Disk: 5GB
• Duration: 24 hours
• Cost: ${global.config.POINTS.FREE_SERVER_COST} points
• Your points: ${user.points}

💰 *PAID TIERS* (Balance)

🟢 BASIC - ₦1,000
• RAM: 2GB • Disk: 10GB
• Duration: 7 days
• Your balance: ₦${user.balance}

🟡 PRO - ₦2,500
• RAM: 4GB • Disk: 20GB  
• Duration: 30 days
• Your balance: ₦${user.balance}

🔴 PREMIUM - ₦5,000
• RAM: 8GB • Disk: 40GB
• Duration: 30 days
• Your balance: ₦${user.balance}`;

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🆓 Free (Points)', callback_data: 'create_free' }],
                [{ text: '🟢 Basic (₦1,000)', callback_data: 'create_basic' }],
                [{ text: '🟡 Pro (₦2,500)', callback_data: 'create_pro' }],
                [{ text: '🔴 Premium (₦5,000)', callback_data: 'create_premium' }],
                [{ text: '💰 Fund Balance', callback_data: 'fund_balance' }],
                [{ text: '⭐ Earn Points', callback_data: 'earn_points' }]
            ]
        }
    };

    await bot.sendMessage(chatId, tiersText, { parse_mode: 'Markdown', ...buttons });
}

// Handle create server callbacks
async function handleCreateCallback(bot, callbackQuery, database) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString();
    const user = getUser(userId);
    const data = callbackQuery.data;
    
    if (!user.verified) {
        return await bot.sendMessage(chatId, global.messages.NOT_VERIFIED, { parse_mode: 'Markdown' });
    }
    
    if (data === 'create_free') {
        if (user.points < global.config.POINTS.FREE_SERVER_COST) {
            return await bot.sendMessage(chatId, 
                `❌ Insufficient points!\n\n` +
                `You need ${global.config.POINTS.FREE_SERVER_COST} points, but you have ${user.points}.\n` +
                `Use /tasks to earn more points!`
            );
        }
        
        // Deduct points and create server
        user.points -= global.config.POINTS.FREE_SERVER_COST;
        await createServerForUser(bot, chatId, user, global.config.SERVER_TIERS.FREE, database);
    }
    else if (data === 'create_basic') {
        if (user.balance < 1000) {
            return await bot.sendMessage(chatId, 
                `❌ Insufficient balance!\n\n` +
                `You need ₦1,000, but you have ₦${user.balance}.\n` +
                `Use /balance to fund your account!`
            );
        }
        
        user.balance -= 1000;
        await createServerForUser(bot, chatId, user, global.config.SERVER_TIERS.BASIC, database);
    }
    else if (data === 'create_pro') {
        if (user.balance < 2500) {
            return await bot.sendMessage(chatId, 
                `❌ Insufficient balance!\n\n` +
                `You need ₦2,500, but you have ₦${user.balance}.\n` +
                `Use /balance to fund your account!`
            );
        }
        
        user.balance -= 2500;
        await createServerForUser(bot, chatId, user, global.config.SERVER_TIERS.PRO, database);
    }
    else if (data === 'create_premium') {
        if (user.balance < 5000) {
            return await bot.sendMessage(chatId, 
                `❌ Insufficient balance!\n\n` +
                `You need ₦5,000, but you have ₦${user.balance}.\n` +
                `Use /balance to fund your account!`
            );
        }
        
        user.balance -= 5000;
        await createServerForUser(bot, chatId, user, global.config.SERVER_TIERS.PREMIUM, database);
    }
    
    await saveDatabase();
}

// Create server for user
async function createServerForUser(bot, chatId, user, tier, database) {
    try {
        await bot.sendMessage(chatId, '🔄 Creating your server... This may take a few minutes.');
        
        // Create server via Pterodactyl
        const serverData = await pterodactyl.createServer(user, tier);
        
        // Save server to database
        const serverId = serverData.attributes.id;
        database.servers[serverId] = {
            id: serverId,
            name: serverData.attributes.name,
            ownerId: user.id,
            ram: tier.ram,
            disk: tier.disk,
            created: Date.now(),
            expires: Date.now() + (tier.duration * 60 * 60 * 1000),
            tier: tier.name,
            status: 'Active'
        };
        
        user.servers.push(serverId);
        await saveDatabase();
        
        logger.info(`Server created: ${serverId} for user ${user.id}`);
        
        await bot.sendMessage(chatId,
            `✅ *Server Created Successfully!*\n\n` +
            `🖥️ *Name:* ${serverData.attributes.name}\n` +
            `💾 *RAM:* ${tier.ram}MB\n` +
            `📦 *Disk:* ${tier.disk}MB\n` +
            `⏰ *Duration:* ${tier.duration} hours\n` +
            `📅 *Expires:* ${new Date(database.servers[serverId].expires).toLocaleString()}\n\n` +
            `Use /myservers to view your servers.`
        , { parse_mode: 'Markdown' });
        
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Failed to create server. Please try again or contact support.');
        logger.error('Server creation failed', error);
        console.log(chalk.red('Create server error:'), error);
        
        // Refund points/balance if creation failed
        if (tier.name === '1GB Free') {
            user.points += global.config.POINTS.FREE_SERVER_COST;
        } else if (tier.name === '2GB Basic') {
            user.balance += 1000;
        } else if (tier.name === '4GB Pro') {
            user.balance += 2500;
        } else if (tier.name === '8GB Premium') {
            user.balance += 5000;
        }
        await saveDatabase();
    }
}

// Handle daily math challenge
async function handleDailyMath(bot, msg, database) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    // Check if user already did daily math today
    const lastMath = user.last_daily_math || 0;
    const today = new Date().toDateString();
    const lastMathDate = new Date(lastMath).toDateString();
    
    if (lastMathDate === today) {
        return await bot.sendMessage(chatId, 
            '❌ You have already completed your daily math challenge today. Try again tomorrow!'
        );
    }
    
    // Generate simple math problem
    const num1 = Math.floor(Math.random() * 50) + 1;
    const num2 = Math.floor(Math.random() * 50) + 1;
    const operators = ['+', '-', '*'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let answer;
    switch (operator) {
        case '+': answer = num1 + num2; break;
        case '-': answer = num1 - num2; break;
        case '*': answer = num1 * num2; break;
    }
    
    // Store the answer temporarily
    if (!database.mathChallenges) database.mathChallenges = {};
    database.mathChallenges[userId] = {
        answer: answer,
        problem: `${num1} ${operator} ${num2}`
    };
    
    const mathText = `🧮 *Daily Math Challenge*
    
Solve this problem to earn ${global.config.POINTS.DAILY_MATH_POINTS} points:

*${num1} ${operator} ${num2} = ?*

Reply with your answer!`;
    
    await bot.sendMessage(chatId, mathText, { parse_mode: 'Markdown' });
}

// Handle referral start
async function handleReferralStart(msg, referralCode) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    if (referralCode.startsWith('DARK')) {
        const referrerId = referralCode.replace('DARK', '');
        const referrer = database.users[referrerId];
        
        if (referrer && referrer.id !== userId) {
            // Check if this user was already referred
            const newUser = getUser(userId);
            if (!newUser.referredBy) {
                newUser.referredBy = referrerId;
                referrer.referrals.push(userId);
                await saveDatabase();
                
                logger.info(`New referral: ${userId} referred by ${referrerId}`);
                
                // Notify referrer
                try {
                    await bot.sendMessage(referrerId,
                        `🎉 *New Referral!*\n\n` +
                        `${newUser.first_name} joined using your referral link!\n` +
                        `You'll get ${global.config.POINTS.REFERRAL_POINTS} points when they complete verification.`
                    , { parse_mode: 'Markdown' });
                } catch (error) {
                    logger.error('Failed to notify referrer', error);
                }
            }
        }
    }
}

// Handle text messages for math answers
bot.on('text', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text;
    
    // Skip if it's a command
    if (text.startsWith('/')) return;
    
    // Check if it's a math answer
    if (database.mathChallenges && database.mathChallenges[userId] && !isNaN(text)) {
        const userAnswer = parseInt(text);
        const correctAnswer = database.mathChallenges[userId].answer;
        const problem = database.mathChallenges[userId].problem;
        
        if (userAnswer === correctAnswer) {
            const user = getUser(userId);
            user.points += global.config.POINTS.DAILY_MATH_POINTS;
            user.last_daily_math = Date.now();
            delete database.mathChallenges[userId];
            await saveDatabase();
            
            logger.info(`User ${userId} completed daily math challenge`);
            
            await bot.sendMessage(chatId,
                `✅ *Correct Answer!*\n\n` +
                `🎉 You earned ${global.config.POINTS.DAILY_MATH_POINTS} points!\n` +
                `📊 Total points: ${user.points}\n\n` +
                `${problem} = ${correctAnswer}`
            , { parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, 
                `❌ Wrong answer. The correct answer was ${correctAnswer}.\n` +
                `Try again tomorrow!`
            );
            delete database.mathChallenges[userId];
        }
    }
});

// Cleanup expired servers
async function cleanupExpiredServers() {
    const now = Date.now();
    let deletedCount = 0;
    
    for (const serverId in database.servers) {
        const server = database.servers[serverId];
        if (server.expires < now) {
            try {
                await pterodactyl.deleteServer(serverId);
                delete database.servers[serverId];
                
                // Remove from user's server list
                const user = database.users[server.ownerId];
                if (user) {
                    user.servers = user.servers.filter(s => s !== serverId);
                }
                
                deletedCount++;
                logger.info(`Deleted expired server: ${serverId}`);
            } catch (error) {
                logger.error(`Failed to delete server ${serverId}`, error);
                console.log(chalk.red(`Failed to delete server ${serverId}:`), error);
            }
        }
    }
    
    if (deletedCount > 0) {
        await saveDatabase();
        console.log(chalk.yellow(`🧹 Cleaned up ${deletedCount} expired servers`));
    }
}

// Clean temporary files
async function cleanTempFiles() {
    const tempPath = path.join(__dirname, 'temp');
    try {
        if (await fs.pathExists(tempPath)) {
            const files = await fs.readdir(tempPath);
            const now = Date.now();
            const dayInMs = 24 * 60 * 60 * 1000;
            
            for (const file of files) {
                const filePath = path.join(tempPath, file);
                const stats = await fs.stat(filePath);
                
                // Delete files older than 24 hours
                if (now - stats.mtimeMs > dayInMs) {
                    await fs.remove(filePath);
                    logger.info(`Cleaned temp file: ${file}`);
                    console.log(chalk.yellow(`🧹 Cleaned temp file: ${file}`));
                }
            }
        }
    } catch (error) {
        logger.error('Temp cleanup error', error);
        console.log(chalk.red('Temp cleanup error:'), error);
    }
}

// Initialize and start bot
async function startBot() {
    await initializeDatabase();
    
    // Clean expired admins on startup
    cleanExpiredAdmins();
    
    // Create necessary directories
    await fs.ensureDir(path.join(__dirname, 'temp/screenshots'));
    await fs.ensureDir(path.join(__dirname, 'temp/uploads'));
    await fs.ensureDir(path.join(__dirname, 'temp/cache'));
    await fs.ensureDir(path.join(__dirname, 'database/backups'));
    await fs.ensureDir(path.join(__dirname, 'database/restore_backups'));
    await fs.ensureDir(path.join(__dirname, 'logs'));
    await fs.ensureDir(path.join(__dirname, 'assets/images'));
    
    console.log(chalk.blue('🤖 Dark Server Bot started successfully'));
    console.log(chalk.yellow('📱 Bot is listening for messages...'));
    logger.info('Bot started successfully');
    
    // Schedule cleanup tasks
    cron.schedule('0 * * * *', async () => { // Every hour
        cleanupExpiredServers();
        cleanExpiredAdmins();
        await backup.createBackup();
        await backup.cleanupOldBackups();
    });
    
    cron.schedule('0 0 * * *', async () => { // Every day at midnight
        cleanTempFiles();
    });
    
    // Manual cleanup interval (fallback)
    setInterval(() => {
        cleanupExpiredServers();
        cleanExpiredAdmins();
    }, 60 * 60 * 1000); // Every hour
}

// Handle errors
bot.on('error', (error) => {
    logger.error('Bot error', error);
    console.log(chalk.red('❌ Bot error:'), error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    console.log(chalk.red('❌ Uncaught Exception:'), error);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection', error);
    console.log(chalk.red('❌ Unhandled Rejection:'), error);
});

// Start the bot
startBot();