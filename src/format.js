// Сборка того, что реально уходит подписчице: подпись автора, кнопка на его
// профиль, утренний вопрос, вечерний отклик на утренний ответ.
const { nextQuestion, eveningLineFor, openInvite } = require('./questions');
const { getAnswer } = require('./mood');

// Гостевое послание — со ссылкой на автора отдельной кнопкой
function linkRows(message) {
  if (!message.link) return [];

  return [[{ text: message.linkLabel || 'Открыть профиль', url: message.link }]];
}

function withLinkButton(message) {
  const rows = linkRows(message);

  if (rows.length === 0) return message;

  return { ...message, replyMarkup: { inline_keyboard: rows } };
}

// Утреннее послание заканчивается вопросом. Вопрос каждое утро новый —
// про чувства, внимание, энергию, тело.
function withQuestion(message) {
  const question = nextQuestion();

  // Открытый вопрос — без кнопок: на него отвечают словами или молча, себе
  if (!question.options) {
    return withLinkButton({
      ...message,
      text: `${message.text}\n\n${question.text}\n\n${openInvite}`,
    });
  }

  const answers = question.options.map((option, optionIndex) => ({
    text: option.label,
    callback_data: `q:${question.index}:${optionIndex}`,
  }));

  return {
    ...message,
    text: `${message.text}\n\n${question.text}`,
    replyMarkup: { inline_keyboard: [answers, ...linkRows(message)] },
  };
}

// Вечернее послание начинается с отклика на то, что она ответила утром —
// кнопкой или своими словами
function withEveningIntro(message, chatId) {
  const line = eveningLineFor(getAnswer(chatId));

  if (!line) return message;

  return { ...message, text: `${line}\n\n${message.text}` };
}

module.exports = { withQuestion, withEveningIntro, withLinkButton };
