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

test('retro and Gunpla refresh use focused queries instead of long mixed keyword searches', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const q of ['Nintendo Famicom console Japan','Super Famicom game cartridge Japan','Nintendo Game Boy game cartridge Japan','Nintendo 64 game cartridge Japan','Sega Saturn game disc Japan','Sega Dreamcast game disc Japan','Sony PlayStation PS1 PS2 game disc Japan','Bandai Gunpla HG 1/144 model kit','Bandai Gundam MG Master Grade 1/100 model kit','Bandai Gundam RG Real Grade 1/144 model kit']) assert.ok(html.includes(q), 'focused query exists: '+q);
  assert.match(html, /'交換部品・消耗品':\['Shimano genuine fishing reel spare parts/);
  assert.match(html, /for\(const c of RankingEngine\.CATEGORIES\)for\(const q of defaultSearchQueriesForCategory\(c\)\)tasks\.push\(\{cat:c,q\}\)/);
});

test('daily snapshot category mapping matches all current retro, Gunpla, and replacement-part refresh queries', () => {
  const engine = fs.readFileSync('ranking-engine.js', 'utf8');
  for (const query of [
    "'Nintendo Famicom console Japan':'レトロゲーム'",
    "'Super Famicom game cartridge Japan':'レトロゲーム'",
    "'Nintendo Game Boy game cartridge Japan':'レトロゲーム'",
    "'Nintendo 64 game cartridge Japan':'レトロゲーム'",
    "'Sega Saturn game disc Japan':'レトロゲーム'",
    "'Sega Dreamcast game disc Japan':'レトロゲーム'",
    "'Sony PlayStation PS1 PS2 game disc Japan':'レトロゲーム'",
    "'Nintendo Sega Sony retro game controller gamepad Japan':'レトロゲーム'",
    "'Game Boy Advance Nintendo DS PSP handheld console Japan':'レトロゲーム'",
    "'Bandai Gunpla HG 1/144 model kit':'ガンプラ'",
    "'Bandai Gundam MG Master Grade 1/100 model kit':'ガンプラ'",
    "'Bandai Gundam RG Real Grade 1/144 model kit':'ガンプラ'",
    "'Bandai Gundam PG Perfect Grade model kit':'ガンプラ'",
    "'Vintage Bandai Gundam plastic model kit Japan':'ガンプラ'",
    "'Shimano genuine fishing reel spare parts replacement spool line roller bail arm drag knob Japan -custom -upgrade -universal':'交換部品・消耗品'",
    "'Daiwa genuine fishing reel spare parts replacement spool line roller bail arm drag knob Japan -custom -upgrade -universal':'交換部品・消耗品'",
    "'Canon Nikon genuine camera replacement spare parts battery door eyecup body cap lens cap charger Japan':'交換部品・消耗品'",
    "'Nintendo Sega genuine retro game console replacement parts AC adapter power supply AV cable controller Japan':'交換部品・消耗品'",
    "'Bandai Gunpla genuine replacement parts runner parts decals stickers weapon parts Japan':'交換部品・消耗品'"
  ]) assert.ok(engine.includes(query), 'snapshot map contains ' + query);
});

test('scheduled daily refresh has valid separators and all focused replacement-part searches', () => {
  const cron = fs.readFileSync('api/daily-refresh.js', 'utf8');
  for (const query of [
    "Shimano genuine fishing reel spare parts replacement spool line roller bail arm drag knob Japan -custom -upgrade -universal",
    "Daiwa genuine fishing reel spare parts replacement spool line roller bail arm drag knob Japan -custom -upgrade -universal",
    "Canon Nikon genuine camera replacement spare parts battery door eyecup body cap lens cap charger Japan",
    "Nintendo Sega genuine retro game console replacement parts AC adapter power supply AV cable controller Japan",
    "Bandai Gunpla genuine replacement parts runner parts decals stickers weapon parts Japan"
  ]) assert.ok(cron.includes(query), 'scheduled refresh contains ' + query);
  assert.match(cron, /Vintage Bandai Gundam plastic model kit Japan' \},\s*\{ cat: '交換部品/);
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


test('removing a saved sourcing selection schedules cloud persistence', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /const _removeItem=Storage\.prototype\.removeItem/);
  assert.match(html, /Storage\.prototype\.removeItem=function\(k\)/);
  assert.match(html, /if\(this===localStorage\)scheduleSourcingCloudSave\(k\)/);
  assert.match(html, /function scheduleSourcingCloudSave\(k\)/);
  assert.match(html, /'selectedSourcingCost:v1:'/);
  assert.match(html, /some\(prefix=>key\.startsWith\(prefix\)\)/);
});


