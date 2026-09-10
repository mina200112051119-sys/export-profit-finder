const { loadSnapshot, storageConfigured } = require('./data-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  if (!storageConfigured()) return res.status(503).json({ error: 'Durable storage is not configured' });
  try {
    const snapshot = await loadSnapshot();
    if (!snapshot) return res.status(404).json({ error: 'No snapshot available yet' });
    return res.status(200).json(snapshot);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'snapshot read failed' });
  }
};
