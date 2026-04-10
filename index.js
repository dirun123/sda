const { 
    default: makeWASocket, 
    fetchLatestBaileysVersion, 
    useMultiFileAuthState, 
    delay,
    DisconnectReason 
} = require('sandes-baileys-v2');

const mongoose = require('mongoose');
const pino = require('pino');
const cron = require('node-cron');
const express = require('express');
const { useMongoDBAuthState } = require('./mongoAuth');
const { Channel } = require('./models');
const { getTikTokVideo, getTikTokInfo, formatNumber, getTikTokVideoFromUsers } = require('./tiktok');
const QRCode = require('qrcode');

const app = express();
let qrCodeImage = null;
const port = 8000;

// --- 🌐 SERVER SETUP ---
app.get('/', (req, res) => res.send('Syntiox Bot is running! 🚀'));
app.get('/qr', async (req, res) => {
    if (!qrCodeImage) return res.send("<h1>QR Code එක ලැබී නැත. Refresh කරන්න.</h1>");
    res.send(`<html><body style="background: #f0f2f5; display: flex; align-items: center; justify-content: center; height: 100vh;"><img src="${qrCodeImage}" style="width: 300px; height: 300px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);"/></body></html>`);
});
app.get('/logout', async (req, res) => {
    try {
        await mongoose.connection.db.collection('auths').deleteMany({ id: process.env.SESSION_ID });
        res.send("<h1>Session Cleared!</h1>");
        process.exit(0);
    } catch (err) { res.send(err.message); }
});
app.listen(port, () => console.log(`🌍 Server on port ${port}`));

