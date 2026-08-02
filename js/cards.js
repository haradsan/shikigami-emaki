// ============================================================
// cards.js — カードデータベースとデッキ構築
//
// v30「五行改元」: 属性を陰陽五行（木・火・土・金・水）に全面再構築。
// 相剋（そうこく＝攻め勝つ相性）と相生（そうしょう＝育て合う相性）の
// 二重の輪で、マナサーキットの4すくみとは別物の駆け引きを作る。
// カードは全てオリジナル創作（旧作からの翻訳・流用なし）。
// ============================================================
"use strict";

// 五行: 並び順は相生の輪（木→火→土→金→水→木）。
// アルバム・パネルの表示順もこの輪に一致させる。
// 色は5色を見分けやすく（金=金色 / 土=茶 / 木=緑）。
const ELEMENTS = {
  wood:  { name: "木", icon: "🌳", color: "#4e9a2f" },
  fire:  { name: "火", icon: "🔥", color: "#e05537" },
  earth: { name: "土", icon: "⛰️", color: "#8a6b3a" },
  metal: { name: "金", icon: "🪙", color: "#c9a227" },
  water: { name: "水", icon: "💧", color: "#3d7de0" },
  // 無属性（式神専用・土地には存在しない）: 五行の輪の外＝相剋・相生のどちらにも関わらない。
  // 土地の恵みも一切受けない代わりに、素のコスト効率がやや高くユニークな能力を持つ。
  neutral: { name: "無", icon: "⚪", color: "#9d97b5" },
};
// 土地として存在できる属性（盤面・五行転じ・デッキの属性枠は五行の5種）
const LAND_ELEMENTS = ["wood", "fire", "earth", "metal", "water"];

// 相剋（そうこく）: 木剋土・土剋水・水剋火・火剋金・金剋木（左が右を打ち破る）。バトル時 ST+10
// 木の根は土を割り、土は水を堰き止め、水は火を消し、火は金を熔かし、金の刃は木を断つ。
const ELEM_ADVANTAGE = { wood: "earth", earth: "water", water: "fire", fire: "metal", metal: "wood" };
const ELEM_ADV_ST = 10;
function hasElemAdvantage(attElem, defElem) { return ELEM_ADVANTAGE[attElem] === defElem; }

// 相生（そうしょう）: 木生火・火生土・土生金・金生水・水生木（左が右を生み育てる）。
// 「親属性」の土地に立つ式神は、土地に養われて防衛時 HP+10（相生の恵み）。
// 例: 火の式神は火の土地でレベル×10の加護、木の土地でも+10の恵みを受ける。
// ＝どの式神にも「本領の土地」と「育ての土地」の2種類の居場所がある。
const ELEM_SOUSEI = { wood: "fire", fire: "earth", earth: "metal", metal: "water", water: "wood" };
const SOUSEI_HP = 10;
// creatureElem にとって landElem が親属性（その属性を生む側）か
function isSouseiParent(landElem, creatureElem) { return ELEM_SOUSEI[landElem] === creatureElem; }
// この属性を生む親属性（恵みを受けられる土地の属性）を返す
function souseiParentOf(elem) { return LAND_ELEMENTS.find(e => ELEM_SOUSEI[e] === elem) || null; }

