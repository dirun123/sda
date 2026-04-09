const mongoose = require('mongoose');

// චැනල් සහ ඔටෝ පෝස්ට් සෙටින්ග්ස්
const channelSchema = new mongoose.Schema({
    jid: { type: String, required: true, unique: true },
    name: String,
    category: { type: String, default: 'general' }, // song, tiktok, fun වගේ
    keywords: [String], // සර්ච් කරන්න ඕන වචන ලිස්ට් එක
    interval: { type: Number, default: 30 }, // පෝස්ට් වෙන්න ඕන විනාඩි ගණන
    lastPost: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    tiktokPages: { type: [String], default: [] }, // ලොක් කරපු TikTok පේජ්
    dailyLimit: { type: Number, default: 0 }, // දවසකට දාන උපරිම වීඩියෝ ගණන
    postsToday: { type: Number, default: 0 }, // අද දවසට දාපු ගණන
    lastReset: { type: Date, default: Date.now } // අන්තිමට දවස රීසෙට් කරපු වෙලාව
});

// එකම වීඩියෝව වැටීම වැළැක්වීමට (History)
const historySchema = new mongoose.Schema({
    category: { type: String, unique: true },
    videoIds: { type: [String], default: [] } // Max 1000 IDs
});

const Channel = mongoose.model('Channel', channelSchema);
const History = mongoose.model('History', historySchema);

module.exports = { Channel, History };