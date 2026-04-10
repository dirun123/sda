const axios = require('axios');
const { History } = require('./models');

async function getTikTokVideo(category, keywords) {
    try {
        const keyword = keywords[Math.floor(Math.random() * keywords.length)];
        const res = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(keyword)}`);
        const videos = res.data?.data?.videos;
        
        if (!videos || videos.length === 0) return null;

        // හිස්ට්‍රි එක බලනවා
        let hist = await History.findOne({ category });
        if (!hist) hist = await History.create({ category, videoIds: [] });

        // පරණ නැති අලුත්ම වීඩියෝවක් පෙරලා ගන්නවා
        const fresh = videos.filter(v => !hist.videoIds.includes(v.video_id));
        
        if (fresh.length > 0) {
            const selected = fresh[0];
            
            // හිස්ට්‍රි එක අප්ඩේට් කරනවා (ලිමිට් එක 1000යි)
            hist.videoIds.push(selected.video_id);
            if (hist.videoIds.length > 1000) hist.videoIds.shift();
            await hist.save();

            return {
                url: `https://www.tikwm.com${selected.play}`,
                title: selected.title,
                id: selected.video_id,
                author: selected.author?.nickname || "Unknown",
                views: selected.play_count || 0,
                likes: selected.digg_count || 0,
                shares: selected.share_count || 0,
                music: selected.music ? `https://www.tikwm.com${selected.music}` : null
            };
        }
    } catch (e) {
        console.error("TikTok Error:", e.message);
    }
    return null;
}

async function getTikTokInfo(url) {
    try {
        const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const data = res.data?.data;
        if (!data) return null;

        return {
            videoUrl: data.play ? (data.play.startsWith('http') ? data.play : `https://www.tikwm.com${data.play}`) : null,
            images: data.images || [],
            musicUrl: data.music ? (data.music.startsWith('http') ? data.music : `https://www.tikwm.com${data.music}`) : null,
            title: data.title || "",
            author: data.author?.nickname || data.author?.unique_id || "Unknown",
            views: data.play_count || 0,
            likes: data.digg_count || 0,
            shares: data.share_count || 0,
            comments: data.comment_count || 0
        };
    } catch (e) {
        console.error("TikTok Info Error:", e.message);
        return null;
    }
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
}

async function getTikTokVideoFromUsers(category, usernames) {
    try {
        // අහඹු ලෙස එක යූසර් කෙනෙක් තෝරගන්නවා
        let username = usernames[Math.floor(Math.random() * usernames.length)].replace('@', '');
        
        // 🚀 Cloudflare බ්ලොක් එකෙන් බේරෙන්න 'feed/search' පාවිච්චි කරනවා
        // සර්ච් එකට @ කෑල්ලක් දානවා එතකොට ඒ යූසර්ගේ වීඩියෝ විතරක් එන්න තියෙන ඉඩ වැඩියි
        const res = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent('@' + username)}`);
        const videos = res.data?.data?.videos;
        
        if (!videos || videos.length === 0) {
            console.log(`⚠️ No videos found for user: ${username}`);
            return null;
        }

        // හිස්ට්‍රි එක බලනවා
        let hist = await History.findOne({ category });
        if (!hist) hist = await History.create({ category, videoIds: [] });

        // පරණ නැති අලුත්ම වීඩියෝවක් පෙරලා ගන්නවා
        const fresh = videos.filter(v => !hist.videoIds.includes(v.video_id));
        
        if (fresh.length > 0) {
            const selected = fresh[0];
            
            // හිස්ට්‍රි එක අප්ඩේට් කරනවා
            hist.videoIds.push(selected.video_id);
            if (hist.videoIds.length > 1000) hist.videoIds.shift();
            await hist.save();

            return {
                url: `https://www.tikwm.com${selected.play}`,
                title: selected.title,
                id: selected.video_id,
                author: selected.author?.nickname || "Unknown",
                views: selected.play_count || 0,
                likes: selected.digg_count || 0,
                shares: selected.share_count || 0,
                music: selected.music ? `https://www.tikwm.com${selected.music}` : null
            };
        } else {
            console.log(`ℹ️ All latest videos from ${username} are already posted.`);
        }
    } catch (e) {
        console.error("TikTok Search Hack Error:", e.message);
    }
    return null;
}

module.exports = { getTikTokVideo, getTikTokVideoFromUsers, getTikTokInfo, formatNumber };
