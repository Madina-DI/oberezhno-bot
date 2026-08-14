const path = require('path');
const ROOT = path.join(__dirname, '..');

const { getNextMessage, deckStatus } = require(path.join(ROOT, 'src/content.js'));
const { setAnswer, getAnswer, countToday } = require(path.join(ROOT, 'src/mood.js'));
const { nextQuestion, lastAskedIndex, findOption, eveningLineFor, randomFreeTextReply, openInvite } = require(path.join(ROOT, 'src/questions.js'));
const messages = require(path.join(ROOT, 'messages.json'));

let failed = 0;
const check = (name, ok) => { console.log(ok ? `PASS ${name}` : `FAIL ${name}`); if (!ok) failed++; };

// --- колода: за один проход каждое послание ровно один раз ---
const total = messages.evening.length;
const round = [];
for (let i = 0; i < total; i++) round.push(getNextMessage('evening').text);
check(`колода: ${total} посланий без повторов`, new Set(round).size === new Set(messages.evening.map(m => m.text)).size);

// --- порядок случайный, а не по списку ---
const inOrder = round.every((t, i) => t === messages.evening[i].text);
check('колода перемешана', !inOrder);

// --- на стыке колод нет повтора подряд ---
let backToBack = 0;
for (let round2 = 0; round2 < 300; round2++) {
  let prev = null;
  for (let i = 0; i < messages.day.length + 1; i++) {
    const t = getNextMessage('day').text;
    if (t === prev) backToBack++;
    prev = t;
  }
}
check('нет двух одинаковых подряд на стыке колод', backToBack === 0);

// --- счётчик колоды ---
const status = deckStatus();
check('deckStatus отдаёт все три типа', status.length === 3 && status.every(s => s.total > 0));

// --- настроение: живёт в течение дня ---
setAnswer(111, 0, 0);
setAnswer(222, 1, 2);
check('ответ сохраняется', getAnswer(111).optionIndex === 0 && getAnswer(222).questionIndex === 1);
check('у неответивших пусто', getAnswer(999) === null);
check('счётчик ответов', countToday() === 2);

// --- вчерашний ответ не учитывается ---
const moodModule = require(path.join(ROOT, 'src/mood.js'));
const RealDate = Date;
global.Date = class extends RealDate {
  toLocaleDateString() { return '2030-01-01'; }
};
check('вчерашний ответ не тянется в новый день', moodModule.getAnswer(111) === null);
global.Date = RealDate;

// --- сборка утреннего и вечернего послания (логика из bot.js) ---
const responses = require(path.join(ROOT, 'responses.json'));
const { withQuestion, withEveningIntro, withLinkButton } = require(path.join(ROOT, 'src/format.js'));

// проходим весь круг вопросов и проверяем оба формата
const builtByIndex = new Map();
for (let i = 0; i < responses.questions.length; i++) {
  const before = lastAskedIndexPeek();
  const built = withQuestion({ text: 'утро', image: null });
  builtByIndex.set(lastAskedIndex(), built);
}
function lastAskedIndexPeek() { return lastAskedIndex(); }

let withButtons = 0, openOnes = 0, formatOk = true, inviteOk = true;
for (const [qi, built] of builtByIndex) {
  const q = responses.questions[qi];
  if (!built.text.includes(q.text)) formatOk = false;
  if (q.options) {
    withButtons++;
    if (!built.replyMarkup || built.replyMarkup.inline_keyboard[0].length !== q.options.length) formatOk = false;
    if (!built.replyMarkup.inline_keyboard[0].every(b => /^q:\d+:\d+$/.test(b.callback_data))) formatOk = false;
  } else {
    openOnes++;
    if (built.replyMarkup) formatOk = false;
    if (!built.text.includes(openInvite)) inviteOk = false;
  }
}
check(`утро: собрались все ${builtByIndex.size} вопроса`, builtByIndex.size === responses.questions.length);
check(`утро: оба формата (${withButtons} с кнопками, ${openOnes} открытых)`, withButtons > 0 && openOnes > 0 && formatOk);
check('утро: у открытых вопросов нет кнопок, но есть приглашение', inviteOk);

const morning = builtByIndex.get([...builtByIndex.keys()].find(k => responses.questions[k].options));

// вопросы идут по кругу, не повторяясь
const asked = [];
for (let i = 0; i < responses.questions.length; i++) asked.push(nextQuestion().index);
check('вопросы не повторяются в пределах круга', new Set(asked).size === responses.questions.length);

// у каждого варианта есть отклик и вечерняя строка
const complete = responses.questions.every(q => !q.options || (q.options.length >= 2 && q.options.every(o => o.label && o.ack && o.evening)));
check('у всех вариантов заполнены label/ack/evening', complete);

