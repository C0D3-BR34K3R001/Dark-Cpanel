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
        console.log(chalk.green('Database initialized'));
    } catch (error) {
        logger.error('Database initialization failed', error);
        console.log(chalk.red('Database error:'), error);
    }
}

// Save database
async function saveDatabase() {
    try {
        await fs.writeJson(databasePath, database, { spaces: 2 });
    } catch (error) {
        logger.error('Failed to save database', error);
        console.log(chalk.red('Save database error:'), error);
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
    if (global.config.ADMIN_IDS.includes(userId)) {
        return { isAdmin: true, isPermanent: true };
    }
    
    if (database.tempAdmins && database.tempAdmins[userId]) {
        const adminData = database.tempAdmins[userId];
        
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
        }
    }
    
    if (cleaned > 0) {
        saveDatabase();
        console.log(chalk.yellow(`Cleaned ${cleaned} expired temporary admins`));
    }
}

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

// Helper function to send images
async function sendImage(chatId, imageName, caption = '') {
    try {
        const imagePath = path.join(__dirname, 'assets/images', imageName);
        if (await fs.pathExists(imagePath)) {
            await bot.sendPhoto(chatId, imagePath, { caption: caption });
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
    
    user.username = msg.from.username || '';
    user.first_name = msg.from.first_name || '';
    
    await saveDatabase();
    
    logger.info(`User started bot: ${userId} - ${user.first_name}`);
    
    const parts = msg.text.split(' ');
    if (parts.length > 1) {
        const referralCode = parts[1];
        await handleReferralStart(msg, referralCode);
    }
    
    await sendImage(chatId, 'welcome.jpg', createMenu('WELCOME', [
        'Dark Server Manager',
        'Professional Hosting',
        '',
        'Start with /verify'
    ]));
    
    if (!user.verified) {
        await bot.sendMessage(chatId, global.messages.VERIFICATION_REQUIRED);
    } else {
        await showMainMenu(chatId, user);
    }
});

// Main menu function
async function showMainMenu(chatId, user) {
    const menuItems = [
        `User: ${user.first_name}`,
        `Tier: ${user.tier.toUpperCase()}`,
        `Balance: ₦${user.balance}`,
        `Points: ${user.points}`,
        '',
        'Create Server',
        'My Servers',
        'Account Balance',
        'Earn Points',
        'Referral Program',
        'Contact Support'
    ];

    const menuText = createMenu('DARK SERVER MANAGER', menuItems);

    const menuButtons = {
        reply_markup: {
            keyboard: [
                ['🚀 Create Server', '📊 My Servers'],
                ['💰 Account Balance', '⭐ Earn Points'],
                ['👥 Referral Program', '📞 Contact Support']
            ],
            resize_keyboard: true
        }
    };

    await bot.sendMessage(chatId, menuText, menuButtons);
}

// Menu command
bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    if (!user.verified) {
        return await bot.sendMessage(chatId, global.messages.NOT_VERIFIED);
    }
    
    await showMainMenu(chatId, user);
});

// Admin commands
bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    const adminCheck = isUserAdmin(userId);
    if (!adminCheck.isAdmin) {
        return await bot.sendMessage(chatId, global.messages.ACCESS_DENIED);
    }
    
    logger.info(`Admin command used by: ${userId}`);
    await adminHandler.handleAdminCommand(bot, msg, database);
});

// Grant command
bot.onText(/\/grant/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    const adminCheck = isUserAdmin(userId);
    if (!adminCheck.isAdmin || !adminCheck.isPermanent) {
        return await bot.sendMessage(chatId, createMenu('PERMISSION DENIED', [
            'Only permanent admins',
            'can use this command'
        ]));
    }
    
    await adminHandler.handleAdminCommand(bot, msg, database);
});

// Verification command
bot.onText(/\/verify/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    await sendImage(chatId, 'verification.jpg', createMenu('VERIFICATION', [
        'Complete all steps',
        'to unlock server creation',
        '',
        'Earn 350 points total'
    ]));
    
    await verificationHandler.handleVerification(bot, msg, database);
});

