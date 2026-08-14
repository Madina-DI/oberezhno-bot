// Метки в ссылках: t.me/бот?start=reels → откуда пришла подписчица.
// Отдельно проверяем, что подписка не ломается, пока колонки source нет в базе.
const path = require('path');
const ROOT = path.join(__dirname, '..');

let failed = 0;
const check = (name, ok) => { console.log(ok ? `PASS ${name}` : `FAIL ${name}`); if (!ok) failed++; };

// --- разбор метки из текста команды (логика из bot.js) ---
function parseSource(text) {
  const match = /^\/start(?:@\S+)?\s+(\S+)/.exec(text || '');
  if (!match) return null;
  return /^[A-Za-z0-9_-]{1,64}$/.test(match[1]) ? match[1] : null;
}

check('обычный /start — без метки', parseSource('/start') === null);
check('метка читается', parseSource('/start reels') === 'reels');
check('метка с дефисом и подчёркиванием', parseSource('/start podruga_masha-2') === 'podruga_masha-2');
check('команда с именем бота', parseSource('/start@oberezhno_women_bot partner1') === 'partner1');
check('мусор отбрасывается', parseSource('/start привет; drop table') === null);
check('слишком длинная метка отбрасывается', parseSource('/start ' + 'a'.repeat(65)) === null);

// --- поведение базы, когда колонки source ещё нет ---
const supaPath = require.resolve('@supabase/supabase-js', { paths: [ROOT] });

const inserted = [];
let columnExists = false;

function fakeSupabase() {
  return {
    from() {
      return {
        select() {
          const result = { data: inserted.map(r => ({ source: r.source || null })), error: null };
          const chain = {
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            then: (fn) => fn(result),
          };
          return chain;
        },
        insert(rows) {
          if (!columnExists && rows[0].source !== undefined) {
            return Promise.resolve({ error: { code: '42703', message: 'column "source" does not exist' } });
          }
          inserted.push(rows[0]);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

require.cache[supaPath] = {
  id: supaPath, filename: supaPath, loaded: true,
  exports: { createClient: fakeSupabase },
};

process.env.SUPABASE_URL = 'http://fake';
process.env.SUPABASE_KEY = 'fake';
const db = require(path.join(ROOT, 'src/db.js'));

(async () => {
  // колонки нет: подписка всё равно проходит
  const addedWithoutColumn = await db.addSubscriber(111, 'reels');
  check('без колонки source подписка всё равно проходит', addedWithoutColumn === true);
  check('запись создана без метки', inserted.length === 1 && inserted[0].source === undefined);

  // повторная подписка с меткой не пытается писать source снова
  const secondTry = await db.addSubscriber(222, 'podruga');
  check('после первой ошибки бот не долбится в отсутствующую колонку', secondTry === true && inserted.length === 2);

  console.log(failed === 0 ? '\nВСЁ ЗЕЛЁНОЕ' : `\nПРОВАЛЕНО: ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
})();
