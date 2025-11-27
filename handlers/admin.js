const fs = require('fs-extra');
const chalk = require('chalk');
const moment = require('moment');

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
        
        if (database.broadcastMode && database.broadcastMode[userId]) {
            return await processBroadcastMessage(bot, msg, database);
        }
    },
    
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
            await bot.sendMessage(chatId, createMenu('CANCELLED', ['Mass deletion cancelled']));
        }
        
        if (data === 'admin_gift') {
            await bot.sendMessage(chatId, createMenu('GIFT SYSTEM', [
                'Usage:',
                '/admin gift <user_id> <amount>',
                '',
                'Examples:',
                '/admin gift 123456789 5000',
                '/admin gift 123456789 100 points'
            ]));
        }
        
        if (data === 'admin_money') {
            await giveAdminInfiniteMoney(bot, chatId, userId, database);
        }
        
        if (data === 'admin_points') {
            await giveAdminInfinitePoints(bot, chatId, userId, database);
        }
        
        if (data === 'admin_grant') {
            await bot.sendMessage(chatId, createMenu('GRANT ADMIN', [
                'Usage: /grant <user> <hours>',
                '',
                'Examples:',
                '/grant 123456789 24',
                '/grant 123456789 168',
                '/grant 123456789 0 (revoke)'
            ]));
        }
        
        if (data === 'admin_admins') {
            await showAdminList(bot, chatId, database);
        }
    }
};

async function showAdminPanel(bot, chatId, database) {
    const totalUsers = Object.keys(database.users).length;
    const activeServers = Object.keys(database.servers).length;
    const totalRevenue = calculateTotalRevenue(database);
    const tempAdmins = database.tempAdmins ? Object.keys(database.tempAdmins).length : 0;
    
    const panelMenu = createMenu('ADMIN PANEL', [
        `Users: ${totalUsers}`,
        `Servers: ${activeServers}`,
        `Revenue: ₦${totalRevenue}`,
        `Temp Admins: ${tempAdmins}`,
        '',
        'Commands:',
        '/admin stats - Statistics',
        '/admin users - User management',
        '/admin servers - Server list',
        '/admin broadcast - Send message',
        '/admin deleteall - Delete all',
        '/admin gift - Gift system',
        '/grant - Grant admin access'
    ]);

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
                [{ text: '💰 Gift User', callback_data: 'admin_gift' }],
                [{ text: '📊 Stats', callback_data: 'admin_stats' }],
                [{ text: '👥 Users', callback_data: 'admin_users' }],
                [{ text: '♾️ Money', callback_data: 'admin_money' }],
                [{ text: '⭐ Points', callback_data: 'admin_points' }],
                [{ text: '👑 Grant Admin', callback_data: 'admin_grant' }],
                [{ text: '📋 Admin List', callback_data: 'admin_admins' }],
                [{ text: '🗑️ Delete All', callback_data: 'admin_deleteall' }]
            ]
        }
    };

    await bot.sendMessage(chatId, panelMenu, buttons);
}

