const fs = require('fs-extra');
const chalk = require('chalk');
const moment = require('moment');

module.exports = {
    // Handle admin commands
    handleAdminCommand: async (bot, msg, database) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const text = msg.text;
        
        if (text === '/admin') {
            return await showAdminPanel(bot, chatId, database);
        }
        
        if (text === '/admin broadcast') {
            return await startBroadcast(bot, chatId, userId, database);
        }
        
        if (text === '/admin stats') {
            return await showStats(bot, chatId, database);
        }
        
        if (text === '/admin users') {
            return await showUsers(bot, chatId, database);
        }
        
        if (text === '/admin servers') {
            return await showServers(bot, chatId, database);
        }
        
        if (text === '/admin deleteall') {
            return await confirmDeleteAll(bot, chatId, database);
        }
        
        if (text.startsWith('/admin gift')) {
            return await handleGiftCommand(bot, chatId, userId, text, database);
        }
        
        if (text === '/admin money') {
            return await giveAdminInfiniteMoney(bot, chatId, userId, database);
        }
        
        if (text === '/admin points') {
            return await giveAdminInfinitePoints(bot, chatId, userId, database);
        }
        
        if (text.startsWith('/grant')) {
            return await handleGrantCommand(bot, chatId, userId, text, database);
        }
        
        if (text === '/admin admins') {
            return await showAdminList(bot, chatId, database);
        }
        
        // Handle broadcast message input
        if (database.broadcastMode && database.broadcastMode[userId]) {
            return await processBroadcastMessage(bot, msg, database);
        }
    },
    
    // Handle callback queries for admin
    handleAdminCallback: async (bot, callbackQuery, database) => {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id.toString();
        
        if (data === 'admin_broadcast') {
            await startBroadcast(bot, chatId, userId, database);
        }
        
        if (data === 'admin_deleteall_confirm') {
            await deleteAllServers(bot, chatId, database);
        }
        
        if (data === 'admin_deleteall_cancel') {
            await bot.sendMessage(chatId, '✅ Mass deletion cancelled.');
        }
        
        if (data === 'admin_gift') {
            await bot.sendMessage(chatId,
                `💰 *Gift System*\n\n` +
                `Use these commands:\n\n` +
                `/admin gift <user_id> <amount> - Give money\n` +
                `/admin gift <user_id> <amount> points - Give points\n\n` +
                `Examples:\n` +
                `/admin gift 123456789 5000\n` +
                `/admin gift 123456789 100 points`,
                { parse_mode: 'Markdown' }
            );
        }
        
        if (data === 'admin_money') {
            await giveAdminInfiniteMoney(bot, chatId, userId, database);
        }
        
        if (data === 'admin_points') {
            await giveAdminInfinitePoints(bot, chatId, userId, database);
        }
        
        if (data === 'admin_grant') {
            await bot.sendMessage(chatId,
                `👑 *Grant Admin Access*\n\n` +
                `Usage: /grant <user_id> <hours>\n\n` +
                `Examples:\n` +
                `/grant 123456789 24 - Grant admin for 24 hours\n` +
                `/grant 123456789 168 - Grant admin for 7 days\n` +
                `/grant 123456789 0 - Revoke admin access\n\n` +
                `⚠️ Temporary admins cannot use /grant command`,
                { parse_mode: 'Markdown' }
            );
        }
        
        if (data === 'admin_admins') {
            await showAdminList(bot, chatId, database);
        }
    }
};

// Show admin panel
async function showAdminPanel(bot, chatId, database) {
    const totalUsers = Object.keys(database.users).length;
    const activeServers = Object.keys(database.servers).length;
    const totalRevenue = calculateTotalRevenue(database);
    const tempAdmins = database.tempAdmins ? Object.keys(database.tempAdmins).length : 0;
    
    const panelText = `👑 *Admin Panel*

📊 *Statistics:*
• Total Users: ${totalUsers}
• Active Servers: ${activeServers}
• Total Revenue: ₦${totalRevenue}
• Temporary Admins: ${tempAdmins}

🛠️ *Admin Commands:*
• /admin stats - Detailed statistics
• /admin users - Manage users
• /admin servers - View all servers
• /admin broadcast - Send message to all users
• /admin deleteall - Delete ALL servers
• /admin gift <user> <amount> - Gift money/points
• /admin money - Get infinite money
• /admin points - Get infinite points
• /grant <user> <hours> - Grant admin access
• /admin admins - List all admins`;

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '📢 Broadcast', callback_data: 'admin_broadcast' },
                    { text: '💰 Gift User', callback_data: 'admin_gift' }
                ],
                [
                    { text: '📊 Stats', callback_data: 'admin_stats' },
                    { text: '👥 Users', callback_data: 'admin_users' }
                ],
                [
                    { text: '♾️ Get Money', callback_data: 'admin_money' },
                    { text: '⭐ Get Points', callback_data: 'admin_points' }
                ],
                [
                    { text: '👑 Grant Admin', callback_data: 'admin_grant' },
                    { text: '📋 Admin List', callback_data: 'admin_admins' }
                ],
                [
                    { text: '🗑️ Delete All', callback_data: 'admin_deleteall' }
                ]
            ]
        }
    };

    await bot.sendMessage(chatId, panelText, { parse_mode: 'Markdown', ...buttons });
}

