# Syntiox WhatsApp Auto-Poster Bot 🤖

මෙය WhatsApp Channels සඳහා TikTok වීඩියෝ ස්වයංක්‍රීයව (Auto-post) පෝස්ට් කිරීමට සහ TikTok වීඩියෝ/ඔඩියෝ ඩවුන්ලෝඩ් කිරීමට සෑදූ විශේෂ WhatsApp Bot එකකි.

## 🌟 Features (පහසුකම්)

*   **Auto-Post to Channels**: ඔයා දෙන Keywords වලට අදාළ TikTok වීඩියෝ හොයාගෙන නියමිත වෙලාවට චැනල් එකට පෝස්ට් කිරීම.
*   **Lock TikTok Pages**: චැනල් එකකට දවසකට දාන වීඩියෝ ගාණ (Daily Limit) සීමා කරලා, ඔයා කැමති TikTok පේජ් වලින් විතරක් වීඩියෝ වැටෙන්න හැදීම.
*   **TikTok Downloader**: TikTok ලින්ක් එකක් දුන්නම ඒකේ වීඩියෝ එක, ෆොටෝස් (Slideshows) සහ ඔඩියෝ එක ඩවුන්ලෝඩ් කරලා දීම.
*   **Channel Info**: ඕනෑම WhatsApp චැනල් එකක ලින්ක් එකක් දුන්නම ඒකේ ID එක, නම, Subscribers ගාණ වගේ විස්තර අරන් දීම.
*   **MongoDB Session**: WhatsApp සෙෂන් එක MongoDB ඩේටාබේස් එකක සේව් වෙන නිසා බොට්ව රීස්ටාට් කළත් ආයේ QR ස්කෑන් කරන්න ඕනේ නැහැ.

## 🛠️ Commands (කමාන්ඩ්ස්)

*   `.addct [category] [minutes] [keywords]` - චැනල් එකකට ඔටෝ පෝස්ට් වෙන්න සෙට් කිරීම. (උදා: `.addct songs 30 trending,music`)
*   `.locktiktok [channel_jid] [daily_limit] [tiktok_user1,user2]` - චැනල් එකකට TikTok පේජ් ලොක් කිරීම සහ දවසකට දාන ගාණ සීමා කිරීම.
*   `.delct` - චැනල් එකේ ඔටෝ පෝස්ට් වෙන එක නවත්වන්න.
*   `.tiktok [url]` හෝ `.tt [url]` - TikTok වීඩියෝවක් හෝ ෆොටෝස් ඩවුන්ලෝඩ් කරන්න.
*   `.tkaudio [url]` හෝ `.tta [url]` - TikTok ඔඩියෝ එකක් ඩවුන්ලෝඩ් කරන්න.
*   `.chinfo [channel_link]` - WhatsApp චැනල් එකක විස්තර බලාගන්න.
*   `.status` - දැනට බොට් ඇක්ටිව් වෙලා තියෙන චැනල් විස්තර බලාගන්න.
*   `.jid` - දැනට ඉන්න Chat එකේ හෝ Channel එකේ ID එක බලාගන්න.

## 🚀 How to Start (බොට්ව රන් කරන විදිහ)

### 1. අවශ්‍ය දේවල් (Prerequisites)
*   [Node.js](https://nodejs.org/) ඉන්ස්ටෝල් කරලා තියෙන්න ඕනේ.
*   [MongoDB](https://www.mongodb.com/) ඩේටාබේස් URL එකක් තියෙන්න ඕනේ.

### 2. පැකේජ් ඉන්ස්ටෝල් කිරීම
ටර්මිනල් එකේ මේ කමාන්ඩ් එක ගහන්න:
```bash
npm install
```

### 3. Environment Variables (වැදගත්)
බොට්ව රන් කරන්න කලින් මේ දේවල් අනිවාර්යයෙන් දෙන්න ඕනේ:
*   `MONGODB_URL`: ඔයාගේ MongoDB කනෙක්ෂන් ලින්ක් එක. (උදා: `mongodb+srv://user:pass@cluster.mongodb.net/bot`)
*   `SESSION_ID`: ඔයාගේ සෙෂන් එකට නමක්. (උදා: `session-1`)
*   `PAIRING_NUMBER`: ඔයාගේ WhatsApp නම්බර් එක (රටේ කෝඩ් එකත් එක්ක, උදා: `94712345678`). මේක දුන්නම QR වෙනුවට Pairing Code එකක් එනවා.

Windows CMD එකේ නම්:
```cmd
set MONGODB_URL=your_mongodb_url
set SESSION_ID=session-1
set PAIRING_NUMBER=94712345678
```
Linux/Mac/Termux එකේ නම්:
```bash
export MONGODB_URL="your_mongodb_url"
export SESSION_ID="session-1"
export PAIRING_NUMBER="94712345678"
```

### 4. බොට්ව ඔන් කිරීම
```bash
npm start
```
*මේ කමාන්ඩ් එක ගැහුවම ටර්මිනල් එකේ **QR Code** එකක් පෙන්නයි. ඔයාගේ ෆෝන් එකේ WhatsApp එකට ගිහින් Linked Devices -> Link a Device ගිහින් ඒ QR එක ස්කෑන් කරන්න.*

---

## 🐳 Docker Setup (ඩොකර් වලින් රන් කරනවා නම්)

ඔයාට VPS එකක හරි Docker තියෙන තැනක හරි රන් කරන්න ඕන නම්:

1. **Docker Image එක හදාගන්න:**
   ```bash
   docker build -t syntiox-bot .
   ```
2. **Docker Container එක රන් කරන්න:**
   (මුලින්ම QR එක ස්කෑන් කරන්න ඕන නිසා `-it` දාලා රන් කරන්න)
   ```bash
   docker run -it --name my-bot -e MONGODB_URL="your_mongodb_url" -e SESSION_ID="session-1" syntiox-bot
   ```
   QR එක ස්කෑන් කරලා කනෙක්ට් වුණාට පස්සේ, ඔයාට පුළුවන් කන්ටේනර් එක Background එකේ දුවන්න දෙන්න.
