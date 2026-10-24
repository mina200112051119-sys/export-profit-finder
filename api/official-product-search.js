const { URL } = require('url');
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
    { name: 'BANDAI SPIRITS公式 商品検索', url: 'https://www.bandaispirits.co.jp/products/search/result.php?search=true&category=1&freeword=' }
  ]
};

function normalizeText(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[\s　・･\-‐‑–—_【】「」『』()（）［］]/g, '');
}


function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

async function searchGunpla(query) {
  const searchUrl = 'https://www.bandaispirits.co.jp/products/search/result.php?search=true&category=1&freeword=' + encodeURIComponent(query);
  const response = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductLookup/1.0)' } });
  if (!response.ok) throw new Error('BANDAI SPIRITS公式商品検索の取得に失敗しました');
  const html = await response.text();
  const matches = [];
  // 公式検索結果のHTMLから商品詳細リンクと商品名を抽出。抽出できない場合は候補を作らない。
  const linkPattern = /<a\b([^>]*href=["']([^"']*(?:detail\.php|products\/[^"']+)[^"']*)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) && matches.length < 160) {
    const attrs = match[1] || '';
    const href = decodeHtml(match[2]);
    const inner = match[3] || '';
    const textTitle = decodeHtml(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
    const attrTitle = decodeHtml((attrs.match(/\btitle=["']([^"']+)["']/i) || [])[1] || '');
    const imageAlt = decodeHtml((inner.match(/<img\b[^>]*\balt=["']([^"']+)["']/i) || [])[1] || '');
    const title = [textTitle, attrTitle, imageAlt].find(value =>
      value && value.length >= 4 && !/^(商品情報|詳しくはこちら|詳細)$/u.test(value)
    ) || '';
    if (!title) continue;
    if (!/ガンダム|ガンプラ|HG\b|MG\b|RG\b|PG\b|ENTRY GRADE|SD\b|\b1\//iu.test(title)) continue;
    const url = new URL(href, 'https://www.bandaispirits.co.jp/').toString();
    if (!url.startsWith('https://www.bandaispirits.co.jp/')) continue;
    const normalizedTitle = normalizeText(title);
    const q = normalizeText(query);
    const chars = Array.from(q);
    const terms = chars.length > 1 ? chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]) : chars;
    const score = q && normalizedTitle.includes(q) ? 100 :
      terms.length ? Math.round(100 * terms.filter(term => normalizedTitle.includes(term)).length / terms.length) : 0;
    const imagePath = (inner.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) || [])[1] || '';
    const image = imagePath ? new URL(decodeHtml(imagePath), 'https://www.bandaispirits.co.jp/').toString() : '';
    if (score >= 45) matches.push({ title, url, image, date: '', sourceName: 'BANDAI SPIRITS公式商品検索', score });
  }
  const unique = [...new Map(matches.map(row => [row.url + '|' + row.title, row])).values()];
  return unique.sort((a,b) => b.score-a.score).slice(0,10);
}

async function searchPokemonGoods(query) {
  const response = await fetch('https://www.pokemon.co.jp/api/goods/index/');
  if (!response.ok) throw new Error('公式グッズ情報の取得に失敗しました');
  const payload = await response.json();
  const rows = Array.isArray(payload.results) ? payload.results : [];
  const q = normalizeText(query);
  const chars = Array.from(q);
  const terms = chars.length > 1 ? chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]) : chars;
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

async function searchCanonCameras(query) {
  const response = await fetch('https://global.canon/ja/c-museum/camera.html', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductLookup/1.0)' }
  });
  if (!response.ok) throw new Error('キヤノン公式カメラミュージアムの取得に失敗しました');
  const html = await response.text();
  const q = normalizeText(query);
  const chars = Array.from(q);
  const terms = chars.length > 1 ? chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]) : chars;
  const rows = [];
  const linkPattern = /<a\\b([^>]*href=["']([^"']+)["'][^>]*)>([\\s\\S]*?)<\\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) && rows.length < 1200) {
    const attrs = match[1] || '';
    const href = decodeHtml(match[2]);
    const inner = match[3] || '';
    const textTitle = decodeHtml(inner.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ')).trim();
    const attrTitle = decodeHtml((attrs.match(/\\btitle=["']([^"']+)["']/i) || [])[1] || '');
    const imageAlt = decodeHtml((inner.match(/<img\\b[^>]*\\balt=["']([^"']+)["']/i) || [])[1] || '');
    const title = [textTitle, attrTitle, imageAlt].find(value => value && value.length >= 3) || '';
    if (!title || title.length > 120) continue;
    const url = new URL(href, 'https://global.canon/ja/c-museum/').toString();
    if (!url.startsWith('https://global.canon/ja/c-museum/')) continue;
    if (!/camera|camera\\.html|detail|product|\\.html/i.test(url)) continue;
    const normalizedTitle = normalizeText(title);
    const score = q && normalizedTitle.includes(q) ? 100 :
      terms.length ? Math.round(100 * terms.filter(term => normalizedTitle.includes(term)).length / terms.length) : 0;
    if (score >= 45 && !/^(カメラ館|全て|Image|詳しくはこちら|詳細)$/u.test(title)) {
      rows.push({ title, url, image: '', date: '', sourceName: 'キヤノンカメラミュージアム公式', score });
    }
  }
  return [...new Map(rows.map(row => [row.url + '|' + row.title, row])).values()]
    .sort((a, b) => b.score - a.score).slice(0, 10);
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
    if (category === 'ガンプラ') {
      const candidates = await searchGunpla(query);
      return res.json({
        category, query, provider: 'BANDAI SPIRITS公式商品検索', fetchedAt: new Date().toISOString(),
        status: candidates.length ? 'candidate_found' : 'no_match', verification: 'candidate_only',
        message: candidates.length
          ? '公式検索結果から候補を取得しました。商品名・型番・画像を照合するまで正式一致とは扱いません。'
          : '公式検索結果から候補を抽出できませんでした。検索語を変えるか、公式ページで手動確認してください。',
        candidates, sources
      });
    }
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
    if (category === 'カメラ') {
      const candidates = await searchCanonCameras(query);
      return res.json({
        category, query, provider: 'キヤノンカメラミュージアム公式',
        fetchedAt: new Date().toISOString(),
        status: candidates.length ? 'candidate_found' : 'no_match',
        verification: 'candidate_only',
        message: candidates.length
          ? 'キヤノン公式カメラミュージアムから名称候補を取得しました。型番・画像・製品仕様を照合するまで正式一致とは扱いません。ニコン等の他社製品はこの検索対象に含まれません。'
          : 'キヤノン公式カメラミュージアムから一致候補を抽出できませんでした。検索語を変えるか、公式ページで手動確認してください。',
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
