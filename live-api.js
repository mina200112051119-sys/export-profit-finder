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
async function loadFx(){try{const r=await fetch(API_BASE+'/api/exchange-rate',{cache:'no-store'});if(!r.ok)throw Error('為替取得失敗');const fresh=await r.json();if(!(Number(fresh.rate)>0))throw Error('為替レートが不正です');state.fx=fresh;writeLiveCache('liveFxCache:v1',state.fx);window.EXPORT_FX=state.fx.rate;window.__fxRateStale=false;window.__setExportFx?.(state.fx.rate,state.fx.date||'');return state.fx.rate;}catch(e){const cached=readLiveCache('liveFxCache:v1');if(cached&&Number(cached.rate)>0){state.fx=cached;window.EXPORT_FX=state.fx.rate;window.__setExportFx?.(state.fx.rate,state.fx.date||'');window.__fxRateStale=true;return state.fx.rate;}state.fx=null;window.__fxRateStale=true;return null;}}
async function categorySuggestions(q){const key='liveCategorySuggestions:v1:'+String(q).toLowerCase();const cached=readLiveCache(key);if(Array.isArray(cached))return cached;const r=await fetch(CATEGORY_API+'?q='+encodeURIComponent(q),{cache:'no-store'});const d=await r.json();if(!r.ok)throw Error(d.error||'カテゴリー取得に失敗しました');const rows=d.suggestions||[];writeLiveCache(key,rows);return rows;}
function injectCategoryUI(){if(document.getElementById('liveCategoryCard'))return;const host=document.querySelector('#recommend .card:nth-of-type(2)');if(!host)return;const card=document.createElement('div');card.id='liveCategoryCard';card.className='card';card.innerHTML='<h2>eBayカテゴリーから探す</h2><p class="muted">eBay公式カテゴリーを自動取得し、そのカテゴリーの現在の出品を取得してランキングします。</p><div class="grid"><div><label>カテゴリー候補</label><select id="liveCategorySelect"><option value="">読み込み中…</option></select></div><div><label>カテゴリー名で検索</label><input id="liveCategoryQuery" placeholder="例：Nintendo Game Boy / Canon Camera"></div><div><label>想定仕入価格（円）</label><input id="liveCategoryCost" type="number" value="0" min="0"></div></div><button id="liveCategorySearch" class="primary">このカテゴリーをランキング</button><div id="liveCategoryStatus" class="status"></div>';host.parentNode.insertBefore(card,host.nextSibling);const sel=document.getElementById('liveCategorySelect');sel.addEventListener('change',()=>{sel.dataset.name=sel.options[sel.selectedIndex]?.textContent||'';});document.getElementById('liveCategoryQuery').addEventListener('keydown',e=>{if(e.key==='Enter')searchCategorySuggestions();});document.getElementById('liveCategorySearch').addEventListener('click',()=>runCategoryRanking(sel.value,sel.dataset.name||sel.options[sel.selectedIndex]?.textContent||''));}
async function searchCategorySuggestions(){const q=document.getElementById('liveCategoryQuery')?.value.trim(),sel=document.getElementById('liveCategorySelect'),status=document.getElementById('liveCategoryStatus');if(!q||!sel)return;status.textContent='eBayカテゴリーを検索しています…';try{const list=await categorySuggestions(q);sel.innerHTML=list.length?list.slice(0,30).map(x=>'<option value="'+esc(x.categoryId)+'">'+esc(x.categoryName)+'</option>').join(''):'<option value="">候補なし</option>';if(list[0])sel.dataset.name=list[0].categoryName;status.textContent=list.length+'件のカテゴリー候補を取得しました。';}catch(e){status.textContent='カテゴリー取得エラー：'+e.message;}}
function liveDetail(encoded){
 const id=decodeURIComponent(encoded||'');
 const p=(window.__LIVE_CATEGORY_DATA||[]).find(x=>String(x.id)===id);
 if(!p)return false;
 window.__detailProduct=p;
 const c=p.costs||{},fxRate=Number(state.fx?.rate||window.EXPORT_FX||150);
 const modal=document.getElementById('modal'),title=document.getElementById('title'),body=document.getElementById('body');
 if(!modal||!body)return false;
 title.textContent=p.displayName||p.name||'商品詳細';
 body.innerHTML=
  '<button class="secondary" type="button" data-favorite-id="'+esc(p.id)+'" onclick="toggleFavorite(this.dataset.favoriteId)">☆ マイリストに追加</button>'+
  (p.image?'<img class="detail-image" src="'+esc(p.image)+'" alt="">':'')+
  '<div class="row"><span>カテゴリー</span><b>'+esc(p.cat||'未分類')+'</b></div>'+
  '<div class="row"><span>eBay価格</span><b>'+yen(Number(p.sell||0)*fxRate)+'</b></div>'+
  '<div class="row"><span>eBay送料</span><b>'+(p.shippingKnown===false?'送料未取得':yen(Number(p.ship||0)*fxRate))+'</b></div>'+
  '<div class="row"><span>予想利益</span><b class="'+(c.profit==null?'yellow':c.profit>=0?'green':'red')+'">'+(c.profit==null?'仕入価格未入力':yen(c.profit))+'</b></div>'+
  '<h3>仕入れ先・利益計算</h3><div id="source-panel" class="card"><div class="notice">仕入れ候補を読み込み中…</div></div>'+
  (p.url?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener">eBayの商品ページを確認</a>':'')+
  '<p class="muted">価格と送料は現在のeBay出品情報です。販売済み価格ではありません。</p>';
 modal.classList.add('open');return true;
}
async function runCategoryRanking(categoryId,categoryName){const status=document.getElementById('liveCategoryStatus'),ranking=document.getElementById('ranking'),cost=Number(document.getElementById('liveCategoryCost')?.value||0);if(!categoryId||!ranking)return;status.textContent='eBay.com（米国サイト）の現在出品を取得し、商品価格と送料を分けて候補を整理しています…';try{const fx=await loadFx();if(!fx)throw Error('為替レートを取得できませんでした');const r=await fetch(SEARCH_API+'?categoryId='+encodeURIComponent(categoryId)+'&limit=200',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'eBay検索に失敗しました');const cat=categoryName||'eBayカテゴリー',items=(d.items||[]).map(x=>{let saved=null;try{saved=JSON.parse(localStorage.getItem('selectedSourcingCost:v1:'+String(x.itemId))||'null')}catch(e){}return RankingEngine.normalizeProduct({id:x.itemId,name:x.title,cat,cost:saved?Number(saved.itemPrice??saved.cost??cost):cost,sourcingShippingJpy:saved?Number(saved.shippingJpy||0):0,sourcingSource:saved?.source||'',sourcingCondition:saved?.condition||'',sourcingCheckedAt:saved?.checkedAt||'',sell:x.price,ship:x.shipping,shippingKnown:x.shippingKnown!==false&&x.shipping!=null,image:x.image,url:x.url,condition:x.condition,searchResultTotal:Number(d.total||0),activeListingsTotal:0,source:'eBay.com（米国サイト）現在出品（販売済み実績なし）'});});if(!items.length){status.textContent='現在出品候補がありません。別カテゴリーや商品名検索を試してください。';return;}const ranked=RankingEngine.rankV2(items,{fxRate:fx,feeRate:feeFor(cat),internationalRate:.0135,domesticShipping:+(document.getElementById('domestic')?.value||0),packaging:+(document.getElementById('pack')?.value||0),otherCost:+(document.getElementById('other')?.value||0),conversionFeeRate:+(document.getElementById('conv')?.value||0)});window.__LIVE_CATEGORY_DATA=ranked;ranking.innerHTML='<h2>eBayライブカテゴリーランキング：'+esc(cat)+'</h2><p class="muted">eBayの現在出品価格と送料を表示します。販売済み価格ではありません。仕入れ価格を登録した商品は予想利益を表示します。</p>'+ranked.slice(0,20).map((p,i)=>{const c=p.costs;return '<div class="card product" data-product-id="'+esc(p.id)+'" tabindex="0" onclick="detail(\''+encodeURIComponent(p.id)+'\')"><b>#'+(i+1)+'</b><h3>'+esc(p.name)+'</h3><div class="row"><span>eBay価格</span><b>'+yen(Number(p.sell||0)*fx)+'</b></div><div class="row"><span>eBay送料</span><b>'+(p.shippingKnown===false?'送料未取得':yen(Number(p.ship||0)*fx))+'</b></div><div class="row"><span>予想利益</span><b class="ranking-profit '+(c.profit==null?'yellow':c.profit>=0?'green':'red')+'">'+(c.profit==null?'仕入価格未入力':(c.profit>=0?'+':'')+yen(c.profit))+'</b></div><button class="secondary" onclick="event.stopPropagation();detail(\''+encodeURIComponent(p.id)+'\')">利益・仕入れ先を確認</button></div>';}).join('');status.textContent='更新完了：'+new Date().toLocaleString('ja-JP')+'｜eBay総件数 '+Number(d.total||items.length).toLocaleString()+'｜取得 '+items.length+'件';localStorage.setItem('liveCategoryLastUpdate',Date.now().toString());}catch(e){status.textContent='最新カテゴリーランキングを取得できませんでした：'+e.message;}}
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
 box.innerHTML='<div class="notice">eBayの現在の出品価格と商品名を確認しています…</div>';
 try{
  const fx=await loadFx();if(!fx)throw Error('為替レートを取得できませんでした');
  const r=await fetch(SEARCH_API+'?q='+encodeURIComponent(q)+'&limit=50',{cache:'no-store'}),d=await r.json();
  if(!r.ok)throw Error(d.error||'eBay検索に失敗しました');
  const products=typeof window.map==='function'?window.map(d,cat,0):[];
  if(!products.length){box.innerHTML='<div class="notice">eBayで現在の出品候補が見つかりませんでした。検索語を少し変えてください。</div>';return;}
  if(typeof window.enrichOfficialNames==='function')await window.enrichOfficialNames(products,cat);
  const appData=window.__exportApp?.getData?.();
  if(Array.isArray(appData)){
    const ids=new Set(products.map(p=>String(p.id)));
    appData.splice(0,appData.length,...products,...appData.filter(p=>!ids.has(String(p.id))));
  }
  box.innerHTML='<div class="notice"><b>検索語</b>：'+esc(q)+'<br><span class="muted">現在のeBay出品価格と送料を表示します。販売済み価格ではありません。商品を選ぶと利益計算・仕入れ先比較を確認できます。</span></div>'+
   products.slice(0,12).map(p=>'<div class="search-card" data-product-id="'+esc(p.id)+'" onclick="detail(encodeURIComponent(this.dataset.productId))">'+
    (p.image?'<img src="'+esc(p.image)+'" alt="">':'')+
    '<h3>'+esc(p.displayName||p.name)+'</h3>'+
    '<div class="row"><span>eBay価格</span><b>'+yen(Number(p.sell||0)*fx)+'</b></div>'+
    '<div class="row"><span>eBay送料</span><b>'+(p.shippingKnown===false?'送料未取得':yen(Number(p.ship||0)*fx))+'</b></div>'+
    '<small>'+esc(p.condition||'状態不明')+'｜販売済み価格・販売件数は未確認</small>'+
    '<button class="primary" type="button" style="margin-top:8px" data-product-id="'+esc(p.id)+'" onclick="event.stopPropagation();detail(encodeURIComponent(this.dataset.productId))">利益計算・仕入先を確認</button>'+
    '<button class="secondary" type="button" data-favorite-id="'+esc(p.id)+'" onclick="event.stopPropagation();toggleFavorite(this.dataset.favoriteId)">'+(typeof window.isFavorite==='function'&&window.isFavorite(p.id)?'★ マイリストから削除':'☆ マイリストに追加')+'</button></div>').join('')+
   '<div class="warning" style="grid-column:1/-1">※円表示は取得した為替レートで換算したeBay.com（米国サイト）の現在出品価格です。売れた価格ではありません。</div>';
 }catch(e){box.innerHTML='<div class="warning">最新データを取得できませんでした。'+esc(e.message||'')+'<br>eBayの認証情報がVercelに設定されているか確認してください。</div>';}
}
window.searchProduct=liveSearch;window.search=liveSearch;window.runLiveCategoryRanking=runCategoryRanking;window.searchLiveCategory=searchCategorySuggestions;
const nativeDetail=window.detail;window.detail=function(id){const decoded=decodeURIComponent(String(id||''));const live=(window.__LIVE_CATEGORY_DATA||[]).find(p=>String(p.id)===decoded);if(live){const list=window.__exportApp?.getData?.();if(Array.isArray(list)&&!list.some(p=>String(p.id)===decoded))list.push(live);}if(typeof nativeDetail==='function' && nativeDetail(id))return true;return liveDetail(id);};
window.addEventListener('DOMContentLoaded',async()=>{const fx=await loadFx(),status=document.getElementById('rankingStatus');if(fx&&status)status.textContent='為替：1 USD = '+yen(fx)+'円｜eBayライブ検索を利用できます';injectCategoryUI();const sel=document.getElementById('liveCategorySelect');if(sel)try{const lists=await Promise.all(SEEDS.map(categorySuggestions)),seen=new Set(),opts=[];lists.flat().forEach(x=>{if(!seen.has(x.categoryId)){seen.add(x.categoryId);opts.push(x);}});sel.innerHTML=opts.slice(0,40).map(x=>'<option value="'+esc(x.categoryId)+'">'+esc(x.categoryName)+'</option>').join('')||'<option value="">候補なし</option>';if(opts[0]){sel.dataset.name=opts[0].categoryName;}}catch(e){const s=document.getElementById('liveCategoryStatus');if(s)s.textContent='カテゴリー自動取得に失敗しました：'+e.message;}});
// ライブカテゴリー検索はユーザーがボタンを押した時だけ実行。通常のページ表示ではeBay出品検索をしない。
})();
