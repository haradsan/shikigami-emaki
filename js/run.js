// ============================================================
// run.js — 一年（1プレイ）の進行。画面を持たない「状態遷移」だけを書く。
//   UI（ui.js）も検証ボット（sim.js）も、この関数群を呼んで遊ぶ。
//   状態 run はそのまま JSON にして保存できる形に保つ（札は uid で指す）。
// ============================================================
"use strict";

const Run = (() => {
  const SAVE_KEY = "shiki-hana-run";

  // ---------- 生成 ----------
  function newRun(onmyojiId = "hinata", seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0, rank = 0) {
    const om = ONMYOJI.find((o) => o.id === onmyojiId) || ONMYOJI[0];
    const run = {
      ver: 1, seed, rngState: seed, uidSeq: 1,
      onmyoji: om.id, year: 1, month: 1, rank,
      zeni: 4 + ((om.start && om.start.zeni) || 0),
      deck: [], shiki: [], fu: [], levels: {}, jingi: [],
      plan: {}, phase: "map", round: null, shop: null, pack: null, lastPayout: null,
      stats: { hands: 0, best: 0, bestYaku: null, yaku: {}, cleared: 0, discards: 0 },
      log: [],
    };
    for (const c of BASE_DECK) run.deck.push({ uid: run.uidSeq++, ...c });
    for (const id of (om.start && om.start.shiki) || []) addShiki(run, id);
    for (const id of (om.start && om.start.fu) || []) run.fu.push(id);
    planYear(run);
    return run;
  }

  function rng(run) {
    const r = makeRng(0);
    r.state = run.rngState;
    return new Proxy(r, {
      get(t, k) {
        const v = t[k];
        if (typeof v !== "function") return v;
        return (...a) => { const out = v.apply(t, a); run.rngState = t.state; return out; };
      },
    });
  }

  // 月ごとの妖を決める
  function planYear(run) {
    const R = rng(run);
    const small = R.shuffle(SMALL_POOL.slice());
    const plan = {};
    let si = 0;
    for (let m = 1; m <= 12; m++) {
      if (m === 12) plan[m] = "nurarihyon";
      else if (BOSS_POOL[m]) plan[m] = R.pick(BOSS_POOL[m]);
      else if (run.year === 1 && m <= 2 && !(run.rank >= 1)) plan[m] = m === 1 ? "zako_1" : "zako_2";
      else plan[m] = small[si++ % small.length];
    }
    run.plan = plan;
  }

  // ---------- 受動効果の集計 ----------
  function passives(run, round) {
    const p = { handSize: 8, hands: 4, discards: 3, slots: 5, interestCap: 5, shopSlots: 0, rerollDiscount: 0, fuSlots: 2 };
    const add = (src) => { if (!src) return; for (const k in src) p[k] = (p[k] || 0) + src[k]; };
    const om = ONMYOJI.find((o) => o.id === run.onmyoji);
    add(om && om.start && om.start.passive);
    for (const s of run.shiki) add(SHIKI_BY_ID[s.id].passive);
    for (const j of run.jingi) add(JINGI.find((x) => x.id === j).passive);
    if (run.rank >= 3) p.discards -= 1;
    if (round) {
      const q = Score.effectiveQuirk(run, round);
      if (q && q.handSize) p.handSize += q.handSize;
      if (q && q.noDiscard) p.discards = 0;
    }
    p.handSize = Math.max(3, p.handSize);
    p.hands = Math.max(1, p.hands);
    p.discards = Math.max(0, p.discards);
    return p;
  }

  // ---------- 札 ----------
  const card = (run, uid) => run.deck.find((c) => c.uid === uid);
  const cards = (run, uids) => uids.map((u) => card(run, u)).filter(Boolean);
  function removeCard(run, uid) {
    run.deck = run.deck.filter((c) => c.uid !== uid);
    const r = run.round;
    if (r) { r.hand = r.hand.filter((u) => u !== uid); r.draw = r.draw.filter((u) => u !== uid); }
  }
  function addCard(run, proto, intoDraw = true) {
    const c = { uid: run.uidSeq++, m: proto.m, t: proto.t, sp: proto.sp, v: proto.v || 0 };
    if (proto.enh) c.enh = proto.enh;
    if (proto.seal) c.seal = proto.seal;
    run.deck.push(c);
    if (intoDraw && run.round && run.phase === "round") {
      const R = rng(run);
      run.round.draw.splice(R.int(0, run.round.draw.length), 0, c.uid);
    }
    return c;
  }
  // 火車などで燃やす（山札から完全に消す）
  function burnCard(run, uid) { removeCard(run, uid); run.log.push({ t: "burn", uid }); }

  // ---------- 式神 ----------
  function addShiki(run, id) {
    const def = SHIKI_BY_ID[id];
    const inst = { uid: run.uidSeq++, id, data: def.init ? JSON.parse(JSON.stringify(def.init)) : {} };
    run.shiki.push(inst);
    return inst;
  }
  const slotsFree = (run) => passives(run).slots - run.shiki.length;

  // ---------- 祓い（ラウンド） ----------
  function startRound(run) {
    const R = rng(run);
    const month = run.month;
    const yid = run.plan[month];
    const y = YOKAI[yid];
    let target = targetFor(run.year, month);
    if (run.rank >= 2) target *= 1.2;
    if (run.rank >= 5) target *= 1.25;
    target = Math.round(target / 10) * 10;
    const round = {
      month, yokai: yid, kind: y.kind, quirk: y.quirk || null, target, score: 0,
      hands: 0, discards: 0, handsPlayed: 0, discardsUsed: 0,
      draw: [], hand: [], faceDown: [], usedYaku: [], sleeping: null, last: null,
    };
    run.round = round;
    run.phase = "round";
    const q = Score.effectiveQuirk(run, round);
    if (q && q.targetMul) round.target = Math.round(target * q.targetMul / 10) * 10;
    const p = passives(run, round);
    round.hands = p.hands;
    round.discards = p.discards;
    round.draw = R.shuffle(run.deck.map((c) => c.uid));
    for (const s of run.shiki) { const f = SHIKI_BY_ID[s.id].fx; if (f && f.onRoundStart) f.onRoundStart(run, s); }
    drawUp(run);
    return round;
  }

  // 絵巻の地図に出す「その月の目標」（位階と妖の癖を込み）
  function targetOf(run, month) {
    let t = targetFor(run.year, month);
    if (run.rank >= 2) t *= 1.2;
    if (run.rank >= 5) t *= 1.25;
    const y = YOKAI[run.plan[month]];
    if (y && y.quirk && y.quirk.targetMul && !run.shiki.some((s) => SHIKI_BY_ID[s.id].flag === "noQuirk")) t *= y.quirk.targetMul;
    return Math.round(t / 10) * 10;
  }

  function drawUp(run) {
    const r = run.round, R = rng(run);
    const p = passives(run, r);
    const q = Score.effectiveQuirk(run, r);
    const drawn = [];
    while (r.hand.length < p.handSize && r.draw.length) {
      const u = r.draw.shift();
      r.hand.push(u);
      drawn.push(u);
      if (q && q.faceDown && R.int(1, q.faceDown) === 1) r.faceDown.push(u);
    }
    return drawn;
  }

  function canPlay(run, uids) {
    const r = run.round;
    if (!r || run.phase !== "round") return { ok: false, reason: "祓いの最中ではない" };
    if (!uids.length) return { ok: false, reason: "札を選んでください" };
    if (uids.length > 5) return { ok: false, reason: "打てるのは5枚まで" };
    if (r.hands <= 0) return { ok: false, reason: "打ちが残っていない" };
    const q = Score.effectiveQuirk(run, r);
    if (q && q.maxPlay && uids.length > q.maxPlay) return { ok: false, reason: `この妖の前では${q.maxPlay}枚までしか打てない` };
    if (q && q.mustPlay && uids.length !== q.mustPlay) return { ok: false, reason: `この妖の前では${q.mustPlay}枚ちょうどで打つ` };
    return { ok: true };
  }
  function canDiscard(run, uids) {
    const r = run.round;
    if (!r || run.phase !== "round") return { ok: false, reason: "" };
    if (!uids.length) return { ok: false, reason: "流す札を選んでください" };
    if (uids.length > 5) return { ok: false, reason: "流せるのは5枚まで" };
    if (r.discards <= 0) return { ok: false, reason: "流しが残っていない" };
    return { ok: true };
  }

  // 選択中の札の見込み（乱数も成長も使わない）
  function preview(run, uids) {
    const r = run.round;
    const played = orderInHand(run, uids);
    const held = cards(run, r.hand.filter((u) => !uids.includes(u)));
    return Score.scorePlay(run, r, played, held, { preview: true });
  }
  // 打った札は「手札の並び順」で数える（左から）
  function orderInHand(run, uids) {
    return run.round.hand.filter((u) => uids.includes(u)).map((u) => card(run, u));
  }

  // 打つ。戻り値 res: { score(採点結果), played, events, cleared, failed, drawn }
  function play(run, uids) {
    const chk = canPlay(run, uids);
    if (!chk.ok) return { error: chk.reason };
    const r = run.round, R = rng(run);
    const q = Score.effectiveQuirk(run, r);
    const events = [];
    // 妖の癖（打つ前）
    r.sleeping = null;
    if (q && q.shuffleShiki && run.shiki.length > 1) { R.shuffle(run.shiki); events.push({ t: "shuffleShiki" }); }
    if (q && q.sleepShiki && run.shiki.length) { r.sleeping = R.int(0, run.shiki.length - 1); events.push({ t: "sleep", idx: r.sleeping }); }

    const played = orderInHand(run, uids);
    r.hand = r.hand.filter((u) => !uids.includes(u));
    r.faceDown = r.faceDown.filter((u) => !uids.includes(u));
    const held = cards(run, r.hand);
    r.hands -= 1;
    r.handsPlayed += 1;

    // 成長型の式神（打った手を含めて数える）
    const ev = Score.evaluate(played, { blockedMonth: q && q.noRepeat ? new Set(r.usedYaku) : null });
    const info = { played, yakuKeys: ev.keys, gild: false };
    Score.activeShiki(run, r).forEach(({ s }) => { const f = SHIKI_BY_ID[s.id].fx; if (f && f.onPlay) f.onPlay(run, info, s); });

    const sc = Score.scorePlay(run, r, played, held, { rng: R });
    r.score += sc.total;
    if (sc.monthKey) r.usedYaku.push(sc.monthKey);
    r.last = { total: sc.total, keys: sc.keys };

    // 記録
    run.stats.hands += 1;
    for (const k of sc.keys) run.stats.yaku[k] = (run.stats.yaku[k] || 0) + 1;
    if (sc.total > run.stats.best) { run.stats.best = sc.total; run.stats.bestYaku = sc.keys.slice(); }

    // 打ったあと: 薄氷の割れ・雷獣の金箔・崇徳院の取り立て
    for (const c of sc.scored) {
      if (c.enh === "usurai" && R.int(1, 4) === 1) { removeCard(run, c.uid); events.push({ t: "break", uid: c.uid }); }
    }
    if (info.gild) {
      const cand = sc.scored.filter((c) => !c.enh && run.deck.includes(c));
      if (cand.length) { const c = R.pick(cand); c.enh = "kin"; events.push({ t: "gild", uid: c.uid }); }
    }
    if (q && q.playCost) { const lose = Math.min(run.zeni, q.playCost * played.length); run.zeni -= lose; if (lose) events.push({ t: "zeni", d: -lose }); }

    const cleared = r.score >= r.target;
    const failed = !cleared && r.hands <= 0;
    let drawn = [];
    if (!cleared && !failed) {
      if (q && q.dropOnPlay && r.hand.length) {
        const u = R.pick(r.hand);
        r.hand = r.hand.filter((x) => x !== u);
        events.push({ t: "drop", uid: u });
      }
      drawn = drawUp(run);
    }
    if (cleared) roundCleared(run);
    if (failed) runOver(run, false);
    return { score: sc, played, events, cleared, failed, drawn };
  }

  function discard(run, uids) {
    const chk = canDiscard(run, uids);
    if (!chk.ok) return { error: chk.reason };
    const r = run.round;
    const q = Score.effectiveQuirk(run, r);
    const gone = cards(run, uids);
    r.hand = r.hand.filter((u) => !uids.includes(u));
    r.faceDown = r.faceDown.filter((u) => !uids.includes(u));
    r.discards -= 1;
    r.discardsUsed += 1;
    run.stats.discards += 1;
    const events = [];
    for (const s of Score.activeShiki(run, r).map((x) => x.s)) { const f = SHIKI_BY_ID[s.id].fx; if (f && f.onDiscard) f.onDiscard(run, gone, s); }
    if (q && q.discardCost) { const lose = Math.min(run.zeni, q.discardCost); run.zeni -= lose; if (lose) events.push({ t: "zeni", d: -lose }); }
    const drawn = drawUp(run);
    return { events, drawn, gone };
  }

  // ---------- 祓い成功 → 精算 ----------
  function roundCleared(run) {
    const r = run.round;
    const p = passives(run);
    const base = r.kind === "boss" ? 6 : r.kind === "final" ? 8 : (run.year === 1 && r.month <= 2 ? 3 : 4);
    const handsBonus = r.hands;
    const interest = run.rank >= 4 ? 0 : Math.min(Math.floor(run.zeni / 5), p.interestCap);
    const shikiPay = [];
    run.shiki.forEach((s, i) => {
      const f = SHIKI_BY_ID[s.id].fx;
      if (f && f.onRoundEnd) { const amt = f.onRoundEnd(run, s) || 0; if (amt) shikiPay.push({ idx: i, amt }); }
    });
    const total = base + handsBonus + interest + shikiPay.reduce((a, b) => a + b.amt, 0);
    run.lastPayout = { base, handsBonus, interest, shikiPay, total, kind: r.kind, month: r.month, yokai: r.yokai };
    run.stats.cleared += 1;
    run.phase = "cashout";
  }

  function cashOut(run) {
    if (run.phase !== "cashout") return;
    run.zeni += run.lastPayout.total;
    const r = run.round;
    run.round = null;
    if (r.kind === "final" && r.month === 12 && run.year === 1 && !run.endless) {
      run.phase = "clear";
      return;
    }
    openShop(run);
  }

  function runOver(run, won) {
    run.phase = won ? "clear" : "over";
  }

  // 一年を越えたあと「二年目」へ（無限の絵巻）
  function continueEndless(run) {
    run.endless = true;
    openShop(run);
  }

  // ---------- 夜市 ----------
  function rollShiki(run, R, rarOverride) {
    const owned = new Set(run.shiki.map((s) => s.id));
    let rar = rarOverride;
    if (!rar) {
      const w = SHOP.rarityWeights, tot = w.reduce((a, b) => a + b, 0);
      let x = R.next() * tot; rar = 1;
      for (let i = 1; i < w.length; i++) { x -= w[i]; if (x < 0) { rar = i; break; } }
    }
    let pool = SHIKI.filter((s) => s.rar === rar && !owned.has(s.id));
    if (!pool.length) pool = SHIKI.filter((s) => s.rar <= 2 && !owned.has(s.id));
    if (!pool.length) pool = SHIKI.filter((s) => s.rar <= 2);
    return R.pick(pool).id;
  }
  function visibleYaku(run) {
    return YAKU_ORDER.filter((k) => !YAKU[k].hidden || run.stats.yaku[k]);
  }
  function rollItem(run, R) {
    if (R.next() < 0.45) return { kind: "yomi", id: R.pick(visibleYaku(run)), cost: SHOP.yomiCost };
    const normal = Object.keys(FU).filter((k) => !FU[k].rare);
    const rare = Object.keys(FU).filter((k) => FU[k].rare && !FU[k].legend);
    const id = R.next() < 0.12 ? R.pick(rare) : R.pick(normal);
    return { kind: "fu", id, cost: FU[id].cost };
  }
  function rollPack(R) {
    const kinds = ["fuda", "fuda", "yomi", "yomi", "jufu", "jufu", "shiki"];
    const kind = R.pick(kinds);
    return { kind, cost: PACKS[kind].cost };
  }
  function openShop(run) {
    const R = rng(run);
    const p = passives(run);
    const shop = { shiki: [], items: [], packs: [], jingi: null, rerolls: 0 };
    const nShiki = SHOP.shikiSlots + (p.shopSlots || 0);
    for (let i = 0; i < nShiki; i++) { const id = rollShiki(run, R); shop.shiki.push({ id, cost: SHIKI_BY_ID[id].cost + (run.rank >= 5 ? 1 : 0) }); }
    for (let i = 0; i < SHOP.itemSlots; i++) shop.items.push(rollItem(run, R));
    for (let i = 0; i < SHOP.packSlots; i++) shop.packs.push(rollPack(R));
    // 神器: 季節ごとに1つ（まだ持っていない物から）。季節の最初の市（前の月が大妖）で新しく並ぶ
    const left = JINGI.filter((j) => !run.jingi.includes(j.id));
    const seasonKey = `${run.year}-${Math.ceil(run.month / 3)}`;
    if (left.length) {
      if (!run.jingiOffer || run.jingiOffer.season !== seasonKey || run.jingi.includes(run.jingiOffer.id)) {
        run.jingiOffer = run.jingiOffer && run.jingiOffer.season === seasonKey && !run.jingi.includes(run.jingiOffer.id)
          ? run.jingiOffer : { season: seasonKey, id: R.pick(left).id, bought: false };
      }
      if (!run.jingiOffer.bought) shop.jingi = { id: run.jingiOffer.id, cost: JINGI_PRICE };
    }
    run.shop = shop;
    run.phase = "shop";
  }
  function rerollCost(run) {
    const p = passives(run);
    return Math.max(0, SHOP.rerollBase + run.shop.rerolls - (p.rerollDiscount || 0));
  }
  function reroll(run) {
    const cost = rerollCost(run);
    if (run.zeni < cost) return { error: "銭が足りない" };
    run.zeni -= cost;
    run.shop.rerolls += 1;
    const R = rng(run);
    const p = passives(run);
    const n = SHOP.shikiSlots + (p.shopSlots || 0);
    run.shop.shiki = [];
    for (let i = 0; i < n; i++) { const id = rollShiki(run, R); run.shop.shiki.push({ id, cost: SHIKI_BY_ID[id].cost + (run.rank >= 5 ? 1 : 0) }); }
    return { ok: true };
  }

  function buy(run, kind, i) {
    const shop = run.shop;
    if (!shop) return { error: "" };
    const slot = kind === "jingi" ? shop.jingi : shop[kind][i];
    if (!slot || slot.sold) return { error: "売り切れ" };
    if (run.zeni < slot.cost) return { error: "銭が足りない" };
    if (kind === "shiki") {
      if (slotsFree(run) <= 0) return { error: "式神の枠がいっぱい（売ると空く）" };
      addShiki(run, slot.id);
    } else if (kind === "items") {
      if (slot.kind === "yomi") { levelUp(run, slot.id); }
      else {
        if (run.fu.length >= passives(run).fuSlots) return { error: "呪符の枠がいっぱい" };
        run.fu.push(slot.id);
      }
    } else if (kind === "packs") {
      run.zeni -= slot.cost;
      slot.sold = true;
      openPack(run, slot.kind);
      return { ok: true, pack: true };
    } else if (kind === "jingi") {
      run.jingi.push(slot.id);
      run.jingiOffer.bought = true;
      run.zeni -= slot.cost;
      slot.sold = true;
      return { ok: true, jingi: slot.id, all: run.jingi.length >= 5 };
    }
    run.zeni -= slot.cost;
    slot.sold = true;
    return { ok: true };
  }

  function sell(run, idx) {
    const s = run.shiki[idx];
    if (!s) return { error: "" };
    const price = sellPrice(s);
    run.shiki.splice(idx, 1);
    run.zeni += price;
    return { ok: true, price };
  }
  function moveShiki(run, idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= run.shiki.length) return;
    [run.shiki[idx], run.shiki[j]] = [run.shiki[j], run.shiki[idx]];
  }

  function levelUp(run, key) {
    run.levels[key] = (run.levels[key] || 1) + 1;
    for (const s of run.shiki) if (s.id === "hakutaku") s.data.n = (s.data.n || 0) + 1;
    return run.levels[key];
  }

  // ---------- 文箱 ----------
  function randomCardProto(R) {
    const base = R.pick(BASE_DECK);
    const c = { ...base };
    const x = R.next();
    if (x < 0.14) c.enh = "kin";
    else if (x < 0.26) c.enh = "kira";
    else if (x < 0.32) c.enh = "mamori";
    else if (x < 0.36) c.enh = "usurai";
    if (R.next() < 0.06) c.seal = "shuin";
    return c;
  }
  function openPack(run, kind) {
    const R = rng(run);
    const P = PACKS[kind];
    const pack = { kind, choices: [], sample: [], picks: P.pick };
    if (kind === "fuda") for (let i = 0; i < P.show; i++) pack.choices.push(randomCardProto(R));
    if (kind === "yomi") {
      const vis = visibleYaku(run);
      const set = new Set();
      while (set.size < Math.min(P.show, vis.length)) set.add(R.pick(vis));
      pack.choices = [...set];
    }
    if (kind === "jufu") {
      const ids = Object.keys(FU).filter((k) => !FU[k].legend);
      for (let i = 0; i < P.show; i++) {
        let id = R.pick(ids);
        if (FU[id].rare && R.next() < 0.5) id = R.pick(ids.filter((k) => !FU[k].rare));
        pack.choices.push(id);
      }
      if (R.next() < 0.03) pack.choices[P.show - 1] = "tamayobi";
      pack.sample = R.shuffle(run.deck.map((c) => c.uid)).slice(0, 5);
    }
    if (kind === "shiki") {
      const set = new Set();
      while (set.size < P.show) set.add(rollShiki(run, R));
      pack.choices = [...set];
    }
    run.pack = pack;
    run.phase = "pack";
    return pack;
  }
  // 文箱から1つ選ぶ。jufu で札が要る呪符は uids（sample の中から）を渡す
  function pickPack(run, i, uids = []) {
    const pack = run.pack;
    if (!pack) return { error: "" };
    const ch = pack.choices[i];
    let res = { ok: true };
    if (pack.kind === "fuda") { const c = addCard(run, ch, false); res.card = c; }
    if (pack.kind === "yomi") { res.level = levelUp(run, ch); res.key = ch; }
    if (pack.kind === "shiki") {
      if (slotsFree(run) <= 0) return { error: "式神の枠がいっぱい（売ると空く）" };
      addShiki(run, ch);
    }
    if (pack.kind === "jufu") {
      const f = FU[ch];
      if (uids.length || f.need[0] === 0) {
        const r = applyFu(run, ch, uids, pack.sample);
        if (r.error) return r;
        res = { ...res, ...r, used: true };
      } else {
        if (run.fu.length >= passives(run).fuSlots) return { error: "呪符の枠がいっぱい。札を選んで、いま使ってください" };
        run.fu.push(ch);
        res.kept = true;
      }
    }
    pack.picks -= 1;
    pack.choices[i] = null;
    if (pack.picks <= 0) closePack(run);
    return res;
  }
  function closePack(run) {
    run.pack = null;
    run.phase = "shop";
  }

  // ---------- 呪符 ----------
  // pool: 札を選べる範囲（祓い中は手札、文箱では見本の5枚）
  function applyFu(run, id, uids, pool) {
    const f = FU[id];
    if (!f) return { error: "?" };
    const inPool = pool || (run.round ? run.round.hand : []);
    const sel = run.round ? orderInHand(run, uids.filter((u) => inPool.includes(u)))
      : uids.filter((u) => inPool.includes(u)).map((u) => card(run, u));
    if (sel.length < f.need[0]) return { error: f.need[0] ? `札を${f.need[0] === f.need[1] ? f.need[0] : f.need[0] + "〜" + f.need[1]}枚選んでください` : "" };
    if (sel.length > f.need[1]) return { error: `選べるのは${f.need[1]}枚まで` };
    const R = rng(run);
    const out = { changed: sel.map((c) => c.uid) };
    switch (id) {
      case "utsushi": { const [a, b] = sel; Object.assign(a, { m: b.m, t: b.t, sp: b.sp, v: b.v, enh: b.enh, seal: b.seal }); if (!b.enh) delete a.enh; if (!b.seal) delete a.seal; break; }
      case "tsukiokuri": for (const c of sel) c.m = c.m % 12 + 1; break;
      case "harae": for (const c of sel) removeCard(run, c.uid); out.removed = true; break;
      case "kinpaku": for (const c of sel) c.enh = "kin"; break;
      case "kirara": for (const c of sel) c.enh = "kira"; break;
      case "mamori": for (const c of sel) c.enh = "mamori"; break;
      case "usurai": for (const c of sel) c.enh = "usurai"; break;
      case "tanzaku": for (const c of sel) if (c.t !== "tan") { c.t = "tan"; c.sp = undefined; } break;
      case "tanefu": for (const c of sel) if (c.t !== "tane") { c.t = "tane"; c.sp = undefined; } break;
      case "hikarifu": for (const c of sel) if (c.t !== "hikari") { c.t = "hikari"; c.sp = undefined; } break;
      case "shuin": for (const c of sel) c.seal = "shuin"; break;
      case "wakemi": { const c = sel[0]; out.added = [addCard(run, c).uid, addCard(run, c).uid]; break; }
      case "zeni": { const g = Math.min(run.zeni, 15); run.zeni += g; out.zeni = g; break; }
      case "shikiyobi": {
        if (slotsFree(run) <= 0) return { error: "式神の枠がいっぱい" };
        out.shiki = addShiki(run, rollShiki(run, R, 1)).id; break;
      }
      case "tamayobi": {
        if (slotsFree(run) <= 0) return { error: "式神の枠がいっぱい" };
        const pool = SHIKI.filter((s) => s.rar === 4 && !run.shiki.some((x) => x.id === s.id));
        out.shiki = addShiki(run, R.pick(pool.length ? pool : SHIKI.filter((s) => s.rar === 4)).id).id; break;
      }
    }
    return out;
  }
  // 手持ちの呪符を使う（祓い中は手札が対象）
  function useFu(run, fi, uids = []) {
    const id = run.fu[fi];
    if (!id) return { error: "" };
    const f = FU[id];
    if (f.need[0] > 0 && run.phase !== "round") return { error: "札に使う呪符は、祓いの最中に手札へ使う" };
    const r = applyFu(run, id, uids);
    if (r.error) return r;
    run.fu.splice(fi, 1);
    return { ok: true, id, ...r };
  }
  function sellFu(run, fi) {
    const id = run.fu[fi];
    if (!id) return;
    run.fu.splice(fi, 1);
    run.zeni += 1;
  }

  // ---------- 市を出る → 次の月 ----------
  function leaveShop(run) {
    run.shop = null;
    run.month += 1;
    if (run.month > 12) { run.month = 1; run.year += 1; planYear(run); }
    run.phase = "map";
  }

  // ---------- 保存 ----------
  function save(run) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(run)); } catch (e) { /* 保存できなくても遊べる */ }
  }
  function load() {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (!s) return null;
      const run = JSON.parse(s);
      if (!run || run.ver !== 1 || run.phase === "over") return null;
      return run;
    } catch (e) { return null; }
  }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

  return {
    newRun, passives, targetOf, card, cards, startRound, drawUp, canPlay, canDiscard, preview, play, discard,
    cashOut, continueEndless, openShop, reroll, rerollCost, buy, sell, moveShiki, levelUp, openPack, pickPack, closePack,
    applyFu, useFu, sellFu, leaveShop, save, load, clearSave, slotsFree, addShiki, addCard, burnCard, rng, visibleYaku, orderInHand,
  };
})();
