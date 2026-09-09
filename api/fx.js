// Export Profit Finder - USD/JPY exchange-rate endpoint
// The browser never receives any secret. The server fetches the latest rate.

const FX_URL = 'https://api.frankfurter.app/latest?from=USD&to=JPY';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
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

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') return json({ error: 'GET only' }, 405);

    try {
      const response = await fetch(FX_URL, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) return json({ error: 'FX provider failed', status: response.status }, 502);

      const data = await response.json();
      const rate = Number(data?.rates?.JPY);
      if (!Number.isFinite(rate) || rate <= 0) {
        return json({ error: 'Invalid USD/JPY rate' }, 502);
      }

      return json({
        base: 'USD',
        quote: 'JPY',
        rate,
        fetchedAt: new Date().toISOString(),
        source: 'Frankfurter/ECB'
      });
    } catch (error) {
      return json({ error: error.message || 'Unexpected error' }, 500);
    }
  }
};
