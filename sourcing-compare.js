(() => {
'use strict';

const SOURCES = [
  ['メルカリ','mercari','https://jp.mercari.com/search?keyword='],
  ['スニダン','snkrdunk','https://snkrdunk.com/search?keyword='],
  ['ヤフオク','yahooAuctions','https://auctions.yahoo.co.jp/search/search?p=']
];

const OFFICIAL_CATALOGS = {
  'ポケモンカード': [
    ['ポケモンカード公式 カード検索','https://www.pokemon-card.com/card-search/']
  ],
  'ポケモン関連サプライ用品': [
    ['ポケモン公式 グッズ一覧','https://www.pokemon.co.jp/goods/'],
    ['ポケモンカード公式','https://www.pokemon-card.com/']
  ],
  '釣具': [
    ['シマノ公式 製品情報','https://fish.shimano.com/ja-JP'],
    ['ダイワ公式 製品情報','https://www.daiwa.com/jp/product']
  ],
  'カメラ': [
    ['キヤノン公式 カメラミュージアム','https://global.canon/ja/c-museum/camera.html'],
    ['ニコン公式 製品情報','https://nij.nikon.com/']
  ],
  'レトロゲーム': [
    ['任天堂公式 ソフト・商品情報','https://www.nintendo.com/jp/'],
    ['セガ公式 家庭用ゲーム検索','https://www.sega.jp/game/soft/']
  ],
  'ガンプラ': [
    ['BANDAI SPIRITS公式 商品検索','https://www.bandaispirits.co.jp/products/search/']
  ]
};

const CONDITIONS = ['新品','未使用','美品','中古','傷あり','ジャンク','状態不明'];

const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[m]));
const yen = v => Number.isFinite(Number(v))
  ? Math.round(Number(v)).toLocaleString('ja-JP') + '円' : '—';

