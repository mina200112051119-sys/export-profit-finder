(() => {
  'use strict';

  const CATEGORIES = ['ポケモンカード', 'ポケモン関連サプライ用品', '釣具', 'カメラ', 'レトロゲーム'];
  const WEIGHTS = { sellability: 30, margin: 25, profit: 15, stability: 10, inventoryRisk: 10, fees: 5, marketTrend: 5 };

  function num(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(v, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }
  function round(v) { return Math.round(num(v)); }

  function normalizeProduct(raw = {}) {
    return {
      id: raw.id || raw.itemId || raw.url || `${raw.cat || raw.category || ''}|${raw.name || raw.title || ''}`,
      name: raw.name || raw.title || '商品名不明',
      cat: raw.cat || raw.category || 'その他',
      cost: num(raw.cost),
      sell: num(raw.sell ?? raw.price),
      ship: num(raw.ship ?? raw.shipping),
      image: raw.image || raw.imageUrl || '',
      url: raw.url || raw.itemWebUrl || '',
      sold: Number.isFinite(Number(raw.sold)) ? num(raw.sold) : null,
      list: Number.isFinite(Number(raw.list)) ? num(raw.list) : null,
      trend: raw.trend || '不明',
      risk: raw.risk || '要確認',
      source: raw.source || 'eBay',
      condition: raw.condition || '',
      confidence: raw.confidence || null,
      historicalPrices: Array.isArray(raw.historicalPrices) ? raw.historicalPrices : []
    };
  }

  function calcCosts(p, settings = {}) {
    const fx = Math.max(num(settings.fxRate, 150), 0.0001);
    const feeRate = num(settings.feeRate, 0.136);
    const international = num(settings.internationalRate, 0.0135);
    const orderFeeUsd = num(settings.orderFeeUsd, 0.40);
    const conversionRate = num(settings.conversionFeeRate, 0) / 100;
    const domestic = num(settings.domesticShipping);
    const packaging = num(settings.packaging);
    const other = num(settings.otherCost);

    const saleUsd = Math.max(p.sell, 0);
    const shipUsd = Math.max(p.ship, 0);
    const grossUsd = saleUsd + shipUsd;
    const saleJpy = saleUsd * fx;
    const shipJpy = shipUsd * fx;
    const finalValueFeeJpy = grossUsd * feeRate * fx;
    const internationalFeeJpy = grossUsd * international * fx;
    const fixedFeeJpy = orderFeeUsd * fx;
    const conversionFeeJpy = (saleJpy + shipJpy) * conversionRate;
    const localCosts = domestic + packaging + other;
    const totalFees = finalValueFeeJpy + internationalFeeJpy + fixedFeeJpy + conversionFeeJpy;
    const totalCosts = totalFees + shipJpy + localCosts + p.cost;
    const profit = saleJpy - totalCosts;
    const margin = p.cost > 0 ? profit / p.cost : null;
    return {
      saleJpy: round(saleJpy), shipJpy: round(shipJpy), finalValueFeeJpy: round(finalValueFeeJpy),
      internationalFeeJpy: round(internationalFeeJpy), fixedFeeJpy: round(fixedFeeJpy),
      conversionFeeJpy: round(conversionFeeJpy), localCosts: round(localCosts), totalFees: round(totalFees),
      totalCosts: round(totalCosts), profit: round(profit), margin
    };
  }

  function sellThrough(p) {
    if (p.sold === null || p.list === null || p.sold < 0 || p.list < 0) return null;
    const total = p.sold + p.list;
    return total > 0 ? p.sold / total : null;
  }

  function confidence(p) {
    const sold = p.sold === null ? 0 : p.sold;
    const list = p.list === null ? 0 : p.list;
    if (sold >= 50 && list >= 50) return { level: '高', factor: 1 };
    if (sold >= 20 && list >= 20) return { level: '中', factor: 0.94 };
    if (sold >= 5 && list >= 5) return { level: '中', factor: 0.86 };
    if (sold > 0 || list > 0) return { level: '低', factor: 0.72 };
    return { level: '低', factor: 0.55 };
  }

  function sellabilityScore(p) {
    const rate = sellThrough(p);
    if (rate === null) return 10;
    const base = clamp(rate * 100);
    const dataCount = (p.sold || 0) + (p.list || 0);
    const reliability = dataCount >= 100 ? 1 : dataCount >= 40 ? 0.9 : dataCount >= 10 ? 0.75 : 0.55;
    return clamp(base * reliability);
  }

  function trendScore(p) {
    if (p.trend === '上昇') return 90;
    if (p.trend === '横ばい') return 70;
    if (p.trend === '下落') return 25;
    return 50;
  }

  function stabilityScore(p) {
    const prices = p.historicalPrices.map(num).filter(v => v > 0);
    if (prices.length < 3) return 50;
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / prices.length;
    const cv = avg > 0 ? Math.sqrt(variance) / avg : 1;
    return clamp(100 - cv * 180);
  }

  function feeScore(p, costs) {
    if (p.sell <= 0) return 0;
    const feeRatio = costs.totalFees / Math.max(costs.saleJpy, 1);
    return clamp(100 - feeRatio * 300);
  }

  function marginScore(costs) {
    if (costs.margin === null) return 0;
    if (costs.margin <= 0) return 0;
    return clamp(costs.margin * 250);
  }

  function profitScore(costs, allProfits = []) {
    const positive = allProfits.filter(v => v > 0).sort((a, b) => a - b);
    if (!positive.length || costs.profit <= 0) return 0;
    const max = positive[positive.length - 1];
    return clamp((costs.profit / max) * 100);
  }

  function projectedPrice(p, days) {
    const current = Math.max(p.sell, 0);
    const trend = p.trend;
    let factor = 1;
    if (trend === '上昇') factor = days === 30 ? 1.01 : days === 60 ? 1.00 : 0.98;
    else if (trend === '横ばい') factor = days === 30 ? 0.98 : days === 60 ? 0.96 : 0.94;
    else if (trend === '下落') factor = days === 30 ? 0.93 : days === 60 ? 0.87 : 0.80;
    else factor = days === 30 ? 0.97 : days === 60 ? 0.94 : 0.90;
    const prices = p.historicalPrices.map(num).filter(v => v > 0);
    if (prices.length >= 3) {
      const recent = prices[prices.length - 1];
      const older = prices[0];
      const change = older > 0 ? (recent - older) / older : 0;
      factor *= clamp(1 + change * (days / 90), 0.65, 1.15);
    }
    return round(current * factor);
  }

  function simulateRisk(p, settings = {}) {
    const out = [30, 60, 90].map(days => {
      const sale = projectedPrice(p, days);
      const copy = { ...p, sell: sale };
      const costs = calcCosts(copy, settings);
      let risk = '低';
      if (costs.profit < 0) risk = '高';
      else if (costs.margin !== null && costs.margin < 0.10) risk = '高';
      else if (costs.margin !== null && costs.margin < 0.20) risk = '中';
      return { days, sale, profit: costs.profit, margin: costs.margin, risk };
    });
    const breakEven = breakEvenPrice(p, settings);
    return { scenarios: out, breakEven };
  }

  function breakEvenPrice(p, settings = {}) {
    const fx = Math.max(num(settings.fxRate, 150), 0.0001);
    const feeRate = num(settings.feeRate, 0.136);
    const international = num(settings.internationalRate, 0.0135);
    const fixed = num(settings.orderFeeUsd, 0.40) * fx;
    const local = num(settings.domesticShipping) + num(settings.packaging) + num(settings.otherCost);
    const variable = feeRate + international;
    const requiredJpy = p.cost + local + fixed;
    const denominator = 1 - variable;
    if (denominator <= 0) return null;
    return round(requiredJpy / denominator);
  }

  function inventoryRiskScore(riskData, p) {
    const s = riskData.scenarios;
    let score = 100;
    if (s[0].profit < 0) score -= 60;
    else if (s[0].profit < p.cost * 0.10) score -= 30;
    if (s[1].profit < 0) score -= 25;
    else if (s[1].profit < p.cost * 0.10) score -= 12;
    if (s[2].profit < 0) score -= 25;
    else if (s[2].profit < p.cost * 0.10) score -= 12;
    if (p.cost > 50000) score -= 10;
    return clamp(score);
  }

  function riskFlags(p, costs, riskData) {
    const flags = [];
    if (p.sold === null || p.list === null) flags.push('販売実績データ不足');
    if (p.trend === '下落') flags.push('相場下落傾向');
    if (costs.profit < 0) flags.push('現在価格でも赤字');
    if (riskData.scenarios[2].profit < 0) flags.push('90日後想定で赤字');
    if (p.cost >= 50000) flags.push('高額仕入れ');
    return flags;
  }

  function scoreProduct(p, settings = {}, universe = []) {
    const product = normalizeProduct(p);
    const costs = calcCosts(product, settings);
    const allProfits = universe.map(x => calcCosts(normalizeProduct(x), settings).profit);
    const riskData = simulateRisk(product, settings);
    const sellability = sellabilityScore(product);
    const margin = marginScore(costs);
    const profit = profitScore(costs, allProfits);
    const stability = stabilityScore(product);
    const inventory = inventoryRiskScore(riskData, product);
    const fees = feeScore(product, costs);
    const market = trendScore(product);
    const conf = confidence(product);

    let raw =
      sellability * 0.30 +
      margin * 0.25 +
      profit * 0.15 +
      stability * 0.10 +
      inventory * 0.10 +
      fees * 0.05 +
      market * 0.05;

    raw *= conf.factor;
    const flags = riskFlags(product, costs, riskData);
    if (flags.includes('現在価格でも赤字')) raw -= 25;
    if (flags.includes('90日後想定で赤字')) raw -= 12;
    if (flags.includes('相場下落傾向')) raw -= 8;
    raw = round(clamp(raw));

    const stars = raw >= 90 ? '★★★★★' : raw >= 80 ? '★★★★☆' : raw >= 70 ? '★★★★☆' : raw >= 60 ? '★★★☆☆' : raw >= 50 ? '★★☆☆☆' : '★☆☆☆☆';
    const risk = flags.includes('現在価格でも赤字') || flags.includes('90日後想定で赤字') ? '高' : inventory >= 75 ? '低' : inventory >= 50 ? '中' : '高';
    return { ...product, costs, riskData, scores: { sellability, margin, profit, stability, inventory, fees, market }, totalScore: raw, stars, risk, confidence: conf.level, flags };
  }

  function rank(products, settings = {}, category = null) {
    const normalized = products.map(normalizeProduct);
    const source = category ? normalized.filter(p => p.cat === category) : normalized;
    return source.map(p => scoreProduct(p, settings, normalized)).sort((a, b) => b.totalScore - a.totalScore || b.costs.profit - a.costs.profit || a.name.localeCompare(b.name, 'ja'));
  }

  window.RankingEngine = { CATEGORIES, WEIGHTS, normalizeProduct, calcCosts, sellThrough, confidence, simulateRisk, breakEvenPrice, scoreProduct, rank };
})();
