const path = require('path');
const messages = require('../messages.json');
const guest = require('../guest.json');

const ROOT = path.join(__dirname, '..');

// Послания гостя живут отдельным файлом и уходят в свой час — так чужой голос
// не смешивается с колодой Мадины. Пока active: false, слот молчит.
const GUEST = 'guest';

function guestIsOn() {
  return Boolean(guest.active) && Array.isArray(guest.messages) && guest.messages.length > 0;
}

function poolFor(type) {
  if (type === GUEST) return guestIsOn() ? guest.messages : [];

  return messages[type] || [];
}

const FALLBACK = {
  text: 'Послание скоро появится 🤍',
  image: null,
};

// Колода: послания выдаются в случайном порядке, но каждое — по одному разу,
// пока не кончится вся пачка. Так повтор не приходит через день.
const decks = {};
const lastSent = {};

function shuffle(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function refillDeck(type) {
  const deck = shuffle(poolFor(type).map((_, index) => index));

  // Чтобы новая колода не начиналась с того же послания, которым
  // закончилась предыдущая
  if (deck.length > 1 && deck[0] === lastSent[type]) {
    [deck[0], deck[1]] = [deck[1], deck[0]];
  }

  decks[type] = deck;
}

function withAbsoluteImage(message, type) {
  // авторство: у послания своё, иначе общее для гостя
  const isGuest = type === GUEST;
  const author = message.author || (isGuest ? guest.author : null);
  const link = message.link || (isGuest ? guest.link : null);
  const linkLabel = message.linkLabel || (isGuest ? guest.linkLabel : null);

  return {
    // у гостевых посланий под текстом стоит имя автора
    text: author ? `${message.text}\n\n— ${author}` : message.text,
    // путь в messages.json относительный — приводим к абсолютному,
    // чтобы бот не зависел от того, из какой папки его запустили
    image: message.image ? path.join(ROOT, message.image) : null,
    link: link || null,
    linkLabel: linkLabel || null,
  };
}

function getNextMessage(type) {
  const pool = poolFor(type);

  if (pool.length === 0) {
    // выключенный гость — это норма, а не поломка: слот просто молчит
    if (type === GUEST) return null;

    console.error(`Нет посланий для типа: ${type}`);
    return FALLBACK;
  }

  if (!decks[type] || decks[type].length === 0) {
    refillDeck(type);
  }

  const index = decks[type].shift();
  lastSent[type] = index;

  return withAbsoluteImage(pool[index], type);
}

function deckStatus() {
  const types = [...Object.keys(messages)];

  if (guestIsOn()) types.push(GUEST);

  return types.map((type) => ({
    type,
    total: poolFor(type).length,
    left: decks[type] ? decks[type].length : poolFor(type).length,
  }));
}

module.exports = { getNextMessage, deckStatus };
