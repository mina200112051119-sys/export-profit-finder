const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf("const FAVORITES_KEY='favoriteProducts:v1';");
const end = html.indexOf('\nfunction tab(id,b)', start);
assert.notEqual(start, -1, 'favorites storage helpers must exist');
assert.notEqual(end, -1, 'favorites helper block must close before tab()');

function makeContext() {
  const values = new Map();
  const context = {
    data: [{ id: 'item-1', name: 'Camera model', displayName: 'カメラ', cat: 'カメラ', sell: 100, ship: 10 }],
    __LIVE_CATEGORY_DATA: [],
    findProductForSourcing: id => context.__detailProduct?.id === id ? context.__detailProduct : context.__LIVE_CATEGORY_DATA.find(p => p.id === id) || context.data.find(p => p.id === id) || null,
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value))
    },
    JSON,
    String,
    Array,
    Number,
    saveCloudStorage: () => Promise.resolve(true)
  };
  vm.runInNewContext(
    html.slice(start, end) +
      '\nrenderFavorites = () => {}; updateFavoriteButtons = () => {};' +
      '\nglobalThis.toggleFavorite = toggleFavorite;' +
      '\nglobalThis.removeFavorite = removeFavorite;' +
      '\nglobalThis.getFavoriteProducts = getFavoriteProducts;',
    context
  );
  return context;
}

test('favorites: saves a product snapshot and toggles it off', () => {
  const c = makeContext();
  assert.equal(c.toggleFavorite('item-1'), true);
  assert.equal(c.getFavoriteProducts().length, 1);
  assert.equal(c.getFavoriteProducts()[0].displayName, 'カメラ');
  assert.equal(c.toggleFavorite('item-1'), false);
  assert.equal(c.getFavoriteProducts().length, 0);
});

test('favorites: can save a category-ranking product not present in the search array', () => {
  const c = makeContext();
  c.__LIVE_CATEGORY_DATA.push({ id: 'rank-1', name: 'Fishing reel', displayName: 'ダイワ リール', cat: '釣具', sell: 80, ship: 12 });
  assert.equal(c.toggleFavorite('rank-1'), true);
  assert.equal(c.getFavoriteProducts().length, 1);
  assert.equal(c.getFavoriteProducts()[0].id, 'rank-1');
});

test('favorites: removing one item leaves other saved items intact', () => {
  const c = makeContext();
  c.toggleFavorite('item-1');
  c.data.push({ id: 'item-2', name: 'Fishing reel', cat: '釣具', sell: 50, ship: 5 });
  c.toggleFavorite('item-2');
  c.removeFavorite('item-1');
  assert.deepEqual(Array.from(c.getFavoriteProducts(), p => p.id), ['item-2']);
});

test('favorites: cloud storage includes favorites and schedules their saves', () => {
  assert.match(html, /return \{sourcingCandidates,selectedSourcing,officialCandidates,domesticSearchNames,manualEvidence,favorites,settings:/);
  assert.match(html, /d\.data\.favorites/);
  assert.match(html, /favoriteProducts:v1/);
});


test('cloud storage: manual save shows progress and verifies saved favorites by reading them back', () => {
  assert.match(html, /button\.textContent='☁️ 保存中…'/);
  assert.match(html, /const verify=await fetch\(CLOUD_STORAGE_API/);
  assert.match(html, /マイリスト'\+expectedIds\.length\+'件を確認/);
  assert.match(html, /button\.disabled=true/);
});
test('cloud storage: manual save button calls the PUT save function, not only the connection check', () => {
  assert.match(html, /onclick="saveCloudStorage\(\)"[^>]*>☁️ マイリストをクラウドに保存/);
  assert.match(html, /onclick="checkCloudStorage\(\)"[^>]*>☁️ 接続状態を確認/);
});

test('category diagnostics: reports successful queries and combined search-result totals', () => {
  assert.match(html, /categorySearchStats=searchStats/);
  assert.match(html, /searchResultTotal:merged\.total/);
  assert.ok(html.includes("検索 '+(tasks.length-errors.length)+'/'+tasks.length+'件成功。現在の出品価格"),
    'update summary should report successful query count without exposing per-category diagnostics');
});


test('cloud identity: keeps the established device identity ahead of a stale copied cookie', () => {
  assert.match(html, /let id=localId\|\|cookieId;/);
  assert.doesNotMatch(html, /let id=cookieId\|\|localId;/);
});
