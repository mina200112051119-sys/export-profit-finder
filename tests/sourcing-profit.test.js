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

test('product profit and 30/60/90-day forecasts all include sourcing shipping', () => {
  const source = fs.readFileSync('ranking-engine.js', 'utf8');
  const extract = name => {
    const start = source.indexOf('function ' + name + '(');
    assert.notEqual(start, -1, name + ' function exists');
    const close = source.indexOf('\n}\n', start);
    const nextFunction = source.indexOf('\nfunction ', start + 1);
    if (close !== -1 && (nextFunction === -1 || close < nextFunction)) {
      return source.slice(start, close + 2);
    }
    assert.notEqual(nextFunction, -1, name + ' function closes before the next function');
    return source.slice(start, nextFunction).trim();
  };
  const context = {
    num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    round: value => Math.round(Number(value) || 0),
    clamp: (value, min = 0, max = 100) => Math.max(min, Math.min(max, value)),
    Math,
    Number
  };
  const calcCosts = vm.runInNewContext('(' + extract('calcCosts') + ')', context);
  const projectedPrice = (p, days) => days === 30 ? 18 : days === 60 ? 17 : 16;
  const simulateRisk = vm.runInNewContext('(' + extract('simulateRisk') + ')', {
    ...context, calcCosts, projectedPrice, breakEvenPrice: () => 0
  });
  const product = { sell: 20, ship: 5, cost: 1000, sourcingShippingJpy: 200 };
  const settings = { fxRate: 150, feeRate: .136, internationalRate: .0135,
    conversionFeeRate: 2, domesticShipping: 50, packaging: 80, otherCost: 0 };
  const withoutSourcingShipping = calcCosts({ ...product, sourcingShippingJpy: 0 }, settings);
  const withSourcingShipping = calcCosts(product, settings);
  assert.equal(withSourcingShipping.profit, withoutSourcingShipping.profit - 200);
  const forecast = simulateRisk(product, settings);
  assert.deepEqual(Array.from(forecast.scenarios, x => x.days), [30, 60, 90]);
  assert.ok(forecast.scenarios.every(x => x.profit !== null));
  const forecastWithoutShipping = simulateRisk({ ...product, sourcingShippingJpy: 0 }, settings);
  assert.ok(forecast.scenarios.every((x, i) => x.profit === forecastWithoutShipping.scenarios[i].profit - 200));
});
