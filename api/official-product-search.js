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

async function searchNikonCameras(query) {
  const urls = [
    'https://nij.nikon.com/products/mirrorless/',
    'https://nij.nikon.com/products/discontinue_mirrorless/',
    'https://nij.nikon.com/products/lineup/mirrorless/'
  ];
  const q = normalizeText(query);
  const chars = Array.from(q);
  const terms = chars.length > 1 ? chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]) : chars;
  const rows = [];
  const pageErrors = [];
  for (const pageUrl of urls) {
    try {
      const response = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductLookup/1.0)' }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const html = await response.text();
      const linkPattern = /<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = linkPattern.exec(html)) && rows.length < 1800) {
        const href = decodeHtml(match[2]);
        let url;
        try { url = new URL(href, pageUrl).toString(); } catch { continue; }
        if (!url.startsWith('https://nij.nikon.com/products/')) continue;
        if (!/camera|mirrorless|discontinue|lineup/i.test(url)) continue;
        const inner = match[3] || '';
        const anchorText = decodeHtml(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
        // Keep context local to a product card to avoid borrowing a neighbouring model's name.
        const before = html.slice(Math.max(0, match.index - 360), match.index);
        const headings = [...before.matchAll(/<(?:h2|h3|h4)[^>]*>([\s\S]*?)<\/(?:h2|h3|h4)>/gi)];
        const heading = headings.length
          ? decodeHtml(headings[headings.length - 1][1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim()
          : '';
        const title = [heading, anchorText].find(value =>
          value && value.length >= 2 && value.length <= 100 &&
          !/^(製品情報を見る|購入はこちらから|詳細|Image|比較リストに追加)$/u.test(value)
        ) || '';
        if (!title) continue;
        const normalizedTitle = normalizeText(title);
        const score = q && normalizedTitle.includes(q) ? 100 :
          terms.length ? Math.round(100 * terms.filter(term => normalizedTitle.includes(term)).length / terms.length) : 0;
        if (score < 45) continue;
        const imagePath = (before.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) || [])[1] || '';
        let image = '';
        try { if (imagePath) image = new URL(decodeHtml(imagePath), pageUrl).toString(); } catch {}
        rows.push({ title, url, image, date: '', sourceName: 'ニコン公式製品情報', score });
      }
    } catch (error) {
      pageErrors.push(pageUrl + ': ' + String(error?.message || '取得失敗'));
    }
  }
  // One unavailable official page must not discard results from the other Nikon pages.
  if (pageErrors.length === urls.length) {
    throw new Error('ニコン公式製品情報の取得に失敗しました（' + pageErrors.join(' / ') + '）');
  }
  return [...new Map(rows.map(row => [row.url + '|' + row.title, row])).values()]
    .sort((a, b) => b.score - a.score).slice(0, 10);
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
  const linkPattern = /<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) && rows.length < 1200) {
    const attrs = match[1] || '';
    const href = decodeHtml(match[2]);
    const inner = match[3] || '';
    const textTitle = decodeHtml(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
    const attrTitle = decodeHtml((attrs.match(/\btitle=["']([^"']+)["']/i) || [])[1] || '');
    const imageAlt = decodeHtml((inner.match(/<img\b[^>]*\balt=["']([^"']+)["']/i) || [])[1] || '');
    const title = [textTitle, attrTitle, imageAlt].find(value => value && value.length >= 3) || '';
    if (!title || title.length > 120) continue;
    const url = new URL(href, 'https://global.canon/ja/c-museum/').toString();
    if (!url.startsWith('https://global.canon/ja/c-museum/')) continue;
    if (!/camera|camera\.html|detail|product|\.html/i.test(url)) continue;
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


async function searchNintendoGames(query) {
  const searchUrl = 'https://www.nintendo.com/jp/search/index.html?q=' + encodeURIComponent(query);
  const response = await fetch(searchUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductLookup/1.0)' }
  });
  if (!response.ok) throw new Error('任天堂公式検索の取得に失敗しました');
  const html = await response.text();
  const q = normalizeText(query);
  const chars = Array.from(q);
  const terms = chars.length > 1 ? chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]) : chars;
  const rows = [];
  const linkPattern = /<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) && rows.length < 1500) {
    const attrs = match[1] || '';
    const href = decodeHtml(match[2]);
    const inner = match[3] || '';
    const textTitle = decodeHtml(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
    const attrTitle = decodeHtml((attrs.match(/\btitle=["']([^"']+)["']/i) || [])[1] || '');
    const imageAlt = decodeHtml((inner.match(/<img\b[^>]*\balt=["']([^"']+)["']/i) || [])[1] || '');
    const title = [textTitle, attrTitle, imageAlt].find(value => value && value.length >= 3 && value.length <= 140) || '';
    if (!title) continue;
    const url = new URL(href, 'https://www.nintendo.com/jp/').toString();
    if (!url.startsWith('https://www.nintendo.com/jp/')) continue;
    if (!/soft|game|search|title|product|software|switch|3ds|wii|ds|fc|sfc/i.test(url)) continue;
    if (/^(検索|詳しくはこちら|詳細|すべて見る|任天堂ホームページ)$/u.test(title)) continue;
    const normalizedTitle = normalizeText(title);
    const score = q && normalizedTitle.includes(q) ? 100 :
      terms.length ? Math.round(100 * terms.filter(term => normalizedTitle.includes(term)).length / terms.length) : 0;
    if (score >= 45) {
      const imagePath = (inner.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) || [])[1] || '';
      const image = imagePath ? new URL(decodeHtml(imagePath), 'https://www.nintendo.com/jp/').toString() : '';
      rows.push({ title, url, image, date: '', sourceName: '任天堂公式ゲーム検索', score });
    }
  }
  return [...new Map(rows.map(row => [row.url + '|' + row.title, row])).values()]
    .sort((a, b) => b.score - a.score).slice(0, 10);
}



