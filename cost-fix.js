(() => {
'use strict';
const E=window.RankingEngine;
if(!E)return;
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const round=v=>Math.round(num(v));

// 損益分岐点は、商品価格・購入者負担送料・eBay手数料・国際手数料・
// 為替換算手数料・固定手数料・国内経費・仕入価格を同じ計算式で扱う。
// eBayの固定手数料は取引総額(商品価格+購入者負担送料)が10 USD以下なら0.30 USD、
// 10 USD超なら0.40 USDとして、両方の境界を検証して有効な解を返す。
function breakEvenPrice(p,s={}){
  const fx=Math.max(num(s.fxRate,150),0.0001);
  const variable=Math.max(0,num(s.feeRate,0.136))
    +Math.max(0,num(s.internationalRate,0.0135))
    +Math.max(0,num(s.conversionFeeRate,0))/100;
  const local=Math.max(0,num(s.domesticShipping))
    +Math.max(0,num(p.sourcingShippingJpy))
    +Math.max(0,num(s.packaging))
    +Math.max(0,num(s.otherCost));
  const cost=Math.max(0,num(p.cost));
  const buyerShipping=Math.max(0,num(p.ship));
  const denominator=fx*(1-variable);
  if(cost<=0||denominator<=0)return null;

  // 購入者負担送料は売上に加算し、手数料計算には含めるが経費として二重控除しない。
  const solve=(fixedUsd)=>round(
    (cost+local+fixedUsd*fx)/denominator-buyerShipping
  );
  const candidates=[0.30,0.40].map(fixedUsd=>({
    fixedUsd,
    sale:solve(fixedUsd)
  })).filter(x=>x.sale>=0 && ((x.sale+buyerShipping)<=10)===(x.fixedUsd===0.30));

  if(candidates.length)return candidates[0].sale;
  return solve(0.40);
}

function simulateRisk(p,s={}){
  const projected=(days)=>{
    if(p.soldHistoryAvailable && num(p.soldMedian)>0 && (num(p.sell)<=0 || (num(p.soldMedian)>=num(p.sell)*0.5 && num(p.soldMedian)<=num(p.sell)*2))){
      const base=num(p.soldMedian), f=p.trend==='上昇'
        ?(days===30?1.01:days===60?1:0.98)
        :p.trend==='下落'
          ?(days===30?0.93:days===60?0.87:0.8)
          :(days===30?0.98:days===60?0.96:0.94);
      return round(base*f);
    }
    const f=p.trend==='上昇'
      ?(days===30?1.01:days===60?1:0.98)
      :p.trend==='横ばい'
        ?(days===30?0.98:days===60?0.96:0.94)
        :p.trend==='下落'
          ?(days===30?0.93:days===60?0.87:0.8)
          :(days===30?0.97:days===60?0.94:0.9);
    return round(Math.max(num(p.sell),0)*f);
  };

  const scenarios=[30,60,90].map(days=>{
    const sale=projected(days);
    const c=E.calcCosts({...p,sell:sale},s);
    const risk=c.profit===null?'要仕入価格'
      :c.profit<0?'高'
      :c.margin!==null&&c.margin<0.1?'高'
      :c.margin!==null&&c.margin<0.2?'中':'低';
    return {days,sale,profit:c.profit,margin:c.margin,risk};
  });
  return {scenarios,breakEven:breakEvenPrice(p,s)};
}

E.breakEvenPrice=breakEvenPrice;
E.simulateRisk=simulateRisk;
window.ExportCostFix={breakEvenPrice,simulateRisk};

// 詳細画面の意味を明確にする。数値そのものはRankingEngineの計算結果を使用する。
function decorateDetail(){
  const body=document.getElementById('body');
  if(!body||!body.children.length)return;
  const rows=[...body.querySelectorAll('.row')];
  rows.forEach(row=>{
    const label=row.querySelector('span');
    if(!label)return;
    if(label.textContent.trim()==='総合評価')label.textContent='総合評価（ツール独自）';
    if(label.textContent.trim()==='損益分岐点')label.textContent='損益分岐点（現在の送料・手数料前提）';
    if(label.textContent.trim()==='データ信頼度')label.textContent='データ信頼度（取得データ量ベース）';
  });
}

const body=document.getElementById('body');
if(body){
  const observer=new MutationObserver(decorateDetail);
  observer.observe(body,{childList:true,subtree:true});
  decorateDetail();
}
})();

/* Align all profit calculations with conservative eBay.com no-Store base fees. */
(() => {
  'use strict';
  const E = window.RankingEngine;
  if (!E) return;
  const feeFor = p => {
    const cat = String(p?.cat || p?.category || '');
    return /ポケモンカード|trading cards?|collectible card games|\btcg\b|\btc g\b/i.test(cat)
      && !/accessor|supply|サプライ/i.test(cat) ? 0.1325 : 0.136;
  };
  if (typeof E.calcCosts === 'function') {
    const original = E.calcCosts.bind(E);
    E.calcCosts = (p, settings = {}) => original(p, { ...settings, feeRate: feeFor(p) });
  }
  if (typeof E.rank === 'function') {
    const original = E.rank.bind(E);
    E.rank = (products, settings = {}, category = null) => {
      const rates = { ...(settings.feeRateByCategory || {}) };
      (products || []).forEach(p => { rates[p.cat || p.category || ''] = feeFor(p); });
      return original(products, { ...settings, feeRateByCategory: rates }, category);
    };
  }
  if (typeof E.scoreV2 === 'function') {
    const original = E.scoreV2.bind(E);
    E.scoreV2 = (p, settings = {}, universe = []) =>
      original(p, { ...settings, feeRate: feeFor(p) }, universe);
  }
  const subtitle = document.querySelector('header p');
  if (subtitle) subtitle.textContent = 'eBayの現在出品を確認し、仕入れ価格から利益を試算';
  const settingsCard = [...document.querySelectorAll('.card')]
    .find(el => el.querySelector('h2')?.textContent.trim() === '利益計算の設定');
  const note = settingsCard?.querySelector('.notice');
  if (note) note.textContent =
    '手数料率の目安：eBay.comのストア未契約を想定し、ポケモンカードは13.25％、その他は13.6％で計算します。日本のセラーにかかる海外決済手数料1.35％は別に計算します。ストア契約や売上条件で実際の率は変わります。eBay.comのUSD取引では通常、eBayの通貨換算手数料はかかりません。受取先で円に替える費用は別です。';
})();

/* Keep the retro-game daily snapshot aligned with the live search term. */
(() => {
  'use strict';
  const previousFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input?.url || '';
    try {
      const url = new URL(raw, location.origin);
      if (window.__dailySnapshotMode &&
          url.pathname.endsWith('/api/ebay-search') &&
          url.searchParams.get('q') === 'Japanese retro video game software') {
        const snapshot = window.__dailySnapshotLoaded;
        const found = snapshot?.categories?.find(x => x.category === 'レトロゲーム');
        if (found) {
          const items = found.items || [];
          return new Response(JSON.stringify({
            query: 'Japanese retro video game software',
            count: items.length,
            total: found.count || items.length,
            items,
            priceStatsUsd: found.priceStatsUsd || null
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
    } catch {}
    return previousFetch(input, init);
  };
})();
