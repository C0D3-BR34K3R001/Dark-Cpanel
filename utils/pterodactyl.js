const axios = require('axios');
const chalk = require('chalk');
const logger = require('./logger');

module.exports = {
    createServer: async (user, tier) => {
        try {
            const config = global.config.PTERODACTYL;
            
            const pterodactylUserId = await getPterodactylUserId(user.id);
            
            const serverData = {
                name: `${user.first_name}_${tier.name}_${Date.now()}`.substring(0, 40),
                user: pterodactylUserId,
                egg: parseInt(config.EGG),
                docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
                startup: "npm start",
                environment: {
                    USER_UPLOAD: "0",
                    AUTO_UPDATE: "0"
                },
                limits: {
                    memory: parseInt(tier.ram),
                    swap: 0,
                    disk: parseInt(tier.disk),
                    io: 500,
                    cpu: parseInt(tier.cpu)
                },
                feature_limits: {
                    databases: 0,
                    allocations: 1,
                    backups: 0
                },
                allocation: {
                    default: 1
                }
            };
            
            console.log(chalk.blue('Creating server with data:'), JSON.stringify(serverData, null, 2));
            
            const response = await axios.post(
                `${config.DOMAIN}/api/application/servers`,
                serverData,
                {
                    headers: {
                        'Authorization': `Bearer ${config.API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    },
                    timeout: 30000
                }
            );
            
            logger.info(`Server created for user ${user.id}: ${serverData.name}`);
            console.log(chalk.green('Server created successfully'));
            
            return response.data;
            
        } catch (error) {
            const errorMsg = error.response?.data?.errors?.[0]?.detail || error.message;
            logger.error('Pterodactyl API error', { 
                error: errorMsg, 
                user: user.id, 
                tier: tier.name,
                response: error.response?.data 
            });
            
            console.log(chalk.red('Pterodactyl API error:'), errorMsg);
            
            if (error.response?.data) {
                console.log(chalk.yellow('Full error response:'), JSON.stringify(error.response.data, null, 2));
            }
            
            throw new Error(`Failed to create server: ${errorMsg}`);
        }
    },
    
    deleteServer: async (serverId) => {
        try {
            const config = global.config.PTERODACTYL;
            
            await axios.delete(
                `${config.DOMAIN}/api/application/servers/${serverId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${config.API_KEY}`,
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    },
                    timeout: 15000
                }
            );
            
            logger.info(`Server deleted: ${serverId}`);
            console.log(chalk.green(`Server ${serverId} deleted`));
            
            return true;
            
        } catch (error) {
            if (error.response?.status === 404) {
                logger.warn(`Server not found (already deleted?): ${serverId}`);
                return true;
            }
            
            const errorMsg = error.response?.data?.errors?.[0]?.detail || error.message;
            logger.error('Pterodactyl delete error', { error: errorMsg, serverId });
            console.log(chalk.red('Pterodactyl delete error:'), errorMsg);
            throw new Error(`Failed to delete server: ${errorMsg}`);
        }
    },
    
    getServerStatus: async (serverId) => {
        try {
            const config = global.config.PTERODACTYL;
            
            const response = await axios.get(
                `${config.DOMAIN}/api/client/servers/${serverId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${config.CLIENT_KEY}`,
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    },
                    timeout: 10000
                }
            );
            
            return response.data;
            
        } catch (error) {
            logger.error('Pterodactyl status error', { error: error.message, serverId });
            throw new Error('Failed to get server status');
        }
    },
    
    getUserDetails: async (userId) => {
        try {
            const config = global.config.PTERODACTYL;
            
            const response = await axios.get(
                `${config.DOMAIN}/api/application/users/${userId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${config.API_KEY}`,
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    },
                    timeout: 10000
                }
            );
            
            return response.data;
            
        } catch (error) {
            logger.error('Pterodactyl user details error', { error: error.message, userId });
            throw new Error('Failed to get user details');
        }
    },
    
    listUsers: async () => {
        try {
            const config = global.config.PTERODACTYL;
            
            const response = await axios.get(
                `${config.DOMAIN}/api/application/users`,
                {
                    headers: {
                        'Authorization': `Bearer ${config.API_KEY}`,
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    },
                    timeout: 10000
                }
            );
            
            return response.data;
            
        } catch (error) {
            logger.error('Pterodactyl list users error', { error: error.message });
            throw new Error('Failed to list users');
        }
    },
    
    createUser: async (telegramUser) => {
        try {
            const config = global.config.PTERODACTYL;
            
            const userData = {
                username: `user_${telegramUser.id}`,
                email: `user${telegramUser.id}@darkpanel.com`,
                first_name: telegramUser.first_name.substring(0, 60),
                last_name: telegramUser.username ? telegramUser.username.substring(0, 60) : 'User',
                password: generateRandomPassword(12),
                root_admin: false
            };
            
            const response = await axios.post(
                `${config.DOMAIN}/api/application/users`,
                userData,
                {
                    headers: {
                        'Authorization': `Bearer ${config.API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    },
                    timeout: 15000
                }
            );
            
            logger.info(`Pterodactyl user created: ${userData.username}`);
            console.log(chalk.green('Pterodactyl user created successfully'));
            
            return response.data;
            
        } catch (error) {
            const errorMsg = error.response?.data?.errors?.[0]?.detail || error.message;
            logger.error('Pterodactyl create user error', { error: errorMsg, user: telegramUser.id });
            console.log(chalk.red('Pterodactyl create user error:'), errorMsg);
            throw new Error(`Failed to create Pterodactyl user: ${errorMsg}`);
        }
    },
    
    suspendServer: async (serverId) => {
        try {
            const config = global.config.PTERODACTYL;
            
            await axios.post(
                `${config.DOMAIN}/api/application/servers/${serverId}/suspend`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${config.API_KEY}`,
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    }
                }
            );
            
            logger.info(`Server suspended: ${serverId}`);
            return true;
            
        } catch (error) {
            logger.error('Pterodactyl suspend error', { error: error.message, serverId });
            throw new Error('Failed to suspend server');
        }
    },
    
    unsuspendServer: async (serverId) => {
        try {
            const config = global.config.PTERODACTYL;
            
            await axios.post(
                `${config.DOMAIN}/api/application/servers/${serverId}/unsuspend`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${config.API_KEY}`,
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    }
                }
            );
            
            logger.info(`Server unsuspended: ${serverId}`);
            return true;
            
        } catch (error) {
            logger.error('Pterodactyl unsuspend error', { error: error.message, serverId });
            throw new Error('Failed to unsuspend server');
        }
    }
};

async function getPterodactylUserId(telegramUserId) {
    try {
        return 1;
    } catch (error) {
        console.log(chalk.yellow('Using default user ID 1'));
        return 1;
    }
}

function generateRandomPassword(length) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

async function testConnection() {
    try {
        const config = global.config.PTERODACTYL;
        console.log(chalk.blue('Testing Pterodactyl connection...'));
        
        const response = await axios.get(
            `${config.DOMAIN}/api/application/users`,
            {
                headers: {
                    'Authorization': `Bearer ${config.API_KEY}`,
                    'Accept': 'Application/vnd.pterodactyl.v1+json'
                },
                timeout: 10000
            }
        );
        
        console.log(chalk.green('Pterodactyl connection successful'));
        console.log(chalk.blue(`Found ${response.data.data.length} users`));
        return true;
        
    } catch (error) {
        console.log(chalk.red('Pterodactyl connection failed:'), error.message);
        return false;
    }
}

module.exports.testConnection = testConnection;
