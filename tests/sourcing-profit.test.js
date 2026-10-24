const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('sourcing candidate profit delegates buyer-paid shipping and sourcing costs to RankingEngine', () => {
  const source = fs.readFileSync('sourcing-compare.js', 'utf8');
  const start = source.indexOf('function candidateProfit(p, row) {');
  assert.notEqual(start, -1, 'candidateProfit function exists');
  const end = source.indexOf('\n}', start);
  assert.notEqual(end, -1, 'candidateProfit function closes');
  const fnSource = source.slice(start, end + 2);
  let receivedProduct;
  let receivedSettings;
  const candidateProfit = vm.runInNewContext('(' + fnSource + ')', {
    feeOf: () => 0.136,
    window: {
      RankingEngine: {
        calcCosts(product, settings) {
          receivedProduct = product;
          receivedSettings = settings;
          return { profit: 2029 };
        }
      },
      __exportApp: { getFx: () => 150 }
    },
    document: { getElementById: () => ({ value: '0' }) },
    Math,
    Number
  });

  const profit = candidateProfit(
    { sell: 20, ship: 5, cat: '釣具' },
    { priceJpy: 1000, shippingJpy: 100 }
  );

  assert.equal(profit, 2029);
  assert.equal(receivedProduct.sell, 20);
  assert.equal(receivedProduct.ship, 5);
  assert.equal(receivedProduct.cost, 1000);
  assert.equal(receivedProduct.sourcingShippingJpy, 100);
  assert.equal(receivedSettings.fxRate, 150);
  assert.equal(receivedSettings.feeRate, 0.136);
  assert.equal(receivedSettings.internationalRate, 0.0135);
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
  const functionSource = (name, nextName) => {
    const start = source.indexOf('function ' + name + '(');
    const end = source.indexOf('\nfunction ' + nextName + '(', start);
    assert.notEqual(start, -1, name + ' function exists');
    assert.notEqual(end, -1, name + ' function boundary exists');
    return source.slice(start, end).trim();
  };
  const context = {
    num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    round: value => Math.round(Number(value) || 0),
    clamp: (value, min = 0, max = 100) => Math.max(min, Math.min(max, value)),
    Math,
    Number
  };
  const calcCosts = vm.runInNewContext('(' + functionSource('calcCosts', 'sellThrough') + ')', context);
  const projectedPrice = (p, days) => days === 30 ? 18 : days === 60 ? 17 : 16;
  const simulateRisk = vm.runInNewContext('(' + functionSource('simulateRisk', 'inventoryRiskScore') + ')', {
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

test('default refresh queries distinguish retro games from Gunpla', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /'レトロゲーム':'Japanese retro video game Nintendo Sega PlayStation'/);
  assert.match(html, /'ガンプラ':'Bandai Spirits Gunpla plastic model kit Japan'/);
  assert.match(html, /ebay\(defaultSearchQueryForCategory\(c\)\)/);
});

test('daily snapshot category mapping matches all current refresh queries', () => {
  const engine = fs.readFileSync('ranking-engine.js', 'utf8');
  for (const query of [
    "'Pokemon card graded rare Japanese':'ポケモンカード'",
    "'Pokemon Center Japan limited official merchandise sealed':'ポケモン関連サプライ用品'",
    "'Shimano Daiwa fishing reel Japan':'釣具'",
    "'Japanese digital camera Canon Nikon Fujifilm':'カメラ'",
    "'Japanese retro video game Nintendo Sega PlayStation':'レトロゲーム'",
    "'Bandai Spirits Gunpla plastic model kit Japan':'ガンプラ'"
  ]) assert.ok(engine.includes(query), 'snapshot map contains ' + query);
});

test('scheduled daily refresh includes all six current product categories', () => {
  const cron = fs.readFileSync('api/daily-refresh.js', 'utf8');
  for (const entry of [
    "cat: 'ポケモンカード', q: 'Pokemon card graded rare Japanese'",
    "cat: 'ポケモン関連サプライ用品', q: 'Pokemon Center Japan limited official merchandise sealed'",
    "cat: '釣具', q: 'Shimano Daiwa fishing reel Japan'",
    "cat: 'カメラ', q: 'Japanese digital camera Canon Nikon Fujifilm'",
    "cat: 'レトロゲーム', q: 'Japanese retro video game Nintendo Sega PlayStation'",
    "cat: 'ガンプラ', q: 'Bandai Spirits Gunpla plastic model kit Japan'"
  ]) assert.ok(cron.includes(entry), 'scheduled refresh contains ' + entry);
});

test('applying or clearing a sourcing price refreshes the current ranking view', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /function refreshCurrentRanking\(\)\{if\(!\$\('ranking'\)\)return;renderList\(rank\(currentRankingCategory\),currentRankingTitle\)\}/);
  assert.match(html, /updateVisibleProfit\(p\);\s*refreshCurrentRanking\(\);/);
  assert.match(html, /clearSourcingOverride\(id\);if\(p\)\{updateVisibleProfit\(p\);refreshCurrentRanking\(\);\}/);
  assert.match(html, /function category\(c\)\{currentRankingCategory=c;currentRankingTitle=/);
});


test('selected sourcing candidate remains attached to its stable row ID after insertions or reordering', () => {
  const source = fs.readFileSync('sourcing-compare.js', 'utf8');
  const start = source.indexOf('function isSelectedCandidate(selectedInfo, row, index) {');
  const end = source.indexOf('\n}\n', start);
  assert.notEqual(start, -1, 'selection helper exists');
  assert.notEqual(end, -1, 'selection helper closes');
  const isSelectedCandidate = vm.runInNewContext('(' + source.slice(start, end + 2) + ')', {
    String
  });

  const savedSelection = { candidateId: 'row-b', candidateIndex: 0 };
  const afterInsertion = [
    { id: 'row-new' },
    { id: 'row-a' },
    { id: 'row-b' }
  ];
  assert.equal(afterInsertion.some((row, index) => isSelectedCandidate(savedSelection, row, index)), true);
  assert.equal(isSelectedCandidate(savedSelection, afterInsertion[0], 0), false);
  assert.equal(isSelectedCandidate(savedSelection, afterInsertion[2], 2), true);

  // Older saved selections without candidateId remain readable.
  assert.equal(isSelectedCandidate({ candidateIndex: 1 }, { id: 'legacy' }, 1), true);
  assert.equal(isSelectedCandidate({ candidateIndex: 1 }, { id: 'legacy' }, 0), false);

  assert.match(source, /candidateId:String\(row\.id\)/);
  assert.match(source, /if \(row\.domesticSearchName\) saveDomesticSearchName\(p, row\.domesticSearchName\)/);
  assert.match(source, /if \(row\.officialCandidate\) \{ selectedOfficialCandidate = \{ \.\.\.row\.officialCandidate \}; writeOfficialCandidate\(p, selectedOfficialCandidate\); drawSelectedOfficialCandidate\(\); \}/);
});


test('detail sourcing links prefer saved Japanese domestic search name', () => {
  const source = fs.readFileSync('index.html', 'utf8');
  assert.match(source, /function domesticSearchQuery\(p\)/);
  assert.match(source, /localStorage\.getItem\('domesticSearchName:v1:'\+String\(p\.id\)\)/);
  assert.match(source, /sourceSearchUrls\(domesticSearchQuery\(p\)\)/);
  assert.match(source, /p\.displayName\|\|p\.titleJa\|\|p\.name/);
});


test('sourcing selected marker uses stable candidate ID after reorder and deletion', () => {
  const source = fs.readFileSync('sourcing-compare.js', 'utf8');
  assert.match(source, /isSelectedCandidate\(window\.__exportApp\?\.getSelectedSourcing\?\.\(p\.id\),r,i\)\?'<div class="notice"/);
  const start = source.indexOf('function isSelectedCandidate(selectedInfo, row, index) {');
  const end = source.indexOf('\n}\n', start);
  const isSelectedCandidate = vm.runInNewContext('(' + source.slice(start, end + 2) + ')', { String });
  const selected = { candidateId: 'stable-b', candidateIndex: 0 };
  const rows = [{id:'new'}, {id:'stable-a'}, {id:'stable-b'}];
  assert.equal(rows.map((row,index)=>isSelectedCandidate(selected,row,index)).filter(Boolean).length, 1);
  assert.equal(isSelectedCandidate(selected, rows[2], 2), true);
});

test('saving a sourcing candidate rejects negative domestic shipping', () => {
  const source = fs.readFileSync('sourcing-compare.js', 'utf8');
  assert.match(source, /if \(!Number\.isFinite\(shipping\) \|\| shipping < 0\)/);
  assert.match(source, /国内送料は0円以上で入力してください/);
  assert.match(source, /shippingJpy: shipping/);
});


test('deleting the active stable-ID sourcing candidate clears its applied cost', () => {
  const source = fs.readFileSync('sourcing-compare.js', 'utf8');
  assert.match(source, /const removed = next\[index\]/);
  assert.match(source, /String\(selected\.candidateId\) === String\(removed\.id\)/);
  assert.match(source, /window\.__exportApp\?\.clearSourcingCost\?\.\(p\.id\)/);
  assert.match(source, /採用中の仕入れ候補を削除したため、分析に反映した仕入れ価格も解除しました/);
});


test('sourcing comparison profit delegates to the shared RankingEngine cost calculation', () => {
  const source = fs.readFileSync('sourcing-compare.js', 'utf8');
  const start = source.indexOf('function candidateProfit(p, row) {');
  const end = source.indexOf('\n}', start) + 2;
  assert.notEqual(start, -1, 'candidate profit helper exists');
  assert.notEqual(end, 1, 'candidate profit helper closes');
  const helper = source.slice(start, end);
  assert.match(helper, /window\.RankingEngine/);
  assert.match(helper, /engine\.calcCosts\(/);
  assert.match(helper, /cost: Number\(row\.priceJpy\)/);
  assert.match(helper, /sourcingShippingJpy: Math\.max\(0, Number\(row\.shippingJpy \|\| 0\)\)/);
  assert.match(helper, /feeRate: feeOf\(p\)/);
  assert.match(helper, /conversionFeeRate: g\('conv'\)/);
  assert.match(helper, /domesticShipping: g\('domestic'\)/);
  assert.match(helper, /packaging: g\('pack'\)/);
  assert.match(helper, /otherCost: g\('other'\)/);
  assert.match(helper, /costs\?\.profit == null \? null : Number\(costs\.profit\)/);
});