// Create server command
bot.onText(/\/create/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    if (!user.verified) {
        return await bot.sendMessage(chatId, global.messages.NOT_VERIFIED);
    }
    
    await sendImage(chatId, 'server_tiers.jpg', createMenu('SERVER PLANS', [
        'Choose your perfect',
        'server configuration',
        '',
        'Free and paid options'
    ]));
    
    await showServerTiers(chatId, user);
});

// Balance command
bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    await sendImage(chatId, 'payment_methods.jpg', createMenu('ACCOUNT BALANCE', [
        `Cash: ₦${user.balance}`,
        `Points: ${user.points}`,
        '',
        'Fund your account below'
    ]));
    
    const paymentMenu = createMenu('PAYMENT METHODS', [
        'OPAY: ' + global.config.PAYMENTS.OPAY,
        'FIRST BANK: ' + global.config.PAYMENTS.FIRSTBANK.accountNumber,
        'NAME: ' + global.config.PAYMENTS.FIRSTBANK.accountName,
        '',
        'Send payment proof to',
        'support after transaction'
    ]);

    await bot.sendMessage(chatId, paymentMenu);
});

// Tasks command
bot.onText(/\/tasks/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    const tasksMenu = createMenu('EARN POINTS', [
        `Current: ${user.points} points`,
        `Target: ${global.config.POINTS.FREE_SERVER_COST} for FREE server`,
        '',
        'Channel Verification: 350p',
        'Daily Math: 50p per day',
        'Refer Friends: 100p each',
        'Watch Ads: 25p each'
    ]);

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🧮 Daily Math', callback_data: 'daily_math' }],
                [{ text: '👥 Refer Friends', callback_data: 'refer_friends' }],
                [{ text: '🔐 Verify Channels', callback_data: 'verify_channels' }]
            ]
        }
    };

    await bot.sendMessage(chatId, tasksMenu, buttons);
});

// Contact command
bot.onText(/\/contact/, async (msg) => {
    const chatId = msg.chat.id;
    
    await sendImage(chatId, 'contact_info.jpg', createMenu('CONTACT SUPPORT', [
        'Need assistance?',
        'Contact us below',
        '',
        'Quick response guaranteed'
    ]));
    
    const contactMenu = createMenu('CONTACT DETAILS', [
        `Owner: ${global.config.ownerName}`,
        `WhatsApp: ${global.config.ownerLink}`,
        '',
        'Response time: 30 minutes',
        'during business hours'
    ]);

    await bot.sendMessage(chatId, contactMenu);
});

// My servers command
bot.onText(/\/myservers/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    if (!user.verified) {
        return await bot.sendMessage(chatId, global.messages.NOT_VERIFIED);
    }
    
    if (user.servers.length === 0) {
        const noServersMenu = createMenu('MY SERVERS', [
            'No active servers found',
            '',
            'Use /create to get',
            'your first server'
        ]);
        return await bot.sendMessage(chatId, noServersMenu);
    }
    
    let serversText = createMenu('ACTIVE SERVERS', [
        `Total: ${user.servers.length} server(s)`,
        ''
    ]);
    
    for (const serverId of user.servers) {
        const server = database.servers[serverId];
        if (server) {
            const timeLeft = server.expires - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (60 * 60 * 1000)));
            
            serversText += `\n╭━━〔 ${server.name} 〕━━┈⊷\n`;
            serversText += `┃✮│➣ RAM: ${server.ram}MB | Disk: ${server.disk}MB\n`;
            serversText += `┃✮│➣ Time Left: ${hoursLeft} hours\n`;
            serversText += `┃✮│➣ Status: ${server.status || 'Active'}\n`;
            serversText += `╰━━━━━━━━━━━━━┈⊷`;
        }
    }
    
    await bot.sendMessage(chatId, serversText);
});

// Referral command
bot.onText(/\/referral/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const user = getUser(userId);
    
    await sendImage(chatId, 'referral_guide.jpg', createMenu('REFERRAL PROGRAM', [
        'Earn by inviting',
        'friends to join',
        '',
        '100 points per referral'
    ]));
    
    const referralCode = `DARK${userId.slice(-6)}`;
    
    const referralMenu = createMenu('YOUR REFERRALS', [
        `Link: t.me/${(await bot.getMe()).username}?start=${referralCode}`,
        '',
        `Total: ${user.referrals.length} referrals`,
        `Earned: ${user.referrals.length * global.config.POINTS.REFERRAL_POINTS} points`,
        '',
        'Share your link and',
        'start earning today'
    ]);

    await bot.sendMessage(chatId, referralMenu);
});

