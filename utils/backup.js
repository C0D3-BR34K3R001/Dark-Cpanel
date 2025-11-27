const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const logger = require('./logger');

module.exports = {
    createBackup: async () => {
        try {
            const backupDir = path.join(__dirname, '../database/backups');
            await fs.ensureDir(backupDir);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
            
            const database = await fs.readJson(path.join(__dirname, '../database/users.json'));
            
            // Add backup metadata
            const backupData = {
                metadata: {
                    timestamp: new Date().toISOString(),
                    version: '2.0.0',
                    totalUsers: Object.keys(database.users || {}).length,
                    totalServers: Object.keys(database.servers || {}).length
                },
                data: database
            };
            
            await fs.writeJson(backupFile, backupData, { spaces: 2 });
            
            console.log(chalk.green(`✅ Backup created: ${path.basename(backupFile)}`));
            logger.info(`Backup created: ${backupFile}`);
            
            return backupFile;
            
        } catch (error) {
            console.log(chalk.red('❌ Backup creation failed:'), error);
            logger.error('Backup creation failed', error);
            throw error;
        }
    },
    
    cleanupOldBackups: async (maxBackups = 10) => {
        try {
            const backupDir = path.join(__dirname, '../database/backups');
            if (!await fs.pathExists(backupDir)) return;
            
            const files = await fs.readdir(backupDir);
            const backupFiles = files
                .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                .map(f => {
                    const filePath = path.join(backupDir, f);
                    return { name: f, path: filePath, time: fs.statSync(filePath).mtimeMs };
                })
                .sort((a, b) => b.time - a.time); // Sort by newest first
            
            // Keep only the most recent backups
            const filesToDelete = backupFiles.slice(maxBackups);
            
            for (const file of filesToDelete) {
                await fs.remove(file.path);
                console.log(chalk.yellow(`🧹 Removed old backup: ${file.name}`));
                logger.info(`Removed old backup: ${file.name}`);
            }
            
            return filesToDelete.length;
            
        } catch (error) {
            console.log(chalk.red('Backup cleanup error:'), error);
            logger.error('Backup cleanup error', error);
            return 0;
        }
    },
    
    restoreBackup: async (backupFileName) => {
        try {
            const backupFile = path.join(__dirname, '../database/backups', backupFileName);
            
            if (!await fs.pathExists(backupFile)) {
                throw new Error('Backup file not found');
            }
            
            const backupData = await fs.readJson(backupFile);
            const databaseFile = path.join(__dirname, '../database/users.json');
            
            // Create restore backup first
            const restoreBackupDir = path.join(__dirname, '../database/restore_backups');
            await fs.ensureDir(restoreBackupDir);
            const currentData = await fs.readJson(databaseFile);
            const restoreBackupFile = path.join(restoreBackupDir, `restore-backup-${Date.now()}.json`);
            await fs.writeJson(restoreBackupFile, currentData, { spaces: 2 });
            
            // Restore the backup
            await fs.writeJson(databaseFile, backupData.data, { spaces: 2 });
            
            console.log(chalk.green(`✅ Backup restored from: ${backupFileName}`));
            logger.info(`Backup restored from: ${backupFileName}`);
            
            return true;
            
        } catch (error) {
            console.log(chalk.red('Backup restore failed:'), error);
            logger.error('Backup restore failed', error);
            throw error;
        }
    },
    
    listBackups: async () => {
        try {
            const backupDir = path.join(__dirname, '../database/backups');
            if (!await fs.pathExists(backupDir)) return [];
            
            const files = await fs.readdir(backupDir);
            return files
                .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
                .sort()
                .reverse();
        } catch (error) {
            console.log(chalk.red('Backup list error:'), error);
            return [];
        }
    }
};