function officialCandidateKey(p) {
  return 'selectedOfficialCandidate:v1:' + String(p.id || p.name || '').slice(0,300);
}
function readOfficialCandidate(p) {
  try { return JSON.parse(localStorage.getItem(officialCandidateKey(p)) || 'null'); }
  catch { return null; }
}
function writeOfficialCandidate(p, candidate) {
  try {
    if (candidate) localStorage.setItem(officialCandidateKey(p), JSON.stringify(candidate));
    else localStorage.removeItem(officialCandidateKey(p));
    return true;
  } catch { return false; }
}

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
  const cat = String(p.cat || p.category || '');
  if (OFFICIAL_CATALOGS[cat]) return cat;
  if (/gunpla|ガンプラ|gundam/i.test(cat)) return 'ガンプラ';
  if (/pokemon.*accessor|サプライ/i.test(cat)) return 'ポケモン関連サプライ用品';
  if (/pokemon|ポケモン|tcg|trading card/i.test(cat)) return 'ポケモンカード';
  if (/fish|釣具|釣り/i.test(cat)) return '釣具';
  if (/camera|カメラ|lens/i.test(cat)) return 'カメラ';
  if (/retro|game|ゲーム|任天堂|セガ/i.test(cat)) return 'レトロゲーム';
  return cat || 'その他';
}
function feeOf(p) {
  const fees = {
    'ポケモンカード':.1325,
    'ポケモン関連サプライ用品':.136,
    '釣具':.136,
    'カメラ':.0935,
    'レトロゲーム':.136,
    'ガンプラ':.136
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
  const shipUsd = Number(p.ship) || 0;
  const saleGross = Number(p.sell) + shipUsd;
  // RankingEngine.calcCosts counts both item revenue and buyer-paid shipping as revenue.
  // Use the same gross amount here so sourcing comparison profit matches product detail.
  const grossSaleJpy = saleGross * fx;
  const fee = feeOf(p);
  const intl = .0135;
  const conversion = saleGross * fx * (Number(document.getElementById('conv')?.value || 0) / 100);
  const ebayFees = saleGross * (fee + intl) * fx + (saleGross <= 10 ? .30 : .40) * fx + conversion;
  const domestic = Number(row.shippingJpy || 0) + Number(document.getElementById('domestic')?.value || 0) + Number(document.getElementById('pack')?.value || 0) + Number(document.getElementById('other')?.value || 0);
  return Math.round(grossSaleJpy - ebayFees - domestic - Number(row.priceJpy));
}

function currentProduct() {
  if (window.__detailProduct) return window.__detailProduct;
  const name = document.getElementById('title')?.textContent?.trim();
  const list = window.__exportApp?.getData?.() || [];
  const regular = list.find(p => p && (p.name === name || p.displayName === name));
  if (regular) return regular;
  const live = window.__LIVE_CATEGORY_DATA || [];
  return live.find(p => p && (p.name === name || p.displayName === name || (name && name.startsWith(p.name + '｜詳細')))) || null;
}

const SEARCH_NAME_KEY = 'domesticSearchName:v1:';

function getDomesticSearchName(p) {
  try {
    const saved = localStorage.getItem(SEARCH_NAME_KEY + String(p.id));
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return String(p.domesticSearchName || p.displayName || p.name || '').trim();
}

function saveDomesticSearchName(p, value) {
  const name = String(value || '').trim();
  try {
    if (name) localStorage.setItem(SEARCH_NAME_KEY + String(p.id), name);
    else localStorage.removeItem(SEARCH_NAME_KEY + String(p.id));
  } catch {}
  return name;
}

function originalModelTokens(value) {
  const matches = String(value || '').match(/[A-Za-z]{1,10}[- ]?\d{1,5}[A-Za-z0-9-]*/g) || [];
  return matches.map(raw => ({
    raw,
    compact: raw.normalize('NFKC').toLowerCase().replace(/[\s　・･\-‐‑–—_【】「」『』()（）［］]/g, '')
  })).filter(token => token.compact && /\d/.test(token.compact));
}

function searchUrl(p, source, query = getDomesticSearchName(p)) {
  const found = SOURCES.find(x => x[1] === source);
  return found ? found[2] + encodeURIComponent(query || p.name || '') : '#';
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
      <h3>① 国内で流通する商品名で探す</h3>
      <label for="sc-search-name">国内検索用の商品名・型番</label>
      <input id="sc-search-name" value="${esc(getDomesticSearchName(p))}" placeholder="日本の商品名や型番を入力">
      <p class="muted">商品名が直訳のままの場合は、日本で使われている商品名・型番に直してから検索できます。入力した検索名は、この商品についてこの端末に保存されます。正式名称が自動確認済みという意味ではありません。</p>
      <div id="sc-search-links" class="grid"></div>
      <div class="card" style="margin-top:10px">
        <h3>公式情報で商品名・型番を照合</h3>
        <div class="muted">カテゴリーに対応するメーカー・権利元の公式情報を開けます。公式サイトへのリンクを表示していますが、現時点ではサイト内データを自動取得・照合した状態ではありません。</div>
        <div id="sc-official-links" class="grid" style="margin-top:8px"></div>
        <button id="sc-official-search" class="primary" type="button" style="margin-top:8px">公式情報を検索</button>
        <button id="sc-translate-search" class="secondary" type="button" style="margin-top:8px">英語タイトルを日本語にして公式情報を検索</button>
        <div class="muted">翻訳結果は検索語の候補です。メーカー公式の正式名称として確定したものではありません。</div>
        <div id="sc-official-results" style="margin-top:8px"></div>
        <div class="notice" style="margin-top:8px"><b>名称確認状況：未確認</b><br>公式情報から候補が返っても、商品名・型番・画像を照合するまでは正式名称として確定しません。</div>
        <div id="sc-selected-official" class="notice" style="margin-top:8px"></div>
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

  const searchNameInput = document.getElementById('sc-search-name');
  const searchLinks = document.getElementById('sc-search-links');
  function drawSearchLinks() {
    const query = String(searchNameInput?.value || '').trim();
    if (!searchLinks) return;
    searchLinks.innerHTML = SOURCES.map(([label, source]) => {
      const href = searchUrl(p, source, query);
      return '<a class="tab" style="text-decoration:none;text-align:center" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(label) + 'で検索</a>';
    }).join('');
  }
  if (searchNameInput) {
    searchNameInput.addEventListener('input', () => {
      saveDomesticSearchName(p, searchNameInput.value);
      drawSearchLinks();
    });
  }
  drawSearchLinks();

  let selectedOfficialCandidate = readOfficialCandidate(p);
  const selectedOfficialPanel = document.getElementById('sc-selected-official');
  function drawSelectedOfficialCandidate() {
    if (!selectedOfficialPanel) return;
    if (!selectedOfficialCandidate) {
      selectedOfficialPanel.innerHTML = '<b>公式候補：未選択</b><br>候補を採用すると、検索語と保存した仕入れ候補に紐づきます。';
      return;
    }
    selectedOfficialPanel.innerHTML = '<b>採用中の公式候補（同一商品かは要確認）</b><br>' +
      (selectedOfficialCandidate.image ? '<img src="' + esc(selectedOfficialCandidate.image) + '" alt="採用した公式候補画像" style="max-width:90px;max-height:90px;object-fit:contain;vertical-align:middle">' : '') +
      '<b>' + esc(selectedOfficialCandidate.title) + '</b><br><span class="muted">' + esc(selectedOfficialCandidate.sourceName || '公式情報') + '</span><br>' +
      (selectedOfficialCandidate.url ? '<a href="' + esc(selectedOfficialCandidate.url) + '" target="_blank" rel="noopener noreferrer">採用した公式ページを確認</a><br>' : '') +
      '<button type="button" class="secondary" id="sc-clear-official">採用候補を解除</button>';
    document.getElementById('sc-clear-official')?.addEventListener('click', () => {
      selectedOfficialCandidate = null;
      writeOfficialCandidate(p, null);
      drawSelectedOfficialCandidate();
    });
  }
  drawSelectedOfficialCandidate();

  const officialLinks = document.getElementById('sc-official-links');
  const catalogs = OFFICIAL_CATALOGS[categoryOf(p)] || [];
  if (officialLinks) {
    officialLinks.innerHTML = catalogs.length
      ? catalogs.map(([label, href]) => '<a class="tab" style="text-decoration:none;text-align:center" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>').join('')
      : '<div class="muted">このカテゴリーの公式情報リンクは未登録です。正式名称は未確認のまま扱います。</div>';
  }

  const officialSearchButton = document.getElementById('sc-official-search');
  const translateSearchButton = document.getElementById('sc-translate-search');
  const officialResults = document.getElementById('sc-official-results');
  if (translateSearchButton && officialSearchButton && officialResults) {
    translateSearchButton.onclick = async () => {
      const original = String(searchNameInput?.value || '').trim();
      if (!original) {
        officialResults.innerHTML = '<div class="notice">英語の商品名・型番を入力してください。</div>';
        return;
      }
      translateSearchButton.disabled = true;
      translateSearchButton.textContent = '日本語に変換中…';
      try {
        const response = await fetch('/api/translate?text=' + encodeURIComponent(original) + '&to=ja');
        const data = await response.json();
        if (!response.ok || !data.translated) throw new Error(data.error || '翻訳に失敗しました');
        const translated = String(data.translated).trim();
        if (!translated) throw new Error('日本語の検索語を作成できませんでした');
        // Translation can omit or alter model identifiers (e.g. Z8, EOS R5,
        // HG 1/144, Pokémon 151). Keep digit-bearing tokens from the original
        // eBay title so domestic searches remain specific.
        const identifiers = original.match(/[A-Za-z]{1,8}[- ]?\\d{1,5}[A-Za-z0-9-]*/g) || [];
        const translatedCompact = translated.normalize('NFKC').toLowerCase().replace(/[\\s　・･\\-‐‑–—_【】「」『』()（）［］]/g, '');
        const preserved = identifiers.filter(token => {
          const compact = token.normalize('NFKC').toLowerCase().replace(/[\\s　・･\\-‐‑–—_【】「」『』()（）［］]/g, '');
          return compact && !translatedCompact.includes(compact);
        });
        const domesticQuery = [translated, ...preserved].join(' ').trim();
        if (searchNameInput) {
          searchNameInput.value = domesticQuery;
          saveDomesticSearchName(p, domesticQuery);
          drawSearchLinks();
        }
        officialResults.innerHTML = '<div class="notice"><b>日本語の検索語を作成しました</b><br>元の商品名：' + esc(original) + '<br>翻訳結果：' + esc(translated) +
          (preserved.length ? '<br>型番・数字を含む表記を保持：' + esc(preserved.join('、')) : '') +
          '<br>機械翻訳は正式名称の確定ではありません。商品名・型番・画像を公式情報で照合してください。</div>';
        officialSearchButton.click();
      } catch (error) {
        officialResults.innerHTML = '<div class="notice">翻訳できませんでした。元の商品名・型番は変更していません。' + esc(error.message || '') + '</div>';
      } finally {
        translateSearchButton.disabled = false;
        translateSearchButton.textContent = '英語タイトルを日本語にして公式情報を検索';
      }
    };
  }
  if (officialSearchButton && officialResults) {
    officialSearchButton.onclick = async () => {
      const query = String(searchNameInput?.value || '').trim();
      if (!query) {
        officialResults.innerHTML = '<div class="notice">国内検索用の商品名・型番を入力してください。</div>';
        return;
      }
      officialSearchButton.disabled = true;
      officialSearchButton.textContent = '公式情報を確認中…';
      officialResults.innerHTML = '<div class="muted">公式情報を取得しています。</div>';
      try {
        const url = '/api/official-product-search?category=' + encodeURIComponent(categoryOf(p)) + '&q=' + encodeURIComponent(query);
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || '取得に失敗しました');
        if (Array.isArray(data.candidates) && data.candidates.length) {
          officialResults.innerHTML = '<div class="notice"><b>公式情報の候補（自動一致確定ではありません）</b><br>' + esc(data.message || '') + '</div>' +
            data.candidates.map(row => {
              const originalTokens = originalModelTokens(query);
              const candidateText = String(row.title || '').normalize('NFKC').toLowerCase().replace(/[\s　・･\-‐‑–—_【】「」『』()（）［］]/g, '');
              const missingTokens = originalTokens.filter(token => !candidateText.includes(token.compact));
              const modelCheck = originalTokens.length
                ? (missingTokens.length
                  ? '<div class="notice" style="margin-top:6px"><b>型番照合：未確認</b><br>元の検索語にある表記「' + esc(missingTokens.map(token => token.raw).join('、')) + '」が候補名に見つかりません。画像・公式ページで確認してください。</div>'
                  : '<div class="muted">型番照合：元の検索語に含まれる数字付き表記と一致（最終確認は必要）</div>')
                : '<div class="muted">型番照合：対象となる数字付き表記なし</div>';
              return '<div class="card" style="margin-top:8px;padding:10px">' +
                (row.image ? '<img src="' + esc(row.image) + '" alt="公式候補の商品画像" style="max-width:140px;max-height:140px;object-fit:contain">' : '<div class="muted">公式候補の画像なし</div>') +
                '<div><b>' + esc(row.title || '') + '</b></div>' +
                '<div class="muted">情報源：' + esc(row.sourceName || '公式情報') + '</div>' +
                (row.date ? '<div class="muted">掲載日：' + esc(row.date) + '</div>' : '') +
                modelCheck +
                '<div class="muted">候補スコア：' + esc(row.score) + '（名称一致の参考値。商品同一性の保証ではありません）</div>' +
                '<a href="' + esc(row.url || '#') + '" target="_blank" rel="noopener noreferrer">公式情報を開いて照合</a> ' +
                '<button type="button" class="secondary sc-use-official-name" data-name="' + esc(row.title || '') + '" data-url="' + esc(row.url || '') + '" data-image="' + esc(row.image || '') + '" data-source="' + esc(row.sourceName || '公式情報') + '">この候補を採用して検索</button></div>';
            }).join('');
          officialResults.querySelectorAll('.sc-use-official-name').forEach(button => button.onclick = () => {
            if (searchNameInput) {
              const candidateName = button.dataset.name || '';
              const candidateUrl = button.dataset.url || '';
              const candidateImage = button.dataset.image || '';
              const candidateSource = button.dataset.source || '公式情報';
              const accepted = confirm(
                'この候補名を国内検索に使用しますか？\\n\\n候補名：' + candidateName +
                '\\n\\n公式ページを開き、型番・画像・商品仕様がeBayの商品と一致することを確認してから選択してください。'
              );
              if (!accepted) return;
              selectedOfficialCandidate = {
                title: candidateName, url: candidateUrl, image: candidateImage,
                sourceName: candidateSource, selectedAt: new Date().toISOString(),
                verification: 'user_review_required'
              };
              writeOfficialCandidate(p, selectedOfficialCandidate);
              drawSelectedOfficialCandidate();
              searchNameInput.value = candidateName;
              saveDomesticSearchName(p, candidateName);
              drawSearchLinks();
              officialResults.insertAdjacentHTML('afterbegin',
                '<div class="notice">検索語に採用した候補：' + esc(candidateName) +
                (candidateUrl ? '<br><a href="' + esc(candidateUrl) + '" target="_blank" rel="noopener noreferrer">採用した公式ページを再確認</a>' : '') +
                '<br>採用操作は商品同一性の自動証明ではありません。</div>'
              );
            }
          });
        } else {
          officialResults.innerHTML = '<div class="notice">' + esc(data.message || '候補がありませんでした。') + '</div>' +
            (Array.isArray(data.sources) ? data.sources.map(source => '<div><a href="' + esc(source.url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.name) + 'で手動確認</a></div>').join('') : '');
        }
      } catch (error) {
        officialResults.innerHTML = '<div class="notice">公式情報を取得できませんでした。商品が存在しないという意味ではありません。' + esc(error.message || '') + '</div>';
      } finally {
        officialSearchButton.disabled = false;
        officialSearchButton.textContent = '公式情報を検索';
      }
    };
  }

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
          ${ranked.map(x=>`<tr><td>${esc(sourceLabel(x.r.source))}</td><td>${esc(x.r.condition)}</td><td>${yen(x.total)}</td><td class="${x.profit==null?'yellow':x.profit>=0?'green':'red'}">${x.profit==null?'計算不可':(x.profit>=0?'+':'')+yen(x.profit)}</td><td>${window.__exportApp?.getSelectedSourcing?.(p.id)?.candidateIndex===x.i?'✓':''}</td></tr>`).join('')}
        </table>
      </div>
    `;
    list.innerHTML += ranked.map(({r,i,total,profit}) => {
      const conditionScore = {'新品':5,'未使用':5,'美品':4,'中古':3,'傷あり':2,'ジャンク':1,'状態不明':0}[r.condition] ?? 0;
      const selectedInfo = window.__exportApp?.getSelectedSourcing?.(p.id);
      const selected = selectedInfo?.candidateIndex===i;
      const comparisonNote = conditionScore >= 4 ? '状態面の確認度が高い候補' : conditionScore >= 2 ? '状態を確認してから採用' : '状態リスクが高いため要確認';
      const appliedOfficial = selected && selectedInfo?.officialCandidate ? selectedInfo.officialCandidate : null;
      return `
        <div class="card" style="margin:8px 0;padding:12px">
          <div class="row"><b>${esc(sourceLabel(r.source))}</b><span>${esc(r.checkedAtLabel)}</span></div>
          <div class="row"><span>状態</span><b>${esc(r.condition)}</b></div>
          <div class="row"><span>商品価格</span><b>${yen(r.priceJpy)}</b></div>
          <div class="row"><span>国内送料</span><b>${yen(r.shippingJpy)}</b></div>
          ${r.officialCandidate?'<div class="notice" style="margin:8px 0"><b>関連付けた公式候補</b><br>'+(r.officialCandidate.image?'<img src="'+esc(r.officialCandidate.image)+'" alt="関連する公式候補画像" style="max-width:72px;max-height:72px;object-fit:contain;vertical-align:middle">':'')+esc(r.officialCandidate.title||'')+(r.officialCandidate.url?'<br><a href="'+esc(r.officialCandidate.url)+'" target="_blank" rel="noopener noreferrer">公式ページを照合</a>':'')+'<br><span class="muted">候補との関連付けであり、同一商品と確定したものではありません。</span></div>':''}
          ${r.domesticSearchName?'<div class="muted">保存時の国内検索語：'+esc(r.domesticSearchName)+'</div>':''}
          <div class="row"><span>実質仕入額</span><b>${yen(total)}</b></div>
          <div class="row"><span>想定利益</span><b class="${profit==null?'yellow':profit>=0?'green':'red'}">${profit==null?'計算不可':(profit>=0?'+':'')+yen(profit)}</b></div>
          ${r.note?`<div class="muted">メモ：${esc(r.note)}</div>`:''}
          ${r.url?`<div style="margin-top:7px"><a href="${esc(r.url)}" target="_blank" rel="noopener">保存した出品を開く →</a></div>`:''}
          ${window.__exportApp?.getSelectedSourcing?.(p.id)?.candidateIndex===i?'<div class="notice" style="margin-top:8px"><b>✓ 現在の分析に採用中</b></div>':''}
          ${appliedOfficial?'<div class="notice" style="margin-top:8px"><b>分析に反映した公式候補</b><br>'+(appliedOfficial.image?'<img src="'+esc(appliedOfficial.image)+'" alt="分析に反映した公式候補画像" style="max-width:64px;max-height:64px;object-fit:contain;vertical-align:middle">':'')+esc(appliedOfficial.title||'')+(appliedOfficial.url?'<br><a href="'+esc(appliedOfficial.url)+'" target="_blank" rel="noopener noreferrer">公式ページを確認</a>':'')+'<br><span class="muted">公式候補との関連付けです。商品が同一であることは別途確認してください。</span></div>':''}
          <button class="primary sc-apply" type="button" data-index="${i}">この仕入れ価格を分析に反映</button>
          <div class="muted" style="margin:8px 0">比較メモ：${comparisonNote}</div>
          <button class="secondary sc-delete" type="button" data-index="${i}">この保存情報を削除</button>
        </div>`;
    }).join('');

    list.querySelectorAll('.sc-apply').forEach(btn => btn.onclick = () => {
      const index = Number(btn.dataset.index);
      const row = readCandidates(p)[index];
      if (!row) return;
      const total = Number(row.priceJpy||0) + Number(row.shippingJpy||0);
      if (!Number.isFinite(total) || total < 0) return;
      const ok = window.__exportApp?.applySourcingCost?.(p.id,total,{source:sourceLabel(row.source),condition:row.condition,checkedAt:row.checkedAt,candidateIndex:index,itemPrice:Number(row.priceJpy||0),shippingJpy:Number(row.shippingJpy||0),officialCandidate:row.officialCandidate||selectedOfficialCandidate||null,domesticSearchName:row.domesticSearchName||String(searchNameInput?.value||'').trim()});
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
    if (!Number.isFinite(price) || price <= 0) {
      const m=document.getElementById('sc-message');m.style.display='block';m.textContent='商品価格を1円以上で入力してください。';return;
    }
    const row = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      source: document.getElementById('sc-source').value,
      condition: document.getElementById('sc-condition').value,
      priceJpy: price,
      shippingJpy: Number(document.getElementById('sc-shipping').value || 0),
      url: document.getElementById('sc-url').value.trim(),
      note: document.getElementById('sc-note').value.trim(),
      officialCandidate: selectedOfficialCandidate ? { ...selectedOfficialCandidate } : null,
      domesticSearchName: String(searchNameInput?.value || '').trim(),
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

const observer=new MutationObserver(records => {
  // Ignore changes made inside the sourcing panel itself. Otherwise render(p)
  // changes panel.innerHTML, retriggers this observer, and continually replaces
  // the inputs while the user is trying to type.
  const changedOutsidePanel = records.some(record => {
    const target = record.target;
    return !(target instanceof Element && target.closest('#source-panel'));
  });
  if (!changedOutsidePanel) return;
  const body=document.getElementById('body');
  if(body && body.textContent.trim()) setTimeout(inject,0);
});
observer.observe(document.getElementById('body') || document.body,{childList:true,subtree:true});

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject);
else inject();

})();