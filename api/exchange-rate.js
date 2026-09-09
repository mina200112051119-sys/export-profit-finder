module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=3600');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  try {
    const r = await fetch('https://api.frankfurter.dev/v2/rate/USD/JPY');
    if (!r.ok) throw new Error(`Exchange rate API failed: ${r.status}`);
    const data = await r.json();
    res.json({ rate: Number(data.rate), date: data.date, source: 'Frankfurter' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'exchange rate error' });
  }
};