// Handle all messages
bot.on('message', async (msg) => {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    
    if (database.broadcastMode && database.broadcastMode[userId]) {
        await adminHandler.handleAdminCommand(bot, msg, database);
        return;
    }
    
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
    const user = getUser(userId);
    
    try {
        if (data.startsWith('verify_')) {
            await verificationHandler.handleVerificationCallback(bot, callbackQuery, database);
        }
        
        if (data.startsWith('admin_')) {
            const adminCheck = isUserAdmin(userId);
            if (!adminCheck.isAdmin) {
                return await bot.answerCallbackQuery(callbackQuery.id, { text: 'Access Denied' });
            }
            await adminHandler.handleAdminCallback(bot, callbackQuery, database);
        }
        
        if (data.startsWith('create_')) {
            await handleCreateCallback(bot, callbackQuery, database);
        }
        
        if (data === 'back_to_menu') {
            await showMainMenu(chatId, user);
        }
        
        if (data === 'daily_math') {
            await handleDailyMath(bot, msg, database);
        }
        
        if (data === 'refer_friends') {
            await bot.sendMessage(chatId, createMenu('REFERRAL', [
                'Use /referral command',
                'to access full program',
                '',
                'Earn 100 points each'
            ]));
        }
        
        if (data === 'verify_channels') {
            await verificationHandler.handleVerification(bot, msg, database);
        }
        
        await bot.answerCallbackQuery(callbackQuery.id);
        
    } catch (error) {
        logger.error('Callback query error', error);
        await bot.answerCallbackQuery(callbackQuery.id, { text: 'Error occurred' });
    }
});

// Show server tiers
async function showServerTiers(bot, chatId, user) {
    const tiersMenu = createMenu('SERVER TIERS', [
        'FREE TIER (Points)',
        `RAM: 1GB | Disk: 5GB`,
        `Duration: 24 hours`,
        `Cost: ${global.config.POINTS.FREE_SERVER_COST} points`,
        `Your points: ${user.points}`,
        '',
        'BASIC - ₦1,000',
        `RAM: 2GB | Disk: 10GB`,
        `Duration: 7 days`,
        `Your balance: ₦${user.balance}`,
        '',
        'PRO - ₦2,500',
        `RAM: 4GB | Disk: 20GB`,
        `Duration: 30 days`,
        `Your balance: ₦${user.balance}`,
        '',
        'PREMIUM - ₦5,000',
        `RAM: 8GB | Disk: 40GB`,
        `Duration: 30 days`,
        `Your balance: ₦${user.balance}`
    ]);

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🆓 Free Tier', callback_data: 'create_free' }],
                [{ text: '🟢 Basic ₦1,000', callback_data: 'create_basic' }],
                [{ text: '🟡 Pro ₦2,500', callback_data: 'create_pro' }],
                [{ text: '🔴 Premium ₦5,000', callback_data: 'create_premium' }],
                [{ text: '💰 Fund Balance', callback_data: 'fund_balance' }],
                [{ text: '⭐ Earn Points', callback_data: 'earn_points' }]
            ]
        }
    };

    await bot.sendMessage(chatId, tiersMenu, buttons);
}

