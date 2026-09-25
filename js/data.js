// ============================================================
// data.js — 式神絵巻「花札百鬼祓い」のデータ一式
//   札（48枚）・役・月・式神・呪符・詠み札・神器・妖・陰陽師・物語
//   ロジックは score.js（採点）と run.js（進行）。ここは「何があるか」だけを書く。
//   ※ 式神の効果（fx）は score.js が用意する ctx を通じて数値を足し引きする小さな関数。
// ============================================================
"use strict";

// ---------- 月（十二か月＝十二段の絵巻） ----------
// season: 旧暦どおり 1〜3月=春 / 4〜6月=夏 / 7〜9月=秋 / 10〜12月=冬
const MONTHS = [
  null,
  { n: 1,  plant: "松",   wa: "睦月",   season: "春", yomi: "むつき",   color: "#2f6b2d" },
  { n: 2,  plant: "梅",   wa: "如月",   season: "春", yomi: "きさらぎ", color: "#c8322a" },
  { n: 3,  plant: "桜",   wa: "弥生",   season: "春", yomi: "やよい",   color: "#e57a93" },
  { n: 4,  plant: "藤",   wa: "卯月",   season: "夏", yomi: "うづき",   color: "#7a4fa3" },
  { n: 5,  plant: "菖蒲", wa: "皐月",   season: "夏", yomi: "さつき",   color: "#5a4fa8" },
  { n: 6,  plant: "牡丹", wa: "水無月", season: "夏", yomi: "みなづき", color: "#b8283f" },
  { n: 7,  plant: "萩",   wa: "文月",   season: "秋", yomi: "ふみづき", color: "#a8326e" },
  { n: 8,  plant: "芒",   wa: "葉月",   season: "秋", yomi: "はづき",   color: "#6b6b6b" },
  { n: 9,  plant: "菊",   wa: "長月",   season: "秋", yomi: "ながつき", color: "#d9a531" },
  { n: 10, plant: "紅葉", wa: "神無月", season: "冬", yomi: "かんなづき", color: "#d2451e" },
  { n: 11, plant: "柳",   wa: "霜月",   season: "冬", yomi: "しもつき", color: "#3f7f5a" },
  { n: 12, plant: "桐",   wa: "師走",   season: "冬", yomi: "しわす",   color: "#5c8a3a" },
];
const KANSUJI = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];

// ---------- 札の種類 ----------
const TYPES = {
  hikari: { name: "光",   short: "光", bun: 20, rank: 4, color: "#d9a531" },
  tane:   { name: "種",   short: "種", bun: 10, rank: 3, color: "#5c9b3a" },
  tan:    { name: "短冊", short: "短", bun: 5,  rank: 2, color: "#c8322a" },
  kasu:   { name: "カス", short: "カ", bun: 1,  rank: 1, color: "#8a7a60" },
};

// ---------- 特殊な絵柄（出来役の判定に使う） ----------
const SPECIALS = {
  tsuru:      "松に鶴",
  maku:       "桜に幕",
  tsuki:      "芒に月",
  ame:        "柳に小野道風",
  houou:      "桐に鳳凰",
  uguisu:     "梅に鶯",
  hototogisu: "藤に不如帰",
  yatsuhashi: "菖蒲に八橋",
  chou:       "牡丹に蝶",
  inoshishi:  "萩に猪",
  kari:       "芒に雁",
  sakazuki:   "菊に盃",
  shika:      "紅葉に鹿",
  tsubame:    "柳に燕",
  akatan:     "赤短",
  aotan:      "青短",
  tan:        "短冊",
  kaminari:   "柳に雷",
};

// ---------- 48枚（八八花の伝統構成） ----------
const BASE_DECK = (() => {
  const d = [];
  const add = (m, t, sp, v = 0) => d.push({ m, t, sp, v });
  add(1, "hikari", "tsuru"); add(1, "tan", "akatan"); add(1, "kasu", undefined, 0); add(1, "kasu", undefined, 1);
  add(2, "tane", "uguisu"); add(2, "tan", "akatan"); add(2, "kasu", undefined, 0); add(2, "kasu", undefined, 1);
  add(3, "hikari", "maku"); add(3, "tan", "akatan"); add(3, "kasu", undefined, 0); add(3, "kasu", undefined, 1);
  add(4, "tane", "hototogisu"); add(4, "tan", "tan"); add(4, "kasu", undefined, 0); add(4, "kasu", undefined, 1);
  add(5, "tane", "yatsuhashi"); add(5, "tan", "tan"); add(5, "kasu", undefined, 0); add(5, "kasu", undefined, 1);
  add(6, "tane", "chou"); add(6, "tan", "aotan"); add(6, "kasu", undefined, 0); add(6, "kasu", undefined, 1);
  add(7, "tane", "inoshishi"); add(7, "tan", "tan"); add(7, "kasu", undefined, 0); add(7, "kasu", undefined, 1);
  add(8, "hikari", "tsuki"); add(8, "tane", "kari"); add(8, "kasu", undefined, 0); add(8, "kasu", undefined, 1);
  add(9, "tane", "sakazuki"); add(9, "tan", "aotan"); add(9, "kasu", undefined, 0); add(9, "kasu", undefined, 1);
  add(10, "tane", "shika"); add(10, "tan", "aotan"); add(10, "kasu", undefined, 0); add(10, "kasu", undefined, 1);
  add(11, "hikari", "ame"); add(11, "tane", "tsubame"); add(11, "tan", "tan"); add(11, "kasu", "kaminari");
  add(12, "hikari", "houou"); add(12, "kasu", undefined, 0); add(12, "kasu", undefined, 1); add(12, "kasu", undefined, 2);
  return d;
})();

// 札の名前（表示用）
function cardName(c) {
  const mo = MONTHS[c.m];
  if (c.sp && c.sp !== "tan" && c.sp !== "akatan" && c.sp !== "aotan") {
    // 絵柄の名前は「本来の月」の名前。月送りで月が変わった札は「〇〇（△月）」
    return SPECIALS[c.sp] + (SPECIAL_MONTH[c.sp] !== c.m ? `（${mo.plant}）` : "");
  }
  if (c.sp === "akatan") return `${mo.plant}の赤短`;
  if (c.sp === "aotan") return `${mo.plant}の青短`;
  return `${mo.plant}の${TYPES[c.t].name}`;
}
const SPECIAL_MONTH = { tsuru: 1, maku: 3, tsuki: 8, ame: 11, houou: 12, uguisu: 2, hototogisu: 4, yatsuhashi: 5,
  chou: 6, inoshishi: 7, kari: 8, sakazuki: 9, shika: 10, tsubame: 11, kaminari: 11 };

// ---------- 札の加工（呪符で付く） ----------
const ENH = {
  kin:    { name: "金箔",   desc: "数えられると 倍+5" },
  kira:   { name: "雲母摺", desc: "数えられると 文+40" },
  mamori: { name: "護り",   desc: "打たずに手札に残すと 倍×1.5" },
  usurai: { name: "薄氷",   desc: "数えられると 倍×2。打つと1/4で割れて消える" },
};
const SEAL = {
  shuin: { name: "朱印", desc: "数えられるとき、もう一度数える" },
};

