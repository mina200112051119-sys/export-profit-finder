// Export Profit Finder - eBay Browse API proxy starter
// Deploy this file as a Cloudflare Worker or similar server-side function.
// Keep EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in server-side secrets.

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

async function getApplicationToken(env) {
  const basic = btoa(`${env.EBAY_CLIENT_ID}:${env.EBAY_CLIENT_SECRET}`);
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'https://api.ebay.com/oauth/api_scope'
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!response.ok) {
    throw new Error(`eBay token error: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'GET') {
      return json({ error: 'GET only' }, 405);
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 20), 1), 50);

    if (!q) {
      return json({ error: 'q is required' }, 400);
    }

    try {
      const token = await getApplicationToken(env);
      const ebayUrl = new URL(SEARCH_URL);
      ebayUrl.searchParams.set('q', q);
      ebayUrl.searchParams.set('limit', String(limit));
      ebayUrl.searchParams.set('filter', 'buyingOptions:{FIXED_PRICE}');

      const response = await fetch(ebayUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Accept-Language': 'en-US'
        }
      });

      const data = await response.json();
      if (!response.ok) {
        return json({ error: 'eBay search failed', detail: data }, response.status);
      }

      const items = (data.itemSummaries || []).map(item => ({
        title: item.title || '',
        price: Number(item.price?.value || 0),
        currency: item.price?.currency || 'USD',
        shipping: Number(item.shippingOptions?.[0]?.shippingCost?.value || 0),
        url: item.itemWebUrl || '',
        image: item.image?.imageUrl || '',
        condition: item.condition || ''
      }));

      const prices = items.map(x => x.price).filter(x => x > 0).sort((a, b) => a - b);
      const median = prices.length
        ? prices[Math.floor((prices.length - 1) / 2)]
        : 0;

      return json({
        query: q,
        count: items.length,
        medianPriceUsd: median,
        items
      });
    } catch (error) {
      return json({ error: error.message || 'Unexpected error' }, 500);
    }
  }
};
