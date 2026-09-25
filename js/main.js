// ============================================================
// main.js — 画面の流れ（タイトル → 陰陽師えらび → 絵巻 → 祓い → 精算 → 夜市 → … → 結び）
// ============================================================
"use strict";

const Main = (() => {
  let run = null;
  const $ = (s) => document.querySelector(s);
  const save = () => { if (run) Run.save(run); };

  function boot() {
    UI.bindStatic();
    BGM.init();
    // 最初のタップで音を起こす（スマホの自動再生制限）
    const wake = () => { SFX.unlock(); document.removeEventListener("pointerdown", wake); };
    document.addEventListener("pointerdown", wake);
    $("#btn-new").onclick = () => newGame();
    $("#btn-continue").onclick = () => continueGame();
    $("#btn-book").onclick = () => UI.renderBook();
    $("#btn-daily").onclick = () => dailyGame();
    $("#btn-howto").onclick = () => UI.showHowto();
    $("#btn-settings").onclick = () => UI.showSettings();
    const q = new URLSearchParams(location.search);
    if (q.get("shot")) { debugShot(q); return; }
    toTitle();
  }

  // 開発用: ?shot=画面名 で、その画面をいきなり描く（ヘッドレスのブラウザで見た目を撮るため）
  //   例: ?shot=round&month=6&shiki=kappa,tengu&seed=3&play=1
  function debugShot(q) {
    Profile.data.tips.shop = 1;
    run = Run.newRun(q.get("om") || "hinata", +(q.get("seed") || 7));
    const sh = (q.get("shiki") || "").split(",").filter(Boolean);
    if (sh.length) { run.shiki = []; sh.forEach((id) => Run.addShiki(run, id)); }
    if (q.get("zeni")) run.zeni = +q.get("zeni");
    if (q.get("jingi")) run.jingi = JINGI.slice(0, +q.get("jingi")).map((j) => j.id);
    if (q.get("fu")) run.fu = q.get("fu").split(",");
    run.month = +(q.get("month") || 1);
    UI.setRun(run);
    const s = q.get("shot");
    if (s === "title") UI.renderTitle(true);
    if (s === "emaki") UI.renderEmaki();
    if (s === "round") {
      Run.startRound(run);
      UI.renderRound();
      if (q.get("play")) {
        // 最も同じ月が多い札を選んで打つ（演出の途中を撮る）
        const hand = run.round.hand.map((u) => Run.card(run, u));
        const cnt = {};
        hand.forEach((c) => (cnt[c.m] = (cnt[c.m] || 0) + 1));
        const m = +Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
        setTimeout(() => {
          hand.filter((c) => c.m === m).slice(0, 5).forEach((c) => document.querySelector(`#hand .card[data-uid="${c.uid}"]`).click());
          if (q.get("play") === "2") document.querySelector("#btn-play").click();
        }, 300);
      }
    }
    if (s === "shop") { Run.openShop(run); UI.renderShop(); }
    if (s === "boss") startRound();
    if (s === "cashout") {
      Run.startRound(run);
      run.round.target = 1;
      UI.renderRound();
      setTimeout(() => { document.querySelector("#hand .card").click(); document.querySelector("#btn-play").click(); }, 200);
    }
    if (s === "pack") { Run.openShop(run); Run.openPack(run, q.get("kind") || "fuda"); UI.renderShop(); UI.showPack(); }
    if (s === "end") { Run.startRound(run); run.phase = "over"; UI.renderEnd(false, []); }
    if (s === "clear") { UI.renderEnd(true, []); }
    if (s === "book") UI.renderBook(q.get("tab") || "shiki");
    if (s === "howto") { UI.renderTitle(false); UI.showHowto(); }
    if (s === "yaku") { UI.renderEmaki(); UI.showYakuList(); }
  }

  function toTitle() {
    UI.closeModal();
    const saved = Run.load();
    UI.renderTitle(!!saved && saved.phase !== "over");
  }

  function newGame() {
    const u = Profile.data.unlocked;
    const choices = ONMYOJI.filter((o) => u[o.id]);
    const start = (id, rank = 0) => {
      run = Run.newRun(id, undefined, rank);
      UI.setRun(run);
      save();
      prologue(() => toEmaki(true));
    };
    if (choices.length <= 1 && !(Profile.data.maxRank > 0)) start("hinata");
    else UI.renderSelect(start);
  }

  // 日替わりの一年: その日の日付から決まる同じ札・同じ妖・同じ市で遊ぶ（家族で到達月を比べられる）
  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function dailyGame() {
    const key = todayKey();
    let seed = 2166136261;
    for (const ch of "shiki-hana-" + key) { seed ^= ch.charCodeAt(0); seed = Math.imul(seed, 16777619) >>> 0; }
    const best = (Profile.data.daily || {})[key];
    const c = UI.modal(`<h3>日替わりの一年</h3>
      <p>${key.replace(/-/g, "/")} の札。今日はだれが遊んでも、同じ妖・同じ札の並びから始まります。家族で「どの月まで行けたか」を比べてみてください。</p>
      <p style="font-size:13px;color:#7a4a10">陰陽師はひなた・位階は無位で固定。${best ? `今日の最高：<b>${best.label}</b>` : "まだ今日は遊んでいません。"}</p>
      <div class="mrow"><button class="btn shu" data-go>はじめる</button><button class="btn" data-close>やめる</button></div>`);
    c.querySelector("[data-go]").onclick = () => {
      UI.closeModal();
      run = Run.newRun("hinata", seed, 0);
      run.daily = key;
      UI.setRun(run);
      save();
      prologue(() => toEmaki(true));
    };
  }

  function prologue(then) {
    const om = ONMYOJI.find((o) => o.id === run.onmyoji);
    const lines = STORY.prologue.map((l) => l.replace("見習い陰陽師のひなた", `${om.title}の${om.name}`));
    const c = UI.modal(`<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">
        <div style="width:72px;height:72px;border-radius:50%;overflow:hidden;background:#fffaf0;border:2px solid #1d1a17;flex:none">${Art.portrait(om.portrait)}</div>
        <div><h3 style="margin:0">${om.name}</h3><p style="font-size:12px;color:#7a6a4a">${om.title}</p></div></div>
      ${lines.map((l, i) => `<p style="font-size:14.5px;line-height:2;animation:fadeIn .8s ease ${i * 0.45}s backwards">${Art.esc(l)}</p>`).join("")}
      <p style="font-size:13.5px;color:#7a1a10;margin-top:6px;animation:fadeIn .8s ease ${lines.length * 0.45}s backwards">「${Art.esc(om.line)}」</p>
      <div class="mrow"><button class="btn shu big" data-close>絵巻をひらく</button></div>`, { noClose: true });
    c.classList.add("kotoba");
    UI.modal.onclose = then;
    SFX.page();
  }

  function toEmaki(first) {
    const mo = MONTHS[run.month];
    const seasonStart = [1, 4, 7, 10].includes(run.month);
    if (seasonStart && !first) UI.showSeason(mo.season, () => UI.renderEmaki());
    else UI.renderEmaki();
  }

  function continueGame() {
    run = Run.load();
    if (!run) { toTitle(); return; }
    UI.setRun(run);
    switch (run.phase) {
      case "map": UI.renderEmaki(); break;
      case "round": UI.renderRound(); break;
      case "cashout": UI.renderRound(); roundCleared(true); break;
      case "shop": UI.renderShop(); break;
      case "pack": UI.renderShop(); UI.showPack(); break;
      case "clear": UI.renderEnd(true, []); break;
      default: toTitle();
    }
  }

  // 祓いへ
  function startRound() {
    Run.startRound(run);
    save();
    const r = run.round;
    const y = YOKAI[r.yokai];
    if (r.kind === "boss" || r.kind === "final") {
      SFX.boss();
      const q = Score.effectiveQuirk(run, r);
      const c = UI.modal(`<div style="text-align:center">
          <div style="width:150px;height:150px;margin:0 auto;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 40%,#fffaf0,#cdbb93);border:3px solid #1d1a17;box-shadow:0 0 0 3px ${r.kind === "final" ? "#d9a531" : "#c8322a"},0 0 30px #c8322a88">${Art.portrait(y.portrait)}</div>
          <p style="font-size:12px;color:#7a1a10;margin-top:10px;letter-spacing:3px">${r.kind === "final" ? "百鬼夜行の主" : y.season + "の大妖"}</p>
          <h3 style="font-size:26px;letter-spacing:4px">${Art.esc(y.name)}</h3>
          <p style="font-style:italic;margin:6px 0">「${Art.esc(y.line)}」</p>
          <p style="color:#a0281e;font-weight:800">${q ? "癖：" + Art.esc(y.qtext) : y.qtext ? "癖：" + Art.esc(y.qtext) + "（獏が食べた）" : ""}</p>
          <p>祓いの目標 <b style="font-size:20px">${r.target.toLocaleString()}</b></p>
          <div class="mrow"><button class="btn shu big" data-close>いざ</button></div></div>`, { noClose: true });
      UI.modal.onclose = () => { UI.renderRound(); setTimeout(() => UI.talk("boss"), 500); };
      UI.renderRound();
      return;
    }
    UI.renderRound();
  }

  // 祓い成功（UI.doPlay から呼ばれる）
  function roundCleared(resumed) {
    const p = run.lastPayout;
    if (!resumed) {
      Profile.beatYokai(p.yokai);
      UI.achieveToast(Profile.achieve("clear", { run, kind: p.kind }));
      SFX.clear();
      // 朱印を押す演出
      const f = document.createElement("div");
      f.innerHTML = Art.stamp("祓");
      Object.assign(f.style, { position: "fixed", left: "50%", top: "40%", width: "140px", height: "140px", transform: "translate(-50%,-50%) scale(2.4) rotate(-14deg)", opacity: "0", zIndex: 55, transition: "transform .35s cubic-bezier(.3,1.6,.5,1), opacity .2s", pointerEvents: "none" });
      document.body.appendChild(f);
      requestAnimationFrame(() => { f.style.opacity = "1"; f.style.transform = "translate(-50%,-50%) scale(1) rotate(-14deg)"; });
      setTimeout(() => SFX.stamp(), 250);
      setTimeout(() => { f.style.opacity = "0"; }, 1300);
      setTimeout(() => f.remove(), 1700);
      setTimeout(() => cash(), 1100);
    } else cash();
    function cash() {
      UI.showCashout(() => {
        Run.cashOut(run);
        save();
        if (run.phase === "clear") endRun(true);
        else UI.renderShop();
      });
    }
  }

  function leaveShop() {
    Run.leaveShop(run);
    save();
    toEmaki(false);
  }

  function endRun(cleared) {
    let newly = [];
    if (!run.endRecorded) {
      newly = Profile.endRun(run, cleared);
      run.endRecorded = true;
      UI.achieveToast(Profile.achieve("end", { run, cleared }));
      if (run.daily) {
        // 日替わりの記録（その日の最高到達）
        const d = Profile.data;
        d.daily = d.daily || {};
        const reach = cleared ? 13 : run.month;
        const prev = d.daily[run.daily];
        if (!prev || reach > prev.reach) d.daily[run.daily] = { reach, label: cleared ? "一年を結んだ" : `${MONTHS[run.month].wa}まで` };
        Profile.save();
      }
    }
    if (cleared) { SFX.clear(); save(); }
    else { SFX.fail(); Run.clearSave(); }
    UI.renderEnd(cleared, newly);
  }

  function endless() {
    Run.continueEndless(run);
    save();
    UI.renderShop();
  }

  return { boot, toTitle, newGame, continueGame, startRound, roundCleared, leaveShop, endRun, endless, get run() { return run; } };
})();

document.addEventListener("DOMContentLoaded", () => Main.boot());
