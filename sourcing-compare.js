(() => {
'use strict';

const SOURCES = [
  ['メルカリ','mercari','https://jp.mercari.com/search?keyword='],
  ['スニダン','snkrdunk','https://snkrdunk.com/search?keyword='],
  ['ヤフオク','yahooAuctions','https://auctions.yahoo.co.jp/search/search?p=']
];

const CONDITIONS = ['新品','未使用','美品','中古','傷あり','ジャンク','状態不明'];

const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[m]));
const yen = v => Number.isFinite(Number(v))
  ? Math.round(Number(v)).toLocaleString('ja-JP') + '円' : '—';

function keyFor(p) {
  return 'sourcingCandidates:v1:' + String(p.id || p.name || '').slice(0,300);
}
function readCandidates(p) {
  try { return JSON.parse(localStorage.getItem(keyFor(p)) || '[]'); }
  catch { return []; }
}
function writeCandidates(p, rows) {
  localStorage.setItem(keyFor(p), JSON.stringify(rows));
}
function categoryOf(p) {
  return p.cat || '釣具';
}
function feeOf(p) {
  const fees = {
    'ポケモンカード':.1325,
    'ポケモン関連サプライ用品':.136,
    '釣具':.136,
    'カメラ':.0935,
    'レトロゲーム':.136
  };
  return fees[categoryOf(p)] ?? .136;
}
function settings() {
  const g=id => Number(document.getElementById(id)?.value || 0);
  return {
    fxRate: Number(window.__exportApp?.getFx?.() || 150),
    feeRate: feeOf(window.__exportSourcingProduct || {}),
    internationalRate: .0135,
    domesticShipping: g('domestic'),
    packaging: g('pack'),
    otherCost: g('other'),
    conversionFeeRate: g('conv')
  };
}
function candidateProfit(p, row) {
  if (!(Number(p.sell) > 0) || !(Number(row.priceJpy) >= 0)) return null;
  const fx = Number(window.__exportApp?.getFx?.() || 150);
  const sellJpy = Number(p.sell) * fx;
  const shipUsd = Number(p.ship) || 0;
  const saleGross = Number(p.sell) + shipUsd;
  const fee = feeOf(p);
  const intl = .0135;
  const conversion = saleGross * fx * (Number(document.getElementById('conv')?.value || 0) / 100);
  const ebayFees = saleGross * (fee + intl) * fx + (saleGross <= 10 ? .30 : .40) * fx + conversion;
  const domestic = Number(row.shippingJpy || 0) + Number(document.getElementById('pack')?.value || 0) + Number(document.getElementById('other')?.value || 0);
  return Math.round(sellJpy - ebayFees - domestic - Number(row.priceJpy));
}

function currentProduct() {
  const name = document.getElementById('title')?.textContent?.trim();
  const list = window.__exportApp?.getData?.() || [];
  return list.find(p => p && p.name === name) || null;
}

function searchUrl(p, source) {
  const found = SOURCES.find(x => x[1] === source);
  return found ? found[2] + encodeURIComponent(p.name || '') : '#';
}

