const EBAY_API = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
let tokenCache = { token: null, expiresAt: 0 };

async function getAppToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('eBay API credentials are not configured');
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' });
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`eBay OAuth failed: ${res.status}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + Math.max(60, data.expires_in - 120) * 1000 };
  return tokenCache.token;
}


async function translateText(text, from, to) {
  const value = String(text || '').trim();
  if (!value || from === to) return value;
  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client','gtx');
    url.searchParams.set('sl',from);
    url.searchParams.set('tl',to);
    url.searchParams.set('dt','t');
    url.searchParams.set('q',value);
    const r = await fetch(url);
    if (!r.ok) return value;
    const data = await r.json();
    return Array.isArray(data?.[0]) ? data[0].map(x => x?.[0] || '').join('') || value : value;
  } catch (_) {
    return value;
  }
}

function median(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
}

function shippingFor(options) {
  const rows = Array.isArray(options) ? options : [];
  // Browse API can return an empty first option while a later option has a usable cost.
  const priced = rows.find(option => option?.shippingCost?.value != null &&
    Number.isFinite(Number(option.shippingCost.value)));
  if (priced) return {
    value: Math.max(0, Number(priced.shippingCost.value)),
    currency: priced.shippingCost.currency || '',
    known: true
  };
  const free = rows.find(option =>
    String(option?.shippingCostType || '').toUpperCase() === 'FREE');
  if (free) return { value: 0, currency: free.shippingCost?.currency || '', known: true };
  return { value: null, currency: '', known: false };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=180');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const q = String(req.query?.q || '').trim();
  const categoryId = String(req.query?.categoryId || '').trim();
  const isJapanese = /[ぁ-んァ-ヶ一-龯々〆ヵ]/.test(q);
  const searchQuery = isJapanese ? await translateText(q, 'ja', 'en') : q;
  const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 50)));
  const offset = Math.max(0, Number(req.query?.offset || 0));
  if (!q && !categoryId) return res.status(400).json({ error: 'q or categoryId is required' });

  try {
    const token = await getAppToken();
    const url = new URL(EBAY_API);
    if (searchQuery) url.searchParams.set('q', searchQuery);
    if (categoryId) url.searchParams.set('category_ids', categoryId);
    url.searchParams.set('limit', String(limit));
    if (offset) url.searchParams.set('offset', String(offset));
    url.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}');

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US', 'Accept-Language': 'en-US' }
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: 'eBay search failed', detail: text.slice(0, 500) });
    }
    const data = await r.json();
    const items = (data.itemSummaries || []).map(item => {
      const shipping = shippingFor(item.shippingOptions);
      const priceCurrency = item.price?.currency || 'USD';
      const currencyMatches = !shipping.currency || shipping.currency === priceCurrency;
      return {
        title: item.title,
        price: Number(item.price?.value || 0),
        currency: priceCurrency,
        shipping: currencyMatches ? shipping.value : null,
        shippingCurrency: shipping.currency,
        shippingKnown: shipping.known && currencyMatches,
        image: item.image?.imageUrl || '',
        url: item.itemWebUrl || '',
        condition: item.condition || '',
        itemId: item.itemId || '',
        watchCount: Number.isFinite(Number(item.watchCount)) ? Number(item.watchCount) : null,
        categoryId: item.leafCategoryIds?.[0] || '',
        categories: item.categories || []
      };
    }).filter(x => x.price > 0);

    // Daily snapshots can skip translation to avoid hundreds of redundant translation requests.
    if (String(req.query?.skipTranslation || '') !== '1') {
      const translated = await Promise.all(items.slice(0, 20).map(async item => ({ ...item, titleJa: await translateText(item.title, 'en', 'ja') })));
      for (let i = 0; i < translated.length; i++) items[i].titleJa = translated[i].titleJa;
    }

    res.json({
      query: q,
      translatedQuery: searchQuery,
      categoryId,
      marketplace: 'EBAY_US',
      count: items.length,
      total: Number(data.total || items.length),
      limit,
      offset,
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

module.exports.shippingFor = shippingFor;
