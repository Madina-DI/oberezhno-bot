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

// Колонки source может не быть — она добавляется в дашборде Supabase.
// Пока её нет, метка просто не сохраняется, подписка при этом работает.
let sourceColumnMissing = false;

function isMissingSourceColumn(error) {
  return error.code === '42703' || /source/i.test(error.message || '');
}

async function addSubscriber(chatId, source) {
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

  const row = { chat_id: chatId };

  if (source && !sourceColumnMissing) row.source = source;

  let { error: insertError } = await supabase.from('subscribers').insert([row]);

  if (insertError && row.source && isMissingSourceColumn(insertError)) {
    console.warn(
      'В таблице subscribers нет колонки source — метка не сохранена. ' +
      'Добавь её в Supabase: alter table subscribers add column source text;'
    );
    sourceColumnMissing = true;

    ({ error: insertError } = await supabase
      .from('subscribers')
      .insert([{ chat_id: chatId }]));
  }

  if (insertError) {
    console.error('Ошибка добавления подписчика:', insertError.message);
    return false;
  }

  const savedSource = source && !sourceColumnMissing;
  console.log(`New subscriber added: ${chatId}${savedSource ? ` (откуда: ${source})` : ''}`);
  return true;
}

// Откуда пришли подписчицы. Пустой список, если колонки source ещё нет.
async function sourceBreakdown() {
  const { data, error } = await supabase.from('subscribers').select('source');

  if (error) return [];

  const counts = new Map();

  for (const row of data) {
    const key = row.source || 'без метки';
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => ({ source, count }));
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
  sourceBreakdown,
};
