require('dotenv').config();

const http = require('http');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const messages = require('./messages.json');

const PORT = process.env.PORT || 3000;
const timezone = 'Europe/Moscow';
const subscribersFile = './subscribers.json';

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Oberezhno bot is running 🤍');
}).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});

function loadSubscribers() {
  if (!fs.existsSync(subscribersFile)) {
    fs.writeFileSync(subscribersFile, JSON.stringify([]));
  }

  return JSON.parse(fs.readFileSync(subscribersFile));
}

function saveSubscribers(subscribers) {
  fs.writeFileSync(subscribersFile, JSON.stringify(subscribers, null, 2));
}

function addSubscriber(chatId) {
  const subscribers = loadSubscribers();

  if (!subscribers.includes(chatId)) {
    subscribers.push(chatId);
    saveSubscribers(subscribers);
  }
}

function getRandomMessage(type) {
  const arr = messages[type];

  if (!arr || arr.length === 0) {
    return 'Послание скоро появится 🤍';
  }

  return arr[Math.floor(Math.random() * arr.length)];
}

function sendMessageToAll(type) {
  const subscribers = loadSubscribers();
  const text = getRandomMessage(type);

  console.log(`[${new Date().toISOString()}] Sending ${type}: ${text}`);

  subscribers.forEach((chatId) => {
    bot.sendMessage(chatId, text).catch((error) => {
      console.error(`Ошибка для ${chatId}:`, error.message);
    });
  });
}

bot.onText(/\/start/, (msg) => {
  addSubscriber(msg.chat.id);

  bot.sendMessage(
    msg.chat.id,
    'Обережно 🤍 Ты подписана. Я буду присылать тебе послания утром, днём и вечером.'
  );
});

bot.onText(/\/test/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Бот работает 🤍');
});

bot.onText(/\/evening/, (msg) => {
  bot.sendMessage(msg.chat.id, getRandomMessage('evening'));
});

cron.schedule('0 8 * * *', () => {
  sendMessageToAll('morning');
}, { timezone });

cron.schedule('0 14 * * *', () => {
  sendMessageToAll('day');
}, { timezone });

cron.schedule('0 22 * * *', () => {
  sendMessageToAll('evening');
}, { timezone });

console.log('Bot started...');
console.log(`Timezone: ${timezone}`);