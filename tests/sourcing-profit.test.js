const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('sourcing candidate profit includes buyer-paid shipping in revenue, matching RankingEngine', () => {
  const source = fs.readFileSync('sourcing-compare.js', 'utf8');
  const start = source.indexOf('function candidateProfit(p, row) {');
  assert.notEqual(start, -1, 'candidateProfit function exists');
  const end = source.indexOf('\n}\n', start);
  assert.notEqual(end, -1, 'candidateProfit function closes');
  const fnSource = source.slice(start, end + 2);
  const candidateProfit = vm.runInNewContext('(' + fnSource + ')', {
    feeOf: () => 0.136,
    window: { __exportApp: { getFx: () => 150 } },
    document: { getElementById: () => ({ value: '0' }) },
    Math,
    Number
  });

  const profit = candidateProfit(
    { sell: 20, ship: 5, cat: '釣具' },
    { priceJpy: 1000, shippingJpy: 100 }
  );

  // (20 USD item + 5 USD buyer shipping) * 150 JPY,
  // minus 14.95% variable fees, 0.40 USD fixed fee, and 1,100 JPY sourcing cost.
  assert.equal(profit, 2029);
});

test('break-even includes sourcing shipping, conversion fee, and buyer-paid shipping', () => {
  const source = fs.readFileSync('ranking-engine.js', 'utf8');
  const start = source.indexOf('function breakEvenPrice(p,s={}){');
  assert.notEqual(start, -1, 'breakEvenPrice function exists');
  const end = source.indexOf('\n}\n', start);
  assert.notEqual(end, -1, 'breakEvenPrice function closes');
  const fnSource = source.slice(start, end + 2);
  const breakEvenPrice = vm.runInNewContext('(' + fnSource + ')', {
    num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    round: value => Math.round(value),
    Math,
    Number
  });
  const price = breakEvenPrice(
    { cost: 1000, sourcingShippingJpy: 100, ship: 5 },
    { fxRate: 150, feeRate: .136, internationalRate: .0135,
      conversionFeeRate: 2, domesticShipping: 50, packaging: 80, otherCost: 0 }
  );
  assert.equal(price, 5);
});
