(function(root){
'use strict';
const clean=s=>String(s||'').normalize('NFKC')
 .replace(/(?:正式名称未確認|正式商品名未確認|型番候補あり|型番未確認|カード名未確認|カード番号未確認|用品種別未確認|商品名の一致未確認|対応機種未確認|対応機種との一致は未確認|対応表との照合が必要|原文確認が必要|単品候補|セット品|セット内容確認が必要|商品名未確認|タイトル未確認|機種未確認|メーカー未確認|グレード未確認|スケール未確認|種類未確認|商品種類未確認|対象分野未確認)/g,' ')
 .replace(/\b(?:NEW|USED|PRE-OWNED|TESTED|WORKING|JAPAN|JAPANESE|AUTHENTIC|RARE|COLLECTOR'S? EDITION|FREE SHIPPING|FAST SHIPPING|LOT OF \d+|BUNDLE)\b/gi,' ')
 .replace(/(?:美品|新品|中古|未使用|動作確認済み|送料無料|即決|コレクター向け|希少品|限定品)/g,' ')
 .replace(/[｜|・]+/g,'｜').replace(/^[｜\s]+|[｜\s]+$/g,'').replace(/\s+/g,' ').trim();
const noRarity=s=>clean(s).replace(/(?:^|｜)\s*(?:SAR|SR|AR|RR|UR|HR|CHR|CSR|ACE SPEC|ホロ|レア|プロモ|PROMO)\s*(?=｜|$)/gi,'').replace(/｜{2,}/g,'｜').replace(/^｜|｜$/g,'').trim();
function normalize(p,category,value){
 const raw=String(p?.name||p?.title||'').normalize('NFKC');
 const cat=category||p?.cat||p?.category||'';
 const shown=String(value||p?.displayName||p?.titleJa||'').normalize('NFKC');
 const parts=noRarity(shown).split('｜').map(x=>clean(x)).filter(Boolean);
 const fraction=(raw.match(/\b\d{1,3}\s*\/\s*\d{1,3}\b/)||shown.match(/\b\d{1,3}\s*\/\s*\d{1,3}\b/)||[])[0]?.replace(/\s/g,'')||(raw.match(/#\s*(\d{1,4})\b/)||[])[1]||'';
 if(cat==='ポケモンカード'){
  let name=parts[0]||'';
  if(!/[ぁ-んァ-ヶ一-龯]/u.test(name)) name='';
  const setMap=[[/SV2A|POKEMON(?:\s+CARD)?\s+151|JAPANESE\s+151|ポケモンカード151/i,'ポケモンカード151'],[/SV8A|TERASTAL FESTIVAL|テラスタルフェス/i,'テラスタルフェスex'],[/M2A|MEGA DREAM|MEGAドリーム/i,'MEGAドリームex'],[/WOTC|WIZARDS|BLACK STAR|ブラックスタープロモ/i,'ブラックスタープロモ'],[/POP SERIES 4/i,'POP Series 4'],[/CELEBRATIONS/i,'Celebrations'],[/TEAM\s*ROCKET|ロケット団/i,'ロケット団'],[/JUNGLE|ジャングル/i,'ジャングル'],[/FOSSIL|化石の秘密/i,'化石の秘密'],[/VSTAR UNIVERSE|S12A|VSTARユニバース/i,'VSTARユニバース']];
  const mapped=(setMap.find(([re])=>re.test(raw+' '+shown))||[])[1]||'';
  let set=mapped||parts.slice(1).find(x=>!(/\b\d{1,3}\s*\/\s*\d{1,3}\b/.test(x)||/^(?:SV\d|S\d|M\d)/i.test(x)||/^(?:SAR|SR|AR|RR|UR|HR|CHR|CSR|プロモ|ホロ)$/i.test(x)))||'';
  set=clean(set).replace(/\b(?:SV\d+[A-Z]?|S\d+[A-Z]?|M\d+[A-Z]?)\b/ig,'').trim();
  return [name,set,fraction].filter(Boolean).join('｜')||[set,fraction].filter(Boolean).join('｜')||'カード名確認中';
 }
 const brandRules=[[/\bCANON\b|キヤノン/i,'キヤノン'],[/\bNIKON\b|ニコン/i,'ニコン'],[/\bSONY\b|ソニー/i,'ソニー'],[/\bOLYMPUS\b|オリンパス/i,'オリンパス'],[/\bSAMSUNG\b|サムスン/i,'サムスン'],[/\bFUJIFILM\b|富士フイルム/i,'富士フイルム'],[/\bPANASONIC\b|パナソニック/i,'パナソニック'],[/\bSHIMANO\b|シマノ/i,'シマノ'],[/\bDAIWA\b|ダイワ/i,'ダイワ'],[/\bBANDAI(?: SPIRITS)?\b|バンダイ/i,'バンダイ'],[/\bNINTENDO\b|任天堂/i,'任天堂'],[/\bSEGA\b|セガ/i,'セガ']];
 const brand=(brandRules.find(([re])=>re.test(raw))||[])[1]||'';
 if(cat==='カメラ'){
  const model=(raw.match(/(?:POWERSHOT\s*[A-Z]?\d{1,3}[A-Z]?(?:\s*X)?|COOLPIX\s*[A-Z]?\d{2,4}|CYBER.?SHOT\s*[A-Z]?\d{2,4}|FINEPIX\s*[A-Z]?\d{2,4}|LUMIX\s*[A-Z0-9-]{3,}|DMC[- ]?[A-Z0-9-]{3,}|DSC[- ]?[A-Z0-9-]{3,}|VH[- ]?\d{2,4}|(?:μ|µ)[- ]?\d{3,4}|\b(?:S|L|P|A)\d{3,4}\b|\bH\d{3}\b|\bMV\d{3,4}\b|\bG\d{1,2}X?\b)/i)||[])[0]||parts.find(x=>/[A-Z]{1,}[\w-]*\d/.test(x))||'';
  return [brand,model.replace(/\s+/g,' ').trim()].filter(Boolean).join(' ')||parts.slice(0,2).join('｜');
 }
 if(cat==='釣具'){
  const model=(raw.match(/\b(?:STELLA|STRADIC|TWIN\s*POWER|VANQUISH|NASCI|ULTEGRA|SEDONA|EXIST|CERTATE|LUVIAS|CALDIA|FUEGO|LEGALIS|TATULA|SALTIGA|EMERALDAS|PRESSO|AERNOS)(?:\s*[A-Z0-9-]+)?/i)||[])[0]||parts.find(x=>/[A-Z]{1,}[\w-]*\d/.test(x))||'';
  const japaneseModel=model.replace(/\bFUEGO\b/ig,'フエゴ').replace(/\bPRESSO\b/ig,'プレッソ').replace(/\bSTELLA\b/ig,'ステラ').replace(/\bSTRADIC\b/ig,'ストラディック').replace(/\bTWIN\s*POWER\b/ig,'ツインパワー').replace(/\bVANQUISH\b/ig,'ヴァンキッシュ').replace(/\bNASCI\b/ig,'ナスキー').replace(/\bEXIST\b/ig,'イグジスト').replace(/\bCERTATE\b/ig,'セルテート').replace(/\bLUVIAS\b/ig,'ルビアス').replace(/\bCALDIA\b/ig,'カルディア').replace(/\bSALTIGA\b/ig,'ソルティガ');
  return [brand,japaneseModel.replace(/\s+/g,' ').trim()].filter(Boolean).join(' ')||parts.slice(0,2).join('｜');
 }
 if(cat==='ポケモン関連サプライ用品'){
  const kept=parts.filter(x=>!/(?:セット内容確認|単品候補|ポケモン用品|商品名未確認)/.test(x));
  return kept.slice(0,3).join('｜')||'ポケモン関連用品';
 }
 if(cat==='レトロゲーム'){
  const platforms=[[/PLAYSTATION\s*2|PS2/i,'PS2'],[/PLAYSTATION\s*1|PS1/i,'PS1'],[/DREAMCAST/i,'ドリームキャスト'],[/SATURN/i,'セガサターン'],[/SUPER\s*NINTENDO|SUPER\s*FAMICOM/i,'スーパーファミコン'],[/FAMICOM|NES/i,'ファミコン'],[/GAME\s*BOY\s*ADVANCE|GBA/i,'ゲームボーイアドバンス'],[/GAME\s*BOY/i,'ゲームボーイ'],[/NINTENDO\s*64|N64/i,'NINTENDO64']];
  const platform=(platforms.find(([re])=>re.test(raw))||[])[1]||'';
  const gameRules=[[/VIB[- ]?RIBBON|ビブリボン/i,'ビブリボン'],[/SUPER\s*MARIO\s*WORLD|スーパーマリオワールド/i,'スーパーマリオワールド'],[/ALADDIN|アラジン/i,'アラジン']];
  const game=(gameRules.find(([re])=>re.test(raw+' '+shown))||[])[1]||parts.find(x=>!/(?:PS[12]|ファミコン|ゲームボーイ|サターン|ドリームキャスト|ソフト|本体)/i.test(x)&&x.length>1)||'';
  return [platform,game].filter(Boolean).join('｜')||parts.slice(0,2).join('｜');
 }
 if(cat==='ガンプラ'){
  const grade=(raw.match(/\b(?:MGSD|HGUC|HG|MG|RG|PG|EG|RE\/100|SDCS|SD)\b/i)||[])[0]||'';
  const model=(raw.match(/\b(?:RX[- ]?\d{2,3}[A-Z0-9-]*|MS[- ]?\d{2,3}[A-Z0-9-]*|NRX[- ]?\d{4}[A-Z0-9-]*|GF\d{2}[- ]?\d{3}[A-Z]{2})\b/i)||[])[0]||'';
  const title=parts.find(x=>!/(?:バンダイ|ガンプラ|プラモデル|型番|正式名称)/.test(x)&&x!==grade&&!x.includes('/'))||'';
  return [grade,title,model].filter(Boolean).join('｜')||parts.slice(0,3).join('｜');
 }
 if(cat==='交換部品・消耗品'){
  const kindRules=[[/SPOOL|スプール/i,'スプール'],[/LINE\s*ROLLER|ラインローラー/i,'ラインローラー'],[/BAIL\s*ARM|ベールアーム/i,'ベールアーム'],[/DRAG\s*KNOB|ドラグノブ/i,'ドラグノブ'],[/BATTERY\s*DOOR|バッテリーカバー/i,'バッテリーカバー'],[/EYECUP|アイカップ/i,'アイカップ'],[/LENS\s*CAP|レンズキャップ/i,'レンズキャップ'],[/CHARGER|充電器/i,'充電器'],[/DECAL|STICKER|デカール|シール/i,'デカール']];
  const kind=(kindRules.find(([re])=>re.test(raw+' '+shown))||[])[1]||parts.find(x=>!/(?:対応機種未確認|型番未確認|メーカー未確認)/.test(x)&&x!==brand)||'';
  const model=(raw.match(/\b[A-Z]{1,5}[- ]?\d{2,6}[A-Z0-9-]*\b/i)||[])[0]||'';
  let compat=(raw.match(/\b(?:STELLA|STRADIC|NASCI|EXIST|CERTATE|COOLPIX|POWERSHOT|EOS|PS[12]|GAME\s*BOY)\s*[A-Z0-9-]*/i)||[])[0]||'';
  compat=compat.replace(/^STELLA/i,'ステラ').replace(/^STRADIC/i,'ストラディック').replace(/^NASCI/i,'ナスキー').replace(/^EXIST/i,'イグジスト').replace(/^CERTATE/i,'セルテート');
  return [brand,kind,compat,model].filter((x,i,a)=>x&&a.indexOf(x)===i).join('｜')||parts.slice(0,3).join('｜');
 }
 return parts.filter(x=>!/(?:正式名称未確認|原文確認|商品名未確認|未確認$)/.test(x)).slice(0,3).join('｜')||shown.slice(0,60);
}
const api={normalize};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(root)root.ProductNameNormalizer=api;
})(typeof window!=='undefined'?window:globalThis);
