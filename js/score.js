// ============================================================
// score.js — 役の判定と採点（純関数。画面にも保存にも触らない）
//   evaluate(played, opts)      … 打った札から成立する役を調べる
//   scorePlay(run, round, played, held, opts) … 霊力＝文×倍 を計算し、演出用の手順(steps)も返す
//   ・役は「月の役（最も高い1つ）」「揃い」「出来役（成立したものすべて）」が**全部重なる**
//   ・数える順番: 役の基本値 → 札（左から）→ 手札に残した札 → 式神（左から）→ 五神器
// ============================================================
"use strict";

// ---------- 乱数（再現できるように種つき。検証ボットでも同じ乱数列を使う） ----------
function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(a, b) { return a + Math.floor(next() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      return arr;
    },
    get state() { return s; },
    set state(v) { s = v >>> 0; },
  };
}

const Score = (() => {
  // 5つの月が「続き月」か（師走→睦月もつながる）。gap=true なら1か月とびまで許す（大天狗）
  function isNagare(cards, gap) {
    if (cards.length !== 5) return false;
    const ms = cards.map((c) => c.m);
    if (new Set(ms).size !== 5) return false;
    const maxStep = gap ? 2 : 1;
    for (const start of ms) {
      const off = ms.map((m) => (m - start + 12) % 12).sort((a, b) => a - b);
      let ok = true;
      for (let i = 1; i < 5; i++) if (off[i] - off[i - 1] > maxStep) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }

  // 役の判定。戻り値: { list: [{key, cards:[…]}], monthKey, maxSameMonth }
  //   opts.splash … 打った札はすべて数える（百々目鬼）
  //   opts.gapNagare … 月流れの1か月とびを許す（大天狗）
  //   opts.blockedMonth … 成立させない月の役の集合（八岐大蛇）
  function evaluate(played, opts = {}) {
    const list = [];
    const byMonth = new Map();
    for (const c of played) {
      if (!byMonth.has(c.m)) byMonth.set(c.m, []);
      byMonth.get(c.m).push(c);
    }
    const groups = [...byMonth.values()].sort((a, b) => b.length - a.length);
    const s0 = groups[0] ? groups[0].length : 0, s1 = groups[1] ? groups[1].length : 0;

    // --- 月の役（最も高い1つ） ---
    let mk = null, mcards = [];
    if (s0 >= 5) { mk = "gohon"; mcards = groups[0]; }
    else if (s0 === 4) { mk = "teshi"; mcards = groups[0]; }
    else if (s0 === 3 && s1 >= 2) { mk = "oyako"; mcards = groups[0].concat(groups[1]); }
    else if (isNagare(played, opts.gapNagare)) { mk = "nagare"; mcards = played.slice(); }
    else if (s0 === 3) { mk = "sanbon"; mcards = groups[0]; }
    else if (s0 === 2 && s1 === 2) { mk = "futaawase"; mcards = groups[0].concat(groups[1]); }
    else if (s0 === 2) { mk = "awase"; mcards = groups[0]; }
    let blocked = null;
    if (mk && opts.blockedMonth && opts.blockedMonth.has(mk)) { blocked = mk; mk = null; mcards = []; }
    if (mk) list.push({ key: mk, cards: mcards });

    // --- 揃い（5枚すべて同じ種類） ---
    if (played.length === 5) {
      const t = played[0].t;
      if (t !== "hikari" && played.every((c) => c.t === t)) {
        list.push({ key: t === "kasu" ? "kasuzoroi" : t === "tan" ? "tanzoroi" : "tanezoroi", cards: played.slice() });
      }
    }

    // --- 出来役（成立したものすべて） ---
    const sp = (k) => played.find((c) => c.sp === k);
    const need = (key, ...ks) => {
      const cs = ks.map(sp);
      if (cs.every(Boolean)) list.push({ key, cards: cs });
    };
    need("hanami", "maku", "sakazuki");
    need("tsukimi", "tsuki", "sakazuki");
    need("sugawara", "tsuru", "uguisu", "maku");
    need("inoshikacho", "inoshishi", "shika", "chou");
    for (const [key, k] of [["akatan", "akatan"], ["aotan", "aotan"]]) {
      const seen = new Map();
      for (const c of played) if (c.sp === k && !seen.has(c.m)) seen.set(c.m, c);
      if (seen.size >= 3) list.push({ key, cards: [...seen.values()].slice(0, 3) });
    }
    const lights = played.filter((c) => c.t === "hikari");
    const rain = lights.some((c) => c.m === 11);
    if (lights.length >= 5) list.push({ key: "gokou", cards: lights.slice(0, 5) });
    else if (lights.length === 4) list.push({ key: rain ? "ameshikou" : "shikou", cards: lights });
    else if (lights.length === 3 && !rain) list.push({ key: "sankou", cards: lights });

    // --- 役なし → 素札（いちばん文の高い札1枚。癖で数えない札は後回し・雲母摺は+40で比べる） ---
    if (list.length === 0 && played.length) {
      const val = (c) => (opts.debuffType && c.t === opts.debuffType ? -1 : TYPES[c.t].bun + (c.enh === "kira" ? 40 : 0));
      let best = played[0];
      for (const c of played) if (val(c) > val(best)) best = c;
      list.push({ key: "sufuda", cards: [best] });
    }

    // 数える札（打った順を保つ）
    let scored;
    if (opts.splash) scored = played.slice();
    else {
      const set = new Set();
      for (const y of list) for (const c of y.cards) set.add(c);
      scored = played.filter((c) => set.has(c));
    }
    return { list, keys: list.map((y) => y.key), monthKey: mk, blocked, scored, maxSameMonth: s0 };
  }

  // 役の値（段位込み）
  function yakuValue(run, key, noLevels) {
    const y = YAKU[key];
    const lvl = noLevels ? 1 : (run.levels[key] || 1);
    return { bun: y.bun + (lvl - 1) * y.lv[0], bai: y.bai + (lvl - 1) * y.lv[1], lvl };
  }

  // 起きている式神（眠っている＝玉藻前の化かし中のものを除く）の並び
  function activeShiki(run, round) {
    return run.shiki.map((s, i) => ({ s, i })).filter(({ i }) => !(round && round.sleeping === i));
  }

  // 管狐（右どなりの写し）の解決: 写し先の式神インスタンスを返す（無ければ null）
  // 写せるのは「点を増やす力」（onCard・onHeld・onScore）だけ。眠っている式神は写せない
  function resolveCopy(run, idx, round, seen = new Set()) {
    const me = run.shiki[idx];
    if (!me) return null;
    if (round && round.sleeping === idx && seen.size) return null;
    const def = SHIKI_BY_ID[me.id];
    if (def.flag !== "copyRight") return me;
    if (seen.has(idx)) return null;
    seen.add(idx);
    return resolveCopy(run, idx + 1, round, seen);
  }

  function hasFlag(run, round, flag) {
    return activeShiki(run, round).some(({ s }) => SHIKI_BY_ID[s.id].flag === flag);
  }

  // ---------- 採点 ----------
  // opts: { rng, preview } preview=true のときは乱数を消費せず・成長もしない（選択中の見込み表示）
  function scorePlay(run, round, played, held, opts = {}) {
    const rng = opts.rng || makeRng(1);
    const quirk = effectiveQuirk(run, round);
    const ev = evaluate(played, {
      splash: hasFlag(run, round, "splash"),
      gapNagare: hasFlag(run, round, "gapNagare"),
      blockedMonth: quirk && quirk.noRepeat ? new Set(round.usedYaku) : null,
      debuffType: quirk && quirk.debuffType,
    });
    const steps = [];
    const ctx = {
      bun: 0, bai: 0, steps,
      run, round, month: round.month, played, held,
      scored: ev.scored, yakuKeys: ev.keys, maxSameMonth: ev.maxSameMonth,
      isBoss: round.kind === "boss" || round.kind === "final",
      rng: opts.preview ? { int: (a, b) => Math.round((a + b) / 2), next: () => 0.5 } : rng,
      src: null,
      has(key) { return ev.keys.includes(key); },
      hasCat(cat) { return ev.keys.some((k) => YAKU[k].cat === cat); },
      hasShiki(id) { return activeShiki(run, round).some(({ s }) => s.id === id); },
      sanen() { return ["mizaru", "kikazaru", "iwazaru"].every((id) => this.hasShiki(id)); },
      addBun(n, label) { if (!n) return; this.bun += n; steps.push({ ...this.src, dBun: n, label }); },
      addBai(n, label) { if (!n) return; this.bai += n; steps.push({ ...this.src, dBai: n, label }); },
      mulBai(x, label) { if (x === 1) return; this.bai *= x; steps.push({ ...this.src, xBai: x, label }); },
    };

    // 1) 役の基本値
    const noLevels = quirk && quirk.noLevels;
    const yaku = ev.list.map((y) => ({ key: y.key, ...yakuValue(run, y.key, noLevels) }));
    for (const y of yaku) {
      ctx.src = { k: "yaku", key: y.key };
      ctx.bun += y.bun; ctx.bai += y.bai;
      steps.push({ k: "yaku", key: y.key, dBun: y.bun, dBai: y.bai, lvl: y.lvl });
    }

    const act = activeShiki(run, round);
    const debuffT = quirk && quirk.debuffType;
    const firstTriple = act.some(({ s }) => SHIKI_BY_ID[s.id].flag === "firstTriple");

    // 式神のフックを左から呼ぶ（管狐は右どなりの効果を写す）
    const eachShiki = (hook, ...args) => {
      for (const { s, i } of act) {
        const target = resolveCopy(run, i, round);
        if (!target) continue;
        const def = SHIKI_BY_ID[target.id];
        if (def.fx && def.fx[hook]) {
          ctx.src = { k: "shiki", idx: i };
          def.fx[hook](ctx, ...args, target);
        }
      }
    };

    // 2) 数える札（左から）。朱印・人魂で繰り返す
    ev.scored.forEach((c, n) => {
      let reps = 1 + (c.seal === "shuin" ? 1 : 0) + (firstTriple && n === 0 ? 2 : 0);
      for (let r = 0; r < reps; r++) {
        ctx.src = { k: "card", uid: c.uid, rep: r };
        if (debuffT && c.t === debuffT) { steps.push({ k: "card", uid: c.uid, debuff: true }); break; }
        ctx.addBun(TYPES[c.t].bun);
        if (c.m === round.month) ctx.addBai(2, "旬");
        if (c.enh === "kira") ctx.addBun(40, "雲母");
        if (c.enh === "kin") ctx.addBai(5, "金箔");
        if (c.enh === "usurai") ctx.mulBai(2, "薄氷");
        eachShiki("onCard", c);
      }
    });

    // 3) 手札に残した札
    for (const h of held) {
      ctx.src = { k: "held", uid: h.uid };
      if (h.enh === "mamori") ctx.mulBai(1.5, "護り");
      eachShiki("onHeld", h);
    }

    // 4) 式神
    eachShiki("onScore");

    // 5) 五神器顕現
    if (run.jingi.length >= 5) {
      ctx.src = { k: "jingi" };
      ctx.mulBai(JINGI_ALL_BONUS, "五神器顕現");
    }

    const total = Math.floor(ctx.bun * ctx.bai);
    return { total, bun: ctx.bun, bai: ctx.bai, steps, yaku, keys: ev.keys, scored: ev.scored, blocked: ev.blocked, monthKey: ev.monthKey };
  }

  // 妖の癖（獏がいれば無効）
  function effectiveQuirk(run, round) {
    if (!round || !round.quirk) return null;
    if (hasFlag(run, round, "noQuirk")) return null;
    return round.quirk;
  }

  return { evaluate, scorePlay, yakuValue, isNagare, effectiveQuirk, activeShiki };
})();
