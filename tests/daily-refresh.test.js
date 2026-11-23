const test = require('node:test');
const assert = require('node:assert/strict');
const refresh = require('../api/daily-refresh');

test('an all-failed refresh is not considered safe to save', () => {
  assert.equal(refresh.hasSuccessfulCategories([
    { query: 'pokemon', ok: false, items: [] },
    { query: 'camera', ok: false, items: [] }
  ]), false);
});

test('a successful empty search is still a valid completed result', () => {
  assert.equal(refresh.hasSuccessfulCategories([
    { query: 'pokemon', ok: true, items: [], count: 0 }
  ]), true);
});

test('partial refresh replaces successful queries and preserves the previous result for failed queries', () => {
  const previous = [
    { query: 'pokemon', ok: true, count: 12, items: [{ itemId: 'old-pokemon' }] },
    { query: 'camera', ok: true, count: 8, items: [{ itemId: 'old-camera' }] }
  ];
  const current = [
    { query: 'pokemon', ok: true, count: 4, items: [{ itemId: 'new-pokemon' }] },
    { query: 'camera', ok: false, count: 0, items: [], error: 'temporary failure' }
  ];
  const merged = refresh.mergeSnapshotCategories(previous, current);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0].items.map(x => x.itemId), ['new-pokemon']);
  assert.deepEqual(merged[1].items.map(x => x.itemId), ['old-camera']);
});

test('a failed query without previous data remains marked failed, not as a valid empty result', () => {
  const merged = refresh.mergeSnapshotCategories([], [
    { query: 'retro', ok: false, count: 0, items: [], error: 'unavailable' }
  ]);
  assert.equal(merged[0].ok, false);
  assert.equal(refresh.hasSuccessfulCategories(merged), false);
});

test('daily refresh invokes the JSON API handler directly without a protected self-request', async () => {
  const result = await refresh.invokeApi(async (req, res) => {
    assert.equal(req.method, 'GET');
    return res.status(202).json({ items: [{ itemId: 'direct-call' }] });
  }, { method: 'GET', query: {}, headers: {} });
  assert.equal(result.statusCode, 202);
  assert.equal(result.body.items[0].itemId, 'direct-call');
});

test('scheduled searches skip duplicate title translations and use bounded parallel workers', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync('api/daily-refresh.js', 'utf8');
  const search = fs.readFileSync('api/ebay-search.js', 'utf8');
  assert.match(source, /skipTranslation: '1'/);
  assert.match(source, /length: 4/);
  assert.doesNotMatch(source, /req\.headers\.host/);
  assert.match(search, /skipTranslation \|\| ''\) !== '1'/);
});


test('scheduled snapshot searches six queries each for fishing and Pokémon supplies', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync('api/daily-refresh.js', 'utf8');
  const supply = [...source.matchAll(/cat: 'ポケモン関連サプライ用品', q:/g)].length;
  const fishing = [...source.matchAll(/cat: '釣具', q:/g)].length;
  assert.equal(supply, 6);
  assert.equal(fishing, 6);
});

test('scheduled snapshots discard obsolete queries but preserve failed active-query data', () => {
  const previous = [
    { query: 'obsolete query', ok: true, items: [{ itemId: 'obsolete' }] },
    { query: 'active query', ok: true, items: [{ itemId: 'cached' }] }
  ];
  const current = [
    { query: 'active query', ok: false, items: [], error: 'temporary failure' },
    { query: 'new query', ok: true, items: [{ itemId: 'new' }] }
  ];
  const merged = refresh.mergeSnapshotCategories(previous, current);
  assert.deepEqual(merged.map(row => row.query).sort(), ['active query', 'new query']);
  assert.deepEqual(merged.find(row => row.query === 'active query').items, [{ itemId: 'cached' }]);
});
