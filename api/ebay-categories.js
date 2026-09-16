const TAXONOMY = 'https://api.ebay.com/commerce/taxonomy/v1';
const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
let tokenCache = { token: null, expiresAt: 0 };

async function getAppToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error('eBay API credentials are not configured');
  const basic = Buffer.from(`${id}:${secret}`).toString('base64');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' })
  });
  if (!r.ok) throw new Error(`eBay OAuth failed: ${r.status}`);
  const d = await r.json();
  tokenCache = { token: d.access_token, expiresAt: Date.now() + Math.max(60, (d.expires_in || 7200) - 120) * 1000 };
  return tokenCache.token;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  try {
    const token = await getAppToken();
    const marketplace = String(req.query?.marketplace || 'EBAY_US');
    const q = String(req.query?.q || '').trim();
    const categoryId = String(req.query?.categoryId || '').trim();
    let url;
    if (q) {
      const tree = await fetch(`${TAXONOMY}/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplace)}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      if (!tree.ok) throw new Error(`category tree lookup failed: ${tree.status}`);
      const td = await tree.json();
      url = `${TAXONOMY}/category_tree/${encodeURIComponent(td.categoryTreeId)}/get_category_suggestions?q=${encodeURIComponent(q)}`;
    } else {
      const tree = await fetch(`${TAXONOMY}/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplace)}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      if (!tree.ok) throw new Error(`category tree lookup failed: ${tree.status}`);
      const td = await tree.json();
      url = categoryId
        ? `${TAXONOMY}/category_tree/${encodeURIComponent(td.categoryTreeId)}/get_category_subtree?category_node_id=${encodeURIComponent(categoryId)}`
        : `${TAXONOMY}/category_tree/${encodeURIComponent(td.categoryTreeId)}`;
    }
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Accept-Encoding': 'gzip' } });
    const text = await r.text();
    if (!r.ok) return res.status(r.status).json({ error: 'eBay category request failed', detail: text.slice(0, 800) });
    const data = JSON.parse(text);
    if (q) {
      const suggestions = (data.categorySuggestions || []).map(x => ({
        categoryId: x.category?.categoryId || '',
        categoryName: x.category?.categoryName || '',
        categoryTreeNodeLevel: x.categoryTreeNodeLevel ?? null,
        categoryTreeNodeAncestors: x.categoryTreeNodeAncestors || []
      })).filter(x => x.categoryId && x.categoryName);
      return res.json({ marketplace, query: q, suggestions });
    }
    return res.json({ marketplace, categoryTreeId: data.categoryTreeId, categoryTreeVersion: data.categoryTreeVersion, rootCategoryNode: data.rootCategoryNode || null });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'server error' });
  }
};