// ---------- 役 ----------
// cat: month（月の役：最も高い1つ）/ sorou（揃い）/ deki（出来役：成立したものすべて）
// lv: 詠み札1段ごとの上がり幅
const YAKU = {
  // 月の役
  sufuda:    { name: "素札",       cat: "month", bun: 5,   bai: 1,  lv: [10, 1], desc: "役なし。いちばん文の高い札1枚だけを数える" },
  awase:     { name: "合わせ",     cat: "month", bun: 10,  bai: 2,  lv: [15, 1], desc: "同じ月の札が2枚" },
  futaawase: { name: "二つ合わせ", cat: "month", bun: 20,  bai: 2,  lv: [20, 1], desc: "合わせが2組" },
  sanbon:    { name: "三本",       cat: "month", bun: 30,  bai: 3,  lv: [20, 2], desc: "同じ月の札が3枚" },
  nagare:    { name: "月流れ",     cat: "month", bun: 30,  bai: 3,  lv: [25, 2], desc: "5か月続きの札5枚（師走→睦月もつながる）" },
  oyako:     { name: "三本合わせ", cat: "month", bun: 40,  bai: 4,  lv: [25, 2], desc: "三本と合わせを同時に" },
  teshi:     { name: "手四",       cat: "month", bun: 60,  bai: 7,  lv: [30, 3], desc: "同じ月の札が4枚" },
  gohon:     { name: "五本",       cat: "month", bun: 120, bai: 12, lv: [35, 3], desc: "同じ月の札が5枚（写しの札でしか作れない）", hidden: true },
  // 揃い（5枚すべて同じ種類）
  kasuzoroi: { name: "カス揃い",   cat: "sorou", bun: 20,  bai: 3,  lv: [15, 2], desc: "5枚すべてカス" },
  tanzoroi:  { name: "短冊揃い",   cat: "sorou", bun: 35,  bai: 4,  lv: [20, 2], desc: "5枚すべて短冊" },
  tanezoroi: { name: "種揃い",     cat: "sorou", bun: 45,  bai: 5,  lv: [25, 3], desc: "5枚すべて種" },
  // 出来役（成立したものはすべて重なる）
  hanami:    { name: "花見酒",     cat: "deki", bun: 30,  bai: 3,  lv: [20, 2], desc: "桜に幕＋菊に盃" },
  tsukimi:   { name: "月見酒",     cat: "deki", bun: 30,  bai: 3,  lv: [20, 2], desc: "芒に月＋菊に盃" },
  sugawara:  { name: "表菅原",     cat: "deki", bun: 50,  bai: 4,  lv: [25, 2], desc: "松に鶴＋梅に鶯＋桜に幕" },
  akatan:    { name: "赤短",       cat: "deki", bun: 50,  bai: 4,  lv: [25, 2], desc: "赤短（歌入りの赤い短冊）3か月ぶん" },
  aotan:     { name: "青短",       cat: "deki", bun: 50,  bai: 4,  lv: [25, 2], desc: "青短（藍の短冊）3か月ぶん" },
  inoshikacho:{ name: "猪鹿蝶",    cat: "deki", bun: 60,  bai: 5,  lv: [30, 3], desc: "萩に猪＋紅葉に鹿＋牡丹に蝶" },
  sankou:    { name: "三光",       cat: "deki", bun: 50,  bai: 5,  lv: [30, 3], desc: "柳（雨）以外の光が3枚" },
  ameshikou: { name: "雨四光",     cat: "deki", bun: 70,  bai: 6,  lv: [35, 3], desc: "柳（雨）を含む光が4枚" },
  shikou:    { name: "四光",       cat: "deki", bun: 80,  bai: 8,  lv: [40, 4], desc: "柳（雨）以外の光が4枚" },
  gokou:     { name: "五光",       cat: "deki", bun: 150, bai: 15, lv: [50, 5], desc: "光が5枚" },
};
const YAKU_ORDER = ["sufuda", "awase", "futaawase", "sanbon", "nagare", "oyako", "teshi", "gohon",
  "kasuzoroi", "tanzoroi", "tanezoroi",
  "hanami", "tsukimi", "sugawara", "akatan", "aotan", "inoshikacho", "sankou", "ameshikou", "shikou", "gokou"];

// ---------- 詠み札（百人一首。役の段位を上げる） ----------
// いずれも千年前の歌（パブリックドメイン）。役の意味に寄り添う歌を選んだ。
const YOMI = {
  sufuda:     { poet: "天智天皇",   uta: "秋の田の かりほの庵の 苫をあらみ わが衣手は 露にぬれつつ" },
  awase:      { poet: "紫式部",     uta: "めぐり逢ひて 見しやそれとも わかぬ間に 雲がくれにし 夜半の月かな" },
  futaawase:  { poet: "崇徳院",     uta: "瀬をはやみ 岩にせかるる 滝川の われても末に 逢はむとぞ思ふ" },
  sanbon:     { poet: "中納言兼輔", uta: "みかの原 わきて流るる いづみ川 いつ見きとてか 恋しかるらむ" },
  nagare:     { poet: "在原業平",   uta: "ちはやぶる 神代もきかず 竜田川 からくれなゐに 水くくるとは" },
  oyako:      { poet: "蝉丸",       uta: "これやこの 行くも帰るも 別れては 知るも知らぬも 逢坂の関" },
  teshi:      { poet: "山部赤人",   uta: "田子の浦に うち出でてみれば 白妙の 富士の高嶺に 雪は降りつつ" },
  gohon:      { poet: "小式部内侍", uta: "大江山 いく野の道の 遠ければ まだふみもみず 天の橋立" },
  kasuzoroi:  { poet: "喜撰法師",   uta: "わが庵は 都のたつみ しかぞすむ 世をうぢ山と 人はいふなり" },
  tanzoroi:   { poet: "小野小町",   uta: "花の色は うつりにけりな いたづらに わが身世にふる ながめせしまに" },
  tanezoroi:  { poet: "後徳大寺左大臣", uta: "ほととぎす 鳴きつる方を ながむれば ただ有明の 月ぞ残れる" },
  hanami:     { poet: "紀友則",     uta: "ひさかたの 光のどけき 春の日に しづ心なく 花の散るらむ" },
  tsukimi:    { poet: "大江千里",   uta: "月見れば 千々にものこそ 悲しけれ わが身ひとつの 秋にはあらねど" },
  sugawara:   { poet: "菅家",       uta: "このたびは 幣もとりあへず 手向山 紅葉の錦 神のまにまに" },
  akatan:     { poet: "伊勢大輔",   uta: "いにしへの 奈良の都の 八重桜 けふ九重に にほひぬるかな" },
  aotan:      { poet: "能因法師",   uta: "嵐吹く 三室の山の もみぢ葉は 竜田の川の 錦なりけり" },
  inoshikacho:{ poet: "猿丸大夫",   uta: "奥山に 紅葉踏み分け 鳴く鹿の 声きく時ぞ 秋は悲しき" },
  sankou:     { poet: "阿倍仲麻呂", uta: "天の原 ふりさけ見れば 春日なる 三笠の山に 出でし月かも" },
  ameshikou:  { poet: "坂上是則",   uta: "朝ぼらけ 有明の月と 見るまでに 吉野の里に 降れる白雪" },
  shikou:     { poet: "参議篁",     uta: "わたの原 八十島かけて 漕ぎ出でぬと 人には告げよ 海人の釣舟" },
  gokou:      { poet: "僧正遍昭",   uta: "天つ風 雲の通ひ路 吹きとぢよ をとめの姿 しばしとどめむ" },
};

// ---------- 式神（ジョーカー） ----------
// rar: 1並 2良 3稀 4極 / cost: 銭 / text: 効果の説明（短く） / lore: 人となり（図鑑とタップ時の台詞）
// fx: 採点・進行のフック（score.js / run.js が呼ぶ）
//   onCard(ctx, card, me)  … 数えられた札1枚ごと（札自身の文・加工の直後）
//   onHeld(ctx, card, me)  … 手札に残した札1枚ごと
//   onScore(ctx, me)       … 札を数え終えたあと（左の式神から順に）
//   onPlay(run, info, me)  … 打った直後・採点の前（成長型の数え上げ）
//   onDiscard(run, cards, me) / onRoundStart(run, me) / onRoundEnd(run, me) → 銭を返せる
//   passive: { handSize, hands, discards, interestCap, slots }
const RAR = [null, { name: "並", color: "#b9ad93" }, { name: "良", color: "#6fa8d6" }, { name: "稀", color: "#e57a93" }, { name: "極", color: "#ffd76a" }];

