const crypto = require('crypto');
const { loadSnapshot, saveFavoriteList, loadFavoriteList, storageConfigured } = require('./data-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (!storageConfigured()) return res.status(503).json({ ok: false, error: 'Cloud storage is not configured' });
  try {
    if (req.method === 'GET') {
      const snapshot = await loadSnapshot();
      if (!snapshot) return res.status(404).json({ error: 'No snapshot available yet' });
      return res.status(200).json(snapshot);
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const key = String(body.key || '');
    if (key.length < 12 || key.length > 128) return res.status(400).json({ ok: false, error: '合言葉は12〜128文字で設定してください' });
    const digest = crypto.createHash('sha256').update(key).digest('hex');
    if (body.action === 'load') {
      const items = await loadFavoriteList(digest);
      return res.status(200).json({ ok: true, items });
    }
    if (body.action === 'save') {
      if (!Array.isArray(body.items) || body.items.length > 200) return res.status(400).json({ ok: false, error: '保存できる商品は200件までです' });
      const items = body.items.filter(p => p && p.id != null).slice(0, 200);
      await saveFavoriteList(digest, items);
      return res.status(200).json({ ok: true, items });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (e) {
    return res.status(503).json({ ok: false, error: 'クラウド保存を利用できません。保存設定と通信状態を確認してください。' });
  }
};
