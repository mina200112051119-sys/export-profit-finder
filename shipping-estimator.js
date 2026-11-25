(() => {
'use strict';
const KEY='exportShippingSettings:v1', ITEM_KEY='exportShippingItem:v1:';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const zones={
  1:['中国','China','韓国','South Korea','Korea','台湾','Taiwan'],
  2:['香港','Hong Kong','マカオ','Macau','シンガポール','Singapore','タイ','Thailand','ベトナム','Vietnam','マレーシア','Malaysia','インドネシア','Indonesia','フィリピン','Philippines','インド','India','パキスタン','Pakistan','バングラデシュ','Bangladesh','スリランカ','Sri Lanka','ネパール','Nepal','モンゴル','Mongolia','カンボジア','Cambodia','ラオス','Laos','ミャンマー','Myanmar','ブルネイ','Brunei','ブータン','Bhutan','モルディブ','Maldives','東ティモール','Timor-Leste','アフガニスタン','Afghanistan'],
  3:['オーストラリア','Australia','ニュージーランド','New Zealand','カナダ','Canada','メキシコ','Mexico','イギリス','United Kingdom','UK','英国','フランス','France','ドイツ','Germany','イタリア','Italy','スペイン','Spain','ポルトガル','Portugal','オランダ','Netherlands','ベルギー','Belgium','スイス','Switzerland','オーストリア','Austria','スウェーデン','Sweden','ノルウェー','Norway','デンマーク','Denmark','フィンランド','Finland','アイルランド','Ireland','ポーランド','Poland','チェコ','Czechia','ギリシャ','Greece','トルコ','Turkey','イスラエル','Israel','サウジアラビア','Saudi Arabia','アラブ首長国連邦','United Arab Emirates','UAE','カタール','Qatar','アフガニスタン','Afghanistan','アルバニア','Albania','アンドラ','Andorra','ベラルーシ','Belarus','ボスニア・ヘルツェゴビナ','Bosnia and Herzegovina','ブルガリア','Bulgaria','クロアチア','Croatia','キプロス','Cyprus','エストニア','Estonia','ジョージア','Georgia','ハンガリー','Hungary','アイスランド','Iceland','ラトビア','Latvia','リヒテンシュタイン','Liechtenstein','リトアニア','Lithuania','ルクセンブルク','Luxembourg','マルタ','Malta','モナコ','Monaco','モンテネグロ','Montenegro','北マケドニア','North Macedonia','ルーマニア','Romania','セルビア','Serbia','スロバキア','Slovakia','スロベニア','Slovenia','ウクライナ','Ukraine','バチカン','Vatican City','アルメニア','Armenia','アゼルバイジャン','Azerbaijan','バーレーン','Bahrain','イラク','Iraq','ヨルダン','Jordan','クウェート','Kuwait','レバノン','Lebanon','オマーン','Oman','イエメン','Yemen','イラン','Iran','オーストラリア','Australia','フィジー','Fiji','パプアニューギニア','Papua New Guinea','サモア','Samoa','トンガ','Tonga','バヌアツ','Vanuatu','ソロモン諸島','Solomon Islands','ミクロネシア','Micronesia','パラオ','Palau','キリバス','Kiribati','ツバル','Tuvalu','ナウル','Nauru','マーシャル諸島','Marshall Islands','フランス領ポリネシア','French Polynesia'],
  4:['アメリカ','米国','アメリカ合衆国','United States','United States of America','USA','US'],
  5:['ブラジル','Brazil','アルゼンチン','Argentina','チリ','Chile','ペルー','Peru','コロンビア','Colombia','南アフリカ','South Africa','ナイジェリア','Nigeria','ケニア','Kenya','モロッコ','Morocco','ガーナ','Ghana','エチオピア','Ethiopia','エジプト','Egypt','アルジェリア','Algeria','アンゴラ','Angola','ベナン','Benin','ボツワナ','Botswana','ブルキナファソ','Burkina Faso','ブルンジ','Burundi','カメルーン','Cameroon','カーボベルデ','Cape Verde','中央アフリカ','Central African Republic','チャド','Chad','コモロ','Comoros','コンゴ共和国','Republic of the Congo','コンゴ民主共和国','Democratic Republic of the Congo','コートジボワール','Ivory Coast','ジブチ','Djibouti','赤道ギニア','Equatorial Guinea','エリトリア','Eritrea','エスワティニ','Eswatini','ガボン','Gabon','ガンビア','Gambia','ギニア','Guinea','ギニアビサウ','Guinea-Bissau','レソト','Lesotho','リベリア','Liberia','リビア','Libya','マダガスカル','Madagascar','マラウイ','Malawi','マリ','Mali','モーリタニア','Mauritania','モーリシャス','Mauritius','モザンビーク','Mozambique','ナミビア','Namibia','ニジェール','Niger','ルワンダ','Rwanda','セネガル','Senegal','セーシェル','Seychelles','シエラレオネ','Sierra Leone','ソマリア','Somalia','南スーダン','South Sudan','スーダン','Sudan','タンザニア','Tanzania','トーゴ','Togo','チュニジア','Tunisia','ウガンダ','Uganda','ザンビア','Zambia','ジンバブエ','Zimbabwe','アフガニスタン','Afghanistan','アンティグア・バーブーダ','Antigua and Barbuda','バハマ','Bahamas','バルバドス','Barbados','ベリーズ','Belize','ボリビア','Bolivia','コスタリカ','Costa Rica','キューバ','Cuba','ドミニカ共和国','Dominican Republic','エクアドル','Ecuador','エルサルバドル','El Salvador','グレナダ','Grenada','グアテマラ','Guatemala','ガイアナ','Guyana','ハイチ','Haiti','ホンジュラス','Honduras','ジャマイカ','Jamaica','ニカラグア','Nicaragua','パナマ','Panama','パラグアイ','Paraguay','スリナム','Suriname','トリニダード・トバゴ','Trinidad and Tobago','ウルグアイ','Uruguay','ベネズエラ','Venezuela']
};
const countries=['日本',...new Set(Object.values(zones).flat())].filter(x=>!/^(UK|UAE|USA|US)$/.test(x));
const rateTable={
  1:[2050,2750,3450,4150,4850],
  2:[2500,3700,4900,6100,7300],
  3:[3850,6000,8150,10300,12450],
  4:[4200,6700,9200,11700,14200],
  5:[4550,7250,9950,12650,15350]
};
// Japan Post International Parcel Post, airmail, 1-5kg bands. Rates checked 2026-11-25.
const defaults={
 'ポケモンカード':{g:180,d:[25,18,3]},
 'ポケモン関連サプライ用品':{g:450,d:[28,22,10]},
 '釣具':{g:850,d:[35,25,12]},
 'カメラ':{g:1100,d:[28,23,16]},
 'レトロゲーム':{g:450,d:[28,22,10]},
 'ガンプラ':{g:1400,d:[45,32,15]},
 '交換部品・消耗品':{g:350,d:[22,16,8]}
};
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
function norm(s){return String(s||'').trim().toLowerCase().replace(/\\s+/g,' ')}
function countryZone(country){
 const c=norm(country); if(!c)return null;
 for(const [z,names] of Object.entries(zones)) if(names.some(n=>norm(n)===c))return Number(z);
 if(/^(japan|日本|にほん)$/.test(c))return 0;
 return null;
}
function classify(p){
 const cat=String(p?.cat||p?.category||'交換部品・消耗品'),t=norm([p?.name,p?.title,p?.displayName].join(' '));
 let x={...(defaults[cat]||defaults['交換部品・消耗品'])};
 if(cat==='ポケモン関連サプライ用品'){
  if(/playmat|プレイマット|ラバーマット/.test(t))x={g:900,d:[40,30,8]};
  else if(/binder|バインダー|ファイル|album/.test(t))x={g:650,d:[32,26,6]};
  else if(/deck.?box|デッキケース|sleeve|スリーブ/.test(t))x={g:250,d:[18,13,8]};
 }
 if(cat==='釣具'){
  if(/rod|ロッド|釣竿|釣り竿/.test(t))x={g:1800,d:[110,15,12]};
  else if(/reel|リール/.test(t))x={g:650,d:[22,18,14]};
  else x={g:250,d:[20,15,8]};
 }
 if(cat==='カメラ'){
  if(/lens|レンズ/.test(t))x={g:900,d:[25,20,18]};
  else if(/flash|ストロボ|フラッシュ/.test(t))x={g:550,d:[22,17,12]};
  else if(/compact|コンパクト|μ-|powershot|coolpix|finepix/.test(t))x={g:500,d:[20,16,12]};
 }
 if(cat==='レトロゲーム'){
  if(/console|本体|ゲーム機/.test(t))x={g:1800,d:[38,30,16]};
  else if(/controller|コントローラー/.test(t))x={g:450,d:[24,18,10]};
  else x={g:250,d:[20,15,5]};
 }
 if(cat==='ガンプラ'){
  if(/pg|パーフェクトグレード/.test(t))x={g:2600,d:[60,42,20]};
  else if(/mg|マスターグレード|mgsd/.test(t))x={g:1300,d:[42,32,14]};
  else if(/hg|rg|eg|ハイグレード|リアルグレード/.test(t))x={g:650,d:[32,24,12]};
 }
 if(cat==='交換部品・消耗品'){
  if(/battery|バッテリー|電源ユニット|power supply/.test(t))x={g:1000,d:[28,22,15]};
  else if(/rod|ロッド|穂先|シャフト/.test(t))x={g:800,d:[80,10,8]};
 }
 return x;
}
function getItem(p){return read(ITEM_KEY+String(p?.id||p?.itemId||''),{})}
function estimate(p,country){
 const z=countryZone(country);if(z===null)return {cost:null,reason:'この国の料金区分は未登録です',approx:false};
 const item=getItem(p),base=classify(p);
 const g=Number(item.weight)>0?Number(item.weight):base.g;
 const dims=['length','width','height'].map((k,i)=>Number(item[k])>0?Number(item[k]):base.d[i]);
 if(z===0){
  const size=dims.reduce((a,b)=>a+b,0);
  const cost=size<=60?800:size<=80?1000:size<=100?1300:size<=120?1600:size<=140?2000:2400;
  return {cost,reason:'国内向けの大きさ別概算・全国一律の目安',approx:true,weight:g,dims,source:'国内送料の概算'};
 }
 const kg=Math.max(1,Math.ceil(g/1000));
 if(kg>5)return {cost:null,reason:'5kgを超えるため料金表の概算対象外です',approx:false,weight:g,dims};
 return {cost:rateTable[z][kg-1],reason:'日本郵便・国際小包（航空便）の料金目安',approx:true,weight:g,dims,zone:z,kg};
}
function selectedCountry(){return String(document.getElementById('ship-country')?.value||read(KEY,{country:'アメリカ'}).country||'アメリカ')}
function currentEstimate(p){return estimate(p,selectedCountry())}
function addSettingsUI(){
 const card=[...document.querySelectorAll('details.card')].find(x=>x.querySelector('summary')?.textContent.includes('利益計算の設定'));
 if(!card||document.getElementById('ship-country'))return;
 const host=card.querySelector('div[style*="padding-top"]');if(!host)return;
 const saved=read(KEY,{country:'アメリカ'});
 const wrap=document.createElement('div');wrap.className='notice';wrap.style.marginTop='10px';
 wrap.innerHTML='<b>購入者の配送先</b><label for="ship-country">国を選択</label><select id="ship-country">'+countries.map(c=>'<option value="'+esc(c)+'" '+(norm(c)===norm(saved.country||'アメリカ')?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select><p class="muted">国名を一覧から選びます。購入者の郵便番号は不要です。料金区分がない国は「概算不可」と表示します。</p><div id="ship-country-status" class="muted"></div>';
 host.appendChild(wrap);
 const input=document.getElementById('ship-country');
 input.addEventListener('change',()=>{localStorage.setItem(KEY,JSON.stringify({country:input.value.trim()}));refreshAll();});
 // The former one-size shipping field remains available only as an extra expense.
 const label=[...host.querySelectorAll('label')].find(x=>x.textContent.includes('海外発送送料'));
 if(label)label.textContent='追加の発送費用（必要な場合のみ・円）';
 updateCountryStatus();
}
function updateCountryStatus(){
 const el=document.getElementById('ship-country-status');if(!el)return;
 const z=countryZone(selectedCountry());
 el.textContent=z===0?'日本国内向けの送料を大きさから概算します。':z===null?'この国は料金区分を確認できないため、送料は未計算になります。':'日本郵便の国際小包（航空便）・地域区分 '+z+' の料金を使います。';
}
function itemPanel(p){
 const base=classify(p),v=getItem(p),e=estimate(p,selectedCountry());
 const w=v.weight??'',l=v.length??'',wi=v.width??'',h=v.height??'';
 return '<section id="shipping-item-panel" class="card" style="margin-top:12px"><h3>海外発送送料の概算</h3><div class="row"><span>配送先</span><b>'+esc(selectedCountry()||'未選択')+'</b></div><div class="row"><span>概算送料</span><b>'+(e.cost==null?'概算不可':Math.round(e.cost).toLocaleString('ja-JP')+'円')+'</b></div><p class="muted">'+esc(e.reason)+'。標準値：'+base.g+'g／'+base.d.join('×')+'cm。実際の送料は梱包後の重さ・大きさ、引受条件で変わります。</p><h3>発送する商品の重さ・サイズ（任意）</h3><div class="grid"><div><label>重さ（g）</label><input id="ship-weight" type="number" min="1" placeholder="'+base.g+'" value="'+esc(w)+'"></div><div><label>縦（cm）</label><input id="ship-length" type="number" min="1" placeholder="'+base.d[0]+'" value="'+esc(l)+'"></div><div><label>横（cm）</label><input id="ship-width" type="number" min="1" placeholder="'+base.d[1]+'" value="'+esc(wi)+'"></div><div><label>高さ（cm）</label><input id="ship-height" type="number" min="1" placeholder="'+base.d[2]+'" value="'+esc(h)+'"></div></div><button id="ship-save-item" class="secondary" type="button">サイズを保存して送料を再計算</button><div id="ship-item-message" class="muted"></div></section>';
}
function injectItemPanel(){
 const body=document.getElementById('body'),p=window.__detailProduct;
 if(!body||!p||!document.getElementById('source-panel')||document.getElementById('shipping-item-panel'))return;
 const panel=document.createElement('div');panel.innerHTML=itemPanel(p);
 const node=panel.firstElementChild;body.appendChild(node);
 document.getElementById('ship-save-item').addEventListener('click',()=>{
  const readNum=id=>{const v=String(document.getElementById(id)?.value||'').trim();return v===''?null:Number(v)};
  const values={weight:readNum('ship-weight'),length:readNum('ship-length'),width:readNum('ship-width'),height:readNum('ship-height')};
  if(Object.values(values).some(v=>v!==null&&(!Number.isFinite(v)||v<=0))){document.getElementById('ship-item-message').textContent='重さ・サイズは1以上の数値で入力してください。';return;}
  localStorage.setItem(ITEM_KEY+String(p.id),JSON.stringify(values));
  document.getElementById('ship-item-message').textContent='保存しました。送料と利益を再計算しました。';
  refreshAll();
  const old=document.getElementById('shipping-item-panel');if(old)old.remove();injectItemPanel();
 });
}
function refreshAll(){
 updateCountryStatus();
 const p=window.__detailProduct;
 if(p){
  const old=document.getElementById('shipping-item-panel');if(old)old.remove();
  if(document.getElementById('source-panel'))injectItemPanel();
  const E=window.RankingEngine;
  if(E&&typeof E.calcCosts==='function'){
   const g=id=>Math.max(0,Number(document.getElementById(id)?.value||0));
   const fee=/ポケモンカード/.test(String(p.cat||''))&&!/サプライ/.test(String(p.cat||'')) ? 0.1325 : 0.136;
   const result=E.calcCosts(p,{fxRate:Number(window.__exportApp?.getFx?.()||150),feeRate:fee,internationalRate:.0135,domesticShipping:g('domestic'),packaging:g('pack'),otherCost:g('other'),conversionFeeRate:g('conv')});
   const row=[...document.querySelectorAll('#body .row')].find(x=>x.querySelector('span')?.textContent.trim()==='予想利益');
   const value=row?.querySelector('b');
   if(value){value.className=result.profit==null?'yellow':result.profit>=0?'green':'red';value.textContent=result.outboundShippingKnown===false?'発送送料が未確認のため未計算':result.profit==null?'仕入価格未入力':Math.round(result.profit).toLocaleString('ja-JP')+'円';}
   const outbound=document.getElementById('profit-outbound-shipping');if(outbound)outbound.textContent='−'+Math.round(result.domesticShippingJpy||0).toLocaleString('ja-JP')+'円';
   const total=document.getElementById('profit-total-costs');if(total)total.textContent='−'+Math.round(result.totalCosts||0).toLocaleString('ja-JP')+'円';
   const final=document.getElementById('profit-final');if(final){final.className=result.profit==null?'yellow':result.profit>=0?'green':'red';final.textContent=result.outboundShippingKnown===false?'発送送料が未確認のため未計算':result.profit==null?'仕入価格未入力':Math.round(result.profit).toLocaleString('ja-JP')+'円';}
  }
  if(typeof window.updateVisibleProfit==='function')window.updateVisibleProfit(p);
 }
}
const E=window.RankingEngine;
if(E&&typeof E.calcCosts==='function'){
 const original=E.calcCosts.bind(E);
 E.calcCosts=(p,s={})=>{
  const e=estimate(p,selectedCountry());
  const extra=Math.max(0,Number(s.domesticShipping||0));
  const result=original(p,{...s,domesticShipping:extra+(e.cost==null?0:e.cost)});
  if(e.cost==null)return {...result,profit:null,margin:null,outboundShippingKnown:false,outboundShippingEstimate:null};
  return {...result,outboundShippingKnown:true,outboundShippingEstimate:e.cost};
 };
}
window.ExportShippingEstimator={estimate,currentEstimate,classify,countryZone};
const observer=new MutationObserver(()=>{addSettingsUI();injectItemPanel();});
observer.observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{addSettingsUI();injectItemPanel()});
else {addSettingsUI();injectItemPanel();}
})();