// ============================================================
// bgm.js — BGM（WebAudioで生成。外部ファイル不要・オフライン動作）
// ------------------------------------------------------------
// v28: ファミコン（2A03）風のチップチューンに作り替え。
//   矩形波2ch（パルス・デューティ比を PeriodicWave で再現）＋ 三角波ベース1ch ＋ ノイズ1ch、
//   という実機と同じ編成を模した簡易シーケンサ。曲データは16分音符×16 の文字列で書く。
//   ・pulse1 … 主旋律（デューティ 25% or 12.5%）
//   ・pulse2 … 和音アルペジオ（1音ずつ高速に回して和音に聞かせる、チップチューンの定番）
//   ・tri    … ベース（三角波。ファミコンの三角波は音量固定なので、ここでも一定音量で鳴らす）
//   ・noise  … ドラム（キック＝ピッチ落ち、スネア／ハイハット＝ノイズ）
//
// 曲は6つ。BGM.setTrack(name) で場面ごとに切り替える。
//   title  … オープニング／ステージ選択／アルバム・デッキ構築などメニュー全般
//   battle … 対戦中（startGame で切り替え、タイトルへ戻ると title に戻る）
//   boss   … ボスステージ（stages.js に boss:true があるS15・S16）の対戦中
//   win    … 勝利（showGameOver の冒頭で切り替え）
//   lose   … 敗北（同上）
//   pack   … カードパック開封中（showPackReveal が前の曲を控えて開封後に戻す）
// 場面を増やすときは TRACKS にエントリを足して setTrack を呼ぶだけでよい。
// ヘッダーの🎵ボタンでON/OFF（localStorageに保存）。**既定はON**（v28.2）。
//
// 【スマホで鳴らせるようにするための処理（v28.1）】ここが一番の落とし穴なので触るとき注意:
//   ・自動再生制限 … ONで保存されていても再生開始は「最初のタップ」を待つ（armUnlock）
//   ・iPhoneのサイレントスイッチ … WebAudioだけだとマナーモードで無音になる。
//     無音WAVを <audio> でループ再生してセッションを「メディア再生」に上げる（primeSession）
//   ・resume() が通らない端末 … 鳴り出すまで「次のタップで再挑戦」を繰り返す（armUnlock の再武装）
// ============================================================
"use strict";

