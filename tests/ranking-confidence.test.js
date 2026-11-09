const test = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
require('../ranking-engine.js');

const { normalizeProduct, confidence } = global.window.RankingEngine;

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
