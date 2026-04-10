const { default: makeWASocket, fetchLatestBaileysVersion, useMultiFileAuthState, delay } = require('sandes-baileys-v2');
const mongoose = require('mongoose');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const express = require('express');
const { useMongoDBAuthState } = require('./mongoAuth');
const { Channel } = require('./models');
const { getTikTokVideo, getTikTokInfo, formatNumber } = require('./tiktok');

const app = express();
const port = 8000; // 👈 උඹ ඉල්ලපු Port 8000

// Koyeb Health Check එකට මේක ඕනේ
app.get('/', (req, res) => res.send('Syntiox Bot is running! 🚀'));
app.listen(port, () => console.log(`🌍 Health check server listening on port ${port}`));


async function startBot() {
    await mongoose.connect(process.env.MONGODB_URL);
    const { state, saveCreds } = await useMongoDBAuthState(process.env.SESSION_ID);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent'}),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: false, 
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 5000,
        patchMessageBeforeVerting: true,
        getMessage: async (key) => {
            if (global.MESSAGE_STORE) {
                try {
                    const msg = await global.MESSAGE_STORE.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                } catch (e) {
                    return undefined;
                }
            }
            // Store එකක් නැත්නම් බොරුවක් යවලා හරි බේරගන්නවා
            return { conversation: "Hello" };
        },
        // 👇 ViewOnce මැසේජ් Decrypt කරන්න ඕන 
        msgRetryCounterCache: new Map(),
    });

   

    sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;

    if (qr) {
        // ලොකු QR එකක් එන එක නවත්වන්න කලින් terminal එක clear කරන්න පුළුවන් (optional)
        // console.clear(); 
        
        console.log("------------------------------------------");
        console.log("SCAN THIS SMALL QR CODE:");
        qrcode.generate(qr, { small: true }); // මෙතන තමයි magic එක තියෙන්නේ
        console.log("------------------------------------------");
    }

    if (connection === 'open') {
        console.log("🔥 Syntiox Bot Live!");
    }
})

    // --- 🤖 AUTO POSTER SCHEDULER ---
    // හැම විනාඩි 5කටම සැරයක් ඩේටාබේස් එක චෙක් කරලා පෝස්ට් කරන්න ඕන ඒවා තෝරනවා
    cron.schedule('*/5 * * * *', async () => {
        const channels = await Channel.find({ isActive: true });
        for (const ch of channels) {
            const now = new Date();
            
            // දවස මාරු වෙලා නම් daily limit එක රීසෙට් කරනවා
            if (now.getDate() !== new Date(ch.lastReset).getDate()) {
                ch.postsToday = 0;
                ch.lastReset = now;
                await ch.save();
            }

            // දවසට දාන්න පුළුවන් ගාණ පැනලා නම් අදට පෝස්ට් කරන්නේ නැහැ
            if (ch.dailyLimit > 0 && ch.postsToday >= ch.dailyLimit) {
                continue;
            }

            const diff = (now - new Date(ch.lastPost)) / (1000 * 60); // විනාඩි වලින්

            if (diff >= ch.interval) {
                let video = null;
                
                // ලොක් කරපු TikTok පේජ් තියෙනවා නම් ඒවගෙන් ගන්නවා
                if (ch.tiktokPages && ch.tiktokPages.length > 0) {
                    const { getTikTokVideoFromUsers } = require('./tiktok');
                    video = await getTikTokVideoFromUsers(ch.category, ch.tiktokPages);
                } else {
                    // නැත්නම් සාමාන්‍ය විදිහට keywords වලින් ගන්නවා
                    video = await getTikTokVideo(ch.category, ch.keywords);
                }

                if (video) {
                    await sock.sendMessage(ch.jid, { video: { url: video.url }, caption: video.title });
                    ch.lastPost = now;
                    if (ch.dailyLimit > 0) ch.postsToday += 1;
                    await ch.save();
                    console.log(`✅ Auto Posted to ${ch.name}`);
                }
            }
        }
    });

    // --- 💬 COMMANDS ---
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // 1. .chinfo [Channel Link]
        if (text.startsWith('.chinfo ')) {
            const link = text.split(" ")[1];
            if (!link || !link.includes('whatsapp.com/channel/')) {
                return sock.sendMessage(from, { text: "❌ කරුණාකර නිවැරදි WhatsApp Channel ලින්ක් එකක් දෙන්න." });
            }
            const inviteCode = link.split('channel/')[1].split('/')[0];
            try {
                const meta = await sock.newsletterMetadata("invite", inviteCode);
                let info = `📊 *Channel Information*\n\n`;
                info += `🆔 *ID:* ${meta.id}\n`;
                info += `📌 *Name:* ${meta.name}\n`;
                info += `👥 *Subscribers:* ${meta.subscribers || 'N/A'}\n`;
                info += `📝 *Description:* ${meta.description || 'N/A'}\n`;
                info += `🔗 *Invite:* https://whatsapp.com/channel/${inviteCode}\n`;
                
                await sock.sendMessage(from, { text: info });
            } catch (e) {
                await sock.sendMessage(from, { text: "❌ චැනල් එකේ විස්තර ගන්න බැරි වුණා. ලින්ක් එක හරිද බලන්න." });
            }
        }

        // 2. .locktiktok [Channel JID] [Daily Limit] [TikTok Usernames]
        if (text.startsWith('.locktiktok ')) {
            const parts = text.split(" ");
            if (parts.length < 4) return sock.sendMessage(from, { text: "⚠️ භාවිතය: .locktiktok [channel_jid] [daily_limit] [tiktok_user1,user2,...]" });
            
            const targetJid = parts[1];
            const limit = parseInt(parts[2]);
            const pages = parts[3].split(",");

            let ch = await Channel.findOne({ jid: targetJid });
            if (!ch) {
                ch = new Channel({ jid: targetJid, name: 'Locked Channel', category: 'locked_' + targetJid, interval: 30 });
            }
            
            ch.tiktokPages = pages;
            ch.dailyLimit = limit;
            ch.isActive = true;
            await ch.save();

            await sock.sendMessage(from, { text: `✅ චැනල් එක ලොක් කළා!\n🆔 ID: ${targetJid}\n📈 දවසකට වීඩියෝ: ${limit}\n👤 TikTok Pages: ${pages.join(", ")}` });
        }

        // 3. .addct [Category] [Interval] [Keywords...]
        // උදා: .addct songs 30 සින්දු,sl_songs,trending
        if (text.startsWith('.addct')) {
            const parts = text.split(" ");
            if (parts.length < 4) return sock.sendMessage(from, { text: "⚠️ භාවිතය: .addct [category] [minutes] [keywords,split,by,comma]" });
            
            const category = parts[1];
            const interval = parseInt(parts[2]);
            const keywords = parts.slice(3).join(" ").split(",");

            await Channel.findOneAndUpdate(
                { jid: from },
                { jid: from, name: category, category, interval, keywords, isActive: true },
                { upsert: true }
            );
            await sock.sendMessage(from, { text: `✅ '${category}' පෝස්ටර් එක සක්‍රිය කළා!\n⏰ කාලය: විනාඩි ${interval}\n🔑 Keywords: ${keywords.join(", ")}` });
        }

        // 4. .tiktok [URL] (Download TikTok Video/Images)
        if (text.startsWith('.tiktok ') || text.startsWith('.tt ')) {
            const url = text.split(" ")[1];
            if (!url) return sock.sendMessage(from, { text: "❌ කරුණාකර TikTok ලින්ක් එකක් දෙන්න." });

            await sock.sendMessage(from, { text: "⏳ ඩවුන්ලෝඩ් වෙමින් පවතී..." });
            const info = await getTikTokInfo(url);
            
            if (!info) return sock.sendMessage(from, { text: "❌ වීඩියෝව සොයාගත නොහැක." });

            const caption = `🎬 *${info.title}*\n\n👤 Author: ${info.author}\n👁️ Views: ${formatNumber(info.views)} | ❤️ Likes: ${formatNumber(info.likes)}\n💬 Comments: ${formatNumber(info.comments)} | 🔗 Shares: ${formatNumber(info.shares)}\n\n> Powered by Syntiox`;

            if (info.images && info.images.length > 0) {
                // Image post
                for (let i = 0; i < info.images.length; i++) {
                    await sock.sendMessage(from, { image: { url: info.images[i] }, caption: i === 0 ? caption : "" });
                }
                // Send audio as well
                if (info.musicUrl) {
                    await sock.sendMessage(from, { audio: { url: info.musicUrl }, mimetype: 'audio/mp4' });
                }
            } else if (info.videoUrl) {
                // Video post
                await sock.sendMessage(from, { video: { url: info.videoUrl }, caption: caption });
            } else {
                await sock.sendMessage(from, { text: "❌ මෙය ඩවුන්ලෝඩ් කළ නොහැක." });
            }
        }

        // 5. .tkaudio [URL] (Download TikTok Audio)
        if (text.startsWith('.tkaudio ') || text.startsWith('.tta ')) {
            const url = text.split(" ")[1];
            if (!url) return sock.sendMessage(from, { text: "❌ කරුණාකර TikTok ලින්ක් එකක් දෙන්න." });

            await sock.sendMessage(from, { text: "⏳ ඔඩියෝ එක ඩවුන්ලෝඩ් වෙමින් පවතී..." });
            const info = await getTikTokInfo(url);
            
            if (!info || !info.musicUrl) return sock.sendMessage(from, { text: "❌ ඔඩියෝ එක සොයාගත නොහැක." });

            await sock.sendMessage(from, { 
                audio: { url: info.musicUrl }, 
                mimetype: 'audio/mp4',
                ptt: false 
            });
        }

        // 6. .delct (චැනල් එකේ ඔටෝ පෝස්ට් නවත්තන්න)
        if (text === '.delct') {
            await Channel.findOneAndDelete({ jid: from });
            await sock.sendMessage(from, { text: "🛑 ඔටෝ පෝස්ට් පද්ධතිය ඉවත් කළා." });
        }

        // 7. .status (බොට්ගේ විස්තර)
        if (text === '.status') {
            const count = await Channel.countDocuments();
            const active = await Channel.find({ isActive: true });
            let status = `📊 *Syntiox Bot Status*\n\n🔹 සක්‍රිය චැනල් ගණන: ${count}\n\n`;
            active.forEach(c => status += `📍 ${c.name} (${c.interval} min)\n`);
            await sock.sendMessage(from, { text: status });
        }

        if (text === '.jid') await sock.sendMessage(from, { text: `Chat ID: ${from}` });
    });
}

startBot();
