// Ответ подписчицы на утренний вопрос — какой вопрос был и что она выбрала.
// Живёт до конца дня: утром спросили — вечером учли. Хранится в памяти
// процесса, при перезапуске бота теряется, и вечернее послание тогда просто
// уйдёт обычным (см. README).
const answers = new Map();

const TIMEZONE = 'Europe/Moscow';

function today() {
  // sv-SE даёт формат YYYY-MM-DD
  return new Date().toLocaleDateString('sv-SE', { timeZone: TIMEZONE });
}

function setAnswer(chatId, questionIndex, optionIndex) {
  const day = today();

  // заодно подчищаем вчерашние ответы
  for (const [id, value] of answers) {
    if (value.day !== day) answers.delete(id);
  }

  answers.set(chatId, { questionIndex, optionIndex, day });
}

function getAnswer(chatId) {
  const saved = answers.get(chatId);

  if (!saved || saved.day !== today()) return null;

  return saved;
}

function countToday() {
  const day = today();
  let count = 0;

  for (const value of answers.values()) {
    if (value.day === day) count += 1;
  }

  return count;
}

module.exports = { setAnswer, getAnswer, countToday };
