// ============================================================
// art.js — 絵の窓口。花札（HanaArt）・式神（ShikiArt）・妖（YokaiArt）をまとめ、
//   札の飾り（月・種類・加工・旬）や小物（銭・神器・蝋燭・呪符・文箱）を描く。
//   絵のモジュールが読めなかったときも遊べるよう、必ず代わりの絵を返す。
// ============================================================
"use strict";

const Art = (() => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  // ---------- 花札 ----------
  function faceSvg(c) {
    if (typeof HanaArt !== "undefined") {
      try { return HanaArt.svg({ m: c.m, t: c.t, sp: c.sp, v: c.v || 0 }); } catch (e) { /* fallthrough */ }
    }
    const mo = MONTHS[c.m];
    return `<svg viewBox="0 0 60 98" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="58" height="96" rx="3" fill="#f3e9d2" stroke="#1d1a17" stroke-width="2"/>
      <circle cx="30" cy="44" r="18" fill="${mo.color}" opacity=".8"/><text x="30" y="52" font-size="22" text-anchor="middle" fill="#fff" font-family="serif">${mo.plant[0]}</text></svg>`;
  }
  function backSvg() {
    if (typeof HanaArt !== "undefined") { try { return HanaArt.back(); } catch (e) { /* */ } }
    return `<svg viewBox="0 0 60 98" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="58" height="96" rx="3" fill="#1d1a17" stroke="#c8322a" stroke-width="1.5"/>
      <path d="M30 34 L35 47 L49 47 L38 55 L42 68 L30 60 L18 68 L22 55 L11 47 L25 47Z" fill="none" stroke="#d9a531" stroke-width="1.6"/></svg>`;
  }

  // 札のHTML（手札・場・山札一覧で共通）
  //   opts: { month(旬の判定), faceDown, small, noIdx }
  function card(c, opts = {}) {
    if (opts.faceDown) {
      return `<div class="card face-down" data-uid="${c.uid}"><div class="art">${backSvg()}</div></div>`;
    }
    const cls = ["card", `t-${c.t}`];
    if (c.enh) cls.push(`enh-${c.enh}`);
    if (c.seal) cls.push(`seal-${c.seal}`);
    const shun = opts.month && c.m === opts.month;
    if (shun) cls.push("shun");
    const mo = MONTHS[c.m];
    const idx = opts.noIdx ? "" :
      `<div class="idx"><span class="idx-m">${mo.plant.length > 1 ? mo.plant[0] : mo.plant}</span><span class="idx-n">${c.m}</span></div>
       <div class="tbadge tb-${c.t}">${TYPES[c.t].short}</div>`;
    const marks = [];
    if (c.enh === "mamori") marks.push(`<span class="mk mk-mamori">護</span>`);
    if (c.seal === "shuin") marks.push(`<span class="mk mk-shuin">朱</span>`);
    if (shun) marks.push(`<span class="mk mk-shun">旬</span>`);
    return `<div class="${cls.join(" ")}" data-uid="${c.uid ?? ""}"><div class="art">${faceSvg(c)}</div>${idx}<div class="marks">${marks.join("")}</div></div>`;
  }

  // ---------- 肖像 ----------
  function portrait(id) {
    try {
      if (typeof ShikiArt !== "undefined" && ShikiArt.has(id)) return ShikiArt.svg(id);
      if (typeof YokaiArt !== "undefined" && YokaiArt.has(id)) return YokaiArt.svg(id);
    } catch (e) { /* fallthrough */ }
    const def = SHIKI_BY_ID[id];
    const y = Object.values(YOKAI).find((v) => v && v.portrait === id);
    const o = ONMYOJI.find((v) => v.portrait === id);
    const name = (def && def.name) || (y && y.name) || (o && o.name) || "？";
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#8a7a60" opacity=".35"/>
      <text x="50" y="62" font-size="34" text-anchor="middle" fill="#1d1a17" font-family="serif">${esc(name[0])}</text></svg>`;
  }

  // ---------- 小物 ----------
  const coin = (size = 14) =>
    `<svg class="coin" width="${size}" height="${size}" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#d9a531" stroke="#8a5a1a" stroke-width="1.4"/><rect x="7" y="7" width="6" height="6" fill="#3a2a10"/><circle cx="10" cy="10" r="6.6" fill="none" stroke="#f7d774" stroke-width=".8" opacity=".7"/></svg>`;

  function candle(lit) {
    return `<svg class="candle ${lit ? "lit" : ""}" viewBox="0 0 20 40" width="14" height="28">
      ${lit ? `<path class="flame" d="M10 2 C14 8 13 12 10 14 C7 12 6 8 10 2Z" fill="#ffb347"/><path d="M10 6 C12 9 11.5 11 10 12 C8.5 11 8 9 10 6Z" fill="#fff3c4"/>` : `<path d="M10 11 q1 -3 0 -5" stroke="#777" stroke-width="1" fill="none" opacity=".6"/>`}
      <rect x="9.3" y="12" width="1.4" height="3" fill="#1d1a17"/>
      <rect x="5" y="15" width="10" height="22" rx="1.5" fill="${lit ? "#f6e7c8" : "#bfb49c"}" stroke="#6b5a3a" stroke-width=".8"/>
      <rect x="3.5" y="36" width="13" height="3" rx="1" fill="#6b3a1a"/></svg>`;
  }

  // 神器（五つ）
  function jingi(id, owned = true) {
    const o = owned ? 1 : 0.18;
    const k = {
      ken: `<path d="M20 4 L23 8 L23 30 L20 34 L17 30 L17 8Z" fill="#dfe6ea" stroke="#1d1a17" stroke-width="1.2"/><rect x="12" y="30" width="16" height="3" rx="1" fill="#d9a531" stroke="#1d1a17" stroke-width="1"/><rect x="18" y="33" width="4" height="7" fill="#7b4a26" stroke="#1d1a17" stroke-width="1"/>`,
      kagami: `<circle cx="20" cy="20" r="15" fill="#d9a531" stroke="#1d1a17" stroke-width="1.3"/><circle cx="20" cy="20" r="10.5" fill="#f3e9d2" stroke="#8a5a1a" stroke-width="1"/><path d="M14 16 Q20 11 26 16" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>`,
      tama: `<path d="M24 8 C33 8 36 20 29 27 C24 32 16 33 12 28 C18 28 20 24 18 20 C14 17 14 8 24 8Z" fill="#3fa36b" stroke="#1d1a17" stroke-width="1.3"/><circle cx="25" cy="15" r="3" fill="#1d1a17"/>`,
      hoju: `<path d="M20 5 C23 11 30 14 30 23 C30 30 25 34 20 34 C15 34 10 30 10 23 C10 14 17 11 20 5Z" fill="#e8f1f4" stroke="#1d1a17" stroke-width="1.3"/><path d="M20 5 C24 12 23 18 26 22" stroke="#d9a531" stroke-width="1.4" fill="none"/><path d="M8 30 Q20 38 32 30" stroke="#c8322a" stroke-width="2.4" fill="none"/>`,
      suzu: `<rect x="19" y="4" width="2.4" height="30" fill="#7b4a26"/><circle cx="14" cy="13" r="3.6" fill="#d9a531" stroke="#1d1a17" stroke-width="1"/><circle cx="26" cy="13" r="3.6" fill="#d9a531" stroke="#1d1a17" stroke-width="1"/><circle cx="12" cy="21" r="3.6" fill="#d9a531" stroke="#1d1a17" stroke-width="1"/><circle cx="28" cy="21" r="3.6" fill="#d9a531" stroke="#1d1a17" stroke-width="1"/><circle cx="20" cy="17" r="3.6" fill="#d9a531" stroke="#1d1a17" stroke-width="1"/><path d="M20 34 q-6 3 -9 6 M20 34 q6 3 9 6" stroke="#c8322a" stroke-width="1.6" fill="none"/>`,
    }[id] || "";
    return `<svg class="jingi-ico" viewBox="0 0 40 40" style="opacity:${o}">${k}</svg>`;
  }

  // 呪符（縦長の御札）
  const FU_GLYPH = { utsushi: "写", tsukiokuri: "送", harae: "祓", kinpaku: "金", kirara: "雲", mamori: "護", usurai: "氷",
    tanzaku: "短", tanefu: "種", zeni: "銭", shikiyobi: "式", hikarifu: "光", shuin: "朱", wakemi: "分", tamayobi: "魂" };
  function fu(id) {
    const f = FU[id];
    return `<div class="fu-card ${f.rare ? "rare" : ""}" data-fu="${id}"><div class="fu-top">急急如律令</div><div class="fu-glyph">${FU_GLYPH[id] || "符"}</div><div class="fu-name">${esc(f.name.replace("の符", ""))}</div></div>`;
  }
  // 詠み札（百人一首の読み札ふう）
  function yomi(key) {
    const y = YOMI[key];
    return `<div class="yomi-card" data-yomi="${key}"><div class="yomi-yaku">${esc(YAKU[key].name)}</div><div class="yomi-uta">${esc(y.uta.split(" ").slice(0, 2).join(" "))}…</div><div class="yomi-poet">${esc(y.poet)}</div></div>`;
  }
  // 文箱（漆の箱）
  const PACK_COLOR = { fuda: "#8f1d1d", yomi: "#2b4c8c", jufu: "#1d1a17", shiki: "#6b3fa0" };
  const PACK_GLYPH = { fuda: "札", yomi: "歌", jufu: "符", shiki: "式" };
  function pack(kind) {
    const col = PACK_COLOR[kind];
    return `<svg class="pack-svg" viewBox="0 0 80 60"><rect x="6" y="18" width="68" height="36" rx="4" fill="${col}" stroke="#1d1a17" stroke-width="1.5"/>
      <rect x="3" y="10" width="74" height="14" rx="4" fill="${col}" stroke="#1d1a17" stroke-width="1.5"/>
      <path d="M3 17 H77" stroke="#d9a531" stroke-width="1.2"/><path d="M40 10 V54" stroke="#d9a531" stroke-width="2"/>
      <path d="M14 44 q6 -8 12 0 t12 0" stroke="#d9a531" stroke-width="1" fill="none" opacity=".7"/>
      <circle cx="40" cy="36" r="9" fill="#f3e9d2" stroke="#d9a531" stroke-width="1.4"/>
      <text x="40" y="40.5" font-size="12" text-anchor="middle" fill="${col}" font-family="serif" font-weight="bold">${PACK_GLYPH[kind]}</text></svg>`;
  }
  // 朱印（祓い済みの判子）
  function stamp(ch = "祓") {
    return `<svg class="stamp" viewBox="0 0 60 60"><rect x="6" y="6" width="48" height="48" rx="6" fill="#fffaf0cc" stroke="#c8322a" stroke-width="4"/>
      <text x="30" y="42" font-size="32" text-anchor="middle" fill="#c8322a" font-family="serif" font-weight="bold">${ch}</text></svg>`;
  }

  return { card, faceSvg, backSvg, portrait, coin, candle, jingi, fu, yomi, pack, stamp, esc, FU_GLYPH };
})();
