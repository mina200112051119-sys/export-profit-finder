const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize } = require('../product-name-normalizer.js');

test('Pokémon card name keeps only Pokémon, set, and card number', () => {
  const value = normalize(
    { name: 'Mew 8/53 WOTC Promo Pokemon Card Near Mint Collector Edition' },
    'ポケモンカード',
    'ミュウ｜Wizards Black Star Promos｜8/53｜プロモ'
  );
  assert.equal(value, 'ミュウ｜ブラックスタープロモ｜8/53');
});

test('Pokémon card keeps set and number but removes rarity and seller wording', () => {
  const value = normalize(
    { name: 'Mew ex Japanese 151 SAR 205/165 Near Mint' },
    'ポケモンカード',
    'ミュウex｜ポケモンカード151｜205/165｜SAR｜美品'
  );
  assert.equal(value, 'ミュウex｜151｜205/165');
});

test('camera display is manufacturer and model only', () => {
  assert.equal(
    normalize({ name: 'Nikon COOLPIX S6800 Digital Camera Tested Working' }, 'カメラ', 'ニコン｜COOLPIX S6800｜デジタルカメラ｜動作確認済み'),
    'ニコン COOLPIX S6800'
  );
});

test('fishing display removes descriptive filler', () => {
  assert.equal(
    normalize({ name: 'Daiwa FUEGO CT103SHL baitcasting reel left hand tested' }, '釣具', 'ダイワ｜フエゴ CT103SHL｜ベイトリール｜左ハンドル｜動作確認済み'),
    'ダイワ FUEGO CT103SHL'
  );
});

test('supply display keeps product identity and removes bundle filler', () => {
  assert.equal(
    normalize({ name: 'Pokemon Center Kagawa Binder Card File Set of 2' }, 'ポケモン関連サプライ用品', 'ポケモンセンター カガワ｜バインダー・カードファイル｜セット内容確認が必要'),
    'ポケモンセンター カガワ｜バインダー｜カードファイル'
  );
});

test('retro game display keeps platform and game title', () => {
  assert.equal(
    normalize({ name: 'Sony PlayStation 1 Vib-Ribbon Tested Complete In Box' }, 'レトロゲーム', 'PS1｜ゲームソフト｜ビブリボン｜商品名の一致未確認'),
    'PS1｜ビブリボン'
  );
});

test('Gunpla display removes grade, scale and sales wording but keeps model', () => {
  assert.equal(
    normalize({ name: 'Bandai Spirits MGSD Kshatriya 1/100 Model Kit New' }, 'ガンプラ', 'バンダイ｜MGSD｜1/100｜クシャトリヤ｜ガンプラ'),
    'MGSD｜クシャトリヤ'
  );
});

test('replacement parts display keeps brand, part and compatible model only', () => {
  assert.equal(
    normalize({ name: 'Shimano genuine fishing reel line roller replacement for Stella 2500' }, '交換部品・消耗品', 'シマノ｜ラインローラー｜対応機種未確認'),
    'シマノ｜ラインローラー｜Stella 2500'
  );
});