function render(p) {
  const panel = document.getElementById('source-panel');
  if (!panel) return;
  const rows = readCandidates(p);

  panel.innerHTML = `
    <h3>仕入れ候補を保存して比較</h3>
    <div class="notice">
      <b>検索した出品をここに登録できます。</b><br>
      <span class="muted">価格・状態・送料を保存しておけば、後から3社を同じ画面で比較できます。自動取得した価格ではなく、ユーザーが確認して保存した情報です。</span>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>① 現在の出品を探す</h3>
      <div class="grid">
        ${SOURCES.map(([label,source]) => `
          <a class="tab" style="text-decoration:none;text-align:center" href="${esc(searchUrl(p,source))}" target="_blank" rel="noopener">
            ${esc(label)}で検索
          </a>`).join('')}
      </div>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>② 確認した出品を登録</h3>
      <label>仕入先</label>
      <select id="sc-source">
        ${SOURCES.map(([label,source]) => `<option value="${source}">${label}</option>`).join('')}
      </select>
      <label>状態</label>
      <select id="sc-condition">${CONDITIONS.map(x=>`<option>${x}</option>`).join('')}</select>
      <label>商品価格（円）</label>
      <input id="sc-price" type="number" min="0" placeholder="例：8000">
      <label>国内送料（円）</label>
      <input id="sc-shipping" type="number" min="0" value="0">
      <label>出品URL（任意）</label>
      <input id="sc-url" type="url" placeholder="確認した出品ページのURL">
      <label>メモ（任意）</label>
      <input id="sc-note" placeholder="付属品、傷、箱あり等">
      <button id="sc-save" class="primary" type="button">保存する</button>
      <div id="sc-message" class="status" style="display:none"></div>
    </div>

    <div class="card" style="margin-top:10px">
      <h3>③ 保存済みの仕入れ候補</h3>
      <div id="sc-list"></div>
    </div>
  `;

  const sourceLabel = s => SOURCES.find(x=>x[1]===s)?.[0] || s;
  const list = document.getElementById('sc-list');

  function drawList() {
    const current = readCandidates(p);
    if (!current.length) {
      list.innerHTML='<div class="notice">まだ保存されていません。3社それぞれで確認した出品を保存できます。</div>';
      return;
    }
    const ranked = current.map((r,i) => ({r,i,total:Number(r.priceJpy||0)+Number(r.shippingJpy||0),profit:candidateProfit(p,r)}))
      .sort((a,b)=>(b.profit??-Infinity)-(a.profit??-Infinity));
    list.innerHTML = `
      <div class="notice" style="margin-bottom:10px">
        <b>仕入れ候補比較</b><br>
        利益は「商品価格＋国内送料」を実質仕入額として計算しています。状態や付属品などの違いは、最終判断前に必ず確認してください。
      </div>
      <div class="card" style="overflow:auto;margin-bottom:10px">
        <table class="risk-table">
          <tr><th>仕入先</th><th>状態</th><th>実質仕入額</th><th>想定利益</th><th>採用</th></tr>
          ${ranked.map(x=>`<tr><td>${esc(sourceLabel(x.r.source))}</td><td>${esc(x.r.condition)}</td><td>${yen(x.total)}</td><td class="${x.profit==null?'yellow':x.profit>=0?'green':'red'}">${x.profit==null?'計算不可':(x.profit>=0?'+':'')+yen(x.profit)}</td><td>${window.__exportApp?.getSelectedSourcing?.(p.id)?.index===x.i?'✓':''}</td></tr>`).join('')}
        </table>
      </div>
    `;
    list.innerHTML += ranked.map(({r,i,total,profit}) => `
        <div class="card" style="margin:8px 0;padding:12px">
          <div class="row"><b>${esc(sourceLabel(r.source))}</b><span>${esc(r.checkedAtLabel)}</span></div>
          <div class="row"><span>状態</span><b>${esc(r.condition)}</b></div>
          <div class="row"><span>商品価格</span><b>${yen(r.priceJpy)}</b></div>
          <div class="row"><span>国内送料</span><b>${yen(r.shippingJpy)}</b></div>
          <div class="row"><span>実質仕入額</span><b>${yen(total)}</b></div>
          <div class="row"><span>想定利益</span><b class="${profit==null?'yellow':profit>=0?'green':'red'}">${profit==null?'計算不可':(profit>=0?'+':'')+yen(profit)}</b></div>
          ${r.note?`<div class="muted">メモ：${esc(r.note)}</div>`:''}
          ${r.url?`<div style="margin-top:7px"><a href="${esc(r.url)}" target="_blank" rel="noopener">保存した出品を開く →</a></div>`:''}
          ${window.__exportApp?.getSelectedSourcing?.(p.id)?.index===i?'<div class="notice" style="margin-top:8px"><b>✓ 現在の分析に採用中</b></div>':''}
          <button class="primary sc-apply" type="button" data-index="${i}">この仕入れ価格を分析に反映</button>
          <button class="secondary sc-delete" type="button" data-index="${i}">この保存情報を削除</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.sc-apply').forEach(btn => btn.onclick = () => {
      const index = Number(btn.dataset.index);
      const row = readCandidates(p)[index];
      if (!row) return;
      const total = Number(row.priceJpy||0) + Number(row.shippingJpy||0);
      if (!Number.isFinite(total) || total < 0) return;
      const ok = window.__exportApp?.applySourcingCost?.(p.id,total,{source:sourceLabel(row.source),condition:row.condition,checkedAt:row.checkedAt,candidateIndex:index});
      const m=document.getElementById('sc-message');
      if(m){m.style.display='block';m.textContent=ok?'この仕入れ候補を現在の仕入価格として分析に反映しました。':'分析への反映に失敗しました。';}
      drawList();
    });
    list.querySelectorAll('.sc-delete').forEach(btn => btn.onclick = () => {
      const index = Number(btn.dataset.index);
      if (!confirm('この仕入れ候補の保存情報を削除しますか？')) return;
      const next = readCandidates(p);
      next.splice(index,1);
      writeCandidates(p,next);
      drawList();
    });
  }

  document.getElementById('sc-save').onclick = () => {
    const price = Number(document.getElementById('sc-price').value);
    if (!Number.isFinite(price) || price < 0) {
      const m=document.getElementById('sc-message');m.style.display='block';m.textContent='商品価格を入力してください。';return;
    }
    const row = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      source: document.getElementById('sc-source').value,
      condition: document.getElementById('sc-condition').value,
      priceJpy: price,
      shippingJpy: Number(document.getElementById('sc-shipping').value || 0),
      url: document.getElementById('sc-url').value.trim(),
      note: document.getElementById('sc-note').value.trim(),
      checkedAt: new Date().toISOString(),
      checkedAtLabel: new Date().toLocaleString('ja-JP')
    };
    const next=readCandidates(p);
    next.unshift(row);
    writeCandidates(p,next);
    document.getElementById('sc-price').value='';
    document.getElementById('sc-shipping').value='0';
    document.getElementById('sc-url').value='';
    document.getElementById('sc-note').value='';
    const m=document.getElementById('sc-message');m.style.display='block';m.textContent='保存しました。下の比較表に反映しています。';
    drawList();
  };

  drawList();
}

function inject() {
  const body=document.getElementById('body');
  const p=currentProduct();
  if(!body || !p) return;
  let panel=document.getElementById('source-panel');
  if(!panel) {
    panel=document.createElement('div');
    panel.id='source-panel';
    panel.className='card';
    panel.style.marginTop='12px';
    body.appendChild(panel);
  }
  window.__exportSourcingProduct=p;
  render(p);
}

const observer=new MutationObserver(() => {
  const body=document.getElementById('body');
  if(body && body.textContent.trim()) setTimeout(inject,0);
});
observer.observe(document.body,{childList:true,subtree:true});

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject);
else inject();

})();