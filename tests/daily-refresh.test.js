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
