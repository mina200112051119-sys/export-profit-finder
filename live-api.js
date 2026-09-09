(function(){
  const state={fx:null};
  const yen=n=>Number.isFinite(Number(n))?Math.round(Number(n)).toLocaleString('ja-JP'):'-';
  const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));

  async function loadFx(){
    try{
      const r=await fetch('/api/fx',{cache:'no-store'});
      if(!r.ok) throw new Error('為替取得失敗');
      state.fx=await r.json();
      window.EXPORT_FX=state.fx.rate;
      return state.fx.rate;
    }catch(e){
      state.fx=null;
      return null;
    }
  }

  function fee(){
    const el=document.getElementById('marketFee');
    return el?Number(el.value)/100:0.14;
  }

  async function liveSearch(){
    const q=document.getElementById('searchName')?.value.trim();
    const cat=document.getElementById('searchCat')?.value||'';
    const cost=Number(document.getElementById('searchCost')?.value||0);
    const target=Number(document.getElementById('targetProfit')?.value||0);
    const box=document.getElementById('searchResult');
    if(!box) return;
    if(!q){box.innerHTML='<div class="warning">商品名・型番を入力してください。</div>';return;}
    box.innerHTML='<div class="notice">eBayの現在の出品価格を取得しています…</div>';
    try{
      const fx=await loadFx();
      if(!fx) throw new Error('為替レートを取得できませんでした');
      const r=await fetch('/api/ebay-search?q='+encodeURIComponent(q),{cache:'no-store'});
      const data=await r.json();
      if(!r.ok) throw new Error(data.error||'eBay検索に失敗しました');
      const items=(data.items||[]).map(x=>({...x,priceJpy:x.price*fx,shippingJpy:x.shipping*fx}));
      if(!items.length){box.innerHTML='<div class="notice">eBayで現在の出品候補が見つかりませんでした。検索語を少し変えてください。</div>';return;}
      const prices=items.map(x=>x.priceJpy).filter(x=>x>0);
      const median=prices.sort((a,b)=>a-b)[Math.floor(prices.length/2)]||0;
      const upper=Math.floor(median*(1-fee())-target);
      box.innerHTML=`<div class="notice">カテゴリー：${esc(cat)}｜為替：1 USD = ${yen(fx)}円<br>現在のeBay出品 ${items.length}件を取得。目標利益 ${yen(target)}円を残すための仕入れ上限目安：<b>${yen(Math.max(0,upper))}円</b></div><div class="search-product-grid">${items.slice(0,12).map((p,i)=>`<div class="search-product-card"><${p.image?'img':'div'} class="search-product-image" ${p.image?`src="${esc(p.image)}" alt="" onerror="this.style.display='none'"`:''}>${p.image?'':'商品画像なし'}${p.image?'':'</div>'}<h3>${esc(p.title)}</h3><div class="row"><span>eBay価格</span><b>${yen(p.priceJpy)}円</b></div><div class="row"><span>送料</span><b>${yen(p.shippingJpy)}円</b></div><div class="muted">状態：${esc(p.condition||'不明')}</div><a class="primary" style="display:block;text-align:center;text-decoration:none;margin-top:10px" href="${esc(p.url)}" target="_blank" rel="noopener">eBayで確認</a></div>`).join('')}</div><div class="warning">※これは現在出品されている価格です。売れた価格ではありません。実際の利益は送料・手数料・為替・商品の状態などで変わります。</div>`;
    }catch(e){
      box.innerHTML=`<div class="warning">最新データを取得できませんでした。${esc(e.message)}<br>eBayの認証情報がVercelに設定されているか確認してください。</div>`;
    }
  }

  window.searchProduct=liveSearch;
  window.addEventListener('DOMContentLoaded',async()=>{
    const fx=await loadFx();
    const status=document.getElementById('rankingStatus');
    if(fx&&status) status.textContent=`為替：1 USD = ${yen(fx)}円｜eBayライブ検索を利用できます`;
  });
})();