function extractFishingCandidates(html, baseUrl, sourceName, query, allowedHost) {
  const q = normalizeText(query);
  const chars = Array.from(q);
  const terms = chars.length > 1 ? chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]) : chars;
  const rows = [];
  const linkPattern = /<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) && rows.length < 2500) {
    const attrs = match[1] || '';
    const href = decodeHtml(match[2]);
    const inner = match[3] || '';
    const textTitle = decodeHtml(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
    const attrTitle = decodeHtml((attrs.match(/\btitle=["']([^"']+)["']/i) || [])[1] || '');
    const imageAlt = decodeHtml((inner.match(/<img\b[^>]*\balt=["']([^"']+)["']/i) || [])[1] || '');
    let title = [textTitle, attrTitle, imageAlt].find(value =>
      value && value.length >= 2 && value.length <= 120 &&
      !/^(詳しくはこちら|詳細|製品情報|VIEW PRODUCT|検索|もっと見る)$/iu.test(value)
    ) || '';
    if (!title) {
      // Product listings often put the product name beside a "VIEW PRODUCT" link.
      // Inspect only nearby card text and extract a short phrase around the query.
      const context = html.slice(Math.max(0, match.index - 700), Math.min(html.length, linkPattern.lastIndex + 180));
      const contextText = decodeHtml(context.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
      const normalizedContext = normalizeText(contextText);
      if (q && normalizedContext.includes(q)) {
        const queryIndex = normalizedContext.indexOf(q);
        // normalizeText removes spaces and punctuation, so its index cannot be
        // used directly against the original text. Map the normalized offset
        // back to the raw string before taking the nearby product-card text.
        let rawQueryIndex = 0;
        let normalizedOffset = 0;
        for (let i = 0; i < contextText.length; i++) {
          const normalizedChar = normalizeText(contextText[i]);
          if (normalizedOffset <= queryIndex && normalizedOffset + normalizedChar.length > queryIndex) {
            rawQueryIndex = i;
            break;
          }
          normalizedOffset += normalizedChar.length;
        }
        const left = Math.max(0, rawQueryIndex - 45);
        const right = Math.min(contextText.length, rawQueryIndex + query.length + 55);
        title = contextText.slice(left, right)
          .replace(/(?:VIEW PRODUCT|詳しくはこちら|詳細|検索する|検索)/giu, ' ')
          .replace(/[¥￥]?[0-9０-９,，.．~〜円税別税込]+/gu, ' ')
          .replace(/\s+/g, ' ').trim();
        title = title.split(/[|｜]/)[0].trim();
        if (title.length > 100) title = title.slice(-100).trim();
      }
    }
    if (!title) continue;
    let url;
    try { url = new URL(href, baseUrl).toString(); } catch { continue; }
    if (new URL(url).hostname !== allowedHost) continue;
    if (!/product|products|item|detail|productlist/i.test(url)) continue;
    const normalizedTitle = normalizeText(title);
    const score = q && normalizedTitle.includes(q) ? 100 :
      terms.length ? Math.round(100 * terms.filter(term => normalizedTitle.includes(term)).length / terms.length) : 0;
    if (score < 45) continue;
    const imagePath = (inner.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) || [])[1] || '';
    let image = '';
    try { if (imagePath) image = new URL(decodeHtml(imagePath), baseUrl).toString(); } catch {}
    rows.push({ title, url, image, date: '', sourceName, score });
  }
  return [...new Map(rows.map(row => [row.url + '|' + row.title, row])).values()]
    .sort((a, b) => b.score - a.score).slice(0, 10);
}