// Handle create server callbacks
async function handleCreateCallback(bot, callbackQuery, database) {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString();
    const user = getUser(userId);
    const data = callbackQuery.data;
    
    if (!user.verified) {
        return await bot.sendMessage(chatId, global.messages.NOT_VERIFIED);
    }
    
    if (data === 'create_free') {
        if (user.points < global.config.POINTS.FREE_SERVER_COST) {
            const insufficientMenu = createMenu('INSUFFICIENT POINTS', [
                `Required: ${global.config.POINTS.FREE_SERVER_COST} points`,
                `Your points: ${user.points}`,
                '',
                'Use /tasks to earn more'
            ]);
            return await bot.sendMessage(chatId, insufficientMenu);
        }
        
        user.points -= global.config.POINTS.FREE_SERVER_COST;
        await createServerForUser(bot, chatId, user, global.config.SERVER_TIERS.FREE, database);
    }
    else if (data === 'create_basic') {
        if (user.balance < 1000) {
            const insufficientMenu = createMenu('INSUFFICIENT BALANCE', [
                'Required: ₦1,000',
                `Your balance: ₦${user.balance}`,
                '',
                'Use /balance to fund'
            ]);
            return await bot.sendMessage(chatId, insufficientMenu);
        }
        
        user.balance -= 1000;
        await createServerForUser(bot, chatId, user, global.config.SERVER_TIERS.BASIC, database);
    }
    else if (data === 'create_pro') {
        if (user.balance < 2500) {
            const insufficientMenu = createMenu('INSUFFICIENT BALANCE', [
                'Required: ₦2,500',
                `Your balance: ₦${user.balance}`,
                '',
                'Use /balance to fund'
            ]);
            return await bot.sendMessage(chatId, insufficientMenu);
        }
        
        user.balance -= 2500;
        await createServerForUser(bot, chatId, user, global.config.SERVER_TIERS.PRO, database);
    }
    else if (data === 'create_premium') {
        if (user.balance < 5000) {
            const insufficientMenu = createMenu('INSUFFICIENT BALANCE', [
                'Required: ₦5,000',
                `Your balance: ₦${user.balance}`,
                '',
                'Use /balance to fund'
            ]);
            return await bot.sendMessage(chatId, insufficientMenu);
        }
        
        user.balance -= 5000;
        await createServerForUser(bot, chatId, user, global.config.SERVER_TIERS.PREMIUM, database);
    }
    else if (data === 'fund_balance') {
        const fundMenu = createMenu('FUND ACCOUNT', [
            'OPAY: ' + global.config.PAYMENTS.OPAY,
            'FIRST BANK: ' + global.config.PAYMENTS.FIRSTBANK.accountNumber,
            'NAME: ' + global.config.PAYMENTS.FIRSTBANK.accountName,
            '',
            'Send payment proof to',
            'support after transaction'
        ]);
        await bot.sendMessage(chatId, fundMenu);
    }
    else if (data === 'earn_points') {
        await bot.sendMessage(chatId, createMenu('EARN POINTS', [
            'Use /tasks command',
            'to see all available',
            'ways to earn points',
            '',
            'Daily challenges available'
        ]));
    }
    
    await saveDatabase();
}