// 能力: first=居合 / pierce=破魔 / assault=強襲(侵略時ST+20)
//       guard=守護(防衛時HP+20) / lucky=豪運(会心率10%→25%)
//       capture=捕縛(防衛で撃退した侵略者を1ターン拘束) / immobile=不動(侵略・侵攻に出せない防御専用)
//       physnull=物理無効(物理攻撃が効かない) / physreflect=物理反射(物理攻撃を攻撃側へ跳ね返す)
//       magicatk=呪力攻撃(攻撃が呪力＝物理無効・反射を貫く。magicatk:true の宝具でも付与できる)
const ABILITY_INFO = {
  first:    { name: "居合", desc: "防衛時でも先に攻撃する" },
  pierce:   { name: "破魔", desc: "土地のHPボーナス（加護・相生の恵み）を無視する" },
  assault:  { name: "強襲", desc: "侵略時にST+20" },
  guard:    { name: "守護", desc: "防衛時にHP+20" },
  lucky:    { name: "豪運", desc: "会心の一撃(ダメージ1.5倍)が出やすい(25%)" },
  capture:  { name: "捕縛", desc: "防衛して撃退すると、侵略してきた相手を次の1ターン拘束する" },
  immobile: { name: "不動", desc: "侵略・侵攻には出せない防御専用（そのぶんHPが高い）" },
  spellproof: { name: "護法", desc: "敵の対象指定の呪術（落雷の符・大祓など）の対象にならない" },
  double:   { name: "連撃", desc: "バトルで続けて2回攻撃する（1撃目で相手が倒れなければもう1撃）" },
  // 物理/呪力の攻撃タイプ。「物理攻撃」＝呪力攻撃でない通常の攻撃すべて。
  physnull:    { name: "物理無効", desc: "物理攻撃（呪力攻撃以外）を無効化する＝ダメージ0。呪力攻撃は通る" },
  physreflect: { name: "物理反射", desc: "物理攻撃を無効化し、そのダメージをそっくり攻撃側へ跳ね返す。呪力攻撃は通る" },
  magicatk:    { name: "呪力攻撃", desc: "攻撃が呪力になる。物理無効・物理反射に妨げられず、通常どおりダメージを与える" },
  mimic:       { name: "模倣", desc: "バトル時、相手式神の基本ST・基本HP・能力をそっくり写し取って戦う（属性は無のまま・装備や土地の恵みはコピーしない）" },
  grow:     { name: "成長", desc: "自分のターン開始ごとに ST+5／最大HP+5（上限+25）。時間をかけるほど強くなる" },
  pack:     { name: "百鬼", desc: "盤面にいる自分の同属性式神1体につき ST+5（上限+30）。仲間が多いほど強い" },
  ranged:   { name: "遠隔", desc: "侵略・侵攻のバトルで相手の反撃を受けない（相手が居合でも）。撃ち逃げの一撃" },
  absorb:   { name: "吸収", desc: "与えたダメージの半分だけ自分のHPを回復する（そのバトル開始時のHPが上限）" },
  armor:    { name: "硬殻", desc: "受けるダメージを常に10軽減する（最低0）。手数の多い相手に強い" },
  lastward: { name: "背水", desc: "HPが半分以下のとき ST+25。追い詰められてからが本番" },
  mine:     { name: "採掘", desc: "盤面にいる間、自分のターン開始時に霊力を得る（+15G）" },
  merchant: { name: "商魂", desc: "駐留する土地の通行料が1.3倍になる" },
  rebirth:  { name: "転生", desc: "バトルで倒されても消滅せず手札に戻る（土地は失う）" },
  fly:      { name: "天翔", desc: "侵攻（march）で2マス先まで移動できる" },
  dispel:   { name: "看破", desc: "バトルで相手の宝具を打ち消す" },
  split:    { name: "分裂", desc: "侵攻（march）で移動先を占領すると、元の土地にも分裂体が残る（HPは折半・元の土地は自領のまま）" },
  // 建造物のオーラ（現行の弾には未収録・エンジン予約）
  beacon:   { name: "烽火", desc: "隣接する自領の防衛式神の ST+10（援護に加算）" },
  garden:   { name: "癒しの庭", desc: "隣接する自軍式神は自分のターン開始時に HP+10 回復する" },
  harbor:   { name: "港湾", desc: "自分がこのマスを通過・停止するたび +40G" },
  warfire:  { name: "戦意", desc: "自軍が侵略・侵攻のバトルに勝つたび +40G" },
  festival: { name: "祝祭", desc: "自分の周回ボーナスが1.5倍になる" },
  bulwark:    { name: "築城", desc: "防衛のバトルに勝つたび、守り抜いたその霊地のレベルが1上がる（最大Lv5・費用なし）。攻められるほど土地が育つ希少特性" },
  blight:     { name: "焦土", desc: "防衛時HP+30で守りは固いが、この土地でバトルが起きるたび、決着後に霊地レベルが1下がる（最低Lv1）" },
  siegebreak: { name: "破城", desc: "侵攻（march）で攻め込むとき、バトルの前に相手の霊地レベルを1下げる（最低Lv1）" },
  escaper:    { name: "遁走", desc: "バトルに敗れても消滅せず、盤面の空いている霊地へHP全快で逃げ延びてそこを自領にする（防衛でも侵攻でも／空き地が無ければ捨て札）" },
  cheer:      { name: "加勢", desc: "隣接する自領の式神がバトルするとき、武具を貸すように ST+15 / HP+15 を与える（2体まで重複・自分のバトルには乗らない）" },
  siphon:     { name: "霊力強奪", desc: "バトルで与えたダメージと同量の霊力を相手から奪う" },
  hybrid:     { name: "二形", desc: "式神として召喚できるほか、バトル時に武具として装備もできる（装備した場合は使い切り）" },
};