async function searchFishingTackle(query) {
  const sources = [
    {
      url: 'https://fish.shimano.com/ja-JP/product/list.html?fs=&page=1&pcat1=&pcat2=&pcat3=&pcat4=&price_max=&price_min=&series=',
      base: 'https://fish.shimano.com/ja-JP/',
      host: 'fish.shimano.com',
      name: 'シマノ公式製品一覧'
    },
    {
      url: 'https://www.daiwa.com/jp/product/productlist?number=100&page=1',
      base: 'https://www.daiwa.com/jp/product/',
      host: 'www.daiwa.com',
      name: 'ダイワ公式製品一覧'
    }
  ];
  const all = [];
  const failures = [];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductLookup/1.0)' }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const html = await response.text();
      all.push(...extractFishingCandidates(html, source.base, source.name, query, source.host));
    } catch (error) {
      failures.push(source.name + ': ' + String(error?.message || '取得失敗'));
    }
  }
  return { candidates: [...new Map(all.map(row => [row.url + '|' + row.title, row])).values()]
    .sort((a, b) => b.score - a.score).slice(0, 10), failures };
}

async function searchPokemonCatalog(query, language) {
  const endpoint = 'https://pokemontcg.jacobcorbett.com/api/v1/cards?language='
    + encodeURIComponent(language) + '&q=' + encodeURIComponent(query) + '&limit=30';
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductLookup/1.0)', 'Accept': 'application/json' }
  });
  if (!response.ok) throw new Error('カードカタログ HTTP ' + response.status);
  const payload = await response.json();
  const rows = Array.isArray(payload.data) ? payload.data
    : Array.isArray(payload.cards) ? payload.cards
    : Array.isArray(payload.results) ? payload.results : [];
  const q = normalizeText(query);
  const chars = Array.from(q);
  const terms = chars.length > 1 ? chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]) : chars;
  return rows.map(row => {
    const title = String(row.name || row.title || row.cardName || '');
    const setName = String(row.setName || row.set_name || row.set?.name || row.set || '');
    const number = String(row.number || row.cardNumber || row.card_number || '');
    const id = String(row.id || row.cardId || '');
    const normalizedTitle = normalizeText([title, setName, number, id].join(' '));
    const score = q && normalizedTitle.includes(q) ? 100 :
      terms.length ? Math.round(100 * terms.filter(term => normalizedTitle.includes(term)).length / terms.length) : 0;
    const image = String(row.imageUrl || row.image_url || row.image || row.images?.large || row.images?.small || '');
    const url = String(row.url || (id ? 'https://pokemontcg.jacobcorbett.com/api/v1/cards/' + encodeURIComponent(id) : 'https://pokemontcg.jacobcorbett.com/api/v1/cards'));
    return { title: [title, setName, number].filter(Boolean).join('｜'), url, image, date: '', sourceName: '独立カードカタログ（非公式）', score, cardName: title, setName, number, rarity: String(row.rarity || row.rarityName || ''), language };
  }).filter(row => row.cardName && row.score >= 18)
    .sort((a, b) => b.score - a.score).slice(0, 10);
}

