const path = require('path');
const messages = require('../messages.json');

const ROOT = path.join(__dirname, '..');

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
  const deck = shuffle(messages[type].map((_, index) => index));

  // Чтобы новая колода не начиналась с того же послания, которым
  // закончилась предыдущая
  if (deck.length > 1 && deck[0] === lastSent[type]) {
    [deck[0], deck[1]] = [deck[1], deck[0]];
  }

  decks[type] = deck;
}

function withAbsoluteImage(message) {
  return {
    text: message.text,
    // путь в messages.json относительный — приводим к абсолютному,
    // чтобы бот не зависел от того, из какой папки его запустили
    image: message.image ? path.join(ROOT, message.image) : null,
  };
}

function getNextMessage(type) {
  const pool = messages[type];

  if (!pool || pool.length === 0) {
    console.error(`Нет посланий для типа: ${type}`);
    return FALLBACK;
  }

  if (!decks[type] || decks[type].length === 0) {
    refillDeck(type);
  }

  const index = decks[type].shift();
  lastSent[type] = index;

  return withAbsoluteImage(pool[index]);
}

function deckStatus() {
  return Object.keys(messages).map((type) => ({
    type,
    total: messages[type].length,
    left: decks[type] ? decks[type].length : messages[type].length,
  }));
}

module.exports = { getNextMessage, deckStatus };
