require('dotenv').config();

const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Oberezhno bot is running 🤍');
}).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});

const subscribersFile = './subscribers.json';

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

console.log('Bot started...');