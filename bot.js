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
    return {
      text: 'Послание скоро появится 🤍',
      image: null
    };
  }

  return arr[Math.floor(Math.random() * arr.length)];
}

function sendOneMessage(chatId, message) {
  if (message.image) {
    return bot.sendPhoto(
      chatId,
      fs.createReadStream(message.image),
      {
        caption: message.text
      }
    );
  }

  return bot.sendMessage(chatId, message.text);
}

function sendMessageToAll(type) {
  const subscribers = loadSubscribers();
  const message = getRandomMessage(type);

  console.log(
    `[${new Date().toISOString()}] Sending ${type}: ${message.text}`
  );

  subscribers.forEach((chatId) => {
    sendOneMessage(chatId, message).catch((error) => {
      console.error(`Ошибка для ${chatId}:`, error.message);
    });
  });
}

bot.onText(/\/start/, (msg) => {
  addSubscriber(msg.chat.id);

  bot.sendMessage(
    msg.chat.id,
    'Добро пожаловать в бережное пространство 🤍\n\nПозволь мне мягко возвращать тебя к себе, своему телу и чувственности.'
  );
});

bot.onText(/\/test/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Бот работает 🤍');
});

bot.onText(/\/evening/, (msg) => {
  const message = getRandomMessage('evening');

  sendOneMessage(msg.chat.id, message).catch((error) => {
    console.error('Ошибка /evening:', error.message);
  });
});

cron.schedule(
  '0 8 * * *',
  () => {
    sendMessageToAll('morning');
  },
  { timezone }
);

cron.schedule(
  '0 14 * * *',
  () => {
    sendMessageToAll('day');
  },
  { timezone }
);

cron.schedule(
  '0 22 * * *',
  () => {
    sendMessageToAll('evening');
  },
  { timezone }
);

console.log('Bot started...');
console.log(`Timezone: ${timezone}`);