// callback_data влезает в лимит Telegram (64 байта)
check('callback_data короче 64 байт', morning.replyMarkup.inline_keyboard[0].every(b => Buffer.byteLength(b.callback_data) < 64));

// свободный ответ
check('ответ на свободный текст есть', typeof randomFreeTextReply() === 'string' && randomFreeTextReply().length > 0);

// вечерний отклик на ответ словами (открытый вопрос)
const openIndex = responses.questions.findIndex(q => !q.options);
setAnswer(555, openIndex, null);
check('вечер: отклик на ответ словами', eveningLineFor(getAnswer(555)) === responses.questions[openIndex].evening);

// у вопросов с кнопками отклик берётся из варианта
const btnIndex = responses.questions.findIndex(q => q.options);
setAnswer(556, btnIndex, 1);
check('вечер: отклик на ответ кнопкой', eveningLineFor(getAnswer(556)) === responses.questions[btnIndex].options[1].evening);

// у всех вопросов есть чем ответить вечером
const everyQuestionHasEvening = responses.questions.every(q => q.options ? q.options.every(o => o.evening) : !!q.evening);
check('у каждого вопроса заполнен вечерний отклик', everyQuestionHasEvening);

const base = getNextMessage('evening');
const forAnswered = withEveningIntro(base, 111);
const forSilent = withEveningIntro(base, 999);
check('вечер: отклик тем, кто ответил', forAnswered.text.startsWith(responses.questions[0].options[0].evening));
check('вечер: без отклика тем, кто молчал', forSilent.text === base.text);
check('вечер: исходное послание не потеряно', forAnswered.text.endsWith(base.text));
check('вечер: картинка сохранилась', forAnswered.image === base.image);

// --- длина подписи к фото (лимит Telegram 1024) ---
let longest = 0;
for (const type of ['morning', 'evening']) {
  for (const m of messages[type]) {
    if (!m.image) continue;
    const longestEvening = responses.questions.flatMap(q => q.options ? q.options.map(o => o.evening) : [q.evening]).sort((a, b) => b.length - a.length)[0];
    const longestQuestion = responses.questions.map(q => q.text).sort((a, b) => b.length - a.length)[0];
    const withExtras = `${longestEvening}\n\n${m.text}\n\n${longestQuestion}\n\n${responses.openInvite}`;
    longest = Math.max(longest, withExtras.length);
  }
}
check(`подпись к фото влезает в лимит (максимум ${longest} из 1024)`, longest < 1024);

// --- рассылка с персональным текстом ---
const dbPath = require.resolve(path.join(ROOT, 'src/db.js'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { loadSubscribers: async () => [111, 999], removeSubscriber: async () => true } };
const { sendMessageToAll } = require(path.join(ROOT, 'src/sender.js'));

const delivered = [];
const fakeBot = {
  async sendMessage(chatId, text, opts) { delivered.push({ chatId, text, markup: opts && opts.reply_markup }); return {}; },
  async sendPhoto(chatId, file, opts) { delivered.push({ chatId, text: opts.caption, markup: opts.reply_markup }); return { photo: [{ file_id: 'X' }] }; },
};

(async () => {
  await sendMessageToAll(fakeBot, (chatId) => withEveningIntro({ text: 'вечер', image: null }, chatId));
  const answered = delivered.find(d => d.chatId === 111);
  const silent = delivered.find(d => d.chatId === 999);
  check('рассылка: у каждой свой текст', answered.text !== silent.text && answered.text.startsWith(responses.questions[0].options[0].evening));

  // берём именно вопрос с кнопками — открытые уходят без клавиатуры
  let morningWithButtons = withQuestion({ text: 'утро', image: null });
  while (!morningWithButtons.replyMarkup) morningWithButtons = withQuestion({ text: 'утро', image: null });

  delivered.length = 0;
  await sendMessageToAll(fakeBot, morningWithButtons);
  check('рассылка: кнопки дошли до всех', delivered.length === 2 && delivered.every(d => d.markup && d.markup.inline_keyboard));

  // открытый вопрос уходит без клавиатуры
  let openMorning = withQuestion({ text: 'утро', image: null });
  while (openMorning.replyMarkup) openMorning = withQuestion({ text: 'утро', image: null });

  delivered.length = 0;
  await sendMessageToAll(fakeBot, openMorning);
  check('рассылка: открытый вопрос без кнопок', delivered.length === 2 && delivered.every(d => !d.markup));

  console.log(failed === 0 ? '\nВСЁ ЗЕЛЁНОЕ' : `\nПРОВАЛЕНО: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
})();
