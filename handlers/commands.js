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
    handleCreateServer: async (bot, msg, database) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const user = database.users[userId];
        
        if (!user.verified) {
            return await bot.sendMessage(chatId, createMenu('ACCESS DENIED', [
                'Complete verification first',
                '',
                'Use /verify to begin'
            ]));
        }
        
        return true;
    },
    
    handleBalance: async (bot, msg, database) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const user = database.users[userId];
        
        return true;
    },
    
    handleTasks: async (bot, msg, database) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id.toString();
        const user = database.users[userId];
        
        return true;
    }
};