test('cloud storage preserves official matches and Japanese sourcing search names', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /officialCandidates,domesticSearchNames/);
  assert.match(html, /selectedOfficialCandidate:v1:/);
  assert.match(html, /domesticSearchName:v1:/);
  assert.match(html, /d\.data\.officialCandidates\|\|\{\}/);
  assert.match(html, /d\.data\.domesticSearchNames\|\|\{\}/);
  assert.match(html, /selectedOfficialCandidate:v1:'\+id/);
  assert.match(html, /domesticSearchName:v1:'\+id/);
  assert.match(html, /some\(prefix=>key\.startsWith\(prefix\)\)/);
});


test('replacement parts searches prioritize genuine model-specific spare components over generic upgrades', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /Shimano genuine fishing reel spare parts replacement spool line roller bail arm drag knob/);
  assert.match(html, /Daiwa genuine fishing reel spare parts replacement spool line roller bail arm drag knob/);
  assert.match(html, /Canon Nikon genuine camera replacement spare parts/);
  assert.match(html, /Nintendo Sega genuine retro game console replacement parts/);
  assert.match(html, /Bandai Gunpla genuine replacement parts/);
});

test('replacement parts are a first-class category with item detail and official references', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const engine = fs.readFileSync('ranking-engine.js', 'utf8');
  const sourcing = fs.readFileSync('sourcing-compare.js', 'utf8');
  const official = fs.readFileSync('api/official-product-search.js', 'utf8');
  assert.match(engine, /'交換部品・消耗品'/);
  assert.match(html, /p\.cat==='交換部品・消耗品'\?classifyPartsDetail\(p\):null/);
  assert.match(html, /部品の種類/);
  assert.match(html, /対象分野/);
  assert.match(html, /対応機種・型番の手がかり/);
  assert.match(sourcing, /'交換部品・消耗品': \[/);
  assert.match(official, /'交換部品・消耗品': \[/);
});


test('Japanese product display names prioritize model numbers and concise product types', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /COOLPIX\\s\*\[A-Z\]\?\\d\{2,4\}/);
  assert.match(html, /Samsung\|Nikon\|Canon\|Sony\|Olympus/);
  assert.match(html, /デジタルカメラ/);
  assert.match(html, /携帯ゲーム機/);
  assert.match(html, /Vlog\|Selfie/);
  assert.match(html, /function cleanProductDisplayName\(p, translated, category\)/);
});

test('fishing search separates Shimano and Daiwa and rejects mixed-brand listings', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /Shimano fishing reel spinning baitcasting Japan -Daiwa/);
  assert.match(html, /Daiwa fishing reel spinning baitcasting Japan -Shimano/);
  assert.match(html, /function fishingBrandConflict\(raw\)/);
  assert.match(html, /if\(cat==='釣具'\) return cleanFishingDisplayName\(p,translated\)/);
  assert.match(html, /lot of\|job lot\|bundle\|assorted\|choose\|select/);
});


test('listing title model candidates are not mislabeled as entirely unverified', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /出品タイトルから型番候補を確認（公式照合前）/);
  assert.match(html, /effectiveCategory==='釣具'/);
  assert.match(html, /effectiveCategory==='カメラ'/);
  assert.match(html, /\(\?:μ\|µ\)\[- \]\?\\d\{3,4\}/);
});

test('retro game, Gunpla, and replacement-part listings receive separate identity details', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /function classifyRetroListing\(p\)/);
  assert.match(html, /function classifyGunplaListing\(p\)/);
  assert.match(html, /function classifyPartsDetail\(p\)/);
  assert.match(html, /function categoryIdentityKey\(p,cat\)/);
  assert.match(html, /対応機種を特定できる型番なし/);
  assert.match(html, /完成品・組立済/);
  assert.match(html, /未組立・未開封の記載あり/);
  assert.match(html, /型番候補あり・対応機種との一致は未確認/);
  assert.match(html, /レトロゲームの商品分類/);
  assert.match(html, /ガンプラの商品分類/);
});


test('candidate shortlist expands broad categories, caps display at 50, and removes loss-making priced-in candidates', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /Japanese Pokemon TCG graded PSA CGC Japanese cards/);
  assert.match(html, /Pokemon Center Japan official playmat card binder collection file/);
  assert.match(html, /Japanese film camera 35mm rangefinder SLR/);
  assert.match(html, /Japanese mirrorless digital camera body/);
  assert.match(html, /function renderList\\(list,title,reviewList=\\[\\]\\)\\{const ranked=list\\.slice\\(0,50\\)/);
  assert.match(html, /return ranked\\.filter\\(p=>p\\.cost<=0\\|\\|\\(p\\.costs\\?\\.profit>0&&p\\.risk!==\'高\'\\)\\)/);
});

test('deduplication keeps the listing with a saved sourcing cost instead of replacing it with a cheaper duplicate', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /const priorHasSavedCost=Number\\(prior\\.cost\\|\\|0\\)>0/);
  assert.match(html, /const candidateHasSavedCost=Number\\(p\\.cost\\|\\|0\\)>0/);
  assert.ok(html.includes('candidateHasSavedCost&&!priorHasSavedCost'));
});