const SHIKI = [
  // ===== 並 =====
  { id: "kamihito", name: "紙人形", yomi: "かみひとがた", rar: 1, cost: 3,
    text: "倍+4",
    lore: "陰陽師がはじめに折る式神。まっすぐで、少し頼りない。「いっしょに がんばろうね」",
    fx: { onScore(ctx) { ctx.addBai(4); } } },
  { id: "kooni", name: "小鬼", yomi: "こおに", rar: 1, cost: 4,
    text: "同じ月の札が2枚以上ある打ちで 倍+8",
    lore: "角が片方しか生えていない。数をそろえるのが大好き。「ふたつ そろった！」",
    fx: { onScore(ctx) { if (ctx.maxSameMonth >= 2) ctx.addBai(8); } } },
  { id: "kappa", name: "河童", yomi: "かっぱ", rar: 1, cost: 4,
    text: "同じ月の札が3枚以上ある打ちで 倍+12",
    lore: "皿の水が三杯分たまると機嫌がいい。胡瓜で買収できる。",
    fx: { onScore(ctx) { if (ctx.maxSameMonth >= 3) ctx.addBai(12); } } },
  { id: "kamaitachi", name: "鎌鼬", yomi: "かまいたち", rar: 1, cost: 4,
    text: "月流れを含む打ちで 倍+12",
    lore: "三匹で一組のつむじ風。季節を駆け抜けるのが速すぎて、姿を見た者はいない。",
    fx: { onScore(ctx) { if (ctx.has("nagare")) ctx.addBai(12); } } },
  { id: "karakasa", name: "からかさ小僧", yomi: "からかさこぞう", rar: 1, cost: 4,
    text: "揃い（カス・短冊・種）を含む打ちで 倍+10",
    lore: "一本足の古傘。同じ柄が並ぶと、うれしくて跳ねまわる。",
    fx: { onScore(ctx) { if (ctx.hasCat("sorou")) ctx.addBai(10); } } },
  { id: "ittan", name: "一反木綿", yomi: "いったんもめん", rar: 1, cost: 5,
    text: "短冊が数えられるたび 倍+3",
    lore: "ひらひらと夜空を泳ぐ白い布。同じ布もの（短冊）を見ると力を貸す。",
    fx: { onCard(ctx, c) { if (c.t === "tan") ctx.addBai(3); } } },
  { id: "kitsunebi", name: "狐火", yomi: "きつねび", rar: 1, cost: 5,
    text: "光が数えられるたび 倍+6",
    lore: "野に連なる青白い灯。光る札に寄り添って、いっそう明るく燃える。",
    fx: { onCard(ctx, c) { if (c.t === "hikari") ctx.addBai(6); } } },
  { id: "inugami", name: "犬神", yomi: "いぬがみ", rar: 1, cost: 5,
    text: "種が数えられるたび 倍+4",
    lore: "けものの札（種）の匂いをかぎ分ける忠犬。主人には甘い。",
    fx: { onCard(ctx, c) { if (c.t === "tane") ctx.addBai(4); } } },
  { id: "tsukumo", name: "付喪神", yomi: "つくもがみ", rar: 1, cost: 4,
    text: "カスが数えられるたび 文+10",
    lore: "百年使われた道具に宿る魂。「カスにも魂はあるのです」",
    fx: { onCard(ctx, c) { if (c.t === "kasu") ctx.addBun(10); } } },
  { id: "tofu", name: "豆腐小僧", yomi: "とうふこぞう", rar: 1, cost: 5,
    text: "山札の残り1枚につき 文+2",
    lore: "豆腐を載せた盆を持って、ただ立っている。なぜか山札の残りを数えている。",
    fx: { onScore(ctx) { ctx.addBun(2 * ctx.round.draw.length); } } },
  { id: "zashiki", name: "座敷童子", yomi: "ざしきわらし", rar: 1, cost: 5,
    text: "祓いが終わるたび 銭+3",
    lore: "居ついた家を富ませる童子。あなたの懐にも住みついた。",
    fx: { onRoundEnd() { return 3; } } },
  { id: "maneki", name: "招き猫", yomi: "まねきねこ", rar: 1, cost: 5,
    text: "持ち銭1につき 文+2",
    lore: "右手で銭を、左手で客を招く。貯めこむほど張り切る。",
    fx: { onScore(ctx) { ctx.addBun(2 * Math.max(0, ctx.run.zeni)); } } },
  { id: "chochin", name: "提灯お化け", yomi: "ちょうちんおばけ", rar: 1, cost: 4,
    text: "その祓いの最後の打ちで 倍+20",
    lore: "破れ提灯のひとつ目。いよいよ後が無いときに、ぼうっと燃え上がる。",
    fx: { onScore(ctx) { if (ctx.round.hands === 0) ctx.addBai(20); } } },
  { id: "makura", name: "枕返し", yomi: "まくらがえし", rar: 1, cost: 5,
    text: "残りの流し1回につき 文+30",
    lore: "寝ている間に枕をひっくり返す。流さずに我慢するほど喜ぶ。",
    fx: { onScore(ctx) { ctx.addBun(30 * ctx.round.discards); } } },
  { id: "nekomata", name: "猫又", yomi: "ねこまた", rar: 1, cost: 5,
    text: "3枚以下で打つと 倍+18",
    lore: "尾が二つに裂けた老猫。少ない手数で決めるのが粋だと言う。",
    fx: { onScore(ctx) { if (ctx.played.length <= 3) ctx.addBai(18); } } },
  { id: "amanojaku", name: "天邪鬼", yomi: "あまのじゃく", rar: 1, cost: 4,
    text: "倍+0〜22（毎回でたらめ）",
    lore: "何でも逆を言う小鬼。当てにすると外れ、忘れた頃に大当たりする。",
    fx: { onScore(ctx) { ctx.addBai(ctx.rng.int(0, 22)); } } },
  { id: "kodama", name: "木霊", yomi: "こだま", rar: 1, cost: 5,
    text: "流した札1枚ごとに、ずっと 文+2（いま文+{n}）",
    lore: "山の古木に宿る声。流された札の声を覚えていて、少しずつ大きくなる。",
    init: { n: 0 }, fmt: (me) => ({ n: me.data.n * 2 }),
    fx: { onDiscard(run, cards, me) { me.data.n += cards.length; },
          onScore(ctx, me) { if (me.data.n) ctx.addBun(me.data.n * 2); } } },
  { id: "onibi", name: "鬼火", yomi: "おにび", rar: 1, cost: 4,
    text: "旬の札が数えられるたび 倍+6",
    lore: "季節の変わり目に灯る火。いま盛りの花札を見つけると勢いづく。",
    fx: { onCard(ctx, c) { if (c.m === ctx.month) ctx.addBai(6); } } },
  { id: "sunekosuri", name: "すねこすり", yomi: "すねこすり", rar: 1, cost: 5,
    text: "打つたびに、ずっと 倍+1（いま倍+{n}）",
    lore: "足もとにすり寄ってくる毛玉。打つたびに少しずつ懐いて、強くなる。",
    init: { n: 0 }, fmt: (me) => ({ n: me.data.n }),
    fx: { onPlay(run, info, me) { me.data.n += 1; },
          onScore(ctx, me) { if (me.data.n) ctx.addBai(me.data.n); } } },
  { id: "betobeto", name: "べとべとさん", yomi: "べとべとさん", rar: 1, cost: 4,
    text: "5枚で打つたびに、ずっと 文+8（いま文+{n}）",
    lore: "夜道でうしろをついてくる足音。「お先にどうぞ」と言うと先に行く。",
    init: { n: 0 }, fmt: (me) => ({ n: me.data.n }),
    fx: { onPlay(run, info, me) { if (info.played.length === 5) me.data.n += 8; },
          onScore(ctx, me) { if (me.data.n) ctx.addBun(me.data.n); } } },
  { id: "karasutengu", name: "烏天狗", yomi: "からすてんぐ", rar: 1, cost: 5,
    text: "流しが残っていないとき 倍+15",
    lore: "山伏姿の烏。退路を断った者にだけ、剣の技を教える。",
    fx: { onScore(ctx) { if (ctx.round.discards === 0) ctx.addBai(15); } } },
  { id: "bakedanuki", name: "化け狸", yomi: "ばけだぬき", rar: 1, cost: 4,
    text: "祓いが終わるたび、売値が+3（いま売値{n}銭）",
    lore: "葉っぱを頭に載せて小判に化ける。売るときに化けの皮がはがれる……はず。",
    init: { n: 0 }, fmt: (me, run) => ({ n: sellPrice(me) }),
    fx: { onRoundEnd(run, me) { me.data.sellBonus = (me.data.sellBonus || 0) + 3; return 0; } } },
  // 絆：阿吽の狛犬（ペア）
  { id: "a_komainu", name: "狛犬・阿", yomi: "こまいぬ・あ", rar: 1, cost: 4, bond: "komainu",
    text: "倍+6。狛犬・吽がいれば さらに 倍×1.5",
    lore: "口を開けた社の守り。「あ」と始める。相方の「うん」を待っている。",
    fx: { onScore(ctx) { ctx.addBai(6); if (ctx.hasShiki("un_komainu")) ctx.mulBai(1.5, "阿吽"); } } },
  { id: "un_komainu", name: "狛犬・吽", yomi: "こまいぬ・うん", rar: 1, cost: 4, bond: "komainu",
    text: "文+30。狛犬・阿がいれば さらに 倍×1.5",
    lore: "口を閉じた社の守り。「うん」と終わる。二匹そろって、はじめて一つの言葉になる。",
    fx: { onScore(ctx) { ctx.addBun(30); if (ctx.hasShiki("a_komainu")) ctx.mulBai(1.5, "阿吽"); } } },
  // 絆：三猿（トリオ）
  { id: "mizaru", name: "見ざる", yomi: "みざる", rar: 1, cost: 3, bond: "sanen",
    text: "倍+3。三猿がそろえば 倍×1.5",
    lore: "両目をふさいだ猿。悪いものは見ない。三匹そろうと、何かが起きる。",
    fx: { onScore(ctx) { ctx.addBai(3); if (ctx.sanen()) ctx.mulBai(1.5, "三猿"); } } },
  { id: "kikazaru", name: "聞かざる", yomi: "きかざる", rar: 1, cost: 3, bond: "sanen",
    text: "倍+3。三猿がそろえば 倍×1.5",
    lore: "両耳をふさいだ猿。悪いことは聞かない。",
    fx: { onScore(ctx) { ctx.addBai(3); if (ctx.sanen()) ctx.mulBai(1.5, "三猿"); } } },
  { id: "iwazaru", name: "言わざる", yomi: "いわざる", rar: 1, cost: 3, bond: "sanen",
    text: "倍+3。三猿がそろえば 倍×1.5",
    lore: "口をふさいだ猿。悪いことは言わない。……たまに言いたそうにしている。",
    fx: { onScore(ctx) { ctx.addBai(3); if (ctx.sanen()) ctx.mulBai(1.5, "三猿"); } } },

  // ===== 良 =====
  { id: "yukionna", name: "雪女", yomi: "ゆきおんな", rar: 2, cost: 7,
    text: "打たずに手札に残した光1枚ごとに 倍×1.5",
    lore: "吹雪の夜にだけ現れる白い女。光を胸に抱いて離さない者に、力を貸す。",
    fx: { onHeld(ctx, c) { if (c.t === "hikari") ctx.mulBai(1.5); } } },
  { id: "tengu", name: "天狗", yomi: "てんぐ", rar: 2, cost: 7,
    text: "月流れを含む打ちで 倍×2.5",
    lore: "鞍馬の山を一息に越える大天狗の弟子。流れるような一手を好む。",
    fx: { onScore(ctx) { if (ctx.has("nagare")) ctx.mulBai(2.5); } } },
  { id: "gama", name: "大蝦蟇", yomi: "おおがま", rar: 2, cost: 7,
    text: "同じ月の札が3枚以上ある打ちで 倍×2",
    lore: "妖術使いの乗る大がえる。重ねて打つ手にどっしりと乗る。",
    fx: { onScore(ctx) { if (ctx.maxSameMonth >= 3) ctx.mulBai(2); } } },
  { id: "rokurokubi", name: "ろくろ首", yomi: "ろくろくび", rar: 2, cost: 6,
    text: "手札+1",
    lore: "首をのばして山札をのぞく。一枚ぶん、手が遠くまで届く。",
    passive: { handSize: 1 }, fx: {} },
  { id: "nurikabe", name: "塗壁", yomi: "ぬりかべ", rar: 2, cost: 6,
    text: "打ち+1、流し-1",
    lore: "夜道に立ちふさがる見えない壁。逃げ道はふさぐが、踏ん張りはきく。",
    passive: { hands: 1, discards: -1 }, fx: {} },
  { id: "dodomeki", name: "百々目鬼", yomi: "どどめき", rar: 2, cost: 6,
    text: "役に関わらない札も、打った札はすべて数える",
    lore: "腕に百の目を持つ女鬼。どんな札も見逃さない。",
    fx: {}, flag: "splash" },
  { id: "shoujou", name: "猩々", yomi: "しょうじょう", rar: 2, cost: 7,
    text: "菊に盃が数えられると 倍×3",
    lore: "赤い毛の酒好きの精。盃を見ると陽気に舞いはじめる。",
    fx: { onCard(ctx, c) { if (c.sp === "sakazuki") ctx.mulBai(3); } } },
  { id: "yamagami", name: "山の神", yomi: "やまのかみ", rar: 2, cost: 7,
    text: "猪鹿蝶を含む打ちで 倍×3",
    lore: "猪と鹿と蝶を従える山の主。三つの獣がそろうと、山がどよめく。",
    fx: { onScore(ctx) { if (ctx.has("inoshikacho")) ctx.mulBai(3); } } },
  { id: "fuguruma", name: "文車妖妃", yomi: "ふぐるまようひ", rar: 2, cost: 7,
    text: "赤短か青短を含む打ちで 倍×3",
    lore: "読まれなかった恋文から生まれた姫。歌の短冊を集めては、ひとり読みふける。",
    fx: { onScore(ctx) { if (ctx.has("akatan") || ctx.has("aotan")) ctx.mulBai(3); } } },
  { id: "jorogumo", name: "絡新婦", yomi: "じょろうぐも", rar: 2, cost: 6,
    text: "カス揃いを打つたびに、ずっと 倍+3（いま倍+{n}）",
    lore: "滝つぼで糸を紡ぐ女郎蜘蛛。ありふれた札を絹に変える。",
    init: { n: 0 }, fmt: (me) => ({ n: me.data.n }),
    fx: { onPlay(run, info, me) { if (info.yakuKeys.includes("kasuzoroi")) me.data.n += 3; },
          onScore(ctx, me) { if (me.data.n) ctx.addBai(me.data.n); } } },
  { id: "kanedama", name: "金霊", yomi: "かねだま", rar: 2, cost: 6,
    text: "利子の上限が 5→10銭 になる",
    lore: "金気が満ちた家に転がりこむ光る玉。貯めるほど、さらに貯まる。",
    passive: { interestCap: 5 }, fx: {} },
  { id: "binbogami", name: "貧乏神", yomi: "びんぼうがみ", rar: 2, cost: 5,
    text: "持ち銭が4以下なら 倍×2.5",
    lore: "うちわを持った痩せた神。貧しいほどに機嫌がよく、なぜか力を貸してくれる。",
    fx: { onScore(ctx) { if (ctx.run.zeni <= 4) ctx.mulBai(2.5); } } },
  { id: "raijuu", name: "雷獣", yomi: "らいじゅう", rar: 2, cost: 6,
    text: "5枚で打つと、数えた札のうち1枚に金箔を貼る",
    lore: "雷とともに落ちてくる小さな獣。触れた札に金の焦げ跡を残していく。",
    fx: { onPlay(run, info) { if (info.played.length === 5) info.gild = true; } } },
  { id: "hakutaku", name: "白澤", yomi: "はくたく", rar: 2, cost: 7,
    text: "詠み札を使うたびに、ずっと 倍×0.2 上がる（いま倍×{x}）",
    lore: "万物を知る聖獣。歌を一首聞くたびに、少しずつ賢くなる。",
    init: { n: 0 }, fmt: (me) => ({ x: (1 + me.data.n * 0.2).toFixed(1) }),
    fx: { onScore(ctx, me) { if (me.data.n) ctx.mulBai(1 + me.data.n * 0.2); } } },
  { id: "nue", name: "鵺", yomi: "ぬえ", rar: 2, cost: 7,
    text: "光・種・短冊・カスがすべて数えられる打ちで 倍×3",
    lore: "猿の顔・狸の胴・虎の手足・蛇の尾。なんでも混ざったものが好き。",
    fx: { onScore(ctx) { const s = new Set(ctx.scored.map((c) => c.t)); if (s.size === 4) ctx.mulBai(3); } } },
  { id: "amabie", name: "アマビエ", yomi: "あまびえ", rar: 2, cost: 6,
    text: "大妖との祓いで 倍×2",
    lore: "海から現れて疫病を予言した不思議な者。大きな災いの前にこそ姿を見せる。",
    fx: { onScore(ctx) { if (ctx.isBoss) ctx.mulBai(2); } } },
  { id: "kasha", name: "火車", yomi: "かしゃ", rar: 2, cost: 6,
    text: "1枚だけ流すと、その札を燃やして山札から消す",
    lore: "悪しき亡骸をさらう火の車。いらない札をひとつ、あの世へ運ぶ。",
    fx: { onDiscard(run, cards) { if (cards.length === 1) Run.burnCard(run, cards[0].uid); } } },
  { id: "hitodama", name: "人魂", yomi: "ひとだま", rar: 2, cost: 6,
    text: "最初に数える札を、もう2回数える",
    lore: "ふわりと漂う青い魂。最初の一枚にだけ、三度くりかえしの念を込める。",
    fx: {}, flag: "firstTriple" },
  { id: "fuujin", name: "風神", yomi: "ふうじん", rar: 2, cost: 6, bond: "fuurai",
    text: "流すたび、この祓いの間 倍+4（いま倍+{n}）。雷神がいれば さらに 倍×1.5",
    lore: "風袋を担いだ緑の神。雷神とは喧嘩ばかりだが、並べば天が鳴る。",
    init: { n: 0 }, fmt: (me) => ({ n: me.data.n }),
    fx: { onRoundStart(run, me) { me.data.n = 0; }, onDiscard(run, cards, me) { me.data.n += 4; },
          onScore(ctx, me) { if (me.data.n) ctx.addBai(me.data.n); if (ctx.hasShiki("raijin")) ctx.mulBai(1.5, "風神雷神"); } } },
  { id: "raijin", name: "雷神", yomi: "らいじん", rar: 2, cost: 6, bond: "fuurai",
    text: "打つたび、この祓いの間 倍+4（いま倍+{n}）。風神がいれば さらに 倍×1.5",
    lore: "太鼓を背負った白い神。風神と並んだとき、その太鼓は本気で鳴る。",
    init: { n: 0 }, fmt: (me) => ({ n: me.data.n }),
    fx: { onRoundStart(run, me) { me.data.n = 0; }, onPlay(run, info, me) { me.data.n += 4; },
          onScore(ctx, me) { if (me.data.n) ctx.addBai(me.data.n); if (ctx.hasShiki("fuujin")) ctx.mulBai(1.5, "風神雷神"); } } },

  // ===== 稀 =====
  { id: "yatagarasu", name: "八咫烏", yomi: "やたがらす", rar: 3, cost: 9,
    text: "光が数えられるたび 倍×1.5",
    lore: "日輪に棲む三本足の烏。光の札を導く、神の使い。",
    fx: { onCard(ctx, c) { if (c.t === "hikari") ctx.mulBai(1.5); } } },
  { id: "kudagitsune", name: "管狐", yomi: "くだぎつね", rar: 3, cost: 10,
    text: "右どなりの式神の力を写す",
    lore: "竹筒に棲む小さな狐。となりの式神のまねが、本物より上手い。",
    fx: {}, flag: "copyRight" },
  { id: "baku", name: "獏", yomi: "ばく", rar: 3, cost: 9,
    text: "妖の癖を食べて無効にする",
    lore: "悪い夢を食べる聖獣。妖のいやがらせも、ぱくりと食べてしまう。",
    fx: {}, flag: "noQuirk" },
  { id: "ryujin", name: "龍神", yomi: "りゅうじん", rar: 3, cost: 9,
    text: "打ちが4回目以降（その祓いで）なら 倍×3",
    lore: "雨を呼ぶ水の神。じらされるほど、最後に大きな雨を降らせる。",
    fx: { onScore(ctx) { if (ctx.round.handsPlayed >= 4) ctx.mulBai(3); } } },
  { id: "tsuchigumo_s", name: "蜘蛛の子", yomi: "くものこ", rar: 3, cost: 8,
    text: "数えられた札の月が全部ちがうと 倍×2（2枚以上）",
    lore: "祓われた土蜘蛛の忘れ形見。ばらばらの糸を一つの巣に編みあげる。",
    fx: { onScore(ctx) { const ms = ctx.scored.map((c) => c.m); if (ms.length >= 2 && new Set(ms).size === ms.length) ctx.mulBai(2); } } },

  // ===== 極（魂呼びの符でのみ現れる） =====
  { id: "kyubi", name: "九尾の狐", yomi: "きゅうびのきつね", rar: 4, cost: 20,
    text: "光か種が数えられるたび 倍×1.5",
    lore: "九つの尾を持つ大妖狐。かつて帝をも化かしたが、いまはあなたの肩で眠る。",
    fx: { onCard(ctx, c) { if (c.t === "hikari" || c.t === "tane") ctx.mulBai(1.5); } } },
  { id: "ootengu", name: "大天狗", yomi: "おおてんぐ", rar: 4, cost: 20,
    text: "月流れが1か月とびでも成立する。月流れを含むと 倍×3",
    lore: "天狗の総大将。一足で季節をまたぐ。",
    fx: { onScore(ctx) { if (ctx.has("nagare")) ctx.mulBai(3); } }, flag: "gapNagare" },
  { id: "shuten", name: "酒呑童子", yomi: "しゅてんどうじ", rar: 4, cost: 20,
    text: "祓いを越えるたび、ずっと 倍×0.5 上がる（いま倍×{x}）",
    lore: "大江山の鬼の王。一年の酒宴につきあってくれるらしい。",
    init: { n: 0 }, fmt: (me) => ({ x: (1 + me.data.n * 0.5).toFixed(1) }),
    fx: { onRoundEnd(run, me) { me.data.n += 1; return 0; },
          onScore(ctx, me) { if (me.data.n) ctx.mulBai(1 + me.data.n * 0.5); } } },
];
const SHIKI_BY_ID = Object.fromEntries(SHIKI.map((s) => [s.id, s]));
function sellPrice(inst) {
  const d = SHIKI_BY_ID[inst.id];
  return Math.max(1, Math.floor(d.cost / 2)) + ((inst.data && inst.data.sellBonus) || 0);
}

