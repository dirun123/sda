const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage, generateWAMessageFromContent, proto } = require('sandes-baileys-v2'); 

const ADMIN_NUMBER = "94740798233@s.whatsapp.net"; 
const ordersFilePath = path.join(__dirname, 'active_orders.json');

function getOrders() {
    try {
        if (fs.existsSync(ordersFilePath)) {
            return JSON.parse(fs.readFileSync(ordersFilePath, 'utf8'));
        }
    } catch (error) { console.error("JSON Read Error:", error); }
    return {}; 
}

function saveOrders(data) {
    try {
        fs.writeFileSync(ordersFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) { console.error("JSON Write Error:", error); }
}

async function handleSmartFilter(sock, msg, from, text) {
    try {
        let cleanText = text ? text.trim() : "";
        let lowerText = cleanText.toLowerCase();
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000; 

        let buttonId = null;
        if (msg.message?.interactiveResponseMessage) {
            const responseJson = JSON.parse(msg.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
            buttonId = responseJson.id;
        } else if (msg.message?.templateButtonReplyMessage) {
            buttonId = msg.message.templateButtonReplyMessage.selectedId;
        }

        let activeOrders = getOrders();
        let jsonUpdated = false;

        for (const number in activeOrders) {
            if (now - activeOrders[number].timestamp > ONE_HOUR) {
                delete activeOrders[number]; 
                jsonUpdated = true;
            }
        }

        // ---------------------------------------------------------
        // 1. ADMIN ACTIONS (ඇඩ්මින්ගේ බටන් සහ රිප්ලයි)
        // ---------------------------------------------------------
        if (from === ADMIN_NUMBER) {
            
            if (buttonId) {
                if (buttonId.startsWith('admin_acc_')) {
                    const targetNumber = buttonId.replace('admin_acc_', '');
                    const userJid = `${targetNumber}@s.whatsapp.net`;
                    
                    if (activeOrders[userJid] && activeOrders[userJid].status === 'under_review') {
                        await sock.sendMessage(userJid, { text: "✅ *Payment එක තහවුරු කළා!*\n\nඔයාගේ Order එක සාර්ථකව සම්පූර්ණ කරලා තියෙන්නේ. ඉක්මනින්ම Top-up එක ලැබෙයි. ස්තූතියි! 💎❤️" });
                        await sock.sendMessage(ADMIN_NUMBER, { text: `✅ User (+${targetNumber}) ගේ Order එක Accept කළා.` }, { quoted: msg });
                        delete activeOrders[userJid];
                        saveOrders(activeOrders);
                    } else {
                        await sock.sendMessage(ADMIN_NUMBER, { text: "⚠️ මේ Order එක කලින්ම Process කරලා හෝ Cancel වෙලා තියෙන්නේ." }, { quoted: msg });
                    }
                    return true;
                }

                if (buttonId.startsWith('admin_rej_')) {
                    const targetNumber = buttonId.replace('admin_rej_', '');
                    const userJid = `${targetNumber}@s.whatsapp.net`;
                    
                    if (activeOrders[userJid] && activeOrders[userJid].status === 'under_review') {
                        activeOrders[userJid].adminState = 'waiting_for_reason';
                        saveOrders(activeOrders);
                        
                        // ✍️ ඇඩ්මින්ට රිජෙක්ට් හේතුව ගහන්න රිප්ලයි බොක්ස් එකක් වගේ හදන තැන
                        await sock.sendMessage(ADMIN_NUMBER, { text: `⚠️ *User (+${targetNumber}) ප්‍රතික්ෂේප කිරීම.*\n\n✍️ කරුණාකර Reject කිරීමට හේතුව *මෙම මැසේජ් එකට Reply කරලා* යවන්න.` }, { quoted: msg });
                    } else {
                        await sock.sendMessage(ADMIN_NUMBER, { text: "⚠️ මේ Order එක කලින්ම Process කරලා හෝ Cancel වෙලා තියෙන්නේ." }, { quoted: msg });
                    }
                    return true;
                }
            }

            // ✍️ ඇඩ්මින් Reply කරපු හේතුව අල්ලගන්න තැන
            const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg && cleanText && !buttonId) {
                const quotedText = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || "";
                const match = quotedText.match(/User\s*\(\+(\d+)\)\s*ප්‍රතික්ෂේප කිරීම/);
                
                if (match) {
                    const targetNumber = match[1];
                    const userJid = `${targetNumber}@s.whatsapp.net`;
                    
                    if (activeOrders[userJid] && activeOrders[userJid].adminState === 'waiting_for_reason') {
                        const reason = cleanText; // ඔයා Type කරපු හේතුව
                        const rejectMsg = `❌ *ඔයාගේ Order එක ප්‍රතික්ෂේප කළා!*\n\n*හේතුව:* ${reason}\n\nකරුණාකර නිවැරදි රිසිට් එකක් මෙතනට එවන්න.`;
                        
                        await sock.sendMessage(userJid, { text: rejectMsg });
                        await sock.sendMessage(ADMIN_NUMBER, { text: `✅ User (+${targetNumber}) ට හේතුව එක්ක Reject මැසේජ් එක යැව්වා.` });
                        
                        activeOrders[userJid].status = 'waiting_for_receipt';
                        delete activeOrders[userJid].adminState;
                        activeOrders[userJid].timestamp = Date.now(); 
                        saveOrders(activeOrders);
                        return true;
                    }
                }
            }
        }

        // ---------------------------------------------------------
        // 2. USER ORDER PROCESS FLOW
        // ---------------------------------------------------------
        if (activeOrders[from]) {
            const session = activeOrders[from];

            if (buttonId === 'confirm_yes' || buttonId === 'confirm_no') {
                if (session.status !== 'pending') {
                    await sock.sendMessage(from, { text: "⚠️ ඔයා මේ Order එකට කලින්ම රිප්ලයි කරලා ඉවරයි!" }, { quoted: msg });
                    return true;
                }
                lowerText = buttonId === 'confirm_yes' ? '1' : '2';
            }

            if (session.status === 'pending') {
                if (lowerText === '1') {
                    await sock.sendMessage(from, { text: "✅ ඔයාගේ Order එක Confirm කළා!\n\nකරුණාකර Payment එක කරලා *බැංකු රිසිට් එකේ ෆොටෝ එකක් (Screenshot)* මෙතනට එවන්න." });
                    session.status = 'waiting_for_receipt'; 
                    jsonUpdated = true;
                } else if (lowerText === '2') {
                    await sock.sendMessage(from, { text: "❌ ඔයාගේ Order එක Cancel කළා." });
                    session.status = 'cancelled';
                    jsonUpdated = true;
                } else {
                    await sock.sendMessage(from, { text: "⚠️ කරුණාකර Menu එකෙන් තේරීමක් කරන්න." }, { quoted: msg });
                }
                
                if (jsonUpdated) saveOrders(activeOrders);
                return true; 
            } 
            
            else if (session.status === 'waiting_for_receipt') {
                const imageMsg = msg.message?.imageMessage || 
                                 msg.message?.viewOnceMessageV2?.message?.imageMessage || 
                                 msg.message?.viewOnceMessage?.message?.imageMessage;
                const docMsg = msg.message?.documentMessage;
                const mediaMsg = imageMsg || (docMsg?.mimetype?.includes('image') ? docMsg : null);

                if (mediaMsg) {
                    try {
                        const stream = await downloadContentFromMessage(mediaMsg, imageMsg ? 'image' : 'document');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

                        const actualNumber = session.userJid ? session.userJid.split('@')[0] : from.split('@')[0];
                        const adminCaption = `🚨 *SYNTIOX නව රිසිට් පතක්!* 🚨\n\n` +
                                             `👤 *Customer:* +${actualNumber}\n\n` +
                                             `📋 *Order විස්තරය:*\n${session.orderDetails}\n\n` +
                                             `_පහළින් ඇති බොත්තමකින් තීරණයක් ගන්න._ 👇`;

                        await sock.sendMessage(ADMIN_NUMBER, { image: buffer, caption: "👇 *Customer එව්ව Payment රිසිට් එක* 👇" });
                        
                        const adminInteractive = generateWAMessageFromContent(ADMIN_NUMBER, {
                            viewOnceMessage: {
                                message: {
                                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                                    interactiveMessage: proto.Message.InteractiveMessage.create({
                                        body: proto.Message.InteractiveMessage.Body.create({ text: adminCaption }),
                                        footer: proto.Message.InteractiveMessage.Footer.create({ text: "Syntiox Admin Panel" }),
                                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                            buttons: [
                                                { "name": "quick_reply", "buttonParamsJson": `{"display_text":"✅ Accept (හරි)","id":"admin_acc_${actualNumber}"}` },
                                                { "name": "quick_reply", "buttonParamsJson": `{"display_text":"❌ Reject (අවුල්)","id":"admin_rej_${actualNumber}"}` }
                                            ]
                                        })
                                    })
                                }
                            }
                        }, {});
                        await sock.relayMessage(ADMIN_NUMBER, adminInteractive.message, { messageId: adminInteractive.key.id });

                        await sock.sendMessage(from, { text: "✅ රිසිට් එක ලැබුණා! අපි මේක පරීක්ෂා කරලා ඉක්මනින් Top-up එක දානවා. ❤️" }, { quoted: msg });

                        session.status = 'under_review';
                        jsonUpdated = true;
                    } catch (err) {
                        await sock.sendMessage(from, { text: "⚠️ රිසිට් එක කියවන්න බැරි වුණා. කරුණාකරලා ආයෙත් පැහැදිලිව ෆොටෝ එක එවන්න." }, { quoted: msg });
                    }
                } else {
                    await sock.sendMessage(from, { text: "⚠️ කරුණාකර Payment රිසිට් එක ෆොටෝ එකක් විදියට පමණක් එවන්න." }, { quoted: msg });
                }

                if (jsonUpdated) saveOrders(activeOrders);
                return true;
            }
        } 

        // ---------------------------------------------------------
        // 3. NEW ORDER DETECTION 
        // ---------------------------------------------------------
        if (text && text.includes("SYNTIOX NEW ORDER")) {
            
            // ඔයාගේ අලුත් ෆෝමැට් එකට ගැලපෙන්න Total එක අල්ලනවා
            const totalMatch = text.match(/\*💰 Total:\*\s*([^\n]+)/);
            const totalAmount = totalMatch ? totalMatch[1].trim() : "N/A";

            const imageUrl = "https://i.ibb.co/Fqkx25c5/balloon-Minimalist-Desktop-Wallpaper-1.png"; 
            await sock.sendMessage(from, { image: { url: imageUrl } }, { quoted: msg });

            const menuParams = {
                title: "තෝරන්න (Select Options) 🛒",
                sections: [{
                    title: "ඔඩර් එක කන්ෆර්ම් කරනවද?",
                    rows: [
                        { header: "", title: "✅ ඔව් (Confirm Order)", id: "confirm_yes", description: "Payment එක කරනවා" },
                        { header: "", title: "❌ නැහැ (Cancel Order)", id: "confirm_no", description: "මේ Order එක එපා" }
                    ]
                }]
            };

            const interactiveMessage = generateWAMessageFromContent(from, {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                            body: proto.Message.InteractiveMessage.Body.create({ text: `💰 *මුළු මුදල:* ${totalAmount}\n\nඔයා මේ ඔඩර් එක කන්ෆර්ම් කරනවද?\nපහළින් ඇති මෙනුවෙන් තෝරන්න. 👇` }),
                            footer: proto.Message.InteractiveMessage.Footer.create({ text: "Powered by Syntiox" }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    { "name": "single_select", "buttonParamsJson": JSON.stringify(menuParams) }
                                ]
                            })
                        })
                    }
                }
            }, { quoted: msg });

            await sock.relayMessage(from, interactiveMessage.message, { messageId: interactiveMessage.key.id });

            const realJid = msg.key.participant || from; 
            const activeLid = msg.senderLid || from; 

            activeOrders[from] = { 
                timestamp: now, 
                status: 'pending',
                orderDetails: text,
                userLid: activeLid,  
                userJid: realJid,    
                adminJid: ADMIN_NUMBER 
            };
            saveOrders(activeOrders);

            return true; 
        }

        return false;

    } catch (error) {
        console.error("Smart Filter Error:", error);
        return false;
    }
}

module.exports = { handleSmartFilter };