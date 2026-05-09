require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const messages = require('./messages.json');

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});

const chatId = process.env.CHAT_ID;

function getRandomMessage(type) {
  const arr = messages[type];
  return arr[Math.floor(Math.random() * arr.length)];
}

function sendMessage(type) {
  const text = getRandomMessage(type);
  bot.sendMessage(chatId, text);
}

// /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Обережно 🤍 Я буду присылать тебе послания утром, днём и вечером.');
});

// тестовая команда
bot.onText(/\/test/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Бот работает 🤍');
});

// утро — 08:00
cron.schedule('0 8 * * *', () => {
  sendMessage('morning');
}, {
  timezone: 'Europe/Moscow'
});

// день — 14:00
cron.schedule('0 14 * * *', () => {
  sendMessage('day');
}, {
  timezone: 'Europe/Moscow'
});

// вечер — 22:00
cron.schedule('0 22 * * *', () => {
  sendMessage('evening');
}, {
  timezone: 'Europe/Moscow'
});

console.log('Bot started...');