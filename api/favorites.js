const crypto = require('crypto');

const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(args) {
  const url = redisUrl(), token = redisToken();
  if (!url || !token) throw new Error('Cloud storage is not configured');
  const response = await fetch(String(url).replace(/\/$/, ''), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!response.ok) throw new Error('Cloud storage unavailable');
  const data = await response.json();
  if (data.error) throw new Error('Cloud storage request failed');
  return data.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const key = String(body.key || '');
    if (key.length < 12 || key.length > 128) return res.status(400).json({ ok: false, error: '合言葉は12〜128文字で設定してください' });
    const action = body.action;
    const digest = crypto.createHash('sha256').update(key).digest('hex');
    const storageKey = 'export-profit-finder:favorite-list:v1:' + digest;
    if (action === 'load') {
      const value = await redis(['GET', storageKey]);
      let items = [];
      if (value) {
        try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; if (Array.isArray(parsed)) items = parsed; } catch (_) {}
      }
      return res.status(200).json({ ok: true, items });
    }
    if (action === 'save') {
      if (!Array.isArray(body.items) || body.items.length > 200) return res.status(400).json({ ok: false, error: '保存できる商品は200件までです' });
      const items = body.items.filter(p => p && p.id != null).slice(0, 200);
      await redis(['SET', storageKey, JSON.stringify(items)]);
      return res.status(200).json({ ok: true, items });
    }
    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    return res.status(503).json({ ok: false, error: 'クラウド保存を利用できません。保存設定を確認してください。' });
  }
};
