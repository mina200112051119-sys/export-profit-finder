const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('function acceptCandidate(p,cat){');
const end = html.indexOf('\nif(typeof originalMap', start);
assert.notEqual(start, -1, 'acceptCandidate must exist');
assert.notEqual(end, -1, 'acceptCandidate end marker must exist');
const source = html.slice(start, end);
const context = {};
vm.runInNewContext(source + '\nglobalThis.acceptCandidate = acceptCandidate;', context);
const accept = context.acceptCandidate;

test('retro: rejects generic choose-a-game seller menu', () => {
  assert.equal(accept({title:'Sega Saturn Sega CD 3DO Sega Dreamcast Tested - Select a game'}, 'レトロゲーム'), false);
});
test('retro: rejects Japanese translated game-selection menu', () => {
  assert.equal(accept({title:'セガサターン、セガCD、3DO、セガドリームキャストなど テスト済み - ゲームを選んでください'}, 'レトロゲーム'), false);
});
test('retro: keeps a named PlayStation game', () => {
  assert.equal(accept({title:'Sony PlayStation 1 Vib-Ribbon game software'}, 'レトロゲーム'), true);
});
test('Gunpla: keeps a named HG kit', () => {
  assert.equal(accept({title:'Bandai HG 1/144 MS-05 Zaku I Gundam plastic model kit'}, 'ガンプラ'), true);
});
test('Gunpla: rejects tools', () => {
  assert.equal(accept({title:'Bandai HG Gundam nipper tool'}, 'ガンプラ'), false);
});
test('Gunpla: keeps decals as classified modification parts but rejects generic replacement parts', () => {
  assert.equal(accept({title:'Bandai HG Gundam water slide decal replacement parts'}, 'ガンプラ'), true);
  assert.equal(accept({title:'Bandai Gundam replacement parts'}, 'ガンプラ'), false);
});

const retroStart = html.indexOf('function classifyRetroListing(p){');
const retroEnd = html.indexOf('\nfunction classifyGunplaListing', retroStart);
assert.notEqual(retroStart, -1, 'classifyRetroListing must exist');
assert.notEqual(retroEnd, -1, 'classifyRetroListing end marker must exist');
const retroContext = {};
vm.runInNewContext(
  html.slice(retroStart, retroEnd) + '\nglobalThis.classifyRetroListing = classifyRetroListing;',
  retroContext
);
const classifyRetro = retroContext.classifyRetroListing;

test('retro: rejects an HVC-002 adapter even when seller title says console', () => {
  const item = {name:'Super Famicom console, Japan', title:'Super Famicom console, Japan (HVC-002)'};
  assert.equal(accept(item, 'レトロゲーム'), false);
  assert.equal(classifyRetro(item).productType, '周辺機器');
});

test('retro: retains a real Super Famicom console with SHVC-001 and included adapter', () => {
  const item = {name:'Super Famicom console SHVC-001 with AC adapter HVC-002'};
  assert.equal(accept(item, 'レトロゲーム'), true);
  assert.equal(classifyRetro(item).productType, 'ゲーム機本体');
});

test('retro: reads accessory model codes from title when name is generic', () => {
  const item = {name:'本体、日本', title:'Nintendo Famicom power adapter HVC-002'};
  assert.equal(classifyRetro(item).model, 'HVC-002');
  assert.equal(classifyRetro(item).productType, '周辺機器');
});


test('retro: keeps Pokémon video games but rejects Pokémon trading cards', () => {
  assert.equal(accept({title:'Nintendo Game Boy Pokémon Red Version game cartridge'}, 'レトロゲーム'), true);
  assert.equal(accept({title:'Pokemon TCG Charizard trading card'}, 'レトロゲーム'), false);
});

