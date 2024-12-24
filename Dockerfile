FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Start the bot
CMD ["node", "src/main.js"] 