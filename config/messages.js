module.exports = {
    // Welcome Messages
    WELCOME: `👋 Welcome to *Dark Server Manager*

I can help you create and manage servers instantly!

📋 *Requirements:*
• Join our channels for verification
• Earn points or fund your balance
• Create servers in minutes

Use /menu to get started!`,

    // Verification Messages
    VERIFICATION_REQUIRED: `🔐 *Verification Required*

To use this bot, you must join our channels:

📢 *Telegram Channels:*
• Main Channel: ${global.config.CHANNELS.TELEGRAM_MAIN}
• Backup Channel: ${global.config.CHANNELS.TELEGRAM_BACKUP}

📱 *WhatsApp Channel:*
${global.config.CHANNELS.WHATSAPP_LINK}

*After joining all channels, use /verify to check your status and earn points!*`,

    // Access Denied Messages
    ACCESS_DENIED: "❌ Access Denied",
    NOT_VERIFIED: "❌ Please complete channel verification first using /verify",
    INSUFFICIENT_POINTS: "❌ Insufficient points. Complete tasks to earn more points!",
    INSUFFICIENT_BALANCE: "❌ Insufficient balance. Fund your account using /balance"
};