async function handleGrantCommand(bot, chatId, userId, text, database) {
    const isPermanentAdmin = global.config.ADMIN_IDS.includes(userId);
    if (!isPermanentAdmin) {
        return await bot.sendMessage(chatId, createMenu('PERMISSION DENIED', [
            'Only permanent admins',
            'can use /grant command'
        ]));
    }
    
    const parts = text.split(' ');
    
    if (parts.length < 3) {
        return await bot.sendMessage(chatId, createMenu('INVALID FORMAT', [
            'Usage: /grant <user> <hours>',
            '',
            'Examples:',
            '/grant 123456789 24',
            '/grant 123456789 168',
            '/grant 123456789 0 (revoke)'
        ]));
    }
    
    const targetUserId = parts[1];
    const hours = parseInt(parts[2]);
    
    if (isNaN(hours) || hours < 0) {
        return await bot.sendMessage(chatId, createMenu('INVALID HOURS', [
            'Provide positive number',
            'or 0 to revoke'
        ]));
    }
    
    const targetUser = database.users[targetUserId];
    if (!targetUser) {
        return await bot.sendMessage(chatId, createMenu('USER NOT FOUND', [
            `ID: ${targetUserId}`,
            'not found in database'
        ]));
    }
    
    if (!database.tempAdmins) database.tempAdmins = {};
    
    if (hours === 0) {
        delete database.tempAdmins[targetUserId];
        await saveDatabase(database);
        
        await bot.sendMessage(chatId, createMenu('ADMIN REVOKED', [
            `User: ${targetUser.first_name}`,
            `ID: ${targetUserId}`,
            '',
            'Admin privileges removed'
        ]));
        
        try {
            await bot.sendMessage(targetUserId, createMenu('ADMIN ACCESS', [
                'Your temporary admin',
                'privileges have been',
                'revoked'
            ]));
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
    } else {
        const expiryTime = Date.now() + (hours * 60 * 60 * 1000);
        database.tempAdmins[targetUserId] = {
            grantedBy: userId,
            grantedAt: Date.now(),
            expiresAt: expiryTime,
            hours: hours
        };
        
        await saveDatabase(database);
        
        await bot.sendMessage(chatId, createMenu('ADMIN GRANTED', [
            `User: ${targetUser.first_name}`,
            `ID: ${targetUserId}`,
            `Duration: ${hours} hours`,
            `Expires: ${new Date(expiryTime).toLocaleString()}`,
            '',
            'Temporary admin access'
        ]));
        
        try {
            await bot.sendMessage(targetUserId, createMenu('ADMIN ACCESS', [
                'Temporary admin granted!',
                `Duration: ${hours} hours`,
                `Expires: ${new Date(expiryTime).toLocaleString()}`,
                '',
                'Available commands:',
                '/admin - Admin panel',
                '/admin broadcast - Broadcast',
                '/admin stats - Statistics',
                '/admin money - Get money',
                '/admin points - Get points',
                '/admin gift - Gift users'
            ]));
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
    }
}

async function showAdminList(bot, chatId, database) {
    let adminText = `╭━━〔 PERMANENT ADMINS 〕━━┈⊷\n`;
    
    global.config.ADMIN_IDS.forEach(adminId => {
        const admin = database.users[adminId];
        if (admin) {
            adminText += `┃✮│➣ ${admin.first_name} (${adminId})\n`;
        }
    });
    
    adminText += `╰━━━━━━━━━━━━━┈⊷\n`;
    adminText += `╭━━〔 TEMPORARY ADMINS 〕━━┈⊷\n`;
    
    if (database.tempAdmins && Object.keys(database.tempAdmins).length > 0) {
        for (const [tempAdminId, adminData] of Object.entries(database.tempAdmins)) {
            const tempAdmin = database.users[tempAdminId];
            const timeLeft = adminData.expiresAt - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (60 * 60 * 1000)));
            
            if (tempAdmin) {
                const grantedBy = database.users[adminData.grantedBy];
                const grantedByName = grantedBy ? grantedBy.first_name : 'Unknown';
                
                adminText += `┃✮│➣ ${tempAdmin.first_name} (${tempAdminId})\n`;
                adminText += `┃✮│➣ ${hoursLeft}h left | By: ${grantedByName}\n`;
            }
        }
    } else {
        adminText += `┃✮│➣ No temporary admins\n`;
    }
    
    adminText += `╰━━━━━━━━━━━━━┈⊷`;
    
    await bot.sendMessage(chatId, adminText);
}

