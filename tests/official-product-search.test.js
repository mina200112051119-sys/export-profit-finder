const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../api/official-product-search.js');

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { this.ended = true; return this; }
  };
}

test('official Pokémon card search returns unconfirmed candidates from official HTML', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => '<html><a href="/card-search/details.php/card/12345/regu/all"><img alt="ピカチュウ" src="/assets/card/12345.png"></a></html>'
  });
  try {
    const res = responseRecorder();
    await handler({ method: 'GET', query: { category: 'ポケモンカード', q: 'ピカチュウ' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'candidate_found');
    assert.equal(res.body.verification, 'candidate_only');
    assert.equal(res.body.candidates[0].title, 'ピカチュウ');
    assert.match(res.body.candidates[0].url, /^https:\/\/www\.pokemon-card\.com\//);
  } finally {
    global.fetch = previousFetch;
  }
});

test('official-source failure is not reported as product absence', async () => {
  const previousFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503, text: async () => '' });
  try {
    const res = responseRecorder();
    await handler({ method: 'GET', query: { category: 'ポケモンカード', q: 'ピカチュウ' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.status, 'source_unavailable');
    assert.equal(res.body.verification, 'not_checked');
    assert.deepEqual(res.body.candidates, []);
  } finally {
    global.fetch = previousFetch;
  }
});

test('unknown category returns a clear unsupported-category error', async () => {
  const res = responseRecorder();
  await handler({ method: 'GET', query: { category: 'その他', q: 'テスト商品' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'unsupported category');
});


test('fishing tackle search returns candidate-only results from official Shimano/Daiwa pages', async () => {
  const previousFetch = global.fetch;
  global.fetch = async (url) => ({
    ok: true,
    status: 200,
    text: async () => String(url).includes('shimano.com')
      ? '<html><div class="product-card">リール ステラ 91,400円 <a href="/ja-JP/product/detail.html?id=1">VIEW PRODUCT</a></div></html>'
      : '<html><a href="/jp/product/productlist?item=1">ステラ</a></html>'
  });
  try {
    const res = responseRecorder();
    await handler({ method: 'GET', query: { category: '釣具', q: 'ステラ' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, 'candidate_found');
    assert.equal(res.body.verification, 'candidate_only');
    assert.ok(res.body.candidates.some(item => item.title.includes('ステラ')));
  } finally {
    global.fetch = previousFetch;
  }
});