// ---------- 呪符（消耗品。手札の札に使うものが多い） ----------
// need: 選ぶ札の枚数 [最小, 最大]（0なら札を選ばずに使える）
const FU = {
  utsushi:   { name: "写しの符",   need: [2, 2], cost: 3, text: "札を2枚選ぶ。左の札を、右の札の写しにする" },
  tsukiokuri:{ name: "月送りの符", need: [1, 2], cost: 3, text: "札を最大2枚選ぶ。月を1つ進める（師走→睦月）" },
  harae:     { name: "祓えの符",   need: [1, 2], cost: 3, text: "札を最大2枚選ぶ。山札から取り除く" },
  kinpaku:   { name: "金箔の符",   need: [1, 2], cost: 3, text: "札を最大2枚選ぶ。金箔を貼る（数えられると倍+5）" },
  kirara:    { name: "雲母の符",   need: [1, 2], cost: 3, text: "札を最大2枚選ぶ。雲母摺にする（数えられると文+40）" },
  mamori:    { name: "護りの符",   need: [1, 1], cost: 3, text: "札を1枚選ぶ。護りを付ける（手札に残すと倍×1.5）" },
  usurai:    { name: "薄氷の符",   need: [1, 1], cost: 3, text: "札を1枚選ぶ。薄氷にする（倍×2・打つと1/4で割れる）" },
  tanzaku:   { name: "短冊の符",   need: [1, 3], cost: 3, text: "札を最大3枚選ぶ。短冊に変える" },
  tanefu:    { name: "種の符",     need: [1, 2], cost: 3, text: "札を最大2枚選ぶ。種に変える" },
  zeni:      { name: "打ち出の符", need: [0, 0], cost: 3, text: "持ち銭を2倍にする（最大+15銭）" },
  shikiyobi: { name: "式呼びの符", need: [0, 0], cost: 4, text: "並の式神を1体呼ぶ（枠に空きが必要）" },
  hikarifu:  { name: "光の符",     need: [1, 1], cost: 5, rare: true, text: "札を1枚選ぶ。光に変える" },
  shuin:     { name: "朱印の符",   need: [1, 1], cost: 5, rare: true, text: "札を1枚選ぶ。朱印を押す（数えるとき二度数える）" },
  wakemi:    { name: "分け身の符", need: [1, 1], cost: 5, rare: true, text: "札を1枚選ぶ。その写しを2枚、山札に加える" },
  tamayobi:  { name: "魂呼びの符", need: [0, 0], cost: 8, rare: true, legend: true, text: "極の式神を1体呼ぶ（枠に空きが必要）" },
};