const BGM = (() => {
  const KEY = "shiki-emaki-bgm"; // ON/OFF はプレイヤー共通
  let ctx = null, master = null, timer = null;
  let nextTime = 0, step = 0;
  let enabled = false; // ユーザーの希望（ONでも再生開始はユーザー操作後）
  let playing = false;
  let waves = null;    // デューティ比ごとの PeriodicWave（ctx生成後にキャッシュ）
  let noiseBuf = null; // ノイズ用のホワイトノイズバッファ
  let trackName = "title";

  // ---------- 曲データ ----------
  // 1小節＝16分音符×16 トークン。 音名（c4 / g#5 / bb3）／ "." 休符 ／ "-" 直前の音を伸ばす。
  // ドラムは1文字ずつ: k=キック s=スネア h=ハイハット . =休み
  const NOTE_STEP = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function noteMidi(tok) {
    const m = /^([a-g])([#b]?)(-?\d)$/.exec(tok);
    if (!m) return 0;
    const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
    return (Number(m[3]) + 1) * 12 + NOTE_STEP[m[1]] + acc;
  }
  // "a4 - c5 - . ..." → [{pos, note, len}]（len は16分音符いくつぶん伸ばすか）
  function parseMelody(str) {
    const ev = [];
    let last = null;
    str.trim().split(/\s+/).forEach((tk, i) => {
      if (tk === "-") { if (last) last.len++; return; }
      if (tk === ".") { last = null; return; }
      last = { pos: i, note: noteMidi(tk), len: 1 };
      ev.push(last);
    });
    return ev;
  }
  function parseDrums(str) { return str.trim().split(/\s+/); }

  const TRACKS = {
    // タイトル: ゆったりとした行進曲。旅立ちの前の高揚感
    title: {
      tempo: 112,
      leadDuty: 0.5,   // 50%＝太い矩形波。ゆったりした主旋律に合う
      arpStep: 2,      // アルペジオは8分音符ごと（穏やかに）
      bass: "r - - - - - - - 5 - - - - - - -",
      drums: "k . . . h . . . . . . . h . . .",
      lead: [
        "e5 - - - g5 - - - c6 - - - - - - -",
        "b5 - - - a5 - - - g5 - - - - - - -",
        "a5 - - - g5 - - - e5 - - - - - - -",
        "f5 - - - g5 - - - a5 - - - - - - -",
        "g5 - - - e5 - - - c5 - - - - - - -",
        "d5 - - - f5 - - - b4 - - - - - - -",
        "c5 - - - d5 - - - e5 - - - f5 - - -",
        "g5 - - - - - - - d5 - - - - - - -",
      ],
      // 小節ごとの和音（アルペジオ用）とベースのルート音
      chords: [[48, 52, 55], [43, 47, 50], [45, 48, 52], [41, 45, 48],
               [48, 52, 55], [43, 47, 50], [41, 45, 48], [43, 47, 50]],
      roots: [36, 43, 45, 41, 36, 43, 41, 43],
    },
    // 対戦中: 走るような8ビート。Am中心で最後だけE7に上げて緊張を作る
    battle: {
      tempo: 152,
      leadDuty: 0.25,  // 25%＝細く抜ける音。速い旋律でも埋もれない
      arpStep: 1,      // アルペジオは16分（高速回し＝ファミコンらしい和音）
      bass: "r - r - r - 5 - r - r - 5 - 8 -",
      drums: "k . h . s . h . k . h . s . h .",
      lead: [
        "a4 - c5 - e5 - c5 - d5 - b4 - a4 - - -",
        "e5 - d5 - c5 - b4 - a4 - b4 - c5 - d5 -",
        "f5 - e5 - d5 - c5 - a4 - - - . . . .",
        "g4 - b4 - d5 - g5 - f5 - d5 - b4 - - -",
        "c5 - e5 - g5 - e5 - c5 - d5 - e5 - - -",
        "a5 - g5 - e5 - d5 - c5 - b4 - a4 - - -",
        "f5 - a5 - g5 - f5 - e5 - c5 - a4 - - -",
        "b4 - c5 - b4 - g#4 - e4 - - - . . . .",
      ],
      chords: [[57, 60, 64], [57, 60, 64], [53, 57, 60], [55, 59, 62],
               [48, 52, 55], [57, 60, 64], [53, 57, 60], [52, 56, 59]],
      roots: [45, 45, 41, 43, 48, 45, 41, 40],
      // 8小節目だけドラムのフィル（次のループへの助走）
      drumsLast: "k . h . s . h . s . s . s s s s",
    },
    // ボス戦（S15五王の間・S16時流の玉座）: Dハーモニックマイナーの追い立てるような速い曲。
    // 「ここは特別な相手だ」と音で分からせるための1曲
    boss: {
      tempo: 168,
      leadDuty: 0.25,
      arpStep: 1,
      bass: "r - r - r - r - r - r - 5 - 8 -",
      drums: "k . h . s . h . k . k . s . h h",
      drumsLast: "k . s . k . s . s s s s s s s s",
      lead: [
        "d5 - - - a4 - - - d5 - f5 - e5 - d5 -",
        "c#5 - - - a4 - - - c#5 - e5 - d5 - - -",
        "bb4 - - - d5 - - - f5 - d5 - bb4 - - -",
        "a4 - c#5 - e5 - c#5 - a4 - - - - - - -",
        "d5 - f5 - a5 - f5 - d5 - e5 - f5 - - -",
        "g5 - - - bb5 - - - a5 - g5 - f5 - - -",
        "e5 - - - c#5 - - - a4 - c#5 - e5 - a5 -",
        "d5 - - - - - - - a4 - - - d5 - - -",
      ],
      chords: [[50, 53, 57], [50, 53, 57], [46, 50, 53], [45, 49, 52],
               [50, 53, 57], [43, 46, 50], [45, 49, 52], [50, 53, 57]],
      roots: [38, 38, 34, 33, 38, 43, 33, 38],
    },
    // 勝利: ハ長調のファンファーレ。太い50%矩形波＋打ち上げるようなドラム
    win: {
      tempo: 132,
      leadDuty: 0.5,
      arpStep: 2,
      bass: "r - - - 5 - - - r - - - 5 - - -",
      drums: "k . k . s . h h k . k . s h s h",
      drumsLast: "s . s . s . s . k . s . s s s s",
      lead: [
        "c5 - e5 - g5 - - - c6 - - - - - - -",
        "a5 - - - g5 - - - f5 - - - e5 - - -",
        "d5 - - - g5 - - - b5 - - - a5 - - -",
        "g5 - - - - - - - c6 - - - - - - -",
        "a5 - - - e5 - - - a5 - g5 - e5 - - -",
        "f5 - - - a5 - - - c6 - - - a5 - - -",
        "b5 - - - a5 - - - g5 - f5 - d5 - - -",
        "c6 - - - - - - - - - - - - - - -",
      ],
      chords: [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55],
               [57, 60, 64], [53, 57, 60], [55, 59, 62], [48, 52, 55]],
      roots: [36, 41, 43, 36, 45, 41, 43, 36],
    },
    // 敗北: 下降するイ短調。ドラムは無し（全部休符）＝静けさで負けを伝える
    lose: {
      tempo: 84,
      leadDuty: 0.5,
      arpStep: 4,
      bass: "r - - - - - - - - - - - - - - -",
      drums: ". . . . . . . . . . . . . . . .",
      lead: [
        "a4 - - - - - - - g4 - - - e4 - - -",
        "f4 - - - - - - - e4 - - - d4 - - -",
        "e4 - - - - - - - g#4 - - - b4 - - -",
        "a4 - - - - - - - - - - - - - - -",
      ],
      chords: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]],
      roots: [45, 38, 40, 45],
    },
    // カードパック開封: 高音域で跳ねる細い矩形波（12.5%）＝きらめきとワクワク
    pack: {
      tempo: 144,
      leadDuty: 0.125,
      arpStep: 1,
      bass: "r - r - 5 - r - r - r - 5 - 8 -",
      drums: "k . h h s . h h k . h h s . h h",
      lead: [
        "e5 - g5 - c6 - g5 - e6 - c6 - g5 - - -",
        "a5 - c6 - e6 - c6 - a5 - g5 - e5 - - -",
        "f5 - a5 - c6 - a5 - f6 - c6 - a5 - - -",
        "g5 - b5 - d6 - b5 - g5 - a5 - b5 - d6 -",
      ],
      chords: [[48, 52, 55], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
      roots: [36, 45, 41, 43],
    },
  };
  // 文字列データを1度だけイベント配列に変換しておく
  Object.values(TRACKS).forEach(t => {
    t._lead = t.lead.map(parseMelody);
    // ベースは「ルートからの音程差」だけ持たせ、実際の高さは小節の roots と足して決める
    t._bassDeg = t.bass.trim().split(/\s+/).map(tk => (tk === "r" ? 0 : tk === "5" ? 7 : tk === "8" ? 12 : null));
    t._drums = parseDrums(t.drums);
    t._drumsLast = parseDrums(t.drumsLast || t.drums);
  });

  const hz = n => 440 * Math.pow(2, (n - 69) / 12);

  // ---------- 音源 ----------
  // デューティ比 d の矩形波を PeriodicWave で作る（n倍音の振幅 = 2/(nπ)·sin(nπd)）
  function pulseWave(d) {
    const N = 20;
    const real = new Float32Array(N), imag = new Float32Array(N);
    for (let i = 1; i < N; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * d);
    return ctx.createPeriodicWave(real, imag);
  }
  function buildVoices() {
    waves = { 0.125: pulseWave(0.125), 0.25: pulseWave(0.25), 0.5: pulseWave(0.5) };
    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  // 矩形波1音。ファミコンらしく「立ち上がりは一瞬・音量は一定・終わりでスパッと切る」
  function pulse(freq, t, dur, vol, duty) {
    try {
      const o = ctx.createOscillator();
      o.setPeriodicWave(waves[duty] || waves[0.5]);
      o.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.004);      // 4msだけ立ち上げてプチッというノイズを防ぐ
      g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.012));
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* 音は失敗しても無視 */ }
  }
  // 三角波ベース
  function tri(freq, t, dur, vol) {
    try {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(freq, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.005);
      g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.02));
      g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* 無視 */ }
  }
  // ノイズ（スネア/ハイハット）。hp を上げるほど軽い音になる
  function noise(t, dur, vol, hp) {
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = hp;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch (e) { /* 無視 */ }
  }
  // キック: 三角波のピッチを一気に落とす（ファミコンの定番の作り方）
  function kick(t, vol) {
    try {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.16);
    } catch (e) { /* 無視 */ }
  }

  // ---------- シーケンサ ----------
  const stepSec = () => 60 / TRACKS[trackName].tempo / 4; // 16分音符1つの長さ

  function scheduleStep(s, t) {
    const T = TRACKS[trackName];
    const S = stepSec();
    const nb = T._lead.length;
    const bar = Math.floor(s / 16) % nb;
    const pos = s % 16;
    const last = bar === nb - 1;

    // 主旋律（pulse1）
    T._lead[bar].forEach(e => {
      if (e.pos === pos) pulse(hz(e.note), t, S * e.len * 0.94, 0.15, T.leadDuty);
    });
    // 和音アルペジオ（pulse2）: 12.5%の細い音で低めに
    if (pos % T.arpStep === 0) {
      const ch = T.chords[bar];
      const n = ch[Math.floor(pos / T.arpStep) % ch.length];
      pulse(hz(n + 12), t, S * T.arpStep * 0.85, 0.055, 0.125);
    }
    // ベース（三角波）
    const deg = T._bassDeg[pos];
    if (deg != null) {
      let len = 1;
      while (pos + len < 16 && T._bassDeg[pos + len] == null) len++;
      tri(hz(T.roots[bar] + deg), t, S * len * 0.9, 0.22);
    }
    // ドラム（ノイズ）
    const dr = (last ? T._drumsLast : T._drums)[pos];
    if (dr === "k") kick(t, 0.3);
    else if (dr === "s") noise(t, 0.11, 0.12, 1200);
    else if (dr === "h") noise(t, 0.035, 0.05, 6000);
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
      master = ctx.createGain();
      master.gain.value = 0.34; // スマホのスピーカーでも聞こえる程度に（PCで大きすぎない上限）
      master.connect(ctx.destination);
      buildVoices();
    }
    if (ctx.state !== "running") {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => { /* 下の再判定で拾う */ });
    }
    if (!playing) {
      playing = true;
      step = 0;
      nextTime = ctx.currentTime + 0.12;
      // 先読みスケジューラ: 0.4秒先まで音を予約し続ける（タブが重くても途切れにくい）
      timer = setInterval(() => {
        if (!playing || !ctx) return;
        while (nextTime < ctx.currentTime + 0.4) {
          scheduleStep(step, nextTime);
          step++;
          nextTime += stepSec();
        }
      }, 130);
    }
    // resume が通っていなければ、次のタップでやり直す（鳴るまで諦めない）
    setTimeout(() => { if (enabled && ctx && ctx.state !== "running") armUnlock(); }, 350);
  }

  function stop() {
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
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
    // いま選ばれている曲名。場面の前後で戻したいとき（パック開封など）に控えておくために使う
    get track() { return trackName; },
    // 曲を切り替える。鳴っていなければ次に鳴るときの曲だけ変える
    setTrack(name) {
      if (!TRACKS[name] || name === trackName) return;
      trackName = name;
      // 予約済みの音（先読み0.4秒ぶん）は鳴り切ってから入れ替わる。曲の頭から鳴らし直す
      step = 0;
    },
    // 起動時に呼ぶ。**既定はON**（v28.2）＝初めて遊ぶ人にも音楽が流れる。
    // 一度でも🎵を押した人はその選択（localStorage）を尊重する。
    // 実際の再生開始はブラウザの自動再生制限があるため「最初のタップ」を待つ
    // ＝オープニング画面の「✦ クリック / タップ で始める ✦」がそのまま再生の合図になる
    init() {
      try {
        const saved = localStorage.getItem(KEY);
        enabled = saved === null ? true : saved === "1";
      } catch (e) { enabled = true; }
      if (enabled) armUnlock();
      return enabled;
    },
  };
})();
