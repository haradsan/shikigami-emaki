// ============================================================
// bgm.js — BGM（WebAudioで合成。外部ファイル不要・オフライン動作）
// ------------------------------------------------------------
// v41: 矩形波のチップチューンを廃し、「和楽器風の合成音」＋「毎回変奏するシーケンサ」に作り替え。
//   旧版への指摘「単調・旋律の変化が少ない」への答えとして、
//   ①音色を和楽器寄りに ②曲をセクション構成（A A' B A'' ブリッジ）に ③繰り返すたびに変奏させる。
//
// 【音色】すべて OscillatorNode／ノイズバッファ＋エンベロープで作る（1サンプルごとのJS処理はしない）
//   koto  … 箏。弦の端近くを爪で弾いた倍音（PeriodicWave）＋ローパスの開閉で「弾いた瞬間だけ明るく、
//            すぐ丸くなる」。弾いた瞬間わずかに高く正しい音程へ落ちる。装飾で「押し手」（下から押し上げ）、
//            余韻が少し下がる「引き色」も。低い音ほど長く響く。伴奏・低音・駆け下りもこの音色。
//   flute … 尺八／篠笛。ほぼ正弦波＋帯域ノイズの息。立ち上がりはゆっくり、長い音はふくらみ、
//            ビブラート（ユリ）は後からかかって長い音ほど深くなる。時々下からしゃくり上げる。
//   taiko … 和太鼓。低いサイン波のピッチ落ち＋ローパスノイズの皮鳴り。D=大きいドン d=小さいドン k=縁（カッ）
//   wood  … 拍子木（x=高 o=低）と当たり鉦（c=チャンチキ。祭囃子の金属音。夜市で使う）
//   bell  … 神楽鈴。高い非整数倍音＋ノイズを「シャララ」と数回振る。セクションの頭にたまにだけ
//   pad   … 笙の合竹（あいたけ）風。2度を含む和音をリード風の倍音で持続させ、ローパスで丸めてごく小さく
//   残響   … 長さ違いのフィードバック・ディレイ2本の簡易「ホール」。楽器ごとに送り量を変える
//
// 【音階】旋律は「度数」で書く。0〜4 が1オクターブの5音、5 で1オクターブ上、-1 で下。
//   陰旋法（都節）= 半音 [0,1,5,7,8]  例: E-F-A-B-C … title / battle / boss / lose
//   陽旋法        = 半音 [0,2,5,7,9]  例: D-E-G-A-B … pack / win
//   度数で書いてあるので、周回ごとに調を移しても（keys）変奏で音を動かしても、音階から外れない。
//   和音は4度・5度の積み重ね（箏の調弦・笙の響きに近い）。ボスは F-B のような三全音の和音を混ぜる。
//
// 【構成と変奏】
//   曲 = セクション（多くは4小節＝1フレーズ）を form の順に巡る。once:true のセクション（前奏・祝いの
//   ファンファーレ）は最初の1回だけ。1周するごとに調が移り（keys）、変奏の強さ（vary）が上がっていく。
//   セクションごとに 主旋律（笛 or 箏）・和音進行・箏の伴奏型・太鼓型・拍子木型・笙の和音 を持つ。
//   変奏はシード付き乱数（再生のたびに違うシード）で:
//     旋律 … 隣の音への置き換え／長い音の分割（経過音）／付点化／先取り（シンコペーション）／
//            短い音の休符化（息継ぎ）／半フレーズのオクターブ移し／終止音の差し替え／
//            装飾音（笛=上の隣接音をかすめる・しゃくり、箏=押し手 or 前打音）
//     掛け合い … 笛の長い音の下で箏が動機を返す／箏の余韻や休みに笛が応える（動機の移高・逆行）
//     ヘテロフォニー … もう一方の楽器が骨格の音を少し遅れてなぞる（邦楽らしいずれ）
//     伴奏 … 音の抜き・オクターブ跳ね・小節末の駆け下り／低音箏
//     打楽器 … 装飾打・抜き・セクション末のフィル／神楽鈴のきらめき
//   → 数分ループしても「同じ8小節の繰り返し」には聞こえない。
//
// 【スケジューラ】setInterval 25ms ごとに、ctx.currentTime の 0.2秒先までを発音予約する（先読み方式）。
//   1セクションぶんの音符は先に「イベント配列」にしておき（軽い）、発音ノードは先読み窓に入ってから作る。
//   曲の切り替え（setTrack）: 旧曲はトラック専用のフェーダーで 0.8秒かけて消し、新曲はフレーズの頭から始める。
//
// 【負荷】ノードは音ごとにエンベロープの終わりで stop() する。同時に鳴る声部は十数〜二十程度。
// 【音量】master → コンプレッサー。効果音（sfx.js）の下で鳴る控えめな音量にしてある。
//
// 曲は6つ。BGM.setTrack(name) で場面ごとに切り替える（未知の名前は無視）。
//   title  … タイトル・絵巻（月の地図）: ゆっくり・間の多い・内省的
//   battle … 祓い（通常）: 中庸のテンポ、太鼓の一定の刻み＋箏のオスティナート
//   boss   … 大妖・百鬼夜行の主: 低く速く、太鼓の連打、三全音の不穏な響き
//   pack   … 夜市（狸の市）: 陽旋法で賑やかに、祭囃子の鉦と跳ねるリズム
//   win    … 一年を祓い終えた: 祝いのファンファーレ（1回）→ 穏やかなループ
//   lose   … 敗北: ゆっくり下降する、まばらな旋律
// 設定画面の BGM ボタンでON/OFF（localStorage "shiki-hana-bgm"）。**既定はON**。
//
// 【スマホで鳴らせるようにするための処理（v28.1から継承）】ここが一番の落とし穴なので触るとき注意:
//   ・自動再生制限 … ONで保存されていても再生開始は「最初のタップ」を待つ（armUnlock）
//   ・iPhoneのサイレントスイッチ … WebAudioだけだとマナーモードで無音になる。
//     無音WAVを <audio> でループ再生してセッションを「メディア再生」に上げる（primeSession）
//   ・resume() が通らない端末 … 鳴り出すまで「次のタップで再挑戦」を繰り返す（armUnlock の再武装）
//
// デバッグ用に BGM._debug（状態）と BGM._analyze / BGM._offline（dev/bgm-test.html 用）を出している。
// ============================================================
"use strict";