async function handleGiftCommand(bot, chatId, userId, text, database) {
    const parts = text.split(' ');
    
    if (parts.length < 4) {
        return await bot.sendMessage(chatId, createMenu('INVALID FORMAT', [
            'Usage:',
            '/admin gift <user> <amount>',
            '',
            'Examples:',
            '/admin gift 123456789 5000',
            '/admin gift 123456789 100 points'
        ]));
    }
    
    const targetUserId = parts[2];
    const amount = parseInt(parts[3]);
    const type = parts[4] || 'money';
    
    if (isNaN(amount) || amount <= 0) {
        return await bot.sendMessage(chatId, createMenu('INVALID AMOUNT', [
            'Provide positive number'
        ]));
    }
    
    const targetUser = database.users[targetUserId];
    if (!targetUser) {
        return await bot.sendMessage(chatId, createMenu('USER NOT FOUND', [
            `ID: ${targetUserId}`,
            'not found'
        ]));
    }
    
    if (type === 'money' || !parts[4]) {
        targetUser.balance += amount;
        await saveDatabase(database);
        
        try {
            await bot.sendMessage(targetUserId, createMenu('GIFT RECEIVED', [
                `Amount: ₦${amount}`,
                `New Balance: ₦${targetUser.balance}`,
                '',
                'From: Dark Server Admin'
            ]));
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
        
        await bot.sendMessage(chatId, createMenu('GIFT SENT', [
            `To: ${targetUser.first_name}`,
            `ID: ${targetUserId}`,
            `Amount: ₦${amount}`,
            `New Balance: ₦${targetUser.balance}`
        ]));
    }
    else if (type === 'points') {
        targetUser.points += amount;
        await saveDatabase(database);
        
        try {
            await bot.sendMessage(targetUserId, createMenu('GIFT RECEIVED', [
                `Points: ${amount}`,
                `New Points: ${targetUser.points}`,
                '',
                'From: Dark Server Admin'
            ]));
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
        
        await bot.sendMessage(chatId, createMenu('GIFT SENT', [
            `To: ${targetUser.first_name}`,
            `ID: ${targetUserId}`,
            `Points: ${amount}`,
            `New Points: ${targetUser.points}`
        ]));
    }
}

async function giveAdminInfiniteMoney(bot, chatId, userId, database) {
    const user = database.users[userId];
    user.balance = 9999999;
    
    await saveDatabase(database);
    
    await bot.sendMessage(chatId, createMenu('INFINITE MONEY', [
        'Balance set to: ₦9,999,999',
        '',
        'Unlimited paid servers',
        'now available'
    ]));
}

async function giveAdminInfinitePoints(bot, chatId, userId, database) {
    const user = database.users[userId];
    user.points = 999999;
    
    await saveDatabase(database);
    
    await bot.sendMessage(chatId, createMenu('INFINITE POINTS', [
        'Points set to: 999,999',
        '',
        'Unlimited free servers',
        'now available'
    ]));
}

async function startBroadcast(bot, chatId, userId, database) {
    if (!database.broadcastMode) database.broadcastMode = {};
    database.broadcastMode[userId] = true;
    await saveDatabase(database);
    
    await bot.sendMessage(chatId, createMenu('BROADCAST MODE', [
        `Sending to: ${Object.keys(database.users).length} users`,
        '',
        'Send your message now',
        'Supports text and images',
        '',
        'Cancel with /cancel'
    ]));
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
        return await bot.sendMessage(chatId, createMenu('BROADCAST', ['Cancelled']));
    }
    
    const totalUsers = Object.keys(database.users).length;
    let sentCount = 0;
    let failedCount = 0;
    
    await bot.sendMessage(chatId, createMenu('BROADCAST', [`Starting: ${totalUsers} users`]));
    
    for (const userID of Object.keys(database.users)) {
        try {
            if (msg.photo) {
                const photoId = msg.photo[msg.photo.length - 1].file_id;
                const caption = msg.caption || '';
                await bot.sendPhoto(userID, photoId, { caption: caption });
            } else if (msg.text) {
                await bot.sendMessage(userID, msg.text);
            } else {
                continue;
            }
            sentCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log(chalk.red(`Failed to send to user ${userID}:`), error.message);
            failedCount++;
        }
    }
    
    delete database.broadcastMode[userId];
    await saveDatabase(database);
    
    const summary = createMenu('BROADCAST COMPLETE', [
        `Sent: ${sentCount} users`,
        `Failed: ${failedCount} users`,
        `Total: ${totalUsers} users`,
        '',
        failedCount > 0 ? 'Failures: blocked bot' : 'All messages delivered'
    ]);

    await bot.sendMessage(chatId, summary);
}

async function showStats(bot, chatId, database) {
    const totalUsers = Object.keys(database.users).length;
    const verifiedUsers = Object.values(database.users).filter(user => user.verified).length;
    const activeServers = Object.keys(database.servers).length;
    const totalRevenue = calculateTotalRevenue(database);
    
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newUsers = Object.values(database.users).filter(user => user.joined_date > weekAgo).length;
    
    const statsMenu = createMenu('STATISTICS', [
        `Total Users: ${totalUsers}`,
        `Verified: ${verifiedUsers}`,
        `New (7 days): ${newUsers}`,
        `Verification Rate: ${Math.round((verifiedUsers / totalUsers) * 100)}%`,
        '',
        `Active Servers: ${activeServers}`,
        `Server/User Ratio: ${(activeServers / totalUsers).toFixed(2)}`,
        '',
        `Total Revenue: ₦${totalRevenue}`,
        `Avg Per User: ₦${(totalRevenue / totalUsers).toFixed(2)}`,
        '',
        `User Growth: ${newUsers} this week`,
        `Active Rate: ${Math.round((activeServers / verifiedUsers) * 100)}%`
    ]);

    await bot.sendMessage(chatId, statsMenu);
}

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

async function showUsers(bot, chatId, database) {
    const users = Object.values(database.users);
    const verifiedUsers = users.filter(user => user.verified).length;
    const premiumUsers = users.filter(user => user.tier !== 'free').length;
    
    const usersMenu = createMenu('USER MANAGEMENT', [
        `Total: ${users.length}`,
        `Verified: ${verifiedUsers}`,
        `Premium: ${premiumUsers}`,
        '',
        'Recent Users:'
    ]);
    
    let userList = '';
    const recentUsers = users
        .sort((a, b) => b.joined_date - a.joined_date)
        .slice(0, 10);
    
    recentUsers.forEach(user => {
        const date = new Date(user.joined_date).toLocaleDateString();
        userList += `\n┃✮│➣ ${user.first_name} (${user.points}p) - ${date} ${user.verified ? '✓' : '✗'}`;
    });
    
    await bot.sendMessage(chatId, usersMenu + userList + `\n╰━━━━━━━━━━━━━┈⊷`);
}

async function showServers(bot, chatId, database) {
    const servers = Object.values(database.servers);
    
    if (servers.length === 0) {
        return await bot.sendMessage(chatId, createMenu('SERVERS', ['No active servers']));
    }
    
    let serversText = createMenu('ACTIVE SERVERS', [`Total: ${servers.length}`]);
    
    servers.forEach(server => {
        const owner = database.users[server.ownerId];
        const expires = new Date(server.expires).toLocaleDateString();
        serversText += `\n┃✮│➣ ${server.name} (${server.ram}MB) - ${owner.first_name} - ${expires}`;
    });
    
    serversText += `\n╰━━━━━━━━━━━━━┈⊷`;
    
    await bot.sendMessage(chatId, serversText);
}

async function confirmDeleteAll(bot, chatId, database) {
    const totalServers = Object.keys(database.servers).length;
    
    const confirmMenu = createMenu('DANGER - CONFIRM', [
        `Delete ALL ${totalServers} servers?`,
        '',
        'This action is',
        'IRREVERSIBLE',
        '',
        'Affects all users'
    ]);

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '❌ CANCEL', callback_data: 'admin_deleteall_cancel' }],
                [{ text: '✅ DELETE ALL', callback_data: 'admin_deleteall_confirm' }]
            ]
        }
    };

    await bot.sendMessage(chatId, confirmMenu, buttons);
}

