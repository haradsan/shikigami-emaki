// ============================================================
// cards.js — カードデータベースとデッキ構築
// ============================================================
"use strict";

// 属性は4種。相性の輪（水＞火＞木＞地＞水 ＝ 火→木→地→水→火）に沿った並び順にしてある
// （アルバム・パネルの表示順や色の割り当てが相性の輪と一致して分かりやすい）。
// 色は4色を明確に見分けられるように設定（木=緑 / 地=茶で木と区別）。
const ELEMENTS = {
  fire:  { name: "火", icon: "🔥", color: "#e05537" },
  wood:  { name: "木", icon: "🌳", color: "#4e9a2f" },
  earth: { name: "地", icon: "⛰️", color: "#8a6b3a" },
  water: { name: "水", icon: "💧", color: "#3d7de0" },
  // 無属性（式神専用・土地には存在しない）: 相性の輪の外＝有利も不利も取らない。
  // 土地の加護（属性一致HPボーナス）も一切受けない代わりに、素のコスト効率がやや高くユニークな能力を持つ。
  neutral: { name: "無", icon: "⚪", color: "#9d97b5" },
};
// 土地として存在できる属性（盤面・霊脈替えの符・デッキの属性枠は無属性を除く4種）
const LAND_ELEMENTS = ["fire", "wood", "earth", "water"];

// 属性相性（4すくみ）: 火→木→地→水→火（左が右に強い）＝「水＞火＞木＞地＞水」。バトル時 ST+10
// 火は木を焼き、木は地を痩せさせ（根が土を割る）、地は水を堰き止め、水は火を消す。
const ELEM_ADVANTAGE = { fire: "wood", wood: "earth", earth: "water", water: "fire" };
const ELEM_ADV_ST = 10;
function hasElemAdvantage(attElem, defElem) { return ELEM_ADVANTAGE[attElem] === defElem; }

