const test = require('node:test');
const assert = require('node:assert/strict');

global.window = { fetch: global.fetch };
global.location = { hostname: 'localhost' };
global.document = { addEventListener() {} };
require('../ranking-engine.js');

const { normalizeProduct, confidence, scoreV2 } = global.window.RankingEngine;

test('missing sold history is explicitly low confidence even when a listing price exists', () => {
  const product = normalizeProduct({ sell: 25, soldHistoryAvailable: false });
  assert.deepEqual(confidence(product), { level: '低', factor: 0.82 });
});

test('manually recorded active listing count is used when sold history is available', () => {
  const product = normalizeProduct({
    sell: 25,
    soldHistoryAvailable: true,
    soldHistoryCount: 60,
    activeListingsTotal: 80
  });
  assert.deepEqual(confidence(product), { level: '高', factor: 1 });
});

test('products with some but limited sales evidence remain low confidence', () => {
  const product = normalizeProduct({
    sell: 25,
    soldHistoryAvailable: true,
    soldHistoryCount: 2,
    activeListingsTotal: 10
  });
  assert.deepEqual(confidence(product), { level: '低', factor: 0.72 });
});

test('a sourcing price alone cannot turn an item without sales evidence into a scored purchase recommendation', () => {
  const product = normalizeProduct({
    id: 'camera-no-sales',
    name: 'Nikon Coolpix camera',
    cat: 'カメラ',
    cost: 1000,
    sell: 100,
    ship: 0,
    condition: 'Used',
    soldHistoryAvailable: false
  });
  const scored = scoreV2(product, { fxRate: 150, feeRate: 0.0935, internationalRate: 0.0135 }, [product]);
  assert.ok(scored.totalScore <= 44);
  assert.equal(scored.provisional, true);
  assert.equal(scored.risk, '要確認');
});

test('zero recorded sales remain on evaluation hold even when the sold-history lookup succeeded', () => {
  const product = normalizeProduct({
    id: 'camera-zero-sales',
    name: 'Nikon Coolpix camera',
    cat: 'カメラ',
    cost: 1000,
    sell: 100,
    ship: 0,
    condition: 'Used',
    soldHistoryAvailable: true,
    soldHistoryCount: 0,
    sold: 0,
    list: 20,
    activeListingsTotal: 20
  });
  const scored = scoreV2(product, { fxRate: 150, feeRate: 0.136, internationalRate: 0.0135 }, [product]);
  assert.ok(scored.totalScore <= 44);
  assert.equal(scored.provisional, true);
  assert.equal(scored.risk, '要確認');
});
