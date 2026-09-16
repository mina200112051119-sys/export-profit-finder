(() => {
'use strict';
const E=window.RankingEngine;
if(!E)return;
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const round=v=>Math.round(num(v));
function breakEvenPrice(p,s={}){
  const fx=Math.max(num(s.fxRate,150),0.0001);
  const variable=Math.max(0,num(s.feeRate,0.136))+Math.max(0,num(s.internationalRate,0.0135))+Math.max(0,num(s.conversionFeeRate,0))/100;
  const local=Math.max(0,num(s.domesticShipping))+Math.max(0,num(s.packaging))+Math.max(0,num(s.otherCost));
  const fixedUsd=(Math.max(0,num(p.sell))+Math.max(0,num(p.ship)))<=10?0.30:0.40;
  const fixedJpy=fixedUsd*fx;
  const denominator=1-variable;
  if(num(p.cost)<=0||denominator<=0)return null;
  return round((num(p.cost)+local+fixedJpy)/denominator);
}
function simulateRisk(p,s={}){
  const projected=(days)=>{
    if(num(p.soldMedian)>0){
      const base=num(p.soldMedian), f=p.trend==='上昇'?(days===30?1.01:days===60?1:0.98):p.trend==='下落'?(days===30?0.93:days===60?0.87:0.8):(days===30?0.98:days===60?0.96:0.94);
      return round(base*f);
    }
    const f=p.trend==='上昇'?(days===30?1.01:days===60?1:0.98):p.trend==='横ばい'?(days===30?0.98:days===60?0.96:0.94):p.trend==='下落'?(days===30?0.93:days===60?0.87:0.8):(days===30?0.97:days===60?0.94:0.9);
    return round(Math.max(num(p.sell),0)*f);
  };
  const scenarios=[30,60,90].map(days=>{
    const sale=projected(days);
    const c=E.calcCosts({...p,sell:sale},s);
    const risk=c.profit===null?'要仕入価格':c.profit<0?'高':c.margin!==null&&c.margin<0.1?'高':c.margin!==null&&c.margin<0.2?'中':'低';
    return {days,sale,profit:c.profit,margin:c.margin,risk};
  });
  return {scenarios,breakEven:breakEvenPrice(p,s)};
}
E.breakEvenPrice=breakEvenPrice;
E.simulateRisk=simulateRisk;
window.ExportCostFix={breakEvenPrice,simulateRisk};
})();