// ---------- 神器（五つ揃えると「五神器顕現」） ----------
const JINGI = [
  { id: "ken",   name: "草薙の剣",   short: "剣",   text: "打ち+1",               passive: { hands: 1 } },
  { id: "kagami",name: "八咫鏡",     short: "鏡",   text: "流し+1",               passive: { discards: 1 } },
  { id: "tama",  name: "八尺瓊勾玉", short: "勾玉", text: "式神の枠+1",           passive: { slots: 1 } },
  { id: "hoju",  name: "如意宝珠",   short: "宝珠", text: "手札+1",               passive: { handSize: 1 } },
  { id: "suzu",  name: "神楽鈴",     short: "鈴",   text: "夜市の品+1・めくり直し1銭引き", passive: { shopSlots: 1, rerollDiscount: 1 } },
];
const JINGI_PRICE = 10;
const JINGI_ALL_BONUS = 1.5; // 五神器顕現: 以後すべての打ちで 倍×1.5

// ---------- 妖（月ごとの相手） ----------
// kind: "small"（小妖・平月）/ "boss"（季節の大妖・3,6,9月）/ "final"（師走）
// quirk: 癖（run.js と score.js が参照）
const YOKAI = {
  // --- 慣らしの月（癖なし） ---
  hitotsume_none: null,
  zako_1: { name: "すねかじり", kind: "small", quirk: null, portrait: "y_sunekajiri",
    line: "ひっひっ、見習いの陰陽師か。祓えるものなら祓ってみな", lose: "ひぃ、札が光った！" },
  zako_2: { name: "袖引き小僧", kind: "small", quirk: null, portrait: "y_sodehiki",
    line: "ねえ、あそぼうよ。袖を引っぱるだけさ", lose: "ちぇっ、つまんないの" },
  // --- 小妖（4〜11月の平月にランダム） ---
  hitotsume: { name: "一つ目小僧", kind: "small", quirk: { handSize: -1 }, qtext: "手札が1枚少ない", portrait: "y_hitotsume",
    line: "目は一つでも、おまえの手札はよく見えるぞ", lose: "め、目が回る……" },
  azukiarai: { name: "小豆洗い", kind: "small", quirk: { discardCost: 1 }, qtext: "流すたびに 銭-1", portrait: "y_azukiarai",
    line: "しょきしょき……流すなら小豆代をもらおうか", lose: "小豆が、流れていく……" },
  akaname: { name: "垢嘗", kind: "small", quirk: { debuffType: "kasu" }, qtext: "カスの札は数えない", portrait: "y_akaname",
    line: "カスはおいらの好物さ。ぺろり、ぺろり", lose: "舌が、しびれた……" },
  aobozu: { name: "青坊主", kind: "small", quirk: { debuffType: "tan" }, qtext: "短冊の札は数えない", portrait: "y_aobozu",
    line: "歌など要らぬ。短冊は破り捨ててくれよう", lose: "むう……歌の力、あなどれぬ" },
  nobusuma: { name: "野衾", kind: "small", quirk: { debuffType: "tane" }, qtext: "種の札は数えない", portrait: "y_nobusuma",
    line: "ばさり。けものの札は、わしが覆い隠す", lose: "ばさ……ばさ……" },
  okurichochin: { name: "送り提灯", kind: "small", quirk: { debuffType: "hikari" }, qtext: "光の札は数えない", portrait: "y_okurichochin",
    line: "光など、この灯でかき消してやる", lose: "灯が……消える……" },
  amefuri: { name: "雨降り小僧", kind: "small", quirk: { dropOnPlay: 1 }, qtext: "打つたびに 手札が1枚流される", portrait: "y_amefuri",
    line: "ぴちょん。濡れた札は流れていくよ", lose: "雨、やんじゃった" },
  tenjoname: { name: "天井嘗", kind: "small", quirk: { mustPlay: 5 }, qtext: "5枚ちょうどでしか打てない", portrait: "y_tenjoname",
    line: "打つなら五枚。それ以外は天井のしみにしてやる", lose: "天井が、高い……" },
  bakezori: { name: "化け草履", kind: "small", quirk: { maxPlay: 3 }, qtext: "一度に打てるのは3枚まで", portrait: "y_bakezori",
    line: "カラン、コロン。三枚以上は重くて運べないねえ", lose: "鼻緒が、切れた……" },
  mikoshi: { name: "見越し入道", kind: "small", quirk: { targetMul: 1.3 }, qtext: "目標が3割増し", portrait: "y_mikoshi",
    line: "見上げるほどに大きくなるぞ。ほれ、ほれ", lose: "見越した！　見越したぞ！" },
  dorotabo: { name: "泥田坊", kind: "small", quirk: { noLevels: true }, qtext: "詠み札の段位が効かない", portrait: "y_dorotabo",
    line: "田を返せ……歌など、泥に沈めてくれる", lose: "田を……たの……む……" },
  // --- 季節の大妖（3・6・9月） ---
  tsuchigumo: { name: "土蜘蛛", kind: "boss", season: "春", quirk: { faceDown: 4 }, qtext: "配られる札の4枚に1枚が伏せ札（中身が見えない）", portrait: "y_tsuchigumo",
    line: "春の霞に糸を張った。見えぬ札で、どう戦う？",
    lose: "糸が……焼き切れる……", win: "ほれ見ろ、絡め取った" },
  orochi: { name: "八岐大蛇", kind: "boss", season: "夏", quirk: { noRepeat: true }, qtext: "一度打った役（月の役）は、二度と成立しない", portrait: "y_orochi",
    line: "八つの首が八つの手を覚える。同じ手は、二度と通じぬ",
    lose: "八つの首が……ほどける……", win: "同じ手ばかり。退屈な陰陽師よ" },
  tamamo: { name: "玉藻前", kind: "boss", season: "秋", quirk: { sleepShiki: true }, qtext: "打つたびに 式神1体が化かされて眠る", portrait: "y_tamamo",
    line: "ほほ……その式神たち、ほんとうにあなたの味方？",
    lose: "化けの皮が……はがれる……", win: "ほら、みんな眠ってしまった" },
  ootakemaru: { name: "大嶽丸", kind: "boss", season: "夏", quirk: { noDiscard: true }, qtext: "流しが使えない", portrait: "y_ootakemaru",
    line: "黒雲を呼んだ。逃げ道など、どこにも無い",
    lose: "雲が晴れる……だと……", win: "逃げ道の無い戦は、苦手か" },
  gashadokuro: { name: "がしゃどくろ", kind: "boss", season: "秋", quirk: { handSize: -2 }, qtext: "手札が2枚少ない", portrait: "y_gashadokuro",
    line: "がしゃ、がしゃ……骨まで、しゃぶってやろう",
    lose: "骨が、崩れる……", win: "がしゃしゃしゃしゃ" },
  sutoku: { name: "崇徳院", kind: "boss", season: "春", quirk: { playCost: 1 }, qtext: "打った札1枚ごとに 銭-1", portrait: "y_sutoku",
    line: "この怨み、一文残らず取り立ててくれよう",
    lose: "……瀬をはやみ……われても末に……", win: "これが怨みの重さよ" },
  // --- 百鬼夜行の主（師走・最終） ---
  nurarihyon: { name: "ぬらりひょん", kind: "final", quirk: { shuffleShiki: true }, qtext: "百鬼の主。打つたびに式神の並びが入れかわる", portrait: "y_nurarihyon",
    line: "一年ご苦労じゃった、陰陽師。さて……今宵の行列の、しんがりを務めてもらおうかの",
    lose: "ぬらり……ひょん……。見事じゃ。春を、持っていけ", win: "茶が冷めてしもうたわい" },
};
const SMALL_POOL = ["hitotsume", "azukiarai", "akaname", "aobozu", "nobusuma", "okurichochin", "amefuri", "tenjoname", "bakezori", "mikoshi", "dorotabo"];
const BOSS_POOL = { 3: ["tsuchigumo", "sutoku"], 6: ["orochi", "ootakemaru"], 9: ["tamamo", "gashadokuro"] };

