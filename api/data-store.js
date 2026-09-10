const KEY = 'export-profit-finder:snapshot';

function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

async function command(args) {
  const c = config();
  if (!c) throw new Error('Redis storage is not configured');
  const r = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error(`Redis request failed: ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d.result;
}

async function saveSnapshot(snapshot) {
  await command(['SET', KEY, JSON.stringify(snapshot)]);
  return snapshot;
}

async function loadSnapshot() {
  const value = await command(['GET', KEY]);
  if (!value) return null;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

module.exports = { saveSnapshot, loadSnapshot, storageConfigured: () => Boolean(config()) };
