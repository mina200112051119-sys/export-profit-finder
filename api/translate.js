const translate = async (text, from, to) => {
  const value = String(text || '').trim();
  if (!value || from === to) return value;
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client','gtx');
  url.searchParams.set('sl',from);
  url.searchParams.set('tl',to);
  url.searchParams.set('dt','t');
  url.searchParams.set('q',value);
  const r = await fetch(url);
  if (!r.ok) throw new Error('translation service unavailable');
  const data = await r.json();
  return Array.isArray(data?.[0]) ? data[0].map(x => x?.[0] || '').join('') : value;
};

module.exports = async (req,res) => {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='GET') return res.status(405).json({error:'GET only'});
  const text=String(req.query?.text||'').trim();
  const from=String(req.query?.from||'auto').trim();
  const to=String(req.query?.to||'en').trim();
  if(!text) return res.status(400).json({error:'text is required'});
  try {
    const detected = from==='auto' ? (/[ぁ-んァ-ヶ一-龯々〆ヵ]/.test(text) ? 'ja' : 'en') : from;
    const translated = await translate(text, detected, to);
    res.json({text,from:detected,to,translated});
  } catch(e) {
    res.status(502).json({error:'translation failed',detail:e.message});
  }
};
