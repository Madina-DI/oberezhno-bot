const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function loadSubscribers() {
  const { data, error } = await supabase
    .from('subscribers')
    .select('chat_id');

  if (error) {
    console.error('Ошибка загрузки подписчиков:', error.message);
    return [];
  }

  // Set на случай, если в базе завелись дубли: одна подписчица —
  // одно послание, а не два подряд
  return [...new Set(data.map((item) => item.chat_id))];
}

async function countSubscribers() {
  const { count, error } = await supabase
    .from('subscribers')
    .select('chat_id', { count: 'exact', head: true });

  if (error) {
    console.error('Ошибка подсчёта подписчиков:', error.message);
    return null;
  }

  return count;
}

async function addSubscriber(chatId) {
  const { data: existing, error: selectError } = await supabase
    .from('subscribers')
    .select('chat_id')
    .eq('chat_id', chatId)
    .maybeSingle();

  if (selectError) {
    console.error('Ошибка проверки подписчика:', selectError.message);
    return;
  }

  if (existing) {
    console.log(`Subscriber already exists: ${chatId}`);
    return false;
  }

  const { error: insertError } = await supabase
    .from('subscribers')
    .insert([{ chat_id: chatId }]);

  if (insertError) {
    console.error('Ошибка добавления подписчика:', insertError.message);
    return false;
  }

  console.log(`New subscriber added: ${chatId}`);
  return true;
}

async function removeSubscriber(chatId) {
  const { error } = await supabase
    .from('subscribers')
    .delete()
    .eq('chat_id', chatId);

  if (error) {
    console.error('Ошибка удаления подписчика:', error.message);
    return false;
  }

  console.log(`Subscriber removed: ${chatId}`);
  return true;
}

module.exports = {
  loadSubscribers,
  countSubscribers,
  addSubscriber,
  removeSubscriber,
};