async function deleteAllServers(bot, chatId, database) {
    const totalServers = Object.keys(database.servers).length;
    let deletedCount = 0;
    
    await bot.sendMessage(chatId, createMenu('DELETING', [`Servers: ${totalServers}`]));
    
    for (const serverId in database.servers) {
        try {
            delete database.servers[serverId];
            deletedCount++;
        } catch (error) {
            console.log(chalk.red(`Failed to delete server ${serverId}:`), error);
        }
    }
    
    await saveDatabase(database);
    
    await bot.sendMessage(chatId, createMenu('DELETION COMPLETE', [
        `Deleted: ${deletedCount} servers`,
        `Total: ${totalServers}`,
        '',
        'All servers removed'
    ]));
}

async function saveDatabase(database) {
    const fs = require('fs-extra');
    try {
        await fs.writeJson('./database/users.json', database, { spaces: 2 });
    } catch (error) {
        console.log('Save database error:', error);
    }
}
EOFhandlers/admin.js << 'EOF'
const fs = require('fs-extra');
const chalk = require('chalk');
const moment = require('moment');

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
        
        if (database.broadcastMode && database.broadcastMode[userId]) {
            return await processBroadcastMessage(bot, msg, database);
        }
    },
    
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
            await bot.sendMessage(chatId, createMenu('CANCELLED', ['Mass deletion cancelled']));
        }
        
        if (data === 'admin_gift') {
            await bot.sendMessage(chatId, createMenu('GIFT SYSTEM', [
                'Usage:',
                '/admin gift <user_id> <amount>',
                '',
                'Examples:',
                '/admin gift 123456789 5000',
                '/admin gift 123456789 100 points'
            ]));
        }
        
        if (data === 'admin_money') {
            await giveAdminInfiniteMoney(bot, chatId, userId, database);
        }
        
        if (data === 'admin_points') {
            await giveAdminInfinitePoints(bot, chatId, userId, database);
        }
        
        if (data === 'admin_grant') {
            await bot.sendMessage(chatId, createMenu('GRANT ADMIN', [
                'Usage: /grant <user> <hours>',
                '',
                'Examples:',
                '/grant 123456789 24',
                '/grant 123456789 168',
                '/grant 123456789 0 (revoke)'
            ]));
        }
        
        if (data === 'admin_admins') {
            await showAdminList(bot, chatId, database);
        }
    }
};

