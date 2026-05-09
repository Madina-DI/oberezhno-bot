require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const messages = require('./messages.json');
const subscribers = require('./subscribers.json');

const bot = new TelegramBot(process.env.BOT_TOKEN);

const type = process.argv[2];

function getRandomMessage(type) {
  const arr = messages[type];

  if (!arr || arr.length === 0) {
    return 'Послание скоро появится 🤍';
  }

  return arr[Math.floor(Math.random() * arr.length)];
}

async function sendToAll() {
  const text = getRandomMessage(type);

  for (const chatId of subscribers) {
    try {
      await bot.sendMessage(chatId, text);
      console.log(`Sent to ${chatId}: ${text}`);
    } catch (error) {
      console.error(`Error sending to ${chatId}:`, error.message);
    }
  }
}

sendToAll();