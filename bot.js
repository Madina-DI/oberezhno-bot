require('dotenv').config();

const http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const { addSubscriber, removeSubscriber, countSubscribers } = require('./src/db');
const { getRandomMessage } = require('./src/content');
const { sendOneMessage, sendMessageToAll } = require('./src/sender');

const PORT = process.env.PORT || 3000;
const timezone = 'Europe/Moscow';

const requiredEnv = ['BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_KEY'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Не заданы переменные окружения: ${missingEnv.join(', ')}`);
  process.exit(1);
}

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Oberezhno bot is running 🤍');
}).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true,
});

bot.on('polling_error', (error) => {
  if (error.message.includes('409')) {
    console.error('409: бот запущен где-то ещё (локально и на Render одновременно?)');
    return;
  }

  console.error('Ошибка polling:', error.message);
});

async function broadcast(type) {
  const message = getRandomMessage(type);

  console.log(`[${new Date().toISOString()}] Sending ${type}: ${message.text}`);

  try {
    const stats = await sendMessageToAll(bot, message);
    console.log(
      `Рассылка ${type}: всего ${stats.total}, доставлено ${stats.ok}, ` +
      `удалено ${stats.gone}, ошибок ${stats.error}`
    );
  } catch (error) {
    console.error(`Рассылка ${type} упала:`, error.message);
  }
}

// Ручная отправка одного послания тому, кто вызвал команду
async function sendPreview(chatId, type) {
  try {
    await sendOneMessage(bot, chatId, getRandomMessage(type));
  } catch (error) {
    console.error(`Ошибка /${type}:`, error.message);
  }
}

bot.onText(/^\/start\b/, async (msg) => {
  await addSubscriber(msg.chat.id);

  bot.sendMessage(
    msg.chat.id,
    'Добро пожаловать в бережное пространство 🤍\n\nПозволь мне мягко возвращать тебя к себе, своему телу и чувственности.\n\nЕсли захочешь тишины — напиши /stop.'
  );
});

bot.onText(/^\/stop\b/, async (msg) => {
  await removeSubscriber(msg.chat.id);

  bot.sendMessage(
    msg.chat.id,
    'Послания больше не будут приходить 🤍\n\nТы можешь вернуться в любой момент — просто напиши /start.'
  );
});

bot.onText(/^\/help\b/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    'Что я умею:\n\n/start — получать послания\n/stop — приостановить\n/morning, /day, /evening — послание прямо сейчас'
  );
});

bot.onText(/^\/test\b/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Бот работает 🤍');
});

bot.onText(/^\/count\b/, async (msg) => {
  const count = await countSubscribers();

  bot.sendMessage(
    msg.chat.id,
    count === null ? 'Не удалось посчитать 🤍' : `Сейчас подписано: ${count}`
  );
});

bot.onText(/^\/morning\b/, (msg) => sendPreview(msg.chat.id, 'morning'));
bot.onText(/^\/day\b/, (msg) => sendPreview(msg.chat.id, 'day'));
bot.onText(/^\/evening\b/, (msg) => sendPreview(msg.chat.id, 'evening'));

// Список команд в меню Telegram. /test и /count оставляем служебными.
bot.setMyCommands([
  { command: 'start', description: 'Получать послания' },
  { command: 'stop', description: 'Приостановить послания' },
  { command: 'morning', description: 'Утреннее послание сейчас' },
  { command: 'day', description: 'Дневное послание сейчас' },
  { command: 'evening', description: 'Вечернее послание сейчас' },
  { command: 'help', description: 'Что я умею' },
]).catch((error) => {
  console.error('Не удалось обновить меню команд:', error.message);
});

cron.schedule('0 8 * * *', () => broadcast('morning'), { timezone });
cron.schedule('0 14 * * *', () => broadcast('day'), { timezone });
cron.schedule('0 22 * * *', () => broadcast('evening'), { timezone });

process.on('unhandledRejection', (reason) => {
  console.error('Необработанная ошибка:', reason);
});

console.log('Bot started...');
console.log(`Timezone: ${timezone}`);
