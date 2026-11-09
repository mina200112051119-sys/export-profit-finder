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