async function showAdminPanel(bot, chatId, database) {
    const totalUsers = Object.keys(database.users).length;
    const activeServers = Object.keys(database.servers).length;
    const totalRevenue = calculateTotalRevenue(database);
    const tempAdmins = database.tempAdmins ? Object.keys(database.tempAdmins).length : 0;
    
    const panelMenu = createMenu('ADMIN PANEL', [
        `Users: ${totalUsers}`,
        `Servers: ${activeServers}`,
        `Revenue: ₦${totalRevenue}`,
        `Temp Admins: ${tempAdmins}`,
        '',
        'Commands:',
        '/admin stats - Statistics',
        '/admin users - User management',
        '/admin servers - Server list',
        '/admin broadcast - Send message',
        '/admin deleteall - Delete all',
        '/admin gift - Gift system',
        '/grant - Grant admin access'
    ]);

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📢 Broadcast', callback_data: 'admin_broadcast' }],
                [{ text: '💰 Gift User', callback_data: 'admin_gift' }],
                [{ text: '📊 Stats', callback_data: 'admin_stats' }],
                [{ text: '👥 Users', callback_data: 'admin_users' }],
                [{ text: '♾️ Money', callback_data: 'admin_money' }],
                [{ text: '⭐ Points', callback_data: 'admin_points' }],
                [{ text: '👑 Grant Admin', callback_data: 'admin_grant' }],
                [{ text: '📋 Admin List', callback_data: 'admin_admins' }],
                [{ text: '🗑️ Delete All', callback_data: 'admin_deleteall' }]
            ]
        }
    };

    await bot.sendMessage(chatId, panelMenu, buttons);
}

