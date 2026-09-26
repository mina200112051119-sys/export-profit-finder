function config(){const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL;const token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;if(!url||!token)return null;return{url:String(url).replace(/\\/$/,''),token};}
module.exports=async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({ok:false,error:'GET only'});
 const c=config();
 if(!c)return res.status(503).json({ok:false,configured:false,error:'cloud storage is not configured'});
 try{
  const r=await fetch(c.url,{method:'POST',headers:{Authorization:'Bearer '+c.token,'Content-Type':'application/json'},body:JSON.stringify(['PING'])});
  const t=await r.text();
  if(!r.ok)return res.status(502).json({ok:false,configured:true,error:'storage unavailable'});
  const d=JSON.parse(t);
  return res.json({ok:true,configured:true,ping:d.result==='PONG',checkedAt:new Date().toISOString()});
 }catch(e){return res.status(502).json({ok:false,configured:true,error:'storage unavailable'});}
};
