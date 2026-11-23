const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('ranking-engine.js', 'utf8'), context);
const engine = context.window.RankingEngine;

test('currency conversion fee is 0% when listing and payout currencies match', () => {
  const p = engine.normalizeProduct({ currency: 'USD', sell: 100, ship: 0, cost: 1000 });
  const costs = engine.calcCosts(p, { fxRate: 150, feeRate: 0.136, internationalRate: 0.0135, autoConversionFee: true, payoutCurrency: 'USD' });
  assert.equal(costs.conversionFeeRate, 0);
  assert.equal(costs.conversionFeeJpy, 0);
  assert.equal(costs.profit !== null, true);
});

test('currency conversion fee is 3% when listing and payout currencies differ', () => {
  const p = engine.normalizeProduct({ currency: 'EUR', sell: 100, ship: 0, cost: 1000 });
  const costs = engine.calcCosts(p, { fxRate: 150, feeRate: 0.136, internationalRate: 0.0135, autoConversionFee: true, payoutCurrency: 'USD' });
  assert.equal(costs.conversionFeeRate, 3);
  assert.equal(costs.conversionFeeJpy, 450);
  assert.equal(costs.profit !== null, true);
});

test('listing currency is retained when normalizing eBay products', () => {
  assert.equal(engine.normalizeProduct({ currency: 'GBP' }).currency, 'GBP');
});

test('the settings screen explains that conversion fees are calculated automatically', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /商品通貨を自動確認して0%または3%を計算/);
  assert.match(html, /autoConversionFee:true,payoutCurrency:'USD'/);
});
