const QUERIES = [
  { cat: 'ポケモンカード', q: 'Pokemon card graded rare Japanese' },
  { cat: 'ポケモン関連サプライ用品', q: 'Pokemon Center Japan limited official merchandise sealed' },
  { cat: '釣具', q: 'Japanese fishing reel spinning baitcasting Shimano Daiwa Japan -parts -bearing -replacement' },
  { cat: 'カメラ', q: 'Japanese digital camera Canon Nikon Fujifilm' },
  { cat: 'レトロゲーム', q: 'Nintendo Famicom console Japan' },
  { cat: 'レトロゲーム', q: 'Super Famicom game cartridge Japan' },
  { cat: 'レトロゲーム', q: 'Nintendo Game Boy game cartridge Japan' },
  { cat: 'レトロゲーム', q: 'Nintendo 64 game cartridge Japan' },
  { cat: 'レトロゲーム', q: 'Sega Saturn game disc Japan' },
  { cat: 'レトロゲーム', q: 'Sega Dreamcast game disc Japan' },
  { cat: 'レトロゲーム', q: 'Sony PlayStation PS1 PS2 game disc Japan' },
  { cat: 'レトロゲーム', q: 'Nintendo Sega Sony retro game controller gamepad Japan' },
  { cat: 'レトロゲーム', q: 'Game Boy Advance Nintendo DS PSP handheld console Japan' },
  { cat: 'ガンプラ', q: 'Bandai Gunpla HG 1/144 model kit' },
  { cat: 'ガンプラ', q: 'Bandai Gundam MG Master Grade 1/100 model kit' },
  { cat: 'ガンプラ', q: 'Bandai Gundam RG Real Grade 1/144 model kit' },
  { cat: 'ガンプラ', q: 'Bandai Gundam PG Perfect Grade model kit' },
  { cat: 'ガンプラ', q: 'Vintage Bandai Gundam plastic model kit Japan' },
  { cat: '交換部品・消耗品', q: 'Shimano genuine fishing reel spare parts replacement spool line roller bail arm drag knob Japan -custom -upgrade -universal' },
  { cat: '交換部品・消耗品', q: 'Daiwa genuine fishing reel spare parts replacement spool line roller bail arm drag knob Japan -custom -upgrade -universal' },
  { cat: '交換部品・消耗品', q: 'Canon Nikon genuine camera replacement spare parts battery door eyecup body cap lens cap charger Japan' },
  { cat: '交換部品・消耗品', q: 'Nintendo Sega genuine retro game console replacement parts AC adapter power supply AV cable controller Japan' },
  { cat: '交換部品・消耗品', q: 'Bandai Gunpla genuine replacement parts runner parts decals stickers weapon parts Japan' }
];

const { loadSnapshot, saveSnapshot, storageConfigured } = require('./data-store');
const ebaySearch = require('./ebay-search');
const exchangeRate = require('./exchange-rate');

function invokeApi(handler, req) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let statusCode = 200;
    const res = {
      setHeader() {},
      status(code) { statusCode = code; return this; },
      json(body) {
        if (!settled) { settled = true; resolve({ statusCode, body }); }
        return this;
      },
      end() {
        if (!settled) { settled = true; resolve({ statusCode, body: null }); }
        return this;
      }
    };
    Promise.resolve(handler(req, res)).catch(error => {
      if (!settled) { settled = true; reject(error); }
    });
  });
}

function mergeSnapshotCategories(previousCategories = [], currentCategories = []) {
  const byQuery = new Map((previousCategories || []).map(row => [row.query, row]));
  for (const row of currentCategories || []) {
    if (row.ok || !byQuery.has(row.query)) byQuery.set(row.query, row);
  }
  return [...byQuery.values()];
}

function hasSuccessfulCategories(categories = []) {
  return (categories || []).some(row => row && row.ok && Array.isArray(row.items));
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!storageConfigured()) {
    return res.status(503).json({ error: 'Durable storage is not configured. Connect Upstash Redis/KV to Vercel first.' });
  }

  // Call the API handlers directly. Calling this deployment over HTTP can return
  // an SSO/HTML page to a scheduled function instead of the JSON API response.
  const categories = new Array(QUERIES.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const index = next++;
      if (index >= QUERIES.length) return;
      const item = QUERIES[index];
      try {
        const result = await invokeApi(ebaySearch, {
          method: 'GET',
          query: { q: item.q, limit: '50', skipTranslation: '1' },
          headers: {}
        });
        const body = result.body || {};
        categories[index] = {
          category: item.cat,
          query: item.q,
          ok: result.statusCode >= 200 && result.statusCode < 300 && Array.isArray(body.items),
          count: Number(body.count || 0),
          items: Array.isArray(body.items) ? body.items : [],
          priceStatsUsd: body.priceStatsUsd || null,
          ...((result.statusCode < 200 || result.statusCode >= 300) ? { error: body.error || 'eBay search failed' } : {})
        };
      } catch (e) {
        categories[index] = {
          category: item.cat, query: item.q, ok: false, count: 0, items: [],
          error: e.message || 'request failed'
        };
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, () => worker()));

  let fx = null;
  try {
    const result = await invokeApi(exchangeRate, { method: 'GET', query: {}, headers: {} });
    fx = result.statusCode >= 200 && result.statusCode < 300 ? result.body : null;
  } catch (_) {}
  
  const failed = categories.filter(x => !x.ok);
  if (!hasSuccessfulCategories(categories)) {
    // Do not replace a usable snapshot with an all-failed/empty refresh.
    return res.status(502).json({
      ok: false,
      saved: false,
      error: 'All category searches failed; the previous snapshot was kept.',
      failedCategories: failed.map(x => x.category)
    });
  }

  let previousSnapshot = null;
  try {
    previousSnapshot = await loadSnapshot();
  } catch (e) {
    // If the previous snapshot cannot be read, avoid overwriting it with partial data.
    return res.status(500).json({ error: 'Previous snapshot read failed; no data was overwritten.' });
  }

  const snapshot = {
    version: 1,
    refreshedAt: new Date().toISOString(),
    source: 'eBay Browse + Frankfurter',
    categories: mergeSnapshotCategories(previousSnapshot?.categories || [], categories),
    fx: fx || previousSnapshot?.fx || null,
    warnings: [
      '保存しているeBayデータは現在出品データです。過去の販売実績はMarketplace Insightsの利用可否に依存します。',
      '検索に失敗した項目は、前回取得できたデータがあれば保持します。最新データとは限りません。',
      '利益・ランキングは取得時点の情報を基にした推定です。'
    ]
  };

  try {
    await saveSnapshot(snapshot);
  } catch (e) {
    return res.status(500).json({ error: 'Snapshot save failed', detail: e.message });
  }

  return res.status(failed.length ? 502 : 200).json({
    ok: failed.length === 0,
    saved: true,
    refreshedAt: snapshot.refreshedAt,
    categoryCount: snapshot.categories.length,
    updatedCategoryCount: categories.filter(x => x.ok).length,
    failedCategories: failed.map(x => x.category)
  });
};

module.exports.mergeSnapshotCategories = mergeSnapshotCategories;
module.exports.hasSuccessfulCategories = hasSuccessfulCategories;

module.exports.invokeApi = invokeApi;
