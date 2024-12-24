import yahooFinance from 'yahoo-finance2';
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';

// Try to load .env file, but don't fail if it doesn't exist
dotenv.config({ silent: true });

// Get token from environment variable
const token = process.env.TELEGRAM_TOKEN;
if (!token) {
    throw new Error('TELEGRAM_TOKEN environment variable is not set');
}

const bot = new TelegramBot(token, { polling: true });

// Store last 10 requests
const requestHistory = [];
const MAX_HISTORY = 10;

async function getTickerPrice(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol);
        
        const result = {
            symbol: symbol.toUpperCase(),
            regularMarketPrice: quote.regularMarketPrice,
            preMarketPrice: quote.preMarketPrice || 'N/A',
            postMarketPrice: quote.postMarketPrice || 'N/A',
            timestamp: new Date().toISOString()
        };
        
        // Add to history
        requestHistory.unshift(result);
        if (requestHistory.length > MAX_HISTORY) {
            requestHistory.pop();
        }
        
        return result;
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        throw error;
    }
}

function formatPriceMessage(data) {
    return `**${data.symbol}**\nPrice: ${data.regularMarketPrice}\nPre-market: ${data.preMarketPrice}\nPost-market: ${data.postMarketPrice}`;
}

function formatHistoryMessage() {
    if (requestHistory.length === 0) {
        return "No requests yet";
    }
    
    return "Last 10 requests:\n\n" + [...requestHistory]
        .reverse()
        .map(data => `**${data.symbol}** ${data.regularMarketPrice} / pre ${data.preMarketPrice} / post ${data.postMarketPrice}`)
        .join('\n');
}

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    try {
        if (text === '1') {
            const historyMessage = formatHistoryMessage();
            await bot.sendMessage(chatId, historyMessage, { parse_mode: 'Markdown' });
            return;
        }

        const result = await getTickerPrice(text);
        const message = formatPriceMessage(result);
        await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        
    } catch (error) {
        await bot.sendMessage(chatId, `Error: ${error.message}`);
    }
});

console.log('Bot is running...'); 