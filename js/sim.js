// ============================================================
// sim.js — バランス検証ボット（開発用。index.html に ?sim=1 を付けたときだけ読み込む）
//   Sim.runMany(n, opts) … n 回の一年を自動で遊び、到達月・勝率・月ごとの点数を集計する
//   ボットの腕前は「素直な人」程度: 毎回その場で最高点の手を打ち、足りなければ流して粘る。
//   市では式神を優先し、よく打つ役の詠み札を買う。人間はこれより上手いはず＝下限の目安。
// ============================================================
"use strict";

const Sim = (() => {
  function subsets(arr, maxK) {
    const out = [];
    const n = arr.length;
    const rec = (start, cur) => {
      if (cur.length) out.push(cur.slice());
      if (cur.length === maxK) return;
      for (let i = start; i < n; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    };
    rec(0, []);
    return out;
  }

  function bestPlay(run) {
    const r = run.round;
    const q = Score.effectiveQuirk(run, r);
    let maxK = 5;
    if (q && q.maxPlay) maxK = q.maxPlay;
    let best = null;
    for (const s of subsets(r.hand, maxK)) {
      if (q && q.mustPlay && s.length !== q.mustPlay) continue;
      const pv = Run.preview(run, s);
      // 同点なら枚数の少ない手（札を温存）
      if (!best || pv.total > best.total || (pv.total === best.total && s.length < best.uids.length)) best = { uids: s, total: pv.total, pv };
    }
    return best;
  }

  function playRound(run) {
    const r = run.round;
    let guard = 0;
    while (run.phase === "round" && guard++ < 50) {
      const best = bestPlay(run);
      const need = r.target - r.score;
      if (!best) { Run.play(run, [r.hand[0]]); continue; }
      const canDis = r.discards > 0 && !(Score.effectiveQuirk(run, r) || {}).noDiscard;
      // 今の最高手で「残り打ち×最高手」が届かないなら、役に絡まない札を流す
      if (best.total < need && best.total * r.hands < need * 1.15 && canDis && r.draw.length > 0) {
        const keep = new Set(best.pv.scored.map((c) => c.uid));
        // 同じ月・光種は残す
        const counts = {};
        for (const u of r.hand) { const c = Run.card(run, u); counts[c.m] = (counts[c.m] || 0) + 1; }
        const junk = r.hand.filter((u) => !keep.has(u)).map((u) => Run.card(run, u))
          .sort((a, b) => (counts[a.m] - counts[b.m]) || (TYPES[a.t].bun - TYPES[b.t].bun))
          .slice(0, 5).map((c) => c.uid);
        if (junk.length) { Run.discard(run, junk); continue; }
      }
      Run.play(run, best.uids);
    }
  }

  // 式神の見積もり値（ボット用のざっくり評価）
  function shikiValue(id) {
    const d = SHIKI_BY_ID[id];
    const bonus = { kamihito: 0, zashiki: 2, bakedanuki: -2, kanedama: 1, tofu: 1, maneki: 0, rokurokubi: 3, nurikabe: 2, dodomeki: 3,
      yatagarasu: 2, kudagitsune: 3, baku: 1, ryujin: 2, gama: 3, tengu: -1, yamagami: -2, fuguruma: -2, shoujou: -2, yukionna: -1 };
    return d.rar * 3 + (bonus[id] || 0);
  }

  // 「賢いボット」用: 式神を入れた場合と入れない場合で、山札から配った手の最高点を比べる
  function sampleHands(run, k, seed) {
    const R = makeRng(seed);
    const uids = run.deck.map((c) => c.uid);
    const hs = [];
    for (let i = 0; i < k; i++) hs.push(R.shuffle(uids.slice()).slice(0, 8));
    return hs;
  }
  function avgBest(run, hands, month) {
    let tot = 0;
    const round = { month, kind: "small", quirk: null, usedYaku: [], draw: new Array(30), hand: [], handsPlayed: 1, hands: 2, discards: 1, sleeping: null };
    for (const h of hands) {
      round.hand = h;
      let best = 0;
      for (const s of subsets(h, 5)) {
        const played = s.map((u) => Run.card(run, u));
        const held = h.filter((u) => !s.includes(u)).map((u) => Run.card(run, u));
        const t = Score.scorePlay(run, round, played, held, { preview: true }).total;
        if (t > best) best = t;
      }
      tot += best;
    }
    return tot / hands.length;
  }
  function withShiki(run, ids) {
    return { ...run, shiki: ids.map((id, i) => ({ uid: 9000 + i, id, data: SHIKI_BY_ID[id].init ? JSON.parse(JSON.stringify(SHIKI_BY_ID[id].init)) : {} })) };
  }
  function smartValue(run, ids, hands) {
    return avgBest(withShiki(run, ids), hands, run.month);
  }

  function shop(run, opts = {}) {
    if (opts.smart) return smartShop(run);
    let guard = 0;
    while (guard++ < 20) {
      const s = run.shop;
      let did = false;
      // 式神
      const cands = s.shiki.map((x, i) => ({ ...x, i })).filter((x) => !x.sold && x.cost <= run.zeni)
        .sort((a, b) => shikiValue(b.id) - shikiValue(a.id));
      for (const c of cands) {
        if (Run.slotsFree(run) > 0) { if (!Run.buy(run, "shiki", c.i).error) { did = true; break; } }
        else {
          // 一番弱い式神より強ければ入れ替え
          let wi = 0;
          run.shiki.forEach((x, i) => { if (shikiValue(x.id) < shikiValue(run.shiki[wi].id)) wi = i; });
          if (shikiValue(c.id) > shikiValue(run.shiki[wi].id) + 1) {
            Run.sell(run, wi);
            if (!Run.buy(run, "shiki", c.i).error) { did = true; break; }
          }
        }
      }
      if (did) continue;
      // 神器（余裕があれば）
      if (s.jingi && !s.jingi.sold && run.zeni >= s.jingi.cost + 4) { if (!Run.buy(run, "jingi").error) continue; }
      // 詠み札: よく打つ役
      const fav = Object.entries(run.stats.yaku).sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 3);
      const yi = s.items.findIndex((x) => !x.sold && x.kind === "yomi" && fav.includes(x.id) && x.cost <= run.zeni - 3);
      if (yi >= 0) { Run.buy(run, "items", yi); continue; }
      // 歌の文箱
      const pi = s.packs.findIndex((x) => !x.sold && x.kind === "yomi" && x.cost <= run.zeni - 4);
      if (pi >= 0) {
        Run.buy(run, "packs", pi);
        const pk = run.pack;
        let bi = 0;
        pk.choices.forEach((k, i) => { if ((run.stats.yaku[k] || 0) > (run.stats.yaku[pk.choices[bi]] || 0)) bi = i; });
        Run.pickPack(run, bi);
        continue;
      }
      break;
    }
    Run.leaveShop(run);
  }

  // 賢い買い物: 式神は実測の伸び率で選ぶ・枠が埋まれば一番弱いものと入れ替え・よく打つ役を磨く・神器も狙う
  function smartShop(run) {
    const hands = sampleHands(run, 10, run.month * 97 + run.year);
    let guard = 0;
    while (guard++ < 12) {
      const s = run.shop;
      const cur = run.shiki.map((x) => x.id);
      const base = smartValue(run, cur, hands);
      let best = null;
      for (let i = 0; i < s.shiki.length; i++) {
        const w = s.shiki[i];
        if (w.sold || w.cost > run.zeni) continue;
        if (SHIKI_BY_ID[w.id].passive || ["zashiki", "bakedanuki", "kanedama", "kasha", "raijuu", "baku", "hakutaku", "sunekosuri", "kodama", "betobeto", "jorogumo", "shuten", "fuujin", "raijin"].includes(w.id)) {
          // 点に直接出ない式神はざっくり評価（枠が空いているときだけ）
          if (cur.length >= Run.passives(run).slots) continue;
          const v = base * (1 + 0.12 * SHIKI_BY_ID[w.id].rar);
          if (!best || v > best.v) best = { i, v, replace: -1 };
          continue;
        }
        if (cur.length < Run.passives(run).slots) {
          const v = smartValue(run, cur.concat(w.id), hands);
          if (!best || v > best.v) best = { i, v, replace: -1 };
        } else {
          for (let r = 0; r < cur.length; r++) {
            const ids = cur.slice(); ids[r] = w.id;
            const v = smartValue(run, ids, hands);
            if (!best || v > best.v) best = { i, v, replace: r };
          }
        }
      }
      if (best && best.v > base * 1.08) {
        if (best.replace >= 0) Run.sell(run, best.replace);
        if (!Run.buy(run, "shiki", best.i).error) continue;
      }
      if (s.jingi && !s.jingi.sold && run.zeni >= s.jingi.cost + 2) { if (!Run.buy(run, "jingi").error) continue; }
      const fav = Object.entries(run.stats.yaku).sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, 2);
      const yi = s.items.findIndex((x) => !x.sold && x.kind === "yomi" && fav.includes(x.id) && x.cost <= run.zeni - 2);
      if (yi >= 0) { Run.buy(run, "items", yi); continue; }
      const pi = s.packs.findIndex((x) => !x.sold && x.kind === "yomi" && x.cost <= run.zeni - 3);
      if (pi >= 0) {
        Run.buy(run, "packs", pi);
        const pk = run.pack;
        let bi = 0;
        pk.choices.forEach((k, i) => { if ((run.stats.yaku[k] || 0) > (run.stats.yaku[pk.choices[bi]] || 0)) bi = i; });
        Run.pickPack(run, bi);
        continue;
      }
      // 余った銭でめくり直し（利子の区切りを割らない範囲）
      const rc = Run.rerollCost(run);
      if (run.zeni - rc >= 12 && s.rerolls < 2) { Run.reroll(run); continue; }
      break;
    }
    Run.leaveShop(run);
  }

  function runOne(seed, opts = {}) {
    const run = Run.newRun(opts.onmyoji || "hinata", seed, opts.rank || 0);
    const perMonth = [];
    let guard = 0;
    while (guard++ < 200) {
      if (run.phase === "map") Run.startRound(run);
      if (run.phase === "round") {
        const m = run.month;
        playRound(run);
        perMonth.push({ m, score: run.round ? run.round.score : null, target: run.round ? run.round.target : null });
      }
      if (run.phase === "cashout") Run.cashOut(run);
      if (run.phase === "shop") shop(run, opts);
      if (run.phase === "over" || run.phase === "clear") break;
      if (opts.maxYear && run.year > opts.maxYear) break;
    }
    return { reached: run.phase === "clear" ? 13 : run.month, phase: run.phase, zeni: run.zeni, shiki: run.shiki.map((s) => s.id), best: run.stats.best, yaku: run.stats.yaku, levels: run.levels, jingi: run.jingi.length };
  }

  // 非同期で n 回（30秒制限を避けて window.__sim に進捗を書く）
  function runMany(n = 50, opts = {}) {
    const res = [];
    window.__sim = { done: false, n, i: 0, res };
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < n && performance.now() - t0 < 200) { const t1 = performance.now(); const o = runOne((opts.seed || 1000) + i, opts); o.ms = Math.round(performance.now() - t1); res.push(o); i++; window.__sim.i = i; }
      if (i < n) setTimeout(step, 0);
      else { window.__sim.done = true; window.__sim.summary = summarize(res); }
    };
    step();
    return "started";
  }

  function summarize(res) {
    const reach = {};
    for (const r of res) reach[r.reached] = (reach[r.reached] || 0) + 1;
    const clear = res.filter((r) => r.reached === 13).length / res.length;
    const survive = {};
    for (let m = 1; m <= 13; m++) survive[m] = res.filter((r) => r.reached >= m).length / res.length;
    const yaku = {};
    for (const r of res) for (const k in r.yaku) yaku[k] = (yaku[k] || 0) + r.yaku[k];
    const shiki = {};
    for (const r of res) for (const s of r.shiki) shiki[s] = (shiki[s] || 0) + 1;
    return { clear, survive, reach, yaku, avgBest: Math.round(res.reduce((a, b) => a + b.best, 0) / res.length), shiki };
  }

  return { runOne, runMany, summarize, bestPlay, subsets };
})();
