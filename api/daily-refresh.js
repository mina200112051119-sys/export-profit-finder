const QUERIES = [
  { cat: 'ポケモンカード', q: 'Pokemon card Japan' },
  { cat: 'ポケモン関連サプライ用品', q: 'Pokemon TCG supplies Japan' },
  { cat: '釣具', q: 'Japanese fishing tackle' },
  { cat: 'カメラ', q: 'Japanese camera' },
  { cat: 'レトロゲーム', q: 'Japanese retro game' }
];

const { saveSnapshot, storageConfigured } = require('./data-store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!storageConfigured()) {
    return res.status(503).json({ error: 'Durable storage is not configured. Connect Upstash Redis/KV to Vercel first.' });
  }

  const host = req.headers.host;
  if (!host) return res.status(500).json({ error: 'Host header is missing' });
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const base = `${protocol}://${host}`;
  const categories = [];

  for (const item of QUERIES) {
    try {
      const r = await fetch(`${base}/api/ebay-search?q=${encodeURIComponent(item.q)}`, {
        headers: { 'x-cron-refresh': '1' }
      });
      const d = await r.json();
      categories.push({
        category: item.cat,
        query: item.q,
        ok: r.ok,
        count: d.count || 0,
        items: d.items || [],
        priceStatsUsd: d.priceStatsUsd || null
      });
    } catch (e) {
      categories.push({ category: item.cat, query: item.q, ok: false, count: 0, items: [], error: e.message || 'request failed' });
    }
  }

  let fx = null;
  try {
    const r = await fetch(`${base}/api/exchange-rate`, { headers: { 'x-cron-refresh': '1' } });
    const d = await r.json();
    fx = r.ok ? d : null;
  } catch (_) {}

  const snapshot = {
    version: 1,
    refreshedAt: new Date().toISOString(),
    source: 'eBay Browse + Frankfurter',
    categories,
    fx,
    warnings: [
      '保存しているeBayデータは現在出品データです。過去の販売実績はMarketplace Insightsの利用可否に依存します。',
      '利益・ランキングは取得時点の情報を基にした推定です。'
    ]
  };

  const failed = categories.filter(x => !x.ok);
  try {
    await saveSnapshot(snapshot);
  } catch (e) {
    return res.status(500).json({ error: 'Snapshot save failed', detail: e.message });
  }

  return res.status(failed.length ? 502 : 200).json({
    ok: failed.length === 0,
    saved: true,
    refreshedAt: snapshot.refreshedAt,
    categoryCount: categories.length,
    failedCategories: failed.map(x => x.category)
  });
};
