const EBAY_API = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';

let tokenCache = { token: null, expiresAt: 0 };

async function getAppToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('eBay API credentials are not configured');

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope'
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!res.ok) throw new Error(`eBay OAuth failed: ${res.status}`);
  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in - 120) * 1000
  };
  return tokenCache.token;
}

function median(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const q = String(req.query?.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });

  try {
    const token = await getAppToken();
    const url = new URL(EBAY_API);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '20');
    url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}');

    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Accept-Language': 'en-US'
      }
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'eBay search failed', detail: text.slice(0, 500) });
    }
    const data = await r.json();
    const items = (data.itemSummaries || []).map(item => ({
      title: item.title,
      price: Number(item.price?.value || 0),
      currency: item.price?.currency || 'USD',
      shipping: Number(item.shippingOptions?.[0]?.shippingCost?.value || 0),
      image: item.image?.imageUrl || '',
      url: item.itemWebUrl || '',
      condition: item.condition || '',
      itemId: item.itemId || ''
    })).filter(x => x.price > 0);

    res.json({
      query: q,
      marketplace: 'EBAY_US',
      count: items.length,
      items,
      priceStatsUsd: {
        min: items.length ? Math.min(...items.map(x => x.price)) : null,
        median: median(items.map(x => x.price)),
        max: items.length ? Math.max(...items.map(x => x.price)) : null
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'server error' });
  }
};
