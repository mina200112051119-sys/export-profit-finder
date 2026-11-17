(function(){
'use strict';
const state={fx:null};
const LIVE_CACHE_TTL=24*60*60*1000;
function readLiveCache(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&Date.now()-Number(v.savedAt||0)<LIVE_CACHE_TTL?v.value:null}catch(e){return null}}
function writeLiveCache(key,value){try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),value}))}catch(e){}}
const yen=n=>Number.isFinite(Number(n))?Math.round(Number(n)).toLocaleString('ja-JP'):'-';
const esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
const API_BASE=location.hostname.endsWith('.github.io')?'https://export-profit-finder.vercel.app':'';
const SEARCH_API=API_BASE+'/api/ebay-search';
const CATEGORY_API=API_BASE+'/api/ebay-categories';
const SEEDS=['Pokemon trading cards','Pokemon TCG accessories','fishing tackle','camera','retro video games','Gunpla plastic model kit','genuine replacement parts and consumables'];
const feeFor=cat=>/camera|カメラ/i.test(cat)?0.136:/card|pokemon|tcg|ポケモンカード/i.test(cat)?0.1325:0.136;
async function loadFx(){const cached=readLiveCache('liveFxCache:v1');if(cached&&Number(cached.rate)>0){state.fx=cached;window.EXPORT_FX=state.fx.rate;return state.fx.rate;}try{const r=await fetch(API_BASE+'/api/exchange-rate',{cache:'no-store'});if(!r.ok)throw Error('為替取得失敗');state.fx=await r.json();writeLiveCache('liveFxCache:v1',state.fx);window.EXPORT_FX=state.fx.rate;return state.fx.rate;}catch(e){state.fx=null;return null;}}
async function categorySuggestions(q){const key='liveCategorySuggestions:v1:'+String(q).toLowerCase();const cached=readLiveCache(key);if(Array.isArray(cached))return cached;const r=await fetch(CATEGORY_API+'?q='+encodeURIComponent(q),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'カテゴリー取得に失敗しました');const rows=d.suggestions||[];writeLiveCache(key,rows);return rows;}
function injectCategoryUI(){if(document.getElementById('liveCategoryCard'))return;const host=document.querySelector('#recommend .card:nth-of-type(2)');if(!host)return;const card=document.createElement('div');card.id='liveCategoryCard';card.className='card';card.innerHTML='<h2>eBayカテゴリーから探す</h2><p class="muted">eBay公式カテゴリーを自動取得し、そのカテゴリーの現在の出品を取得してランキングします。</p><div class="grid"><div><label>カテゴリー候補</label><select id="liveCategorySelect"><option value="">読み込み中…</option></select></div><div><label>カテゴリー名で検索</label><input id="liveCategoryQuery" placeholder="例：Nintendo Game Boy / Canon Camera"></div><div><label>想定仕入価格（円）</label><input id="liveCategoryCost" type="number" value="0" min="0"></div></div><button id="liveCategorySearch" class="primary">このカテゴリーをランキング</button><div id="liveCategoryStatus" class="status"></div>';host.parentNode.insertBefore(card,host.nextSibling);const sel=document.getElementById('liveCategorySelect');sel.addEventListener('change',()=>{sel.dataset.name=sel.options[sel.selectedIndex]?.textContent||'';});document.getElementById('liveCategoryQuery').addEventListener('keydown',e=>{if(e.key==='Enter')searchCategorySuggestions();});document.getElementById('liveCategorySearch').addEventListener('click',()=>runCategoryRanking(sel.value,sel.dataset.name||sel.options[sel.selectedIndex]?.textContent||''));}
async function searchCategorySuggestions(){const q=document.getElementById('liveCategoryQuery')?.value.trim(),sel=document.getElementById('liveCategorySelect'),status=document.getElementById('liveCategoryStatus');if(!q||!sel)return;status.textContent='eBayカテゴリーを検索しています…';try{const list=await categorySuggestions(q);sel.innerHTML=list.length?list.slice(0,30).map(x=>'<option value="'+esc(x.categoryId)+'">'+esc(x.categoryName)+'</option>').join(''):'<option value="">候補なし</option>';if(list[0])sel.dataset.name=list[0].categoryName;status.textContent=list.length+'件のカテゴリー候補を取得しました。';}catch(e){status.textContent='カテゴリー取得エラー：'+e.message;}}
function liveDetail(encoded){
 const id=decodeURIComponent(encoded||'');
 const p=(window.__LIVE_CATEGORY_DATA||[]).find(x=>String(x.id)===id);
 if(!p)return false;
 window.__detailProduct=p;
 const costs=p.costs||{},fx=Number(state.fx?.rate||window.EXPORT_FX||150);
 const modal=document.getElementById('modal'),title=document.getElementById('title'),body=document.getElementById('body');
 if(!modal||!body)return false;
 title.textContent=p.displayName||p.name||'商品詳細';
 body.innerHTML='<div class="notice">eBayの現在出品情報です。売れた価格ではありません。仕入価格を確認してから利益を判断してください。</div>'+(p.image?'<img class="detail-image" src="'+esc(p.image)+'" alt="">':'')+'<div class="row"><span>eBay価格</span><b>'+yen(Number(p.sell||0)*fx)+'</b></div><div class="row"><span>送料</span><b>'+(p.shippingKnown===false?'送料未取得':yen(Number(p.ship||0)*fx))+'</b></div><div class="row"><span>商品状態</span><b>'+esc(p.condition||'状態未確認')+'</b></div><div class="row"><span>想定利益</span><b>'+(costs.profit==null?'仕入価格未入力':yen(costs.profit))+'</b></div><div class="row"><span>損益分岐点</span><b>'+(p.riskMetrics?.breakEven==null?'仕入価格入力後に表示':yen(p.riskMetrics.breakEven))+'</b></div>'+(p.url?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener">eBay出品を見る</a>':'');
 modal.classList.add('open');return true;
}
async function runCategoryRanking(categoryId,categoryName){
 const status=document.getElementById('liveCategoryStatus'),ranking=document.getElementById('ranking'),cost=Number(document.getElementById('liveCategoryCost')?.value||0);
 if(!categoryId||!ranking)return;
 status.textContent='eBay.com（米国サイト）の現在出品を取得し、候補を整理しています…';
 try{
  const fx=await loadFx();if(!fx)throw Error('為替レートを取得できませんでした');
  const r=await fetch(SEARCH_API+'?categoryId='+encodeURIComponent(categoryId)+'&limit=200',{cache:'no-store'}),d=await r.json();
  if(!r.ok)throw Error(d.error||'eBay検索に失敗しました');
  const cat=categoryName||'eBayカテゴリー';
  const items=(d.items||[]).map(x=>{
   let saved=null;try{saved=JSON.parse(localStorage.getItem('selectedSourcingCost:v1:'+String(x.itemId))||'null')}catch(e){}
   return RankingEngine.normalizeProduct({id:x.itemId,name:x.title,cat,cost:saved?Number(saved.itemPrice??saved.cost??cost):cost,sourcingShippingJpy:saved?Number(saved.shippingJpy||0):0,sourcingSource:saved?.source||'',sourcingCondition:saved?.condition||'',sourcingCheckedAt:saved?.checkedAt||'',sell:x.price,ship:x.shipping,shippingKnown:x.shippingKnown!==false&&x.shipping!=null,image:x.image,url:x.url,condition:x.condition,searchResultTotal:Number(d.total||0),activeListingsTotal:0,source:'eBay.com（米国サイト）現在出品（販売済み実績なし）'});
  });
  if(!items.length){status.textContent='現在出品候補がありません。別カテゴリーや商品名検索を試してください。';return;}
  const ranked=RankingEngine.rankV2(items,{fxRate:fx,feeRate:feeFor(cat),internationalRate:.0135,domesticShipping:+(document.getElementById('domestic')?.value||0),packaging:+(document.getElementById('pack')?.value||0),otherCost:+(document.getElementById('other')?.value||0),conversionFeeRate:+(document.getElementById('conv')?.value||0)});
  const named=await Promise.all(ranked.slice(0,20).map(async p=>{const n=await displayListingName({itemId:p.id,title:p.name,price:p.sell,shipping:p.ship,image:p.image,url:p.url,condition:p.condition},cat);p.displayName=n.name;p.officialNameStatus=n.status;return p;}));
  window.__LIVE_CATEGORY_DATA=named;
  const appData=window.__exportApp?.getData?.();
  if(Array.isArray(appData))named.forEach(p=>{const i=appData.findIndex(x=>String(x.id)===String(p.id));if(i>=0)appData[i]=p;else appData.unshift(p);});
  ranking.innerHTML='<h2>eBayライブカテゴリー検索：'+esc(cat)+'</h2><p class="muted">eBayの現在出品候補です。売れた価格や販売件数ではありません。商品詳細から利益計算・仕入先保存ができます。</p><div class="search-grid">'+named.map(p=>compactProductCard({
   id:p.id,name:p.displayName||p.name,image:p.image,price:yen(p.sell*fx),shipping:p.shippingKnown===false?'送料未取得':yen(p.ship*fx),
   condition:p.condition||'状態未確認',openAction:"detail('"+encodeURIComponent(p.id)+"')",favoriteLabel:'☆ マイリストに追加'
  })).join('')+'</div>';
  status.textContent='更新完了：'+new Date().toLocaleString('ja-JP')+'｜eBay総件数 '+Number(d.total||items.length).toLocaleString()+'｜取得 '+items.length+'件';
  localStorage.setItem('liveCategoryLastUpdate',Date.now().toString());
 }catch(e){status.textContent='最新カテゴリー検索を取得できませんでした：'+e.message;}
}
function amountInYen(amount,currency,rate){
 const value=Number(amount||0),cur=String(currency||'USD').toUpperCase();
 if(cur==='JPY')return value;
 if(cur==='USD')return value*Number(rate||150);
 return null;
}
function yenLabel(amount,currency,rate){
 const value=amountInYen(amount,currency,rate);
 return value==null?String(currency||'')+' '+Number(amount||0).toFixed(2)+'（円換算未対応）':yen(value)+'円';
}
async function displayListingName(item,cat){
 const p={id:'search:'+String(item.itemId||item.url||item.title),name:item.title,cat};
 try{
  if(typeof window.officialNameCandidate==='function'){
   const candidate=await window.officialNameCandidate(p,cat);
   if(candidate&&Number(candidate.score)>=60&&candidate.titleJa&&/[ぁ-んァ-ヶ一-龯]/u.test(candidate.titleJa)){
    return {name:candidate.titleJa,status:candidate.status||'名称候補（画像・型番の照合が必要）'};
   }
  }
 }catch(e){}
 const name=typeof window.buildUnverifiedJapaneseIdentity==='function'
   ?window.buildUnverifiedJapaneseIdentity(p,cat)
   :'商品名未確認｜eBay原文を確認';
 return {name,status:'一致候補なし（正式名称未確認）'};
}
async function liveSearch(){
 const q=document.getElementById('q')?.value.trim()||document.getElementById('searchName')?.value.trim();
 const box=document.getElementById('results')||document.getElementById('searchResult');
 const cat=document.getElementById('cat')?.value||'';
 if(!box)return;
 if(!q){box.innerHTML='<div class="warning">商品名・型番を入力してください。</div>';return;}
 box.innerHTML='<div class="notice">eBayの現在の出品候補を確認しています…</div>';
 try{
  const fx=await loadFx();if(!fx)throw Error('為替レートを取得できませんでした');
  const r=await fetch(SEARCH_API+'?q='+encodeURIComponent(q)+'&limit=50',{cache:'no-store'}),data=await r.json();
  if(!r.ok)throw Error(data.error||'eBay検索に失敗しました');
  const items=(data.items||[]).slice(0,20);
  if(!items.length){box.innerHTML='<div class="notice">eBayで現在の出品候補が見つかりませんでした。検索語を少し変えてください。</div>';return;}
  const named=await Promise.all(items.map(async item=>({...item,display:(await displayListingName(item,cat))})));
  const appData=window.__exportApp?.getData?.();
  const cards=named.map(p=>{
   const id='live-search:'+String(p.itemId||p.url||p.title);
   const currency=String(p.currency||'USD').toUpperCase();
   const amount=(v)=>currency==='JPY'?Number(v||0)/Number(fx||150):Number(v||0);
   const product=RankingEngine.normalizeProduct({
    id,name:p.title,displayName:p.display.name,cat:cat||'商品検索',cost:0,
    sell:amount(p.price),ship:amount(p.shipping),shippingKnown:p.shippingKnown!==false&&p.shipping!=null,
    image:p.image,url:p.url,condition:p.condition||'状態未確認',
    source:'eBay現在出品（販売済み価格ではありません）'
   });
   if(Array.isArray(appData)){
    const prior=appData.findIndex(x=>String(x.id)===id);
    if(prior>=0)appData[prior]=product;else appData.unshift(product);
   }
   return compactProductCard({
    id,name:p.display.name,image:p.image,
    price:yenLabel(p.price,p.currency,fx),
    shipping:p.shippingKnown===false||p.shipping==null?'送料未取得':yenLabel(p.shipping,p.currency,fx),
    condition:p.condition||'状態未確認',
    openAction:"detail('"+encodeURIComponent(id)+"')",
    favoriteLabel:'☆ マイリストに追加'
   });
  }).join('');
  box.innerHTML='<div class="search-grid">'+cards+'</div><div class="warning" style="grid-column:1/-1">※表示価格はeBayの現在の出品価格です。売れた価格ではありません。商品詳細から利益計算と仕入先の保存ができます。</div>';
 }catch(e){box.innerHTML='<div class="warning">最新データを取得できませんでした。'+esc(e.message)+'<br>eBayの認証情報がVercelに設定されているか確認してください。</div>';}
}
window.searchProduct=liveSearch;window.search=liveSearch;window.runLiveCategoryRanking=runCategoryRanking;window.searchLiveCategory=searchCategorySuggestions;
const nativeDetail=window.detail;window.detail=function(id){const decoded=decodeURIComponent(String(id||''));const live=(window.__LIVE_CATEGORY_DATA||[]).find(p=>String(p.id)===decoded);if(live){const list=window.__exportApp?.getData?.();if(Array.isArray(list)&&!list.some(p=>String(p.id)===decoded))list.push(live);}if(typeof nativeDetail==='function' && nativeDetail(id))return true;return liveDetail(id);};
window.addEventListener('DOMContentLoaded',async()=>{const fx=await loadFx(),status=document.getElementById('rankingStatus');if(fx&&status)status.textContent='為替：1 USD = '+yen(fx)+'円｜eBayライブ検索を利用できます';injectCategoryUI();const sel=document.getElementById('liveCategorySelect');if(sel)try{const lists=await Promise.all(SEEDS.map(categorySuggestions)),seen=new Set(),opts=[];lists.flat().forEach(x=>{if(!seen.has(x.categoryId)){seen.add(x.categoryId);opts.push(x);}});sel.innerHTML=opts.slice(0,40).map(x=>'<option value="'+esc(x.categoryId)+'">'+esc(x.categoryName)+'</option>').join('')||'<option value="">候補なし</option>';if(opts[0]){sel.dataset.name=opts[0].categoryName;}}catch(e){const s=document.getElementById('liveCategoryStatus');if(s)s.textContent='カテゴリー自動取得に失敗しました：'+e.message;}});
// ライブカテゴリー検索はユーザーがボタンを押した時だけ実行。通常のページ表示ではeBay出品検索をしない。
})();
