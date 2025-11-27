const fs = require('fs-extra');
const chalk = require('chalk');

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
    handleVerification: async (bot, msg, database) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const user = database.users[userId];
        
        await showVerificationStatus(bot, chatId, user);
    },
    
    handleVerificationCallback: async (bot, callbackQuery, database) => {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id.toString();
        const user = database.users[userId];
        
        if (data === 'verify_check') {
            await checkTelegramChannels(bot, chatId, user, database);
        }
        
        if (data === 'verify_whatsapp') {
            await requestWhatsAppScreenshot(bot, chatId);
        }
        
        if (data === 'verify_submit_screenshot') {
            await requestScreenshotUpload(bot, chatId);
        }
        
        await bot.answerCallbackQuery(callbackQuery.id);
    },
    
    handleScreenshotUpload: async (bot, msg, database) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const user = database.users[userId];
        
        if (msg.photo) {
            await processScreenshot(bot, chatId, user, database, msg.photo);
        } else {
            await bot.sendMessage(chatId, createMenu('ERROR', [
                'Please send screenshot',
                'as image, not text'
            ]));
        }
    }
};

async function showVerificationStatus(bot, chatId, user) {
    const statusItems = [
        'TELEGRAM CHANNELS',
        `Main: ${global.config.CHANNELS.TELEGRAM_MAIN} ${user.channels.telegramMain ? '✓' : '✗'}`,
        `Backup: ${global.config.CHANNELS.TELEGRAM_BACKUP} ${user.channels.telegramBackup ? '✓' : '✗'}`,
        '',
        'WHATSAPP CHANNEL',
        `${global.config.CHANNELS.WHATSAPP_LINK} ${user.channels.whatsapp ? '✓' : '✗'}`,
        '',
        'POINTS REWARD',
        'Telegram: 200 points',
        'WhatsApp: 150 points',
        'Bonus: 50 points',
        '',
        `STATUS: ${user.verified ? 'VERIFIED' : 'NOT VERIFIED'}`
    ];

    const statusText = createMenu('VERIFICATION STATUS', statusItems);

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔍 Check Telegram', callback_data: 'verify_check' }],
                [{ text: '📱 Verify WhatsApp', callback_data: 'verify_whatsapp' }],
                [{ text: '📸 Submit Screenshot', callback_data: 'verify_submit_screenshot' }]
            ]
        }
    };

    await bot.sendMessage(chatId, statusText, buttons);
}

async function checkTelegramChannels(bot, chatId, user, database) {
    try {
        // Simulate checking (replace with actual channel checks)
        user.channels.telegramMain = true;
        user.channels.telegramBackup = true;
        
        let pointsAwarded = 0;
        if (user.channels.telegramMain && !user.telegramMainAwarded) {
            user.points += global.config.POINTS.CHANNEL_JOIN_POINTS;
            pointsAwarded += global.config.POINTS.CHANNEL_JOIN_POINTS;
            user.telegramMainAwarded = true;
        }
        
        if (user.channels.telegramBackup && !user.telegramBackupAwarded) {
            user.points += global.config.POINTS.CHANNEL_JOIN_POINTS;
            pointsAwarded += global.config.POINTS.CHANNEL_JOIN_POINTS;
            user.telegramBackupAwarded = true;
        }
        
        await fs.writeJson('./database/users.json', database, { spaces: 2 });
        
        let message = createMenu('TELEGRAM CHECKED', [
            'Channels verified!'
        ]);
        
        if (pointsAwarded > 0) {
            message += `\n\nEarned: ${pointsAwarded} points\nTotal: ${user.points} points`;
        }
        
        await bot.sendMessage(chatId, message);
        
        await checkFullVerification(bot, chatId, user, database);
        
    } catch (error) {
        await bot.sendMessage(chatId, createMenu('ERROR', [
            'Failed to check channels',
            'Please try again'
        ]));
        console.log(chalk.red('Verification error:'), error);
    }
}

async function requestWhatsAppScreenshot(bot, chatId) {
    const message = createMenu('WHATSAPP VERIFICATION', [
        'Steps to verify:',
        '',
        '1. Join WhatsApp channel',
        global.config.CHANNELS.WHATSAPP_LINK,
        '',
        '2. Take screenshot showing',
        'you are "Following"',
        '',
        '3. Send screenshot here',
        '',
        'Reward: 150 points'
    ]);

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📸 Upload Screenshot', callback_data: 'verify_submit_screenshot' }]
            ]
        }
    };

    await bot.sendMessage(chatId, message, buttons);
}

async function requestScreenshotUpload(bot, chatId) {
    await bot.sendMessage(chatId, createMenu('UPLOAD SCREENSHOT', [
        'Please send your',
        'WhatsApp channel screenshot',
        '',
        'Make sure it shows you',
        'are "Following" the channel'
    ]));
}

async function processScreenshot(bot, chatId, user, database, photo) {
    try {
        if (!user.channels.whatsapp) {
            user.channels.whatsapp = true;
            user.points += global.config.POINTS.WHATSAPP_VERIFY_POINTS;
            user.whatsappAwarded = true;
            
            await fs.writeJson('./database/users.json', database, { spaces: 2 });
            
            await bot.sendMessage(chatId, createMenu('WHATSAPP VERIFIED', [
                'Screenshot received!',
                '',
                `Earned: ${global.config.POINTS.WHATSAPP_VERIFY_POINTS} points`,
                `Total: ${user.points} points`
            ]));
            
            await checkFullVerification(bot, chatId, user, database);
        } else {
            await bot.sendMessage(chatId, createMenu('ALREADY VERIFIED', [
                'WhatsApp channel',
                'already verified'
            ]));
        }
        
    } catch (error) {
        await bot.sendMessage(chatId, createMenu('ERROR', [
            'Failed to process',
            'screenshot',
            '',
            'Please try again'
        ]));
        console.log(chalk.red('Screenshot error:'), error);
    }
}

async function checkFullVerification(bot, chatId, user, database) {
    const allChannelsVerified = user.channels.telegramMain && 
                               user.channels.telegramBackup && 
                               user.channels.whatsapp;
    
    if (allChannelsVerified && !user.verified) {
        user.verified = true;
        
        if (!user.completionBonusAwarded) {
            user.points += 50;
            user.completionBonusAwarded = true;
        }
        
        await fs.writeJson('./database/users.json', database, { spaces: 2 });
        
        await bot.sendMessage(chatId, createMenu('VERIFICATION COMPLETE', [
            'All channels verified!',
            '',
            'Bonus: 50 points awarded',
            `Total points: ${user.points}`,
            '',
            'Full access granted',
            'Create servers with /create'
        ]));
    }
}
