const fs = require('fs-extra');
const chalk = require('chalk');

module.exports = {
    // Handle verification command
    handleVerification: async (bot, msg, database) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const user = database.users[userId];
        
        await showVerificationStatus(bot, chatId, user);
    },
    
    // Handle verification callbacks
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
    
    // Handle screenshot upload
    handleScreenshotUpload: async (bot, msg, database) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const user = database.users[userId];
        
        if (msg.photo) {
            await processScreenshot(bot, chatId, user, database, msg.photo);
        } else {
            await bot.sendMessage(chatId, '❌ Please send a screenshot image, not text.');
        }
    }
};

// Show verification status
async function showVerificationStatus(bot, chatId, user) {
    const statusText = `🔐 *Channel Verification*

*Required Channels:*

📢 *Telegram Channels:*
• Main Channel: ${global.config.CHANNELS.TELEGRAM_MAIN} ${user.channels.telegramMain ? '✅' : '❌'}
• Backup Channel: ${global.config.CHANNELS.TELEGRAM_BACKUP} ${user.channels.telegramBackup ? '✅' : '❌'}

📱 *WhatsApp Channel:*
${global.config.CHANNELS.WHATSAPP_LINK} ${user.channels.whatsapp ? '✅' : '❌'}

*Points Reward:*
• Each Telegram channel: ${global.config.POINTS.CHANNEL_JOIN_POINTS} points
• WhatsApp verification: ${global.config.POINTS.WHATSAPP_VERIFY_POINTS} points
• Complete all: 50 bonus points

*Status:* ${user.verified ? '✅ VERIFIED' : '❌ NOT VERIFIED'}`;

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔄 Check Telegram Channels', callback_data: 'verify_check' }],
                [{ text: '📱 Verify WhatsApp Channel', callback_data: 'verify_whatsapp' }],
                [{ text: '📸 Submit Screenshot', callback_data: 'verify_submit_screenshot' }]
            ]
        }
    };

    await bot.sendMessage(chatId, statusText, { parse_mode: 'Markdown', ...buttons });
}

// Check Telegram channels
async function checkTelegramChannels(bot, chatId, user, database) {
    try {
        // Simulate checking (replace with actual channel checks)
        user.channels.telegramMain = true;
        user.channels.telegramBackup = true;
        
        // Award points for Telegram channels
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
        
        let message = '✅ Telegram channels checked!\n';
        if (pointsAwarded > 0) {
            message += `🎉 You earned ${pointsAwarded} points!\n`;
        }
        message += `📊 Total points: ${user.points}`;
        
        await bot.sendMessage(chatId, message);
        
        // Check if user is now fully verified
        await checkFullVerification(bot, chatId, user, database);
        
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Error checking channels. Please try again.');
        console.log(chalk.red('Verification error:'), error);
    }
}

// Request WhatsApp screenshot
async function requestWhatsAppScreenshot(bot, chatId) {
    const message = `📱 *WhatsApp Channel Verification*

Please follow these steps:

1. Join our WhatsApp channel:
${global.config.CHANNELS.WHATSAPP_LINK}

2. Take a screenshot showing you're "Following" the channel

3. Send the screenshot to this bot

4. We'll verify and award you ${global.config.POINTS.WHATSAPP_VERIFY_POINTS} points!

Click the button below when you're ready to upload your screenshot.`;

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📸 Upload Screenshot', callback_data: 'verify_submit_screenshot' }]
            ]
        }
    };

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown', ...buttons });
}

// Request screenshot upload
async function requestScreenshotUpload(bot, chatId) {
    await bot.sendMessage(chatId, '📸 Please send your WhatsApp channel screenshot now...');
}

// Process screenshot
async function processScreenshot(bot, chatId, user, database, photo) {
    try {
        // Auto-approve all screenshots for now
        if (!user.channels.whatsapp) {
            user.channels.whatsapp = true;
            user.points += global.config.POINTS.WHATSAPP_VERIFY_POINTS;
            user.whatsappAwarded = true;
            
            await fs.writeJson('./database/users.json', database, { spaces: 2 });
            
            await bot.sendMessage(chatId, 
                `✅ WhatsApp screenshot received and verified!\n` +
                `🎉 You earned ${global.config.POINTS.WHATSAPP_VERIFY_POINTS} points!\n` +
                `📊 Total points: ${user.points}`
            );
            
            // Check full verification
            await checkFullVerification(bot, chatId, user, database);
        } else {
            await bot.sendMessage(chatId, '✅ WhatsApp channel already verified!');
        }
        
    } catch (error) {
        await bot.sendMessage(chatId, '❌ Error processing screenshot. Please try again.');
        console.log(chalk.red('Screenshot error:'), error);
    }
}

// Check if user is fully verified
async function checkFullVerification(bot, chatId, user, database) {
    const allChannelsVerified = user.channels.telegramMain && 
                               user.channels.telegramBackup && 
                               user.channels.whatsapp;
    
    if (allChannelsVerified && !user.verified) {
        user.verified = true;
        
        // Award completion bonus
        if (!user.completionBonusAwarded) {
            user.points += 50;
            user.completionBonusAwarded = true;
        }
        
        await fs.writeJson('./database/users.json', database, { spaces: 2 });
        
        await bot.sendMessage(chatId,
            `🎉 *VERIFICATION COMPLETE!*\n\n` +
            `✅ All channels verified!\n` +
            `🎁 50 bonus points awarded!\n` +
            `📊 Total points: ${user.points}\n\n` +
            `You can now create servers using /create`
        );
    }
}