// --- 🤖 BOT LOGIC ---
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
            return { conversation: "Hello" };
        },
        msgRetryCounterCache: new Map(),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (up) => {
        const { connection, lastDisconnect, qr } = up;
        if (qr) qrCodeImage = await QRCode.toDataURL(qr);
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconnecting...");
                setTimeout(startBot, 5000);
            }
        } else if (connection === 'open') {
            qrCodeImage = null;
            console.log('✅ Syntiox Bot Live!');
        }
    });

    // --- 🕒 AUTO POSTER SCHEDULER ---
    cron.schedule('*/5 * * * *', async () => {
        const channels = await Channel.find({ isActive: true, tiktokPages: { $exists: true, $not: { $size: 0 } } });
        for (const ch of channels) {
            const now = new Date();
            if (now.getDate() !== new Date(ch.lastReset).getDate()) {
                ch.postsToday = 0; ch.lastReset = now; await ch.save();
            }
            if (ch.dailyLimit > 0 && ch.postsToday >= ch.dailyLimit) continue;
            if ((now - new Date(ch.lastPost)) / (1000 * 60) >= ch.interval) {
                let video = await getTikTokVideoFromUsers(ch.category, ch.tiktokPages);
                if (video) {
                    await sock.sendMessage(ch.jid, { video: { url: video.url }, caption: video.title });
                    ch.lastPost = now; ch.postsToday += 1; await ch.save();
                }
            }
        }
    });

    // --- 💬 COMMANDS & LINK DETECTION ---
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const sender = msg.key.participant || from;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        // 1. TikTok Auto-Forwarder (Prefix නැතිව උඹට විතරක් වැඩ කරයි)
        const isTiktok = text.match(/(https?:\/\/vm\.tiktok\.com\/|https?:\/\/www\.tiktok\.com\/|https?:\/\/vt\.tiktok\.com\/)/gi);
        if (isTiktok) {
            const config = await Channel.findOne({ category: 'manual_forward_' + sender });
            if (config) {
                const info = await getTikTokInfo(isTiktok[0].split(" ")[0]);
                if (info?.videoUrl) {
                    await sock.sendMessage(config.jid, { video: { url: info.videoUrl }, caption: `🎬 *${info.title}*\n\n> Shared via Syntiox` });
                }
                return;
            }
        }

        // 2. Commands (Must start with /)
        if (!text.startsWith('/')) return;
        const args = text.split(" ");
        const command = args[0].toLowerCase();

        // /setup [Channel_JID]
        if (command === '/setup') {
            const targetJid = args[1];
            if (!targetJid || !targetJid.includes('@')) return sock.sendMessage(from, { text: "❌ JID එක වැරදියි!" });
            await Channel.findOneAndUpdate(
                { category: 'manual_forward_' + sender },
                { jid: targetJid, name: 'Manual Link Forwarder', isActive: true, category: 'manual_forward_' + sender },
                { upsert: true }
            );
            return sock.sendMessage(from, { text: `✅ උඹේ නම්බර් එක ${targetJid} ට ලොක් කළා!` });
        }

        // /locktiktok [JID] [Limit] [Pages]
        if (command === '/locktiktok') {
            if (args.length < 4) return sock.sendMessage(from, { text: "⚠️ /locktiktok [jid] [limit] [user1,user2]" });
            const jid = args[1], limit = parseInt(args[2]), pages = args[3].split(",");
            await Channel.findOneAndUpdate({ jid }, { jid, dailyLimit: limit, tiktokPages: pages, isActive: true, category: 'locked_' + jid, interval: 30 }, { upsert: true });
            return sock.sendMessage(from, { text: "✅ චැනල් එක ලොක් කළා!" });
        }

        // /addct [Category] [Interval] [Keywords]
        if (command === '/addct') {
            if (args.length < 4) return sock.sendMessage(from, { text: "⚠️ /addct [category] [min] [key1,key2]" });
            const cat = args[1], interval = parseInt(args[2]), keywords = args.slice(3).join(" ").split(",");
            await Channel.findOneAndUpdate({ jid: from }, { jid: from, name: cat, category: cat, interval, keywords, isActive: true }, { upsert: true });
            return sock.sendMessage(from, { text: `✅ '${cat}' පෝස්ටර් එක සක්‍රිය කළා!` });
        }

        // /tiktok [URL]
        if (command === '/tiktok' || command === '/tt') {
            if (!args[1]) return;
            const info = await getTikTokInfo(args[1]);
            if (!info) return sock.sendMessage(from, { text: "❌ වීඩියෝව හමුනොවුනි." });
            const cap = `🎬 *${info.title}*\n👤 ${info.author}\n> Syntiox`;
            if (info.images?.length > 0) {
                for (let img of info.images) await sock.sendMessage(from, { image: { url: img } });
            } else if (info.videoUrl) {
                await sock.sendMessage(from, { video: { url: info.videoUrl }, caption: cap });
            }
            return;
        }

        // /tkaudio [URL]
        if (command === '/tkaudio' || command === '/tta') {
            const info = await getTikTokInfo(args[1]);
            if (info?.musicUrl) await sock.sendMessage(from, { audio: { url: info.musicUrl }, mimetype: 'audio/mp4' });
            return;
        }

        // /chinfo [Link]
        if (command === '/chinfo') {
            const link = args[1];
            if (!link?.includes('channel/')) return;
            const code = link.split('channel/')[1];
            const meta = await sock.newsletterMetadata("invite", code);
            return sock.sendMessage(from, { text: `📊 *Channel Info*\n🆔 ${meta.id}\n📌 ${meta.name}\n👥 ${meta.subscribers}` });
        }

        // /status, /jid, /delct
        if (command === '/status') {
            const count = await Channel.countDocuments();
            return sock.sendMessage(from, { text: `📊 *Status*\n🔹 සක්‍රිය පද්ධති: ${count}` });
        }
        if (command === '/jid') return sock.sendMessage(from, { text: `🆔 JID: ${from}` });
        if (command === '/delct') {
            await Channel.findOneAndDelete({ category: 'manual_forward_' + sender });
            return sock.sendMessage(from, { text: "🛑 සෙටප් එක ඉවත් කළා." });
        }
    });
}

startBot();
