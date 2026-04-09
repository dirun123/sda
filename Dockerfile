FROM node:24-alpine

# වැඩ කරන folder එක හදාගන්න
WORKDIR /app

# මුලින්ම package files ටික කොපි කරගමු
COPY package*.json ./

# Dependencies ටික ඉන්ස්ටල් කරමු
RUN npm install

# ඉතිරි code ටික ඔක්කොම කොපි කරමු
COPY . .

# index.js රන් කරන්න
CMD ["node", "index.js"]
