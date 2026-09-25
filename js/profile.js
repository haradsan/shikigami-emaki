// ============================================================
// profile.js — 遊んだ記録（図鑑・解放・設定）。1プレイの途中経過は run.js が別に保存する。
// ============================================================
"use strict";

const Profile = (() => {
  const KEY = "shiki-hana-profile";
  const def = () => ({
    runs: 0, clears: 0, bestMonth: 0, bestYear: 1, bestHand: 0, bestHandYaku: null,
    seenShiki: {}, seenYaku: {}, beatYokai: {}, metYokai: {}, unlocked: { hinata: true },
    speed: 1, tips: {}, maxRank: 0,
  });
  let d = def();
  try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) d = Object.assign(def(), s); } catch (e) { /* */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* */ } };

  return {
    get data() { return d; },
    save,
    seeShiki(id) { if (!d.seenShiki[id]) { d.seenShiki[id] = 1; save(); } },
    seeYaku(key) { d.seenYaku[key] = (d.seenYaku[key] || 0) + 1; save(); },
    meetYokai(id) { if (!d.metYokai[id]) { d.metYokai[id] = 1; save(); } },
    beatYokai(id) { d.beatYokai[id] = (d.beatYokai[id] || 0) + 1; save(); },
    // 一打の最高記録。通知するのは「それなりの記録を塗り替えたとき」だけ（序盤に毎回出ないように）
    hand(total, keys) { if (total > d.bestHand) { const prev = d.bestHand; d.bestHand = total; d.bestHandYaku = keys; save(); return prev >= 1000; } return false; },
    // 一年が終わったとき
    endRun(run, cleared) {
      d.runs += 1;
      const reached = run.year > 1 ? 12 : (cleared ? 12 : run.month - 1);
      if (run.year > d.bestYear || (run.year === d.bestYear && reached > d.bestMonth)) { d.bestMonth = reached; }
      if (run.year > d.bestYear) d.bestYear = run.year;
      if (cleared) {
        d.clears += 1;
        const nextRank = Math.min(RANKS.length - 1, (run.rank || 0) + 1);
        if (nextRank > (d.maxRank || 0)) { d.maxRank = nextRank; d.newRank = nextRank; }
        const newly = [];
        for (const o of ONMYOJI) if (o.unlock === "clear1" && !d.unlocked[o.id]) { d.unlocked[o.id] = true; newly.push(o.id); }
        save();
        return newly;
      }
      save();
      return [];
    },
    tip(key) { if (d.tips[key]) return false; d.tips[key] = 1; save(); return true; },
    setSpeed(v) { d.speed = v; save(); },
    reset() { d = def(); save(); },
  };
})();
