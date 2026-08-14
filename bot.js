require('dotenv').config();

const http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const {
  addSubscriber,
  removeSubscriber,
  countSubscribers,
  sourceBreakdown,
} = require('./src/db');
const { getNextMessage, deckStatus } = require('./src/content');
const { sendOneMessage, sendMessageToAll } = require('./src/sender');
const { setAnswer, getAnswer, countToday } = require('./src/mood');
const {
  lastAskedIndex,
  findOption,
  randomFreeTextReply,
  welcome,
} = require('./src/questions');
const { withQuestion, withEveningIntro, withLinkButton } = require('./src/format');

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
  const message = getNextMessage(type);

  console.log(`[${new Date().toISOString()}] Sending ${type}: ${message.text}`);

  let payload = message;

  if (type === 'morning') {
    payload = withQuestion(message);
  } else if (type === 'evening') {
    console.log(`Ответили утром: ${countToday()}`);
    payload = (chatId) => withLinkButton(withEveningIntro(message, chatId));
  } else {
    payload = withLinkButton(message);
  }

  try {
    const stats = await sendMessageToAll(bot, payload);
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
  const message = getNextMessage(type);

  try {
    if (type === 'morning') {
      await sendOneMessage(bot, chatId, withQuestion(message));
    } else if (type === 'evening') {
      await sendOneMessage(bot, chatId, withLinkButton(withEveningIntro(message, chatId)));
    } else {
      await sendOneMessage(bot, chatId, withLinkButton(message));
    }
  } catch (error) {
    console.error(`Ошибка /${type}:`, error.message);
  }
}

bot.on('callback_query', (query) => {
  const match = /^q:(\d+):(\d+)$/.exec(query.data || '');

  if (!match) return;

  const questionIndex = Number(match[1]);
  const optionIndex = Number(match[2]);
  const chatId = query.message.chat.id;
  const option = findOption(questionIndex, optionIndex);

  if (!option) return;

  setAnswer(chatId, questionIndex, optionIndex);
  console.log(`Ответ на утренний вопрос: ${chatId} → ${option.label}`);

  bot.answerCallbackQuery(query.id).catch(() => {});

  // убираем кнопки, чтобы ответить можно было только один раз
  bot.editMessageReplyMarkup(
    { inline_keyboard: [] },
    { chat_id: chatId, message_id: query.message.message_id }
  ).catch(() => {});

  if (option.ack) {
    bot.sendMessage(chatId, option.ack).catch((error) => {
      console.error('Ошибка отклика:', error.message);
    });
  }
});

// Если написала своими словами, а не кнопкой — не молчим в ответ.
// Сам текст не сохраняем и не логируем: это её личное.
bot.on('message', (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const alreadyAnswered = getAnswer(chatId);
  const question = lastAskedIndex();

  // Записываем сам факт ответа, чтобы вечером откликнуться. Если она уже
  // нажала кнопку, оставляем тот ответ — он точнее.
  if (!alreadyAnswered && question !== null) {
    setAnswer(chatId, question, null);
  }

  console.log(`Свободный ответ от ${chatId}`);

  bot.sendMessage(chatId, randomFreeTextReply()).catch((error) => {
    console.error('Ошибка ответа на сообщение:', error.message);
  });
});

// Метка из ссылки вида t.me/oberezhno_women_bot?start=reels — так видно,
// откуда пришла женщина. Telegram разрешает буквы, цифры, дефис и подчёркивание.
function parseSource(text) {
  const match = /^\/start(?:@\S+)?\s+(\S+)/.exec(text || '');

  if (!match) return null;

  return /^[A-Za-z0-9_-]{1,64}$/.test(match[1]) ? match[1] : null;
}

bot.onText(/^\/start\b/, async (msg) => {
  const chatId = msg.chat.id;
  const isNew = await addSubscriber(chatId, parseSource(msg.text));

  bot.sendMessage(chatId, isNew ? welcome.greeting : welcome.greetingBack)
    .catch((error) => console.error('Ошибка приветствия:', error.message));

  // Первая практика — отдельным сообщением, с паузой, чтобы читалось
  // как дыхание, а не как стена текста
  setTimeout(() => {
    bot.sendMessage(chatId, welcome.practice).catch((error) => {
      console.error('Ошибка первой практики:', error.message);
    });
  }, (welcome.delaySeconds || 5) * 1000);
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
  const sources = await sourceBreakdown();
  const decks = deckStatus()
    .map(({ type, total, left }) => `${type}: осталось ${left} из ${total}`)
    .join('\n');

  const lines = [
    count === null ? 'Не удалось посчитать 🤍' : `Сейчас подписано: ${count}`,
    `Ответили сегодня: ${countToday()}`,
  ];

  // Показываем разбивку, только если метки вообще проставлены
  if (sources.some(({ source }) => source !== 'без метки')) {
    lines.push('', 'Откуда пришли:');
    lines.push(...sources.map(({ source, count: n }) => `${source}: ${n}`));
  }

  lines.push('', 'Колода посланий:', decks);

  bot.sendMessage(msg.chat.id, lines.join('\n'));
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
