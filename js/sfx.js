// ============================================================
// sfx.js — 効果音（WebAudioで合成・外部ファイル不要）
//   和の音色を模した小さな合成器: 琴の爪弾き（pluck）・拍子木（wood）・太鼓（taiko）・鈴（bell）
//   採点の「文」は都節音階を一段ずつ上っていく＝数えるほど気持ちよく音が昇る。
// ============================================================
"use strict";

const SFX = (() => {
  const KEY = "shiki-hana-sfx";
  let ctx = null, out = null;
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== "0"; } catch (e) { /* */ }

  function ac() {
    if (!enabled) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { enabled = false; return null; }
        ctx = new AC();
        out = ctx.createGain();
        out.gain.value = 0.9;
        const comp = ctx.createDynamicsCompressor();
        out.connect(comp).connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  // 琴の爪弾き
  function pluck(freq, vol = 0.12, dur = 0.5, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    [[1, "triangle", 1], [2, "sine", 0.35], [3, "sine", 0.12]].forEach(([mul, type, v]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq * mul * 1.004, t);
      o.frequency.exponentialRampToValueAtTime(freq * mul, t + 0.05);
      env(g, t, 0.004, vol * v, dur);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }
  // ノイズ
  let nbuf = null;
  function noiseBuf(c) {
    if (nbuf) return nbuf;
    nbuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return nbuf;
  }
  function noise(dur, vol, freq, q = 1, delay = 0, type = "bandpass") {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = noiseBuf(c);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); env(g, t, 0.002, vol, dur);
    s.connect(f).connect(g).connect(out);
    s.start(t); s.stop(t + dur + 0.05);
  }
  // 拍子木
  function wood(freq = 1400, vol = 0.18, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.7, t + 0.06);
    env(g, t, 0.001, vol, 0.07);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.12);
    noise(0.03, vol * 0.5, freq * 2, 3, delay);
  }
  // 太鼓
  function taiko(vol = 0.5, delay = 0, f0 = 110) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.35);
    env(g, t, 0.003, vol, 0.45);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.55);
    noise(0.08, vol * 0.4, 300, 0.7, delay, "lowpass");
  }
  // 鈴（金属の倍音）
  function bell(freq = 1320, vol = 0.07, dur = 1.1, delay = 0) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + delay;
    [[1, 1], [2.76, 0.45], [5.4, 0.2], [8.9, 0.08]].forEach(([mul, v]) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = freq * mul;
      env(g, t, 0.002, vol * v, dur / Math.sqrt(mul));
      o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.1);
    });
  }

  // 都節音階（E-F-A-B-C）を積み上げた音列: 文の数え上げで段々上がる
  const MIYAKO = [0, 1, 5, 7, 8];
  const scaleHz = (i, base = 329.6) => base * Math.pow(2, (Math.floor(i / 5) * 12 + MIYAKO[i % 5]) / 12);

  return {
    get enabled() { return enabled; },
    toggle() { enabled = !enabled; try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch (e) { /* */ } return enabled; },
    unlock() { ac(); },
    select()  { wood(1500, 0.12); },
    deselect(){ wood(1100, 0.08); },
    deal(i = 0) { noise(0.05, 0.05, 2500, 1.5, i * 0.04); },
    play()    { noise(0.18, 0.08, 900, 0.8); wood(900, 0.1, 0.05); },
    discard() { noise(0.22, 0.07, 600, 0.6); },
    yaku(i = 0) { taiko(0.35, 0, 130); bell(880 * Math.pow(2, i / 12), 0.05, 0.6, 0.02); },
    bun(step) { pluck(scaleHz(Math.min(step, 14)), 0.13, 0.45); },
    bai(step) { pluck(scaleHz(Math.min(step, 14), 164.8), 0.16, 0.4); wood(800, 0.08); },
    xbai()    { bell(990, 0.09, 1.0); taiko(0.3, 0, 150); },
    debuff()  { wood(300, 0.12); },
    total(big) {
      taiko(0.6, 0, 95); taiko(0.45, 0.14, 120);
      if (big) { bell(1320, 0.07, 1.4, 0.1); bell(1760, 0.05, 1.4, 0.22); }
    },
    clear() {
      // 祓い成功: 鈴を振る → 琴の上り
      for (let i = 0; i < 6; i++) bell(1500 + (i % 2) * 180, 0.045, 0.6, i * 0.06);
      [0, 2, 4, 5, 7].forEach((s, i) => pluck(scaleHz(s + 5), 0.12, 0.8, 0.35 + i * 0.09));
      taiko(0.55, 0.3);
    },
    fail() { [7, 5, 3, 1, 0].forEach((s, i) => pluck(scaleHz(s, 220), 0.12, 0.9, i * 0.16)); taiko(0.4, 0.8, 80); },
    coin(i = 0) { bell(2200 + (i % 3) * 200, 0.05, 0.25, i * 0.07); },
    stamp() { taiko(0.5, 0, 160); wood(500, 0.2, 0.01); },
    buy() { bell(1760, 0.06, 0.5); wood(1200, 0.08, 0.02); },
    error() { wood(260, 0.14); wood(220, 0.14, 0.09); },
    open() { noise(0.3, 0.07, 1400, 0.7); [0, 2, 4].forEach((s, i) => pluck(scaleHz(s + 5), 0.1, 0.6, 0.15 + i * 0.07)); },
    shiki() { bell(1180, 0.05, 0.35); },
    page() { noise(0.12, 0.05, 1800, 0.8); },
    boss() { taiko(0.6, 0, 70); taiko(0.6, 0.35, 70); taiko(0.7, 0.7, 60); },
  };
})();
