require('dotenv').config();

const http = require('http');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const { createClient } = require('@supabase/supabase-js');
const messages = require('./messages.json');

const PORT = process.env.PORT || 3000;
const timezone = 'Europe/Moscow';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Oberezhno bot is running 🤍');
}).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});

async function loadSubscribers() {
  const { data, error } = await supabase
    .from('subscribers')
    .select('chat_id');

  if (error) {
    console.error('Ошибка загрузки подписчиков:', error.message);
    return [];
  }

  return data.map((item) => item.chat_id);
}

async function addSubscriber(chatId) {
  const { data: existing, error: selectError } = await supabase
    .from('subscribers')
    .select('chat_id')
    .eq('chat_id', chatId)
    .maybeSingle();

  if (selectError) {
    console.error('Ошибка проверки подписчика:', selectError.message);
    return;
  }

  if (existing) {
    console.log(`Subscriber already exists: ${chatId}`);
    return;
  }

  const { error: insertError } = await supabase
    .from('subscribers')
    .insert([{ chat_id: chatId }]);

  if (insertError) {
    console.error('Ошибка добавления подписчика:', insertError.message);
    return;
  }

  console.log(`New subscriber added: ${chatId}`);
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
    return bot.sendPhoto(chatId, fs.createReadStream(message.image), {
      caption: message.text
    });
  }

  return bot.sendMessage(chatId, message.text);
}

async function sendMessageToAll(type) {
  const subscribers = await loadSubscribers();
  const message = getRandomMessage(type);

  console.log(
    `[${new Date().toISOString()}] Sending ${type}: ${message.text}`
  );
  console.log(`Subscribers count: ${subscribers.length}`);
  console.log('Subscribers:', subscribers)

  subscribers.forEach((chatId) => {
    sendOneMessage(chatId, message).catch((error) => {
      console.error(`Ошибка для ${chatId}:`, error.message);
    });
  });
}

bot.onText(/\/start/, async (msg) => {
  await addSubscriber(msg.chat.id);

  bot.sendMessage(
    msg.chat.id,
    'Добро пожаловать в бережное пространство 🤍\n\nПозволь мне мягко возвращать тебя к себе, своему телу и чувственности.'
  );
});

bot.onText(/\/test/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Бот работает 🤍');
});

bot.onText(/\/count/, async (msg) => {
  const subscribers = await loadSubscribers();

  bot.sendMessage(
    msg.chat.id,
    `Сейчас подписано: ${subscribers.length}`
  );
});

bot.onText(/\/evening/, (msg) => {
  const message = getRandomMessage('evening');

  sendOneMessage(msg.chat.id, message).catch((error) => {
    console.error('Ошибка /evening:', error.message);
  });
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