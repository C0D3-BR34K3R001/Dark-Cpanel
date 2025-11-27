const axios = require('axios');
const chalk = require('chalk');
const logger = require('./logger');

module.exports = {
    // Create a new server
    createServer: async (user, tier) => {
        try {
            const config = global.config.PTERODACTYL;
            
            const serverData = {
                name: `${user.first_name}_${tier.name}_${Date.now()}`.substring(0, 40),
                user: user.id,
                egg: config.EGG,
                docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
                startup: "npm start",
                environment: {
                    USER_UPLOAD: "0",
                    AUTO_UPDATE: "0"
                },
                limits: {
                    memory: tier.ram,
                    swap: 0,
                    disk: tier.disk,
                    io: 500,
                    cpu: tier.cpu
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
            
            const response = await axios.post(
                `${config.DOMAIN}/api/application/servers`,
                serverData,
                {
                    headers: {
                        'Authorization': `Bearer ${config.API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'Application/vnd.pterodactyl.v1+json'
                    },
                    timeout: 30000 // 30 second timeout
                }
            );
            
            logger.info(`Server created for user ${user.id}: ${serverData.name}`);
            console.log(chalk.green(`✅ Server created for user ${user.id}`));
            
            return response.data;
            
        } catch (error) {
            const errorMsg = error.response?.data?.errors?.[0]?.detail || error.message;
            logger.error('Pterodactyl API error', { error: errorMsg, user: user.id, tier: tier.name });
            console.log(chalk.red('❌ Pterodactyl API error:'), errorMsg);
            throw new Error(`Failed to create server: ${errorMsg}`);
        }
    },
    
    // Delete server
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
            console.log(chalk.green(`✅ Server ${serverId} deleted`));
            
            return true;
            
        } catch (error) {
            // If server not found, consider it deleted
            if (error.response?.status === 404) {
                logger.warn(`Server not found (already deleted?): ${serverId}`);
                return true;
            }
            
            const errorMsg = error.response?.data?.errors?.[0]?.detail || error.message;
            logger.error('Pterodactyl delete error', { error: errorMsg, serverId });
            console.log(chalk.red('❌ Pterodactyl delete error:'), errorMsg);
            throw new Error(`Failed to delete server: ${errorMsg}`);
        }
    },
    
    // Get server status
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
    
    // Suspend server
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
    
    // Unsuspend server
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