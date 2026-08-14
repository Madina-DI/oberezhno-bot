// Гостевые послания: подпись автора под текстом и кнопка на его профиль
const path = require('path');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const check = (name, ok) => { console.log(ok ? `PASS ${name}` : `FAIL ${name}`); if (!ok) failed++; };

const { withQuestion, withEveningIntro, withLinkButton } = require(path.join(ROOT, 'src/format.js'));

const guest = {
  text: 'Сначала — ты.',
  image: null,
  link: 'https://www.instagram.com/julkapostnikova/',
  linkLabel: 'Открыть инстаграм',
};
const own = { text: 'Просыпайся мягко.', image: null, link: null, linkLabel: null };

// --- обычное послание не обрастает кнопками ---
check('своё послание остаётся без кнопки', withLinkButton(own).replyMarkup === undefined);

// --- гостевое получает кнопку со ссылкой ---
const guestOut = withLinkButton(guest);
const button = guestOut.replyMarkup.inline_keyboard[0][0];
check('у гостевого есть кнопка', !!button);
check('кнопка ведёт на профиль автора', button.url === guest.link);
check('надпись на кнопке своя', button.text === 'Открыть инстаграм');

// --- утро: вопрос и ссылка живут вместе, разными рядами ---
let morning = withQuestion(guest);
while (!morning.replyMarkup || morning.replyMarkup.inline_keyboard.length < 2) {
  morning = withQuestion(guest);
  if (morning.replyMarkup && morning.replyMarkup.inline_keyboard.length === 1
      && morning.replyMarkup.inline_keyboard[0][0].url) break; // открытый вопрос + ссылка
}
const rows = morning.replyMarkup.inline_keyboard;
const hasLinkRow = rows.some(r => r.length === 1 && r[0].url === guest.link);
check('утро: ссылка на автора дошла', hasLinkRow);
check('утро: кнопки ответа и ссылка не смешались в один ряд',
  rows.every(r => r.every(b => b.url) || r.every(b => b.callback_data)));

// --- открытый вопрос у гостевого послания тоже несёт ссылку ---
let openMorning = withQuestion(guest);
let guard = 0;
while (openMorning.replyMarkup.inline_keyboard.some(r => r[0].callback_data) && guard++ < 50) {
  openMorning = withQuestion(guest);
}
check('открытый вопрос: ссылка на месте',
  openMorning.replyMarkup.inline_keyboard.some(r => r[0].url === guest.link));

// --- вечер: отклик не съедает кнопку ---
const evening = withLinkButton(withEveningIntro(guest, 999));
check('вечер: кнопка сохраняется', evening.replyMarkup.inline_keyboard[0][0].url === guest.link);

// --- подпись автора добавляется при чтении из messages.json ---
const contentPath = require.resolve(path.join(ROOT, 'src/content.js'));
delete require.cache[contentPath];
const messagesPath = require.resolve(path.join(ROOT, 'messages.json'));
require.cache[messagesPath] = {
  id: messagesPath, filename: messagesPath, loaded: true,
  exports: {
    morning: [{ text: 'Сначала — ты.', image: null, author: 'Юлия Постникова', link: guest.link, linkLabel: 'Открыть инстаграм' }],
    day: [{ text: 'Своё послание', image: null }],
    evening: [{ text: 'Своё послание', image: null }],
  },
};
const { getNextMessage } = require(contentPath);
const built = getNextMessage('morning');
check('подпись автора добавлена под текстом', built.text === 'Сначала — ты.\n\n— Юлия Постникова');
check('ссылка прочитана из messages.json', built.link === guest.link);
check('у своего послания подписи нет', getNextMessage('day').text === 'Своё послание');

// --- гостевой слот в 12:00 ---
const guestPath = require.resolve(path.join(ROOT, 'guest.json'));
const realGuest = require(guestPath);

function reloadContent(guestConfig) {
  delete require.cache[contentPath];
  require.cache[guestPath] = { id: guestPath, filename: guestPath, loaded: true, exports: guestConfig };
  return require(contentPath);
}

// выключенный гость молчит
const off = reloadContent({ ...realGuest, active: false });
check('выключенный гость не отдаёт послание', off.getNextMessage('guest') === null);
check('выключенный гость не показан в колодах', !off.deckStatus().some(d => d.type === 'guest'));
check('свои послания при этом работают', off.getNextMessage('morning').text.length > 0);

// включённый гость отдаёт послания со своей подписью и ссылкой
const on = reloadContent({ ...realGuest, active: true });
const guestMsg = on.getNextMessage('guest');
check('включённый гость отдаёт послание', guestMsg !== null);
check('подпись автора проставилась сама', guestMsg.text.endsWith(`— ${realGuest.author}`));
check('ссылка автора проставилась сама', guestMsg.link === realGuest.link);
check('гость появился в колодах', on.deckStatus().some(d => d.type === 'guest' && d.total === realGuest.messages.length));

// вся колода гостя проходит без повторов (с чистой колоды)
const fresh = reloadContent({ ...realGuest, active: true });
const seen = new Set();
for (let i = 0; i < realGuest.messages.length; i++) seen.add(fresh.getNextMessage('guest').text);
check(`колода гостя: ${realGuest.messages.length} посланий без повторов`, seen.size === realGuest.messages.length);

// пустой список — то же, что выключено
const empty = reloadContent({ ...realGuest, active: true, messages: [] });
check('гость без посланий молчит', empty.getNextMessage('guest') === null);

console.log(failed === 0 ? '\nВСЁ ЗЕЛЁНОЕ' : `\nПРОВАЛЕНО: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