const BGM = (() => {
  const KEY = "shiki-hana-bgm"; // ON/OFF はプレイヤー共通
  let ctx = null, master = null, timer = null;
  let enabled = false; // ユーザーの希望（ONでも再生開始はユーザー操作後）
  let playing = false;
  let trackName = "title";
  let cur = null;      // いま鳴らしている曲の再生状態（newPlayback が作る）
  let rev = null;      // 残響（ディレイ）の入口
  let W = null;        // PeriodicWave 類（ctx生成後に作る）
  let noiseBuf = null; // 息・皮鳴り・鈴のノイズ
  let live = 0;        // いま鳴っている声部の数（負荷確認用）
  let voiceCount = 0;  // 累計の発音数（デバッグ用）
  let counting = true; // オフライン試聴中は数えない

  const LOOKAHEAD = 0.2;   // 何秒先まで発音予約するか
  const TICK_MS = 25;      // スケジューラの間隔
  const FADE_OUT = 0.8;    // 曲切替のフェードアウト（秒）
  const START_GAP = 0.45;  // 曲切替で新曲が鳴り出すまでの間（旧曲の消え際と少し重ねる）
  const MASTER_VOL = 0.36;

  // ---------- 小道具 ----------
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // シード付き乱数（mulberry32）。同じシードなら同じ変奏になる
  function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  let seedBase = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const nextSeed = () => (seedBase = (seedBase * 1664525 + 1013904223) >>> 0);

  // ---------- 音階と旋律の書き方 ----------
  const SCALE = { in: [0, 1, 5, 7, 8], yo: [0, 2, 5, 7, 9] };
  const warn = []; // 曲データの書き間違い（小節の長さ違いなど）。_debug.warnings で見られる
  // "2/8 3/4 | 3/6 ..." → { notes:[{s,len,d}], len }
  //   度数/長さ（16分音符いくつ）。r=休符。長さ省略は4（4分音符）。| は小節線（読み飛ばす）
  function parsePhrase(str) {
    const notes = [];
    let s = 0;
    str.trim().split(/\s+/).forEach((tk) => {
      if (tk === "|") return;
      const m = /^(r|-?\d+)(?:\/(\d+))?$/.exec(tk);
      if (!m) { warn.push("bad token: " + tk); return; }
      const len = m[2] ? Number(m[2]) : 4;
      if (m[1] !== "r") notes.push({ s, len, d: Number(m[1]) });
      s += len;
    });
    return { notes, len: s };
  }
  // 和音（度数の組）。4度・5度の積み重ね
  //   陰旋法: I=E-B-E  IV=A-E-A  bII=F-C-F  V=B-E-B  T=F-B-F（三全音。ボス用）   ※E基準の例
  const IN_I = [0, 3, 5], IN_IV = [2, 5, 7], IN_bII = [1, 4, 6], IN_V = [3, 5, 8], IN_T = [1, 3, 6];
  //   陽旋法: I=D-A-D  IV=G-D-G  V=A-E-A  ii=E-B-E   ※D基準の例
  const YO_I = [0, 3, 5], YO_IV = [2, 5, 7], YO_V = [3, 6, 8], YO_ii = [1, 4, 6];

  // ---------- 曲データ ----------
  // bpm / scale / tonic（度数0のMIDI音高）/ keys（周回ごとの移調・半音）/ swing（8分の跳ね 0〜0.3）
  // accOct・bassOct・padOct … 伴奏箏・低音箏・笙を旋律から何度数ずらすか（-5で1オクターブ下）
  // stable … 終止に使える安定音の度数 / phr … 旋律（4小節=64） / acc・bass … 伴奏型（和音の何番目の音か、0〜9）
  // taiko（D d k）・wood（x o c）… 1小節16文字の打楽器型。fill はセクション末のフィル
  // sec … セクション: lead（旋律名 or 候補の配列）inst（flute|koto）oct（旋律の度数ずらし）chords（小節ごと）
  //        pad（笙の度数）acc drum wood（型の名前）vary（変奏の強さ）resp（掛け合い率）hetero（なぞり率）
  //        bell（神楽鈴の率）fill（末尾フィル）once（最初の周だけ）bars（既定4）
  // mix … 楽器ごとの音量倍率 / wet … 残響の量 / breath … 笛の息の量
  const TRACKS = {
    // ── 題名・絵巻: 陰旋法E。遅く、間を広く。前奏は笙と鈴だけ。笛が歌い、箏がまばらに応える
    title: {
      bpm: 66, scale: "in", tonic: 64, keys: [0, 5, 0, -2], swing: 0,
      accOct: -5, bassOct: -10, padOct: -5, taikoVel: 0.5, bell: 0.15, wet: 1.3,
      stable: [0, 2, 3], mix: { pad: 1.2 },
      phr: {
        A:  "2/8 3/4 4/4 | 3/6 2/2 1/8 | 0/4 1/4 2/6 4/2 | 3/16",
        A2: "5/8 4/4 3/4 | 4/4 3/2 2/2 3/8 | 2/4 1/4 0/4 1/4 | 0/16",
        B:  "7/4 7/2 6/2 5/4 4/4 | 5/8 3/8 | 4/2 5/2 4/2 3/2 2/4 3/4 | 2/12 r/4",
        B2: "5/6 6/2 7/8 | 8/4 7/4 6/8 | 5/4 4/4 3/4 4/4 | 5/16",
        C:  "r/8 1/8 | 4/16 | 3/8 r/4 1/4 | 0/16",
      },
      acc: {
        sparse: ["0.......2.......", "........1......."],
        slow:   ["0.......1...2...", "0.....2.....1...", "0...1.......2...", "0.......2...4..."],
        slow2:  ["0...1...2...1...", "0...2...1...4...", "0...1...2...4...", "0...2...1...2..."],
      },
      bass: {
        sparse: ["0...............", "................"],
        slow:   ["0...............", "................", "0.......0.......", "................"],
        slow2:  ["0...............", "........0......."],
      },
      taiko: {
        one:  ["D...............", "................", "................", "................"],
        soft: ["D...............", "........d.......", "D...............", "........d...d..."],
        fill: "D.......d...d.d.",
      },
      wood: {},
      sec: {
        intro: { bars: 2, lead: null, chords: [IN_I], pad: [0, 2, 3, 6], acc: "sparse", drum: "one", bell: 1, once: true },
        A:  { lead: "A", inst: "flute", chords: [IN_I, IN_IV, IN_I, IN_V], pad: [0, 2, 3, 6], acc: "slow", drum: "one", vary: 0, resp: 0.35 },
        A2: { lead: "A2", inst: "flute", chords: [IN_IV, IN_I, IN_bII, IN_I], pad: [0, 2, 3, 5], acc: "slow", drum: "one", vary: 0.25, resp: 0.6, hetero: 0.35 },
        B:  { lead: ["B", "B2"], inst: "koto", oct: -5, chords: [IN_IV, IN_I, IN_bII, IN_IV], pad: [2, 3, 5, 7], acc: "slow2", drum: "soft", vary: 0.3, resp: 0.55 },
        A3: { lead: "A", inst: "flute", oct: 5, chords: [IN_I, IN_IV, IN_I, IN_V], pad: [0, 2, 3, 6], acc: "slow2", drum: "soft", vary: 0.55, resp: 0.5, hetero: 0.3, fill: true },
        A4: { lead: "A2", inst: "flute", chords: [IN_IV, IN_I, IN_bII, IN_I], pad: [0, 2, 3, 5], acc: "slow", drum: "one", vary: 0.5, resp: 0.6 },
        C:  { lead: "C", inst: "flute", chords: [IN_bII, IN_bII, IN_V, IN_I], pad: [1, 2, 4, 6], acc: "sparse", drum: "one", vary: 0.35, resp: 0.45, bell: 0.7 },
      },
      form: ["intro", "A", "A2", "B", "A3", "A4", "C"],
    },

    // ── 祓い（通常）: 陰旋法A。中庸のテンポ。太鼓の一定の刻み、箏の8分オスティナート、裏拍の拍子木
    battle: {
      bpm: 112, scale: "in", tonic: 69, keys: [0, 5, -2, 3], swing: 0,
      accOct: -5, bassOct: -10, padOct: -5, taikoVel: 1, bell: 0.12, wet: 0.8,
      stable: [0, 2, 3],
      phr: {
        A:  "0/2 1/2 2/4 3/4 2/2 1/2 | 0/6 -1/2 -2/8 | 0/2 2/2 3/4 4/2 3/2 2/4 | 3/12 r/4",
        A2: "5/4 4/2 3/2 4/4 3/4 | 2/2 3/2 2/2 1/2 0/8 | -1/2 0/2 1/4 0/2 -1/2 -2/4 | 0/12 r/4",
        B:  "-5/2 -3/2 -2/2 0/2 -2/2 -3/2 -2/4 | 0/2 1/2 2/2 1/2 0/8 | 2/2 3/2 4/2 3/2 2/2 1/2 0/2 1/2 | 0/4 -2/4 -3/8",
        B2: "2/4 2/2 1/2 0/4 1/2 2/2 | 3/6 2/2 1/8 | 0/2 1/2 0/2 -1/2 -2/4 -3/4 | -2/8 -5/8",
        C:  "3/16 | 4/8 3/8 | 1/16 | 0/8 r/8",
      },
      acc: {
        drive:  ["0.2.1.2.0.2.1.4.", "0.2.1.2.0.4.2.1."],
        drive2: ["0.21.2.40.21.2.4", "0.21.2.40.2.1.2."],
        half:   ["0.......1.......", "0.......2...1..."],
      },
      bass: {
        drive:  ["0.....0.0.......", "0.....0.0...0..."],
        drive2: ["0.....0.0.......", "0.....0.0.....0."],
        half:   ["0...............", "0.......0......."],
      },
      taiko: {
        main: ["D...d.D.D...d.k.", "D...d.D.D..dD.k."],
        soft: ["D.......D.......", "D.......D...d..."],
        fill: "D.d.D.d.DdDdDDk.",
      },
      wood: { tick: ["..x...x...x...x.", "..x...x...x.x.x."] },
      sec: {
        A:  { lead: "A", inst: "flute", chords: [IN_I, IN_IV, IN_I, IN_V], pad: [0, 3, 5, 6], acc: "drive", drum: "main", wood: "tick", vary: 0, resp: 0.4 },
        A2: { lead: "A2", inst: "flute", chords: [IN_IV, IN_I, IN_bII, IN_I], pad: [0, 2, 3, 5], acc: "drive", drum: "main", wood: "tick", vary: 0.3, resp: 0.6, hetero: 0.3, fill: true },
        B:  { lead: ["B", "B2"], inst: "koto", chords: [IN_I, IN_bII, IN_IV, IN_I], pad: [1, 2, 4, 6], acc: "half", drum: "main", vary: 0.3, resp: 0.6 },
        A3: { lead: "A", inst: "flute", oct: 5, chords: [IN_I, IN_IV, IN_I, IN_V], pad: [0, 3, 5, 6], acc: "drive2", drum: "main", wood: "tick", vary: 0.55, resp: 0.5, hetero: 0.35 },
        A4: { lead: "A2", inst: "flute", chords: [IN_IV, IN_I, IN_bII, IN_I], acc: "drive2", drum: "main", wood: "tick", vary: 0.5, resp: 0.6, fill: true },
        C:  { lead: "C", inst: "flute", chords: [IN_V, IN_bII, IN_bII, IN_I], pad: [1, 3, 4, 6], acc: "half", drum: "soft", vary: 0.3, resp: 0.7, bell: 0.5 },
      },
      form: ["A", "A2", "B", "A3", "A4", "C"],
    },

    // ── 大妖・百鬼夜行の主: 陰旋法D（D-Eb-G-A-Bb）。低い箏が主役、速い太鼓の連打、
    //    Eb-A の三全音（T和音）と短2度を含む笙で不穏に。2周目は半音上がって緊張を増す
    boss: {
      bpm: 132, scale: "in", tonic: 62, keys: [0, 1, 0, -2], swing: 0,
      accOct: -5, bassOct: -10, padOct: -5, taikoVel: 1.1, bell: 0.08, wet: 0.9,
      stable: [0, 3], mix: { pad: 0.85 }, breath: 1.6,
      phr: {
        A:  "0/2 0/2 1/4 3/4 1/4 | 0/2 -2/2 -1/4 -2/8 | 0/2 1/2 3/2 4/2 3/2 1/2 0/4 | -2/4 1/4 3/8",
        A2: "5/4 4/2 3/2 1/4 3/4 | 4/2 3/2 1/2 0/2 -2/8 | -4/2 -2/2 0/2 1/2 0/2 -2/2 -4/4 | -5/16",
        B:  "3/12 4/4 | 3/8 1/8 | 0/4 1/4 3/4 6/4 | 5/16",
        B2: "1/8 3/8 | 4/6 3/2 1/8 | 0/2 1/2 0/4 -2/8 | 0/16",
        C:  "1/1 3/1 1/1 3/1 1/1 3/1 1/1 3/1 1/8 | r/16 | 6/1 8/1 6/1 8/1 6/1 8/1 6/1 8/1 6/8 | r/16",
      },
      acc: {
        drive: ["00.100.200.100.2", "00.100.200.1.2.4"],
        half:  ["0.......1.......", "0.......2...1.2."],
      },
      bass: {
        drive: ["0.......0.......", "0.......0...0..."],
        half:  ["0...............", "0.......0......."],
      },
      taiko: {
        main: ["D.ddD.d.D.ddD.k.", "D.ddD.d.DdddD.kk"],
        soft: ["D.......D.......", "D.......D...D.d."],
        fill: "DdDdDdDdDDDDDDk.",
      },
      wood: { tick: ["....x.......x...", "....x.......x.x."] },
      sec: {
        A:  { lead: "A", inst: "koto", chords: [IN_I, IN_I, IN_bII, IN_T], pad: [0, 1, 3, 5], acc: "drive", drum: "main", wood: "tick", vary: 0, resp: 0.5 },
        A2: { lead: "A2", inst: "koto", chords: [IN_I, IN_T, IN_bII, IN_I], pad: [-1, 1, 3, 5], acc: "drive", drum: "main", wood: "tick", vary: 0.3, resp: 0.6, fill: true },
        B:  { lead: ["B", "B2"], inst: "flute", chords: [IN_T, IN_bII, IN_I, IN_I], pad: [1, 3, 4, 6], acc: "drive", drum: "main", vary: 0.3, resp: 0.6, hetero: 0.4 },
        A3: { lead: "A", inst: "koto", chords: [IN_I, IN_I, IN_bII, IN_T], pad: [0, 1, 3, 5], acc: "drive", drum: "main", wood: "tick", vary: 0.55, resp: 0.5 },
        C:  { lead: "C", inst: "koto", chords: [IN_T, IN_T, IN_bII, IN_bII], pad: [1, 3, 6, 8], acc: "half", drum: "soft", vary: 0.25, resp: 0.8, fill: true },
        B3: { lead: ["B2", "B"], inst: "flute", chords: [IN_bII, IN_T, IN_I, IN_I], pad: [0, 1, 3, 5], acc: "drive", drum: "main", wood: "tick", vary: 0.5, resp: 0.5, hetero: 0.4, fill: true },
      },
      form: ["A", "A2", "B", "A3", "C", "B3"],
    },

    // ── 夜市: 陽旋法D（D-E-G-A-B）。跳ねるリズム（swing）、祭囃子のチャンチキ（当たり鉦）と拍子木。
    //    箏と篠笛が交互に主役。ブリッジは箏の呼び声に笛が応える「掛け声」
    pack: {
      bpm: 120, scale: "yo", tonic: 74, keys: [0, -5, -2, 0], swing: 0.18,
      accOct: -10, bassOct: -15, padOct: -10, taikoVel: 0.85, bell: 0.3, wet: 0.7,
      stable: [0, 2, 3], mix: { pad: 0.7 },
      phr: {
        A:  "0/2 1/2 2/2 1/2 0/4 -2/4 | -1/2 0/2 1/4 2/2 1/2 0/4 | 2/2 3/2 4/2 3/2 2/2 1/2 2/4 | 0/8 r/8",
        A2: "3/4 4/2 3/2 2/4 3/4 | 5/6 4/2 3/8 | 2/2 3/2 2/2 1/2 0/4 1/4 | 0/12 r/4",
        B:  "-2/1 -1/1 0/2 0/2 2/2 r/2 2/2 1/2 0/2 | 3/3 2/1 1/4 0/4 r/4 | -2/1 -1/1 0/2 1/2 2/2 3/2 2/2 1/2 0/2 | 1/4 -1/4 0/8",
        B2: "5/4 r/2 5/2 4/2 3/2 4/4 | 3/2 2/2 1/2 2/2 3/8 | 4/4 r/2 4/2 3/2 2/2 1/4 | 2/8 0/8",
        C:  "0/2 r/6 -1/2 r/6 | -2/2 -3/2 -4/2 -5/2 r/8 | 0/2 r/6 2/2 r/6 | 1/2 0/2 -1/2 -3/2 -5/8",
      },
      acc: {
        bounce:  ["0.2.1.2.0.2.1.2.", "0.21..2.0.21..4."],
        bounce2: ["0.2.12..0.2.12.4", "0.2.1.2.0.4.2.1."],
        half:    ["0.......1.......", "0...........2..."],
      },
      bass: {
        bounce:  ["0.......1.......", "0.......1...0..."],
        bounce2: ["0.......1.......", "0.....0.1......."],
        half:    ["0...............", "0.......1......."],
      },
      taiko: {
        main: ["D.....k.d.k.D.k.", "D.....k.d.k.D.kk"],
        soft: ["D...............", "........d......."],
        fill: "D.d.D.d.k.k.kkD.",
      },
      wood: {
        matsuri: ["..x.c...x.x.c...", "..x.c...x.xxc.c."],
        light:   ["....c.......c...", "....c.......c.x."],
      },
      sec: {
        A:  { lead: "A", inst: "koto", chords: [YO_I, YO_IV, YO_I, YO_V], pad: [0, 1, 3, 5], acc: "bounce", drum: "main", wood: "light", vary: 0, resp: 0.5 },
        A2: { lead: "A2", inst: "flute", chords: [YO_IV, YO_I, YO_ii, YO_I], acc: "bounce", drum: "main", wood: "matsuri", vary: 0.3, resp: 0.6, hetero: 0.3, fill: true },
        B:  { lead: "B", inst: "koto", chords: [YO_I, YO_ii, YO_IV, YO_I], pad: [0, 2, 3, 5], acc: "bounce2", drum: "main", wood: "matsuri", vary: 0.3, resp: 0.6 },
        B2: { lead: "B2", inst: "flute", chords: [YO_IV, YO_I, YO_V, YO_I], acc: "bounce2", drum: "main", wood: "matsuri", vary: 0.35, resp: 0.5, hetero: 0.4, fill: true },
        A3: { lead: "A", inst: "koto", chords: [YO_I, YO_IV, YO_I, YO_V], pad: [0, 1, 3, 5], acc: "bounce2", drum: "main", wood: "matsuri", vary: 0.6, resp: 0.4, hetero: 0.35 },
        C:  { lead: "C", inst: "koto", chords: [YO_I, YO_V, YO_IV, YO_I], acc: "half", drum: "main", wood: "matsuri", vary: 0.3, resp: 0.9, bell: 0.6, fill: true },
      },
      form: ["A", "A2", "B", "B2", "A3", "C"],
    },

    // ── 一年を祓い終えた: 陽旋法G。最初の1回だけ箏の駆け上がり＋太鼓の連打＋鈴のファンファーレ、
    //    そのあとは箏と笛の穏やかな祝い唄のループ
    win: {
      bpm: 96, scale: "yo", tonic: 67, keys: [0, 5], swing: 0.1,
      accOct: -5, bassOct: -10, padOct: -5, taikoVel: 0.8, bell: 0.5, wet: 1.0,
      stable: [0, 2, 3],
      phr: {
        F:  "-5/1 -4/1 -3/1 -2/1 -1/1 0/1 1/1 2/1 3/4 r/4 | 4/2 3/2 5/12",
        A:  "2/4 3/2 4/2 5/4 4/4 | 3/2 4/2 3/2 2/2 0/8 | 1/4 2/2 3/2 4/4 3/4 | 2/12 r/4",
        A2: "5/6 4/2 3/8 | 4/4 5/4 6/8 | 5/4 4/2 3/2 2/4 1/4 | 0/16",
        B:  "5/2 4/2 5/2 7/2 5/4 4/4 | 3/2 2/2 3/2 4/2 3/8 | 2/2 3/2 4/2 5/2 4/2 3/2 2/4 | 0/8 r/8",
      },
      acc: {
        fan:    ["0...............", "0.......1...2..."],
        gentle: ["0...2...1...2...", "0...2...1...4...", "0...1...2...4...", "0...2...1...2..."],
      },
      bass: {
        fan:    ["0...............", "0..............."],
        gentle: ["0.......1.......", "0..............."],
      },
      taiko: {
        fan:  ["DdddDdddDdddD...", "D...........k.k."],
        soft: ["D...............", "........d.......", "D.......d.......", "........d...d..."],
        fill: "D.......d.d.D.k.",
      },
      wood: { light: ["....c.......c...", "................"] },
      sec: {
        F:  { bars: 2, lead: "F", inst: "koto", chords: [YO_I, YO_I], pad: [0, 3, 5, 6], acc: "fan", drum: "fan", vary: 0, hetero: 1, bell: 1, once: true },
        A:  { lead: "A", inst: "koto", chords: [YO_I, YO_IV, YO_ii, YO_I], pad: [0, 3, 5, 6], acc: "gentle", drum: "soft", vary: 0.1, resp: 0.5 },
        A2: { lead: "A2", inst: "flute", chords: [YO_IV, YO_I, YO_V, YO_I], pad: [2, 5, 6, 7], acc: "gentle", drum: "soft", wood: "light", vary: 0.3, resp: 0.5, hetero: 0.3 },
        B:  { lead: "B", inst: "koto", chords: [YO_I, YO_V, YO_IV, YO_I], pad: [0, 3, 4, 5], acc: "gentle", drum: "soft", wood: "light", vary: 0.3, resp: 0.6, fill: true },
        A3: { lead: "A2", inst: "flute", chords: [YO_IV, YO_I, YO_V, YO_I], pad: [2, 5, 6, 7], acc: "gentle", drum: "soft", vary: 0.55, resp: 0.6, hetero: 0.3, bell: 0.4 },
      },
      form: ["F", "A", "A2", "B", "A3"],
    },

    // ── 敗北: 陰旋法A。とても遅く、まばら。笛が下降し、箏がぽつりと応える。太鼓は遠くに一打だけ
    lose: {
      bpm: 56, scale: "in", tonic: 69, keys: [0, -2], swing: 0,
      accOct: -5, bassOct: -10, padOct: -5, taikoVel: 0.4, bell: 0, wet: 1.4,
      stable: [0, 2, 3],
      phr: {
        A: "5/8 4/4 3/4 | 2/12 r/4 | 3/4 2/4 1/8 | 0/16",
        B: "r/4 0/4 -1/8 | -2/16 | r/4 -2/4 -3/4 -4/4 | -5/16",
        C: "2/16 | 1/8 0/8 | -1/8 -2/8 | r/16",
      },
      acc: { sparse: ["0...............", "........1.......", "0...............", "................"] },
      bass: { sparse: ["0...............", "................"] },
      taiko: { far: ["D...............", "................", "................", "................"], fill: "D..............." },
      wood: {},
      sec: {
        A:  { lead: "A", inst: "flute", chords: [IN_I, IN_IV, IN_bII, IN_I], pad: [0, 1, 3, 5], acc: "sparse", drum: "far", vary: 0, resp: 0.4 },
        B:  { lead: "B", inst: "koto", chords: [IN_I, IN_V, IN_bII, IN_I], pad: [-2, 0, 1, 3], acc: "sparse", vary: 0.2, resp: 0.5 },
        A2: { lead: "A", inst: "flute", chords: [IN_I, IN_IV, IN_bII, IN_I], pad: [0, 1, 3, 5], acc: "sparse", drum: "far", vary: 0.45, resp: 0.5, hetero: 0.3 },
        C:  { lead: "C", inst: "flute", chords: [IN_IV, IN_bII, IN_I, IN_I], pad: [1, 2, 4, 5], acc: "sparse", vary: 0.3, resp: 0.35 },
      },
      form: ["A", "B", "A2", "C"],
    },
  };
  // 旋律を1度だけ解析し、小節の長さが合っているか確かめておく
  const MIX0 = { koto: 1, flute: 1, taiko: 1, wood: 1, bell: 1, pad: 1 };
  Object.entries(TRACKS).forEach(([tn, T]) => {
    T.sc = SCALE[T.scale];
    T.ph = {};
    Object.entries(T.phr).forEach(([k, str]) => { T.ph[k] = parsePhrase(str); });
    T.mixAll = Object.assign({}, MIX0, T.mix || {});
    T.loopFrom = T.form.findIndex((n) => !T.sec[n].once);
    Object.entries(T.sec).forEach(([sn, S]) => {
      const want = (S.bars || 4) * 16;
      [].concat(S.lead || []).forEach((pn) => {
        const ph = T.ph[pn];
        if (!ph) warn.push(`${tn}.${sn}: 旋律 ${pn} が無い`);
        else if (ph.len !== want) warn.push(`${tn}.${sn}: 旋律 ${pn} の長さ ${ph.len}（${want}のはず）`);
      });
      ["acc", "bass"].forEach((k) => { if (S.acc && T[k][S.acc]) T[k][S.acc].forEach((b) => { if (b.length !== 16) warn.push(`${tn}.${k}.${S.acc}: "${b}"`); }); });
      if (S.drum && !T.taiko[S.drum]) warn.push(`${tn}.${sn}: 太鼓型 ${S.drum} が無い`);
      if (S.wood && !T.wood[S.wood]) warn.push(`${tn}.${sn}: 拍子木型 ${S.wood} が無い`);
    });
    Object.values(T.taiko).concat(Object.values(T.wood)).forEach((p) => {
      [].concat(p).forEach((b) => { if (b.length !== 16) warn.push(`${tn} 打楽器型: "${b}"`); });
    });
  });

  // ---------- 音源 ----------
  // 楽器ごとの残響の送り量（箏・笛・鈴は深め、太鼓は浅め）
  const SEND = { koto: 0.35, flute: 0.45, taiko: 0.14, wood: 0.22, bell: 0.55, pad: 0.35 };
  // 音域（MIDI）。旋律はフレーズごと、伴奏は1音ごとにこの中へオクターブで収める
  const RANGE = { flute: [60, 88], koto: [45, 88], acc: [38, 84] };

  function harmWave(amps) {
    const n = amps.length + 1;
    const real = new Float32Array(n), imag = new Float32Array(n);
    amps.forEach((a, i) => { imag[i + 1] = a; });
    return ctx.createPeriodicWave(real, imag);
  }
  // 箏: 弦の端近く（全長の約1/5）を爪で弾いた倍音。n次の振幅 ∝ |sin(nπp)| / n^1.1
  function kotoWave() {
    const amps = [];
    for (let n = 1; n <= 12; n++) amps.push(Math.abs(Math.sin(n * Math.PI * 0.21)) / Math.pow(n, 1.1));
    return harmWave(amps);
  }
  // マスター・コンプレッサー・残響・波形・ノイズを用意する（ctx を作った直後に1度だけ）
  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = MASTER_VOL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3;
    comp.attack.value = 0.006; comp.release.value = 0.25;
    master.connect(comp).connect(ctx.destination);
    // 簡易ホール: 長さ違いのフィードバック・ディレイ2本。帰還路のローパスで、響きが奥ほど丸くなる
    rev = ctx.createGain();
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    [[0.211, 0.42, 2600], [0.337, 0.36, 1900]].forEach(([dt, fb, lp]) => {
      const d = ctx.createDelay(1.0); d.delayTime.value = dt;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp;
      const g = ctx.createGain(); g.gain.value = fb;
      rev.connect(d); d.connect(f); f.connect(g); g.connect(d); f.connect(wet);
    });
    wet.connect(master);
    W = {
      koto: kotoWave(),
      flute: harmWave([1, 0.2, 0.07, 0.03]),           // 尺八・篠笛: ほぼ正弦波に少しだけ倍音
      drum: harmWave([1, 0.3, 0.12]),                  // 太鼓: 2・3倍音でスマホのスピーカーでも聞こえるように
      sho: harmWave([1, 0.5, 0.36, 0.22, 0.14, 0.08, 0.05]), // 笙: リード（簧）らしい倍音列
    };
    const len = Math.floor(ctx.sampleRate * 1.0);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  // 声部の出口: トラックのフェーダー（乾いた音）と、楽器ごとの残響送り
  function out(P, node, kind) {
    node.connect(P.fader);
    const s = P.sends[kind];
    if (s) node.connect(s);
  }
  // 鳴っている声部を数える（主な発振器が止まったら減らす）
  function life(src) {
    if (!counting) return;
    live++; voiceCount++;
    src.onended = () => { live--; };
  }

  // 箏。len=音価（秒）。opt.bend=下から押し上げる半音数（押し手）、opt.fall=余韻で少し下がる（引き色）
  function koto(P, t, midi, vel, len, opt) {
    const f = hz(midi);
    const lvl = 0.23 * vel * P.mix.koto;
    // 低い弦ほど長く響く。ただし音価＋0.55秒で切る（速い伴奏で発振器が溜まらないように）
    const ring = clamp(len + 0.55, 0.35, clamp(2.8 - (midi - 45) * 0.04, 0.8, 2.8));
    const o = ctx.createOscillator();
    o.setPeriodicWave(W.koto);
    const fq = o.frequency;
    if (opt && opt.bend) {
      const f0 = f * Math.pow(2, -opt.bend / 12);
      fq.setValueAtTime(f0, t);
      fq.setValueAtTime(f0, t + 0.06);
      fq.exponentialRampToValueAtTime(f, t + 0.16);
    } else {
      fq.setValueAtTime(f * 1.012, t);            // 弾いた瞬間は張力でわずかに高い
      fq.exponentialRampToValueAtTime(f, t + 0.05);
    }
    if (opt && opt.fall) {
      fq.setValueAtTime(f, t + ring * 0.55);
      fq.exponentialRampToValueAtTime(f * 0.975, t + ring);
    }
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(Math.min(f * 9, 9000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 400), t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.004);
    g.gain.exponentialRampToValueAtTime(lvl * 0.4, t + 0.09); // 爪の当たりの山はすぐ引く
    g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    o.connect(lp); lp.connect(g);
    out(P, g, "koto");
    life(o);
    o.start(t); o.stop(t + ring + 0.03);
  }

  // 尺八／篠笛。len=音価（秒）。opt.scoop=下からしゃくる、opt.quick=立ち上がり速め（装飾音の直後）、opt.breath=息の量
  function flute(P, t, midi, len, vel, opt) {
    opt = opt || {};
    const f = hz(midi);
    const lvl = 0.12 * vel * P.mix.flute;
    const att = opt.quick ? 0.025 : clamp(0.05 + len * 0.06, 0.06, 0.16);
    const rel = clamp(len * 0.25, 0.06, 0.22);
    const end = t + Math.max(len, att + 0.02);
    const o = ctx.createOscillator();
    o.setPeriodicWave(W.flute);
    if (opt.scoop) {
      o.frequency.setValueAtTime(f * 0.955, t);   // 約80セント下から
      o.frequency.exponentialRampToValueAtTime(f, t + Math.min(0.14, len * 0.5));
    } else o.frequency.setValueAtTime(f, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(lvl * 0.85, t + att);
    if (len > 0.6) g.gain.linearRampToValueAtTime(lvl, t + len * 0.55); // 長い音はふくらませる
    g.gain.linearRampToValueAtTime(lvl * (len > 0.6 ? 0.9 : 0.8), end);
    g.gain.linearRampToValueAtTime(0, end + rel);
    o.connect(g);
    out(P, g, "flute");
    life(o);
    o.start(t); o.stop(end + rel + 0.05);
    // ビブラート（ユリ）: 音の後半からかかり、長い音ほど深い（最大 約±24セント）
    if (len > 0.4) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.6 + Math.random() * 1.2;
      const lg = ctx.createGain();
      const depth = f * clamp(0.002 + len * 0.005, 0.002, 0.014);
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + Math.min(0.3, len * 0.35));
      lg.gain.linearRampToValueAtTime(depth, end);
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(end + rel + 0.05);
    }
    // 息: 帯域ノイズ。吹き始めに強く（ムラ息）、あとは薄く流れる
    const br = (opt.breath != null ? opt.breath : 1) * P.breath;
    if (br > 0) {
      const ns = ctx.createBufferSource();
      ns.buffer = noiseBuf; ns.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = clamp(f * 2, 700, 5000); bp.Q.value = 1.2;
      const ng = ctx.createGain();
      const nl = lvl * 1.1 * br;
      ng.gain.setValueAtTime(0, t);
      ng.gain.linearRampToValueAtTime(nl, t + Math.min(att, 0.05));
      ng.gain.linearRampToValueAtTime(nl * 0.3, Math.min(t + att + 0.12, end));
      ng.gain.linearRampToValueAtTime(0, end + rel);
      ns.connect(bp); bp.connect(ng);
      out(P, ng, "flute");
      ns.start(t, Math.random() * 0.5); ns.stop(end + rel + 0.05);
    }
  }

  // 和太鼓。kind: D=大きいドン d=小さいドン k=縁打ち（カッ）
  function taiko(P, t, kind, vel) {
    const lvl = 0.36 * vel * P.mix.taiko;
    if (kind === "k") { click(P, t, 820, lvl * 0.34, 0.05, "taiko"); return; }
    const big = kind === "D";
    const dec = big ? 0.75 : 0.42;
    const o = ctx.createOscillator();
    o.setPeriodicWave(W.drum);
    o.frequency.setValueAtTime(big ? 118 : 150, t);
    o.frequency.exponentialRampToValueAtTime(big ? 54 : 72, t + (big ? 0.22 : 0.15));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl * (big ? 1 : 0.7), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g);
    out(P, g, "taiko");
    life(o);
    o.start(t); o.stop(t + dec + 0.03);
    // 皮を打った瞬間の「バン」: ローパスしたノイズを一瞬
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = big ? 700 : 1100;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(lvl * 0.9, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 0.07 : 0.05));
    ns.connect(lp); lp.connect(ng);
    out(P, ng, "taiko");
    ns.start(t, Math.random() * 0.8); ns.stop(t + 0.09);
  }
  // 木の打音（拍子木・太鼓の縁）: 三角波をごく短く
  function click(P, t, freq, lvl, dec, kind) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.92, t + dec);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g);
    out(P, g, kind);
    life(o);
    o.start(t); o.stop(t + dec + 0.02);
  }
  // 拍子木（x=高 o=低）・当たり鉦（c）
  function wood(P, t, kind, vel) {
    const lvl = vel * P.mix.wood;
    if (kind === "x") click(P, t, 1850, 0.11 * lvl, 0.045, "wood");
    else if (kind === "o") click(P, t, 1150, 0.12 * lvl, 0.06, "wood");
    else if (kind === "c") {
      // チャンチキ: 非整数倍音3つを短く（金属の「チャン」）
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035 * lvl, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      out(P, g, "wood");
      [2380, 3520, 5190].forEach((fr, i) => {
        const o = ctx.createOscillator();
        o.frequency.value = fr;
        o.connect(g);
        if (i === 0) life(o);
        o.start(t); o.stop(t + 0.18);
      });
    }
  }
  // 神楽鈴: 高い非整数倍音＋ノイズを、数回「シャララ」と振る
  function bell(P, t, vel) {
    const lvl = 0.011 * vel * P.mix.bell;
    const shakes = 4 + Math.floor(Math.random() * 4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    let tt = t;
    for (let i = 0; i < shakes; i++) {
      const gap = 0.07 + Math.random() * 0.05;
      const a = lvl * (1 - i / (shakes + 1));
      g.gain.setValueAtTime(a, tt);
      g.gain.exponentialRampToValueAtTime(a * 0.3, tt + gap * 0.95);
      tt += gap;
    }
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.9);
    out(P, g, "bell");
    const endT = tt + 0.95;
    [4150, 5480, 6930, 8710].forEach((fr, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = fr * (0.97 + Math.random() * 0.06);
      o.connect(g);
      if (i === 0) life(o);
      o.start(t); o.stop(endT);
    });
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuf; ns.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7000;
    ns.connect(hp); hp.connect(g);
    ns.start(t); ns.stop(tt + 0.2);
  }
  // 笙の合竹（和音の持続）。ゆっくり湧き上がり、次の和音と重なりながら消える
  function pad(P, t, midis, len) {
    const lvl = 0.065 * P.mix.pad / midis.length;
    const att = Math.min(1.8, len * 0.35), rel = 1.6;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 1500; lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(lvl, t + att);
    g.gain.setValueAtTime(lvl, t + len);
    g.gain.linearRampToValueAtTime(0.0001, t + len + rel);
    lp.connect(g);
    out(P, g, "pad");
    if (P.long.length > 12) P.long = P.long.slice(-8); // 直近2和音ぶんだけ控える（曲切替で止める用）
    midis.forEach((m, i) => {
      const o = ctx.createOscillator();
      o.setPeriodicWave(W.sho);
      o.frequency.value = hz(m);
      o.detune.value = (Math.random() - 0.5) * 8; // 竹ごとのわずかなずれ（うなり）
      o.connect(lp);
      if (i === 0) life(o);
      o.start(t); o.stop(t + len + rel + 0.05);
      P.long.push(o);
    });
  }

  // イベント1つを発音ノードにする（先読み窓に入ったときだけ呼ばれる）
  function play(P, e, now) {
    const t = Math.max(e.t, now);
    try {
      switch (e.v) {
        case "koto": koto(P, t, e.m, e.vel, e.len, e.o); break;
        case "flute": flute(P, t, e.m, e.len, e.vel, e.o); break;
        case "taiko": taiko(P, t, e.k, e.vel); break;
        case "wood": wood(P, t, e.k, e.vel); break;
        case "bell": bell(P, t, e.vel); break;
        case "pad": pad(P, t, e.ms, e.len); break;
      }
    } catch (err) { /* 音は失敗しても無視 */ }
  }

  // ---------- 変奏 ----------
  // 主題 src（[{s,len,d}]）を強さ v（0〜0.9）で崩す。拍の合計は変えない（小節線がずれない）
  function vary(src, v, rng, stable) {
    const n = src.map((x) => ({ s: x.s, len: x.len, d: x.d }));
    // ① 1音ごとの変化（最初と最後の音＝フレーズの骨格は残す）
    const a = [];
    n.forEach((x, i) => {
      if (i === 0 || i === n.length - 1) { a.push(x); return; }
      const r = rng();
      if (x.len <= 4 && r < v * 0.3) { x.d += rng() < 0.5 ? 1 : -1; a.push(x); }       // 隣の音へ
      else if (x.len >= 8 && r < v * 0.55) {                                              // 長い音を分割（経過音・刺繍音）
        const h = Math.floor(x.len / 4) * 2;
        a.push({ s: x.s, len: h, d: x.d }, { s: x.s + h, len: x.len - h, d: x.d + pick(rng, [1, -1, 2]) });
      } else if (x.len <= 2 && r > 1 - v * 0.15) { /* 休符にする（息継ぎ・間） */ }
      else a.push(x);
    });
    // ② 付点化・先取り（隣り合う2音の長さの配分を変える＝リズムのずらし）
    for (let i = 0; i + 1 < a.length; i++) {
      const x = a[i], y = a[i + 1];
      if (y.s !== x.s + x.len) continue;
      const r = rng();
      if (x.len === y.len && (x.len === 2 || x.len === 4) && r < v * 0.18) {     // 付点（ターン・タ）
        const k = x.len / 2; x.len += k; y.s += k; y.len -= k;
      } else if (x.len >= 6 && y.len >= 2 && r > 1 - v * 0.15) {                    // 先取り（次の音を8分早く）
        x.len -= 2; y.s -= 2; y.len += 2;
      }
    }
    // ③ 終止音の差し替え（安定音のうち近いものへ）
    const last = a[a.length - 1];
    if (last && rng() < v * 0.25) {
      const o = Math.floor(last.d / 5) * 5;
      const c = stable.map((sd) => sd + o).filter((d) => d !== last.d);
      if (c.length) last.d = c.reduce((p, q) => (Math.abs(q - last.d) < Math.abs(p - last.d) ? q : p));
    }
    // ④ 装飾音の印（実際の装飾は楽器ごとに決める）。主題の初出でも少しは付ける
    a.forEach((x) => { x.gr = x.len >= 3 && rng() < 0.12 + v * 0.3; });
    return a;
  }

  // ---------- 作曲: 1セクションぶんのイベントを作って再生待ちの列に積む ----------
  // イベント: { t（秒）, v（楽器）, r（役: lead/resp/het/acc/bass）, m（MIDI）, len（秒）, vel, o（装飾）, k（打楽器の種類）}
  function renderSection(P) {
    const T = P.def, name = T.form[P.fi], S = T.sec[name];
    const rng = P.rng, SD = P.sd, t0 = P.gen;
    const bars = S.bars || 4, steps = bars * 16;
    const key = T.keys[P.cycle % T.keys.length];
    const v = Math.min(0.9, (S.vary || 0) + P.cycle * 0.12);   // 周回ごとに崩しを強める
    const ev = [];
    const at = (s) => t0 + s * SD + (T.swing && s % 4 === 2 ? T.swing * SD : 0);
    const dm = (d) => T.tonic + key + 12 * Math.floor(d / 5) + T.sc[((d % 5) + 5) % 5];
    const inRange = (m, R) => { while (m > R[1]) m -= 12; while (m < R[0]) m += 12; return m; };
    const fitShift = (ms, R) => {
      let sh = 0;
      const mx = Math.max(...ms), mn = Math.min(...ms);
      while (mx + sh > R[1]) sh -= 12;
      while (mn + sh < R[0]) sh += 12;
      return sh;
    };
    const K = (t, m, vel, len, r, o) => ev.push({ t: t + (rng() - 0.5) * 0.012, v: "koto", r, m, vel, len, o });
    const F = (t, m, len, vel, r, o) => ev.push({ t, v: "flute", r, m, len, vel, o });

    // ── 主旋律 ＋ ヘテロフォニー ＋ 掛け合い
    if (S.lead) {
      const opts = [].concat(S.lead);
      const pn = opts[(P.cycle + (rng() < 0.25 ? 1 : 0)) % opts.length];
      const inst = S.inst, other = inst === "flute" ? "koto" : "flute";
      const R = RANGE[inst], oct = S.oct || 0;
      const notes = vary(T.ph[pn].notes, v, rng, T.stable);
      let ms = notes.map((x) => dm(x.d + oct));
      const sh = fitShift(ms, R);            // フレーズごと平行移動して音域へ（旋律の形は崩さない）
      ms = ms.map((m) => m + sh);
      if (rng() < v * 0.25) {                // 半フレーズのオクターブ移し
        const second = rng() < 0.5, dir = rng() < 0.5 ? 12 : -12;
        const idx = [];
        notes.forEach((x, i) => { if ((x.s >= steps / 2) === second) idx.push(i); });
        if (idx.length && idx.every((i) => ms[i] + dir >= R[0] && ms[i] + dir <= R[1])) idx.forEach((i) => { ms[i] += dir; });
      }
      const up = (x) => dm(x.d + 1) - dm(x.d), down = (x) => dm(x.d) - dm(x.d - 1);

      notes.forEach((x, i) => {
        const m = ms[i], nx = notes[i + 1], t = at(x.s), lenS = x.len * SD;
        const rest = (nx ? nx.s : steps) - (x.s + x.len);
        if (inst === "flute") {
          const dur = lenS * (rest > 0 || !nx ? 0.9 : 0.98);  // 休みの前は息継ぎ
          if (x.gr && lenS > 0.25) {                          // 上の隣接音をかすめてから本音へ
            const g = 0.07;
            F(t, m + up(x), g, 0.8, "lead", { quick: true, breath: 0.6 });
            F(t + g, m, dur - g, 1, "lead", { quick: true });
          } else F(t, m, dur, 1, "lead", { scoop: x.len >= 6 && rng() < 0.3 });
        } else {
          const vel = 0.82 + rng() * 0.18, isLast = i === notes.length - 1;
          if (x.gr && rng() < 0.5) K(t, m, vel, lenS, "lead", { bend: Math.min(2, down(x)), fall: isLast }); // 押し手
          else if (x.gr) {                                    // 前打音: 上の隣接音を先に弾く
            const g = Math.min(0.09, SD * 0.5);
            K(t, m + up(x), vel * 0.6, g, "lead");
            K(t + g, m, vel, lenS - g, "lead", { fall: isLast && rng() < 0.5 });
          } else K(t, m, vel, lenS, "lead", { fall: isLast && rng() < 0.5 });
          if (x.len >= 8 && rng() < 0.3 + v * 0.3) {          // 長い音は後半で弾き直す（間が空きすぎないように）
            const m2 = m - 12 >= RANGE.koto[0] && rng() < 0.5 ? m - 12 : m;
            K(at(x.s + Math.floor(x.len / 2)), m2, vel * 0.5, lenS / 2, "lead");
          }
        }
      });

      // ヘテロフォニー: もう一方の楽器が骨格の音（長い音）を少し遅れてなぞる
      const busy = new Uint8Array(steps + 1);
      if (S.hetero) notes.forEach((x, i) => {
        if (x.len < 4 || rng() >= S.hetero) return;
        const late = rng() < 0.6 ? 1 : 0;
        if (inst === "flute") K(at(x.s + late), inRange(ms[i] - 12, RANGE.koto), 0.5, x.len * SD, "het");
        else {
          const m = inRange(ms[i], RANGE.flute);
          F(at(x.s + late), m, (x.len - late) * SD * 0.9, 0.55, "het", { breath: 0.7 });
        }
        for (let s = x.s; s < x.s + x.len && s <= steps; s++) busy[s] = 1;
      });

      // 掛け合い: 笛の長い音の下（または休み）に箏が動機を返す／箏の余韻に笛が応える
      if (S.resp) {
        const holes = [];
        notes.forEach((x, i) => {
          const endS = x.s + x.len, nxS = notes[i + 1] ? notes[i + 1].s : steps;
          if (x.len >= 8) holes.push({ a: x.s + (inst === "flute" ? 4 : 2), b: nxS, i });
          else if (nxS - endS >= 4) holes.push({ a: endS, b: nxS, i });
        });
        holes.forEach((h) => {
          if (rng() >= S.resp) return;
          for (let s = h.a; s < h.b; s++) if (busy[s]) return;
          const from = rng() < 0.5 ? 0 : Math.max(0, h.i - 2);           // 冒頭の動機 or 直前の動機
          const mot = notes.slice(from, from + 4).map((x) => x.d + oct);
          if (rng() < 0.3) mot.reverse();                                  // 逆行
          const koto = other === "koto";
          const tr = pick(rng, koto ? [-5, -3, -2, 0] : [0, 2, 5, -3]);   // 移高（度数）
          const rs = koto ? (T.bpm >= 110 ? pick(rng, [1, 2]) : 2) : 4;    // 箏は8分・16分、笛は4分
          const k = Math.min(mot.length, Math.floor((h.b - h.a - 1) / rs), koto ? 4 : 2);
          if (k < (koto ? 2 : 1)) return;
          let mm = mot.slice(0, k).map((d) => dm(d + tr) + sh);
          const Rr = koto ? RANGE.koto : RANGE.flute;
          const s2 = fitShift(mm, Rr);
          mm = mm.map((m) => m + s2);
          mm.forEach((m, j) => {
            const s = h.a + j * rs;
            if (koto) K(at(s), m, 0.62 - j * 0.04, rs * SD * (j === k - 1 ? 3 : 1), "resp");
            else F(at(s), m, (j === k - 1 ? h.b - 1 - s : rs) * SD * 0.92, 0.7, "resp", { scoop: rng() < 0.3 });
          });
        });
      }
    }

    // ── 小節ごと: 箏の伴奏・低音箏・太鼓・拍子木
    const chords = S.chords || [IN_I];
    const ct = (ch, k) => ch[k % ch.length] + 5 * Math.floor(k / ch.length); // 和音の k 番目の音（上はオクターブ上へ）
    for (let b = 0; b < bars; b++) {
      const ch = chords[b % chords.length], bs = b * 16, lastBar = b === bars - 1;
      const ap = S.acc && T.acc[S.acc];
      if (ap) {
        const str = ap[(b + P.cycle) % ap.length];      // 周回ごとに型の順番もずらす
        const run = lastBar && rng() < (S.fill ? 0.35 : 0.1) + v * 0.35;
        for (let p = 0; p < 16; p++) {
          const c = str[p];
          if (c === "." || (run && p >= 12)) continue;
          if (p > 0 && rng() < v * 0.1) continue;                       // 抜き
          let d = ct(ch, +c) + T.accOct;
          if (p > 0 && rng() < v * 0.07) d += 5;                         // オクターブ上へ跳ねる
          K(at(bs + p), inRange(dm(d), RANGE.acc), (p % 4 === 0 ? 0.6 : 0.48) * (0.9 + rng() * 0.2), SD * 2, "acc");
        }
        if (run) {                                                         // 小節末の駆け下り（さらり）
          const top = ct(ch, 2) + T.accOct + 2;
          for (let j = 0; j < 4; j++) K(at(bs + 12 + j), inRange(dm(top - j), RANGE.acc), 0.42 + j * 0.05, SD * (j === 3 ? 4 : 1), "acc");
        }
      }
      const bp = S.acc && T.bass[S.acc];
      if (bp) {
        const str = bp[b % bp.length];
        for (let p = 0; p < 16; p++) {
          if (str[p] === ".") continue;
          K(at(bs + p), inRange(dm(ct(ch, +str[p]) + T.bassOct), RANGE.acc), 0.75 * (0.92 + rng() * 0.16), SD * 6, "bass");
        }
      }
      const tp = S.drum && T.taiko[S.drum];
      if (tp) {
        let str = tp[b % tp.length];
        if (lastBar && S.fill && T.taiko.fill && rng() < 0.75) str = T.taiko.fill;
        const main = S.drum === "main";
        for (let p = 0; p < 16; p++) {
          const c = str[p];
          if (c === ".") {                                                 // 装飾打（ゴースト）
            if (main && p % 2 === 0 && rng() < v * 0.07) ev.push({ t: at(bs + p), v: "taiko", k: rng() < 0.5 ? "k" : "d", vel: T.taikoVel * 0.45 });
            continue;
          }
          if (c !== "D" && rng() < v * 0.08) continue;                    // 抜き
          const a = (p === 0 ? 1.1 : 1) * (c === "D" ? 1 : c === "d" ? 0.75 : 0.85);
          ev.push({ t: at(bs + p), v: "taiko", k: c, vel: T.taikoVel * a * (0.9 + rng() * 0.2) });
        }
      }
      const wp = S.wood && T.wood[S.wood];
      if (wp) {
        const str = wp[b % wp.length];
        for (let p = 0; p < 16; p++) {
          if (str[p] === "." || rng() < v * 0.1) continue;
          ev.push({ t: at(bs + p), v: "wood", k: str[p], vel: 0.8 + rng() * 0.25 });
        }
      }
    }

    // ── 神楽鈴（たまに）・笙の和音
    const bellP = S.bell != null ? S.bell : T.bell;
    if (bellP && rng() < bellP) ev.push({ t: at(pick(rng, [0, 0, 8, steps - 8])), v: "bell", vel: 0.8 + rng() * 0.2 });
    if (S.pad) ev.push({ t: t0, v: "pad", ms: S.pad.map((d) => inRange(dm(d + T.padOct), [40, 79])), len: steps * SD });

    ev.sort((a, b) => a.t - b.t);
    for (let i = 0; i < ev.length; i++) P.q.push(ev[i]);
    P.sec = name; P.sections++;
    P.gen = t0 + steps * SD;
    P.fi++;
    if (P.fi >= T.form.length) { P.fi = T.loopFrom; P.cycle++; }
    return ev;
  }

  // ---------- 再生状態とスケジューラ ----------
  // 曲ごとに専用のフェーダー（乾いた音）と残響送りを持たせる＝切り替え時に旧曲だけを消せる
  function newPlayback(name, t0) {
    const T = TRACKS[name];
    const fader = ctx.createGain();
    fader.connect(master);
    const sendF = ctx.createGain();
    sendF.gain.value = T.wet;
    sendF.connect(rev);
    const sends = {};
    Object.keys(SEND).forEach((k) => {
      const g = ctx.createGain();
      g.gain.value = SEND[k];
      g.connect(sendF);
      sends[k] = g;
    });
    return {
      name, def: T, fader, sendF, sends, mix: T.mixAll, breath: T.breath || 1, long: [],
      rng: makeRng(nextSeed()), sd: 60 / T.bpm / 4, gen: t0, q: [], fi: 0, cycle: 0, sec: null, sections: 0,
    };
  }
  // 旧曲を dur 秒で消す。まだ鳴らしていない予定は捨て、長く伸びる笙も止める
  function fadeOut(P, dur) {
    if (!P || !ctx) return;
    const now = ctx.currentTime;
    P.q.length = 0;
    [P.fader.gain, P.sendF.gain].forEach((g) => {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + dur);
    });
    P.long.forEach((o) => { try { o.stop(now + dur + 0.05); } catch (e) { /* 無視 */ } });
    P.long = [];
    setTimeout(() => { try { P.fader.disconnect(); P.sendF.disconnect(); } catch (e) { /* 無視 */ } }, (dur + 0.6) * 1000);
  }

  // 先読みスケジューラ本体（TICK_MS ごと）: 足りなければ次のセクションを作曲し、
  // 0.2秒先までに鳴るイベントだけ発音ノードにする
  function tick() {
    if (!playing || !ctx || !cur) return;
    const P = cur, now = ctx.currentTime;
    if (P.gen < now) { P.q.length = 0; P.gen = now + 0.05; } // 処理落ちで大きく遅れたら、次のフレーズ頭から立て直す
    while (P.gen < now + LOOKAHEAD + 0.15) renderSection(P);
    const horizon = now + LOOKAHEAD;
    let i = 0;
    while (i < P.q.length && P.q[i].t < horizon) {
      const e = P.q[i++];
      if (e.t >= now - 0.03) play(P, e, now); // 遅れすぎた音は鳴らさない（まとめて鳴るのを防ぐ）
    }
    if (i) P.q.splice(0, i);
  }

  // ---------- デバッグ（dev/bgm-test.html 用。ゲーム本体は使わない） ----------
  // 音は出さずに count セクションぶん作曲し、楽器ごとの音域・音数、同じセクションの旋律が何通りに化けたかを返す
  function analyze(name, count, seed) {
    const T = TRACKS[name];
    if (!T) return null;
    const P = { def: T, rng: makeRng(seed || 12345), sd: 60 / T.bpm / 4, gen: 0, q: [], fi: 0, cycle: 0, sec: null, sections: 0 };
    const st = { sections: [], range: {}, count: {}, seconds: 0, variants: {} };
    for (let i = 0; i < count; i++) {
      const cyc = P.cycle;
      const ev = renderSection(P);
      st.sections.push(`${P.sec}@${cyc}`);
      const sig = ev.filter((e) => e.r === "lead").map((e) => `${e.m}:${Math.round((e.t - ev[0].t) / P.sd)}`).join(",");
      (st.variants[P.sec] = st.variants[P.sec] || new Set()).add(sig);
    }
    P.q.forEach((e) => {
      const k = e.v + (e.r ? "." + e.r : "");
      st.count[k] = (st.count[k] || 0) + 1;
      (e.ms || (e.m != null ? [e.m] : [])).forEach((m) => {
        const r = st.range[k] || (st.range[k] = [999, 0]);
        r[0] = Math.min(r[0], m); r[1] = Math.max(r[1], m);
      });
    });
    Object.keys(st.variants).forEach((k) => { st.variants[k] = st.variants[k].size; });
    st.seconds = +P.gen.toFixed(1);
    return st;
  }
  // OfflineAudioContext で seconds 秒ぶん実際に合成し、ピーク・RMS（1秒ごと）と NaN の有無を返す（音量の確認用）
  //   mix を渡すと楽器ごとの音量倍率を上書きできる（例 {taiko:0} で太鼓抜きの音量を測る）
  async function offline(name, seconds, mix) {
    const T = TRACKS[name];
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!T || !OAC) return null;
    const sr = 24000;
    const oc = new OAC(1, Math.ceil(sr * seconds), sr);
    const save = { ctx, master, rev, W, noiseBuf };
    let rendering, nEv = 0;
    try {
      ctx = oc; counting = false;
      buildGraph();
      const P = newPlayback(name, 0.05);
      if (mix) P.mix = Object.assign({}, P.mix, mix);
      while (P.gen < seconds) renderSection(P);
      P.q.forEach((e) => { if (e.t < seconds - 0.05) { play(P, e, 0); nEv++; } });
      rendering = oc.startRendering();
    } finally {
      ({ ctx, master, rev, W, noiseBuf } = save);
      counting = true;
    }
    const d = (await rendering).getChannelData(0);
    let peak = 0, sum = 0, nan = 0;
    const perSec = [];
    for (let s = 0; s * sr < d.length; s++) {
      let p = 0, q = 0, n = 0;
      for (let i = s * sr; i < Math.min(d.length, (s + 1) * sr); i++) {
        const x = d[i];
        if (x !== x) { nan++; continue; }
        const ax = Math.abs(x);
        if (ax > p) p = ax;
        q += x * x; n++;
      }
      perSec.push([+p.toFixed(3), +Math.sqrt(q / Math.max(1, n)).toFixed(4)]);
      peak = Math.max(peak, p); sum += q;
    }
    const rms = Math.sqrt(sum / d.length);
    return { events: nEv, peak: +peak.toFixed(3), rms: +rms.toFixed(4), rmsDb: +(20 * Math.log10(rms || 1e-9)).toFixed(1), nan, perSec };
  }

  // ---------- スマホ対策（v28.1） ----------
  // ① iPhoneの「サイレントスイッチ（マナーモード）」ではWebAudioの音が出ない。
  //    <audio>要素で何か1つでも再生すると、そのページの音声セッションが「メディア再生」扱いになり
  //    スイッチONでも鳴るようになる——ので、無音のWAVをループさせておく（iOSの既知の挙動）。
  // ② 端末やブラウザによっては最初の resume() が通らないことがある。そのときは
  //    「次のタップでもう一度試す」を鳴り出すまで繰り返す（黙って失敗したままにしない）。
  let silentEl = null;
  // 無音WAVを実行時に組み立てる（外部ファイル・base64の呪文を持たずに済む）
  function silentWavUrl() {
    const sr = 8000, n = 8000; // 8kHz×1秒＝16KB。中身は全部0＝無音
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const put = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    put(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); put(8, "WAVE");
    put(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    put(36, "data"); v.setUint32(40, n * 2, true);
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  }
  function primeSession() {
    try {
      if (!silentEl) {
        silentEl = document.createElement("audio");
        silentEl.loop = true;
        silentEl.setAttribute("playsinline", ""); // iOSで全画面プレイヤーに乗っ取られないように
        silentEl.src = silentWavUrl();
        // DOMに入れておく（切り離したままだと再生を拒む実装がある）。controls無しなので何も表示されない。
        // display:none にすると逆に再生されない環境があるため、見えない位置に置くだけにする
        silentEl.style.cssText = "position:fixed;width:0;height:0;opacity:0;pointer-events:none";
        document.body.appendChild(silentEl);
      }
      const p = silentEl.play();
      if (p && p.catch) p.catch(() => { /* 失敗しても本体の再生には影響しない */ });
    } catch (e) { /* 無視 */ }
  }
  function releaseSession() {
    try { if (silentEl) silentEl.pause(); } catch (e) { /* 無視 */ }
  }

  // 「次のユーザー操作でもう一度鳴らしにいく」予約。pointerdown を拾えない端末のために
  // touchend / click も見る（capture＝ゲーム側のハンドラより先に走る）
  const UNLOCK_EVENTS = ["pointerdown", "touchend", "click"];
  let armed = false;
  function armUnlock() {
    if (armed) return;
    armed = true;
    const go = () => {
      armed = false;
      UNLOCK_EVENTS.forEach(t => document.removeEventListener(t, go, true));
      if (enabled) start();
    };
    UNLOCK_EVENTS.forEach(t => document.addEventListener(t, go, true));
  }

  function start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    primeSession(); // サイレントスイッチ対策は「鳴らそうとするたび」に張り直す
    if (!ctx) {
      ctx = new AC();
      buildGraph();
    }
    if (ctx.state !== "running") {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => { /* 下の再判定で拾う */ });
    }
    if (!playing) {
      playing = true;
      cur = newPlayback(trackName, ctx.currentTime + 0.12); // 曲の頭（フレーズの頭）から
      // 先読みスケジューラ: 25msごとに 0.2秒先まで音を予約し続ける
      timer = setInterval(tick, TICK_MS);
    }
    // resume が通っていなければ、次のタップでやり直す（鳴るまで諦めない）
    setTimeout(() => { if (enabled && ctx && ctx.state !== "running") armUnlock(); }, 350);
  }

  function stop() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (ctx && cur) fadeOut(cur, 0.3); // ブツッと切らずに短く消す
    cur = null;
    releaseSession();
  }

  // 裏タブ・スリープではタイマーが1秒間隔まで間引かれて先読みが破綻するので、AudioContextごと止める。
  // suspend 中は currentTime も止まるため、戻ったときに続きから鳴り出す。
  document.addEventListener("visibilitychange", () => {
    if (!ctx || !playing) return;
    if (document.hidden) { ctx.suspend(); releaseSession(); }
    else { primeSession(); ctx.resume(); armUnlockIfStuck(); }
  });
  // 復帰時の resume はユーザー操作なしなので拒否されることがある（特にiOS）。
  // 少し待って走っていなければ、次のタップで鳴らし直す
  function armUnlockIfStuck() {
    setTimeout(() => { if (enabled && ctx && ctx.state !== "running") armUnlock(); }, 350);
  }

  return {
    get enabled() { return enabled; },
    // 実際に音が出ている状態か（UI側の「鳴らなかった」案内の判定に使う）
    get running() { return !!(playing && ctx && ctx.state === "running"); },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch (e) { /* 無視 */ }
      if (enabled) start(); else stop(); // ボタンクリック＝ユーザー操作なのでそのまま再生できる
      return enabled;
    },
    // いま選ばれている曲名。場面の前後で戻したいときに控えておくために使う
    get track() { return trackName; },
    // 曲を切り替える（未知の名前・同じ曲は無視）。鳴っていれば旧曲を0.8秒で消し、新曲をフレーズの頭から始める。
    // 鳴っていなければ次に鳴るときの曲だけ変える
    setTrack(name) {
      if (!Object.prototype.hasOwnProperty.call(TRACKS, name) || name === trackName) return;
      trackName = name;
      if (playing && ctx) {
        fadeOut(cur, FADE_OUT);
        cur = newPlayback(name, ctx.currentTime + START_GAP);
      }
    },
    // 起動時に呼ぶ。**既定はON**（v28.2）＝初めて遊ぶ人にも音楽が流れる。
    // 一度でもBGMボタンを押した人はその選択（localStorage）を尊重する。
    // 実際の再生開始はブラウザの自動再生制限があるため「最初のタップ」を待つ
    init() {
      try {
        const saved = localStorage.getItem(KEY);
        enabled = saved === null ? true : saved === "1";
      } catch (e) { enabled = true; }
      if (enabled) armUnlock();
      return enabled;
    },
    // ---- 以下はデバッグ用（ゲーム本体からは使わない） ----
    get _debug() {
      return {
        ctx: ctx ? ctx.state : "none", time: ctx ? +ctx.currentTime.toFixed(2) : 0, playing, enabled,
        track: trackName, section: cur ? cur.sec : null, cycle: cur ? cur.cycle : 0, sections: cur ? cur.sections : 0,
        queued: cur ? cur.q.length : 0, live, voices: voiceCount, warnings: warn.slice(),
      };
    },
    _analyze: analyze,
    _offline: offline,
  };
})();
