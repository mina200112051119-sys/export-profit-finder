const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const rankingSource = fs.readFileSync('ranking-engine.js', 'utf8').split('/* Daily snapshot bridge')[0];
const sourcingSource = fs.readFileSync('sourcing-compare.js', 'utf8');
const officialSearchSource = fs.readFileSync('api/official-product-search.js', 'utf8');

const rankingContext = { window: {} };
vm.runInNewContext(rankingSource, rankingContext);
const rankingEngine = rankingContext.window.RankingEngine;

const candidateStart = sourcingSource.indexOf('function candidateProfit(p, row) {');
const candidateEnd = sourcingSource.indexOf('\nfunction currentProduct', candidateStart);
assert.notEqual(candidateStart, -1, 'candidateProfit exists');
assert.notEqual(candidateEnd, -1, 'candidateProfit end marker exists');
const candidateProfitSource = sourcingSource.slice(candidateStart, candidateEnd);

function runCandidateProfit({ domestic = 2000, pack = 800, other = 500, conv = 3, sourcingShipping = 0 } = {}) {
  const window = {
    RankingEngine: rankingEngine,
    __exportApp: { getFx: () => 150 }
  };
  const document = {
    getElementById(id) {
      return { value: ({ domestic, pack, other, conv })[id] };
    }
  };
  const candidateProfit = vm.runInNewContext(
    '(' + candidateProfitSource + ')',
    { window, document, feeOf: () => 0.1325, Math, Number }
  );
  return candidateProfit(
    { sell: 44159 / 150, ship: 3188 / 150, shippingKnown: true, cat: 'ポケモンカード' },
    { priceJpy: 30000, shippingJpy: sourcingShipping }
  );
}

test('category list hides search diagnostics but keeps candidate counts', () => {
  const start = html.indexOf('function renderCats()');
  const end = html.indexOf('\nfunction refreshCurrentRanking', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const renderCats = html.slice(start, end);
  assert.match(renderCats, /現在出品候補/);
  assert.doesNotMatch(renderCats, /検索成功|検索結果合計|検索状況|rawUniqueItems|matchedItems/);
});

test('profit example includes buyer-tax allowance and Japanese consumption tax on eBay fees', () => {
  assert.equal(runCandidateProfit(), 4055);
});

test('supplier shipping is deducted once and separately from the purchase price', () => {
  assert.equal(runCandidateProfit({ sourcingShipping: 250 }), 3805);
});


test('eBay fee tax is included separately at 10 percent', () => {
  const result = rankingEngine.calcCosts(
    { sell: 100, ship: 10, shippingKnown: true, cost: 10000 },
    { fxRate: 150, feeRate: 0.15, internationalRate: 0.0135, conversionFeeRate: 0 }
  );
  assert.equal(result.salesTaxAllowanceRate, 0.10);
  assert.equal(result.feeBasisJpy, Math.round(result.grossSaleJpy * 1.10));
  assert.equal(result.feeTaxRate, 0.10);
  assert.equal(result.feeTaxJpy, Math.round(result.feesBeforeTax * 0.10));
  assert.equal(result.totalFees, Math.round(result.feesBeforeTax) + result.feeTaxJpy);
});

test('profit remains unconfirmed when eBay shipping is unavailable', () => {
  const result = rankingEngine.calcCosts(
    { sell: 44159 / 150, ship: null, shippingKnown: false, cost: 30000, sourcingShippingJpy: 0 },
    { fxRate: 150, feeRate: 0.1325, internationalRate: 0.0135, conversionFeeRate: 3,
      domesticShipping: 2000, packaging: 800, otherCost: 500 }
  );
  assert.equal(result.profit, null);
});

test('Pokemon card candidates reject metal display replicas', () => {
  const filterStart = html.indexOf('function acceptCandidate(p,cat){');
  const start = html.indexOf("if(cat==='ポケモンカード'){", filterStart);
  const end = html.indexOf("if(cat==='ポケモン関連サプライ用品'){", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const cardFilter = html.slice(start, end);
  assert.match(cardFilter, /metal card|metal pokemon|gold plated|gold-plated|collector\.?s edition|display piece|replica|proxy card|custom card|fake card/);
});

test('retro-game candidates reject choose-from-a-menu listings', () => {
  const filterStart = html.indexOf('function acceptCandidate(p,cat){');
  const start = html.indexOf("if(cat==='レトロゲーム'){", filterStart);
  const end = html.indexOf("if(cat==='ガンプラ'){", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const retroFilter = html.slice(start, end);
  assert.match(retroFilter, /choose\\s+from|choose\\s+.*games?|ゲームを選んで|選択してください/);
});

test('known Pokemon card identifiers normalize Zekrom ex and Iono to Japanese searchable names', () => {
  assert.ok(html.includes("number:'169/086',name:/ZEKROM\\s*EX/i"));
  assert.ok(html.includes('ゼクロムex｜ブラックボルト｜169/086｜SAR'));
  assert.ok(html.includes("number:'091/071',name:/POKEMON\\s*SUPPORTER|SUPPORTER|IONO|ナンジャモ/i"));
  assert.ok(html.includes('ナンジャモ｜クレイバースト｜091/071｜SR'));
});

test('official Pokemon card lookup uses the live card-name search route', () => {
  const start = officialSearchSource.indexOf('async function searchPokemonCardsOfficial(query) {');
  const end = officialSearchSource.indexOf('module.exports', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const lookup = officialSearchSource.slice(start, end);
  assert.match(lookup, /card-search\/index\.php/);
  assert.match(lookup, /searchParams\.set\('pokemon'/);
  assert.match(lookup, /new URL\(href, searchUrl\)/);
});

test('Sega and PlayStation lookups are not falsely reported as no official match', () => {
  assert.match(officialSearchSource, /manual_verification_required/);
  assert.match(officialSearchSource, /playstation.*sega|sega.*playstation/is);
});


test('opening the app loads the saved daily snapshot without starting an eBay product search', () => {
  const bridge = fs.readFileSync('ranking-engine.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /function loadServerRankingSnapshot\(\)/);
  assert.match(html, /Promise\.resolve\(loadServerRankingSnapshot\(\)\)/);
  assert.doesNotMatch(bridge, /window\.refresh\(\)/);
  assert.doesNotMatch(bridge, /__dailySnapshotMode/);
  assert.match(html, /ページを開いただけではeBay検索を行いません/);
  assert.match(html, /onclick="refresh\(\)"/);
  assert.match(html, /async function refresh\(\)/);
  const vercel = fs.readFileSync('vercel.json', 'utf8');
  assert.match(vercel, /"schedule":\s*"0 21 \* \* \*"/);
});