async function handleGrantCommand(bot, chatId, userId, text, database) {
    const isPermanentAdmin = global.config.ADMIN_IDS.includes(userId);
    if (!isPermanentAdmin) {
        return await bot.sendMessage(chatId, createMenu('PERMISSION DENIED', [
            'Only permanent admins',
            'can use /grant command'
        ]));
    }
    
    const parts = text.split(' ');
    
    if (parts.length < 3) {
        return await bot.sendMessage(chatId, createMenu('INVALID FORMAT', [
            'Usage: /grant <user> <hours>',
            '',
            'Examples:',
            '/grant 123456789 24',
            '/grant 123456789 168',
            '/grant 123456789 0 (revoke)'
        ]));
    }
    
    const targetUserId = parts[1];
    const hours = parseInt(parts[2]);
    
    if (isNaN(hours) || hours < 0) {
        return await bot.sendMessage(chatId, createMenu('INVALID HOURS', [
            'Provide positive number',
            'or 0 to revoke'
        ]));
    }
    
    const targetUser = database.users[targetUserId];
    if (!targetUser) {
        return await bot.sendMessage(chatId, createMenu('USER NOT FOUND', [
            `ID: ${targetUserId}`,
            'not found in database'
        ]));
    }
    
    if (!database.tempAdmins) database.tempAdmins = {};
    
    if (hours === 0) {
        delete database.tempAdmins[targetUserId];
        await saveDatabase(database);
        
        await bot.sendMessage(chatId, createMenu('ADMIN REVOKED', [
            `User: ${targetUser.first_name}`,
            `ID: ${targetUserId}`,
            '',
            'Admin privileges removed'
        ]));
        
        try {
            await bot.sendMessage(targetUserId, createMenu('ADMIN ACCESS', [
                'Your temporary admin',
                'privileges have been',
                'revoked'
            ]));
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
    } else {
        const expiryTime = Date.now() + (hours * 60 * 60 * 1000);
        database.tempAdmins[targetUserId] = {
            grantedBy: userId,
            grantedAt: Date.now(),
            expiresAt: expiryTime,
            hours: hours
        };
        
        await saveDatabase(database);
        
        await bot.sendMessage(chatId, createMenu('ADMIN GRANTED', [
            `User: ${targetUser.first_name}`,
            `ID: ${targetUserId}`,
            `Duration: ${hours} hours`,
            `Expires: ${new Date(expiryTime).toLocaleString()}`,
            '',
            'Temporary admin access'
        ]));
        
        try {
            await bot.sendMessage(targetUserId, createMenu('ADMIN ACCESS', [
                'Temporary admin granted!',
                `Duration: ${hours} hours`,
                `Expires: ${new Date(expiryTime).toLocaleString()}`,
                '',
                'Available commands:',
                '/admin - Admin panel',
                '/admin broadcast - Broadcast',
                '/admin stats - Statistics',
                '/admin money - Get money',
                '/admin points - Get points',
                '/admin gift - Gift users'
            ]));
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
    }
}

async function showAdminList(bot, chatId, database) {
    let adminText = `╭━━〔 PERMANENT ADMINS 〕━━┈⊷\n`;
    
    global.config.ADMIN_IDS.forEach(adminId => {
        const admin = database.users[adminId];
        if (admin) {
            adminText += `┃✮│➣ ${admin.first_name} (${adminId})\n`;
        }
    });
    
    adminText += `╰━━━━━━━━━━━━━┈⊷\n`;
    adminText += `╭━━〔 TEMPORARY ADMINS 〕━━┈⊷\n`;
    
    if (database.tempAdmins && Object.keys(database.tempAdmins).length > 0) {
        for (const [tempAdminId, adminData] of Object.entries(database.tempAdmins)) {
            const tempAdmin = database.users[tempAdminId];
            const timeLeft = adminData.expiresAt - Date.now();
            const hoursLeft = Math.max(0, Math.floor(timeLeft / (60 * 60 * 1000)));
            
            if (tempAdmin) {
                const grantedBy = database.users[adminData.grantedBy];
                const grantedByName = grantedBy ? grantedBy.first_name : 'Unknown';
                
                adminText += `┃✮│➣ ${tempAdmin.first_name} (${tempAdminId})\n`;
                adminText += `┃✮│➣ ${hoursLeft}h left | By: ${grantedByName}\n`;
            }
        }
    } else {
        adminText += `┃✮│➣ No temporary admins\n`;
    }
    
    adminText += `╰━━━━━━━━━━━━━┈⊷`;
    
    await bot.sendMessage(chatId, adminText);
}

async function handleGiftCommand(bot, chatId, userId, text, database) {
    const parts = text.split(' ');
    
    if (parts.length < 4) {
        return await bot.sendMessage(chatId, createMenu('INVALID FORMAT', [
            'Usage:',
            '/admin gift <user> <amount>',
            '',
            'Examples:',
            '/admin gift 123456789 5000',
            '/admin gift 123456789 100 points'
        ]));
    }
    
    const targetUserId = parts[2];
    const amount = parseInt(parts[3]);
    const type = parts[4] || 'money';
    
    if (isNaN(amount) || amount <= 0) {
        return await bot.sendMessage(chatId, createMenu('INVALID AMOUNT', [
            'Provide positive number'
        ]));
    }
    
    const targetUser = database.users[targetUserId];
    if (!targetUser) {
        return await bot.sendMessage(chatId, createMenu('USER NOT FOUND', [
            `ID: ${targetUserId}`,
            'not found'
        ]));
    }
    
    if (type === 'money' || !parts[4]) {
        targetUser.balance += amount;
        await saveDatabase(database);
        
        try {
            await bot.sendMessage(targetUserId, createMenu('GIFT RECEIVED', [
                `Amount: ₦${amount}`,
                `New Balance: ₦${targetUser.balance}`,
                '',
                'From: Dark Server Admin'
            ]));
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
        
        await bot.sendMessage(chatId, createMenu('GIFT SENT', [
            `To: ${targetUser.first_name}`,
            `ID: ${targetUserId}`,
            `Amount: ₦${amount}`,
            `New Balance: ₦${targetUser.balance}`
        ]));
    }
    else if (type === 'points') {
        targetUser.points += amount;
        await saveDatabase(database);
        
        try {
            await bot.sendMessage(targetUserId, createMenu('GIFT RECEIVED', [
                `Points: ${amount}`,
                `New Points: ${targetUser.points}`,
                '',
                'From: Dark Server Admin'
            ]));
        } catch (error) {
            console.log('Could not notify user:', error.message);
        }
        
        await bot.sendMessage(chatId, createMenu('GIFT SENT', [
            `To: ${targetUser.first_name}`,
            `ID: ${targetUserId}`,
            `Points: ${amount}`,
            `New Points: ${targetUser.points}`
        ]));
    }
}

async function giveAdminInfiniteMoney(bot, chatId, userId, database) {
    const user = database.users[userId];
    user.balance = 9999999;
    
    await saveDatabase(database);
    
    await bot.sendMessage(chatId, createMenu('INFINITE MONEY', [
        'Balance set to: ₦9,999,999',
        '',
        'Unlimited paid servers',
        'now available'
    ]));
}

async function giveAdminInfinitePoints(bot, chatId, userId, database) {
    const user = database.users[userId];
    user.points = 999999;
    
    await saveDatabase(database);
    
    await bot.sendMessage(chatId, createMenu('INFINITE POINTS', [
        'Points set to: 999,999',
        '',
        'Unlimited free servers',
        'now available'
    ]));
}

async function startBroadcast(bot, chatId, userId, database) {
    if (!database.broadcastMode) database.broadcastMode = {};
    database.broadcastMode[userId] = true;
    await saveDatabase(database);
    
    await bot.sendMessage(chatId, createMenu('BROADCAST MODE', [
        `Sending to: ${Object.keys(database.users).length} users`,
        '',
        'Send your message now',
        'Supports text and images',
        '',
        'Cancel with /cancel'
    ]));
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
        return await bot.sendMessage(chatId, createMenu('BROADCAST', ['Cancelled']));
    }
    
    const totalUsers = Object.keys(database.users).length;
    let sentCount = 0;
    let failedCount = 0;
    
    await bot.sendMessage(chatId, createMenu('BROADCAST', [`Starting: ${totalUsers} users`]));
    
    for (const userID of Object.keys(database.users)) {
        try {
            if (msg.photo) {
                const photoId = msg.photo[msg.photo.length - 1].file_id;
                const caption = msg.caption || '';
                await bot.sendPhoto(userID, photoId, { caption: caption });
            } else if (msg.text) {
                await bot.sendMessage(userID, msg.text);
            } else {
                continue;
            }
            sentCount++;
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.log(chalk.red(`Failed to send to user ${userID}:`), error.message);
            failedCount++;
        }
    }
    
    delete database.broadcastMode[userId];
    await saveDatabase(database);
    
    const summary = createMenu('BROADCAST COMPLETE', [
        `Sent: ${sentCount} users`,
        `Failed: ${failedCount} users`,
        `Total: ${totalUsers} users`,
        '',
        failedCount > 0 ? 'Failures: blocked bot' : 'All messages delivered'
    ]);

    await bot.sendMessage(chatId, summary);
}

async function showStats(bot, chatId, database) {
    const totalUsers = Object.keys(database.users).length;
    const verifiedUsers = Object.values(database.users).filter(user => user.verified).length;
    const activeServers = Object.keys(database.servers).length;
    const totalRevenue = calculateTotalRevenue(database);
    
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const newUsers = Object.values(database.users).filter(user => user.joined_date > weekAgo).length;
    
    const statsMenu = createMenu('STATISTICS', [
        `Total Users: ${totalUsers}`,
        `Verified: ${verifiedUsers}`,
        `New (7 days): ${newUsers}`,
        `Verification Rate: ${Math.round((verifiedUsers / totalUsers) * 100)}%`,
        '',
        `Active Servers: ${activeServers}`,
        `Server/User Ratio: ${(activeServers / totalUsers).toFixed(2)}`,
        '',
        `Total Revenue: ₦${totalRevenue}`,
        `Avg Per User: ₦${(totalRevenue / totalUsers).toFixed(2)}`,
        '',
        `User Growth: ${newUsers} this week`,
        `Active Rate: ${Math.round((activeServers / verifiedUsers) * 100)}%`
    ]);

    await bot.sendMessage(chatId, statsMenu);
}

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

async function showUsers(bot, chatId, database) {
    const users = Object.values(database.users);
    const verifiedUsers = users.filter(user => user.verified).length;
    const premiumUsers = users.filter(user => user.tier !== 'free').length;
    
    const usersMenu = createMenu('USER MANAGEMENT', [
        `Total: ${users.length}`,
        `Verified: ${verifiedUsers}`,
        `Premium: ${premiumUsers}`,
        '',
        'Recent Users:'
    ]);
    
    let userList = '';
    const recentUsers = users
        .sort((a, b) => b.joined_date - a.joined_date)
        .slice(0, 10);
    
    recentUsers.forEach(user => {
        const date = new Date(user.joined_date).toLocaleDateString();
        userList += `\n┃✮│➣ ${user.first_name} (${user.points}p) - ${date} ${user.verified ? '✓' : '✗'}`;
    });
    
    await bot.sendMessage(chatId, usersMenu + userList + `\n╰━━━━━━━━━━━━━┈⊷`);
}

async function showServers(bot, chatId, database) {
    const servers = Object.values(database.servers);
    
    if (servers.length === 0) {
        return await bot.sendMessage(chatId, createMenu('SERVERS', ['No active servers']));
    }
    
    let serversText = createMenu('ACTIVE SERVERS', [`Total: ${servers.length}`]);
    
    servers.forEach(server => {
        const owner = database.users[server.ownerId];
        const expires = new Date(server.expires).toLocaleDateString();
        serversText += `\n┃✮│➣ ${server.name} (${server.ram}MB) - ${owner.first_name} - ${expires}`;
    });
    
    serversText += `\n╰━━━━━━━━━━━━━┈⊷`;
    
    await bot.sendMessage(chatId, serversText);
}

async function confirmDeleteAll(bot, chatId, database) {
    const totalServers = Object.keys(database.servers).length;
    
    const confirmMenu = createMenu('DANGER - CONFIRM', [
        `Delete ALL ${totalServers} servers?`,
        '',
        'This action is',
        'IRREVERSIBLE',
        '',
        'Affects all users'
    ]);

    const buttons = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '❌ CANCEL', callback_data: 'admin_deleteall_cancel' }],
                [{ text: '✅ DELETE ALL', callback_data: 'admin_deleteall_confirm' }]
            ]
        }
    };

    await bot.sendMessage(chatId, confirmMenu, buttons);
}

async function deleteAllServers(bot, chatId, database) {
    const totalServers = Object.keys(database.servers).length;
    let deletedCount = 0;
    
    await bot.sendMessage(chatId, createMenu('DELETING', [`Servers: ${totalServers}`]));
    
    for (const serverId in database.servers) {
        try {
            delete database.servers[serverId];
            deletedCount++;
        } catch (error) {
            console.log(chalk.red(`Failed to delete server ${serverId}:`), error);
        }
    }
    
    await saveDatabase(database);
    
    await bot.sendMessage(chatId, createMenu('DELETION COMPLETE', [
        `Deleted: ${deletedCount} servers`,
        `Total: ${totalServers}`,
        '',
        'All servers removed'
    ]));
}

async function saveDatabase(database) {
    const fs = require('fs-extra');
    try {
        await fs.writeJson('./database/users.json', database, { spaces: 2 });
    } catch (error) {
        console.log('Save database error:', error);
    }
}