// Handle grant command
async function handleGrantCommand(bot, chatId, userId, text, database) {
    // Check if user is permanent admin (not temporary)
    const isPermanentAdmin = global.config.ADMIN_IDS.includes(userId);
    if (!isPermanentAdmin) {
        return await bot.sendMessage(chatId, '❌ Only permanent admins can use /grant command.');
    }
    
    const parts = text.split(' ');
    
    if (parts.length < 3) {
        return await bot.sendMessage(chatId,
            `❌ *Invalid Format*\n\n` +
            `Usage: /grant <user_id> <hours>\n\n` +
            `Examples:\n` +
            `/grant 123456789 24 - Grant admin for 24 hours\n` +
            `/grant 123456789 168 - Grant admin for 7 days\n` +
            `/grant 123456789 0 - Revoke admin access\n\n` +
            `⚠️ Temporary admins cannot use /grant command`,
            { parse_mode: 'Markdown' }
        );
    }
    
    const targetUserId = parts[1];
    const hours = parseInt(parts[2]);
    
    if (isNaN(hours) || hours < 0) {
        return await bot.sendMessage(chatId, '❌ Invalid hours. Please provide a positive number or 0 to revoke.');
    }
    
    const targetUser = database.users[targetUserId];
    if (!targetUser) {
        return await bot.sendMessage(chatId, `❌ User with ID ${targetUserId} not found.`);
    }
    
    // Initialize tempAdmins if not exists
    if (!database.tempAdmins) database.tempAdmins = {};
    
    if (hours === 0) {
        // Revoke admin access
        delete database.tempAdmins[targetUserId];
        await saveDatabase(database);
        
        await bot.sendMessage(chatId,
            `✅ *Admin Access Revoked*\n\n` +
            `👤 User: ${targetUser.first_name} (${targetUserId})\n` +
            `❌ Admin privileges removed.`,
            { parse_mode: 'Markdown' }
        );
        
        // Notify user
        try {
            await bot.sendMessage(targetUserId,
                `⚠️ *Admin Access Revoked*\n\n` +
                `Your temporary admin privileges have been removed.`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
    } else {
        // Grant admin access
        const expiryTime = Date.now() + (hours * 60 * 60 * 1000);
        database.tempAdmins[targetUserId] = {
            grantedBy: userId,
            grantedAt: Date.now(),
            expiresAt: expiryTime,
            hours: hours
        };
        
        await saveDatabase(database);
        
        await bot.sendMessage(chatId,
            `✅ *Admin Access Granted*\n\n` +
            `👤 User: ${targetUser.first_name} (${targetUserId})\n` +
            `⏰ Duration: ${hours} hours\n` +
            `📅 Expires: ${new Date(expiryTime).toLocaleString()}\n\n` +
            `⚠️ Temporary admins cannot use /grant command`,
            { parse_mode: 'Markdown' }
        );
        
        // Notify user
        try {
            await bot.sendMessage(targetUserId,
                `🎉 *Admin Access Granted!*\n\n` +
                `You have been granted temporary admin privileges!\n\n` +
                `⏰ Duration: ${hours} hours\n` +
                `📅 Expires: ${new Date(expiryTime).toLocaleString()}\n\n` +
                `Available commands:\n` +
                `/admin - Admin panel\n` +
                `/admin broadcast - Send messages to all users\n` +
                `/admin stats - View statistics\n` +
                `/admin money - Get infinite money\n` +
                `/admin points - Get infinite points\n` +
                `/admin gift - Gift users money/points\n\n` +
                `⚠️ You cannot use /grant command`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
    }
}

// Show admin list
async function showAdminList(bot, chatId, database) {
    let adminText = `👑 *Admin List*\n\n`;
    
    // Permanent admins
    adminText += `*Permanent Admins:*\n`;
    global.config.ADMIN_IDS.forEach(adminId => {
        const admin = database.users[adminId];
        if (admin) {
            adminText += `• ${admin.first_name} (${adminId}) - ♾️ Permanent\n`;
        }
    });
    
    // Temporary admins
    adminText += `\n*Temporary Admins:*\n`;
    if (database.tempAdmins && Object.keys(database.tempAdmins).length > 0) {
        for (const [tempAdminId, adminData] of Object.entries(database.tempAdmins)) {
            const tempAdmin = database.users[tempAdminId];
            const timeLeft = adminData.expiresAt - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (60 * 60 * 1000)));
            
            if (tempAdmin) {
                const grantedBy = database.users[adminData.grantedBy];
                const grantedByName = grantedBy ? grantedBy.first_name : 'Unknown';
                
                adminText += `• ${tempAdmin.first_name} (${tempAdminId})\n`;
                adminText += `  ⏰ ${hoursLeft}h left | By: ${grantedByName}\n`;
            }
        }
    } else {
        adminText += `• No temporary admins\n`;
    }
    
    await bot.sendMessage(chatId, adminText, { parse_mode: 'Markdown' });
}

// Check if user is admin (permanent or temporary)
function isUserAdmin(userId, database) {
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
            return { isAdmin: false, isPermanent: false };
        }
        
        return { isAdmin: true, isPermanent: false, data: adminData };
    }
    
    return { isAdmin: false, isPermanent: false };
}

