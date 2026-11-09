const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

test('Pokémon card results reject non-Japanese languages, stickers, selectable-card pages, and bulk lots', () => {
  assert.match(html, /'ポケモンカード':\/\(\?:s\[- \]\?chinese/);
  assert.match(html, /simplified chinese\|traditional chinese\|korean/);
  assert.match(html, /sticker\(\?:s\)\?/);
  assert.match(html, /choose\\s\+\(\?:your\\s\+\)\?cards\?/);
  assert.match(html, /mixed\\s\+card\\s\+lots\?/);
});

test('Pokémon supply results reject Chinese and Korean listings', () => {
  assert.match(html, /'ポケモン関連サプライ用品':\/\(\?:s\[- \]\?chinese/);
  assert.match(html, /'ポケモン関連サプライ用品':[\s\S]*?traditional chinese\|korean/);
});

test('camera results reject lens-only and unrelated mixed-model or mixed-brand titles', () => {
  assert.match(html, /const isLensOnly=/);
  assert.match(html, /const modelTokens=/);
  assert.match(html, /const multiBrand=/);
});

test('replacement-part results reject listings that require choosing an unspecified type or model', () => {
  assert.match(html, /'交換部品・消耗品':[\s\S]*?choose\\s\+\(\?:your\\s\+\)\?type/);
  assert.match(html, /select\\s\+option/);
});

test('all seven categories are present in the initial page, including replacement parts', () => {
  assert.match(html, /category\('交換部品・消耗品'\)/);
});

test('initial data refresh is not started twice before the snapshot bridge runs', () => {
  const boot = html.slice(html.lastIndexOf('data=[];')).split('</script>')[0].trim();
  assert.equal(boot.endsWith('refresh();'), false);
  const engine = fs.readFileSync('ranking-engine.js', 'utf8');
  assert.match(engine, /window\.__dailySnapshotMode=!!snapshot/);
  assert.match(engine, /await window\.refresh\(\)/);
});

test('retro-game candidate guard accepts the expanded console families', () => {
  assert.match(html, /gamecube\|game cube\|ゲームキューブ/);
  assert.match(html, /ps vita\|playstation vita/);
  assert.match(html, /pc engine\|pcエンジン\|turbografx/);
  assert.match(html, /3do/);
});

test('live eBay category search uses the same sales-evidence-aware ranking as the main app', () => {
  const live = fs.readFileSync('live-api.js', 'utf8');
  assert.match(live, /RankingEngine\.rankV2\(items/);
  assert.match(live, /p\.soldHistoryAvailable\?p\.stars:'評価保留'/);
  assert.match(live, /評価保留（販売実績未確認）/);
});

test('name enrichment is limited to the 50 candidates that can be displayed', () => {
  assert.match(html, /const list=\(items\|\|\[\]\)\.slice\(0,50\)/);
});

test('manual sold-history entry is available in the page and records median sold price', () => {
  assert.match(html, /id="manual-name"/);
  assert.match(html, /id="manual-sold"/);
  assert.match(html, /id="manual-active"/);
  assert.match(html, /id="manual-price"/);
  assert.match(html, /onclick="saveManualEvidence\(\)"/);
  assert.match(html, /soldHistoryAvailable:true,soldHistoryCount:sold,soldMedian:price/);
  assert.match(html, /sold,list:active/);
  assert.match(html, /renderManualEvidenceList\(\)/);
});

test('the live category ranking also holds products with zero sold count', () => {
  const live = fs.readFileSync('live-api.js', 'utf8');
  assert.match(live, /Number\(p\.soldHistoryCount\|\|0\)>0/);
});
