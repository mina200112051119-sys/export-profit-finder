const EBAY_API = 'https://api.ebay.com/buy/browse/v1/item_summary/search_by_image';
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
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) throw new Error(`eBay OAuth failed: ${r.status}`);
  const d = await r.json();
  tokenCache = { token: d.access_token, expiresAt: Date.now() + Math.max(60, (d.expires_in || 7200) - 120) * 1000 };
  return tokenCache.token;
}

function normalize(items) {
  return (items || []).map(item => ({
    itemId: item.itemId || '',
    title: item.title || '',
    price: Number(item.price?.value || 0),
    currency: item.price?.currency || 'USD',
    shipping: Number(item.shippingOptions?.[0]?.shippingCost?.value || 0),
    image: item.image?.imageUrl || '',
    url: item.itemWebUrl || '',
    condition: item.condition || '',
    categories: item.categories || [],
    categoryId: item.leafCategoryIds?.[0] || ''
  })).filter(x => x.price > 0);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const image = String(req.body?.image || '').trim();
    if (!image) return res.status(400).json({ error: 'image is required' });
    if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
      return res.status(400).json({ error: 'image must be a JPEG, PNG, or WebP data URL' });
    }
    const base64 = image.split(',')[1] || '';
    if (!base64 || base64.length > 8_000_000) return res.status(413).json({ error: 'image is too large' });

    const token = await getAppToken();
    const url = new URL(EBAY_API);
    url.searchParams.set('limit', '12');
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ image: base64 })
    });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: 'eBay image search failed', detail: text.slice(0, 800) });
    const data = JSON.parse(text);
    const items = normalize(data.itemSummaries);
    return res.json({ marketplace: 'EBAY_US', count: items.length, items, source: 'eBay Browse searchByImage' });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'server error' });
  }
};
