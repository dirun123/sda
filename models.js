const mongoose = require('mongoose');

// --- 📊 CHANNELS & SETTINGS SCHEMA ---
const channelSchema = new mongoose.Schema({
    // jid එක unique: true අයින් කළා, මොකද එකම චැනල් එකට ඔටෝ පෝස්ටර් එකයි 
    // මැනුවල් පෝස්ටර් එකයි දෙකම ලින්ක් කරන්න ඕන වෙන්න පුළුවන් නිසා.
    jid: { type: String, required: true }, 
    
    name: { type: String, default: 'Syntiox Channel' },
    
    // category එක තමයි දැන් වැදගත්ම දේ. 
    // Manual forwarder එකකදී මේක 'manual_forward_නම්බර්' විදිහට සේවු වෙනවා.
    category: { type: String, required: true, unique: true }, 
    
    keywords: [String], // Auto poster එකට සර්ච් කරන්න ඕන වචන
    interval: { type: Number, default: 30 }, // විනාඩි ගණන
    lastPost: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    
    tiktokPages: { type: [String], default: [] }, // ලොක් කරපු TikTok පේජ් ලිස්ට් එක
    dailyLimit: { type: Number, default: 0 }, 
    postsToday: { type: Number, default: 0 }, 
    lastReset: { type: Date, default: Date.now } 
});

// --- 📜 HISTORY SCHEMA (එකම වීඩියෝව නැවත වැටීම වැළැක්වීමට) ---
const historySchema = new mongoose.Schema({
    category: { type: String, required: true, unique: true },
    videoIds: { type: [String], default: [] } // උපරිම වීඩියෝ ID 1000ක් සේවු වෙනවා
});

const Channel = mongoose.model('Channel', channelSchema);
const History = mongoose.model('History', historySchema);

module.exports = { Channel, History };
