const { questions, freeText, openInvite } = require('../responses.json');

// Вопросы идут по кругу: каждое утро следующий, а не один и тот же
let cursor = Math.floor(Math.random() * questions.length);
let lastAsked = null;

// Вопрос без options — открытый: приходит без кнопок, ответить можно
// только своими словами или просто побыть с ним
function nextQuestion() {
  const index = cursor;
  cursor = (cursor + 1) % questions.length;
  lastAsked = index;

  return { index, ...questions[index] };
}

function lastAskedIndex() {
  return lastAsked;
}

function findQuestion(questionIndex) {
  return questions[questionIndex] || null;
}

function findOption(questionIndex, optionIndex) {
  const question = questions[questionIndex];

  if (!question || !question.options) return null;

  return question.options[optionIndex] || null;
}

// Строка, с которой начнётся вечернее послание. Для ответа кнопкой — своя
// у каждого варианта, для ответа своими словами — общая у вопроса.
function eveningLineFor(answer) {
  if (!answer) return null;

  if (answer.optionIndex === null) {
    const question = findQuestion(answer.questionIndex);
    return (question && question.evening) || null;
  }

  const option = findOption(answer.questionIndex, answer.optionIndex);
  return (option && option.evening) || null;
}

function randomFreeTextReply() {
  return freeText[Math.floor(Math.random() * freeText.length)];
}

module.exports = {
  nextQuestion,
  lastAskedIndex,
  findOption,
  eveningLineFor,
  randomFreeTextReply,
  openInvite,
};