// ---------- 目標（霊力） ----------
// index = 月（1〜12）。大妖・最終は別倍率を掛けない（この表がそのまま目標）。
const TARGETS = [0, 300, 450, 800, 1000, 1400, 2400, 3000, 4300, 6800, 9500, 14000, 21000];
function targetFor(year, month) {
  let t = TARGETS[month];
  // 二年目以降（無限の絵巻）: 師走の目標から、月ごとに1.35倍ずつ上がり続ける
  if (year > 1) t = Math.round(TARGETS[12] * Math.pow(1.35, 12 * (year - 2) + month) / 100) * 100;
  return t;
}

// ---------- 陰陽師（はじめに選ぶ主人公） ----------
const ONMYOJI = [
  { id: "hinata", name: "ひなた", title: "見習い陰陽師", portrait: "o_hinata",
    text: "紙人形を連れて旅立つ。素直な札さばき。",
    start: { shiki: ["kamihito"] },
    line: "紙丸、いくよ。一年、よろしくね" },
  { id: "kuzunoha", name: "葛の葉", title: "狐の血をひく陰陽師", portrait: "o_kuzunoha", unlock: "clear1",
    text: "式神の枠+1。ただし流し-1。",
    start: { passive: { slots: 1, discards: -1 }, shiki: [] },
    line: "わたしの式神たちは、少しばかり気まぐれよ" },
  { id: "douman", name: "道満", title: "はぐれ陰陽師", portrait: "o_douman", unlock: "clear1",
    text: "銭+8で始まり、写しの符を2枚持つ。",
    start: { zeni: 8, fu: ["utsushi", "utsushi"], shiki: [] },
    line: "正しい手だけでは勝てんよ。札は、いじってなんぼだ" },
];

