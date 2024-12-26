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
let requestHistory = [];
const MAX_HISTORY = 10;

async function getTickerPrice(symbol) {
    try {
        const quote = await yahooFinance.quote(symbol);
        
        const previousClose = quote.regularMarketPreviousClose;
        const currentPrice = quote.regularMarketPrice;
        
        function calculateChange(price, basePrice) {
            if (!price || !basePrice) return 'N/A';
            const change = ((price - basePrice) / basePrice * 100).toFixed(2);
            return `${Number(change) > 0 ? '+' : ''}${change}%`;
        }
        
        const regularChange = calculateChange(currentPrice, previousClose);
        const preMarketChange = calculateChange(quote.preMarketPrice, currentPrice);
        const postMarketChange = calculateChange(quote.postMarketPrice, currentPrice);
        
        const result = {
            symbol: symbol.toUpperCase(),
            regularMarketPrice: currentPrice,
            preMarketPrice: quote.preMarketPrice || 'N/A',
            postMarketPrice: quote.postMarketPrice || 'N/A',
            changePercent: regularChange,
            preMarketChange: preMarketChange,
            postMarketChange: postMarketChange,
            timestamp: new Date().toISOString()
        };
        
        // Remove previous occurrences of this symbol
        const symbolUpper = symbol.toUpperCase();
        requestHistory = requestHistory.filter(item => item.symbol !== symbolUpper);
        
        // Add new entry at the beginning
        requestHistory.unshift(result);
        
        // Trim to MAX_HISTORY if needed
        if (requestHistory.length > MAX_HISTORY) {
            requestHistory.pop();
        }
        
        return result;
    } catch (error) {
        console.error(`Error fetching price for ${symbol}:`, error);
        throw error;
    }
}

function getChangeEmoji(changePercent) {
    if (changePercent === 'N/A') return '';
    return changePercent.startsWith('+') ? '🟩 ' : '🟥 ';
}

function formatPriceMessage(data) {
    const regularEmoji = getChangeEmoji(data.changePercent);
    const preEmoji = getChangeEmoji(data.preMarketChange);
    const postEmoji = getChangeEmoji(data.postMarketChange);
    
    const lines = [
        `**${data.symbol}**`,
        `Price: ${data.regularMarketPrice} ${regularEmoji}${data.changePercent}`
    ];

    if (data.preMarketPrice !== 'N/A') {
        lines.push(`Pre-market: ${data.preMarketPrice} ${preEmoji}${data.preMarketChange}`);
    }
    
    if (data.postMarketPrice !== 'N/A') {
        lines.push(`Post-market: ${data.postMarketPrice} ${postEmoji}${data.postMarketChange}`);
    }

    return lines.join('\n');
}

function formatHistoryMessage() {
    if (requestHistory.length === 0) {
        return "No requests yet";
    }
    
    return "Last 10 requests:\n\n" + [...requestHistory]
        .reverse()
        .map(data => {
            const regularEmoji = getChangeEmoji(data.changePercent);
            const preChange = data.preMarketPrice !== 'N/A' ? ` ${data.preMarketPrice} ${getChangeEmoji(data.preMarketChange)}${data.preMarketChange}` : '';
            const postChange = data.postMarketPrice !== 'N/A' ? ` ${data.postMarketPrice} ${getChangeEmoji(data.postMarketChange)}${data.postMarketChange}` : '';
            
            return `**${data.symbol}** ${data.regularMarketPrice} ${regularEmoji}${data.changePercent}` + 
                   (data.preMarketPrice !== 'N/A' ? ` / pre:${preChange}` : '') +
                   (data.postMarketPrice !== 'N/A' ? ` / post:${postChange}` : '');
        })
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