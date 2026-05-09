require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});

bot.on('message', (msg) => {
  console.log('CHAT ID:', msg.chat.id);

  bot.sendMessage(
    msg.chat.id,
    'Обережно 🤍'
  );
});

console.log('Bot started...');