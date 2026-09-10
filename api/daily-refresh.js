const QUERIES = [
  'Pokemon card Japan',
  'Pokemon TCG supplies Japan',
  'Japanese fishing tackle',
  'Japanese camera',
  'Japanese retro game'
];

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const host = req.headers.host;
  if (!host) return res.status(500).json({ error: 'Host header is missing' });
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const base = `${protocol}://${host}`;
  const results = [];

  for (const q of QUERIES) {
    try {
      const r = await fetch(`${base}/api/ebay-search?q=${encodeURIComponent(q)}`, {
        headers: { 'x-cron-refresh': '1' }
      });
      results.push({ query: q, ok: r.ok, status: r.status });
    } catch (e) {
      results.push({ query: q, ok: false, error: e.message || 'request failed' });
    }
  }

  try {
    const r = await fetch(`${base}/api/exchange-rate`, { headers: { 'x-cron-refresh': '1' } });
    results.push({ query: 'USD/JPY', ok: r.ok, status: r.status });
  } catch (e) {
    results.push({ query: 'USD/JPY', ok: false, error: e.message || 'request failed' });
  }

  const failed = results.filter(x => !x.ok);
  res.status(failed.length ? 502 : 200).json({
    ok: failed.length === 0,
    refreshedAt: new Date().toISOString(),
    results
  });
};
