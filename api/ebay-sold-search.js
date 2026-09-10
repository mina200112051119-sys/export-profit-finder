const API = 'https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
let tokenCache = { token: null, expiresAt: 0 };

async function getAppToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('eBay API credentials are not configured');
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' });
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!r.ok) throw new Error(`eBay OAuth failed: ${r.status}`);
  const d = await r.json();
  tokenCache = { token: d.access_token, expiresAt: Date.now() + Math.max(60, (d.expires_in || 7200) - 120) * 1000 };
  return tokenCache.token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const q = String(req.query?.q || '').trim();
  const categoryId = String(req.query?.categoryId || '').trim();
  if (!q) return res.status(400).json({ error: 'q is required' });
  if (!categoryId) return res.status(400).json({ error: 'categoryId is required' });
  try {
    const token = await getAppToken();
    const u = new URL(API);
    u.searchParams.set('q', q);
    u.searchParams.set('category_ids', categoryId);
    u.searchParams.set('limit', '50');
    u.searchParams.set('filter', 'lastSoldDate:[NOW-90DAYS..]');
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', 'Accept-Language': 'en-US' } });
    const text = await r.text();
    if (!r.ok) {
      let detail = text.slice(0, 800);
      try { detail = JSON.parse(text); } catch (_) {}
      return res.status(r.status).json({ error: 'eBay sold-history unavailable', detail, accessRequired: r.status === 403 || r.status === 401 });
    }
    const d = JSON.parse(text);
    const items = (d.itemSales || d.itemSummaries || []).map(x => ({
      title: x.title || '',
      price: Number(x.price?.value || 0),
      currency: x.price?.currency || 'USD',
      soldDate: x.soldDate || x.lastSoldDate || '',
      itemId: x.itemId || '',
      url: x.itemWebUrl || '',
      condition: x.condition || ''
    })).filter(x => x.price > 0);
    const prices = items.map(x => x.price).sort((a,b)=>a-b);
    const median = prices.length ? (prices.length % 2 ? prices[(prices.length-1)/2] : (prices[prices.length/2-1]+prices[prices.length/2])/2) : null;
    res.json({ query:q, categoryId, marketplace:'EBAY_US', days:90, count:items.length, items, medianSoldPrice:median, source:'eBay Marketplace Insights' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'server error' });
  }
};