// 能力: first=居合 / pierce=破魔 / assault=強襲(侵略時ST+20)
//       guard=守護(防衛時HP+20) / lucky=豪運(会心率10%→25%)
//       capture=捕縛(防衛で撃退した侵略者を1ターン拘束) / immobile=不動(侵略・侵攻に出せない防御専用)
//       physnull=物理無効(物理攻撃が効かない) / physreflect=物理反射(物理攻撃を攻撃側へ跳ね返す)
//       magicatk=呪力攻撃(攻撃が呪力＝物理無効・反射を貫く。magicatk:true の宝具でも付与できる)
const ABILITY_INFO = {
  first:    { name: "居合", desc: "防衛時でも先に攻撃する" },
  pierce:   { name: "破魔", desc: "土地のHPボーナスを無視する" },
  assault:  { name: "強襲", desc: "侵略時にST+20" },
  guard:    { name: "守護", desc: "防衛時にHP+20" },
  lucky:    { name: "豪運", desc: "会心の一撃(ダメージ1.5倍)が出やすい(25%)" },
  capture:  { name: "捕縛", desc: "防衛して撃退すると、侵略してきた相手を次の1ターン拘束する" },
  immobile: { name: "不動", desc: "侵略・侵攻には出せない防御専用（そのぶんHPが高い）" },
  spellproof: { name: "護法", desc: "敵の対象指定の呪術（天火の符・大祓の符・神風の符）の対象にならない" },
  double:   { name: "連撃", desc: "バトルで続けて2回攻撃する（1撃目で相手が倒れなければもう1撃）" },
  // v15: 物理/呪力の攻撃タイプを導入。「物理攻撃」＝呪力攻撃でない通常の攻撃すべて。
  physnull:    { name: "物理無効", desc: "物理攻撃（呪力攻撃以外）を無効化する＝ダメージ0。呪力攻撃は通る" },
  physreflect: { name: "物理反射", desc: "物理攻撃を無効化し、そのダメージをそっくり攻撃側へ跳ね返す。呪力攻撃は通る" },
  magicatk:    { name: "呪力攻撃", desc: "攻撃が呪力になる。物理無効・物理反射に妨げられず、通常どおりダメージを与える" },
  // v17: 模倣＝バトル時に相手カードの基本値をそっくりコピーする（化け狸）
  mimic:       { name: "模倣", desc: "バトル時、相手式神の基本ST・基本HP・能力をそっくり写し取って戦う（属性は無のまま・装備や土地の加護はコピーしない）" },
  // ---------- 第二巻「時流の帖」の新能力（v19） ----------
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
  dispel:   { name: "看破", desc: "バトルで相手の宝具を打ち消す（解呪の御札を内蔵）" },
  // v24: 分裂＝侵攻で領地を増やすたび、自分も増える希少特性（分霊専用）
  split:    { name: "分裂", desc: "侵攻（march）で移動先を占領すると、元の土地にも分裂体が残る（HPは折半・元の土地は自領のまま）。🐺百鬼・🧪増殖の秘薬と好相性" },
  // 建造物のオーラ（個別効果）。建造物はST0・不動・バトルで反撃しない据え付けの施設
  beacon:   { name: "烽火", desc: "隣接する自領の防衛式神の ST+10（援護に加算）" },
  garden:   { name: "癒しの庭", desc: "隣接する自軍式神は自分のターン開始時に HP+10 回復する" },
  harbor:   { name: "港湾", desc: "自分がこのマスを通過・停止するたび +40G" },
  warfire:  { name: "戦意", desc: "自軍が侵略・侵攻のバトルに勝つたび +40G" },
  festival: { name: "祝祭", desc: "自分の周回ボーナスが1.5倍になる" },
  // ---------- v25: 領地に働きかける特性・加勢・二形（原さん要望） ----------
  bulwark:    { name: "築城", desc: "防衛のバトルに勝つたび、守り抜いたその領地のレベルが1上がる（最大Lv5・費用なし）。攻められるほど土地が育つ希少特性" },
  blight:     { name: "焦土", desc: "防衛時HP+30で守りは固いが、この土地でバトルが起きるたび、決着後に領地レベルが1下がる（最低Lv1）" },
  siegebreak: { name: "破城", desc: "侵攻（march）で攻め込むとき、バトルの前に相手の領地レベルを1下げる（最低Lv1）。土地の加護ごと城壁を砕く" },
  escaper:    { name: "遁走", desc: "バトルに敗れても消滅せず、盤面の空いている領地へHP全快で逃げ延びてそこを自領にする（防衛でも侵攻でも／空き地が無ければ捨て札）" },
  cheer:      { name: "加勢", desc: "隣接する自領の式神がバトルするとき、武具を貸すように ST+15 / HP+15 を与える（2体まで重複・自分のバトルには乗らない）" },
  siphon:     { name: "霊力強奪", desc: "バトルで与えたダメージと同量の霊力を相手から奪う（💰吸奪の武器と重ねられる）" },
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
// カードの弾（set）。第一巻＝set未指定（=1）、第二巻＝set:2（v19）。文箱・アルバムの仕切りに使う
function cardSet(card) { return card.set || 1; }
const CARD_SETS = [
  { set: 1, name: "第一巻", icon: "✦" },
  { set: 2, name: "第二巻「時流の帖」", icon: "⏳" },
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

const CARD_DB = [
  // --- 火（攻撃寄り） ---
  { id: "imp",         name: "小鬼",           type: "creature", element: "fire",  cost: 40,  st: 20, hp: 30, ab: ["lucky"] }, // 旧: インプ
  { id: "firelizard",  name: "火蜥蜴", type: "creature", element: "fire",  cost: 50,  st: 30, hp: 30, ab: [] }, // 旧: ファイアリザード
  { id: "bombeetle",   name: "爆ぜ玉虫",     type: "creature", element: "fire",  cost: 45,  st: 40, hp: 20, ab: [] }, // v13: 55→45（同コストの茨犬に完全に劣っていたため値下げ） // 旧: ボムビートル
  { id: "flamewolf",   name: "焔狼",   type: "creature", element: "fire",  cost: 60,  st: 40, hp: 30, ab: ["assault"] }, // 旧: フレイムウルフ
  { id: "hellhound",   name: "火車",     type: "creature", element: "fire",  cost: 70,  st: 40, hp: 40, ab: ["pierce"] }, // 旧: ヘルハウンド
  { id: "salamander",  name: "猩々",     type: "creature", element: "fire",  cost: 80,  st: 50, hp: 40, ab: [] }, // 旧: サラマンダー
  { id: "flamedancer", name: "火舞の巫女", type: "creature", element: "fire",  cost: 80,  st: 45, hp: 40, ab: ["first"] }, // v23: 85G 40/40→80G 45/40（同帯の居合持ちに見劣りしていた） // 旧: フレイムダンサー
  { id: "lavagolem",   name: "灼岩の巨人", type: "creature", element: "fire",  cost: 100, st: 50, hp: 60, ab: [] }, // 旧: ラーヴァゴーレム
  { id: "minotaur",    name: "牛鬼",     type: "creature", element: "fire",  cost: 105, st: 60, hp: 40, ab: ["assault"] }, // 旧: ミノタウロス
  { id: "phoenix",     name: "不死鳥",     type: "creature", element: "fire",  cost: 120, st: 60, hp: 50, ab: ["first"] }, // 旧: フェニックス
  { id: "efreet",      name: "火雷神",       type: "creature", element: "fire",  cost: 130, st: 75, hp: 50, ab: ["pierce"] }, // v23: 70/40→75/50（130Gの働きに引き上げ） // 旧: イフリート
  { id: "reddragon",   name: "酒呑童子",   type: "creature", element: "fire",  cost: 140, st: 70, hp: 60, ab: ["lucky"] }, // 旧: レッドドラゴン
  // --- 水（バランス・守り） ---
  { id: "aquasprite",  name: "雫の精", type: "creature", element: "water", cost: 40,  st: 20, hp: 40, ab: [] }, // 旧: アクアスピリット
  { id: "merman",      name: "人魚",         type: "creature", element: "water", cost: 50,  st: 30, hp: 40, ab: [] }, // 旧: マーマン
  { id: "frostnaga",   name: "氷柱女",   type: "creature", element: "water", cost: 60,  st: 40, hp: 30, ab: ["first"] }, // 旧: フロストナーガ
  { id: "shellcrab",   name: "蟹坊主",     type: "creature", element: "water", cost: 65,  st: 20, hp: 55, ab: ["armor"] }, // v23: guard→硬殻（濡女との重複解消。「硬い殻」の名前どおりに） // 旧: シェルクラブ
  { id: "undine",      name: "濡女",     type: "creature", element: "water", cost: 65,  st: 30, hp: 50, ab: ["guard"] }, // v13: 70→65（同コスト帯の桜の精に見劣りしていたため値下げ） // 旧: ウンディーネ
  { id: "mermaid",     name: "人魚武者", type: "creature", element: "water", cost: 80,  st: 35, hp: 65, ab: [] }, // v25: ST30→35（第二巻の80-85G帯＝埴輪武者40/55・提灯鮟鱇45/45に押されていた「武者」を並みの打点に） // 旧: マーメイドナイト
  { id: "seaserpent",  name: "大海蛇",   type: "creature", element: "water", cost: 90,  st: 50, hp: 60, ab: [] }, // v13: HP50→60（同コストの野槌(破魔付き)に完全に劣っていたため） // 旧: シーサーペント
  { id: "sirene",      name: "磯女",       type: "creature", element: "water", cost: 95,  st: 45, hp: 60, ab: ["capture"] }, // v23: first→捕縛／v25: 40/50→45/60（80Gの提灯鮟鱇(45/45 捕縛)に15G高いまま劣っていた） // 旧: セイレーン
  { id: "frostgiant",  name: "雪入道", type: "creature", element: "water", cost: 110, st: 55, hp: 65, ab: [] }, // v13: 50/60→55/65（同コストの大天狗(捕縛付き)に完全に劣っていたため） // 旧: フロストジャイアント
  { id: "kraken",      name: "大蛸入道",       type: "creature", element: "water", cost: 120, st: 60, hp: 60, ab: ["capture"] }, // v13: 捕縛を付与（同コストの青龍(破魔)に完全に劣っていた。触腕で搦め捕るイメージ） // 旧: クラーケン
  { id: "tidallord",   name: "潮の大主",   type: "creature", element: "water", cost: 135, st: 65, hp: 75, ab: ["first"] }, // 旧: タイダルロード
  { id: "leviathan",   name: "龍神",   type: "creature", element: "water", cost: 140, st: 70, hp: 60, ab: ["pierce"] }, // 旧: リヴァイアサン
  { id: "abyssturtle", name: "玄武",   type: "creature", element: "water", cost: 100, st: 10, hp: 90, ab: ["immobile", "guard"] }, // 旧: アビスタートル
  { id: "netjelly",    name: "絡み海月",   type: "creature", element: "water", cost: 65,  st: 20, hp: 55, ab: ["capture"] }, // 旧: ネットジェリー
  // --- 地（HP・防衛） ---
  { id: "mudman",      name: "泥田坊",       type: "creature", element: "earth", cost: 40,  st: 20, hp: 40, ab: [] }, // 旧: マッドマン
  { id: "dwarfguard",  name: "埴輪兵",   type: "creature", element: "earth", cost: 50,  st: 20, hp: 50, ab: ["guard"] }, // 旧: ドワーフガード
  { id: "stonewall",   name: "塗壁", type: "creature", element: "earth", cost: 60,  st: 10, hp: 80, ab: [] }, // 旧: ストーンウォール
  { id: "needlemole",  name: "針土竜",   type: "creature", element: "earth", cost: 65,  st: 40, hp: 40, ab: [] }, // 旧: ニードルモール
  { id: "rockgolem",   name: "大土偶",   type: "creature", element: "earth", cost: 80,  st: 30, hp: 70, ab: [] }, // 旧: ロックゴーレム
  { id: "basilisk",    name: "野槌",       type: "creature", element: "earth", cost: 90,  st: 50, hp: 50, ab: ["pierce"] }, // 旧: バジリスク
  { id: "ogre",        name: "赤鬼",           type: "creature", element: "earth", cost: 95,  st: 60, hp: 40, ab: ["assault"] }, // 旧: オーガ
  { id: "ironturtle",  name: "鉄亀", type: "creature", element: "earth", cost: 105, st: 30, hp: 90, ab: ["guard"] }, // 旧: アイアンタートル
  { id: "earthdragon", name: "岩龍",   type: "creature", element: "earth", cost: 120, st: 55, hp: 75, ab: [] }, // v25: 50/70→55/75（115Gの黒曜の武者(55/60 硬殻)に支配されていた） // 旧: アースドラゴン
  { id: "behemoth",    name: "大百足",       type: "creature", element: "earth", cost: 135, st: 75, hp: 60, ab: ["assault"] }, // v23: 70/50→75/60（135Gの最重量級らしい風格に） // 旧: ベヒーモス
  { id: "gaiatitan",   name: "国引き巨人",   type: "creature", element: "earth", cost: 140, st: 65, hp: 85, ab: ["guard"] }, // 旧: ガイアタイタン
  { id: "greatwall",   name: "大塗壁", type: "creature", element: "earth", cost: 90,  st: 10, hp: 100, ab: ["immobile"] }, // 旧: グレートウォール
  { id: "maneater",    name: "土蜘蛛",     type: "creature", element: "earth", cost: 80,  st: 40, hp: 55, ab: ["capture"] }, // v23: 75→80G（捕縛+良スタッツで強すぎた） // 旧: マンイーター
  // --- v4追加式神（各属性に追加） ---
  { id: "hellcat",     name: "化け猫",     type: "creature", element: "fire",  cost: 45,  st: 30, hp: 20, ab: ["first"] }, // 旧: ヘルキャット
  { id: "cerberus",    name: "犬神",       type: "creature", element: "fire",  cost: 110, st: 60, hp: 50, ab: ["assault"] }, // 旧: ケルベロス
  { id: "magmagolem",  name: "溶岩入道",   type: "creature", element: "fire",  cost: 95,  st: 45, hp: 60, ab: [] }, // v25: ST40→45（105Gの火口の主(45/65)に10G安いだけで全面的に劣っていた） // 旧: マグマゴーレム
  { id: "vulcandrake", name: "ヒノカグヅチ", type: "creature", element: "fire", cost: 150, st: 80, hp: 60, ab: ["pierce"] }, // v25: HP55→60（同150Gの紅蓮龍(75/60 遠隔+破魔)に完全に劣っていた） // 旧: ヴォルカンドレイク
  { id: "icesprite",   name: "雪ん子", type: "creature", element: "water", cost: 45,  st: 20, hp: 40, ab: [] }, // 旧: アイススプライト
  { id: "kappa",       name: "河童",           type: "creature", element: "water", cost: 60,  st: 30, hp: 45, ab: ["guard"] }, // 旧: カッパ
  { id: "seawitch",    name: "磯姫",     type: "creature", element: "water", cost: 90,  st: 50, hp: 45, ab: ["first"] }, // 旧: シーウィッチ
  { id: "waterdragon", name: "水龍", type: "creature", element: "water", cost: 125, st: 60, hp: 70, ab: [] }, // v25: HP65→70（120Gの海坊主(60/60 吸収)に見劣りしていた素の龍枠を厚く） // 旧: ウォータードラゴン
  { id: "gnome",       name: "案山子",           type: "creature", element: "earth", cost: 45,  st: 20, hp: 45, ab: [] }, // 旧: ノーム
  { id: "goblinaxe",   name: "鉞小僧", type: "creature", element: "earth", cost: 60,  st: 40, hp: 35, ab: ["assault"] }, // 旧: ゴブリンアックス
  { id: "clayhulk",    name: "大土人形",     type: "creature", element: "earth", cost: 100, st: 40, hp: 75, ab: ["guard"] }, // 旧: クレイハルク
  // --- 木（生命と搦め手：capture／firstが主軸の中量級。地の「純HP壁・守護」とは役割を変えてある）---
  //     地＝重装の高HP壁で受ける。木＝居合と絡め手（捕縛）で手数を取り、相手を拘束して立ち回る。
  //     樹木子／大楠の主は樹木モチーフのため木属性（旧地属性からの名実一致移籍。数値・能力は不変）。
  { id: "treant",      name: "樹木子",         type: "creature", element: "wood",  cost: 70,  st: 30, hp: 65, ab: [] }, // v13: HP60→65（守護付き桜の精と差別化＝素のHPで上回る壁に） // 旧: トレント
  { id: "titanoak",    name: "大楠の主",   type: "creature", element: "wood",  cost: 130, st: 60, hp: 80, ab: [] }, // v25: HP70→80（115Gの大杉入道(55/70)に15G高くて+5STしか勝てていなかった） // 旧: タイタンオーク
  { id: "kodama",      name: "木霊",           type: "creature", element: "wood",  cost: 45,  st: 20, hp: 35, ab: ["lucky"] }, // 旧: コダマ
  { id: "sprout",      name: "若芽の精",       type: "creature", element: "wood",  cost: 40,  st: 20, hp: 40, ab: [] }, // 旧: スプラウト
  { id: "thornvine",   name: "絡み茨",   type: "creature", element: "wood",  cost: 55,  st: 30, hp: 40, ab: ["capture"] }, // 旧: ソーンヴァイン
  { id: "pixie",       name: "木の葉天狗",         type: "creature", element: "wood",  cost: 60,  st: 30, hp: 40, ab: ["first"] }, // 旧: ピクシー
  { id: "bramblehound",name: "茨犬", type: "creature", element: "wood", cost: 55, st: 40, hp: 30, ab: ["assault"] }, // 旧: ブランブルハウンド
  { id: "mandrake",    name: "葛の精",     type: "creature", element: "wood",  cost: 65,  st: 40, hp: 40, ab: ["capture"] }, // 旧: マンドレイク
  { id: "dryad",       name: "桜の精",       type: "creature", element: "wood",  cost: 70,  st: 30, hp: 55, ab: ["guard"] }, // 旧: ドリアード
  { id: "woodwolf",    name: "鎌鼬",     type: "creature", element: "wood",  cost: 75,  st: 50, hp: 40, ab: ["first"] }, // 旧: ウッドウルフ
  { id: "mossgiant",   name: "苔入道", type: "creature", element: "wood",  cost: 90,  st: 40, hp: 65, ab: ["capture"] }, // 旧: モスジャイアント
  { id: "worldtree",   name: "御神木",   type: "creature", element: "wood",  cost: 100, st: 20, hp: 85, ab: ["immobile", "capture"] }, // 旧: ワールドツリー
  { id: "forestlord",  name: "大天狗", type: "creature", element: "wood",  cost: 110, st: 55, hp: 60, ab: ["capture"] }, // v25: ST50→55（同コストの大鎌切(60/45 居合+捕縛)に押されていた） // 旧: フォレストロード
  { id: "greendragon", name: "青龍", type: "creature", element: "wood",  cost: 120, st: 60, hp: 60, ab: ["pierce"] }, // 旧: グリーンドラゴン
  { id: "elderent",    name: "大樹の翁", type: "creature", element: "wood", cost: 135, st: 60, hp: 75, ab: ["capture"] }, // 旧: エンシェントエント
  // --- v13追加式神 ---
  { id: "alraune",     name: "藤娘",       type: "creature", element: "wood",  cost: 85,  st: 40, hp: 55, ab: ["capture"] }, // v25: HP50→55（80Gの提灯鮟鱇(45/45 捕縛)との差別化＝木らしい粘りに） // 旧: アルラウネ
  // --- v15追加: 各属性に「元から呪力攻撃を備えた」術士を1種ずつ。
  //     無属性の物理無効・物理反射（幽鬼/逃げ水）を素で掃討できる対抗札。そのぶんHPは低め ---
  { id: "flamemage",   name: "火遁の行者",   type: "creature", element: "fire",  cost: 75,  st: 45, hp: 30, ab: ["magicatk"], rarity: "uncommon" }, // v25: HP25→30（同75Gの潮の巫女(40/40)に対し打たれ弱すぎた） // 旧: フレイムメイジ
  { id: "druid",       name: "木遁の行者",         type: "creature", element: "wood",  cost: 70,  st: 35, hp: 35, ab: ["magicatk"], rarity: "uncommon" }, // 旧: ドルイド
  { id: "runedwarf",   name: "土遁の行者",   type: "creature", element: "earth", cost: 70,  st: 35, hp: 40, ab: ["magicatk"], rarity: "uncommon" }, // 旧: ルーンドワーフ
  { id: "frostwizard", name: "水遁の行者", type: "creature", element: "water", cost: 65, st: 40, hp: 30, ab: ["magicatk"], rarity: "uncommon" }, // v23: 75→65G（タイドメイデン(75G 40/40)の完全劣化だった＝安さで差別化） // 旧: フロストウィザード
  // --- 無属性（v13追加）: 土地の加護を一切受けず属性相性の輪の外＝どの土地でも同じ強さ。
  //     そのぶんコスト効率がやや高く、全員レア以上でユニークな能力（護法/連撃/二重能力）を持つ ---
  { id: "gargoyle",     name: "狛犬",       type: "creature", element: "neutral", cost: 85,  st: 35, hp: 55, ab: ["guard", "spellproof"], rarity: "rare" }, // v23: 60→85G（守護+護法＝呪術除去不能の壁が60Gは安すぎた） // 旧: ガーゴイル
  { id: "unicorn",      name: "麒麟",       type: "creature", element: "neutral", cost: 75,  st: 45, hp: 45, ab: ["first", "lucky"],      rarity: "rare" }, // 旧: ユニコーン
  { id: "mithrilgolem", name: "からくり武者", type: "creature", element: "neutral", cost: 95,  st: 50, hp: 70, ab: ["spellproof"],           rarity: "rare" }, // 旧: ミスリルゴーレム
  { id: "chimera",      name: "鵺",           type: "creature", element: "neutral", cost: 115, st: 55, hp: 65, ab: ["double"],               rarity: "legendary" }, // v25: 45/60→55/65（110Gの双頭の火蛇(55/50 連撃・レア)に排出率で劣るレジェンドが数値でも負けていた） // 旧: キメラ
  // --- 無属性（v15追加）: 物理/呪力の攻撃タイプを軸にしたトリックスター。
  //     物理攻撃しか持たない相手には鉄壁だが、呪力攻撃（✨宝具/式神）や除去呪術にはあっさり沈む
  //     ＝「対策を積んでいるか」で強さが激変するメタカード。HPは意図的に低い（物理無効=低め／物理反射=極小）---
  { id: "phantom",      name: "幽鬼",       type: "creature", element: "neutral", cost: 70,  st: 35, hp: 40, ab: ["physnull"],    rarity: "rare" }, // v25: 75G 30/35→70G 35/40（60Gの鬼火が物理無効＋呪力攻撃を兼ねて上位互換だった） // 旧: ファントム
  { id: "mirage",       name: "逃げ水",       type: "creature", element: "neutral", cost: 55,  st: 10, hp: 25, ab: ["physreflect"], rarity: "rare" }, // v25: HP15→25（呪力攻撃の一撃で必ず落ちる紙束すぎた。メタカードとしての最低限の体力を確保） // 旧: ミラージュ
  // --- 無属性（v17追加）: 化け狸＝相手をそっくり真似るトリックスター（原さん要望）。
  //     素のST/HPは最弱クラスだが、バトルでは常に「相手と同じ強さ」＝強敵ほど良い写し身になる。
  //     白澤＝無属性初の呪力攻撃持ち。守護も併せ持つ万能の番人（幽鬼/逃げ水対策にもなる）
  { id: "doppelganger", name: "化け狸", type: "creature", element: "neutral", cost: 90,  st: 10, hp: 30, ab: ["mimic"],               rarity: "legendary" }, // 旧: ドッペルゲンガー
  { id: "sphinx",       name: "白澤",     type: "creature", element: "neutral", cost: 95,  st: 45, hp: 50, ab: ["magicatk", "guard"],   rarity: "rare" }, // 旧: スフィンクス
  // --- 宝具（バトル時に装備、使い切り） ---
  { id: "longsword",     name: "打刀",     type: "item", cost: 40,  st: 20, hp: 0,  desc: "バトル時 ST+20" }, // 旧: ロングソード
  { id: "battleaxe",     name: "大鉞",   type: "item", cost: 70,  st: 40, hp: 0,  desc: "バトル時 ST+40" }, // 旧: バトルアックス
  { id: "greatsword",    name: "野太刀",   type: "item", cost: 100, st: 55, hp: 0,  desc: "バトル時 ST+55" }, // 旧: グレートソード
  { id: "assassindagger",name: "忍びの苦無",   type: "item", cost: 65,  st: 15, hp: 0,  grant: ["first"], desc: "ST+15・居合を得る" }, // v25: 80→65G（双刀(95G ST+35+居合)に15G差でST20も劣り、存在意義が無かった） // 旧: アサシンダガー
  { id: "leathershield", name: "竹束",   type: "item", cost: 40,  st: 0,  hp: 20, desc: "バトル時 HP+20" }, // 旧: レザーシールド
  { id: "towershield",   name: "大盾",   type: "item", cost: 70,  st: 0,  hp: 40, desc: "バトル時 HP+40" }, // 旧: タワーシールド
  { id: "platemail",     name: "大鎧",   type: "item", cost: 100, st: 0,  hp: 55, desc: "バトル時 HP+55" }, // 旧: プレートメイル
  { id: "elementalorb",  name: "勾玉", type: "item", cost: 55, st: 15, hp: 15, desc: "バトル時 ST+15 / HP+15" }, // v25: 60→55G（金剛の帯(70G +20/+20)・陣旗(65G +25/+10)からの傾斜を適正化） // 旧: エレメンタルオーブ
  // --- v4追加宝具 ---
  { id: "claymore",      name: "大太刀",       type: "item", cost: 130, st: 70, hp: 0,  desc: "バトル時 ST+70" }, // 旧: クレイモア
  { id: "mithrilshield", name: "鋼の大盾", type: "item", cost: 130, st: 0,  hp: 70, desc: "バトル時 HP+70" }, // 旧: ミスリルシールド
  { id: "dualblade",     name: "双刀", type: "item", cost: 95,  st: 35, hp: 0,  grant: ["first"], desc: "ST+35・居合を得る" }, // 旧: デュアルブレード
  { id: "luckycharm",    name: "開運のお守り",   type: "item", cost: 50,  st: 10, hp: 10, grant: ["lucky"], desc: "ST+10/HP+10・会心率アップ" }, // 旧: ラックチャーム
  { id: "vampirelance",  name: "破魔槍", type: "item", cost: 75, st: 30, hp: 0,  grant: ["pierce"], desc: "ST+30・破魔を得る" }, // 旧: ヴァンパイアランス
  { id: "saintarmor",    name: "白糸の鎧", type: "item", cost: 110, st: 0,  hp: 45, grant: ["guard"], desc: "HP+45・守護を得る" }, // 旧: セイントアーマー
  // --- v13追加宝具 ---
  { id: "warbanner",     name: "陣旗",     type: "item", cost: 65,  st: 25, hp: 10, desc: "バトル時 ST+25 / HP+10" }, // 旧: ウォーバナー
  // --- v15追加: 呪力攻撃宝具。同コスト帯の武器よりST補正は低いが、装備者の攻撃が呪力になる
  //     ＝物理無効・物理反射（幽鬼/逃げ水）を貫いて掃討できる（防衛時の反撃にも有効） ---
  { id: "magicwand",     name: "御幣",   type: "item", cost: 50,  st: 15, hp: 0,  magicatk: true, rarity: "uncommon", desc: "バトル時 ST+15・攻撃が呪力になる（物理無効・物理反射を貫く）" }, // 旧: マジックワンド
  { id: "arcanarod",     name: "錫杖",   type: "item", cost: 90,  st: 35, hp: 0,  magicatk: true, rarity: "rare",     desc: "バトル時 ST+35・攻撃が呪力になる（物理無効・物理反射を貫く）" }, // 旧: アルカナロッド
  // --- v17追加: 吸奪武器（原さん要望「攻撃したポイント分×2倍の霊力を強奪する武器」）。
  //     drainMagic=与えたダメージに掛ける倍率。実際の霊力移動は fightFor（main.js）が行う ---
  { id: "greedfang",     name: "餓鬼の牙", type: "item", cost: 85,  st: 25, hp: 0,  drainMagic: 2, rarity: "rare", desc: "バトル時 ST+25・与えたダメージ×2倍の霊力を相手から強奪する（攻撃が通らなければ強奪もなし）" }, // 旧: グリードファング
  // --- 呪術 ---
  { id: "manadrain", name: "奪霊の符",   type: "spell", cost: 70,  spell: "drain",    desc: "相手から200Gを奪う" }, // v23: 50→70G（±400Gの振れ幅が50Gは安すぎた） // 旧: マナドレイン
  { id: "holyword",  name: "言霊の符", type: "spell", cost: 60,  spell: "holyword", desc: "次の賽の目を自由に選ぶ" }, // 旧: ホーリーワード
  { id: "drawmist",  name: "手繰りの符",   type: "spell", cost: 50,  spell: "draw",     desc: "カードを2枚引く" }, // v23: 70→50G（文殊の知恵に支配されていた） // 旧: ドローミスト
  { id: "quake",     name: "山崩しの符",       type: "spell", cost: 90,  spell: "quake",    desc: "敵の土地1つのレベルを1下げる" }, // v25: 120→90G（170Gの大山崩しの符が2つ下げる＝単発版が割高すぎた） // 旧: クエイク
  { id: "growth",    name: "開墾の符",       type: "spell", cost: 120, spell: "growth",   rarity: "rare", desc: "自分のLv3以下の土地1つをLv+1" }, // v25: 150→120G（星霜の儀(120G+手札1枚でLv+2)に支配されていた） // 旧: グロース
  { id: "recall",    name: "社還りの符",       type: "spell", cost: 100, spell: "recall",   desc: "本宮へ雲隠れ（総資産達成なら勝利！ 鳥居を規定数すべて通過済みなら周回ボーナスも得る）" }, // 旧: リコール
  { id: "revenge",   name: "意趣返しの符",       type: "spell", cost: 80,  spell: "revenge",  desc: "総資産で負けている時、差額の25%（最大500G）を相手から奪う" }, // 旧: リベンジ
  { id: "eleshift",  name: "霊脈替えの符", type: "spell", cost: 90, spell: "eleshift", desc: "自分の土地1つの属性を変える（連鎖の組み替えに）" }, // 旧: エレメンタルシフト
  { id: "vanish",    name: "大祓の符",     type: "spell", cost: 140, spell: "vanish",   desc: "敵式神1体を無条件で消滅させ土地を解放する（HP不問＝どんな相手でも確実に破壊／土地レベルは残る）" }, // 旧: バニッシュ
  { id: "gust",      name: "神風の符",         type: "spell", cost: 90,  spell: "gust", rarity: "rare", icon: "🌬️", desc: "敵式神1体を隣接する空き地へ強制的に押し出す（元の土地は空き地に戻る＝連鎖崩し・防衛どかしに／不動・結界は対象外）" }, // 旧: ガスト
  { id: "regen",     name: "快癒の符",       type: "spell", cost: 60,  spell: "regen", icon: "💚", desc: "負傷した自分の式神1体のHPを全回復する" }, // 旧: リジェネ
  { id: "renew",     name: "引き直し",       type: "spell", cost: 40,  spell: "renew",    desc: "手札をすべて捨て、新たに6枚引く（手札事故のリセットに）" },
  // --- v4追加呪術 ---
  { id: "meteor",    name: "天火の符",         type: "spell", cost: 90,  spell: "meteor",   icon: "☄️", desc: "敵式神1体に40ダメージ（現在HPが0以下になれば破壊し土地を解放／高HPの相手は削って弱らせる）。大祓の符より安価で小回りが利く" }, // v23: 110→90G（猛火の儀(100G 70dmg)に見劣りしていた） // 旧: メテオ
  { id: "freeze",    name: "金縛り",       type: "spell", cost: 100, spell: "freeze",   icon: "❄️", desc: "相手を凍らせ、次のターンを1回休みにする" }, // 旧: フリーズ
  { id: "treasure",  name: "検地の符",     type: "spell", cost: 50,  spell: "treasure", icon: "💰", desc: "所有する土地1つにつき+40G（土地が多いほど得）" }, // 旧: トレジャー
  { id: "steal",     name: "盗人の符",     type: "spell", cost: 80,  spell: "steal",    icon: "🎭", desc: "相手の手札からランダムに1枚奪う" }, // 旧: スティール
  { id: "salvage",   name: "反故拾い",     type: "spell", cost: 40,  spell: "salvage",  icon: "♻️", desc: "自分の捨て札からカード1枚を選んで手札に戻す" }, // 旧: サルベージ
  // --- v13追加呪術 ---
  { id: "alchemy",   name: "換銭の符",     type: "spell", cost: 40,  spell: "alchemy",  icon: "⚗️", desc: "手札から1枚を選んで捨て、150Gに変える（使わないカードを資金に）" }, // v25: 120→150G（錬金大釜(70Gで2枚×130G)に対し1枚あたりの実入りが低すぎた） // 旧: アルケミー
  // --- v17追加呪術: 移動3種（原さん要望）。自分を飛ばす／配下を好きな空き地へ／配下を2マス先へ ---
  { id: "teleport",  name: "雲隠れの符",     type: "spell", cost: 90,  spell: "teleport",  rarity: "rare",     icon: "💫", desc: "自分のコマを盤面の好きなマス（本宮以外）へ飛ばす。そのあと通常どおり賽で移動する（飛んだだけではマスの効果・鳥居通過は発生しない）" }, // 旧: テレポート
  { id: "transport", name: "遷座の符", type: "spell", cost: 80,  spell: "transport", rarity: "rare",     icon: "🚪", desc: "自分の式神1体を盤面の好きな空き地へ転送する（現在HPのまま移動・元の土地は空き地に戻りレベルは残る／不動は対象外）" }, // 旧: トランスポート
  { id: "leap",      name: "兎跳びの符",         type: "spell", cost: 45,  spell: "leap",      rarity: "uncommon", icon: "🐇", desc: "自分の式神1体を2マス先の空き地へ跳躍させる（元の土地は空き地に戻りレベルは残る／不動は対象外）" }, // 旧: リープ
  // --- v5追加呪術/宝具 ---
  { id: "plunder",     name: "収奪の符",       type: "spell", cost: 95, spell: "plunder",    rarity: "rare",     icon: "💰", desc: "相手の所持金の半分を奪う（相手が富むほど大きい）" }, // 旧: プランダー
  { id: "hyperdice",   name: "倍賽の符",   type: "spell", cost: 50, spell: "dicedouble", rarity: "uncommon", icon: "🎲", desc: "次の賽の出目を2倍にする（最大12マス進む）" }, // 旧: ダイスブースト
  { id: "dispelward",  name: "解呪の御札", type: "item", cost: 55, st: 0, hp: 0,  nullify: true,  rarity: "rare", desc: "バトル時、相手の宝具の効果を打ち消す（相手の宝具を無効化）" }, // 旧: ディスペルワード
  { id: "mirrorshield",name: "神鏡",   type: "item", cost: 85, st: 0, hp: 20, reflect: 0.5, rarity: "rare", desc: "バトル時 HP+20・受けた攻撃ダメージの50%を相手に反射する" }, // v25: 95→85G（棘鎧(75G HP+25/反射30%)との差が10G＝反射20%分に見合わなかった） // 旧: ミラーシールド
  // --- 盤面エフェクト（呪術枠で発動、2ラウンドの時限効果でマスそのものを変化させる） ---
  { id: "sanctuary", name: "神域", type: "spell", cost: 140, spell: "sanctuary", fx: true, icon: "🛡️", // 旧: サンクチュアリ
    desc: "【盤面】自分の土地1つに2Rの結界。侵略・式神侵攻・敵呪術の対象にならない" },
  { id: "ensnare",   name: "蜘蛛の巣張り", type: "spell", cost: 110, spell: "ensnare",   fx: true, icon: "🕸️", // 旧: スネアトラップ
    desc: "【盤面】土地1つに2Rの罠。相手が通過・停止するとその場で足止め（移動終了）される" },

  // ============================================================
  // 第二巻「時流の帖」（v19・set:2）
  // テーマ: 時間・成長・経済・連携。詳細は CARD_SET2_PLAN.md
  // 呪術約55種はフェーズ2で追加予定（このブロックは式神113＋宝具32）
  // ============================================================
  // --- 火（遠隔・背水・会心） ---
  { id: "firebaby",     name: "火の子蜥蜴",     type: "creature", element: "fire", set: 2, cost: 30,  st: 20, hp: 20, ab: ["grow"] }, // 旧: 火の子トカゲ
  { id: "sparkimp",     name: "火の粉小僧",   type: "creature", element: "fire", set: 2, cost: 35,  st: 25, hp: 20, ab: ["lucky"] }, // 旧: スパークインプ
  { id: "cinderrat",    name: "火鼠",   type: "creature", element: "fire", set: 2, cost: 40,  st: 25, hp: 25, ab: ["pack"] }, // 旧: シンダーラット
  { id: "heathawk",     name: "陽炎鳶",     type: "creature", element: "fire", set: 2, cost: 50,  st: 35, hp: 25, ab: [] }, // 旧: ヒートホーク
  { id: "hellbat",      name: "野衾",       type: "creature", element: "fire", set: 2, cost: 55,  st: 30, hp: 30, ab: ["first"] }, // 旧: ヘルバット
  { id: "blazesoldier", name: "焔足軽", type: "creature", element: "fire", set: 2, cost: 60, st: 40, hp: 30, ab: [] }, // 旧: ブレイズソルジャー
  { id: "flameboar",    name: "手負い猪",     type: "creature", element: "fire", set: 2, cost: 65,  st: 45, hp: 30, ab: ["lastward"] }, // 旧: フレイムボア
  { id: "firearcher",   name: "火矢の射手", type: "creature", element: "fire", set: 2, cost: 60, st: 30, hp: 25, ab: ["ranged"], rarity: "uncommon" }, // 旧: ファイアアーチャー
  { id: "lavalizard",   name: "大火蜥蜴",   type: "creature", element: "fire", set: 2, cost: 70,  st: 45, hp: 35, ab: [] }, // 旧: ラヴァリザード
  { id: "flarewitch",   name: "飛縁魔",   type: "creature", element: "fire", set: 2, cost: 80,  st: 45, hp: 30, ab: ["magicatk", "lucky"], rarity: "rare" }, // 旧: フレアウィッチ
  { id: "bombturtle",   name: "爆ぜ亀",     type: "creature", element: "fire", set: 2, cost: 85,  st: 30, hp: 60, ab: ["guard"], rarity: "uncommon" }, // 旧: ボムタートル
  { id: "flameogre",    name: "焔鬼",   type: "creature", element: "fire", set: 2, cost: 90,  st: 55, hp: 40, ab: ["assault"], rarity: "uncommon" }, // 旧: フレイムオーガ
  { id: "burstgriffon", name: "迦楼羅", type: "creature", element: "fire", set: 2, cost: 95, st: 50, hp: 45, ab: ["first"], rarity: "uncommon" }, // 旧: バーストグリフォン
  { id: "ignislancer",  name: "火槍武者", type: "creature", element: "fire", set: 2, cost: 100, st: 55, hp: 45, ab: ["pierce"], rarity: "uncommon" }, // 旧: イグニスランサー
  { id: "calderagolem", name: "火口の主", type: "creature", element: "fire", set: 2, cost: 105, st: 45, hp: 65, ab: [], rarity: "uncommon" }, // 旧: カルデラゴーレム
  { id: "amphisbaena",  name: "双頭の火蛇", type: "creature", element: "fire", set: 2, cost: 110, st: 55, hp: 50, ab: ["double"], rarity: "rare" }, // 旧: アンフィスバエナ
  { id: "crimsonknight",name: "緋縅の武者", type: "creature", element: "fire", set: 2, cost: 115, st: 60, hp: 55, ab: ["lastward"], rarity: "rare" }, // 旧: クリムゾンナイト
  { id: "cannondrake",  name: "大筒竜", type: "creature", element: "fire", set: 2, cost: 120, st: 60, hp: 50, ab: ["ranged"], rarity: "rare" }, // 旧: 砲竜キャノンドレイク
  { id: "suzaku",       name: "朱雀",       type: "creature", element: "fire", set: 2, cost: 130, st: 65, hp: 55, ab: ["first", "lucky"], rarity: "rare" }, // 旧: 炎鳥スザク
  { id: "hellflamedemon", name: "焦熱の大鬼", type: "creature", element: "fire", set: 2, cost: 140, st: 75, hp: 50, ab: ["assault"], rarity: "rare" }, // 旧: ヘルフレイムデーモン
  { id: "glendragon",   name: "紅蓮龍", type: "creature", element: "fire", set: 2, cost: 150, st: 75, hp: 60, ab: ["ranged", "pierce"], rarity: "legendary" }, // 旧: 焔竜グレンドラゴン
  // --- 木（百鬼・成長・捕縛） ---
  { id: "leafrabbit",   name: "葉隠れ兎",   type: "creature", element: "wood", set: 2, cost: 30,  st: 15, hp: 25, ab: ["pack"] }, // 旧: リーフラビット
  { id: "spriggan",     name: "山童",       type: "creature", element: "wood", set: 2, cost: 40,  st: 20, hp: 30, ab: ["grow"] }, // 旧: スプリガン
  { id: "honeybee",     name: "大雀蜂",       type: "creature", element: "wood", set: 2, cost: 45,  st: 30, hp: 25, ab: ["first"] }, // 旧: ハニービー
  { id: "mycolon",      name: "茸小僧",       type: "creature", element: "wood", set: 2, cost: 50,  st: 25, hp: 40, ab: [] }, // 旧: マイコロン
  { id: "matango",      name: "胞子茸", type: "creature", element: "wood", set: 2, cost: 50,  st: 25, hp: 35, ab: ["rebirth"] }, // 旧: 胞子撒きマタンゴ
  { id: "ivysnake",     name: "蔦蛇", type: "creature", element: "wood", set: 2, cost: 55,  st: 30, hp: 35, ab: ["absorb"] }, // v23: 絡み茨と完全同一だった→絞めて生気を吸う蛇（吸収）に差別化 // 旧: アイビースネーク
  { id: "youngent",     name: "若木の精",     type: "creature", element: "wood", set: 2, cost: 60,  st: 25, hp: 50, ab: ["grow"] }, // 旧: 若木のエント
  { id: "forestarcher", name: "木隠れの射手", type: "creature", element: "wood", set: 2, cost: 60, st: 30, hp: 30, ab: ["ranged"], rarity: "uncommon" }, // 旧: フォレストアーチャー
  { id: "packwolf",     name: "狼の眷属",     type: "creature", element: "wood", set: 2, cost: 65,  st: 35, hp: 35, ab: ["pack"] }, // 旧: パックウルフ
  { id: "sylph",        name: "天女",           type: "creature", element: "wood", set: 2, cost: 70,  st: 40, hp: 35, ab: ["first"] }, // 旧: シルフ
  { id: "barkbeetle",   name: "大兜虫",   type: "creature", element: "wood", set: 2, cost: 75,  st: 30, hp: 55, ab: ["armor"], rarity: "uncommon" }, // 旧: バークビートル
  { id: "mossshaman",   name: "苔山伏",   type: "creature", element: "wood", set: 2, cost: 80,  st: 40, hp: 40, ab: ["magicatk"], rarity: "uncommon" }, // 旧: モスシャーマン
  { id: "vinestrangler",name: "絞め蔓", type: "creature", element: "wood", set: 2, cost: 85, st: 45, hp: 45, ab: ["absorb"], rarity: "uncommon" }, // v23: 藤娘(85G capture)との実質重複→絞め殺し＝吸収に差別化 // 旧: ヴァインストラングラー
  { id: "elvenhunter",  name: "烏天狗", type: "creature", element: "wood", set: 2, cost: 90,  st: 45, hp: 40, ab: ["ranged", "pack"], rarity: "rare" }, // 旧: エルヴンハンター
  { id: "treeguardian", name: "巨木の守り手",     type: "creature", element: "wood", set: 2, cost: 95,  st: 30, hp: 75, ab: ["guard"], rarity: "uncommon" },
  { id: "greenhydra",   name: "九頭の大蛇", type: "creature", element: "wood", set: 2, cost: 100, st: 50, hp: 55, ab: ["grow"], rarity: "rare" }, // 旧: グリーンヒュドラ
  { id: "fairyqueen",   name: "木花咲耶姫", type: "creature", element: "wood", set: 2, cost: 105, st: 45, hp: 50, ab: ["pack", "first"], rarity: "rare" }, // 旧: フェアリークイーン
  { id: "kingmantis",   name: "大鎌切", type: "creature", element: "wood", set: 2, cost: 110, st: 60, hp: 45, ab: ["first", "capture"], rarity: "rare" }, // 旧: キングマンティス
  { id: "sequoiagiant", name: "大杉入道", type: "creature", element: "wood", set: 2, cost: 115, st: 55, hp: 70, ab: [], rarity: "uncommon" }, // 旧: セコイアジャイアント
  { id: "leafdragon",   name: "木葉龍", type: "creature", element: "wood", set: 2, cost: 125, st: 60, hp: 60, ab: ["pack"], rarity: "rare" }, // 旧: 森竜リーフドラゴン
  { id: "spiritelder",  name: "千年杉の翁", type: "creature", element: "wood", set: 2, cost: 145, st: 55, hp: 85, ab: ["grow", "capture"], rarity: "legendary" }, // 旧: 翁樹スピリットエルダー
  // --- 地（硬殻・採掘・重装） ---
  { id: "pebbling",     name: "礫小僧",     type: "creature", element: "earth", set: 2, cost: 35,  st: 15, hp: 30, ab: ["armor"] }, // 旧: ペブルリング
  { id: "molminer",     name: "金掘り土竜",   type: "creature", element: "earth", set: 2, cost: 45,  st: 25, hp: 30, ab: ["mine"] }, // 旧: モールマイナー
  { id: "sandlizard",   name: "砂蜥蜴",   type: "creature", element: "earth", set: 2, cost: 45,  st: 30, hp: 35, ab: [] }, // 旧: サンドリザード
  { id: "goblinsapper", name: "穴掘り鬼", type: "creature", element: "earth", set: 2, cost: 50,  st: 35, hp: 30, ab: ["assault"] }, // 旧: ゴブリンサッパー
  { id: "quartzbeetle", name: "水晶虫", type: "creature", element: "earth", set: 2, cost: 55,  st: 25, hp: 45, ab: ["armor"] }, // 旧: クォーツビートル
  { id: "catapultdwarf",name: "投石小僧", type: "creature", element: "earth", set: 2, cost: 65, st: 35, hp: 30, ab: ["ranged"], rarity: "uncommon" }, // 旧: カタパルトドワーフ
  { id: "spikearmadillo", name: "針山法師", type: "creature", element: "earth", set: 2, cost: 70, st: 30, hp: 50, ab: ["armor"], rarity: "uncommon" }, // 旧: スパイクアルマジロ
  { id: "gemeater",     name: "宝石喰い", type: "creature", element: "earth", set: 2, cost: 70, st: 30, hp: 45, ab: ["mine"], rarity: "uncommon" }, // 旧: 宝石喰いジェムイーター
  { id: "duneworm",     name: "大砂蟲", type: "creature", element: "earth", set: 2, cost: 75,  st: 45, hp: 40, ab: ["pierce"] }, // 旧: デューンウォーム
  { id: "dwarfforeman", name: "鉱山の親方", type: "creature", element: "earth", set: 2, cost: 80, st: 30, hp: 50, ab: ["mine", "guard"], rarity: "uncommon" }, // 旧: ドワーフフォアマン
  { id: "gaiashaman",   name: "山神の巫女", type: "creature", element: "earth", set: 2, cost: 85,  st: 40, hp: 45, ab: ["magicatk"], rarity: "uncommon" }, // 旧: ガイアシャーマン
  { id: "terracotta",   name: "埴輪武者", type: "creature", element: "earth", set: 2, cost: 85, st: 40, hp: 55, ab: [] }, // 旧: テラコッタソルジャー
  { id: "hillgiant",    name: "山男", type: "creature", element: "earth", set: 2, cost: 90,  st: 50, hp: 50, ab: [] }, // 旧: ヒルジャイアント
  { id: "stonesentinel",name: "道祖神", type: "creature", element: "earth", set: 2, cost: 80, st: 20, hp: 70, ab: ["immobile"], rarity: "uncommon" }, // 旧: ストーンセンチネル
  { id: "mountainogre", name: "山鬼", type: "creature", element: "earth", set: 2, cost: 95,  st: 50, hp: 50, ab: ["armor"], rarity: "uncommon" }, // v23: 赤鬼(95G assault)との実質重複→岩の皮膚＝硬殻の重戦士に差別化 // 旧: マウンテンオーガ
  { id: "crystalgolem", name: "水晶の巨人", type: "creature", element: "earth", set: 2, cost: 95, st: 40, hp: 65, ab: ["armor"], rarity: "rare" }, // 旧: クリスタルゴーレム
  { id: "landturtle",   name: "大岩亀",   type: "creature", element: "earth", set: 2, cost: 100, st: 20, hp: 80, ab: ["immobile", "armor"], rarity: "rare" }, // 旧: ランドタートル
  { id: "earthwyvern",  name: "山飛龍", type: "creature", element: "earth", set: 2, cost: 110, st: 55, hp: 55, ab: ["pierce"], rarity: "uncommon" }, // 旧: アースワイバーン
  { id: "obsidianknight", name: "黒曜の武者", type: "creature", element: "earth", set: 2, cost: 115, st: 55, hp: 60, ab: ["armor"], rarity: "rare" }, // 旧: オブシディアンナイト
  { id: "terradragon",  name: "大地龍", type: "creature", element: "earth", set: 2, cost: 130, st: 60, hp: 70, ab: ["grow"], rarity: "rare" }, // 旧: 大地竜テラドラゴン
  { id: "atlas",        name: "ダイダラボッチ", type: "creature", element: "earth", set: 2, cost: 150, st: 70, hp: 85, ab: ["armor", "guard"], rarity: "legendary" }, // 旧: 山峰の巨人アトラス
  // --- 水（吸収・呪力・流転） ---
  { id: "bubblefish",   name: "泡魚", type: "creature", element: "water", set: 2, cost: 30,  st: 15, hp: 30, ab: [] }, // 旧: バブルフィッシュ
  { id: "coralcrab",    name: "珊瑚蟹",   type: "creature", element: "water", set: 2, cost: 45,  st: 20, hp: 40, ab: ["armor"] }, // 旧: コーラルクラブ
  { id: "streamotter",  name: "川獺", type: "creature", element: "water", set: 2, cost: 45,  st: 30, hp: 30, ab: ["first"] }, // 旧: ストリームオター
  { id: "snowfairy",    name: "雪の精", type: "creature", element: "water", set: 2, cost: 50,  st: 25, hp: 40, ab: ["pack"] }, // 旧: スノーフェアリー
  { id: "leechslime",   name: "血吸い蛭",   type: "creature", element: "water", set: 2, cost: 55,  st: 25, hp: 35, ab: ["absorb"] }, // 旧: リーチスライム
  { id: "shellknight",  name: "貝武者",     type: "creature", element: "water", set: 2, cost: 55,  st: 30, hp: 45, ab: [] }, // 旧: シェルナイト
  { id: "mistwisp",     name: "狭霧の精",   type: "creature", element: "water", set: 2, cost: 55,  st: 25, hp: 35, ab: ["magicatk"], rarity: "uncommon" }, // 旧: ミストウィスプ
  { id: "frostwolf",    name: "雪狼",   type: "creature", element: "water", set: 2, cost: 60,  st: 30, hp: 35, ab: ["pack"] }, // v23: 氷柱女と完全同一だった→狼らしく百鬼に差別化 // 旧: フロストウルフ
  { id: "harpoonmerman",name: "銛打ち海人", type: "creature", element: "water", set: 2, cost: 65, st: 35, hp: 35, ab: ["ranged"], rarity: "uncommon" }, // 旧: ハープーンマーマン
  { id: "snowharpy",    name: "雪女",   type: "creature", element: "water", set: 2, cost: 70,  st: 40, hp: 35, ab: ["first"] }, // 旧: スノーハーピー
  { id: "nereid",       name: "水霊",     type: "creature", element: "water", set: 2, cost: 75,  st: 35, hp: 45, ab: ["rebirth"], rarity: "uncommon" }, // 旧: 水霊ネレイド
  { id: "tidemaiden",   name: "潮の巫女", type: "creature", element: "water", set: 2, cost: 75, st: 40, hp: 40, ab: ["magicatk"], rarity: "uncommon" }, // 旧: 潮の巫女タイドメイデン
  { id: "abyssangler",  name: "提灯鮟鱇", type: "creature", element: "water", set: 2, cost: 80,  st: 45, hp: 45, ab: ["capture"], rarity: "uncommon" }, // 旧: アビスアングラー
  { id: "frostlancer",  name: "氷槍武者", type: "creature", element: "water", set: 2, cost: 90,  st: 50, hp: 45, ab: ["pierce"], rarity: "uncommon" }, // 旧: フロストランサー
  { id: "tideserpent",  name: "渦潮の大蛇", type: "creature", element: "water", set: 2, cost: 95,  st: 55, hp: 65, ab: [] }, // v23: 大海蛇(90G 50/60)に支配されていた→95Gらしいバニラ最大級に // 旧: タイドサーペント
  { id: "kelpie",       name: "波駆け馬",         type: "creature", element: "water", set: 2, cost: 85,  st: 45, hp: 45, ab: ["fly"] }, // v23: 水バニラ密集の解消→水馬らしく駆ける（天翔＝2マス侵攻） // 旧: ケルピー
  { id: "glaciergolem", name: "氷の巨人", type: "creature", element: "water", set: 2, cost: 105, st: 45, hp: 70, ab: ["armor"], rarity: "rare" }, // 旧: グレイシャーゴーレム
  { id: "oceanpriestess", name: "龍宮の巫女", type: "creature", element: "water", set: 2, cost: 110, st: 50, hp: 50, ab: ["absorb", "magicatk"], rarity: "rare" }, // 旧: オーシャンプリーステス
  { id: "umibozu",      name: "海坊主",       type: "creature", element: "water", set: 2, cost: 120, st: 60, hp: 60, ab: ["absorb"], rarity: "rare" }, // 旧: ウミボウズ
  { id: "frostdragon",  name: "氷龍", type: "creature", element: "water", set: 2, cost: 130, st: 65, hp: 60, ab: ["magicatk"], rarity: "rare" }, // 旧: 氷竜フロストドラゴン
  { id: "maelstrom",    name: "大渦の主", type: "creature", element: "water", set: 2, cost: 145, st: 65, hp: 75, ab: ["absorb", "capture"], rarity: "legendary" }, // 旧: 大渦の主メイルシュトローム
  { id: "splitooze",    name: "分霊", type: "creature", element: "water", set: 2, cost: 85,  st: 25, hp: 40, ab: ["split"], rarity: "rare" }, // v24: 希少特性🫧分裂＝侵攻で占領するたび元の土地にも分裂体（HP折半）。🐺百鬼(同属性)・🧪増殖の秘薬とコンボ // 旧: スプリットウーズ
  // --- 無属性（機械・時間・メタ。全員レア以上＝文箱/交換所でのみ入手） ---
  { id: "tinsoldier",   name: "紙式神", type: "creature", element: "neutral", set: 2, cost: 50, st: 30, hp: 30, ab: ["pack"], rarity: "rare" }, // 旧: ブリキ兵ティンソルジャー
  { id: "clockbeetle",  name: "からくり虫", type: "creature", element: "neutral", set: 2, cost: 55, st: 25, hp: 40, ab: ["armor"], rarity: "rare" }, // 旧: クロックワークビートル
  { id: "willowisp",    name: "鬼火", type: "creature", element: "neutral", set: 2, cost: 60, st: 25, hp: 25, ab: ["physnull", "magicatk"], rarity: "rare" }, // v23: 幽鬼との重複解消→鬼火の炎は呪力攻撃（物理無効ミラー対決も制する） // 旧: ウィルオーウィスプ
  { id: "shadow",       name: "影法師",         type: "creature", element: "neutral", set: 2, cost: 65,  st: 30, hp: 30, ab: ["ranged"], rarity: "rare" }, // 旧: シャドウ
  { id: "chronorabbit", name: "月兎",   type: "creature", element: "neutral", set: 2, cost: 70,  st: 35, hp: 30, ab: ["first", "fly"], rarity: "rare" }, // 旧: クロノラビット
  { id: "littlemimic",  name: "化け子狸",   type: "creature", element: "neutral", set: 2, cost: 70,  st: 15, hp: 25, ab: ["mimic", "immobile"], rarity: "rare" }, // v23: 模倣は素のST/HPが無意味＝安い方が上位だった→不動（防衛専用の写し身）で化け狸と役割分担 // 旧: リトルミミック
  { id: "fortunecat",   name: "招き猫", type: "creature", element: "neutral", set: 2, cost: 75, st: 30, hp: 40, ab: ["mine", "lucky"], rarity: "rare" }, // 旧: 招き猫フォーチュンキャット
  { id: "joker",        name: "妖狐",       type: "creature", element: "neutral", set: 2, cost: 70,  st: 35, hp: 40, ab: ["lucky", "lastward"], rarity: "rare" }, // v23: 85G 35/35は弱すぎた→70G 35/40（切り札らしい博打枠に） // 旧: ジョーカー
  { id: "gremlin",      name: "天邪鬼",       type: "creature", element: "neutral", set: 2, cost: 65,  st: 30, hp: 40, ab: ["dispel"], rarity: "rare" }, // v23: 85→65G（看破の内蔵価値+小柄な身体に見合う値段へ） // 旧: グレムリン
  { id: "livingarmor",  name: "鎧の付喪神", type: "creature", element: "neutral", set: 2, cost: 90,  st: 40, hp: 60, ab: ["armor"], rarity: "rare" }, // 旧: リビングアーマー
  { id: "pegasus",      name: "天馬",         type: "creature", element: "neutral", set: 2, cost: 90,  st: 50, hp: 45, ab: ["first", "fly"], rarity: "rare" }, // 旧: ペガサス
  { id: "nightmare",    name: "夜叉",       type: "creature", element: "neutral", set: 2, cost: 95,  st: 45, hp: 40, ab: ["magicatk", "first"], rarity: "rare" }, // v23: 白澤(95G magicatk+guard)に劣後→夜襲の居合で攻め型に差別化 // 旧: ナイトメア
  { id: "etherdrake",   name: "白龍", type: "creature", element: "neutral", set: 2, cost: 110, st: 55, hp: 50, ab: ["magicatk", "spellproof"], rarity: "rare" }, // 旧: エーテルドレイク
  { id: "mirrorknight", name: "雲外鏡", type: "creature", element: "neutral", set: 2, cost: 120, st: 40, hp: 55, ab: ["physreflect"], rarity: "legendary" }, // 旧: 鏡騎士ミラーナイト
  { id: "orichalcum",   name: "金剛力士", type: "creature", element: "neutral", set: 2, cost: 130, st: 60, hp: 80, ab: ["armor", "spellproof"], rarity: "legendary" }, // 旧: オリハルコンゴーレム
  { id: "chaoschimera", name: "大鵺",     type: "creature", element: "neutral", set: 2, cost: 140, st: 60, hp: 55, ab: ["double", "lastward"], rarity: "legendary" }, // 旧: カオスキメラ
  // ============================================================
  // v25追加式神（原さん要望）: 「領地レベルに働きかける」希少特性の一群と、加勢・霊力強奪・二形
  // いずれも素のスタッツはコスト相応より控えめ＝特性で戦うカード
  // ============================================================
  { id: "rampartgolem", name: "石垣入道", type: "creature", element: "earth", set: 2, cost: 100, st: 35, hp: 60, ab: ["bulwark"], rarity: "rare" },   // 🏗築城: 守り勝つたびLv+1 // 旧: ラムパートゴーレム
  { id: "scorchworm",   name: "焦土蟲",     type: "creature", element: "fire",  set: 2, cost: 70,  st: 35, hp: 45, ab: ["blight"],  rarity: "uncommon" }, // 🔥焦土: 守備+30の代わりに土地が痩せる // 旧: スコーチワーム
  { id: "siegeram",     name: "城崩しの羊",         type: "creature", element: "earth", set: 2, cost: 80,  st: 45, hp: 40, ab: ["siegebreak"], rarity: "rare" }, // 🐏破城: 侵攻先のLvを削ってから殴る // 旧: シージラム
  { id: "mistrunner",   name: "霧隠れ",     type: "creature", element: "water", set: 2, cost: 60,  st: 25, hp: 30, ab: ["escaper"], rarity: "rare" },    // 💨遁走: 負けても空き地へ逃げる（そのぶん低スタッツ） // 旧: ミストランナー
  { id: "manaeater",    name: "霊喰いの鬼",       type: "creature", element: "fire",  set: 2, cost: 85,  st: 40, hp: 40, ab: ["siphon"],  rarity: "rare" },    // 💸霊力強奪 // 旧: マナイーター
  { id: "bannerbearer", name: "幟持ち天狗", type: "creature", element: "wood",  set: 2, cost: 80,  st: 30, hp: 40, ab: ["cheer"],   rarity: "rare" },    // 📣加勢: 隣接自領に武具の代わり // 旧: 旗手バナーベアラー
  // 二形（hybrid）: 式神としては最弱クラス（無属性＝土地の加護も属性相性も無い）だが、
  // 手札に置いておけば武器／防具としても装備できる＝腐らない万能札。装備した場合は使い切り
  { id: "livingblade",  name: "妖刀",   type: "creature", element: "neutral", set: 2, cost: 75, st: 25, hp: 25, ab: ["hybrid"], asItem: { st: 40, hp: 0 }, // 旧: リビングブレード
    rarity: "rare", desc: "⚔武器としても使える二形。装備すると バトル時 ST+40（使い切り）" },
  { id: "livingshield", name: "盾の付喪神",   type: "creature", element: "neutral", set: 2, cost: 75, st: 15, hp: 35, ab: ["hybrid"], asItem: { st: 0, hp: 40 }, // 旧: リビングシールド
    rarity: "rare", desc: "🛡防具としても使える二形。装備すると バトル時 HP+40（使い切り）" },
  // --- 🏛️建造物（式神のサブタイプ。ST0・不動・バトルで反撃しない据え付けの施設） ---
  { id: "signaltower", name: "狼煙台",     type: "creature", element: "fire",    set: 2, cost: 60,  st: 0, hp: 45, ab: ["immobile", "warfire"],  structure: true, rarity: "uncommon" },
  { id: "greenhouse",  name: "薬師の庭",   type: "creature", element: "wood",    set: 2, cost: 65,  st: 0, hp: 55, ab: ["immobile", "garden"],   structure: true, rarity: "uncommon" }, // 旧: 温室庭園
  { id: "miningtower", name: "採掘櫓",     type: "creature", element: "earth",   set: 2, cost: 75,  st: 0, hp: 55, ab: ["immobile", "mine"],     structure: true, mineGain: 30, rarity: "rare" },
  { id: "lighthouse",  name: "灯台",       type: "creature", element: "water",   set: 2, cost: 60,  st: 0, hp: 50, ab: ["immobile", "harbor"],   structure: true, rarity: "uncommon" },
  { id: "trademarket", name: "交易市場",   type: "creature", element: "neutral", set: 2, cost: 60,  st: 0, hp: 50, ab: ["immobile", "merchant"], structure: true, rarity: "uncommon" },
  { id: "watchtower",  name: "見張り塔",   type: "creature", element: "neutral", set: 2, cost: 70,  st: 0, hp: 60, ab: ["immobile", "beacon"],   structure: true, rarity: "uncommon" },
  { id: "fortress",    name: "大砦",       type: "creature", element: "earth",   set: 2, cost: 100, st: 0, hp: 95, ab: ["immobile", "armor"],    structure: true, rarity: "rare" },
  { id: "cathedral",   name: "大社",     type: "creature", element: "neutral", set: 2, cost: 120, st: 0, hp: 75, ab: ["immobile", "festival"], structure: true, rarity: "legendary" }, // 旧: 大聖堂
  // --- 👑五帝サイクル（300Gの別格レジェンド。各属性の新能力の象徴＝ボス級フィニッシャー） ---
  { id: "ignisking",  name: "炎帝",     type: "creature", element: "fire",    set: 2, cost: 300, st: 120, hp: 100, ab: ["ranged", "lucky"],       rarity: "legendary" }, // 旧: 焔王イグニス
  { id: "sylvanking", name: "翠帝",   type: "creature", element: "wood",    set: 2, cost: 300, st: 95,  hp: 135, ab: ["pack", "capture"],       rarity: "legendary" }, // 旧: 翠王シルヴァン
  { id: "terraking",  name: "地帝",   type: "creature", element: "earth",   set: 2, cost: 300, st: 85,  hp: 155, ab: ["grow", "armor"],         rarity: "legendary" }, // 旧: 岩帝テラガイア
  { id: "nereusking", name: "海帝",     type: "creature", element: "water",   set: 2, cost: 300, st: 105, hp: 125, ab: ["absorb", "magicatk"],    rarity: "legendary" }, // 旧: 海王ネレウス
  { id: "aeonking",   name: "時帝", type: "creature", element: "neutral", set: 2, cost: 300, st: 110, hp: 110, ab: ["first", "spellproof", "fly"], rarity: "legendary" }, // 旧: 時空王アイオーン
  // --- 武器（第二巻） ---
  { id: "shortspear",  name: "手槍",   type: "item", set: 2, cost: 30,  st: 15, hp: 0, desc: "バトル時 ST+15" }, // 旧: ショートスピア
  { id: "flail",       name: "鎖鎌",         type: "item", set: 2, cost: 55,  st: 30, hp: 0, desc: "バトル時 ST+30" }, // 旧: フレイル
  { id: "warhorn",     name: "法螺貝",     type: "item", set: 2, cost: 60,  st: 15, hp: 0, grant: ["pack"], rarity: "uncommon", desc: "ST+15・百鬼を得る（自分の同属性式神1体につきST+5）" }, // 旧: ウォーホーン
  { id: "braveblade",  name: "背水の太刀", type: "item", set: 2, cost: 70,  st: 20, hp: 0, grant: ["lastward"], rarity: "uncommon", desc: "ST+20・背水を得る（HP半分以下でST+25）" }, // 旧: ブレイブブレイド
  { id: "warhammer",   name: "鬼の金棒",   type: "item", set: 2, cost: 80,  st: 45, hp: 0, rarity: "uncommon", desc: "バトル時 ST+45" }, // v23: 85→80G（大鉞(70G+40)からの傾斜を適正化） // 旧: ウォーハンマー
  { id: "hunterbow",   name: "遠矢の大弓",     type: "item", set: 2, cost: 90,  st: 20, hp: 0, grant: ["ranged"], rarity: "rare", desc: "ST+20・遠隔を得る（侵略・侵攻で相手の反撃を受けない）" }, // 旧: ハンターボウ
  { id: "souleater",   name: "血吸い刀",   type: "item", set: 2, cost: 100, st: 30, hp: 0, grant: ["absorb"], rarity: "rare", desc: "ST+30・吸収を得る（与えたダメージの半分だけHP回復）" }, // 旧: ソウルイーター
  { id: "flamberge",   name: "焔形の太刀",   type: "item", set: 2, cost: 115, st: 60, hp: 0, rarity: "rare", desc: "バトル時 ST+60" }, // 旧: フランベルジュ
  { id: "gungnir",     name: "天沼矛",       type: "item", set: 2, cost: 140, st: 50, hp: 0, grant: ["pierce", "first"], rarity: "legendary", desc: "ST+50・破魔と居合を得る（神槍は外れず、誰よりも速い）" }, // 旧: グングニル
  // --- 防具（第二巻） ---
  { id: "buckler",      name: "小盾",       type: "item", set: 2, cost: 30,  st: 0,  hp: 15, desc: "バトル時 HP+15" }, // 旧: バックラー
  { id: "chainmail",    name: "鎖帷子",   type: "item", set: 2, cost: 55,  st: 0,  hp: 30, desc: "バトル時 HP+30" }, // 旧: チェインメイル
  { id: "stonering",    name: "岩の数珠", type: "item", set: 2, cost: 65, st: 0, hp: 20, grant: ["armor"], rarity: "uncommon", desc: "HP+20・硬殻を得る（受けるダメージを常に10軽減）" }, // 旧: 硬殻の指輪ストーンリング
  { id: "spikemail",    name: "棘鎧",   type: "item", set: 2, cost: 75,  st: 0, hp: 25, reflect: 0.3, rarity: "uncommon", desc: "バトル時 HP+25・受けた攻撃ダメージの30%を棘が相手に反射する" }, // v23: 金剛の帯に支配されていた→棘の鎧らしく反射に差別化 // 旧: スパイクメイル
  { id: "crystalarmor", name: "水晶の鎧", type: "item", set: 2, cost: 80, st: 0, hp: 45, rarity: "uncommon", desc: "バトル時 HP+45" }, // v23: 85→80G（大盾(70G+40)からの傾斜を適正化） // 旧: クリスタルアーマー
  { id: "dragonscale",  name: "龍鱗の鎧", type: "item", set: 2, cost: 115, st: 0,  hp: 60, rarity: "rare", desc: "バトル時 HP+60" }, // 旧: ドラゴンスケイル
  { id: "aegisshield",  name: "岩戸の大盾",     type: "item", set: 2, cost: 135, st: 0,  hp: 30, grant: ["physnull"], rarity: "legendary", desc: "HP+30・このバトル中、物理無効を得る（呪力攻撃だけが通る）" }, // 旧: イージスの盾
  // --- 📜呪符（使うと攻撃が「記載ST固定の呪力攻撃」になる。本体STや強襲・属性補正は乗らない） ---
  { id: "scrollice",     name: "氷針の呪符", type: "item", set: 2, cost: 30, st: 0, hp: 0, scroll: 30, rarity: "common", desc: "📜攻撃がST30固定の呪力攻撃になる（本体ST無視・物理無効/反射を貫く）" }, // 旧: アイスニードルの巻物
  { id: "scrollfire",    name: "火弾の呪符", type: "item", set: 2, cost: 50, st: 0, hp: 0, scroll: 45, rarity: "uncommon", desc: "📜攻撃がST45固定の呪力攻撃になる（本体ST無視・物理無効/反射を貫く）" }, // 旧: ファイアボルトの巻物
  { id: "scrollacid",    name: "溶解の呪符",           type: "item", set: 2, cost: 65, st: 0, hp: 0, scroll: 40, grant: ["pierce"], rarity: "uncommon", desc: "📜攻撃がST40固定の呪力攻撃になり、破魔を得る（土地の加護を溶かす）" }, // 旧: 溶解の巻物
  { id: "scrollwind",    name: "風切の呪符", type: "item", set: 2, cost: 70, st: 0, hp: 0, scroll: 40, grant: ["first"], rarity: "uncommon", desc: "📜攻撃がST40固定の呪力攻撃になり、居合を得る（風の刃は誰よりも速い）" }, // 旧: ウィンドカッターの巻物
  { id: "scrolldrain",   name: "魂吸いの呪符", type: "item", set: 2, cost: 75, st: 0, hp: 0, scroll: 35, grant: ["absorb"], rarity: "rare", desc: "📜攻撃がST35固定の呪力攻撃になり、吸収を得る（与えたダメージの半分だけHP回復）" }, // 旧: ドレインソウルの巻物
  { id: "scrollthunder", name: "落雷の呪符", type: "item", set: 2, cost: 80, st: 0, hp: 0, scroll: 60, rarity: "rare", desc: "📜攻撃がST60固定の呪力攻撃になる（本体ST無視・物理無効/反射を貫く）" }, // 旧: サンダーボルトの巻物
  { id: "scrollmirror",  name: "写し身の呪符",         type: "item", set: 2, cost: 60, st: 0, hp: 0, scroll: 1, scrollMirror: true, rarity: "rare", desc: "📜攻撃が「相手の基本STと同じ値」の固定呪力攻撃になる（強敵ほど強い一撃を写し返す）" }, // 旧: 写し身の巻物
  { id: "scrollmeteor",  name: "星降りの呪符", type: "item", set: 2, cost: 110, st: 0, hp: 0, scroll: 75, rarity: "legendary", desc: "📜攻撃がST75固定の呪力攻撃になる（本体ST無視・物理無効/反射を貫く）" }, // 旧: メテオストームの巻物
  // --- 特殊宝具（第二巻） ---
  { id: "calmcharm",     name: "平静のお守り",     type: "item", set: 2, cost: 45,  st: 0,  hp: 15, noCrit: true, rarity: "uncommon", desc: "HP+15・相手の会心の一撃を封じる（豪運持ちにも有効）" },
  { id: "smokebomb",     name: "煙玉",             type: "item", set: 2, cost: 50,  st: 0,  hp: 0,  escape: true, rarity: "uncommon", desc: "【防衛側専用】バトルを行わず土地を明け渡し、式神は手札に戻る（土地レベルは残る＝命あっての物種）" },
  { id: "chainnet",      name: "分銅鎖", type: "item", set: 2, cost: 55, st: 10, hp: 0, grant: ["capture"], rarity: "uncommon", desc: "ST+10・捕縛を得る（防衛で撃退した侵略者を1ターン拘束）" }, // 旧: 拘束鎖チェインネット
  { id: "berserkpotion", name: "荒魂の秘薬", type: "item", set: 2, cost: 60, st: 35, hp: -15, rarity: "uncommon", desc: "バトル時 ST+35 / HP-15（力を絞り出す自傷の劇薬）" }, // 旧: バーサクポーション
  { id: "giantbelt",     name: "金剛の帯", type: "item", set: 2, cost: 70, st: 20, hp: 20, rarity: "uncommon", desc: "バトル時 ST+20 / HP+20" }, // v23: 70Gで合計+50は強すぎた→+40に // 旧: ジャイアントベルト
  { id: "rebirthamulet", name: "転生の護符",       type: "item", set: 2, cost: 70,  st: 0,  hp: 10, grant: ["rebirth"], rarity: "rare", desc: "HP+10・このバトルで倒されても手札に戻る（転生を得る）" },
  { id: "hazecloak",     name: "幻惑の羽衣",     type: "item", set: 2, cost: 90,  st: 0,  hp: 20, stDebuff: 20, rarity: "rare", desc: "HP+20・相手のST-20（最低10。霞んで狙いが定まらない）" }, // 旧: 幻惑のマント
  { id: "duelglove",     name: "決闘の籠手",   type: "item", set: 2, cost: 110, st: 20, hp: 0, grant: ["double"], rarity: "rare", desc: "ST+20・連撃を得る（バトルで続けて2回攻撃）" }, // 旧: 決闘のグローブ
  // ============================================================
  // 第二巻呪術（v20・55種）。noCpu:true はCPUの自動デッキに入れない
  // （AIの発動条件を用意していない／人間の判断が要るカード）
  // ============================================================
  // --- 経済（9種） ---
  { id: "blessfire",  name: "火脈の恵み",   type: "spell", set: 2, cost: 50, spell: "elembless", elem: "fire",  icon: "🔥", desc: "自分の火属性の土地1つにつき +70G" },
  { id: "blesswood",  name: "収穫の恵み",   type: "spell", set: 2, cost: 50, spell: "elembless", elem: "wood",  icon: "🌾", desc: "自分の木属性の土地1つにつき +70G" },
  { id: "blessearth", name: "鉱脈の恵み",   type: "spell", set: 2, cost: 50, spell: "elembless", elem: "earth", icon: "⛏️", desc: "自分の地属性の土地1つにつき +70G" },
  { id: "blesswater", name: "潮流の恵み",   type: "spell", set: 2, cost: 50, spell: "elembless", elem: "water", icon: "🌊", desc: "自分の水属性の土地1つにつき +70G" },
  { id: "goldrush",   name: "千両景気", type: "spell", set: 2, cost: 60, spell: "goldrush", rarity: "uncommon", icon: "💰", desc: "現在の所持霊力の20%を得る（最大250G。富める者はさらに富む）" }, // 旧: ゴールドラッシュ
  { id: "tollpass",   name: "通行手形",     type: "spell", set: 2, cost: 60, spell: "tollpass", rarity: "uncommon", noCpu: true, icon: "📜", desc: "次に敵地で払う通行料1回が無料になる（高額地帯を切り抜ける切符）" },
  { id: "taxcollect", name: "年貢徴収", type: "spell", set: 2, cost: 70, spell: "taxcollect", rarity: "uncommon", icon: "🧾", desc: "相手の所有土地1つにつき30Gを、その持ち主から徴収する" }, // 旧: タックスコレクト
  { id: "cauldron",   name: "錬金大釜",     type: "spell", set: 2, cost: 70, spell: "cauldron", rarity: "uncommon", noCpu: true, icon: "⚗️", desc: "手札を2枚まで選んで捨て、1枚につき+130G（換銭の符の上位）" },
  { id: "pawnshop",   name: "質入れ",       type: "spell", set: 2, cost: 60, spell: "pawnshop", rarity: "uncommon", noCpu: true, icon: "🏦", desc: "自分の土地1つをLv-1し、下がった価値の120%を得る（開墾の符の逆＝土地を現金化）" },
  // --- ドロー・手札（4種） ---
  { id: "foresight",   name: "予知",         type: "spell", set: 2, cost: 30, spell: "foresight", noCpu: true, icon: "🔮", desc: "山札の上3枚を見て、好きな順に並べ替える" },
  { id: "revelation",  name: "天啓",         type: "spell", set: 2, cost: 45, spell: "revelation", icon: "💡", desc: "カードを1枚引き、さらに+50G" },
  { id: "inspiration", name: "文殊の知恵", type: "spell", set: 2, cost: 75, spell: "inspiration", rarity: "uncommon", icon: "✨", desc: "カードを3枚引き、そのあと手札から1枚捨てる" }, // v23: 60→75G（ドロー枠を支配していた） // 旧: インスピレーション
  { id: "gravecall",   name: "墓所の呼び声", type: "spell", set: 2, cost: 90, spell: "gravecall", rarity: "rare", icon: "🪦", desc: "自分の捨て札から2枚まで選んで手札に戻す（反故拾いの上位）" },
  // --- 移動（6種） ---
  { id: "tailwind",   name: "追い風",       type: "spell", set: 2, cost: 35, spell: "tailwind", noCpu: true, icon: "🍃", desc: "次の賽の出目に+2する（倍賽の符の倍化とは加算の順で併用可）" },
  { id: "backstep",   name: "後退り", type: "spell", set: 2, cost: 40, spell: "backstep", rarity: "uncommon", noCpu: true, icon: "↩️", desc: "自分のコマを1〜3マス後ろへ戻す（移動のみ＝マスの効果・鳥居は発動しない。そのあと通常どおり賽で移動）" }, // 旧: バックステップ
  { id: "marchorder", name: "進軍号令",     type: "spell", set: 2, cost: 70, spell: "marchorder", rarity: "uncommon", noCpu: true, icon: "🎺", desc: "このターン、行軍費なしで②式神侵攻を行える（①で行動していても②の権利が残る）" },
  { id: "regroup",    name: "集結",         type: "spell", set: 2, cost: 90, spell: "regroup", rarity: "rare", noCpu: true, icon: "🔀", desc: "自分の式神2体の位置を入れ替える（HP・土地レベルはそのまま）" },
  { id: "posswap",    name: "入れ替えの呪", type: "spell", set: 2, cost: 100, spell: "posswap", rarity: "rare", noCpu: true, icon: "♟️", desc: "相手のコマと自分のコマの位置を入れ替える（マスの効果は発動しない）" }, // 旧: ポジションスワップ
  { id: "timereverse", name: "時流逆転",     type: "spell", set: 2, cost: 55, spell: "reverse", rarity: "uncommon", icon: "🔄", desc: "プレイヤー1人（自分も可）の進行方向を反転させる（v24: 通常は逆走できない——自分に使えば来た道を戻り、相手に使えば高額地帯へ押し返せる）" }, // v24
  { id: "mitosis",     name: "増殖の秘薬",   type: "spell", set: 2, cost: 75, spell: "duplicate", rarity: "rare", icon: "🧪", desc: "自分の場の式神1体を選び、その同名カード1枚を手札に加える（🐺百鬼・🫧分裂・🔁転生と組むコンボの核）" }, // v24
  { id: "deport",     name: "強制送還",     type: "spell", set: 2, cost: 120, spell: "deport", rarity: "rare", icon: "🏰", desc: "相手のコマを本宮へ送り返す（周回はつかない。凱旋間際の相手を押し戻せ）" },
  // --- バトル支援（5種） ---
  { id: "bravery",   name: "決死の覚悟",   type: "spell", set: 2, cost: 40, spell: "bravery", noCpu: true, icon: "🎯", desc: "次の自分のバトルで会心率50%（会心＝ダメージ1.5倍）" },
  { id: "warcry",    name: "鬨の声", type: "spell", set: 2, cost: 50, spell: "warcry", noCpu: true, icon: "📣", desc: "次の自分のバトルで ST+20（侵略でも防衛でも）" }, // 旧: ウォークライ
  { id: "guardwind", name: "護りの風",     type: "spell", set: 2, cost: 50, spell: "guardwind", noCpu: true, icon: "🌬️", desc: "次に防衛する自軍式神の HP+20" },
  { id: "blessing",  name: "言祝ぎ", type: "spell", set: 2, cost: 70, spell: "blessing", rarity: "rare", icon: "🕊️", desc: "自軍式神1体を永続強化: ST/最大HP+10（成長と同じ枠を使い、合計+25まで）" }, // 旧: ブレッシング
  { id: "siege",     name: "攻城の号令",   type: "spell", set: 2, cost: 100, spell: "siege", rarity: "rare", noCpu: true, icon: "⚔️", desc: "このターンの自分の侵略・侵攻バトルで ST+25" },
  // --- 土地（7種） ---
  { id: "highsell",   name: "高値売却",     type: "spell", set: 2, cost: 60, spell: "highsell", rarity: "uncommon", noCpu: true, icon: "💱", desc: "自分の土地1つを価値の130%で売却する（Lv5なら2080G。通常の強制売却は70%。駐留式神は手札に戻る）" }, // v25: 100%→130%（売り時を作る一手として実入りを引き上げ）
  { id: "veinfind",   name: "鉱脈発見",     type: "spell", set: 2, cost: 80, spell: "veinfind", rarity: "rare", icon: "💎", desc: "自分の土地1つに霊力鉱脈を付与: 以後、自分のターン開始時+20G（永続。その土地を失うと消える）" },
  { id: "assimilate", name: "属性同化",     type: "spell", set: 2, cost: 100, spell: "assimilate", rarity: "rare", noCpu: true, icon: "🌀", desc: "自分の土地1つの属性に、隣接する自領すべての属性を合わせる（連鎖の一括組み替え）" },
  { id: "curseland",  name: "祟り地の呪", type: "spell", set: 2, cost: 110, spell: "curseland", rarity: "rare", icon: "🕯️", desc: "敵の土地1つの通行料を半減する（2ラウンド）" }, // 旧: カースランド
  { id: "fortify",    name: "城塞化",       type: "spell", set: 2, cost: 120, spell: "fortify", rarity: "rare", icon: "🏯", desc: "自分の土地1つの「土地の加護」を永続的に2倍にする（属性一致の守り手が鉄壁に）" },
  { id: "grandquake", name: "大山崩しの符", type: "spell", set: 2, cost: 170, spell: "grandquake", rarity: "legendary", icon: "🌋", desc: "敵の土地を2つまで選び、それぞれレベルを1下げる（山崩しの符の広域版）" }, // 旧: グランドクエイク
  { id: "levelshift", name: "レベル移植",   type: "spell", set: 2, cost: 90, spell: "levelshift", rarity: "rare", noCpu: true, icon: "⚖️", desc: "自分の土地1つをLv-1し、別の自分の土地1つをLv+1する（投資の組み替え）" },
  // --- 妨害（10種） ---
  { id: "spy",        name: "間者の術",       type: "spell", set: 2, cost: 45, spell: "spy", noCpu: true, icon: "🕵️", desc: "相手1人の手札をすべて見る" }, // 旧: スパイ
  { id: "cursedice",  name: "呪い賽", type: "spell", set: 2, cost: 60, spell: "cursedice", rarity: "uncommon", icon: "🎲", desc: "相手の次の出目は1〜3になる（言霊の符で4以上を指定していても3に抑え込む）" }, // 旧: 呪いのダイス
  { id: "mudswamp",   name: "泥沼",         type: "spell", set: 2, cost: 80, spell: "mudswamp", rarity: "uncommon", icon: "🟤", desc: "相手の次の移動は出目が半分になる（切り上げ）" },
  { id: "roadblock",  name: "関所札",   type: "spell", set: 2, cost: 70, spell: "roadblock", rarity: "uncommon", fx: true, noCpu: true, icon: "🚧", // 旧: バリケード
    desc: "【盤面】土地1つに2Rの通行封鎖。全プレイヤー（自分も含む）はそのマスへ進入できず、迂回を強いられる（進路を塞ぐ妨害。全方向を塞がれたコマは例外的に通れる）" },
  { id: "whisper",    name: "悪夢の囁き",   type: "spell", set: 2, cost: 85, spell: "whisper", rarity: "rare", icon: "😈", desc: "相手の手札からランダムに1枚捨てさせる" },
  { id: "manaburn",   name: "霊力焼きの呪",   type: "spell", set: 2, cost: 90, spell: "manaburn", rarity: "rare", icon: "🔥", desc: "相手の霊力の20%を消滅させる（奪えない・上限300G。富豪への嫌がらせ）" }, // 旧: マナバーン
  { id: "nullfog",    name: "無力化の霧",   type: "spell", set: 2, cost: 95, spell: "nullfog", rarity: "rare", icon: "🌫️", desc: "敵式神1体の能力をすべて消す（2ラウンド。宝具で得る能力は消えない）" },
  { id: "silencefog", name: "沈黙の霧",     type: "spell", set: 2, cost: 100, spell: "silencefog", rarity: "rare", icon: "🤫", desc: "相手は次の自分のターン、呪術を使えない" },
  { id: "truce",      name: "停戦協定",     type: "spell", set: 2, cost: 110, spell: "truce", rarity: "rare", icon: "🏳️", desc: "2ラウンドの間、全プレイヤーが侵略・侵攻できない（自分も含む＝逃げ切りの時間稼ぎ）" },
  { id: "freezerain", name: "大金縛り", type: "spell", set: 2, cost: 130, spell: "freezerain", rarity: "legendary", icon: "🧊", desc: "相手全員を次のターン1回休みにする（金縛りの全体版。三つ巴で輝く）" }, // 旧: フリーズレイン
  { id: "miragefield", name: "蜃気楼",      type: "spell", set: 2, cost: 75, spell: "miragefield", rarity: "uncommon", icon: "🏜️", desc: "2ラウンドの間、自分の土地が敵の土地対象の呪術（山崩しの符/祟り地の呪等）の対象にならない（式神は対象になる）" },
  // --- 🕯️儀式（8種）: 追加コストとして手札1枚を捧げる ---
  { id: "r_harvest",  name: "豊穣の儀",     type: "spell", set: 2, cost: 80, spell: "r_harvest", ritual: true, rarity: "uncommon", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】+350G" },
  // v25: 豊穣の儀の派生（原さん要望）。1枚あたりの実入りは豊穣の儀より低いが、まとめて捧げれば総額で大きく勝る
  { id: "r_plenty",   name: "潤沢の儀",     type: "spell", set: 2, cost: 90, spell: "r_plenty", ritual: true, rarity: "rare", icon: "🕯️", desc: "【儀式: 手札を1〜3枚まで好きなだけ捧げる】捧げた1枚につき +300G（豊穣の儀は1枚350G＝1枚あたりは割安・枚数でまとめて稼ぐ）" },
  { id: "r_contract", name: "契約の儀",     type: "spell", set: 2, cost: 90, spell: "r_contract", ritual: true, rarity: "rare", noCpu: true, icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】山札から好きなカード1枚を手札に加える（山札は切り直す）" },
  { id: "r_blaze",    name: "猛火の儀",     type: "spell", set: 2, cost: 100, spell: "r_blaze", ritual: true, rarity: "rare", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】敵式神1体に70ダメージ（護法・結界は対象外）" },
  { id: "r_revive",   name: "蘇生の儀",     type: "spell", set: 2, cost: 110, spell: "r_revive", ritual: true, rarity: "rare", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】自分の捨て札の式神1体を、好きな空き地へコスト不要で召喚する" },
  { id: "r_ages",     name: "星霜の儀",     type: "spell", set: 2, cost: 120, spell: "r_ages", ritual: true, rarity: "rare", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】自分の土地1つをLv+2する（Lv4まで）" },
  { id: "r_storm",    name: "嵐の儀",       type: "spell", set: 2, cost: 120, spell: "r_storm", ritual: true, rarity: "legendary", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】敵式神全体に25ダメージ（護法・結界は対象外。倒れたら土地は空き地に）" },
  { id: "r_time",     name: "時の儀",       type: "spell", set: 2, cost: 130, spell: "r_time", ritual: true, rarity: "legendary", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】このターン、①のあとにもう一度賽を振って移動し、①を行う" },
  { id: "r_purify",   name: "浄化の儀",     type: "spell", set: 2, cost: 80, spell: "r_purify", ritual: true, rarity: "uncommon", icon: "🕯️", desc: "【儀式: 手札1枚を捧げる】盤面の時限効果（結界・罠・霧・呪いなど）をすべて解除し、自軍式神を全回復する" },
  // --- 盤面エフェクト（6種・2ラウンドの時限効果） ---
  { id: "fx_market",    name: "市場開放",     type: "spell", set: 2, cost: 90, spell: "fx_market", fx: true, rarity: "uncommon", icon: "🏪", desc: "【盤面】2Rの間、カードマスで2枚ドロー（全員）" },
  { id: "fx_bud",       name: "春の芽吹き",   type: "spell", set: 2, cost: 90, spell: "fx_bud", fx: true, rarity: "rare", icon: "🌸", desc: "【盤面】2Rの間、自軍式神は自分のターン開始時HP+15回復する" },
  { id: "fx_war",       name: "戦火の世",     type: "spell", set: 2, cost: 110, spell: "fx_war", fx: true, rarity: "rare", icon: "🔥", desc: "【盤面】2Rの間、侵略・侵攻バトルの攻め側ST+20（全員＝攻めが強い世界に）" },
  { id: "fx_manastorm", name: "霊力嵐",       type: "spell", set: 2, cost: 120, spell: "fx_manastorm", fx: true, rarity: "rare", icon: "⚡", desc: "【盤面】2Rの間、すべての通行料1.5倍（全員＝土地持ちが得をする嵐）" }, // 旧: 魔力嵐
  { id: "fx_silence",   name: "静寂のとばり", type: "spell", set: 2, cost: 100, spell: "fx_silence", fx: true, rarity: "rare", icon: "🌙", desc: "【盤面】2Rの間、対象を指定する呪術（天火の符/大祓の符/奪霊の符等）を全員使えない" },
  { id: "fx_goddess",   name: "神域の加護",   type: "spell", set: 2, cost: 130, spell: "fx_goddess", fx: true, rarity: "legendary", icon: "👼", desc: "【盤面】2Rの間、自分の土地の加護が2倍＋防衛の援護ST+10" }, // 旧: 女神の加護
];

const CARD_BY_ID = Object.fromEntries(CARD_DB.map(c => [c.id, c]));

// ---------- 二形（hybrid・v25） ----------
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
// 属性は4種なので、主属性式神各6枚（2属性＝12）、副属性各3枚（残り2属性＝6）、
// 呪術6枚、宝具6枚＝合計30枚。biasElement を指定すると主属性の1つ目が固定される（ステージのCPU用）
// maxCost: このコストを超えるカードは入れない（弱い難易度のCPUほど低コスト＝弱いデッキになる）。
//   式神が枯れないよう、maxCost で候補が空になった場合はコスト昇順で最も安いものにフォールバックする。
function buildDeck(biasElement = null, maxCost = Infinity) {
  // 属性枠は土地属性の4種のみ（無属性式神はレア以上の特別枠＝自動デッキには入れず、構築デッキで使う）
  let elems = shuffle(LAND_ELEMENTS.slice());
  if (biasElement) elems = [biasElement, ...elems.filter(e => e !== biasElement)];
  const main = elems.slice(0, 2), sub = elems.slice(2); // main=2属性 / sub=残り2属性
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
  sub.forEach(e => pickType(c => c.type === "creature" && !c.structure && c.element === e, 3));
  pickType(c => c.type === "spell" && !c.noCpu, 6);
  pickType(c => c.type === "item", 6);
  return shuffle(deck);
}
