const axios = require('axios');
const { History } = require('./models');

// --- 🌐 COMMON HEADERS (Cloudflare පන්නන්න බ්‍රවුසර් එකක් වගේ රඟපාන්න) ---
const axiosConfig = {
    headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'en-US,en;q=0.9',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': 'https://www.tikwm.com/',
        'sec-ch-ua': '"Chromium";v="116", "Not)A;Brand";v="24", "Google Chrome";v="116"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
    }
};

/**
 * Keywords පාවිච්චි කරලා වීඩියෝ සෙවීමට (Auto Poster - Mode A)
 */
async function getTikTokVideo(category, keywords) {
    try {
        const keyword = keywords[Math.floor(Math.random() * keywords.length)];
        const res = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(keyword)}`, axiosConfig);
        const videos = res.data?.data?.videos;
        
        if (!videos || videos.length === 0) return null;

        let hist = await History.findOne({ category });
        if (!hist) hist = await History.create({ category, videoIds: [] });

        const fresh = videos.filter(v => !hist.videoIds.includes(v.video_id));
        
        if (fresh.length > 0) {
            const selected = fresh[0];
            hist.videoIds.push(selected.video_id);
            if (hist.videoIds.length > 1000) hist.videoIds.shift();
            await hist.save();

            return {
                url: selected.play.startsWith('http') ? selected.play : `https://www.tikwm.com${selected.play}`,
                title: selected.title,
                id: selected.video_id,
                author: selected.author?.nickname || "Unknown"
            };
        }
    } catch (e) {
        console.error("TikTok Search Error:", e.message);
    }
    return null;
}

/**
 * TikTok URL එකකින් වීඩියෝ විස්තර ලබාගැනීමට (Manual Forwarder & .tiktok command)
 */
async function getTikTokInfo(url) {
    try {
        const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, axiosConfig);
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

/**
 * සංඛ්‍යා ලස්සනට පෙන්වීමට (උදා: 1.2K, 5M)
 */
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
}

/**
 * නිශ්චිත Usernames වලින් වීඩියෝ සෙවීමට (Auto Poster - Mode B)
 * Cloudflare පන්නන්න 'feed/search' hack එක පාවිච්චි කරයි.
 */
async function getTikTokVideoFromUsers(category, usernames) {
    try {
        let username = usernames[Math.floor(Math.random() * usernames.length)].replace('@', '');
        
        // සර්ච් එකට @ දාලා යූසර්වම ටාගට් කරනවා (Cloudflare Block එක මෙතනදී අඩුයි)
        const res = await axios.get(`https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent('@' + username)}`, axiosConfig);
        const videos = res.data?.data?.videos;
        
        if (!videos || videos.length === 0) {
            console.log(`⚠️ No videos found for user: ${username}`);
            return null;
        }

        let hist = await History.findOne({ category });
        if (!hist) hist = await History.create({ category, videoIds: [] });

        const fresh = videos.filter(v => !hist.videoIds.includes(v.video_id));
        
        if (fresh.length > 0) {
            const selected = fresh[0];
            hist.videoIds.push(selected.video_id);
            if (hist.videoIds.length > 1000) hist.videoIds.shift();
            await hist.save();

            return {
                url: selected.play.startsWith('http') ? selected.play : `https://www.tikwm.com${selected.play}`,
                title: selected.title,
                id: selected.video_id,
                author: selected.author?.nickname || username
            };
        } else {
            console.log(`ℹ️ Latest videos from ${username} already posted.`);
        }
    } catch (e) {
        console.error("TikTok User Search Error:", e.message);
    }
    return null;
}

module.exports = { 
    getTikTokVideo, 
    getTikTokVideoFromUsers, 
    getTikTokInfo, 
    formatNumber 
};
