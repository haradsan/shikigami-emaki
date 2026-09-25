/* ============================================================
   art-hana.js — 花札48枚（八八花）の絵柄SVG
   ・木版画の平塗り＋墨の輪郭。色はパレットの数色だけ。
   ・id / <defs> / グラデーション / フィルタ / url(#…) は使わない。
     札からはみ出す絵は「入れ子<svg>のビューポート」で切り抜く（id不要）。
   ・HanaArt.svg({ m, t, sp, v }) → 札の表 / HanaArt.back() → 札の裏
   ============================================================ */
const HanaArt = (() => {
  "use strict";

  // ---------- パレット ----------
  const SHU = "#c8322a", SHINKU = "#8f1d1d", SUMI = "#1d1a17", KINARI = "#f3e9d2", SHIRO = "#fbf7ec",
    KIN = "#d9a531", YAMABUKI = "#f0c13b", WAKAKUSA = "#5c9b3a", FUKAMIDORI = "#2f6b2d", MATSUBA = "#24502a",
    AI = "#2b4c8c", SORA = "#6fa8d6", FUJI = "#7a4fa3", SAKURA = "#f2b2c0", MOMO = "#e57a93", CHA = "#7b4a26", TSUCHI = "#a86b3c";

  // ---------- 基本部品 ----------
  const D2R = Math.PI / 180;
  const n2 = (v) => Math.round(v * 100) / 100;
  const ol = (w = 0.7, c = SUMI) => ` stroke="${c}" stroke-width="${w}" stroke-linejoin="round"`;
  const op = (o) => ` opacity="${o}"`;
  const P = (d, fill, x = "") => `<path d="${d}" fill="${fill}"${x}/>`;
  const S = (d, c, w, x = "") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${x}/>`;
  const Ci = (cx, cy, r, fill, x = "") => `<circle cx="${n2(cx)}" cy="${n2(cy)}" r="${n2(r)}" fill="${fill}"${x}/>`;
  const Re = (x, y, w, h, fill, e = "") => `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" fill="${fill}"${e}/>`;
  const G = (s, tr) => `<g transform="${tr}">${s}</g>`;
  const FLIP = (s) => G(s, "matrix(-1 0 0 1 60 0)");

  // 極座標（角度は「真上=0・時計回り」の度）
  const pl = (cx, cy, r, deg) => [n2(cx + r * Math.sin(deg * D2R)), n2(cy - r * Math.cos(deg * D2R))];
  // 円のサブパス（1つの<path>に何個でも詰められる）
  const cp = (cx, cy, r) => {
    const a = n2(cx - r), b = n2(cy), rr = n2(r);
    return `M${a} ${b}a${rr} ${rr} 0 1 0 ${n2(2 * r)} 0a${rr} ${rr} 0 1 0 ${n2(-2 * r)} 0Z`;
  };
  // 葉の形（2点を結ぶレンズ）。w=膨らみ（実際の半幅はw/2）、b=反り
  const lens = (x1, y1, x2, y2, w, b = 0) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    return `M${n2(x1)} ${n2(y1)}Q${n2(mx + nx * (w + b))} ${n2(my + ny * (w + b))} ${n2(x2)} ${n2(y2)}` +
      `Q${n2(mx - nx * (w - b))} ${n2(my - ny * (w - b))} ${n2(x1)} ${n2(y1)}Z`;
  };
  // ローカル座標で描いた形（M L C Q S T Z のみ・絶対座標）を移動・拡縮・回転・反転する
  function T(x, y, s = 1, a = 0, fx = 1) {
    const c = Math.cos(a * D2R) * s, sn = Math.sin(a * D2R) * s;
    const pt = (u, v) => [n2(x + u * fx * c - v * sn), n2(y + u * fx * sn + v * c)];
    return {
      pt,
      d: (str) => str.replace(/(-?\d*\.?\d+)[\s,]*(-?\d*\.?\d+)/g, (m, u, v) => pt(+u, +v).join(" ") + " "),
      r: (v) => n2(v * s),
    };
  }
  // 3次ベジェ上の点・向き
  const bz = (q, t) => {
    const u = 1 - t;
    return [u * u * u * q[0] + 3 * u * u * t * q[2] + 3 * u * t * t * q[4] + t * t * t * q[6],
      u * u * u * q[1] + 3 * u * u * t * q[3] + 3 * u * t * t * q[5] + t * t * t * q[7]];
  };
  const bzAng = (q, t) => {
    const u = 1 - t;
    const dx = 3 * u * u * (q[2] - q[0]) + 6 * u * t * (q[4] - q[2]) + 3 * t * t * (q[6] - q[4]);
    const dy = 3 * u * u * (q[3] - q[1]) + 6 * u * t * (q[5] - q[3]) + 3 * t * t * (q[7] - q[5]);
    return Math.atan2(dy, dx);
  };
  const bzD = (q) => `M${q[0]} ${q[1]}C${q[2]} ${q[3]} ${q[4]} ${q[5]} ${q[6]} ${q[7]}`;
  // m・v から決まる擬似乱数（Math.random は使わない）
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  // 墨の輪郭つきの枝・幹
  const limb = (d, w, col = CHA) => S(d, SUMI, w + 1.5) + S(d, col, w);

  // ---------- 共通の背景・飾り ----------
  // 上部の赤い空（下端は雲形）＋一文字ぼかし風の濃い帯
  function sky(y, col = SHU) {
    const d = `M0 0H60V${y}Q54 ${y + 5} 46 ${y + 1.5}Q38 ${y + 6} 29 ${y + 1}Q20 ${y + 5.5} 12 ${y + 1.5}Q5 ${y + 5} 0 ${y}Z`;
    return P(d, col, ol(0.8)) + Re(0, 0, 60, y * 0.36, SHINKU, op(0.4)) + Re(0, 0, 60, y * 0.16, SHINKU, op(0.45));
  }
  function fullSky(col = SHU) {
    return Re(0, 0, 60, 98, col) + Re(0, 0, 60, 13, SHINKU, op(0.4)) + Re(0, 0, 60, 5.5, SHINKU, op(0.45));
  }
  // 金の霞（すやり霞）[x, y, w, h, 段の位置(1=右寄り/-1=左寄り/0=段なし)]
  const pill = (x, y, w, h) => {
    const r = n2(h / 2);
    return `M${n2(x + r)} ${n2(y)}H${n2(x + w - r)}A${r} ${r} 0 0 1 ${n2(x + w - r)} ${n2(y + h)}H${n2(x + r)}A${r} ${r} 0 0 1 ${n2(x + r)} ${n2(y)}Z`;
  };
  function kasumi(list) {
    let d = "", hl = "", dots = "";
    for (const [x, y, w, h = 5, st = 1] of list) {
      d += pill(x, y, w, h);
      if (st) d += pill(x + w * (st > 0 ? 0.44 : 0.06), y - h * 0.62, w * 0.5, h);
      hl += `M${n2(x + h * 0.7)} ${n2(y + h * 0.66)}H${n2(x + w * 0.62)}`;
      for (let i = 0; i < 3; i++) dots += cp(x + w * (0.2 + i * 0.27), y + h * 0.3, 0.45);
    }
    return P(d, SUMI, ` stroke="${SUMI}" stroke-width="1.5"`) + P(d, KIN) + S(hl, YAMABUKI, 0.8) + P(dots, YAMABUKI);
  }
  // 短冊（赤短・青短・無地）
  function ribbon(col, text = "", cx = 30, cy = 50, ang = -12) {
    const w = 10.6, h = 46, x = cx - w / 2, y = cy - h / 2;
    let s = Re(x, y, w, h, col, ol(0.9)) +
      Re(x + 1.3, y + 1.3, w - 2.6, h - 2.6, "none", ` stroke="${col === AI ? SUMI : SHINKU}" stroke-width=".6" stroke-opacity=".55"`);
    [...text].forEach((ch, i) => {
      s += `<text x="${cx}" y="${n2(y + 8 + i * 6.3)}" font-family="serif" font-size="5.8" font-weight="700" fill="${SHIRO}" text-anchor="middle">${ch}</text>`;
    });
    return G(s, `rotate(${ang} ${cx} ${cy})`);
  }
  // 汎用の光輪（変化札の光）
  function halo(cx, cy, r) {
    let rays = "";
    for (let i = 0; i < 16; i++) {
      const a = i * 22.5, p1 = pl(cx, cy, r + 1.8, a), p2 = pl(cx, cy, r + (i % 2 ? 3.8 : 6), a);
      rays += `M${p1}L${p2}`;
    }
    return S(rays, SUMI, 2.6) + S(rays, KIN, 1.3) + Ci(cx, cy, r, KIN, ol(0.8)) + Ci(cx, cy, r * 0.7, YAMABUKI) +
      Ci(cx - r * 0.25, cy - r * 0.25, r * 0.22, SHIRO, op(0.6));
  }
  // 汎用の雀（変化札の種）: x,y=胴の中心、とまる足先は y+8*s
  function suzume(x, y, s = 1, fx = 1) {
    const t = T(x, y, s, 0, fx);
    return S(t.d("M-1 5L-2 8.5M2.5 5L2.5 8.5"), SUMI, 0.8) +
      P(t.d("M-6 -1C-6 -6 0 -7.5 4 -4.5C7 -2.5 9 0.5 13.5 2L12.5 4.2C8 4.4 5 5.5 1 5.5C-4 5.5 -6 3 -6 -1Z"), CHA, ol(0.65)) +
      P(t.d("M-6 0.5C-5 4.5 -1 5.6 3 5C0 3.4 -3 2.4 -6 0.5Z"), KINARI) +
      P(t.d("M-0.5 -4.5C3.5 -5.5 7.5 -2.5 10.5 1.5C6.5 1.5 2.5 0.5 -0.5 -4.5Z"), TSUCHI, ol(0.5)) +
      S(t.d("M2 -3L4 -0.5M5 -1.8L6.6 0.6"), SUMI, 0.6) +
      Ci(...t.pt(-5.2, -4.4), t.r(3.5), CHA, ol(0.65)) +
      P(t.d("M-8.4 -3.6C-7.4 -2 -5 -1.6 -3.2 -2.6C-4 -1 -6.6 0 -8.6 -1.8Z"), SHIRO) +
      Ci(...t.pt(-6, -2.4), t.r(0.9), SUMI) +
      P(t.d("M-8.4 -5L-10.8 -4.2L-8.4 -3.4Z"), SUMI) +
      Ci(...t.pt(-6.6, -5), t.r(0.7), SUMI);
  }
  const LIGHT = Ci(53, 8, 3.5, KINARI, ol(0.7)) + Ci(53, 8, 2.35, SHU);

  // ============================================================
  // 1月 松
  // ============================================================
  function pineClumps(list) {
    let b = "", nd = "";
    for (const [cx, cy, w, h] of list) {
      const l = n2(cx - w / 2), r = n2(cx + w / 2), k = n2(cy - h * 1.33);
      b += `M${l} ${cy}C${l} ${k} ${r} ${k} ${r} ${cy}Q${cx} ${n2(cy - h * 0.3)} ${l} ${cy}Z`;
      const n = Math.max(5, Math.round(w / 2.3));
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1 + (i + 0.5) / n);
        nd += `M${n2(cx + Math.cos(a) * w * 0.06)} ${n2(cy - h * 0.18)}L${n2(cx + Math.cos(a) * w * 0.42)} ${n2(cy + Math.sin(a) * h * 0.84 - h * 0.06)}`;
      }
    }
    return P(b, MATSUBA, ol(0.8)) + S(nd, WAKAKUSA, 0.75);
  }
  const PINE = {
    k0: {
      tr: [["M5 99C8 86 16 78 24 70S34 52 28 38", 4.4], ["M24 70C32 68 42 70 51 64", 2.4], ["M28 38C34 33 40 32 48 29", 2.2], ["M27 53C20 51 14 50 8 45", 2]],
      cl: [[47, 29, 22, 8.5], [24, 37, 22, 9], [9, 45, 17, 7.5], [51, 64, 19, 8], [30, 57, 13, 6], [17, 84, 24, 9], [44, 93, 24, 9]],
    },
    k1: {
      tr: [["M56 99C52 84 42 76 36 62S28 40 36 26", 4.4], ["M36 62C28 60 18 62 10 58", 2.4], ["M36 26C30 22 24 22 16 22", 2.2], ["M33 44C40 42 46 42 52 40", 2]],
      cl: [[16, 22, 20, 8], [38, 26, 20, 8.5], [52, 40, 16, 7], [10, 58, 18, 8], [32, 72, 18, 7], [42, 88, 26, 9], [12, 95, 22, 8]],
    },
  };
  const pine = (k) => PINE[k].tr.map(([d, w]) => limb(d, w)).join("") + pineClumps(PINE[k].cl);

  function crane() {
    return S("M32 69L31 80L33 93M38 69L40 80L38 93", SUMI, 1.2) +
      P("M20 57C20 49 30 46 39 49C46 52 51 57 54 64C47 69 39 71 30 70C24 69 20 64 20 57Z", SHIRO, ol(0.8)) +
      S("M27 55C34 51.6 42 53.6 47.6 60M29.4 61C31.4 59.4 33.4 59.4 35.4 61C37.4 59.4 39.4 59.4 41.4 61C43.4 59.4 45.4 59.6 47.4 62M31 66C33 64.6 35 64.6 37 66C39 64.6 41 64.6 43 66", SUMI, 0.6, op(0.7)) +
      P("M40 56C47 57 53 62 56 72L52.5 69.5L52 73.5L48.5 70L46.5 73L44.5 68C42 66 39.5 62 40 56Z", SUMI) +
      S("M24 55C20 49 23 43 21 37C20 34 20 32 21 30", SUMI, 3.2) +
      Ci(21.4, 29.4, 3, SHIRO, ol(0.7)) + Ci(21.9, 27.9, 1.25, SHU) +
      P("M19.4 28.6L9 24L19.4 30.8Z", KIN, ol(0.5)) + Ci(20.4, 29, 0.55, SUMI);
  }
  function tsuruCard() {
    return kasumi([[1, 50, 20, 4.5, 1], [41, 45, 22, 4.5, -1]]) + Ci(35, 26, 15.5, SHU, ol(0.9)) + crane() +
      limb("M-2 92C10 88 22 92 34 88S50 80 62 76", 3.2) + limb("M24 90C22 84 18 80 12 78", 2) +
      pineClumps([[11, 78, 18, 7.5], [5, 92, 22, 9], [27, 99, 32, 12], [50, 92, 26, 10], [56, 76, 16, 7]]);
  }

  // ============================================================
  // 2月 梅
  // ============================================================
  function umeBlooms(list, fill, core) {
    if (!list.length) return "";
    let d = "", c = "";
    for (const [x, y, r] of list) {
      for (let k = 0; k < 5; k++) { const p = pl(x, y, r * 0.5, k * 72 + 10); d += cp(p[0], p[1], r * 0.5); }
      c += cp(x, y, r * 0.28);
    }
    return P(d, fill, ol(0.55)) + P(c, core);
  }
  const UME = {
    k0: {
      sky: 20,
      br: [["M54 99C48 88 40 84 30 80C18 75 12 64 18 52", 3.6], ["M18 52C24 40 36 36 32 22C30 16 27 11 27 4", 2.4], ["M30 80L44 70L51 72M18 52L6 46M27 41L40 35L47 37M32 22L41 14", 1.4]],
      red: [[44, 70, 4.8], [51, 73, 3.6], [7, 46, 4.4], [40, 35, 4.8], [21, 63, 4.2], [31, 80, 4]],
      white: [[41, 14, 4.6], [27, 7, 4], [33, 21, 3.6]],
      bud: [[12, 58], [47, 33], [48, 66], [36, 12], [16, 47]],
    },
    k1: {
      sky: 22,
      br: [["M4 99C10 88 20 84 28 76C38 66 46 58 42 44", 3.6], ["M42 44C38 32 26 30 30 14C31 10 33 7 34 3", 2.4], ["M28 76L14 70L8 72M42 44L54 38M36 31L22 26L16 28M30 14L21 8", 1.4]],
      red: [[14, 70, 4.6], [8, 73, 3.4], [54, 38, 4.4], [34, 64, 4], [44, 52, 3.6], [22, 86, 4.2]],
      white: [[21, 8, 4.4], [31, 16, 4], [16, 27, 4.2]],
      bud: [[49, 41], [26, 80], [38, 58], [25, 26]],
    },
    kt: {
      sky: 20,
      br: [["M61 86C48 80 36 76 24 76C14 76 8 72 4 64", 3.4], ["M42 78C44 68 41 58 45 48C47 42 50 38 53 30", 2.2], ["M24 76L18 86M45 52L34 44L30 32M53 30L50 20", 1.4]],
      red: [[45, 48, 4.6], [34, 44, 4.2], [53, 31, 4.4], [18, 87, 4.2], [5, 63, 4.4], [30, 79, 3.4]],
      white: [[30, 30, 4], [49, 17, 4.2], [12, 12, 3.4]],
      bud: [[40, 55], [22, 82], [11, 70], [57, 40]],
    },
  };
  function ume(k) {
    const L = UME[k];
    let moss = "";
    const R = rng(k.length * 31 + L.sky);
    L.br.slice(0, 2).forEach(([d]) => {
      const nums = d.match(/-?\d*\.?\d+/g).map(Number);
      for (let i = 2; i + 1 < nums.length; i += 4) moss += cp(nums[i] + (R() - 0.5) * 2, nums[i + 1] + (R() - 0.5) * 2, 0.7 + R() * 0.4);
    });
    let buds = "";
    for (const [x, y] of L.bud) buds += cp(x, y, 1.5);
    return sky(L.sky) + L.br.map(([d, w]) => S(d, SUMI, w)).join("") + P(moss, WAKAKUSA) +
      umeBlooms(L.red, SHU, YAMABUKI) + umeBlooms(L.white, SHIRO, SHU) + P(buds, SHU, ol(0.5));
  }
  function uguisu(x, y, s = 1, fx = 1) {
    const t = T(x, y, s, 0, fx);
    return S(t.d("M-1 5.5L-2 9M3 5.5L3 9"), SUMI, 0.9) +
      P(t.d("M-7 -1C-7 -7 0 -9 5 -6C9 -4 13 1 18 4L16 6C12 5 7 6 2 6C-4 6 -7 3 -7 -1Z"), WAKAKUSA, ol(0.7)) +
      P(t.d("M-7 0C-6 4 -1 6 4 5.4C0 3.6 -4 2.4 -7 0Z"), YAMABUKI) +
      P(t.d("M-1 -5C4 -7 10 -3 15 3C9 2 3 1 -1 -5Z"), FUKAMIDORI, ol(0.5)) +
      S(t.d("M3 -3.5L6 0M7 -2L9.5 1.5"), SUMI, 0.5, op(0.6)) +
      Ci(...t.pt(-6.5, -5), t.r(4.2), WAKAKUSA, ol(0.7)) +
      P(t.d("M-10.4 -5.8L-14.2 -4.6L-10.4 -3.6Z"), SUMI) +
      Ci(...t.pt(-8, -6), t.r(1.25), SHIRO) + Ci(...t.pt(-8.2, -6), t.r(0.7), SUMI);
  }

  // ============================================================
  // 3月 桜
  // ============================================================
  function sakuraD(cx, cy, r, rot = 0) {
    let d = "";
    for (let k = 0; k < 5; k++) {
      const a = rot + k * 72;
      const p1 = pl(cx, cy, r * 0.95, a - 22), pn = pl(cx, cy, r * 0.76, a), p2 = pl(cx, cy, r * 0.95, a + 22);
      const c1 = pl(cx, cy, r * 0.6, a - 44), c2 = pl(cx, cy, r * 1.1, a - 9), c3 = pl(cx, cy, r * 1.1, a + 9), c4 = pl(cx, cy, r * 0.6, a + 44);
      d += `M${n2(cx)} ${n2(cy)}Q${c1} ${p1}Q${c2} ${pn}Q${c3} ${p2}Q${c4} ${n2(cx)} ${n2(cy)}Z`;
    }
    return d;
  }
  function sakuraMasses(list, seed = 1) {
    const R = rng(seed);
    let m = "", f = "", c = "";
    for (const [cx, cy, rx, ry] of list) {
      const rr = Math.min(rx, ry);
      m += cp(cx, cy, rr * 0.82);
      for (let k = 0; k < 8; k++) {
        const a = k * 45 + 12 + R() * 14;
        m += cp(cx + Math.sin(a * D2R) * rx * 0.7, cy - Math.cos(a * D2R) * ry * 0.7, rr * (0.4 + R() * 0.12));
      }
      [[0, 0], [-0.52, -0.34], [0.5, -0.36], [-0.44, 0.44], [0.48, 0.4]].forEach(([u, v], i) => {
        const x = cx + u * rx, y = cy + v * ry, r = i ? 2.3 : 2.9;
        f += sakuraD(x, y, r, i * 17 + seed * 7);
        c += cp(x, y, r * 0.24);
      });
    }
    return P(m, SUMI, ` stroke="${SUMI}" stroke-width="2.6"`) + P(m, MOMO, ` stroke="${MOMO}" stroke-width="1.3"`) + P(m, SAKURA) +
      P(f, SHIRO, ol(0.4, MOMO)) + P(c, SHU);
  }
  const SAKURA_L = {
    k0: {
      tr: [["M50 99C48 86 42 78 36 66S26 46 30 30", 4], ["M36 66C28 64 20 62 12 56", 2.2], ["M31 44C38 40 44 38 50 32", 2]],
      m: [[16, 16, 14, 11], [44, 19, 14, 11], [29, 33, 12, 9.5], [10, 47, 11, 9], [50, 44, 10, 8.5], [24, 60, 12, 9], [47, 66, 10, 8.5]],
      k: [[-3, 79, 36, 5.5, 1], [26, 90, 38, 5, -1]],
    },
    k1: {
      tr: [["M10 99C12 86 20 76 26 64S34 44 28 30", 4], ["M26 64C34 62 42 60 50 54", 2.2], ["M29 44C22 40 16 38 10 32", 2]],
      m: [[42, 14, 15, 11], [14, 22, 12, 10], [31, 33, 10, 8.5], [50, 46, 10, 8.5], [12, 46, 10, 8.5], [36, 60, 12, 9], [13, 70, 10, 8]],
      k: [[27, 80, 36, 5.5, -1], [-4, 90, 34, 5, 1]],
    },
  };
  function sakura(k) {
    const L = SAKURA_L[k];
    return L.tr.map(([d, w]) => limb(d, w, CHA)).join("") + sakuraMasses(L.m, k === "k0" ? 3 : 5) + kasumi(L.k);
  }
  function maku() {
    const top = 50, sag = 6;
    const yAt = (x) => { const a = x < 30 ? 0 : 30, t = (x - a) / 30; return n2(top + sag * 4 * t * (1 - t)); };
    let red = "", white = "", edge = `M0 ${yAt(0)}`;
    for (let i = 0; i < 6; i++) {
      const x0 = i * 10, x1 = x0 + 10;
      let d = `M${x0} 98`;
      for (let x = x0; x <= x1 + 0.01; x += 2.5) d += `L${n2(x)} ${yAt(x)}`;
      d += `L${x1} 98Z`;
      if (i % 2) white += d; else red += d;
    }
    for (let x = 2.5; x <= 60; x += 2.5) edge += `L${n2(x)} ${yAt(Math.min(x, 59.99))}`;
    const tassel = (x) => P(`M${x - 1.6} ${top}L${x + 1.6} ${top}L${x + 2.4} ${top + 10}L${x - 2.4} ${top + 10}Z`, KIN, ol(0.5)) +
      Ci(x, top, 2, KIN, ol(0.5));
    return P(white, SHIRO) + P(red, SHU) + S("M0 94H60", SUMI, 0.8, op(0.5)) + S(edge, SUMI, 1.3) +
      tassel(30) + tassel(3) + tassel(57) +
      Ci(30, 75, 10, SHIRO, ol(0.9)) + Ci(30, 75, 8.6, "none", ol(0.6)) + P(sakuraD(30, 75, 7.4, 0), SHU, ol(0.5)) + Ci(30, 75, 1.6, YAMABUKI, ol(0.4));
  }
  function makuCard() {
    return limb("M30 60C28 46 34 32 36 16", 3.2) + limb("M33 38C26 34 20 34 12 30", 1.8) +
      sakuraMasses([[12, 14, 12, 10], [38, 12, 14, 9.5], [54, 26, 9, 9], [26, 30, 12, 9], [46, 40, 11, 8], [8, 38, 9, 8]], 9) +
      kasumi([[-2, 42, 22, 5]]) + maku();
  }

  // ============================================================
  // 4月 藤
  // ============================================================
  function fujiClusters(list) {
    let dk = "", md = "", hl = "";
    for (const [x, y, len, cv] of list) {
      const n = Math.max(4, Math.round(len / 2.7));
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), cx = x + cv * t * t + (i % 2 ? 1 : -1) * (1 - t) * 1.1, cy = y + len * t, r = 3.3 - 2.1 * t;
        dk += cp(cx + 0.3, cy + 0.4, r + 0.7);
        md += cp(cx, cy, r);
        hl += cp(cx - r * 0.3, cy - r * 0.28, r * 0.42);
      }
    }
    return P(dk, SUMI) + P(md, FUJI) + P(hl, SHIRO, op(0.5));
  }
  function fujiLeaves(list) { // [x, y, 向き(度), 長さ]
    let d = "";
    for (const [x, y, a, L] of list) {
      const t = T(x, y, 1, a);
      d += t.d(`M0 0L0 ${-L}`);
      for (let i = 1; i <= 3; i++) {
        const v = -L * i / 3.4;
        d += lens(...t.pt(0, v), ...t.pt(-3.4, v - 1.6), 1.8) + lens(...t.pt(0, v), ...t.pt(3.4, v - 1.6), 1.8);
      }
    }
    return P(d, FUKAMIDORI, ol(0.45));
  }
  const FUJI_L = {
    k0: {
      vine: "M-2 9C10 3 20 13 30 8S48 2 62 10M14 7C12 13 16 17 14 21M44 6C46 12 42 16 45 20",
      cl: [[6, 12, 42, -2], [15, 21, 54, 2], [29, 12, 44, -2], [44, 20, 56, 3], [54, 12, 36, -2]],
      lv: [[22, 10, -60, 9], [38, 6, 55, 9], [52, 9, 80, 7]],
    },
    k1: {
      vine: "M62 14C50 4 40 16 30 10S12 4 -2 12M46 10C48 16 44 20 46 24M18 8C16 14 20 18 18 22",
      cl: [[53, 16, 50, 2], [46, 24, 38, -2], [32, 12, 56, 2], [18, 22, 44, -3], [8, 14, 52, 2]],
      lv: [[38, 10, -70, 9], [24, 6, 50, 9], [6, 10, -40, 7]],
    },
    kt: {
      vine: "M-2 9C10 3 20 13 30 8S48 2 62 10M-2 52C12 46 22 54 32 49S50 44 62 50",
      cl: [[7, 12, 24, -2], [21, 14, 28, 2], [36, 11, 22, -1], [51, 12, 26, 2], [8, 52, 34, 2], [37, 50, 40, -2], [51, 49, 32, 2]],
      lv: [[29, 8, 60, 8], [18, 51, -150, 8], [44, 46, 60, 8]],
    },
  };
  function fuji(k) {
    const L = FUJI_L[k];
    return S(L.vine, SUMI, 1.8) + fujiLeaves(L.lv) + fujiClusters(L.cl);
  }
  function crescent(cx, cy, r, col) {
    return P(`M${cx} ${cy - r}A${r} ${r} 0 1 0 ${cx} ${cy + r}A${n2(r * 1.3)} ${n2(r * 1.3)} 0 0 1 ${cx} ${cy - r}Z`, col, ol(0.7));
  }
  function hototogisu(x, y, s = 1) {
    const t = T(x, y, s);
    return P(t.d("M-3 1C0 7 5 12 13 15C8 9 6 5 4 1Z"), AI, ol(0.5)) +
      P(t.d("M-12 -1C-9 -3.5 -3 -3.5 3 -2L15 -4L18 -2.5L14 0L18 2L15 3.5L3 2C-3 3 -9 2 -12 -1Z"), SUMI) +
      P(t.d("M-8 0.5C-4 2.4 0 2.4 4 1.4C0 1 -4 0.8 -8 0.5Z"), KINARI) +
      P(t.d("M-3 -2C-2 -10 4 -17 14 -21C9 -14 6 -8 5 -2Z"), SUMI, ol(0.5, AI)) +
      S(t.d("M1 -6L8 -14M2 -3.5L10 -10"), AI, 0.6) +
      P(t.d("M-11.6 -1.6L-15.5 -0.6L-11.6 0.2Z"), SUMI) +
      Ci(...t.pt(-9.5, -1.3), t.r(1.1), YAMABUKI) + Ci(...t.pt(-9.5, -1.3), t.r(0.55), SUMI);
  }
  function hototogisuCard() {
    return sky(42) + crescent(15, 17, 8, YAMABUKI) + hototogisu(38, 28, 1.05) +
      S("M-2 50C12 44 22 52 32 47S50 42 62 48", SUMI, 1.8) + fujiLeaves([[20, 48, -65, 8], [44, 45, 60, 8]]) +
      fujiClusters([[6, 50, 36, 2], [18, 52, 42, -2], [31, 49, 34, 2], [42, 47, 44, -2], [54, 48, 32, 2]]);
  }

  // ============================================================
  // 5月 菖蒲
  // ============================================================
  function ayame(x, y, s = 1, a = 0) {
    const t = T(x, y, s, a);
    return P(t.d("M0 0C-1.2 -4 -1.2 -8 0 -11.5C1.2 -8 1.2 -4 0 0ZM0 0C-3 -3 -5.5 -6 -5.5 -10C-3.8 -8 -2 -5 0 0ZM0 0C3 -3 5.5 -6 5.5 -10C3.8 -8 2 -5 0 0Z"), AI, ol(0.5)) +
      P(t.d("M0 0C-3 -2 -9 -2.4 -11 1.6C-12 4.6 -9 6 -7 4C-5 2 -2 1 0 0ZM0 0C3 -2 9 -2.4 11 1.6C12 4.6 9 6 7 4C5 2 2 1 0 0ZM0 0C2 2 3 6 1 10C0 11 -1 11 -1.5 10C-3 6 -2 2 0 0Z"), FUJI, ol(0.6)) +
      S(t.d("M-2.5 0.4L-7 1.6M2.5 0.4L7 1.6M0 2L-0.2 6.5"), YAMABUKI, 1.1) +
      S(t.d("M-3 1.4L-6.5 2.6M3 1.4L6.5 2.6"), SHIRO, 0.5, op(0.8));
  }
  function irisLeaves(list, col) {
    let d = "";
    for (const [x0, x1, y1, w, b] of list) d += lens(x0, 99, x1, y1, w, b);
    return P(d, col, ol(0.6));
  }
  function water(y) {
    return P(`M0 ${y}C10 ${y - 3} 20 ${y + 3} 30 ${y}S50 ${y - 3} 60 ${y}V98H0Z`, SORA, ol(0.7)) +
      S(`M4 ${y + 5}C8 ${y + 3} 12 ${y + 7} 16 ${y + 5}M26 ${y + 9}C30 ${y + 7} 34 ${y + 11} 38 ${y + 9}M44 ${y + 4}C48 ${y + 2} 52 ${y + 6} 56 ${y + 4}M10 ${y + 12}C14 ${y + 10} 18 ${y + 14} 22 ${y + 12}`, SHIRO, 0.8);
  }
  const IRIS_L = {
    k0: {
      w: 86,
      back: [[8, 2, 34, 4, -2], [20, 24, 40, 4, 1], [40, 46, 30, 4, 2], [52, 58, 44, 3.6, 1]],
      front: [[14, 8, 50, 4.4, -1], [30, 34, 46, 4.4, 1], [46, 42, 52, 4.2, -2], [24, 18, 62, 4, -1]],
      stems: "M16 38C17 60 18 80 18 99M40 28C39 52 38 76 37 99M31 52C31 70 30 86 30 99",
      fl: [[16, 36, 1.15, -4], [40, 26, 1.2, 4], [31, 50, 1, 0]],
      bud: [[50, 46, 5]],
    },
    k1: {
      w: 84,
      back: [[46, 56, 32, 4, 2], [36, 30, 40, 4, -1], [18, 10, 30, 4, -2], [8, 2, 46, 3.6, -1]],
      front: [[44, 50, 48, 4.4, 1], [28, 24, 44, 4.4, -1], [14, 18, 54, 4.2, 2], [36, 42, 62, 4, 1]],
      stems: "M44 36C43 60 42 80 42 99M20 24C21 50 22 76 23 99M30 58C30 74 30 86 30 99",
      fl: [[44, 34, 1.15, 4], [20, 22, 1.2, -4], [30, 56, 0.95, 0]],
      bud: [[10, 44, 5]],
    },
  };
  function iris(k, withWater = true) {
    const L = IRIS_L[k];
    let buds = "";
    for (const [x, y, h] of L.bud) buds += `M${x} ${y}C${x - 2} ${y + h * 0.6} ${x - 1} ${y + h} ${x} ${y + h + 2}C${x + 1} ${y + h} ${x + 2} ${y + h * 0.6} ${x} ${y}Z`;
    return (withWater ? water(L.w) : "") + irisLeaves(L.back, FUKAMIDORI) + S(L.stems, FUKAMIDORI, 1.3) +
      irisLeaves(L.front, WAKAKUSA) + P(buds, FUJI, ol(0.5)) + L.fl.map((f) => ayame(...f)).join("");
  }
  function yatsuhashi() {
    const segs = [[-4, 60, 26, 51], [22, 52, 42, 68], [38, 69, 64, 57]];
    let body = "", lines = "", legs = "";
    for (const [x1, y1, x2, y2] of segs) {
      const h = 8.5;
      body += `M${x1} ${y1}L${x2} ${y2}L${x2} ${y2 + h}L${x1} ${y1 + h}Z`;
      for (const f of [0.34, 0.67]) lines += `M${x1} ${n2(y1 + h * f)}L${x2} ${n2(y2 + h * f)}`;
      for (const f of [0.15, 0.85]) { const x = x1 + (x2 - x1) * f, y = y1 + (y2 - y1) * f + h; legs += `M${n2(x)} ${n2(y)}L${n2(x)} ${n2(y + 6)}`; }
    }
    return S(legs, SUMI, 1.6) + P(body, TSUCHI, ol(0.8)) + S(lines, CHA, 0.6);
  }
  function yatsuhashiCard() {
    const L = IRIS_L.k0;
    return water(74) + irisLeaves(L.back, FUKAMIDORI) + yatsuhashi() + S("M16 38C17 50 17 56 18 62M40 28C39 40 38 48 38 56", FUKAMIDORI, 1.3) +
      irisLeaves([[10, 4, 64, 4.4, -1], [52, 58, 62, 4.4, 1], [30, 36, 78, 4, 1]], WAKAKUSA) +
      ayame(16, 36, 1.15, -4) + ayame(40, 26, 1.2, 4) + ayame(52, 50, 0.9, 6);
  }

  // ============================================================
  // 6月 牡丹
  // ============================================================
  function scallop(cx, cy, r, n, rot = 0, dep = 0.8, bulge = 1.14) {
    let d = "";
    for (let i = 0; i <= n; i++) {
      const a = rot + i * 360 / n, p = pl(cx, cy, r * dep, a);
      d += i ? `Q${pl(cx, cy, r * bulge, a - 180 / n)} ${p}` : `M${p}`;
    }
    return d + "Z";
  }
  // 花びらの縁に小さな切れ込みのある輪
  function ruffle(cx, cy, r, n, rot = 0) {
    let d = "";
    const m = n * 2;
    for (let i = 0; i <= m; i++) {
      const a = rot + i * 360 / m, p = pl(cx, cy, r * (i % 2 ? 0.9 : 0.72), a);
      d += i ? `Q${pl(cx, cy, r * 1.1, a - 180 / m)} ${p}` : `M${p}`;
    }
    return d + "Z";
  }
  function botan(cx, cy, r, rot = 0) {
    let ln = "", st = "";
    for (let i = 0; i < 7; i++) {
      const a = rot + i * (360 / 7);
      ln += `M${pl(cx, cy, r * 0.62, a)}L${pl(cx, cy, r * 0.84, a)}M${pl(cx, cy, r * 0.7, a + 25)}L${pl(cx, cy, r * 0.88, a + 25)}`;
    }
    for (let i = 0; i < 7; i++) { const p = pl(cx, cy + r * 0.04, r * 0.13, i * 51); st += cp(p[0], p[1], r * 0.06 + 0.35); }
    return P(ruffle(cx, cy, r, 7, rot), SHU, ol(0.8)) + S(ln, SHINKU, 0.7, op(0.75)) +
      P(ruffle(cx, cy + r * 0.04, r * 0.7, 6, rot + 26), SHINKU, ol(0.55)) +
      P(ruffle(cx, cy + r * 0.05, r * 0.5, 5, rot + 8), SHU, ol(0.55)) +
      S(ruffle(cx, cy + r * 0.05, r * 0.4, 5, rot + 8), MOMO, 0.6, op(0.8)) +
      P(st, YAMABUKI, ol(0.35));
  }
  const BOTAN_LEAF = "M0 0C-4 -2 -9 -4 -11 -9L-14.5 -11C-10.5 -12.5 -8.5 -12.5 -6.5 -13.5C-7.5 -16.5 -5.5 -19.5 -3 -20.5L0 -25L3 -20.5C5.5 -19.5 7.5 -16.5 6.5 -13.5C8.5 -12.5 10.5 -12.5 14.5 -11L11 -9C9 -4 4 -2 0 0Z";
  const BOTAN_VEIN = "M0 -1L0 -21M0 -6L-9 -10.5M0 -6L9 -10.5";
  function botanLeaves(list, col = FUKAMIDORI) {
    let d = "", v = "";
    for (const [x, y, s, a] of list) { const t = T(x, y, s, a); d += t.d(BOTAN_LEAF); v += t.d(BOTAN_VEIN); }
    return P(d, col, ol(0.6)) + S(v, col === FUKAMIDORI ? WAKAKUSA : FUKAMIDORI, 0.7);
  }
  function chou(x, y, s, a, wing, spot) {
    const t = T(x, y, s, a);
    let sp = "";
    for (const [u, v, r] of [[-8.5, -6.5, 1.6], [8.5, -6.5, 1.6], [-5.5, 5.5, 1.1], [5.5, 5.5, 1.1]]) { const p = t.pt(u, v); sp += cp(p[0], p[1], r * s); }
    return P(t.d("M0 0C-6 1 -10 4 -9 8C-7 11 -2 7 0 1ZM0 0C6 1 10 4 9 8C7 11 2 7 0 1Z"), wing, ol(0.6)) +
      P(t.d("M0 -1C-3 -7 -10 -11 -13 -7C-14 -3 -9 -0.5 0 0ZM0 -1C3 -7 10 -11 13 -7C14 -3 9 -0.5 0 0Z"), wing, ol(0.6)) +
      S(t.d("M-1 -2C-5 -5 -9 -6 -12 -6M1 -2C5 -5 9 -6 12 -6"), SUMI, 0.5, op(0.6)) +
      P(sp, spot) +
      P(t.d("M0 -4C1 -2 1 3 0 6C-1 3 -1 -2 0 -4Z"), SUMI) +
      S(t.d("M0 -3.5C-1 -7 -3 -9 -5 -10.5M0 -3.5C1 -7 3 -9 5 -10.5"), SUMI, 0.55);
  }
  const BOTAN_L = {
    k0: {
      fl: [[30, 46, 17, 0], [48, 16, 7, 12]],
      lv: [[18, 56, 1.1, -118], [42, 56, 1.1, 118], [16, 40, 1, -72], [44, 40, 1, 72], [24, 64, 1.1, -160], [37, 64, 1.1, 160], [26, 88, 0.95, -35, 1], [36, 94, 0.9, 40, 1], [50, 26, 0.7, 120, 1]],
    },
    k1: {
      fl: [[21, 32, 13, 8], [40, 64, 14, -6]],
      lv: [[10, 40, 0.9, -110], [32, 38, 0.9, 100], [18, 20, 0.8, -40], [28, 72, 1, -120], [52, 72, 1, 120], [30, 56, 0.9, -50], [50, 54, 0.9, 50], [36, 90, 0.9, -160, 1], [10, 70, 0.9, -150, 1]],
    },
    kc: {
      fl: [[30, 68, 15.5, 0]],
      lv: [[18, 76, 1.05, -120], [42, 76, 1.05, 120], [16, 62, 0.95, -70], [44, 62, 0.95, 70], [30, 86, 1, 180]],
    },
  };
  function botanPlant(k) {
    const L = BOTAN_L[k];
    let stems = "";
    for (const [x, y, r] of L.fl) stems += `M${x} ${y + r * 0.6}C${x - 3} ${y + 20} ${x + 3} ${y + 34} ${x} 99`;
    const back = L.lv.filter((l) => !l[4]), front = L.lv.filter((l) => l[4]);
    return S(stems, SUMI, 2.6) + S(stems, FUKAMIDORI, 1.3) + botanLeaves(back) + (front.length ? botanLeaves(front, WAKAKUSA) : "") +
      L.fl.map((f) => botan(...f)).join("");
  }
  function chouCard() {
    return botanPlant("kc") + chou(17, 24, 1.05, -18, AI, YAMABUKI) + chou(43, 40, 0.95, 20, SHIRO, SHU);
  }

  // ============================================================
  // 7月 萩
  // ============================================================
  function hagi(stems, seed) {
    const R = rng(seed);
    let st = "", l1 = "", l2 = "", f1 = "", f2 = "";
    stems.forEach((q, si) => {
      st += bzD(q);
      let side = si % 2 ? 1 : -1;
      for (let t = 0.1; t < 0.99; t += 0.058) {
        const [x, y] = bz(q, t), ang = bzAng(q, t);
        side = -side;
        if (R() < 0.42 - t * 0.12) {
          // 三つ葉
          const la = ang + side * 0.95, L = 3.5 + R() * 0.9;
          const ex = x + Math.cos(la) * 1.2, ey = y + Math.sin(la) * 1.2;
          let d = lens(ex, ey, ex + Math.cos(la) * L, ey + Math.sin(la) * L, 2.6);
          for (const o of [-0.75, 0.75]) d += lens(ex, ey, ex + Math.cos(la + o) * L * 0.78, ey + Math.sin(la + o) * L * 0.78, 2.2);
          if (R() < 0.5) l1 += d; else l2 += d;
        } else {
          // 花の房（下へ垂れる）
          const da = ang + side * 1.15;
          for (let j = 0; j < 3; j++) {
            const k = 1.5 + j * 1.8, fx = x + Math.cos(da) * k, fy = y + Math.sin(da) * k + j * 0.8;
            f1 += cp(fx, fy, 1.55 - j * 0.22);
            f2 += cp(fx + 0.45, fy + 0.4, 0.85 - j * 0.13);
          }
        }
      }
    });
    return S(st, SUMI, 1.3) + P(l1, FUKAMIDORI, ol(0.35)) + P(l2, WAKAKUSA, ol(0.35, FUKAMIDORI)) +
      P(f1, MOMO, ol(0.5, SHINKU)) + P(f2, FUJI, op(0.9));
  }
  const HAGI_L = {
    k0: [[2, 99, 4, 62, 26, 30, 58, 32], [9, 99, 14, 72, 34, 52, 60, 62], [0, 78, 2, 46, 16, 14, 44, 5], [18, 99, 24, 84, 42, 74, 60, 86], [0, 58, 8, 40, 22, 28, 34, 30]],
    k1: [[58, 99, 56, 62, 34, 30, 2, 32], [51, 99, 46, 72, 26, 52, 0, 62], [60, 78, 58, 46, 44, 14, 16, 5], [42, 99, 36, 84, 18, 74, 0, 86], [60, 58, 52, 40, 38, 28, 26, 30]],
    ki: [[0, 72, 6, 44, 26, 18, 58, 12], [6, 76, 16, 52, 34, 38, 60, 40], [0, 48, 4, 28, 14, 8, 34, 0], [28, 66, 36, 44, 50, 34, 62, 38], [0, 62, 10, 50, 20, 44, 26, 50]],
  };
  const hagiPlant = (k, seed) => hagi(HAGI_L[k], seed);
  function ground(y, col = TSUCHI) {
    return P(`M0 ${y}C12 ${y - 3} 24 ${y + 2} 36 ${y - 1}S54 ${y - 2} 60 ${y}V98H0Z`, col, ol(0.7));
  }
  function inoshishi() {
    return P("M22 80L25 90L28 94L31 92.5L28 86L28 80ZM41 80L37 88L34 93L37 94L42 88L47 80Z", SUMI) +
      P("M7 75C8 71 11 68 15 66L17.5 61.5L20 65.5C24 62 30 60 37 61C44 62 50 65 52 70C53 74 51 78 48 80L52 86L56 91L52.5 92.5L47.5 86L42 81C36 83 28 83 23 82L18 88L13 93L10.5 91L14 85L16 79C13 79 10 78.5 7 77Z", CHA, ol(0.8)) +
      P("M16 79C22 82 34 83 42 81C36 81 26 81 16 79Z", TSUCHI) +
      P("M17 64L19 57.5L22 61.5L24.5 55.5L27 60.5L30 54.5L32.8 59.8L36 54.5L38 60.5L41.5 56L42.5 62C36 60 26 60.5 17 64Z", SUMI) +
      S("M52 70C55 68 56 66 55 63.5", SUMI, 1) +
      P("M6 74.2C5.2 74.6 5.2 77.2 6.2 77.6L7.4 77.4L7.2 74.2Z", TSUCHI, ol(0.5)) +
      S("M10 77.5C10.5 75.5 12 74.5 13.4 74", SHIRO, 1.1) +
      Ci(14.2, 69.2, 1.1, SHIRO) + Ci(14.2, 69.2, 0.6, SUMI) +
      S("M26 66C30 64.5 34 64.5 38 65.5M30 70C34 69 38 69.5 42 71", SUMI, 0.6, op(0.45));
  }

  // ============================================================
  // 8月 芒
  // ============================================================
  const HILL = {
    k0: { d: "M0 56C12 46 22 42 32 42C42 42 50 46 60 52V98H0Z", top: (x) => 42 + Math.pow((x - 32) / 32, 2) * 12 },
    k1: { d: "M0 48C10 50 20 56 30 55C40 54 50 46 60 44V98H0Z", top: (x) => 48 + Math.sin(x / 60 * Math.PI) * 7 - x * 0.08 },
    ks: { d: "M0 60C12 52 22 49 32 49C42 49 50 52 60 58V98H0Z", top: (x) => 49 + Math.pow((x - 32) / 32, 2) * 10 },
  };
  function susukiHill(k, seed, plumes = [[9, 15, 1], [24, 19, -1], [40, 17, 1], [53, 13, -1]]) {
    const H = HILL[k], R = rng(seed);
    const top = (x) => H.top(Math.min(59, Math.max(1, x)));
    // 丘の上の草むら（白い細線の扇）
    let gr = "";
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const bx = col * 11 + (row % 2) * 5.5 - 1 + R() * 2.5, by = top(bx) + 9 + row * 10.5 + R() * 2;
        if (by > 100) continue;
        for (let j = 0; j < 5; j++) {
          const a = -58 + j * 29 + (R() - 0.5) * 10, L = 6.5 + R() * 3.5;
          gr += `M${n2(bx)} ${n2(by)}Q${pl(bx, by, L * 0.6, a * 0.45)} ${pl(bx, by, L, a)}`;
        }
      }
    }
    // 丘の稜線から空へ伸びる黒い葉
    let bl = "";
    for (const [x, dir, L] of [[4, 1, 12], [15, -1, 10], [30, 1, 13], [45, -1, 11], [56, -1, 12]]) {
      const y0 = top(x) + 2;
      bl += lens(x, y0, x + dir * L * 0.7, y0 - L, 2.4, dir * 1.6);
    }
    // 穂（白い房が垂れる）
    let stalk = "", plume = "";
    for (const [x, h, dir] of plumes) {
      const y0 = top(x) + 1, xt = x + dir * 4, yt = y0 - h;
      stalk += `M${x} ${n2(y0)}Q${n2(x - dir)} ${n2(y0 - h * 0.6)} ${n2(xt)} ${n2(yt)}`;
      for (let j = 0; j < 5; j++) {
        plume += lens(xt, yt, xt + dir * (3.2 + j * 1.3), yt + 1.5 + j * 2.1, 1.7, dir * 0.5);
      }
    }
    return P(H.d, SUMI) + P(bl, SUMI) + S(gr, KINARI, 0.7, op(0.8)) + S(stalk, SUMI, 1.1) + P(plume, SHIRO, ol(0.35));
  }
  function kari(x, y, s = 1, a = 0) {
    const t = T(x, y, s, a);
    return P(t.d("M-11 -0.4L-7 -1.2C-3 -2.2 3 -2 8 -1L12 0.2L8 1.4C3 2.2 -3 2 -7 0.8Z"), SUMI) +
      P(t.d("M-2 -1.4C-1 -6 2 -10 8 -13C6 -8 5 -4 4 -1.2Z"), SUMI, ol(0.4, KINARI)) +
      P(t.d("M-1 1C1 4 3 7 7 9C6 6 5 3.5 4 1Z"), SUMI, ol(0.4, KINARI)) +
      P(t.d("M-11 -0.4L-13.2 0.2L-11 0.6Z"), YAMABUKI);
  }

  // ============================================================
  // 9月 菊
  // ============================================================
  function kiku(cx, cy, r, col, core) {
    let o = "", i2 = "";
    for (let k = 0; k < 16; k++) { const a = k * 22.5, p1 = pl(cx, cy, r * 0.3, a), p2 = pl(cx, cy, r, a); o += lens(p1[0], p1[1], p2[0], p2[1], r * 0.4); }
    for (let k = 0; k < 11; k++) { const a = k * 32.7 + 11, p1 = pl(cx, cy, r * 0.12, a), p2 = pl(cx, cy, r * 0.62, a); i2 += lens(p1[0], p1[1], p2[0], p2[1], r * 0.34); }
    return P(o, col, ol(0.5, col === SHIRO ? TSUCHI : SUMI)) + P(i2, col, ol(0.45, col === SHIRO ? TSUCHI : SUMI)) + Ci(cx, cy, r * 0.2, core, ol(0.45));
  }
  const KIKU_LEAF = "M0 0C-2 -1 -4 -2.5 -5 -4.5L-8.5 -4.5L-6.5 -7L-10 -9L-7 -10.5L-8.5 -14L-5 -13.5L-4.5 -17L-2 -15.5L0 -19.5L2 -15.5L4.5 -17L5 -13.5L8.5 -14L7 -10.5L10 -9L6.5 -7L8.5 -4.5L5 -4.5C4 -2.5 2 -1 0 0Z";
  function kikuLeaves(list) {
    let d = "", v = "";
    for (const [x, y, s, a] of list) { const t = T(x, y, s, a); d += t.d(KIKU_LEAF); v += t.d("M0 -1L0 -16M0 -6L-6 -9.5M0 -6L6 -9.5M0 -11L-4.5 -14M0 -11L4.5 -14"); }
    return P(d, FUKAMIDORI, ol(0.6)) + S(v, WAKAKUSA, 0.6);
  }
  function magaki() { // 竹垣（籬）
    let d = "";
    for (let i = -3; i < 7; i++) d += `M${i * 10} 99L${i * 10 + 18} 74M${i * 10 + 18} 99L${i * 10} 74`;
    return S(d, SUMI, 2.4) + S(d, TSUCHI, 1.2) + S("M0 76H60", SUMI, 2.8) + S("M0 76H60", KIN, 1.4);
  }
  const KIKU_L = {
    k0: { fl: [[30, 30, 13, YAMABUKI, CHA], [14, 55, 9.5, SHU, YAMABUKI], [46, 57, 10, SHIRO, YAMABUKI]], lv: [[23, 44, 1, -60], [37, 44, 1, 60], [30, 66, 1.1, 175], [8, 70, 0.9, -130], [52, 72, 0.9, 130], [46, 18, 0.8, 50], [12, 26, 0.8, -60]] },
    k1: { fl: [[39, 26, 12.5, YAMABUKI, CHA], [17, 40, 9.5, SHIRO, YAMABUKI], [34, 58, 10, SHU, YAMABUKI]], lv: [[27, 40, 1, -50], [51, 42, 0.9, 65], [12, 58, 1, -115], [48, 70, 1, 140], [24, 72, 0.9, -160], [10, 18, 0.8, -40]] },
    kc: { fl: [[19, 20, 11, YAMABUKI, CHA], [45, 19, 8.5, SHU, YAMABUKI], [34, 40, 7.5, SHIRO, YAMABUKI]], lv: [[8, 38, 0.9, -80], [26, 36, 0.85, -30], [53, 34, 0.85, 60], [45, 50, 0.8, 120], [18, 50, 0.8, -140]] },
  };
  function kikuPlant(k, fence = true) {
    const L = KIKU_L[k];
    let stems = "";
    for (const [x, y] of L.fl) stems += `M${x} ${y}C${x + 3} ${y + 20} ${x - 3} ${y + 40} ${x + 1} 99`;
    return (fence ? magaki() : "") + S(stems, FUKAMIDORI, 1.3) + kikuLeaves(L.lv) + L.fl.map((f) => kiku(...f)).join("");
  }
  function sakazuki() {
    return P("M22 83L38 83L40 88.5L20 88.5Z", SHINKU, ol(0.7)) +
      P("M10 69C11 79 20 84 30 84C40 84 49 79 50 69Z", SHINKU, ol(0.8)) +
      S("M14 76C20 80 40 80 46 76", SHU, 1, op(0.8)) +
      `<ellipse cx="30" cy="69" rx="20" ry="8.5" fill="${SHU}"${ol(0.8)}/>` +
      `<ellipse cx="30" cy="69" rx="17.6" ry="6.9" fill="none" stroke="${KIN}" stroke-width=".8"/>` +
      S("M17 66C22 63.6 28 63 34 63.4", SHIRO, 0.9, op(0.45)) +
      `<text x="30" y="73.8" font-family="serif" font-size="12" font-weight="700" fill="${YAMABUKI}" stroke="${SHINKU}" stroke-width=".5" paint-order="stroke" text-anchor="middle">寿</text>`;
  }

  // ============================================================
  // 10月 紅葉
  // ============================================================
  const MOMIJI_LOBES = [[-118, 0.52], [-78, 0.84], [-38, 1], [0, 1.1], [38, 1], [78, 0.84], [118, 0.52]];
  function momijiD(cx, cy, s, rot) {
    let d = `M${pl(cx, cy, s * 0.16, rot + 180)}`;
    for (const [a, len] of MOMIJI_LOBES) {
      d += `L${pl(cx, cy, s * 0.44, rot + a - 19)}Q${pl(cx, cy, s * len * 0.78, rot + a - 17)} ${pl(cx, cy, s * len, rot + a)}` +
        `Q${pl(cx, cy, s * len * 0.78, rot + a + 17)} ${pl(cx, cy, s * 0.44, rot + a + 19)}`;
    }
    return d + "Z";
  }
  function momiji(list) { // [x, y, 大きさ, 向き, 色番号]
    const cols = [SHU, SHINKU, YAMABUKI];
    const d = ["", "", ""];
    let v = "", pet = "";
    for (const [x, y, s, r, c = 0] of list) {
      d[c] += momijiD(x, y, s, r);
      for (const [a, len] of MOMIJI_LOBES) v += `M${n2(x)} ${n2(y)}L${pl(x, y, s * len * 0.72, r + a)}`;
      pet += `M${pl(x, y, s * 0.12, r + 180)}L${pl(x, y, s * 0.5, r + 180)}`;
    }
    return S(pet, SUMI, 0.7) + d.map((dd, i) => dd ? P(dd, cols[i], ol(0.55)) : "").join("") + S(v, SHINKU, 0.45, op(0.6));
  }
  function momijiLayout(seed, area, n, br) {
    const R = rng(seed), list = [];
    for (let i = 0; i < n; i++) {
      list.push([area[0] + R() * area[2], area[1] + R() * area[3], 5 + R() * 2.2, R() * 70 - 35, R() < 0.2 ? 1 : R() < 0.12 ? 2 : 0]);
    }
    return br.map(([d, w]) => S(d, SUMI, w)).join("") + momiji(list);
  }
  const MOMIJI_L = {
    k0: {
      br: [["M-2 18C12 22 22 30 30 42S44 60 52 72", 2.6], ["M20 27C24 18 30 12 40 8M34 50C40 46 48 44 58 44M44 62C40 68 36 76 34 86M12 20C10 12 8 8 4 4", 1.4]],
      lv: [[8, 10, 7.5, -20], [24, 12, 8, 10], [40, 7, 7.5, 25, 1], [53, 17, 7, 35], [14, 32, 8, -30], [32, 26, 7.5, 15, 2], [47, 33, 7.5, 30], [22, 48, 8, -10],
        [56, 46, 7.5, 40, 1], [40, 55, 7.5, 10], [9, 61, 7, -40], [29, 68, 7.5, -15, 2], [51, 74, 8, 30], [36, 87, 8, -5], [17, 82, 7, -25, 1], [53, 93, 7, 20]],
    },
    k1: {
      br: [["M62 14C48 18 38 26 30 40S16 58 8 70", 2.6], ["M40 23C36 14 30 8 20 4M26 48C20 44 12 42 2 42M16 60C20 66 24 74 26 84M48 16C50 10 52 6 56 2", 1.4]],
      lv: [[52, 8, 7.5, 20], [36, 10, 8, -10], [20, 5, 7.5, -25, 1], [7, 15, 7, -35], [46, 30, 8, 30], [28, 24, 7.5, -15, 2], [13, 31, 7.5, -30], [38, 46, 8, 10],
        [4, 43, 7.5, -40, 1], [20, 53, 7.5, -10], [51, 58, 7, 40], [31, 66, 7.5, 15, 2], [9, 72, 8, -30], [24, 85, 8, 5], [43, 80, 7, 25, 1], [7, 93, 7, -20]],
    },
    kd: {
      br: [["M-2 16C12 20 22 24 30 30S46 36 62 30", 2.6], ["M18 20C22 12 28 8 36 4M40 34C44 40 46 46 52 52M10 22C8 30 8 36 7 42", 1.4]],
      lv: [[8, 10, 7.5, -20], [22, 9, 8, 10], [37, 5, 7.5, 25, 1], [52, 12, 7.5, 35], [15, 28, 7.5, -30, 2], [31, 21, 8, 15], [46, 26, 7.5, 30], [57, 37, 7, 40, 1], [52, 52, 7, 20], [6, 44, 6.5, -30]],
    },
  };
  const momijiPlant = (k) => MOMIJI_L[k].br.map(([d, w]) => S(d, SUMI, w)).join("") + momiji(MOMIJI_L[k].lv);
  function shika() {
    return S("M20 77L19 93M24.5 78L26 93M44 76C47 82 46 88 45.5 93M39 78L38.5 93", SUMI, 2.8) +
      S("M20 77L19 93M24.5 78L26 93M44 76C47 82 46 88 45.5 93M39 78L38.5 93", CHA, 1.5) +
      P("M17.5 93H21M24 93H28M43.5 93H47.5M36.5 93H40.5", SUMI, ol(1.4)) +
      P("M14.5 70C13 63 14 57 17 52L23.5 51.5C23 56 22.5 61 23 65Z", CHA, ol(0.75)) +
      P("M16 69C16 63 24 61 34 62C42 62 48 64 50 69C51 74 48 78 42 79C34 80 24 80 19 78C16 76 16 73 16 69Z", CHA, ol(0.8)) +
      P("M19 76C26 78.5 36 78.5 44 77C36 76.5 26 76.5 19 76Z", KINARI, op(0.9)) +
      S("M21 49C19 43 17 39 13 35M19 43L22.5 38.5M16.5 39.5L12.5 38M22.5 48.5C24 43 26 39 30 36M24.5 42L28.5 41.5M27 39L27.5 34", SUMI, 2) +
      S("M21 49C19 43 17 39 13 35M19 43L22.5 38.5M16.5 39.5L12.5 38M22.5 48.5C24 43 26 39 30 36M24.5 42L28.5 41.5M27 39L27.5 34", TSUCHI, 1) +
      P("M17 52.5C17 48.5 21 46.5 24 47.5C27 48.5 30 50.5 31.5 52.5C31.5 54.5 29.5 55 27.5 55C24.5 55 22 56 19.5 56C17.5 56 17 54.5 17 52.5Z", CHA, ol(0.75)) +
      P("M19 49L12.5 46.5L17.8 51.5Z", CHA, ol(0.6)) +
      Ci(31.2, 52.8, 0.9, SUMI) + Ci(26, 50.8, 0.75, SUMI) +
      P([[26, 66], [31, 65], [36, 65.5], [41, 67], [28.5, 70], [33.5, 69.5], [38.5, 70.5], [44, 71], [23, 70]].map(([x, y]) => cp(x, y, 1.05)).join(""), SHIRO) +
      P("M49.5 66C52 64 53 66 52 68.5C51 68.5 50 68 49.5 66Z", SHIRO, ol(0.5));
  }

  // ============================================================
  // 11月 柳（雨）
  // ============================================================
  function willow(strands, leafCol = WAKAKUSA) {
    let st = "", lv = "";
    for (const [x, y, len, sw] of strands) {
      const q = [x, y, x + sw * 0.2, y + len * 0.4, x + sw, y + len * 0.7, x + sw * 0.8, y + len];
      st += bzD(q);
      let side = 1;
      for (let t = 0.1; t < 0.99; t += 0.085) {
        const [px, py] = bz(q, t), a = bzAng(q, t) + side * 0.5;
        lv += lens(px, py, px + Math.cos(a) * 4.2, py + Math.sin(a) * 4.2, 1.9);
        side = -side;
      }
    }
    return S(st, FUKAMIDORI, 0.9) + P(lv, leafCol, ol(0.35, FUKAMIDORI));
  }
  function rain(seed, n = 26, col = SUMI, o = 0.5, area = [0, 0, 60, 98]) {
    const R = rng(seed);
    let d = "";
    for (let i = 0; i < n; i++) {
      const x = area[0] + R() * area[2], y = area[1] + R() * area[3], L = 5 + R() * 5;
      d += `M${n2(x)} ${n2(y)}L${n2(x - L * 0.36)} ${n2(y + L)}`;
    }
    return S(d, col, 0.65, op(o));
  }
  function stream(y) {
    return P(`M0 ${y}C8 ${y - 4} 16 ${y + 2} 26 ${y}S42 ${y - 4} 60 ${y + 1}V98H0Z`, SUMI) +
      S(`M3 ${y + 5}C6 ${y + 3} 9 ${y + 7} 12 ${y + 5}M20 ${y + 9}C23 ${y + 7} 26 ${y + 11} 29 ${y + 9}M36 ${y + 5}C39 ${y + 3} 42 ${y + 7} 45 ${y + 5}M48 ${y + 11}C51 ${y + 9} 54 ${y + 13} 57 ${y + 11}`, SORA, 0.9);
  }
  const YANAGI_L = {
    k0: {
      tr: ["M-3 70C6 58 10 36 6 -2", 4], br: "M7 22C18 12 36 10 60 18M8 42C20 36 30 36 40 40",
      st: [[16, 15, 60, 3], [24, 12, 70, -2], [33, 11, 56, 3], [42, 12, 66, -3], [51, 15, 52, 2], [58, 17, 60, -2], [20, 38, 44, 2], [32, 36, 40, -2]],
    },
    k1: {
      tr: ["M63 74C54 60 50 36 54 -2", 4], br: "M53 20C42 10 24 10 0 18M52 44C40 38 30 38 20 42",
      st: [[44, 14, 62, -3], [36, 12, 70, 2], [27, 11, 56, -3], [18, 13, 66, 3], [9, 15, 52, -2], [2, 17, 60, 2], [40, 40, 44, -2], [28, 38, 40, 2]],
    },
  };
  function yanagi(k, seed = 1) {
    const L = YANAGI_L[k];
    return limb(L.tr[0], L.tr[1], SUMI) + S(L.br, SUMI, 1.6) + willow(L.st) + rain(seed);
  }
  function tsubame(x, y, s = 1, a = 0) {
    const t = T(x, y, s, a);
    return P(t.d("M-2 1C1 6 5 10 12 13C7 8 4.5 4 2 1Z"), SUMI, ol(0.4, AI)) +
      P(t.d("M-10 0C-7 -2.2 -2 -2.2 3 -1.2L13 -4.6L8.6 0L14 3.6L3 1.2C-2 2.2 -7 2 -10 0Z"), AI, ol(0.5, SUMI)) +
      P(t.d("M-7 0.8C-3 2.2 1 2 4 1.2C0 0.8 -4 0.8 -7 0.8Z"), SHIRO) +
      P(t.d("M-2 -1C0 -9 6 -15 16 -19C10 -12 6 -6 3 -1Z"), SUMI, ol(0.4, AI)) +
      Ci(...t.pt(-8.2, 0.4), t.r(1.3), SHU) +
      P(t.d("M-10 -0.3L-12.2 0.3L-10 0.8Z"), SUMI) + Ci(...t.pt(-8, -0.9), t.r(0.5), SHIRO);
  }
  function michikaze() {
    const u = T(38, 25, 1, 12);
    return sky(12) + limb("M64 50C56 40 52 20 54 -2", 3.6, SUMI) + S("M54 12C46 7 38 7 28 10M55 28C50 24 46 24 42 26", SUMI, 1.4) +
      willow([[50, 9, 52, 2], [44, 8, 38, -2], [57, 13, 62, -2], [38, 8, 26, 2], [32, 9, 16, -1], [47, 25, 40, 2]]) +
      rain(71, 30, SUMI, 0.5) +
      ground(92, TSUCHI) +
      P("M0 76C7 73 13 78 19 77C25 76 28 82 27 88C26 93 27 96 29 99H0Z", SUMI) +
      S("M3 81C5 79.6 7 82.4 9 81M12 86C14 84.6 16 87.4 18 86M4 91C6 89.6 8 92.4 10 91M15 95C17 93.6 19 96.4 21 95", SORA, 0.9) +
      // 蛙
      G(S("M-3 0.5L-8 2.5L-12.5 1.2M-2.5 2L-7 5.6L-11.5 6.4M5 2L8.6 4.6M3 2.8L5.4 6", SUMI, 2.5) +
        S("M-3 0.5L-8 2.5L-12.5 1.2M-2.5 2L-7 5.6L-11.5 6.4M5 2L8.6 4.6M3 2.8L5.4 6", WAKAKUSA, 1.2) +
        P("M-5 1C-6 -2 -3 -5 1 -5C5 -5 8.5 -3 8.5 0C8.5 2 5 3.4 1 3.4C-2 3.4 -4 2.6 -5 1Z", WAKAKUSA, ol(0.7)) +
        P("M-3 2.4C0 3.4 4 3.4 7 2C4 1.6 0 1.8 -3 2.4Z", YAMABUKI, op(0.9)) +
        P([[-1, -2.6, 0.7], [1.8, -3.6, 0.6], [2.2, -1.2, 0.5]].map(([x, y, r]) => cp(x, y, r)).join(""), FUKAMIDORI) +
        Ci(5.4, -4.2, 1.4, YAMABUKI, ol(0.5)) + Ci(5.7, -4.2, 0.6, SUMI), "translate(11 77.5) rotate(-36) scale(1.05)") +
      // 小野道風
      P("M31 52C27 58 24 72 20 90L50 90C47 74 42 60 37 52Z", AI, ol(0.8)) +
      P("M20 90L50 90L49.4 93.6L20.6 93.6Z", SHU, ol(0.6)) +
      P("M22.5 93.6L27 93.6L26.5 95.4L22 95.4ZM41 93.6L45.5 93.6L46 95.4L41.5 95.4Z", SUMI) +
      S("M30 60C28 70 26 80 25 89M38 60C39 70 41 80 43 89M34 62L34.6 89", SUMI, 0.6, op(0.5)) +
      P("M31.4 51.4L33.6 56L35.8 51.6Z", SHIRO, ol(0.4)) +
      P("M30.5 54C24 58 20 66 22 73C26 71 30 66 33 60Z", AI, ol(0.7)) +
      S("M22 73C24.5 72 26.5 70.6 28 69", SHIRO, 0.9) +
      S("M28 58C25 62 23 67 23 71", SUMI, 0.5, op(0.5)) +
      Ci(33.4, 48.4, 3.4, KINARI, ol(0.7)) +
      P("M30.6 46.4L31.2 39.4L35.8 40.4L36 46.8Z", SUMI) +
      S("M31.3 48.6L32.5 48.4", SUMI, 0.5) +
      S("M34.4 56L38 26", SUMI, 0.9) +
      P(u.d("M-16 0C-14 -8 -7 -11 0 -11C7 -11 14 -8 16 0C11 -1.5 5 -1.5 0 0C-5 -1.5 -11 -1.5 -16 0Z"), YAMABUKI, ol(0.8)) +
      S(u.d("M0 -11L-16 0M0 -11L-8 -1.2M0 -11L8 -1.2M0 -11L16 0"), SUMI, 0.5, op(0.7)) +
      S(u.d("M-9.5 -6.8C-5 -8.4 5 -8.4 9.5 -6.8"), SHIRO, 1.3) +
      S(u.d("M0 -11L0 -13.5"), SUMI, 1) +
      Ci(34.6, 55.4, 1.5, KINARI, ol(0.5));
  }
  function kaminari() {
    let drums = "", marks = "";
    for (let i = 0; i < 8; i++) {
      const p = pl(30, 30, 16, i * 45);
      drums += cp(p[0], p[1], 3.6);
      marks += cp(p[0], p[1], 1.5);
    }
    return Re(0, 0, 60, 98, SUMI) +
      S("M6 -2C9 14 4 28 8 44M13 -2C15 12 12 22 14 34M48 -2C46 10 50 22 47 36M55 -2C57 14 53 26 56 40", FUKAMIDORI, 1.3) +
      rain(113, 34, KINARI, 0.28) +
      Ci(30, 30, 16, "none", ` stroke="${SHU}" stroke-width="1.8"`) +
      P(drums, SHU, ol(0.9, KIN)) + P(marks, KIN) +
      P("M42 34L30 54H37L23 73H30L13 97L40 64H33L47 45H40L51 34Z", SHU, ol(0.9, YAMABUKI)) +
      P("M40 37L33 49H39L28 64H33L23 80L36 65H31L42 48H37L45 37Z", YAMABUKI, op(0.85));
  }

  // ============================================================
  // 12月 桐
  // ============================================================
  const KIRI_LEAF = "M0 0C-6 0 -12 -6 -13.5 -15C-11 -15.5 -8.5 -16.5 -7 -18.5C-6 -22.5 -3 -26 0 -29C3 -26 6 -22.5 7 -18.5C8.5 -16.5 11 -15.5 13.5 -15C12 -6 6 0 0 0Z";
  const KIRI_VEIN = "M0 -1L0 -26M0 -6L-10 -13.5M0 -6L10 -13.5M0 -14L-5 -19.5M0 -14L5 -19.5";
  function kiriLeaves(list) { // [x, y, s, a, 濃=1]
    const d = ["", ""], v = ["", ""];
    for (const [x, y, s, a, c = 0] of list) { const t = T(x, y, s, a); d[c] += t.d(KIRI_LEAF); v[c] += t.d(KIRI_VEIN); }
    return (d[0] ? P(d[0], WAKAKUSA, ol(0.7)) + S(v[0], FUKAMIDORI, 0.7) : "") + (d[1] ? P(d[1], FUKAMIDORI, ol(0.7)) + S(v[1], WAKAKUSA, 0.7) : "");
  }
  const KIRI_BELL = "M0 0C-2.2 -0.4 -2.8 -3 -2.2 -4.8C-1.4 -5.6 -0.7 -4.6 0 -5.6C0.7 -4.6 1.4 -5.6 2.2 -4.8C2.8 -3 2.2 -0.4 0 0Z";
  function kiriSpikes(list) { // [x, y, 高さ, 傾き, 花数]
    let st = "", fl = "", cal = "";
    for (const [x, y, h, a, n] of list) {
      const t = T(x, y, 1, a);
      st += t.d(`M0 0L0 ${-h}`);
      for (let i = 0; i < n; i++) {
        const v = -h * (0.22 + 0.74 * i / n), side = i % 2 ? 1 : -1, sz = 1.05 - i * 0.06;
        const b = t.pt(0, v), e = t.pt(side * 2.8 * sz, v - 1.2);
        st += `M${b}L${e}`;
        fl += T(e[0], e[1], sz, a + side * 42).d(KIRI_BELL);
        cal += cp(e[0], e[1], 0.95 * sz);
      }
      const tip = t.pt(0, -h);
      fl += T(tip[0], tip[1], 0.8, a).d(KIRI_BELL);
    }
    return S(st, FUKAMIDORI, 1.2) + P(fl, FUJI, ol(0.45)) + P(cal, FUKAMIDORI);
  }
  const KIRI_L = {
    k0: { sp: [[30, 44, 34, 0, 7], [18, 47, 26, -22, 5], [42, 47, 26, 22, 5]], lv: [[30, 50, 1.4, 180, 1], [23, 51, 1.25, 235], [37, 51, 1.25, 125], [7, 95, 1.1, 205, 1], [53, 95, 1.1, 155, 1]] },
    k1: { sp: [[20, 42, 32, -8, 7], [36, 38, 24, 16, 5]], lv: [[40, 60, 1.45, 150, 1], [22, 64, 1.35, 210], [45, 42, 1, 60], [30, 86, 1.2, 180, 1], [8, 52, 0.95, -80, 1]] },
  };
  function kiriPlant(k) {
    const L = KIRI_L[k];
    return kiriSpikes(L.sp) + kiriLeaves(L.lv);
  }
  function kiriKasu(v) {
    if (v === 2) return P("M0 50C12 46 22 52 34 49S52 46 60 49V98H0Z", YAMABUKI, ol(0.8)) + kiriPlant("k0");
    return kiriPlant(v ? "k1" : "k0");
  }
  function featherFan(x, y, a0, a1, n, l0, l1, w, col) {
    let d = "";
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0, a = a0 + (a1 - a0) * t, L = l0 + (l1 - l0) * t;
      const p = pl(x, y, L, a), b = pl(x, y, L * 0.12, a);
      d += lens(b[0], b[1], p[0], p[1], w);
    }
    return P(d, col, ol(0.55));
  }
  function houou() {
    let s = "";
    // 尾羽（5本・先に目玉模様）
    const plumes = [[30, 58, 11, 94, -5, SHU], [31, 60, 22, 100, -4, FUKAMIDORI], [32, 61, 36, 100, 3, KIN], [33, 60, 49, 96, 5, FUKAMIDORI], [34, 58, 59, 84, 5, SHU]];
    let eyes = "", pupils = "";
    for (const [x0, y0, x1, y1, b, col] of plumes) {
      s += P(lens(x0, y0, x1, y1, 6.2, b), col, ol(0.6));
      const e = [x0 + (x1 - x0) * 0.8, y0 + (y1 - y0) * 0.8];
      eyes += cp(e[0], e[1], 2.3);
      pupils += cp(e[0], e[1], 1.1);
    }
    s += P(eyes, YAMABUKI, ol(0.5)) + P(pupils, AI);
    // 翼（左右に大きく広げる：緑→朱→金の三層）
    s += featherFan(27, 48, -82, -12, 7, 26, 31, 6, FUKAMIDORI) + featherFan(35, 48, 12, 82, 7, 31, 26, 6, FUKAMIDORI);
    s += featherFan(27, 48, -76, -18, 6, 19, 22, 6, SHU) + featherFan(35, 48, 18, 76, 6, 22, 19, 6, SHU);
    s += featherFan(27, 48, -70, -24, 5, 11, 12.5, 5.5, KIN) + featherFan(35, 48, 24, 70, 5, 12.5, 11, 5.5, KIN);
    // 胴・首・頭
    s += P("M24 50C24 44 29 41 33 42C38 43 40 48 39 54C38 60 34 63 30 62C26 61 24 56 24 50Z", SHU, ol(0.8)) +
      S("M26.5 50C28.5 52 30.5 52 32.5 50M27 54.5C29 56.5 31 56.5 33 54.5M28 59C30 60.6 32 60.6 34 59", KIN, 0.9) +
      P("M26 45C23 41 22 36 23.5 31L28.5 30.5C28 35 29 39 31.5 43Z", SHU, ol(0.7)) +
      S("M24.6 34C25.4 38 27 41 29 43", KIN, 1) +
      Ci(26, 28.6, 3.4, SHU, ol(0.7)) +
      P("M27 25.4C27 20.4 31 16.4 36 15.4C33.5 17.9 32.5 19.4 32.5 21.4C34.5 19.4 37.5 19.4 40 20.4C36.5 21.4 33.5 23.4 29 27Z", KIN, ol(0.5)) +
      P("M22.8 27.6L17.2 29.2L23 30.6Z", KIN, ol(0.5)) +
      P("M23.6 31C23 33.2 24 34.8 25.4 34.8C25.4 33.4 25 32.2 24.6 31.2Z", SHU, ol(0.4)) +
      Ci(25, 28, 1.05, SHIRO) + Ci(24.8, 28, 0.55, SUMI);
    return s;
  }
  function hououCard() {
    return kasumi([[-3, 12, 22, 4.5, 1], [40, 5, 24, 4.5, -1], [-3, 70, 14, 4.5, 0], [48, 60, 16, 4.5, 0]]) +
      kiriLeaves([[2, 100, 1.05, 38, 1], [58, 100, 1.05, -38, 1]]) + houou();
  }

  // ============================================================
  // 月ごとの定義
  // ============================================================
  const MONTH = {
    1: {
      kasu: (v) => (v % 2 ? sky(20) + pine("k1") : sky(24) + pine("k0")),
      tan: () => sky(22) + pine("k1"),
      halo: [30, 15, 7.5], bird: [22, 62, 1, 1], tane: () => sky(24) + pine("k0"),
      sp: {
        tsuru: tsuruCard,
        akatan: () => sky(22) + pine("k1") + ribbon(SHU, "あかよろし"),
      },
    },
    2: {
      kasu: (v) => ume(v % 2 ? "k1" : "k0"),
      tan: () => ume("k1"),
      halo: [28, 14, 7.5], bird: [22, 66, 1.05, 1], tane: () => ume("kt"),
      sp: {
        uguisu: () => ume("kt") + uguisu(22, 66, 1.05),
        akatan: () => ume("k1") + ribbon(SHU, "あかよろし"),
      },
    },
    3: {
      kasu: (v) => sakura(v % 2 ? "k1" : "k0"),
      tan: () => sakura("k1"),
      halo: [30, 60, 8], bird: [30, 58, 1, 1], tane: () => sakura("k0"),
      sp: {
        maku: makuCard,
        akatan: () => sakura("k1") + ribbon(SHU, "みよしの"),
      },
    },
    4: {
      kasu: (v) => fuji(v % 2 ? "k1" : "k0"),
      tan: () => fuji("k0"),
      halo: [30, 80, 8], bird: [25, 42, 1, 1], tane: () => fuji("kt"),
      sp: {
        hototogisu: hototogisuCard,
        tan: () => fuji("k0") + ribbon(SHU),
      },
    },
    5: {
      kasu: (v) => iris(v % 2 ? "k1" : "k0"),
      tan: () => iris("k1"),
      halo: [30, 14, 8], bird: [36, 70, 1, 1], tane: () => iris("k0"),
      sp: {
        yatsuhashi: yatsuhashiCard,
        tan: () => iris("k1") + ribbon(SHU),
      },
    },
    6: {
      kasu: (v) => botanPlant(v % 2 ? "k1" : "k0"),
      tan: () => botanPlant("k0"),
      halo: [30, 14, 8], bird: [31, 44.5, 1.1, 1], tane: () => botanPlant("kc"),
      sp: {
        chou: chouCard,
        aotan: () => botanPlant("k0") + ribbon(AI),
      },
    },
    7: {
      kasu: (v) => ground(90) + hagiPlant(v % 2 ? "k1" : "k0", 7 + v),
      tan: () => ground(90) + hagiPlant("k0", 17),
      halo: [30, 60, 8], bird: [30, 82, 1, 1], tane: () => ground(88) + hagiPlant("ki", 27),
      sp: {
        inoshishi: () => ground(88) + hagiPlant("ki", 27) + inoshishi(),
        tan: () => ground(90) + hagiPlant("k0", 17) + ribbon(SHU),
      },
    },
    8: {
      kasu: (v) => fullSky() + susukiHill(v % 2 ? "k1" : "k0", 8 + v),
      tan: () => fullSky() + susukiHill("k0", 18),
      halo: [30, 22, 9], bird: [30, 34.5, 1, 1], tane: () => fullSky() + susukiHill("k0", 8), rib: [30, 66],
      sp: {
        tsuki: () => fullSky() + Ci(30, 26, 16, SHIRO, ol(0.9)) + Ci(26, 21, 3.5, KINARI, op(0.6)) + susukiHill("k0", 28),
        kari: () => fullSky() + kari(15, 16, 0.95, -8) + kari(31, 25, 0.95, -8) + kari(46, 16, 0.95, -8) + susukiHill("ks", 38),
      },
    },
    9: {
      kasu: (v) => kikuPlant(v % 2 ? "k1" : "k0"),
      tan: () => kikuPlant("k0"),
      halo: [30, 14, 8], bird: [41, 67.6, 1.05, 1], tane: () => kikuPlant("k0"),
      sp: {
        sakazuki: () => kikuPlant("kc", false) + sakazuki(),
        aotan: () => kikuPlant("k0") + ribbon(AI),
      },
    },
    10: {
      kasu: (v) => momijiPlant(v % 2 ? "k1" : "k0"),
      tan: () => momijiPlant("k1"),
      halo: [30, 60, 8], bird: [29, 32.5, 1.05, 1], tane: () => momijiPlant("k0"),
      sp: {
        shika: () => momijiPlant("kd") + shika(),
        aotan: () => momijiPlant("k1") + ribbon(AI),
      },
    },
    11: {
      kasu: (v) => yanagi(v % 2 ? "k1" : "k0", 11 + v) + stream(88),
      tan: () => yanagi("k1", 21) + stream(88),
      halo: [36, 70, 8], bird: [28, 28.8, 1.05, 1], tane: () => yanagi("k0", 31) + stream(88),
      sp: {
        ame: michikaze,
        tsubame: () => yanagi("k0", 31) + stream(88) + tsubame(34, 62, 1.15, -12),
        tan: () => yanagi("k1", 21) + stream(88) + ribbon(SHU),
        kaminari: kaminari,
      },
    },
    12: {
      kasu: kiriKasu,
      tan: () => kiriPlant("k0"),
      halo: [30, 22, 8], bird: [49, 50, 1.05, -1], tane: () => kiriPlant("k0"),
      sp: {
        houou: hououCard,
      },
    },
  };

  // ---------- 札の枠（黒縁）と台紙 ----------
  const FRAME = P("M3 0H57A3 3 0 0 1 60 3V95A3 3 0 0 1 57 98H3A3 3 0 0 1 0 95V3A3 3 0 0 1 3 0ZM3.4 1.6A1.8 1.8 0 0 0 1.6 3.4V94.6A1.8 1.8 0 0 0 3.4 96.4H56.6A1.8 1.8 0 0 0 58.4 94.6V3.4A1.8 1.8 0 0 0 56.6 1.6Z", SUMI, ' fill-rule="evenodd"');
  const wrap = (inner, paper = KINARI) =>
    `<svg viewBox="0 0 60 98" xmlns="http://www.w3.org/2000/svg">` +
    `<svg x="1.6" y="1.6" width="56.8" height="94.8" viewBox="1.6 1.6 56.8 94.8">${Re(0, 0, 60, 98, paper)}${inner}</svg>` +
    FRAME + `</svg>`;

  const TYPES = ["hikari", "tane", "tan", "kasu"];
  function generic(m, t, v) {
    const def = MONTH[m];
    if (t === "kasu") return def.kasu(v);
    if (t === "tan") return def.tan() + ribbon(SHU, "", ...(def.rib || [30, 50]));
    if (t === "tane") { const [x, y, s, fx] = def.bird; return def.tane() + suzume(x, y, s, fx); }
    return def.kasu(1) + halo(...def.halo);
  }
  const cache = new Map();
  function svg(card) {
    card = card || {};
    const m = Math.min(12, Math.max(1, Number(card.m) | 0 || 1));
    const t = TYPES.includes(card.t) ? card.t : "kasu";
    const v = Math.max(0, Number(card.v) | 0);
    const def = MONTH[m];
    const sp = card.sp && Object.prototype.hasOwnProperty.call(def.sp, card.sp) ? card.sp : "";
    const key = `${m}|${t}|${sp}|${v}`;
    let s = cache.get(key);
    if (s) return s;
    let body = sp ? def.sp[sp](v) : generic(m, t, v);
    if (t === "hikari") body += LIGHT;
    s = wrap(body);
    cache.set(key, s);
    return s;
  }

  // ---------- 札の裏 ----------
  let backSvg = "";
  function back() {
    if (backSvg) return backSvg;
    let star = "";
    for (let i = 0; i <= 5; i++) star += (i ? "L" : "M") + pl(30, 49, 12, (i * 144) % 360).join(" ");
    let dots = "";
    for (const [x, y] of [[8.5, 8.5], [51.5, 8.5], [8.5, 89.5], [51.5, 89.5]]) dots += `M${x} ${y - 2}L${x + 2} ${y}L${x} ${y + 2}L${x - 2} ${y}Z`;
    const inner = Re(0, 0, 60, 98, SUMI) +
      Re(4.6, 4.6, 50.8, 88.8, "none", ` stroke="${SHU}" stroke-width="1"`) +
      Re(6.4, 6.4, 47.2, 85.2, "none", ` stroke="${SHU}" stroke-width=".45" stroke-opacity=".8"`) +
      P(dots, KIN) +
      Ci(30, 49, 15, "none", ` stroke="${KIN}" stroke-width=".7" stroke-opacity=".7"`) +
      P(star + "Z", "none", ` stroke="${KIN}" stroke-width="1.8" stroke-linejoin="miter"`);
    backSvg = wrap(inner, SUMI);
    return backSvg;
  }

  return { svg, back };
})();
