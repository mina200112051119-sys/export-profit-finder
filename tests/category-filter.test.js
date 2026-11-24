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

test('live eBay category search uses the shared ranking engine and excludes incomplete listings', () => {
  const live = fs.readFileSync('live-api.js', 'utf8');
  const engine = fs.readFileSync('ranking-engine.js', 'utf8');
  assert.match(live, /RankingEngine\.rankV2\(eligibleItems/);
  assert.match(live, /p\.shippingKnown!==false&&p\.ship!==null&&p\.ship!==undefined&&Boolean\(p\.url\)/);
  assert.match(live, /autoConversionFee:true,payoutCurrency:'USD'/);
  assert.match(engine, /if\(!p\.soldHistoryAvailable\|\|num\(p\.soldHistoryCount\)<=0\) total=Math\.min\(total,44\)/);
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

test('live category ranking does not claim sales evidence when sold history is unavailable', () => {
  const live = fs.readFileSync('live-api.js', 'utf8');
  const engine = fs.readFileSync('ranking-engine.js', 'utf8');
  assert.match(live, /販売済み実績なし/);
  assert.match(engine, /過去90日実売データは未取得/);
  assert.match(engine, /total=Math\.min\(total,44\)/);
});

test('recommended candidates exclude unknown shipping and missing eBay URLs, with a 30-item category cap', () => {
  assert.ok(html.includes('p.shippingKnown!==false&&p.ship!==null&&p.ship!==undefined&&Boolean(p.url)'));
  assert.ok(html.includes('return safe.slice(0,30)'));
  assert.ok(html.includes('function renderList(list,title,reviewList=[]){const ranked=list.slice(0,30)'));
  assert.ok(html.includes('.slice(0,30)'));
});

test('category buttons display only the recommended candidate count', () => {
  const start = html.indexOf('function renderCats(){');
  const end = html.indexOf('function refreshCurrentRanking()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const renderCats = html.slice(start, end);
  assert.ok(renderCats.includes("現在出品候補 '+all+'件"));
  assert.doesNotMatch(renderCats, /検索成功|取得 |検索結果合計|検索状況/);
});

// Live rankings use only verified listing fields; they do not invent sold-history evidence.

test('photo candidate cards do not repeat an unverified product-name warning', () => {
  const start = html.indexOf("$('photoResults').innerHTML=window.photoCandidates.map");
  const end = html.indexOf("catch(e){$('photoMsg')", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const photoCard = html.slice(start, end);
  assert.doesNotMatch(photoCard, /officialNameStatus\|\|'名称未確認'/);
  assert.match(photoCard, /condition\|\|'状態不明'/);
});


test('main candidate UI uses recommendation wording and clearly disclaims unavailable sales history', () => {
  assert.match(html, /カテゴリー別おすすめ/);
  assert.match(html, /おすすめ候補（現在出品情報ベース）/);
  assert.match(html, /売れた実績を示すものではありません/);
  assert.doesNotMatch(html, /仕入れ候補ランキング|カテゴリー別ランキング/);
});

test('candidate recommendation ordering breaks equal scores using information completeness', () => {
  const engine = fs.readFileSync('ranking-engine.js', 'utf8');
  assert.match(engine, /b\.dataCompleteness\?\.score/);
  assert.match(engine, /officialNameVerified/);
  assert.match(engine, /shippingKnown/);
});


test('all user-facing main-page labels use recommendations rather than rankings', () => {
  assert.match(html, /カテゴリー別おすすめ/);
  assert.match(html, /おすすめ候補/);
  assert.doesNotMatch(html, /候補ランキング|カテゴリー別ランキング|ランキングではありません|ランキングに反映しました/);
});


test('iOS Home Screen cloud identity prefers the app-local ID over a copied cookie', () => {
  assert.match(html, /let id=localId\|\|cookieId/);
  assert.doesNotMatch(html, /let id=cookieId\|\|localId/);
});


test('manual cloud save verifies favorites by reading the same cloud identity back', () => {
  assert.match(html, /onclick="saveCloudStorage\(\)">☁️ 今すぐクラウド保存/);
  assert.match(html, /const verify=await fetch\(CLOUD_STORAGE_API/);
  assert.match(html, /保存確認済み（マイリスト/);
  assert.match(html, /保存後の確認に失敗/);
  assert.match(html, /let id=localId\|\|cookieId/);
});
