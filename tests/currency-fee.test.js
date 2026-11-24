const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {} };
const engineSource = fs.readFileSync('ranking-engine.js', 'utf8');
const bridgeStart = engineSource.indexOf('/* Daily snapshot bridge');
if (bridgeStart < 0) throw new Error('RankingEngine core boundary was not found');
const coreSource = engineSource.slice(0, bridgeStart);
vm.runInNewContext(coreSource, context);
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
  assert.equal(costs.conversionFeeJpy, null);
  assert.equal(costs.profit, null);
});

test('unverified exchange rate prevents yen amounts, fees, break-even, and profit from being calculated', () => {
  const p = engine.normalizeProduct({ currency: 'USD', sell: 100, ship: 10, cost: 1000 });
  const costs = engine.calcCosts(p, { fxRate: 150, fxRateVerified: false, feeRate: 0.136, internationalRate: 0.0135, autoConversionFee: true, payoutCurrency: 'USD' });
  assert.equal(costs.fxRateVerified, false);
  assert.equal(costs.saleJpy, null);
  assert.equal(costs.totalFees, null);
  assert.equal(costs.totalCosts, null);
  assert.equal(costs.profit, null);
  assert.equal(engine.breakEvenPrice(p, { fxRate: 150, fxRateVerified: false }), null);
});

test('listing currency is retained when normalizing eBay products', () => {
  assert.equal(engine.normalizeProduct({ currency: 'GBP' }).currency, 'GBP');
});

test('the settings screen explains that conversion fees are calculated automatically', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /換算条件を確認できる場合のみ手数料を反映/);
  assert.match(html, /autoConversionFee:true,payoutCurrency:'USD'/);
});

test('main app displays original currency and blocks yen/profit claims when FX is unverified', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /fxRateVerified=false/);
  assert.match(html, /fxRateVerified=true/);
  assert.match(html, /getFx:\(\)=>fxRateVerified\?fxRate:null/);
  assert.match(html, /USD\/JPY：未取得（利益計算を停止中）/);
  assert.match(html, /listingYenLabel\(p\.sell,p\.currency\)/);
});

test('live category FX validation never substitutes a hard-coded 150 yen rate', () => {
  const live = fs.readFileSync('live-api.js', 'utf8');
  assert.match(live, /有効な為替レートがありません/);
  assert.match(live, /if\(cur==='USD'&&Number\(rate\)>0\)return value\*Number\(rate\)/);
  assert.doesNotMatch(live, /Number\(state\.fx\?\.rate\|\|window\.EXPORT_FX\|\|150\)/);
});