// レア度: カードの希少度。card.rarity で個別指定、無ければコストとタイプから推定。
// 文箱の排出重み（weight）と、カード/アルバムでの見た目（stars/color）に使う。
const RARITY_META = {
  common:    { label: "並",     stars: "★",     color: "#9aa0b5", weight: 8 },
  uncommon:  { label: "良", stars: "★★",    color: "#57c26a", weight: 4 },
  rare:      { label: "稀",       stars: "★★★",   color: "#4da3ff", weight: 2 },
  legendary: { label: "極", stars: "★★★★",  color: "#ffb14d", weight: 1 },
};
function cardRarity(card) {
  if (card.rarity) return card.rarity;
  const c = card.cost;
  if (c >= 135) return "legendary";
  if (c >= 110) return "rare";
  if (c >= 75)  return "uncommon";
  return "common";
}
const RARITY_WEIGHT = Object.fromEntries(Object.entries(RARITY_META).map(([k, v]) => [k, v.weight]));
const RARITY_ORDER = ["common", "uncommon", "rare", "legendary"];
// カードの弾（set）。壱の巻＝set未指定（=1）、弐の巻＝set:2。文箱・アルバムの仕切りに使う
function cardSet(card) { return card.set || 1; }
const CARD_SETS = [
  { set: 1, name: "壱の巻「五行の帖」", icon: "☯️" },
  { set: 2, name: "弐の巻「八百万の帖」", icon: "🏮" },
];
// レア度 → そのレア度のカードid一覧（文箱排出で「レア度を決めてから一様に1枚選ぶ」ために使う）。
// set指定（1/2）でその弾だけに絞る（null＝全弾。ウィークリー英雄の週などデッキ注入用）
let _cardsByRarity = null;
function cardsOfRarity(rarity, set = null) {
  if (!_cardsByRarity) {
    _cardsByRarity = { all: {}, 1: {}, 2: {} };
    ["all", 1, 2].forEach(k => RARITY_ORDER.forEach(r => { _cardsByRarity[k][r] = []; }));
    CARD_DB.forEach(c => {
      const r = cardRarity(c);
      _cardsByRarity.all[r].push(c.id);
      _cardsByRarity[cardSet(c)][r].push(c.id);
    });
  }
  const table = set === null ? _cardsByRarity.all : (_cardsByRarity[set] || _cardsByRarity.all);
  return table[rarity] || [];
}

