const OFFICIAL_SOURCES = {
  'ポケモンカード': [
    { name: 'ポケモンカード公式 カード検索', url: 'https://www.pokemon-card.com/card-search/' }
  ],
  'ポケモン関連サプライ用品': [
    { name: 'ポケモン公式 グッズ一覧', url: 'https://www.pokemon.co.jp/goods/' }
  ],
  '釣具': [
    { name: 'シマノ公式 製品情報', url: 'https://fish.shimano.com/ja-JP' },
    { name: 'ダイワ公式 製品情報', url: 'https://www.daiwa.com/jp/product' }
  ],
  'カメラ': [
    { name: 'キヤノン公式 カメラミュージアム', url: 'https://global.canon/ja/c-museum/camera.html' },
    { name: 'ニコン公式 製品情報', url: 'https://nij.nikon.com/' }
  ],
  'レトロゲーム': [
    { name: '任天堂公式', url: 'https://www.nintendo.com/jp/' },
    { name: 'セガ公式 ゲーム情報', url: 'https://www.sega.jp/game/soft/' }
  ],
  'ガンプラ': [
    { name: 'BANDAI SPIRITS公式 商品検索', url: 'https://www.bandaispirits.co.jp/products/search/' }
  ]
};

function normalizeText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\\s　・･\-‐‑–—_【】「」『』()（）［］]/g, '');
}

async function searchPokemonGoods(query) {
  const response = await fetch('https://www.pokemon.co.jp/api/goods/index/');
  if (!response.ok) throw new Error('公式グッズ情報の取得に失敗しました');
  const payload = await response.json();
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const terms = normalizeText(query).split(/(?=.{2})/).filter(Boolean);
  const q = normalizeText(query);
  const matches = rows.map(row => {
    const title = String(row.title || '');
    const normalizedTitle = normalizeText(title);
    const score = q && normalizedTitle.includes(q) ? 100 :
      terms.length ? Math.round(100 * terms.filter(term => normalizedTitle.includes(term)).length / terms.length) : 0;
    return { title, url: row.full_uniq || '', image: row.img_1 || '', date: row.start_date || '', sourceName: 'ポケモン公式グッズ情報', score };
  }).filter(row => row.title && row.url && row.score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  return matches;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const category = String(req.query?.category || '').trim();
  const query = String(req.query?.q || '').trim().slice(0, 180);
  if (!category || !query) return res.status(400).json({ error: 'category and q are required' });
  const sources = OFFICIAL_SOURCES[category];
  if (!sources) return res.status(400).json({ error: 'unsupported category', categories: Object.keys(OFFICIAL_SOURCES) });

  try {
    if (category === 'ポケモン関連サプライ用品') {
      const candidates = await searchPokemonGoods(query);
      return res.json({
        category, query, provider: 'ポケモン公式グッズ情報',
        fetchedAt: new Date().toISOString(),
        status: candidates.length ? 'candidate_found' : 'no_match',
        verification: 'candidate_only',
        message: candidates.length
          ? '公式情報から候補を取得しました。商品名・画像・型番を照合するまで正式一致とは扱いません。'
          : '公式情報から一致候補を見つけられませんでした。検索語を変えるか、公式ページで手動確認してください。',
        candidates, sources
      });
    }
    return res.json({
      category, query, provider: null, fetchedAt: new Date().toISOString(),
      status: 'manual_verification_required', verification: 'not_checked',
      message: 'このカテゴリーは公式サイトへの検索リンクを提示します。自動取得・一致確認はまだ行っていません。',
      candidates: [], sources
    });
  } catch (error) {
    return res.status(502).json({
      category, query, status: 'source_unavailable', verification: 'not_checked',
      message: '公式情報を取得できませんでした。取得失敗を商品不存在とは扱いません。',
      candidates: [], sources, error: String(error?.message || 'source error')
    });
  }
};
