const test = require('node:test');
const assert = require('node:assert/strict');
const searchApi = require('../api/ebay-search');
const fs = require('node:fs');

test('shipping lookup skips unusable first option and finds a later priced option', () => {
  const result = searchApi.shippingFor([
    { shippingCostType: 'CALCULATED' },
    { shippingCost: { value: '4.25', currency: 'USD' } }
  ]);
  assert.deepEqual(result, { value: 4.25, currency: 'USD', known: true });
});

test('shipping lookup recognizes free shipping even when an earlier option is unknown', () => {
  const result = searchApi.shippingFor([
    { shippingCostType: 'NOT_SPECIFIED' },
    { shippingCostType: 'FREE' }
  ]);
  assert.deepEqual(result, { value: 0, currency: '', known: true });
});

test('shipping lookup never assumes zero when no option confirms a price', () => {
  assert.deepEqual(searchApi.shippingFor([]), { value: null, currency: '', known: false });
  assert.deepEqual(searchApi.shippingFor([{ shippingCostType: 'CALCULATED' }]), {
    value: null, currency: '', known: false
  });
});

test('supply and fishing discovery queries use positive terms and leave exclusions to classification', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const start = html.indexOf('function defaultSearchQueriesForCategory(c)');
  const end = html.indexOf('function defaultSearchQueryForCategory(c)', start);
  const queries = html.slice(start, end);
  const supply = queries.match(/'ポケモン関連サプライ用品':\[([\s\S]*?)\],\s*'釣具'/)?.[1] || '';
  const fishing = queries.match(/'釣具':\[([\s\S]*?)\],\s*'カメラ'/)?.[1] || '';
  assert.ok(supply && fishing, 'both category query sets are present');
  assert.doesNotMatch(supply, /\s-[a-z]/i);
  assert.doesNotMatch(fishing, /\s-[a-z]/i);
});

test('category cards show only the eligible candidate count and keep diagnostics internal', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /現在出品候補 \$\{count\}件/);
  assert.match(html, /const count=rankRecommended\(c\)\.length/);
  assert.doesNotMatch(html, /検索 '\s*\+\(st\.rawUniqueItems/);
  assert.doesNotMatch(html, /送料未取得 '\s*\+\(st\.missingShipping/);
  assert.match(html, /missingShipping/);
  assert.match(html, /missingUrl/);
  assert.match(html, /lowCompleteness/);
});

test('currency-conversion fee defaults conservatively to 3 percent when unset', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id="conv" type="number" value="3"/);
  assert.match(html, /conversionFeeRate:\$\('conv'\)\.value\.trim\(\)===''\?3/);
});

test('scheduled snapshot searches fishing and Pokémon supplies with six positive queries each', () => {
  const cron = fs.readFileSync('api/daily-refresh.js', 'utf8');
  const supply = [...cron.matchAll(/cat: 'ポケモン関連サプライ用品', q:/g)].length;
  const fishing = [...cron.matchAll(/cat: '釣具', q:/g)].length;
  assert.equal(supply, 6);
  assert.equal(fishing, 6);
  const start = cron.indexOf('const QUERIES = [');
  const end = cron.indexOf('];', start);
  const queryBlock = cron.slice(start, end);
  const supplyQueries = queryBlock.split("cat: 'ポケモン関連サプライ用品'").slice(1).map(x => x.split('},')[0]).join('');
  const fishingQueries = queryBlock.split("cat: '釣具'").slice(1).map(x => x.split('},')[0]).join('');
  assert.doesNotMatch(supplyQueries, /\\s-[a-z]/i);
  assert.doesNotMatch(fishingQueries, /\\s-[a-z]/i);
});

test('scheduled snapshots drop obsolete queries but preserve prior data for failed active queries', () => {
  const dailyRefresh = require('../api/daily-refresh');
  const previous = [
    { query: 'old narrow fishing query', category: '釣具', ok: true, items: [{ itemId: 'old' }] },
    { query: 'active fishing query', category: '釣具', ok: true, items: [{ itemId: 'cached' }] }
  ];
  const current = [
    { query: 'active fishing query', category: '釣具', ok: false, items: [], error: 'temporary failure' },
    { query: 'new fishing query', category: '釣具', ok: true, items: [{ itemId: 'new' }] }
  ];
  const merged = dailyRefresh.mergeSnapshotCategories(previous, current);
  assert.deepEqual(merged.map(row => row.query).sort(), ['active fishing query', 'new fishing query']);
  assert.deepEqual(merged.find(row => row.query === 'active fishing query').items, [{ itemId: 'cached' }]);
});