// ============================================================
// カード表（全てオリジナル創作・v30）
//
// 五行それぞれの「性格」（マナサーキットの属性役割とは別設計）:
//   木 = 芽吹きと再生。育ち（成長）、蘇り（転生）、絡め取り（捕縛）。
//   火 = 勢いと燃え尽き。高STで攻める（強襲・居合・背水）が、打たれ弱い。
//   土 = 不動と実り。高HPの受け（守護・硬殻・不動）と、土地を育てる築城。
//   金 = 刃と富。鋭い一撃（破魔・居合）と、銭を生む採掘・商魂。五行で唯一の「稼ぐ属性」。
//   水 = 流転と搦め手。捕縛・遁走・吸収・呪力。正面から打ち合わず、流れで勝つ。
//   無 = 付喪神と霊獣。輪の外のトリックスター（模倣・連撃・物理無効…）。
// ============================================================
const CARD_DB = [
  // ==================== 壱の巻「五行の帖」 ====================
  // --- 木（芽吹きと再生） ---
  { id: "mebukiko",   name: "芽吹き童子",   type: "creature", element: "wood",  cost: 40,  st: 20, hp: 35, ab: ["grow"] },
  { id: "yamahiko",   name: "山彦",         type: "creature", element: "wood",  cost: 55,  st: 25, hp: 35, ab: ["rebirth"] },
  { id: "tsutaoni",   name: "蔦鬼",         type: "creature", element: "wood",  cost: 60,  st: 30, hp: 45, ab: ["capture"] },
  { id: "hanamori",   name: "花守の鹿",     type: "creature", element: "wood",  cost: 70,  st: 35, hp: 55, ab: [] },
  { id: "aotake",     name: "青竹の武者",   type: "creature", element: "wood",  cost: 75,  st: 45, hp: 40, ab: ["first"] },
  { id: "moriokami",  name: "杜の白狼",     type: "creature", element: "wood",  cost: 90,  st: 45, hp: 45, ab: ["rebirth"] },
  { id: "ofuji",      name: "大藤の姫",     type: "creature", element: "wood",  cost: 100, st: 40, hp: 65, ab: ["capture"] },
  { id: "sennensugi", name: "千年杉の翁",   type: "creature", element: "wood",  cost: 110, st: 25, hp: 105, ab: ["immobile", "capture"] },
  { id: "kukunochi",  name: "木祖ククノチ", type: "creature", element: "wood",  cost: 140, st: 65, hp: 70, ab: ["rebirth"], rarity: "legendary" },
  // --- 火（勢いと燃え尽き） ---
  { id: "hinoko",     name: "火の粉童子",   type: "creature", element: "fire",  cost: 40,  st: 25, hp: 25, ab: ["lucky"] },
  { id: "taimatsu",   name: "松明鼠",       type: "creature", element: "fire",  cost: 50,  st: 35, hp: 25, ab: ["assault"] },
  { id: "kagerocho",  name: "陽炎の蝶",     type: "creature", element: "fire",  cost: 60,  st: 35, hp: 30, ab: ["first"] },
  { id: "haikaburi",  name: "灰被り姫",     type: "creature", element: "fire",  cost: 65,  st: 35, hp: 35, ab: ["lastward"] },
  { id: "kagaribi",   name: "篝火の武者",   type: "creature", element: "fire",  cost: 80,  st: 45, hp: 40, ab: ["assault"] },
  { id: "hikuidori",  name: "火喰鳥",       type: "creature", element: "fire",  cost: 90,  st: 55, hp: 40, ab: ["first"] },
  { id: "higuma",     name: "緋熊",         type: "creature", element: "fire",  cost: 95,  st: 55, hp: 50, ab: [] },
  { id: "homuraguruma", name: "焔車の姫",   type: "creature", element: "fire",  cost: 120, st: 65, hp: 50, ab: ["assault", "lucky"], rarity: "rare" },
  { id: "yatagarasu", name: "八咫の火烏",   type: "creature", element: "fire",  cost: 145, st: 75, hp: 60, ab: ["first"], rarity: "legendary" },
  // --- 土（不動と実り） ---
  { id: "tsuchidango", name: "土団子の精",  type: "creature", element: "earth", cost: 40,  st: 15, hp: 45, ab: [] },
  { id: "haniwako",   name: "埴輪童子",     type: "creature", element: "earth", cost: 50,  st: 20, hp: 50, ab: ["guard"] },
  { id: "mogura",     name: "土竜の親分",   type: "creature", element: "earth", cost: 60,  st: 35, hp: 45, ab: [] },
  { id: "dorogame",   name: "泥亀法師",     type: "creature", element: "earth", cost: 70,  st: 20, hp: 60, ab: ["armor"] },
  { id: "tanadagami", name: "棚田の守り神", type: "creature", element: "earth", cost: 85,  st: 30, hp: 60, ab: ["bulwark"], rarity: "uncommon" },
  { id: "ishigaki",   name: "石垣入道",     type: "creature", element: "earth", cost: 90,  st: 15, hp: 100, ab: ["immobile"] },
  { id: "odoguu",     name: "大土偶",       type: "creature", element: "earth", cost: 105, st: 50, hp: 65, ab: ["guard"] },
  { id: "jichingame", name: "地鎮の大亀",   type: "creature", element: "earth", cost: 125, st: 45, hp: 90, ab: ["guard"], rarity: "rare" },
  { id: "ubusuna",    name: "産土の大神",   type: "creature", element: "earth", cost: 140, st: 60, hp: 85, ab: ["bulwark"], rarity: "legendary" },
  // --- 金（刃と富） ---
  { id: "zeniarai",   name: "銭洗い狐",     type: "creature", element: "metal", cost: 45,  st: 20, hp: 30, ab: ["mine"] },
  { id: "sabimaru",   name: "錆丸",         type: "creature", element: "metal", cost: 50,  st: 35, hp: 25, ab: ["pierce"] },
  { id: "haribusuma", name: "針衾",         type: "creature", element: "metal", cost: 60,  st: 30, hp: 40, ab: ["armor"] },
  { id: "togishi",    name: "研ぎ師の狐",   type: "creature", element: "metal", cost: 70,  st: 40, hp: 35, ab: ["first"] },
  { id: "kanekarasu", name: "金勘定の烏",   type: "creature", element: "metal", cost: 75,  st: 30, hp: 40, ab: ["merchant"] },
  { id: "kobyakko",   name: "白虎の子",     type: "creature", element: "metal", cost: 85,  st: 50, hp: 40, ab: ["first"], rarity: "uncommon" },
  { id: "tachidama",  name: "太刀魂",       type: "creature", element: "metal", cost: 100, st: 60, hp: 40, ab: ["pierce"] },
  { id: "komyaku",    name: "鉱脈の主",     type: "creature", element: "metal", cost: 110, st: 40, hp: 70, ab: ["mine"], rarity: "rare" },
  { id: "kanayago",   name: "金屋子神",     type: "creature", element: "metal", cost: 145, st: 70, hp: 60, ab: ["first", "pierce"], rarity: "legendary" },
  // --- 水（流転と搦め手） ---
  { id: "amadare",    name: "雨垂れ小僧",   type: "creature", element: "water", cost: 40,  st: 20, hp: 40, ab: [] },
  { id: "utakata",    name: "泡沫の精",     type: "creature", element: "water", cost: 55,  st: 20, hp: 35, ab: ["escaper"] },
  { id: "kawagiri",   name: "川霧の女",     type: "creature", element: "water", cost: 65,  st: 30, hp: 45, ab: ["capture"] },
  { id: "takinobori", name: "滝昇りの鯉",   type: "creature", element: "water", cost: 70,  st: 30, hp: 40, ab: ["grow"] },
  { id: "kaihime",    name: "貝姫",         type: "creature", element: "water", cost: 85,  st: 35, hp: 55, ab: ["absorb"] },
  { id: "yukijoro",   name: "雪女郎",       type: "creature", element: "water", cost: 95,  st: 50, hp: 45, ab: ["first"] },
  { id: "onamazu",    name: "深潭の大鯰",   type: "creature", element: "water", cost: 100, st: 45, hp: 60, ab: ["capture"] },
  { id: "ryugu",      name: "龍宮の使い",   type: "creature", element: "water", cost: 120, st: 55, hp: 60, ab: ["magicatk"], rarity: "rare" },
  { id: "kuraokami",  name: "闇龗クラオカミ", type: "creature", element: "water", cost: 145, st: 70, hp: 65, ab: ["magicatk"], rarity: "legendary" },
  // --- 無（付喪神と霊獣・壱の巻） ---
  { id: "suzuri",     name: "硯の精",       type: "creature", element: "neutral", cost: 65,  st: 30, hp: 40, ab: ["spellproof"], rarity: "rare" },
  { id: "karakasa",   name: "唐傘まわし",   type: "creature", element: "neutral", cost: 85,  st: 45, hp: 45, ab: ["double"], rarity: "rare" },
  { id: "baku",       name: "夢喰いの獏",   type: "creature", element: "neutral", cost: 95,  st: 45, hp: 50, ab: ["physnull"], rarity: "rare" },
  // --- 宝具（壱の巻） ---
  { id: "takemitsu",  name: "竹光",         type: "item", cost: 35,  st: 15, hp: 0,  desc: "バトル時 ST+15" },
  { id: "yamagatana", name: "山刀",         type: "item", cost: 55,  st: 30, hp: 0,  desc: "バトル時 ST+30" },
  { id: "wazamono",   name: "業物の太刀",   type: "item", cost: 90,  st: 50, hp: 0,  desc: "バトル時 ST+50" },
  { id: "ajirodate",  name: "網代盾",       type: "item", cost: 45,  st: 0,  hp: 25, desc: "バトル時 HP+25" },
  { id: "kikkodate",  name: "亀甲の大盾",   type: "item", cost: 85,  st: 0,  hp: 45, desc: "バトル時 HP+45" },
  { id: "kozuchi",    name: "打ち出の小槌", type: "item", cost: 60,  st: 10, hp: 10, grant: ["lucky"], desc: "ST+10/HP+10・会心率アップ" },
  { id: "hamayumi",   name: "破魔弓",       type: "item", cost: 80,  st: 30, hp: 0,  grant: ["pierce"], desc: "ST+30・破魔を得る（土地のHPボーナスを無視）" },
  { id: "hauchiwa",   name: "天狗の羽団扇", type: "item", cost: 75,  st: 20, hp: 0,  grant: ["first"], desc: "ST+20・居合を得る" },
  { id: "goshinkyo",  name: "御神鏡",       type: "item", cost: 90,  st: 0,  hp: 25, reflect: 0.5, rarity: "rare", desc: "バトル時 HP+25・受けた攻撃ダメージの50%を相手に反射する" },
  { id: "kiyome",     name: "清めの塩",     type: "item", cost: 50,  st: 0,  hp: 0,  nullify: true, rarity: "rare", desc: "バトル時、相手の宝具の効果を打ち消す（相手の宝具を無効化）" },
  // --- 呪術（壱の巻） ---
  { id: "shakyo",     name: "写経",         type: "spell", cost: 50,  spell: "draw",     icon: "📜", desc: "カードを2枚引く" },
  { id: "tsujiura",   name: "辻占",         type: "spell", cost: 60,  spell: "holyword", icon: "🎴", desc: "次の賽の目を自由に選ぶ" },
  { id: "rakurai",    name: "落雷の符",     type: "spell", cost: 90,  spell: "meteor",   icon: "⚡", desc: "敵式神1体に40ダメージ（現在HPが0以下になれば破壊し土地を解放／高HPの相手は削って弱らせる）" },
  { id: "oharae",     name: "大祓",         type: "spell", cost: 140, spell: "vanish",   icon: "🧹", desc: "敵式神1体を無条件で消滅させ土地を解放する（HP不問＝どんな相手でも確実に破壊／土地レベルは残る）" },
  { id: "fujin",      name: "風神の袋",     type: "spell", cost: 90,  spell: "gust", rarity: "rare", icon: "🌬️", desc: "敵式神1体を隣接する空き地へ強制的に押し出す（元の土地は空き地に戻る＝連鎖崩し・防衛どかしに／不動・護法は対象外）" },
  { id: "jiware",     name: "地割れの符",   type: "spell", cost: 90,  spell: "quake",    icon: "🌋", desc: "敵の土地1つのレベルを1下げる" },
  { id: "gokoku",     name: "五穀豊穣",     type: "spell", cost: 120, spell: "growth",   rarity: "rare", icon: "🌾", desc: "自分のLv3以下の土地1つをLv+1" },
  { id: "kigan",      name: "帰雁の笛",     type: "spell", cost: 100, spell: "recall",   icon: "🪶", desc: "本宮へ雲隠れ（総資産達成なら勝利！ 鳥居を規定数すべて通過済みなら周回ボーナスも得る）" },
  { id: "kemi",       name: "検見の帳",     type: "spell", cost: 50,  spell: "treasure", icon: "📔", desc: "所有する土地1つにつき+40G（土地が多いほど得）" },
  { id: "sukimakaze", name: "隙間風",       type: "spell", cost: 80,  spell: "steal",    icon: "🌀", desc: "相手の手札からランダムに1枚奪う" },
  { id: "gogyotenji", name: "五行転じ",     type: "spell", cost: 90,  spell: "eleshift", icon: "☯️", desc: "自分の土地1つの属性を変える（連鎖の組み替え・相生の恵み作りに）" },
  { id: "toji",       name: "湯治",         type: "spell", cost: 60,  spell: "regen",    icon: "♨️", desc: "負傷した自分の式神1体のHPを全回復する" },
  { id: "denaoshi",   name: "出直しの祓",   type: "spell", cost: 40,  spell: "renew",    icon: "🔄", desc: "手札をすべて捨て、新たに6枚引く（手札事故のリセットに）" },
  { id: "waraji",     name: "韋駄天の草鞋", type: "spell", cost: 50,  spell: "dicedouble", rarity: "uncommon", icon: "👣", desc: "次の賽の出目を2倍にする（最大12マス進む）" },
  { id: "kanashibari", name: "金縛りの呪",  type: "spell", cost: 100, spell: "freeze",   icon: "🪢", desc: "相手を縛り、次のターンを1回休みにする" },
  { id: "saisen",     name: "賽銭浚い",     type: "spell", cost: 70,  spell: "drain",    icon: "💸", desc: "相手から200Gを奪う" },
  { id: "shimenawa",  name: "注連縄張り",   type: "spell", cost: 140, spell: "sanctuary", fx: true, icon: "⛩️", desc: "【盤面】自分の土地1つに2Rの結界。侵略・式神侵攻・敵呪術の対象にならない" },

  // ==================== 弐の巻「八百万の帖」 ====================
  // テーマ: 八百万の神々と付喪神。稼ぎ・連携・搦め手が深まる。
  // --- 木 ---
  { id: "kokezo",     name: "苔小僧",       type: "creature", element: "wood",  set: 2, cost: 35,  st: 20, hp: 25, ab: ["pack"] },
  { id: "kuzute",     name: "葛の絡み手",   type: "creature", element: "wood",  set: 2, cost: 65,  st: 25, hp: 40, ab: ["cheer"] },
  { id: "hanasaka",   name: "花咲かの翁",   type: "creature", element: "wood",  set: 2, cost: 90,  st: 40, hp: 50, ab: ["grow"], rarity: "uncommon" },
  { id: "jukai",      name: "樹海の隠者",   type: "creature", element: "wood",  set: 2, cost: 105, st: 50, hp: 55, ab: ["absorb"], rarity: "rare" },
  // --- 火 ---
  { id: "hazeguri",   name: "爆ぜ栗坊",     type: "creature", element: "fire",  set: 2, cost: 45,  st: 40, hp: 15, ab: [] },
  { id: "hiya",       name: "火矢の足軽",   type: "creature", element: "fire",  set: 2, cost: 65,  st: 35, hp: 25, ab: ["ranged"], rarity: "uncommon" },
  { id: "jinkai",     name: "陣貝の吹き手", type: "creature", element: "fire",  set: 2, cost: 75,  st: 30, hp: 40, ab: ["cheer"] },
  { id: "shiranui",   name: "不知火",       type: "creature", element: "fire",  set: 2, cost: 110, st: 60, hp: 40, ab: ["magicatk"], rarity: "rare" },
  // --- 土 ---
  { id: "anamori",    name: "穴守の狸",     type: "creature", element: "earth", set: 2, cost: 70,  st: 25, hp: 45, ab: ["mine"] },
  { id: "okame",      name: "古甕の精",     type: "creature", element: "earth", set: 2, cost: 80,  st: 20, hp: 65, ab: ["armor"] },
  { id: "ishizue",    name: "礎石の巨兵",   type: "creature", element: "earth", set: 2, cost: 95,  st: 25, hp: 75, ab: ["bulwark"], rarity: "uncommon" },
  { id: "kanameishi", name: "要石",         type: "creature", element: "earth", set: 2, cost: 115, st: 20, hp: 110, ab: ["immobile", "armor"], rarity: "rare" },
  // --- 金 ---
  { id: "zenigame",   name: "銭亀",         type: "creature", element: "metal", set: 2, cost: 55,  st: 20, hp: 40, ab: ["merchant"] },
  { id: "tobikozuka", name: "飛び小柄",     type: "creature", element: "metal", set: 2, cost: 70,  st: 35, hp: 30, ab: ["ranged"], rarity: "uncommon" },
  { id: "senryobako", name: "千両箱の付喪神", type: "creature", element: "metal", set: 2, cost: 85,  st: 25, hp: 55, ab: ["mine"] },
  { id: "kajigami",   name: "鍛冶の隠り神", type: "creature", element: "metal", set: 2, cost: 120, st: 55, hp: 55, ab: ["siphon"], rarity: "rare" },
  // --- 水 ---
  { id: "amenbo",     name: "水黽の渡し守", type: "creature", element: "water", set: 2, cost: 50,  st: 25, hp: 30, ab: ["fly"] },
  { id: "shiomaneki", name: "潮招きの蟹",   type: "creature", element: "water", set: 2, cost: 75,  st: 30, hp: 45, ab: ["absorb"] },
  { id: "nigorinuma", name: "濁り沼の主",   type: "creature", element: "water", set: 2, cost: 90,  st: 35, hp: 60, ab: ["capture"] },
  { id: "umigiri",    name: "海霧の女房",   type: "creature", element: "water", set: 2, cost: 100, st: 45, hp: 50, ab: ["escaper"], rarity: "rare" },
  // --- 👑五帝（弐の巻・300Gの別格極札）: 五行の頂点に立つ聖獣。文箱・交換所・ボスのエースで出会う ---
  { id: "seiryu",     name: "青龍",         type: "creature", element: "wood",  set: 2, cost: 300, st: 85, hp: 85, ab: ["rebirth", "capture"], rarity: "legendary" },
  { id: "suzaku",     name: "朱雀",         type: "creature", element: "fire",  set: 2, cost: 300, st: 95, hp: 70, ab: ["first", "assault"], rarity: "legendary" },
  { id: "koryu",      name: "黄龍",         type: "creature", element: "earth", set: 2, cost: 300, st: 80, hp: 100, ab: ["guard", "bulwark"], rarity: "legendary" },
  { id: "byakko",     name: "白虎",         type: "creature", element: "metal", set: 2, cost: 300, st: 95, hp: 75, ab: ["first", "pierce"], rarity: "legendary" },
  { id: "genbu",      name: "玄武",         type: "creature", element: "water", set: 2, cost: 300, st: 75, hp: 110, ab: ["guard", "armor"], rarity: "legendary" },
  // --- 無（弐の巻） ---
  { id: "kudagitsune", name: "管狐",        type: "creature", element: "neutral", set: 2, cost: 80,  st: 40, hp: 40, ab: ["siphon"], rarity: "rare" },
  { id: "gyoretsu",   name: "付喪神の行列", type: "creature", element: "neutral", set: 2, cost: 110, st: 45, hp: 55, ab: ["double"], rarity: "rare" },
  { id: "shiramen",   name: "白面の写し身", type: "creature", element: "neutral", set: 2, cost: 100, st: 10, hp: 30, ab: ["mimic"], rarity: "legendary" },
  // --- 宝具（弐の巻） ---
  { id: "jindaiko",   name: "陣太鼓",       type: "item", set: 2, cost: 65,  st: 25, hp: 10, desc: "バトル時 ST+25 / HP+10" },
  { id: "kitsunemen", name: "幻惑の狐面",   type: "item", set: 2, cost: 70,  st: 0,  hp: 15, stDebuff: 15, rarity: "rare", desc: "バトル時 HP+15・相手のST-15（最低10）" },
  { id: "gakinawa",   name: "餓鬼縄",       type: "item", set: 2, cost: 85,  st: 25, hp: 0,  drainMagic: 2, rarity: "rare", desc: "バトル時 ST+25・与えたダメージ×2倍の霊力を相手から強奪する（攻撃が通らなければ強奪もなし）" },
  { id: "juzu",       name: "平静の数珠",   type: "item", set: 2, cost: 55,  st: 0,  hp: 15, noCrit: true, rarity: "rare", desc: "バトル時 HP+15・相手は会心の一撃を出せない" },
  // --- 呪術（弐の巻） ---
  { id: "senryo",     name: "千両万両",     type: "spell", set: 2, cost: 70,  spell: "goldrush", rarity: "uncommon", icon: "💰", desc: "自分の霊力の20%を利殖で上乗せする（貯めてから使うほど大きい・上限250G）" },
  { id: "nengu",      name: "年貢の取り立て", type: "spell", set: 2, cost: 80, spell: "taxcollect", rarity: "uncommon", icon: "🧾", desc: "敵の土地1つにつき30Gを、その持ち主から徴収する" },
  { id: "tonchi",     name: "頓知の閃き",   type: "spell", set: 2, cost: 60,  spell: "inspiration", icon: "💡", desc: "カードを3枚引き、1枚捨てる" },
  { id: "mukoku",     name: "夢告",         type: "spell", set: 2, cost: 55,  spell: "revelation", rarity: "uncommon", icon: "🌙", desc: "カードを1枚引き、さらに+50G" },
  { id: "kumogakure", name: "雲隠れ",       type: "spell", set: 2, cost: 90,  spell: "teleport", rarity: "rare", icon: "💫", desc: "自分のコマを盤面の好きなマス（本宮以外）へ飛ばす。そのあと通常どおり賽で移動する（飛んだだけではマスの効果・鳥居通過は発生しない）" },
  { id: "tobiishi",   name: "飛び石",       type: "spell", set: 2, cost: 45,  spell: "leap", rarity: "uncommon", icon: "🪨", desc: "自分の式神1体を2マス先の空き地へ跳躍させる（元の土地は空き地に戻りレベルは残る／不動は対象外）" },
  { id: "shichiire",  name: "質草流し",     type: "spell", set: 2, cost: 45,  spell: "alchemy", icon: "💱", desc: "手札から1枚を選んで捨て、150Gに変える（使わないカードを資金に）" },
  { id: "torimochi",  name: "鳥黐の罠",     type: "spell", set: 2, cost: 110, spell: "ensnare", fx: true, rarity: "rare", icon: "🪤", desc: "【盤面】土地1つに2Rの罠。相手が通過・停止するとその場で足止め（移動終了）される" },
  { id: "shinsen",    name: "神饌の儀",     type: "spell", set: 2, cost: 80,  spell: "r_harvest", ritual: true, rarity: "uncommon", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】+350G" },
  { id: "okuribi",    name: "送り火の儀",   type: "spell", set: 2, cost: 100, spell: "r_blaze", ritual: true, rarity: "rare", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】敵式神1体に70ダメージ（護法・結界は対象外）" },
  { id: "kuchiyose",  name: "口寄せの儀",   type: "spell", set: 2, cost: 110, spell: "r_revive", ritual: true, rarity: "rare", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】自分の捨て札の式神1体を、好きな空き地へコスト不要で召喚する" },
  { id: "kagura",     name: "神楽の儀",     type: "spell", set: 2, cost: 120, spell: "r_ages", ritual: true, rarity: "rare", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】自分の土地1つをLv+2する（Lv4まで）" },
];

const CARD_BY_ID = Object.fromEntries(CARD_DB.map(c => [c.id, c]));

// ---------- 二形（hybrid） ----------
// 「武具としても使える式神」を、バトルの宝具処理へ渡せる形に変換する。
// battle.js は装備品を { name, st, hp, grant?, magicatk?, ... } として読むだけなので、
// asItem の中身に名前とコストを添えた擬似宝具を作れば既存の処理がそのまま通る。
// 普通の宝具はそのまま返す（呼び出し側は常にこれを通してよい）。
function isEquippable(card) { return !!card && (card.type === "item" || !!card.asItem); }
function itemFormOf(card) {
  if (!card) return null;
  if (!card.asItem) return card;
  return { ...card.asItem, id: card.id, name: card.name, cost: card.cost, icon: card.icon, hybridForm: true };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// デッキ自動構築（30枚）: 主属性2つを厚めに + 呪術 + 宝具
// 五行は5種なので、主属性式神各6枚（2属性＝12）、副属性各2枚（残り3属性＝6）、
// 呪術6枚、宝具6枚＝合計30枚。biasElement を指定すると主属性の1つ目が固定される（ステージのCPU用）
// maxCost: このコストを超えるカードは入れない（弱い難易度のCPUほど低コスト＝弱いデッキになる）。
//   式神が枯れないよう、maxCost で候補が空になった場合はコスト昇順で最も安いものにフォールバックする。
function buildDeck(biasElement = null, maxCost = Infinity) {
  // 属性枠は五行の5種のみ（無属性式神はレア以上の特別枠＝自動デッキには入れず、構築デッキで使う）
  let elems = shuffle(LAND_ELEMENTS.slice());
  if (biasElement) elems = [biasElement, ...elems.filter(e => e !== biasElement)];
  const main = elems.slice(0, 2), sub = elems.slice(2); // main=2属性 / sub=残り3属性
  const deck = [];
  const pickType = (filter, n) => {
    const all = CARD_DB.filter(filter);
    if (all.length === 0) return;
    let pool = all.filter(c => c.cost <= maxCost);
    // maxCostで全滅したら、そのカテゴリの最安カードだけは使えるようにする（デッキが機能する保証）
    if (pool.length === 0) pool = [all.slice().sort((a, b) => a.cost - b.cost)[0]];
    for (let i = 0; i < n; i++) deck.push(pool[Math.floor(Math.random() * pool.length)].id);
  };
  // 建造物（ST0・反撃しない施設）と noCpu 呪術（AIの発動条件が無い）は
  // CPU/おまかせデッキには入れない（構築デッキでは使える）
  main.forEach(e => pickType(c => c.type === "creature" && !c.structure && c.element === e, 6));
  sub.forEach(e => pickType(c => c.type === "creature" && !c.structure && c.element === e, 2));
  pickType(c => c.type === "spell" && !c.noCpu, 6);
  pickType(c => c.type === "item", 6);
  return shuffle(deck);
}
