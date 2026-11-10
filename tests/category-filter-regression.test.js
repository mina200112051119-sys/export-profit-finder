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
test('Gunpla: rejects decals and replacement parts', () => {
  assert.equal(accept({title:'Bandai HG Gundam water slide decal replacement parts'}, 'ガンプラ'), false);
});
