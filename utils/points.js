const logger = require('./logger');

module.exports = {
    // Award points for channel verification
    awardChannelPoints: (user, database) => {
        let totalAwarded = 0;
        
        // Telegram main channel
        if (user.channels.telegramMain && !user.telegramMainAwarded) {
            user.points += global.config.POINTS.CHANNEL_JOIN_POINTS;
            user.telegramMainAwarded = true;
            totalAwarded += global.config.POINTS.CHANNEL_JOIN_POINTS;
            logger.info(`Awarded ${global.config.POINTS.CHANNEL_JOIN_POINTS} points to ${user.id} for Telegram main channel`);
        }
        
        // Telegram backup channel
        if (user.channels.telegramBackup && !user.telegramBackupAwarded) {
            user.points += global.config.POINTS.CHANNEL_JOIN_POINTS;
            user.telegramBackupAwarded = true;
            totalAwarded += global.config.POINTS.CHANNEL_JOIN_POINTS;
            logger.info(`Awarded ${global.config.POINTS.CHANNEL_JOIN_POINTS} points to ${user.id} for Telegram backup channel`);
        }
        
        // WhatsApp channel
        if (user.channels.whatsapp && !user.whatsappAwarded) {
            user.points += global.config.POINTS.WHATSAPP_VERIFY_POINTS;
            user.whatsappAwarded = true;
            totalAwarded += global.config.POINTS.WHATSAPP_VERIFY_POINTS;
            logger.info(`Awarded ${global.config.POINTS.WHATSAPP_VERIFY_POINTS} points to ${user.id} for WhatsApp channel`);
        }
        
        // Completion bonus
        if (user.channels.telegramMain && user.channels.telegramBackup && user.channels.whatsapp && !user.completionBonusAwarded) {
            user.points += 50;
            user.completionBonusAwarded = true;
            totalAwarded += 50;
            logger.info(`Awarded 50 bonus points to ${user.id} for completing all verifications`);
        }
        
        return totalAwarded;
    },
    
    // Award referral points
    awardReferralPoints: (referrer, referredUser, database) => {
        if (!referrer.referrals.includes(referredUser.id) && referredUser.verified) {
            referrer.points += global.config.POINTS.REFERRAL_POINTS;
            referrer.referrals.push(referredUser.id);
            logger.info(`Awarded ${global.config.POINTS.REFERRAL_POINTS} points to ${referrer.id} for referral ${referredUser.id}`);
            return global.config.POINTS.REFERRAL_POINTS;
        }
        return 0;
    },
    
    // Check if user can do daily math
    canDoDailyMath: (user) => {
        const lastMath = user.last_daily_math || 0;
        const today = new Date().toDateString();
        const lastMathDate = new Date(lastMath).toDateString();
        return lastMathDate !== today;
    },
    
    // Get user points summary
    getPointsSummary: (user) => {
        return {
            total: user.points,
            neededForFree: Math.max(0, global.config.POINTS.FREE_SERVER_COST - user.points),
            progress: Math.min(100, (user.points / global.config.POINTS.FREE_SERVER_COST) * 100)
        };
    }
};