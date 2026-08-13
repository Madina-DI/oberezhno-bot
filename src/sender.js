const fs = require('fs');
const { loadSubscribers, removeSubscriber } = require('./db');

// Telegram разрешает ~30 сообщений в секунду на бота.
// Держим запас: 50 мс между отправками ≈ 20 в секунду.
const SEND_DELAY_MS = 50;

// Одна и та же картинка уходит всем подписчицам. Чтобы не загружать
// файл на серверы Telegram по кругу, запоминаем file_id первой отправки.
const fileIdCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function describeError(error) {
  const body = error && error.response && error.response.body;

  return {
    code: (body && body.error_code) || null,
    description: (body && body.description) || error.message,
    retryAfter: (body && body.parameters && body.parameters.retry_after) || null,
  };
}

// Подписчица заблокировала бота, удалила аккаунт или чата больше нет —
// её запись в базе мертва, дальше слать бессмысленно.
function isGone({ code, description }) {
  if (code === 403) return true;

  return (
    code === 400 &&
    /chat not found|user is deactivated|chat_id is empty/i.test(description)
  );
}

async function sendOneMessage(bot, chatId, message) {
  if (!message.image) {
    return bot.sendMessage(chatId, message.text);
  }

  const cachedFileId = fileIdCache.get(message.image);

  if (cachedFileId) {
    try {
      return await bot.sendPhoto(chatId, cachedFileId, {
        caption: message.text,
      });
    } catch (error) {
      // file_id мог протухнуть — сбрасываем кэш и грузим файл заново
      fileIdCache.delete(message.image);
      console.error('file_id не сработал, шлём файл:', describeError(error).description);
    }
  }

  const sent = await bot.sendPhoto(chatId, fs.createReadStream(message.image), {
    caption: message.text,
  });

  const photo = sent && sent.photo && sent.photo[sent.photo.length - 1];

  if (photo) {
    fileIdCache.set(message.image, photo.file_id);
  }

  return sent;
}

// Отправка с обработкой лимитов: при 429 ждём столько, сколько просит Telegram,
// и пробуем ещё раз. Возвращаем 'gone', если подписчицу пора удалить.
async function sendWithRetry(bot, chatId, message) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await sendOneMessage(bot, chatId, message);
      return 'ok';
    } catch (error) {
      const info = describeError(error);

      if (isGone(info)) return 'gone';

      if (info.code === 429 && attempt === 0) {
        const wait = (info.retryAfter || 1) * 1000;
        console.warn(`429 для ${chatId}, ждём ${wait} мс`);
        await sleep(wait);
        continue;
      }

      console.error(`Ошибка для ${chatId}:`, info.description);
      return 'error';
    }
  }

  return 'error';
}

async function sendMessageToAll(bot, message) {
  const subscribers = await loadSubscribers();
  const stats = { ok: 0, gone: 0, error: 0 };

  for (const chatId of subscribers) {
    const result = await sendWithRetry(bot, chatId, message);
    stats[result] += 1;

    if (result === 'gone') {
      await removeSubscriber(chatId);
    }

    await sleep(SEND_DELAY_MS);
  }

  return { total: subscribers.length, ...stats };
}

module.exports = { sendOneMessage, sendMessageToAll };