function pokemonCardQueryVariants(value) {
  const raw = String(value || '').normalize('NFKC').trim();
  if (!raw) return [];
  const cleaned = raw
    .replace(/\b(?:PSA|CGC|BGS|SGC)\s*\d{1,2}\b/giu, ' ')
    .replace(/\b(?:GEM\s*MINT|MINT|NM|NEAR\s*MINT|HOLO|HOLOGRAPHIC|RARE|PROMO|POKEMON|POKÉMON|TCG|CARD|CARDS|JAPANESE|JAPAN|ENGLISH|POP\s*\d+)\b/giu, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/[|｜,，()[\]{}「」『』]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const variants = [raw, cleaned];
  const leading = cleaned.split(/\s+(?=(?:\d{1,3}(?:\/\d{1,3})?|[A-Z]{2,}[- ]?\d{1,4}|PSA|CGC|BGS|HOLO|RARE|JAPANESE|ENGLISH)\b)/iu)[0];
  if (leading && leading.length >= 3) variants.push(leading);
  const cardNumbers = [...raw.matchAll(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/g)].map(m => m[0].replace(/\s/g, ''));
  const standaloneNumbers = [...raw.matchAll(/(?:^|\s)(\d{1,3})(?=\s|$)/g)].map(m => m[1]);
  variants.push(...cardNumbers, ...standaloneNumbers.slice(0, 2));
  return [...new Set(variants.map(x => x.trim()).filter(x => x.length >= 2))].slice(0, 5);
}

async function searchPokemonCards(query, originalQuery = '') {
  const catalogQueries = [...new Set([query, originalQuery].flatMap(pokemonCardQueryVariants))].slice(0, 5);
  const catalogResults = await Promise.allSettled(catalogQueries.flatMap(q => [
    searchPokemonCatalog(q, 'jp'), searchPokemonCatalog(q, 'en')
  ]));
  const catalogCandidates = catalogResults.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const rawTitle = String(originalQuery || query || '').normalize('NFKC');
  const numberHints = [...rawTitle.matchAll(/\b(\d{1,3})\s*\/\s*(\d{1,3})\b/g)].map(m => m[0].replace(/\s/g, ''));
  const setHints = ['30th Celebration', 'Pokemon GO', 'Pokémon GO', 'Jungle', 'Base Set', 'Fossil', 'Team Rocket', 'Neo Genesis', 'Neo Discovery', 'Evolving Skies', '151', 'SV9a', 'MEG']
    .filter(s => normalizeText(rawTitle).includes(normalizeText(s)));
  const catalogUnique = [...new Map(catalogCandidates.map(row => {
    const haystack = normalizeText([row.cardName, row.setName, row.number, row.title].join(' '));
    const numberBonus = numberHints.some(n => normalizeText([row.number, row.title].join(' ')).includes(normalizeText(n))) ? 35 : 0;
    const setBonus = setHints.some(s => haystack.includes(normalizeText(s))) ? 15 : 0;
    const japaneseBonus = row.language === 'jp' && /[ぁ-んァ-ヶ一-龯]/u.test(row.cardName) ? 20 : 0;
    return [row.cardName + '|' + row.setName + '|' + row.number + '|' + row.language,
      { ...row, score: Math.min(100, Number(row.score || 0) + numberBonus + setBonus + japaneseBonus) }];
  })).values()]
    .filter(row => /[ぁ-んァ-ヶ一-龯]/u.test(String(row.cardName || '')))
    .sort((a, b) => b.score - a.score).slice(0, 20);
  let officialCandidates = [];
  let officialError = '';
  try { officialCandidates = await searchPokemonCardsOfficial(query); }
  catch (error) { officialError = String(error?.message || '公式検索取得失敗'); }
  const combined = [...catalogUnique, ...officialCandidates].sort((a, b) => b.score - a.score);
  return { candidates: [...new Map(combined.map(row => [row.url + '|' + row.title, row])).values()].slice(0, 10), officialError, catalogErrors: catalogResults.filter(r => r.status === 'rejected').map(r => String(r.reason?.message || 'カタログ取得失敗')) };
}
async function searchPokemonCardsOfficial(query) {
  const response = await fetch('https://www.pokemon-card.com/card-search/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductLookup/1.0)' }
  });
  if (!response.ok) throw new Error('ポケモンカード公式検索の取得に失敗しました');
  const html = await response.text();
  const q = normalizeText(query);
  const chars = Array.from(q);
  const terms = chars.length > 1 ? chars.slice(0, -1).map((ch, i) => ch + chars[i + 1]) : chars;
  const rows = [];
  const linkPattern = /<a\b([^>]*href=["']([^"']+)["'][^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(html)) && rows.length < 1800) {
    const attrs = match[1] || '';
    const href = decodeHtml(match[2]);
    const inner = match[3] || '';
    const textTitle = decodeHtml(inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')).trim();
    const attrTitle = decodeHtml((attrs.match(/\btitle=["']([^"']+)["']/i) || [])[1] || '');
    const imageAlt = decodeHtml((inner.match(/<img\b[^>]*\balt=["']([^"']+)["']/i) || [])[1] || '');
    const title = [imageAlt, attrTitle, textTitle].find(value =>
      value && value.length >= 2 && value.length <= 100
    ) || '';
    if (!title) continue;
    const url = new URL(href, 'https://www.pokemon-card.com/').toString();
    if (!url.startsWith('https://www.pokemon-card.com/')) continue;
    if (!/card|detail/i.test(url)) continue;
    if (/^(カード検索|検索|詳細|次のページ|前のページ)$/u.test(title)) continue;
    const normalizedTitle = normalizeText(title);
    const score = q && normalizedTitle.includes(q) ? 100 :
      terms.length ? Math.round(100 * terms.filter(term => normalizedTitle.includes(term)).length / terms.length) : 0;
    if (score >= 45) {
      const imagePath = (inner.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) || [])[1] || '';
      const image = imagePath ? new URL(decodeHtml(imagePath), 'https://www.pokemon-card.com/').toString() : '';
      rows.push({ title, url, image, date: '', sourceName: 'ポケモンカード公式カード検索', score });
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
    if (category === '釣具') {
      const result = await searchFishingTackle(query);
      const candidates = result.candidates;
      const anySourceSucceeded = result.failures.length < 2;
      return res.json({
        category, query, provider: 'シマノ・ダイワ公式製品一覧',
        fetchedAt: new Date().toISOString(),
        status: candidates.length ? 'candidate_found' : (anySourceSucceeded ? 'no_match' : 'source_unavailable'),
        verification: candidates.length ? 'candidate_only' : 'not_checked',
        message: candidates.length
          ? 'シマノ・ダイワ公式製品一覧から名称候補を取得しました。型番・仕様・画像を照合するまで正式一致とは扱いません。公式一覧の取得範囲外の商品は候補に出ない場合があります。'
          : anySourceSucceeded
            ? '公式製品一覧から候補を抽出できませんでした。検索語を短くするか、公式サイトで手動確認してください。'
            : '公式製品一覧を取得できませんでした。商品が存在しないという意味ではありません。公式サイトのリンクから手動確認してください。',
        candidates, sources, sourceErrors: result.failures
      });
    }
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
    if (category === 'ポケモンカード') {
      const originalQuery = String(req.query?.original || '').trim().slice(0, 180);
      const result = await searchPokemonCards(query, originalQuery);
      const candidates = result.candidates;
      const sourceErrors = [...result.catalogErrors, ...(result.officialError ? [result.officialError] : [])];
      return res.json({
        category, query, provider: '独立カードカタログ＋ポケモンカード公式検索',
        fetchedAt: new Date().toISOString(),
        status: candidates.length ? 'candidate_found' : (sourceErrors.length ? 'source_unavailable' : 'no_match'),
        verification: candidates.length ? 'candidate_only' : 'not_checked',
        message: candidates.length
          ? 'カード名・収録セット・番号の候補を広いカタログから取得しました。非公式カタログを含み、画像・カード番号・言語・鑑定グレードを照合するまでは同一商品と確定しません。'
          : '候補を取得できませんでした。商品が存在しないという意味ではありません。カード名、番号、セット名を別々に確認してください。',
        candidates, sources, sourceErrors
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
      const results = await Promise.allSettled([searchCanonCameras(query), searchNikonCameras(query)]);
      const candidates = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
      const sourceErrors = results.filter(result => result.status === 'rejected')
        .map((result, index) => String(result.reason?.message || '公式サイト取得失敗'));
      const unique = [...new Map(candidates.map(row => [row.url + '|' + row.title, row])).values()]
        .sort((a, b) => b.score - a.score).slice(0, 10);
      const successfulSources = results.filter(result => result.status === 'fulfilled').length;
      return res.json({
        category, query, provider: 'キヤノン・ニコン公式製品情報',
        fetchedAt: new Date().toISOString(),
        status: unique.length ? 'candidate_found' : (successfulSources ? 'no_match' : 'source_unavailable'),
        verification: unique.length ? 'candidate_only' : 'not_checked',
        message: unique.length
          ? 'キヤノン・ニコンの公式情報から名称候補を取得しました。型番・画像・製品仕様を照合するまで正式一致とは扱いません。旧製品や他メーカーの商品は候補に出ない場合があります。'
          : successfulSources
            ? '取得できた公式ページから候補を抽出できませんでした。検索語を変えるか公式ページで手動確認してください。'
            : '公式サイトを取得できませんでした。商品が存在しないという意味ではありません。公式リンクから手動確認してください。',
        candidates: unique, sources, sourceErrors
      });
    }
    if (category === 'レトロゲーム') {
      const candidates = await searchNintendoGames(query);
      return res.json({
        category, query, provider: '任天堂公式ゲーム検索',
        fetchedAt: new Date().toISOString(),
        status: candidates.length ? 'candidate_found' : 'no_match',
        verification: 'candidate_only',
        message: candidates.length
          ? '任天堂公式検索からゲーム名候補を取得しました。機種・発売地域・型番や商品画像を照合するまで正式一致とは扱いません。任天堂公式検索に掲載されているタイトルが中心で、他社機種や全ての旧作を網羅するものではありません。'
          : '任天堂公式検索から候補を抽出できませんでした。セガなど他社公式サイトや検索語を変えて確認してください。',
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
