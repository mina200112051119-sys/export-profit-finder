(() => {
'use strict';

const rules={
  'ポケモンカード':[['メルカリ','https://jp.mercari.com/search?keyword='],['Yahoo!オークション','https://auctions.yahoo.co.jp/search/search?p='],['スニダン','https://snkrdunk.com/search']],
  'ポケモン関連サプライ用品':[['メルカリ','https://jp.mercari.com/search?keyword='],['Yahoo!オークション','https://auctions.yahoo.co.jp/search/search?p='],['スニダン','https://snkrdunk.com/search']],
  '釣具':[['メルカリ','https://jp.mercari.com/search?keyword='],['Yahoo!オークション','https://auctions.yahoo.co.jp/search/search?p=']],
  'カメラ':[['メルカリ','https://jp.mercari.com/search?keyword='],['Yahoo!オークション','https://auctions.yahoo.co.jp/search/search?p=']],
  'レトロゲーム':[['メルカリ','https://jp.mercari.com/search?keyword='],['Yahoo!オークション','https://auctions.yahoo.co.jp/search/search?p=']]
};

const esc=v=>String(v??'').replace(/[&<>\\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\"':'&quot;',"'":'&#39;'}[m]));
const moneyClass=v=>Number(v)<0?'red':Number(v)>=0?'green':'yellow';

function getProductName(){return document.getElementById('title')?.textContent?.trim()||'この商品';}

function ensureModalScroll(){
  if(document.getElementById('stable-detail-style'))return;
  const style=document.createElement('style');
  style.id='stable-detail-style';
  style.textContent=`
    .modal-backdrop.open{overflow:hidden}
    .modal{max-height:92vh;overflow-y:auto;-webkit-overflow-scrolling:touch}
    .modal #body{padding-bottom:40px}
    #risk-detail-box,#source-panel{display:block;width:100%}
  `;
  document.head.appendChild(style);
}

function injectRiskDetail(){
  const body=document.getElementById('body');
  if(!body||document.getElementById('risk-detail-box'))return false;
  const table=body.querySelector('.risk-table');
  if(!table)return false;

  // 元の表には見出し行が tbody に入るため、td が4個あるデータ行だけを対象にする。
  const rows=[...table.querySelectorAll('tr')].filter(row=>row.querySelectorAll('td').length===4);
  if(!rows.length)return false;

  const data=rows.map(row=>{
    const cells=[...row.querySelectorAll('td')].map(x=>x.textContent.trim());
    return {days:cells[0]||'',sale:cells[1]||'—',profit:cells[2]||'—',risk:cells[3]||'要確認'};
  });
  const riskClass=r=>r==='低'?'low':r==='中'?'mid':r==='高'?'high':'yellow';
  table.style.display='none';
  const first=data[0];
  const box=document.createElement('div');
  box.id='risk-detail-box';
  box.innerHTML=`<div class="notice" style="margin-top:10px"><b>売れ残りリスク</b><br><span class="muted">30・60・90日後は、売れ残って価格を下げた場合の<strong>想定・試算値</strong>です。将来の販売価格を保証するものではありません。</span></div><div class="card" style="margin-top:10px;padding:12px"><div class="row"><span>30日後の想定利益</span><b class="${moneyClass(parseInt(first.profit.replace(/[^-0-9]/g,''),10))}">${esc(first.profit)}</b></div><div class="row"><span>30日後のリスク</span><b class="${riskClass(first.risk)}">${esc(first.risk)}</b></div><button id="risk-detail-toggle" class="secondary" type="button" aria-expanded="false">30・60・90日後の詳細を見る</button><div id="risk-detail-content" hidden style="margin-top:10px"><table class="risk-table"><thead><tr><th>期間</th><th>想定売価</th><th>利益</th><th>リスク</th></tr></thead><tbody>${data.map(x=>`<tr><td>${esc(x.days)}</td><td>${esc(x.sale)}</td><td>${esc(x.profit)}</td><td class="${riskClass(x.risk)}">${esc(x.risk)}</td></tr>`).join('')}</tbody></table><div class="notice" style="margin-top:10px"><b>見方</b><br><span class="muted">30日→60日→90日の順に、売れ残って価格を下げた場合を想定しています。利益がマイナスなら赤字です。</span></div></div></div>`;
  table.parentNode.insertBefore(box,table);
  const toggle=box.querySelector('#risk-detail-toggle');
  const content=box.querySelector('#risk-detail-content');
  toggle.addEventListener('click',()=>{
    const open=!content.hidden;
    content.hidden=open;
    toggle.setAttribute('aria-expanded',String(!open));
    toggle.textContent=open?'30・60・90日後の詳細を見る':'詳細を閉じる';
  });
  return true;
}

function injectSourcing(){
  const body=document.getElementById('body');
  if(!body||document.getElementById('source-panel'))return false;
  const name=getProductName();
  const q=encodeURIComponent(name);
  const text=(document.getElementById('title')?.textContent||'')+' '+body.textContent;
  const category=text.includes('ポケモン')?'ポケモンカード':text.includes('釣具')?'釣具':text.includes('カメラ')?'カメラ':text.includes('ゲーム')?'レトロゲーム':'釣具';
  const rs=rules[category];
  const panel=document.createElement('div');
  panel.id='source-panel';panel.className='card';panel.style.marginTop='12px';
  panel.innerHTML=`<h3>仕入れ価格の根拠・比較</h3><div class="notice"><b>仕入れ価格を確認できます</b><br><span class="muted">下のサイトで現在の出品価格を確認して、実際にかかる送料なども含めて仕入れ判断してください。</span></div><div class="row"><span>商品名</span><b>${esc(name)}</b></div><button class="secondary" type="button" id="source-toggle">その他の仕入れ先候補も比較する</button><div id="source-content" hidden style="margin-top:10px"><h3>仕入れ先比較</h3>${rs.map(([label,base])=>`<div class="card" style="margin:8px 0;padding:12px"><div class="row"><b>${esc(label)}</b><span class="yellow">現在価格：サイトで確認</span></div><a href="${base}${q}" target="_blank" rel="noopener" style="font-weight:800">現在の出品を確認 →</a></div>`).join('')}<div class="notice"><b>比較の注意</b><br><span class="muted">中古品は状態・付属品・送料などで実際の仕入額が変わります。表示価格だけで決めないでください。</span></div></div>`;
  body.appendChild(panel);
  const toggle=panel.querySelector('#source-toggle');
  const content=panel.querySelector('#source-content');
  toggle.addEventListener('click',()=>{
    const open=!content.hidden;
    content.hidden=open;
    toggle.textContent=open?'その他の仕入れ先候補も比較する':'仕入れ先比較を閉じる';
  });
  return true;
}

ensureModalScroll();

const observer=new MutationObserver(()=>{
  injectRiskDetail();
  injectSourcing();
});

function start(){
  const body=document.getElementById('body');
  if(!body)return;
  observer.observe(body,{childList:true,subtree:true});
  injectRiskDetail();
  injectSourcing();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