// ---------- 物語（詞書） ----------
const STORY = {
  prologue: [
    "ある年の大晦日。陰陽寮の卦に、凶と出た。",
    "来る年、月ごとに妖があらわれ、師走の夜には百鬼夜行が都を呑む——と。",
    "見習い陰陽師のひなたの手にあるのは、花札四十八枚と、折りたての紙の式神がひとつ。",
    "季節の霊力を札に呼び、一年をかけて、妖を祓え。",
  ],
  season: {
    "春": "春。松の緑に、梅の香、桜の霞。花の札が、いちばん明るく光る季節。",
    "夏": "夏。藤が垂れ、菖蒲が立ち、牡丹がひらく。夜は短く、妖は気が短い。",
    "秋": "秋。萩の野に猪が駆け、芒の丘に月がのぼる。札は熟れ、妖は深く化ける。",
    "冬": "冬。紅葉が散り、柳に雨、桐の葉が落ちる。師走の闇の向こうで、行列の足音がする。",
  },
  ending: [
    "師走の夜。百鬼の行列は、除夜の鐘とともにほどけて消えた。",
    "ぬらりひょんは茶をすすり、「また来年」と笑って霞に溶けた。",
    "札を束ねると、四十八枚のどれもがあたたかい。式神たちが、あなたの袖で眠っている。",
    "都に、春が来る。",
  ],
};

// ---------- 夜市の品ぞろえ ----------
const SHOP = {
  shikiSlots: 2,
  itemSlots: 2,
  packSlots: 2,
  rerollBase: 2,
  rarityWeights: [0, 70, 26, 4], // 並・良・稀（極は出ない）
  yomiCost: 3,
};
const PACKS = {
  fuda:  { name: "札の文箱",   cost: 4, pick: 1, show: 3, text: "花札3枚から1枚を選んで山札に加える（加工つきが混じる）" },
  yomi:  { name: "歌の文箱",   cost: 4, pick: 1, show: 3, text: "詠み札3枚から1枚を選んで詠む" },
  jufu:  { name: "呪符の文箱", cost: 4, pick: 1, show: 3, text: "呪符3枚から1枚を選ぶ（手札5枚に使える）" },
  shiki: { name: "式神の文箱", cost: 6, pick: 1, show: 2, text: "式神2体から1体を選ぶ" },
};

