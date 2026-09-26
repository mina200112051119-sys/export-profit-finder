
async function storage(req,res){
  const id=String(req.headers?.['x-user-id']||'').trim();
  if(!/^[a-zA-Z0-9_-]{12,80}$/.test(id)) return res.status(400).json({error:'valid x-user-id is required'});
  const base=String(process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL||'').replace(/\\/$/,'');
  const token=String(process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN||'');
  if(!base||!token) return res.status(503).json({configured:false,error:'cloud storage is not configured'});
  const key='export-profit:user:'+id;
  const command=async(cmd)=>{
    const rr=await fetch(base,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(cmd)});
    const tt=await rr.text(); if(!rr.ok) throw new Error('storage '+rr.status);
    const dd=JSON.parse(tt); if(dd.error) throw new Error(String(dd.error)); return dd.result;
  };
  try{
    if(req.method==='GET'){
      const raw=await command(['GET',key]);
      return res.json({configured:true,data:raw?JSON.parse(raw):null});
    }
    if(req.method==='PUT'){
      const data=req.body?.data;
      if(!data||typeof data!=='object'||Array.isArray(data)) return res.status(400).json({error:'data object is required'});
      const safe={version:1,updatedAt:new Date().toISOString(),sourcingCandidates:data.sourcingCandidates&&typeof data.sourcingCandidates==='object'?data.sourcingCandidates:{},selectedSourcing:data.selectedSourcing&&typeof data.selectedSourcing==='object'?data.selectedSourcing:{}};
      await command(['SET',key,JSON.stringify(safe)]);
      return res.json({configured:true,saved:true,updatedAt:safe.updatedAt});
    }
    if(req.method==='DELETE'){await command(['DEL',key]);return res.json({configured:true,deleted:true});}
    return res.status(405).json({error:'GET, PUT, DELETE only'});
  }catch(e){return res.status(500).json({configured:true,error:e.message||'storage error'});}
}

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
  res.setHeader('Access-Control-Allow-Methods','GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type,X-User-Id');
  if(req.method==='OPTIONS') return res.status(204).end();
  const action=String(req.query?.action||'translate').trim();
  if(action==='storage') return storage(req,res);
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
