// Проверка сценария /start без сети: подменяем и Telegram, и базу
const path = require('path');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const check = (name, ok) => { console.log(ok ? `PASS ${name}` : `FAIL ${name}`); if (!ok) failed++; };

const responses = require(path.join(ROOT, 'responses.json'));

// --- заглушка базы: 111 новая, 222 уже подписана ---
const dbPath = require.resolve(path.join(ROOT, 'src/db.js'));
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: {
    addSubscriber: async (chatId) => chatId === 111,
    removeSubscriber: async () => true,
    loadSubscribers: async () => [111],
    countSubscribers: async () => 1,
  },
};

// --- заглушка Telegram ---
const sent = [];
const handlers = { text: [], other: {} };
class FakeBot {
  on(event, fn) { handlers.other[event] = fn; }
  onText(re, fn) { handlers.text.push([re, fn]); }
  setMyCommands() { return Promise.resolve(); }
  sendMessage(chatId, text) { sent.push({ chatId, text, at: Date.now() }); return Promise.resolve({}); }
  sendPhoto(chatId, f, o) { sent.push({ chatId, text: o.caption }); return Promise.resolve({ photo: [{ file_id: 'X' }] }); }
  answerCallbackQuery() { return Promise.resolve({}); }
  editMessageReplyMarkup() { return Promise.resolve({}); }
}
const libPath = require.resolve('node-telegram-bot-api');
require.cache[libPath] = { id: libPath, filename: libPath, loaded: true, exports: FakeBot };

process.env.PORT = '39998';
require('dotenv').config({ quiet: true });
require(path.join(ROOT, 'bot.js'));

const fire = (text, chatId) => {
  for (const [re, fn] of handlers.text) {
    const m = re.exec(text);
    if (m) return fn({ chat: { id: chatId }, text }, m);
  }
  return null;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // сокращаем ожидание практики для теста
  const delay = responses.welcome.delaySeconds * 1000;

  // --- новая подписчица ---
  sent.length = 0;
  await fire('/start', 111);
  await sleep(150);
  check('новой приходит приветствие', sent.length === 1 && sent[0].text === responses.welcome.greeting);
  check('практика приходит НЕ сразу', sent.length === 1);

  await sleep(delay + 400);
  check('практика приходит вторым сообщением', sent.length === 2 && sent[1].text === responses.welcome.practice);
  check('в практике нет вопроса с кнопками', !responses.questions.some(q => sent[1].text.includes(q.text)));
  check('практика говорит, когда придёт следующее', /завтра утром/i.test(sent[1].text));

  // --- вернувшаяся ---
  sent.length = 0;
  await fire('/start', 222);
  await sleep(150);
  check('вернувшейся — другое приветствие', sent.length === 1 && sent[0].text === responses.welcome.greetingBack);

  await sleep(delay + 400);
  check('вернувшейся практика тоже приходит', sent.length === 2 && sent[1].text === responses.welcome.practice);

  // --- /stop по-прежнему работает ---
  sent.length = 0;
  await fire('/stop', 111);
  await sleep(150);
  check('/stop отвечает', sent.length === 1 && /вернуться/i.test(sent[0].text));

  console.log(failed === 0 ? '\nВСЁ ЗЕЛЁНОЕ' : `\nПРОВАЛЕНО: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
})();