const identityStart = html.indexOf('function categoryIdentityKey(p,cat){');
const identityEnd = html.indexOf('\nasync function enrichSold', identityStart);
assert.notEqual(identityStart, -1, 'categoryIdentityKey must exist');
assert.notEqual(identityEnd, -1, 'categoryIdentityKey end marker must exist');
const identityContext = {classifyRetroListing: classifyRetro};
vm.runInNewContext(
  html.slice(identityStart, identityEnd) + '\nglobalThis.categoryIdentityKey = categoryIdentityKey;',
  identityContext
);
test('retro: same model and same Japanese display name deduplicate despite seller bundle wording', () => {
  const one = {name:'Super Famicom SHVC-001 console with controller',displayName:'スーパーファミコン｜SHVC-001｜ゲーム機本体'};
  const two = {name:'Super Famicom SHVC-001 console set tested',displayName:'スーパーファミコン｜SHVC-001｜ゲーム機本体'};
  assert.equal(
    identityContext.categoryIdentityKey(one, 'レトロゲーム'),
    identityContext.categoryIdentityKey(two, 'レトロゲーム')
  );
});


test('Pokémon supplies: official card collection files are retained', () => {
  assert.equal(accept({title:'Pokemon Center Card Game Collection File Pro Pikachu Japan'}, 'ポケモン関連サプライ用品'), true);
});

test('camera: a camera kit with an included lens is retained, while a lens-only listing is rejected', () => {
  assert.equal(accept({title:'Sony Alpha NEX-6 Mirrorless Camera w/ 16-50mm Lens 16.1MP Black - Tested'}, 'カメラ'), true);
  assert.equal(accept({title:'Sony 16-50mm camera lens only'}, 'カメラ'), false);
});

test('replacement parts: Daiwa drag-parts kits and Dreamcast power supplies are retained', () => {
  assert.equal(accept({title:'For Daiwa Fishing Reel Drag Parts Kit with Clicker and Sprocket Washers'}, '交換部品・消耗品'), true);
  assert.equal(accept({title:'Sega Dreamcast OEM Power Supply Unit PSU VA1'}, '交換部品・消耗品'), true);
});

test('Gunpla: an explicit MG model kit is not rejected for incidental action-figure wording', () => {
  assert.equal(accept({title:'BANDAI MG Master Grade 1/100 GUNDAM 0080 MS-18E Kampfer Action Figure Model Kit'}, 'ガンプラ'), true);
});


test('Pokémon supplies: damage-counter cases, player coins, and dice are retained', () => {
  assert.equal(accept({title:'Pokemon Card Game Damage Counter Case + Counters & Coin Set Japan'}, 'ポケモン関連サプライ用品'), true);
});

test('camera: a 35mm film SLR camera kit with an included lens is retained', () => {
  assert.equal(accept({title:'Minolta X-370 35mm Film SLR Camera Kit with 50mm OEM Lens, Tested and Working'}, 'カメラ'), true);
});

test('Gunpla: painted model kits remain candidates, but paint-only products are rejected', () => {
  assert.equal(accept({title:'Bandai HG 1/144 Gundam Base Limited MS-06C-6 Zaku II Type C-6 Painting Model'}, 'ガンプラ'), true);
  assert.equal(accept({title:'BANDAI MG Master Grade 1/100 Infinite Justice Gundam Model Kit Painted'}, 'ガンプラ'), true);
  assert.equal(accept({title:'Bandai Gundam paint set for model kits'}, 'ガンプラ'), false);
});

test('replacement parts: Bandai Gunpla option parts are identified as parts, not complete kits', () => {
  assert.equal(accept({title:'Bandai 1/144 HG Gundam Option Parts Set Gunpla 13 Battle Arm Arms'}, '交換部品・消耗品'), true);
  assert.equal(accept({title:'Bandai Gundam replacement parts'}, '交換部品・消耗品'), false);
});


test('camera fallback: Minolta X-370 is identified as a film camera with its model number', () => {
  const buildStart = html.indexOf('function buildUnverifiedJapaneseIdentity(p, categoryOverride){');
  const buildEnd = html.indexOf('\nwindow.buildUnverifiedJapaneseIdentity', buildStart);
  assert.notEqual(buildStart, -1);
  assert.notEqual(buildEnd, -1);
  const buildContext = {};
  vm.runInNewContext(html.slice(buildStart, buildEnd) + '\nglobalThis.buildIdentity = buildUnverifiedJapaneseIdentity;', buildContext);
  assert.equal(buildContext.buildIdentity({title:'Minolta X-370 35mm Film SLR Camera Kit with 50mm OEM Lens'}, 'カメラ'), 'ミノルタ｜X-370｜フィルムカメラ｜正式名称未確認');
});