// Clean expired temporary admins
function cleanExpiredAdmins(database) {
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
        console.log(chalk.yellow(`🧹 Cleaned ${cleaned} expired temporary admins`));
    }
}

// Handle gift command
async function handleGiftCommand(bot, chatId, userId, text, database) {
    const parts = text.split(' ');
    
    if (parts.length < 4) {
        return await bot.sendMessage(chatId,
            `❌ *Invalid Format*\n\n` +
            `Usage: /admin gift <user_id> <amount>\n\n` +
            `Examples:\n` +
            `/admin gift 123456789 5000 - Give ₦5000\n` +
            `/admin gift 123456789 100 - Give 100 points\n` +
            `/admin gift 123456789 5000 money - Give ₦5000\n` +
            `/admin gift 123456789 100 points - Give 100 points`,
            { parse_mode: 'Markdown' }
        );
    }
    
    const targetUserId = parts[2];
    const amount = parseInt(parts[3]);
    const type = parts[4] || 'money'; // Default to money
    
    if (isNaN(amount) || amount <= 0) {
        return await bot.sendMessage(chatId, '❌ Invalid amount. Please provide a positive number.');
    }
    
    const targetUser = database.users[targetUserId];
    if (!targetUser) {
        return await bot.sendMessage(chatId, `❌ User with ID ${targetUserId} not found.`);
    }
    
    if (type === 'money' || !parts[4]) {
        targetUser.balance += amount;
        await saveDatabase(database);
        
        // Notify target user
        try {
            await bot.sendMessage(targetUserId,
                `🎁 *You Received a Gift!*\n\n` +
                `💰 Amount: ₦${amount}\n` +
                `📊 New Balance: ₦${targetUser.balance}\n\n` +
                `From: Dark Server Admin`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
        
        await bot.sendMessage(chatId,
            `✅ *Gift Sent Successfully!*\n\n` +
            `👤 To: ${targetUser.first_name} (${targetUserId})\n` +
            `💰 Amount: ₦${amount}\n` +
            `📊 Their New Balance: ₦${targetUser.balance}`,
            { parse_mode: 'Markdown' }
        );
    }
    else if (type === 'points') {
        targetUser.points += amount;
        await saveDatabase(database);
        
        // Notify target user
        try {
            await bot.sendMessage(targetUserId,
                `🎁 *You Received a Gift!*\n\n` +
                `⭐ Points: ${amount}\n` +
                `📊 New Points: ${targetUser.points}\n\n` +
                `From: Dark Server Admin`,
                { parse_mode: 'Markdown' }
            );
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
        
        await bot.sendMessage(chatId,
            `✅ *Gift Sent Successfully!*\n\n` +
            `👤 To: ${targetUser.first_name} (${targetUserId})\n` +
            `⭐ Points: ${amount}\n` +
            `📊 Their New Points: ${targetUser.points}`,
            { parse_mode: 'Markdown' }
        );
    }
}

// Give admin infinite money
async function giveAdminInfiniteMoney(bot, chatId, userId, database) {
    const user = database.users[userId];
    user.balance = 9999999; // 10 million
    
    await saveDatabase(database);
    
    await bot.sendMessage(chatId,
        `💰 *Infinite Money Activated!*\n\n` +
        `Your balance is now: ₦9,999,999\n` +
        `You can now create unlimited paid servers!`,
        { parse_mode: 'Markdown' }
    );
}

// Give admin infinite points
async function giveAdminInfinitePoints(bot, chatId, userId, database) {
    const user = database.users[userId];
    user.points = 999999; // 1 million points
    
    await saveDatabase(database);
    
    await bot.sendMessage(chatId,
        `⭐ *Infinite Points Activated!*\n\n` +
        `Your points are now: 999,999\n` +
        `You can now create unlimited free servers!`,
        { parse_mode: 'Markdown' }
    );
}

// Save database function
async function saveDatabase(database) {
    try {
        await fs.writeJson('./database/users.json', database, { spaces: 2 });
    } catch (error) {
        console.log('Save database error:', error);
    }
}

// [Keep all the existing functions from previous admin.js...]
// startBroadcast, processBroadcastMessage, showStats, showUsers, 
// showServers, confirmDeleteAll, deleteAllServers, calculateTotalRevenue

// Broadcast functions
async function startBroadcast(bot, chatId, userId, database) {
    if (!database.broadcastMode) database.broadcastMode = {};
    database.broadcastMode[userId] = true;
    await saveDatabase(database);
    
    const broadcastInstructions = `📢 *Broadcast Message Setup*

You are about to send a message to *all ${Object.keys(database.users).length} users*.

Please send your broadcast message now. You can include:
• Text messages
• Images with captions
• Markdown formatting

*Supported formatting:*
**Bold**, *Italic*, [Links](https://example.com)

To cancel, send /cancel`;

    await bot.sendMessage(chatId, broadcastInstructions, { parse_mode: 'Markdown' });
}

async function processBroadcastMessage(bot, msg, database) {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    
    if (!database.broadcastMode || !database.broadcastMode[userId]) {
        return;
    }
    
    if (msg.text === '/cancel') {
        delete database.broadcastMode[userId];
        await saveDatabase(database);
        return await bot.sendMessage(chatId, '✅ Broadcast cancelled.');
    }
    
    const totalUsers = Object.keys(database.users).length;
    let sentCount = 0;
    let failedCount = 0;
    
    await bot.sendMessage(chatId, `🔄 Starting broadcast to ${totalUsers} users...`);
    
    for (const userID of Object.keys(database.users)) {
        try {
            if (msg.photo) {
                const photoId = msg.photo[msg.photo.length - 1].file_id;
                const caption = msg.caption || '';
                await bot.sendPhoto(userID, photoId, { 
                    caption: caption,
                    parse_mode: 'Markdown'
                });
            } else if (msg.text) {
                await bot.sendMessage(userID, msg.text, { parse_mode: 'Markdown' });
            } else {
                continue;
            }
            sentCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log(chalk.red(`❌ Failed to send to user ${userID}:`), error.message);
            failedCount++;
        }
    }
    
    delete database.broadcastMode[userId];
    await saveDatabase(database);
    
    const summary = `📢 *Broadcast Complete*

✅ Successfully sent: ${sentCount} users
❌ Failed to send: ${failedCount} users
📊 Total users: ${totalUsers}

${failedCount > 0 ? '\nFailed sends are usually due to users who blocked the bot or never started it.' : ''}`;

    await bot.sendMessage(chatId, summary, { parse_mode: 'Markdown' });
}

// Stats function
async function showStats(bot, chatId, database) {
    const totalUsers = Object.keys(database.users).length;
    const verifiedUsers = Object.values(database.users).filter(user => user.verified).length;
    const activeServers = Object.keys(database.servers).length;
    const totalRevenue = calculateTotalRevenue(database);
    
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newUsers = Object.values(database.users).filter(user => user.joined_date > weekAgo).length;
    
    const statsText = `📊 *Detailed Statistics*

👥 *Users:*
• Total Users: ${totalUsers}
• Verified Users: ${verifiedUsers}
• New Users (7 days): ${newUsers}
• Verification Rate: ${Math.round((verifiedUsers / totalUsers) * 100)}%

🖥️ *Servers:*
• Active Servers: ${activeServers}
• Server/User Ratio: ${(activeServers / totalUsers).toFixed(2)}

💰 *Revenue:*
• Total Revenue: ₦${totalRevenue}
• Average per User: ₦${(totalRevenue / totalUsers).toFixed(2)}

📈 *Growth:*
• User Growth: ${newUsers} this week
• Active Rate: ${Math.round((activeServers / verifiedUsers) * 100)}% of verified users`;

    await bot.sendMessage(chatId, statsText, { parse_mode: 'Markdown' });
}

// Calculate total revenue
function calculateTotalRevenue(database) {
    let total = 0;
    if (database.payments) {
        Object.values(database.payments).forEach(payment => {
            if (payment.status === 'completed') {
                total += payment.amount || 0;
            }
        });
    }
    return total;
}

// [Other existing functions...]
async function showUsers(bot, chatId, database) {
    const users = Object.values(database.users);
    const verifiedUsers = users.filter(user => user.verified);
    const premiumUsers = users.filter(user => user.tier !== 'free');
    
    const usersText = `👥 *Users Management*

📊 Summary:
• Total Users: ${users.length}
• Verified: ${verifiedUsers.length}
• Premium: ${premiumUsers.length}

👤 Recent Users (Last 10):`;
    
    let userList = '';
    const recentUsers = users
        .sort((a, b) => b.joined_date - a.joined_date)
        .slice(0, 10);
    
    recentUsers.forEach(user => {
        const date = new Date(user.joined_date).toLocaleDateString();
        userList += `\n• ${user.first_name} (${user.points} pts) - ${date} ${user.verified ? '✅' : '❌'}`;
    });
    
    await bot.sendMessage(chatId, usersText + userList, { parse_mode: 'Markdown' });
}

async function showServers(bot, chatId, database) {
    const servers = Object.values(database.servers);
    
    if (servers.length === 0) {
        return await bot.sendMessage(chatId, '❌ No active servers found.');
    }
    
    const serversText = `🖥️ *All Active Servers*

Total Servers: ${servers.length}

Server List:`;
    
    let serverList = '';
    servers.forEach(server => {
        const owner = database.users[server.ownerId];
        const expires = new Date(server.expires).toLocaleDateString();
        serverList += `\n• ${server.name} (${server.ram}MB) - ${owner.first_name} - Expires: ${expires}`;
    });
    
    await bot.sendMessage(chatId, serversText + serverList, { parse_mode: 'Markdown' });
}

async function confirmDeleteAll(bot, chatId, database) {
    const totalServers = Object.keys(database.servers).length;
    
    const confirmText = `⚠️ *DANGEROUS ACTION - CONFIRM DELETION*

You are about to delete *ALL ${totalServers} servers*!
This action is *IRREVERSIBLE* and will affect all users.

Are you absolutely sure you want to continue?`;

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '❌ CANCEL', callback_data: 'admin_deleteall_cancel' }],
                [{ text: '✅ YES, DELETE ALL SERVERS', callback_data: 'admin_deleteall_confirm' }]
            ]
        }
    };

    await bot.sendMessage(chatId, confirmText, { parse_mode: 'Markdown', ...buttons });
}

async function deleteAllServers(bot, chatId, database) {
    const totalServers = Object.keys(database.servers).length;
    let deletedCount = 0;
    
    await bot.sendMessage(chatId, `🔄 Deleting ${totalServers} servers...`);
    
    for (const serverId in database.servers) {
        try {
            // Add your server deletion API call here
            // await pterodactyl.deleteServer(serverId);
            delete database.servers[serverId];
            deletedCount++;
        } catch (error) {
            console.log(chalk.red(`❌ Failed to delete server ${serverId}:`), error);
        }
    }
    
    await saveDatabase(database);
    
    const resultText = `🗑️ *Mass Deletion Complete*

✅ Successfully deleted: ${deletedCount} servers
📊 Total processed: ${totalServers}

All servers have been removed from the database.`;
    
    await bot.sendMessage(chatId, resultText, { parse_mode: 'Markdown' });
}