// Create server for user
async function createServerForUser(bot, chatId, user, tier, database) {
    try {
        await bot.sendMessage(chatId, createMenu('CREATING SERVER', [
            'Please wait while we',
            'set up your server',
            '',
            'This may take a few minutes'
        ]));
        
        const serverData = await pterodactyl.createServer(user, tier);
        
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
        
        const successMenu = createMenu('SERVER CREATED', [
            `Name: ${serverData.attributes.name}`,
            `RAM: ${tier.ram}MB | Disk: ${tier.disk}MB`,
            `Duration: ${tier.duration} hours`,
            '',
            'Use /myservers to view',
            'your active servers'
        ]);
        
        await bot.sendMessage(chatId, successMenu);
        
    } catch (error) {
        const errorMenu = createMenu('CREATION FAILED', [
            'Server creation failed',
            'Please try again or',
            'contact support',
            '',
            'Refund processed automatically'
        ]);
        
        await bot.sendMessage(chatId, errorMenu);
        logger.error('Server creation failed', error);
        
        // Refund points/balance
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
    
    const lastMath = user.last_daily_math || 0;
    const today = new Date().toDateString();
    const lastMathDate = new Date(lastMath).toDateString();
    
    if (lastMathDate === today) {
        const alreadyDoneMenu = createMenu('DAILY MATH', [
            'Already completed today',
            '',
            'Come back tomorrow for',
            'new challenges'
        ]);
        return await bot.sendMessage(chatId, alreadyDoneMenu);
    }
    
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
    
    if (!database.mathChallenges) database.mathChallenges = {};
    database.mathChallenges[userId] = {
        answer: answer,
        problem: `${num1} ${operator} ${num2}`
    };
    
    const mathMenu = createMenu('DAILY MATH CHALLENGE', [
        `Solve: ${num1} ${operator} ${num2} = ?`,
        '',
        `Reward: ${global.config.POINTS.DAILY_MATH_POINTS} points`,
        '',
        'Reply with your answer'
    ]);
    
    await bot.sendMessage(chatId, mathMenu);
}

// Handle referral start
async function handleReferralStart(msg, referralCode) {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    if (referralCode.startsWith('DARK')) {
        const referrerId = referralCode.replace('DARK', '');
        const referrer = database.users[referrerId];
        
        if (referrer && referrer.id !== userId) {
            const newUser = getUser(userId);
            if (!newUser.referredBy) {
                newUser.referredBy = referrerId;
                referrer.referrals.push(userId);
                await saveDatabase();
                
                logger.info(`New referral: ${userId} referred by ${referrerId}`);
                
                try {
                    const notificationMenu = createMenu('NEW REFERRAL', [
                        `${newUser.first_name} joined`,
                        'using your referral link',
                        '',
                        `Earn ${global.config.POINTS.REFERRAL_POINTS} points`,
                        'when they verify'
                    ]);
                    
                    await bot.sendMessage(referrerId, notificationMenu);
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
    
    if (text.startsWith('/')) return;
    
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
            
            const successMenu = createMenu('CORRECT ANSWER', [
                `Earned: ${global.config.POINTS.DAILY_MATH_POINTS} points`,
                `Total: ${user.points} points`,
                '',
                `${problem} = ${correctAnswer}`,
                '',
                'Great job!'
            ]);
            
            await bot.sendMessage(chatId, successMenu);
        } else {
            const wrongMenu = createMenu('WRONG ANSWER', [
                `Correct: ${problem} = ${correctAnswer}`,
                '',
                'Try again tomorrow!'
            ]);
            
            await bot.sendMessage(chatId, wrongMenu);
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
                
                const user = database.users[server.ownerId];
                if (user) {
                    user.servers = user.servers.filter(s => s !== serverId);
                }
                
                deletedCount++;
                logger.info(`Deleted expired server: ${serverId}`);
            } catch (error) {
                logger.error(`Failed to delete server ${serverId}`, error);
            }
        }
    }
    
    if (deletedCount > 0) {
        await saveDatabase();
        console.log(chalk.yellow(`Cleaned up ${deletedCount} expired servers`));
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
                
                if (now - stats.mtimeMs > dayInMs) {
                    await fs.remove(filePath);
                    logger.info(`Cleaned temp file: ${file}`);
                }
            }
        }
    } catch (error) {
        logger.error('Temp cleanup error', error);
    }
}

// Initialize and start bot
async function startBot() {
    await initializeDatabase();
    cleanExpiredAdmins();
    
    await fs.ensureDir(path.join(__dirname, 'temp/screenshots'));
    await fs.ensureDir(path.join(__dirname, 'temp/uploads'));
    await fs.ensureDir(path.join(__dirname, 'temp/cache'));
    await fs.ensureDir(path.join(__dirname, 'database/backups'));
    await fs.ensureDir(path.join(__dirname, 'database/restore_backups'));
    await fs.ensureDir(path.join(__dirname, 'logs'));
    await fs.ensureDir(path.join(__dirname, 'assets/images'));
    
    console.log(chalk.blue('🤖 Dark Server Bot started successfully'));
    console.log(chalk.yellow('📱 Bot is listening for messages...'));
    console.log(chalk.blue('📊 Users: ' + Object.keys(database.users).length));
    console.log(chalk.blue('🖥️ Servers: ' + Object.keys(database.servers).length));
    
    logger.info('Bot started successfully');
    
    cron.schedule('0 * * * *', async () => {
        cleanupExpiredServers();
        cleanExpiredAdmins();
        await backup.createBackup();
        await backup.cleanupOldBackups();
    });
    
    cron.schedule('0 0 * * *', async () => {
        cleanTempFiles();
    });
    
    setInterval(() => {
        cleanupExpiredServers();
        cleanExpiredAdmins();
    }, 60 * 60 * 1000);
}

// Handle errors
bot.on('error', (error) => {
    logger.error('Bot error', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection', error);
});

// Start the bot
startBot();
