const { questions, freeText } = require('../responses.json');

// Вопросы идут по кругу: каждое утро следующий, а не один и тот же
let cursor = Math.floor(Math.random() * questions.length);

function nextQuestion() {
  const index = cursor;
  cursor = (cursor + 1) % questions.length;

  return { index, ...questions[index] };
}

function findOption(questionIndex, optionIndex) {
  const question = questions[questionIndex];

  if (!question) return null;

  return question.options[optionIndex] || null;
}

function randomFreeTextReply() {
  return freeText[Math.floor(Math.random() * freeText.length)];
}

module.exports = { nextQuestion, findOption, randomFreeTextReply };