// ---------- 式神の台詞（仲間になったとき／大きな一打／祓い成功／後がないとき） ----------
// 各式神の人となりを一言で。無い場面は GENERIC_TALK から選ぶ。
const SHIKI_TALK = {
  kamihito:   { join: "いっしょに がんばろうね", big: "紙が ふるえるくらい すごい！", clear: "祓えたね！ ぼく、役に立った？", last: "まだ 飛べるよ。あきらめないで" },
  kooni:      { join: "おいら、そろえるの得意だぜ", big: "へへっ、そろった そろった！", clear: "角が一本でも 勝てるんだ" },
  kappa:      { join: "胡瓜をくれたら 手を貸そう", big: "皿の水が あふれそうだ！", clear: "ひと泳ぎ してくるか" },
  kamaitachi: { join: "しゅっ——もう来た", big: "季節ごと 斬り抜けた！", clear: "次の月へ、駆けるぞ" },
  karakasa:   { join: "けけけ、同じ柄を 見せておくれ", big: "そろった！ 跳ねちゃう！", clear: "雨が上がったねえ" },
  ittan:      { join: "ひらり。短冊は 仲間さ", big: "夜風に のったぁ！", clear: "空が 広いねえ" },
  kitsunebi:  { join: "……こん。灯りを ともそう", big: "光が 燃えあがる！", clear: "野に 灯がつづく" },
  inugami:    { join: "わん。けものの札は まかせて", big: "においで わかった！", clear: "しっぽが 止まらない" },
  tsukumo:    { join: "百年目の 下駄でございます", big: "カスにも 魂が宿るのです！", clear: "かたこと、かたこと" },
  tofu:       { join: "……豆腐、いります？", big: "豆腐が ぷるんと ゆれた！", clear: "くずさずに 済みました" },
  zashiki:    { join: "この懐、住みよさそう", big: "ふふっ、福が来た", clear: "銭の音が するね" },
  maneki:     { join: "にゃあ。貯めるほど 張り切るにゃ", big: "小判ざくざくにゃ！", clear: "商売繁盛にゃ" },
  chochin:    { join: "ぼうっ……", big: "燃えるぞ、燃えるぞ！", clear: "灯が 消えなかった", last: "いまこそ 燃え上がる時！" },
  makura:     { join: "流さずに 我慢できる？", big: "枕が ひっくり返るほど！", clear: "おやすみの時間だ" },
  nekomata:   { join: "にゃ。少ない手で 決めるのが粋", big: "二本の尾が 逆立った！", clear: "ひと眠り させとくれ" },
  amanojaku:  { join: "よろしくしないよ（よろしく）", big: "ぜんぜん すごくない！（すごい）", clear: "負けちゃった（勝った）" },
  kodama:     { join: "……（こだまが 返ってきた）", big: "山じゅうに 響いた！", clear: "森が ざわめいてる" },
  onibi:      { join: "旬の札は 燃えやすいのさ", big: "ごうごう 燃えてる！", clear: "季節が 燃えていく" },
  sunekosuri: { join: "（足もとに すりすり……）", big: "（ごろごろごろ！）", clear: "（しっぽを 立てて ついてくる）" },
  betobeto:   { join: "べと、べと……うしろ、いいかい", big: "足音が 大きくなった！", clear: "お先にどうぞ" },
  karasutengu:{ join: "退路を断つ覚悟は あるか", big: "見事な太刀筋！", clear: "修行が足りたな" },
  bakedanuki: { join: "ぽん！ 化けて 値上がりしますぜ", big: "腹鼓 ぽんぽこぽん！", clear: "葉っぱの小判も 本物になれ" },
  a_komainu:  { join: "あ——", big: "あ！（吽はまだか）", clear: "あ。" },
  un_komainu: { join: "……うん", big: "うん！！", clear: "うん。" },
  mizaru:     { join: "（目をふさいで ぺこり）", big: "見てないけど すごい気がする！", clear: "（そっと指のすきまから のぞく）" },
  kikazaru:   { join: "（耳をふさいで ぺこり）", big: "聞こえないけど 地面がゆれた！", clear: "（そっと手を はなす）" },
  iwazaru:    { join: "（口をふさいで ぺこり）", big: "（もごもご、もご！）", clear: "（……言いたい！）" },
  yukionna:   { join: "光を抱いて 離さないで", big: "吹雪が 舞う……", clear: "春が来たら 溶けてしまうわ" },
  tengu:      { join: "流れる一手を 見せてみよ", big: "天狗の鼻も 高くなるわ！", clear: "鞍馬へ 報せを飛ばそう" },
  gama:       { join: "げこ。重ねて 打つがよい", big: "げーこ げこげこ！", clear: "煙を ひと吹き" },
  rokurokubi: { join: "山札の奥まで 見えますわ", big: "首が のびちゃう！", clear: "首を 休めましょう" },
  nurikabe:   { join: "…………（どっしり）", big: "…………！！（ぐらり）", clear: "…………（うなずいた）" },
  dodomeki:   { join: "百の目が あなたの札を見る", big: "全部 見えている！", clear: "目を 閉じるわ" },
  shoujou:    { join: "盃は どこだい？", big: "酒だ 酒だ 舞え舞え！", clear: "祝い酒と いこう" },
  yamagami:   { join: "山の獣が 力を貸そう", big: "山が どよめいた！", clear: "山へ 帰る道は 明るい" },
  fuguruma:   { join: "歌の短冊を 読ませて", big: "なんと 美しい歌……", clear: "返歌を 書きましょう" },
  jorogumo:   { join: "ありふれた札を 絹にしてあげる", big: "糸が 金に光る！", clear: "巣を 張りなおしましょ" },
  kanedama:   { join: "（ちゃりん）", big: "（じゃらじゃらじゃら！）", clear: "（ちゃりんちゃりん）" },
  binbogami:  { join: "貧しいのは 気楽でいいぞ", big: "ひっひ、貧乏も 捨てたもんじゃない！", clear: "まだ 銭を貯める気かい" },
  raijuu:     { join: "ばちっ！", big: "ばりばりばり！", clear: "雷雲へ 帰ろ" },
  hakutaku:   { join: "歌をひとつ 聞かせておくれ", big: "万物の理に かなう一手！", clear: "また ひとつ 賢くなった" },
  nue:        { join: "ひょう……ひょう……", big: "混ざれ 混ざれ！", clear: "黒雲に 消えよう" },
  amabie:     { join: "大きな災いの前に 来たよ", big: "えいっ、疫病退散！", clear: "わたしの絵を 描いてね" },
  kasha:      { join: "いらない札は あの世へ運ぶよ", big: "火の車が 回る回る！", clear: "車を 洗わなきゃ" },
  hitodama:   { join: "……ふわり", big: "三度 燃えた！", clear: "……ふわり、ふわり" },
  fuujin:     { join: "雷神の奴は まだ来ないのか", big: "風よ 吹け！", clear: "ひと吹きで 雲を払ったぞ" },
  raijin:     { join: "風神より 先に来てやったぞ", big: "どんどこ どん！", clear: "太鼓の皮が 破れそうだ" },
  yatagarasu: { join: "日輪の道を 案内しよう", big: "光が 導く！", clear: "日が昇る" },
  kudagitsune:{ join: "となりの子の まねをするよ", big: "本物より 上手いでしょ！", clear: "筒に 戻ります" },
  baku:       { join: "悪い夢は 食べてあげる", big: "もぐもぐ……おいしい一手", clear: "ごちそうさま" },
  ryujin:     { join: "じらせば じらすほど 雨は降る", big: "大雨だ！", clear: "雲が 晴れる" },
  tsuchigumo_s:{ join: "ばらばらの糸を 編んであげる", big: "巣が できた！", clear: "かあさん、見てる？" },
  kyubi:      { join: "……しばらく、そなたの肩で眠ろう", big: "妾の尾が 九つとも 逆立ったわ", clear: "まあまあ、じゃな" },
  ootengu:    { join: "季節など ひとまたぎよ", big: "天狗の本気を 見たか！", clear: "よき 一年であった" },
  shuten:     { join: "一年の酒宴、つきあってやろう", big: "がははは、酒がうまい！", clear: "もう一杯！" },
};
const GENERIC_TALK = {
  big: ["すごい一打！", "札が 光ってる！", "やったあ！"],
  clear: ["祓えた！", "次の月へ！", "ほっとした"],
  last: ["あと一回……！", "ここが 勝負どころ"],
  boss: ["大妖だ……気をつけて", "負けないぞ", "みんなで いこう"],
};

// ---------- 月の詞書（絵巻の地図に添える一文） ----------
const MONTH_TEXT = [
  "",
  "睦月。松の緑に鶴が舞い、赤い日がのぼる。年の初めの札は、どれもまだ新しい。",
  "如月。梅の枝で鶯が鳴く。春はまだ浅く、夜風は冷たい。",
  "弥生。桜の幕が張られ、都じゅうが浮かれている。霞の奥で、糸を張る音がする。",
  "卯月。藤の花房が垂れ、不如帰が月をよぎる。夏の気配。",
  "皐月。菖蒲の八橋を渡る。水面に映る札が、ゆらりと化ける。",
  "水無月。牡丹に蝶。雨の季節の終わり、川が騒がしい。",
  "文月。萩の野を猪が駆ける。短冊に願いを書く夜。",
  "葉月。芒の丘に満月がのぼり、雁が渡る。月見の酒が恋しい。",
  "長月。菊の盃に酒を満たす。白い尾の影が、宴にまぎれこむ。",
  "神無月。紅葉に鹿が鳴く。神々は出雲へ出かけ、都は留守がち。",
  "霜月。柳に雨、傘をさす人。遠くで雷鼓が鳴っている。",
  "師走。桐の葉が落ちる。鳳凰は飛び立ち、百鬼の行列が近づいてくる。",
];

// ---------- 位階（難易度。一年を結ぶと次の位へ上がれる。効果は下の位のぶんも重なる） ----------
const RANKS = [
  { name: "無位",   text: "ふつうの一年" },
  { name: "従七位", text: "睦月・如月にも小妖の癖が出る" },
  { name: "正六位", text: "祓いの目標が1.2倍" },
  { name: "従五位", text: "流しが1回少ない" },
  { name: "正四位", text: "利子がつかない" },
  { name: "正三位", text: "祓いの目標がさらに1.25倍・式神が1銭高い" },
];
