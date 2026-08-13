const path = require('path');
const messages = require('../messages.json');

const ROOT = path.join(__dirname, '..');

const FALLBACK = {
  text: 'Послание скоро появится 🤍',
  image: null,
};

function getRandomMessage(type) {
  const arr = messages[type];

  if (!arr || arr.length === 0) {
    console.error(`Нет посланий для типа: ${type}`);
    return FALLBACK;
  }

  const message = arr[Math.floor(Math.random() * arr.length)];

  return {
    text: message.text,
    // путь в messages.json относительный — приводим к абсолютному,
    // чтобы бот не зависел от того, из какой папки его запустили
    image: message.image ? path.join(ROOT, message.image) : null,
  };
}

module.exports = { getRandomMessage };
