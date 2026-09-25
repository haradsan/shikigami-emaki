// ============================================================
// ui.js — 画面の描画と操作。状態は run.js（Run）が持ち、ここは見せ方と演出だけ。
//   画面: title / select / emaki（月の地図）/ round（祓い）/ shop（夜市）/ end / book（図鑑）
//   演出: 採点は scorePlay が返す steps を1つずつ再生（文・倍の数え上げ、式神が跳ねる）
// ============================================================
"use strict";

const UI = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = Art.esc;
  let run = null;
  let sel = [];            // 選択中の札 uid（選んだ順）
  let sortMode = "month";  // month / type
  let busy = false;        // 演出中は操作を受けつけない
  let armedFu = null;      // 使おうとしている呪符の番号
  let skip = false;        // 演出の早送り
  const speed = () => (skip ? 0.15 : 1 / (Profile.data.speed || 1));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * speed()));

  // ---------- 画面切り替え ----------
  function show(id) {
    if (id !== "round") busy = false;
    $$(".screen").forEach((s) => s.classList.toggle("on", s.id === "scr-" + id));
    document.body.dataset.screen = id;
  }

  // ---------- 小物 ----------
  function toast(msg, bad = false) {
    const area = $("#toast-area");
    const t = document.createElement("div");
    t.className = "toast" + (bad ? " bad" : "");
    t.textContent = msg;
    (area && $("#scr-round").classList.contains("on") ? area : document.body).appendChild(t);
    if (!area || !$("#scr-round").classList.contains("on")) {
      Object.assign(t.style, { position: "fixed", top: "70px", left: "50%", transform: "translateX(-50%)", zIndex: 60 });
    }
    setTimeout(() => t.remove(), 2800);
  }
  function floatAt(el, text, cls) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = document.createElement("div");
    f.className = "float " + cls;
    f.textContent = text;
    f.style.left = r.left + r.width / 2 + "px";
    f.style.top = r.top + r.height * 0.3 + "px";
    $("#fx-layer").appendChild(f);
    setTimeout(() => f.remove(), 900);
  }
  // 手ざわり（対応端末だけ小さく震える）
  const buzz = (p) => { try { if (navigator.vibrate && SFX.enabled) navigator.vibrate(p); } catch (e) { /* */ } };

  // 式神のひとこと（吹き出し）。idx を省くと、その場面の台詞を持つ式神から選ぶ
  let lastTalk = 0;
  function talk(kind, idx) {
    if (!run || !run.shiki.length) return;
    const now = Date.now();
    if (idx === undefined && now - lastTalk < 3500) return; // しゃべりすぎない
    let i = idx;
    if (i === undefined) {
      const cand = run.shiki.map((s, k) => k).filter((k) => SHIKI_TALK[run.shiki[k].id] && SHIKI_TALK[run.shiki[k].id][kind]);
      const pool = cand.length ? cand : run.shiki.map((s, k) => k);
      i = pool[Math.floor(Math.random() * pool.length)];
    }
    const s = run.shiki[i];
    if (!s) return;
    const t = (SHIKI_TALK[s.id] && SHIKI_TALK[s.id][kind]) || (GENERIC_TALK[kind] ? GENERIC_TALK[kind][Math.floor(Math.random() * GENERIC_TALK[kind].length)] : null);
    if (!t) return;
    const el = document.querySelector(`.screen.on .shiki[data-si="${i}"]`);
    if (!el) return;
    lastTalk = now;
    const r = el.getBoundingClientRect();
    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = t;
    b.style.left = Math.max(100, Math.min(window.innerWidth - 100, r.left + r.width / 2)) + "px";
    b.style.top = r.top - 6 + "px";
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2800);
  }

  // 大きな数は「万・億」でまとめる（枠からはみ出さないように）
  const fmt = (n) => {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "兆";
    if (n >= 1e8) return (n / 1e8).toFixed(2) + "億";
    if (n >= 1e5) return (n / 1e4).toFixed(1) + "万";
    return Math.round(n).toLocaleString();
  };
  const fmtBai = (n) => (n >= 1e5 ? fmt(n) : (Math.round(n * 10) / 10).toLocaleString());
  const zeniHtml = (n) => `<span class="tb-zeni">${Art.coin(16)}${n}</span>`;

  function modal(html, opts = {}) {
    const m = $("#modal"), c = $("#modal-card");
    c.innerHTML = (opts.noClose ? "" : `<button class="close-x" data-close>×</button>`) + html;
    m.classList.remove("hidden");
    m.onclick = (e) => {
      if (e.target === m && !opts.noClose) closeModal();
      const cl = e.target.closest("[data-close]");
      if (cl) closeModal();
    };
    return c;
  }
  function closeModal() { $("#modal").classList.add("hidden"); $("#modal-card").innerHTML = ""; if (modal.onclose) { const f = modal.onclose; modal.onclose = null; f(); } }

  // ---------- 札・式神の部品 ----------
  function shikiHtml(inst, i, opts = {}) {
    const d = SHIKI_BY_ID[inst.id];
    let cnt = "";
    if (d.fmt && inst.data) {
      const v = d.fmt(inst, run);
      const val = v.n !== undefined ? v.n : v.x;
      if (val && val !== "1.0" && val !== 0) cnt = `<div class="cnt">${v.x ? "×" + val : "+" + val}</div>`;
    }
    const bond = d.bond ? `<div class="bond">絆</div>` : "";
    const asleep = opts.asleep ? " asleep" : "";
    return `<div class="shiki r${d.rar}${asleep}" data-si="${i}" data-id="${d.id}"><div class="pt">${Art.portrait(d.id)}</div><div class="sn">${esc(d.name)}</div>${cnt}${bond}</div>`;
  }
  function shikiText(inst) {
    const d = SHIKI_BY_ID[inst.id];
    let t = d.text;
    if (d.fmt && inst.data) { const v = d.fmt(inst, run); t = t.replace("{n}", v.n).replace("{x}", v.x); }
    return t;
  }
  function renderShikiRow(el, opts = {}) {
    const p = Run.passives(run);
    const r = run.round;
    let h = run.shiki.map((s, i) => shikiHtml(s, i, { asleep: r && r.sleeping === i })).join("");
    for (let i = run.shiki.length; i < p.slots; i++) h += `<div class="shiki empty"></div>`;
    el.innerHTML = h;
    const n = Math.max(p.slots, run.shiki.length);
    const w = Math.min(64, Math.floor((Math.min(window.innerWidth, 480) - 24 - (n - 1) * 5) / n));
    el.style.setProperty("--sw", w + "px");
    $$(".shiki[data-si]", el).forEach((s) => s.onclick = () => showShikiDetail(+s.dataset.si, opts));
  }

  function showShikiDetail(i, opts = {}) {
    const inst = run.shiki[i];
    if (!inst) return;
    const d = SHIKI_BY_ID[inst.id];
    const canSell = !busy;
    const bondTxt = d.bond ? `<p class="dim" style="color:#7a4a10;font-size:12px">🤝 絆: ${esc(bondName(d.bond))}</p>` : "";
    const c = modal(`
      <div class="det">
        <div class="big-pt">${Art.portrait(d.id)}</div>
        <div>
          <span class="rar" style="background:${RAR[d.rar].color}">${RAR[d.rar].name}</span>
          <h3>${esc(d.name)} <span class="yomi-kana">${esc(d.yomi)}</span></h3>
          <div class="effect">${esc(shikiText(inst))}</div>
          ${bondTxt}
        </div>
      </div>
      <p class="lore" style="margin-top:8px;font-size:13px;color:#5c4d33">${esc(d.lore)}</p>
      <div class="mrow">
        <button class="btn" data-mv="-1" ${i === 0 ? "disabled" : ""}>‹ 左へ</button>
        <button class="btn" data-mv="1" ${i === run.shiki.length - 1 ? "disabled" : ""}>右へ ›</button>
      </div>
      <div class="mrow">
        <button class="btn shu" data-sell ${canSell ? "" : "disabled"}>手放す（${sellPrice(inst)}銭）</button>
        <button class="btn" data-close>閉じる</button>
      </div>
      <p class="dim" style="font-size:11px;color:#7a6a4a;margin-top:6px">式神は左から順に力を発揮します。並べ替えで「足し算→掛け算」の順にすると強い。</p>`);
    $$("[data-mv]", c).forEach((b) => b.onclick = () => { Run.moveShiki(run, i, +b.dataset.mv); save(); closeModal(); refresh(); showShikiDetail(i + +b.dataset.mv, opts); });
    const sb = $("[data-sell]", c);
    if (sb) sb.onclick = () => {
      const res = Run.sell(run, i);
      if (res.ok) { SFX.coin(); toast(`${d.name}を手放した（+${res.price}銭）`); save(); closeModal(); refresh(); }
    };
  }
  const bondName = (b) => ({ komainu: "狛犬・阿 と 狛犬・吽", sanen: "見ざる・聞かざる・言わざる", fuurai: "風神 と 雷神" }[b] || "");

  function refresh() {
    const ph = run && run.phase;
    if (ph === "round") renderRound();
    else if (ph === "shop" || ph === "pack") renderShop();
    else if (ph === "map") renderEmaki();
  }

  // ---------- 上の帯 ----------
  function topbarHtml() {
    const mo = MONTHS[run.month];
    const yr = run.year > 1 ? `${run.year}年目・` : "";
    return `<div class="tb-month"><span class="plant" style="background:${mo.color}">${mo.plant[0]}</span><div>${mo.wa}<small>${yr}${KANSUJI[run.month]}月・${mo.plant}</small></div></div>
      <div class="tb-spacer"></div>
      ${zeniHtml(run.zeni)}
      <button class="btn tb-menu" data-menu>≡</button>`;
  }
  function bindTop(el) {
    const mb = $("[data-menu]", el);
    if (mb) mb.onclick = () => showMenu();
  }

  function showMenu() {
    const c = modal(`<h3>ひと休み</h3>
      <div class="mrow"><button class="btn" data-a="yaku">役と段位</button><button class="btn" data-a="deck">山札を見る</button></div>
      <div class="mrow"><button class="btn" data-a="howto">遊び方</button><button class="btn" data-a="settings">設定</button></div>
      <div class="mrow"><button class="btn" data-a="title">タイトルへ（続きは保存）</button></div>
      <div class="mrow"><button class="btn shu" data-a="giveup">この一年をあきらめる</button></div>`);
    $$("[data-a]", c).forEach((b) => b.onclick = () => {
      const a = b.dataset.a;
      if (a === "yaku") showYakuList();
      if (a === "deck") showDeck();
      if (a === "howto") showHowto();
      if (a === "settings") showSettings();
      if (a === "title") { closeModal(); save(); Main.toTitle(); }
      if (a === "giveup") {
        const cc = modal(`<h3>本当にあきらめますか？</h3><p>この一年の記録はここで終わります。</p>
          <div class="mrow"><button class="btn shu" data-yes>あきらめる</button><button class="btn" data-close>やめておく</button></div>`);
        $("[data-yes]", cc).onclick = () => { closeModal(); run.phase = "over"; Main.endRun(false); };
      }
    });
  }

  // ============================================================
  //  絵巻（月の地図）
  // ============================================================
  function renderEmaki() {
    show("emaki");
    const top = $("#emaki-top");
    top.innerHTML = topbarHtml();
    bindTop(top);
    // 十二段の絵巻
    const strip = $("#emaki-strip");
    let h = "";
    for (let m = 1; m <= 12; m++) {
      const mo = MONTHS[m];
      const yid = run.plan[m];
      const y = YOKAI[yid];
      const done = m < run.month;
      const now = m === run.month;
      const repr = BASE_DECK.find((c) => c.m === m && (c.t === "hikari" || c.t === "tane")) || BASE_DECK.find((c) => c.m === m);
      h += `<div class="ep ${done ? "done" : now ? "now" : "future"} ${y.kind}" data-m="${m}">
        <div class="ep-wa">${mo.wa}</div><div class="ep-plant">${KANSUJI[m]}月・${mo.plant}</div>
        <div class="ep-art">${Art.card({ ...repr, uid: "" }, { noIdx: true })}</div>
        <div class="ep-yk">${Art.portrait(y.portrait)}</div>
        ${done ? Art.stamp("祓") : ""}
        <div class="ep-candle">${Art.candle(done)}</div>
      </div>`;
    }
    strip.innerHTML = h;
    requestAnimationFrame(() => {
      const now = $(".ep.now", strip);
      const sc = $("#emaki-scroll");
      if (now && sc) sc.scrollLeft = now.offsetLeft - sc.clientWidth / 2 + now.clientWidth / 2;
    });
    $$(".ep", strip).forEach((e) => e.onclick = () => {
      const m = +e.dataset.m;
      const y = YOKAI[run.plan[m]];
      toast(`${MONTHS[m].wa}：${y.name}${y.qtext ? "（" + y.qtext + "）" : ""}`);
    });

    // 次の妖
    const m = run.month;
    const yid = run.plan[m];
    const y = YOKAI[yid];
    Profile.meetYokai(yid);
    const target = Run.targetOf(run, m);
    const kindLbl = y.kind === "boss" ? `${y.season}の大妖` : y.kind === "final" ? "百鬼夜行の主" : "小妖";
    const panel = $("#emaki-panel");
    const jingiShelf = `<div class="jingi-shelf"><span class="lbl">神器</span>${JINGI.map((j) => `<div class="slot ${run.jingi.includes(j.id) ? "have" : ""}" title="${j.name}">${Art.jingi(j.id, run.jingi.includes(j.id))}</div>`).join("")}</div>`;
    panel.innerHTML = `
      <p class="month-text">${esc(MONTH_TEXT[m] || "")}</p>
      <div class="next-yokai ${y.kind}">
        <div class="yp">${Art.portrait(y.portrait)}</div>
        <div>
          <div class="ny-name">${esc(y.name)} <span class="dim" style="font-size:11px">${kindLbl}</span></div>
          <div class="ny-line">「${esc(y.line)}」</div>
          <div class="ny-quirk">${y.qtext ? "癖：" + esc(y.qtext) : '<span class="dim">癖なし</span>'}</div>
          <div class="ny-target">祓いの目標 <b>${fmt(target)}</b>${run.rank ? ` <span class="dim" style="font-size:11px">${RANKS[run.rank].name}</span>` : ""}</div>
        </div>
      </div>
      ${jingiShelf}
      <div id="emaki-shiki" class="shiki-row"></div>
      <div class="fu-row" id="emaki-fu"></div>
      <div class="emaki-actions">
        <button class="btn" data-a="deck">山札</button>
        <button class="btn" data-a="yaku">役と段位</button>
      </div>
      <button class="btn big shu" id="btn-go">祓いに向かう</button>`;
    renderShikiRow($("#emaki-shiki"));
    renderFuRow($("#emaki-fu"), false);
    $$("[data-a]", panel).forEach((b) => b.onclick = () => (b.dataset.a === "deck" ? showDeck() : showYakuList()));
    $("#btn-go").onclick = () => Main.startRound();
    BGM.setTrack("title");
  }

  // 季節のはじめの詞書
  function showSeason(season, then) {
    const c = modal(`<div class="kotoba"><div class="season-ttl">${season}</div><p>${esc(STORY.season[season])}</p>
      <div class="mrow"><button class="btn shu" data-close>ひらく</button></div></div>`);
    c.classList.add("kotoba");
    modal.onclose = then;
    SFX.page();
  }

  // ============================================================
  //  祓い（対局）
  // ============================================================
  function layoutSizes() {
    const W = Math.min(window.innerWidth, 480);
    const H = window.innerHeight;
    const n = Math.max(8, run.round ? run.round.hand.length : 8);
    // 手札: 重なりを許して横一列（札の幅は最大70px）
    let cw = Math.min(70, Math.floor((W - 32) / (n * 0.7 + 0.3)));
    if (H < 700) cw = Math.min(cw, 54);
    document.documentElement.style.setProperty("--cw", cw + "px");
    return { W, cw, n };
  }

  function renderRound() {
    show("round");
    const r = run.round;
    const y = YOKAI[r.yokai];
    const top = $("#round-top");
    top.innerHTML = topbarHtml();
    bindTop(top);
    renderYokaiBar();
    renderShikiRow($("#shiki-row"));
    renderFuRow($("#fu-row"), true);
    renderHand(false);
    updateButtons();
    if (!busy) resetCalc();
    BGM.setTrack(y.kind === "boss" || y.kind === "final" ? "boss" : "battle");
  }

  function renderYokaiBar() {
    const r = run.round;
    const y = YOKAI[r.yokai];
    const q = Score.effectiveQuirk(run, r);
    const eaten = r.quirk && !q;
    const kindLbl = y.kind === "boss" ? "大妖" : y.kind === "final" ? "主" : "小妖";
    const pct = Math.min(100, (r.score / r.target) * 100);
    const bar = $("#yokai-bar");
    bar.className = "yokai-bar " + y.kind;
    bar.innerHTML = `<div class="yp">${Art.portrait(y.portrait)}</div>
      <div class="yinfo">
        <div class="yname">${esc(y.name)}<span class="ykind">${kindLbl}</span></div>
        <div class="yquirk ${y.qtext ? "" : "none"} ${eaten ? "eaten" : ""}">${y.qtext ? esc(y.qtext) + (eaten ? "（獏が食べた）" : "") : "癖なし"}</div>
        <div class="goal"><div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>
          <div class="goal-num"><b id="g-score">${fmt(r.score)}</b> / ${fmt(r.target)}</div></div>
      </div>`;
    bar.onclick = () => toast(`${y.name}：「${y.line}」`);
  }

  function renderFuRow(el, inRound) {
    const p = Run.passives(run);
    let h = `<span class="lbl">呪符</span>`;
    run.fu.forEach((id, i) => { h += `<div data-fi="${i}" class="fu-wrap">${Art.fu(id)}</div>`; });
    for (let i = run.fu.length; i < p.fuSlots; i++) h += `<div class="fu-empty"></div>`;
    el.innerHTML = h;
    $$("[data-fi]", el).forEach((w) => {
      const fc = $(".fu-card", w);
      if (armedFu === +w.dataset.fi) fc.classList.add("armed");
      w.onclick = () => showFuDetail(+w.dataset.fi, inRound);
    });
  }

  function showFuDetail(fi, inRound) {
    const id = run.fu[fi];
    const f = FU[id];
    const needCards = f.need[0] > 0;
    const usable = !busy && (needCards ? run.phase === "round" : true);
    const selInfo = needCards ? `<p style="font-size:12.5px;color:#7a4a10">${inRound ? `いま選んでいる札：${sel.length}枚` : "祓いの最中に、手札を選んでから使います"}</p>` : "";
    const c = modal(`<div class="det"><div style="flex:none">${Art.fu(id).replace('class="fu-card', 'style="width:60px;height:96px" class="fu-card')}</div>
      <div><h3>${esc(f.name)}</h3><div class="effect">${esc(f.text)}</div>${selInfo}</div></div>
      <div class="mrow"><button class="btn shu" data-use ${usable ? "" : "disabled"}>使う</button><button class="btn" data-sellfu>手放す（1銭）</button><button class="btn" data-close>閉じる</button></div>`);
    $("[data-use]", c).onclick = () => {
      const res = Run.useFu(run, fi, sel.slice());
      if (res.error) { SFX.error(); toast(res.error, true); return; }
      closeModal();
      SFX.open();
      afterFu(res);
    };
    $("[data-sellfu]", c).onclick = () => { Run.sellFu(run, fi); SFX.coin(); closeModal(); save(); refresh(); };
  }
  function afterFu(res) {
    const f = FU[res.id];
    let msg = `${f.name}を使った`;
    if (res.zeni) msg += `（+${res.zeni}銭）`;
    if (res.shiki) { msg += `：${SHIKI_BY_ID[res.shiki].name}が来た！`; Profile.seeShiki(res.shiki); }
    toast(msg);
    if (res.failed) { save(); setTimeout(() => Main.endRun(false), 600); return; }
    if (res.removed) sel = [];
    sel = sel.filter((u) => run.round && run.round.hand.includes(u));
    save();
    refresh();
    // 変化した札を光らせる
    for (const u of res.changed || []) { const el = $(`#hand .card[data-uid="${u}"]`); if (el) floatAt(el, "変化", "info"); }
  }

  function sortedHand() {
    const r = run.round;
    const hand = r.hand.map((u) => Run.card(run, u));
    if (sortMode === "month") hand.sort((a, b) => a.m - b.m || TYPES[b.t].rank - TYPES[a.t].rank || a.uid - b.uid);
    else hand.sort((a, b) => TYPES[b.t].rank - TYPES[a.t].rank || a.m - b.m || a.uid - b.uid);
    // 打つ順＝手札の並び順（Run.orderInHand）に反映させる
    r.hand = hand.map((c) => c.uid);
    return hand;
  }

  function renderHand(animateNew, newUids = []) {
    const r = run.round;
    const el = $("#hand");
    const { W, cw } = layoutSizes();
    const hand = sortedHand();
    const n = hand.length;
    // 扇形に傾けると外側の札がはみ出すので、両端に少し余白をとる
    const avail = W - 8 - 24;
    const step = n > 1 ? Math.min(cw + 4, (avail - cw) / (n - 1)) : 0;
    const totalW = step * (n - 1) + cw;
    const x0 = (W - 8 - totalW) / 2;
    el.innerHTML = hand.map((c) => Art.card(c, { month: r.month, faceDown: r.faceDown.includes(c.uid) })).join("");
    $$(".card", el).forEach((ce, i) => {
      const mid = (n - 1) / 2;
      const rot = (i - mid) * 1.6;
      const dy = Math.abs(i - mid) * Math.abs(i - mid) * 0.7;
      ce.style.left = x0 + i * step + "px";
      ce.style.transform = `translateY(${dy}px) rotate(${rot}deg)`;
      ce.style.zIndex = 10 + i;
      const uid = +ce.dataset.uid;
      if (sel.includes(uid)) ce.classList.add("sel");
      if (animateNew && newUids.includes(uid)) { ce.classList.add("deal"); ce.style.animationDelay = newUids.indexOf(uid) * 60 + "ms"; }
      ce.onclick = () => toggleSel(uid, ce);
      // 長押しで札の説明
      let lp = null;
      ce.addEventListener("touchstart", () => { lp = setTimeout(() => { lp = "done"; showCardInfo(uid); }, 480); }, { passive: true });
      ce.addEventListener("touchend", (e) => { if (lp === "done") { e.preventDefault(); } clearTimeout(lp); lp = null; });
      ce.addEventListener("touchmove", () => { clearTimeout(lp); lp = null; }, { passive: true });
      ce.oncontextmenu = (e) => { e.preventDefault(); showCardInfo(uid); };
    });
    if (animateNew && newUids.length) newUids.forEach((u, i) => SFX.deal(i));
    renderPile();
  }
  function renderPile() {
    const r = run.round;
    const pile = $("#pile");
    if (!pile || !r) return;
    const n = r.draw.length;
    pile.innerHTML = [0, 1, 2].slice(0, Math.min(3, n)).map(() => `<div class="card face-down"><div class="art">${Art.backSvg()}</div></div>`).join("") + `<div class="pn">山 ${n}</div>`;
    pile.onclick = () => showDeck();
  }

  function showCardInfo(uid) {
    const c = Run.card(run, uid);
    if (!c) return;
    if (run.round && run.round.faceDown.includes(uid)) { toast("伏せ札：中身は見えない"); return; }
    const lines = [];
    lines.push(`${TYPES[c.t].name}の札：文 ${TYPES[c.t].bun}`);
    if (run.round && c.m === run.round.month) lines.push("旬：役に加わると 倍+2");
    if (c.enh) lines.push(`${ENH[c.enh].name}：${ENH[c.enh].desc}`);
    if (c.seal) lines.push(`${SEAL[c.seal].name}：${SEAL[c.seal].desc}`);
    modal(`<div class="det"><div style="flex:none;--cw:92px">${Art.card(c, { month: run.round && run.round.month })}</div>
      <div><h3>${esc(cardName(c))}</h3><p style="font-size:12px;color:#7a6a4a">${MONTHS[c.m].wa}（${KANSUJI[c.m]}月）・${MONTHS[c.m].plant}</p>
      ${lines.map((l) => `<p style="font-size:13.5px">${esc(l)}</p>`).join("")}</div></div>`);
  }

  function toggleSel(uid, ce) {
    if (busy) return;
    const i = sel.indexOf(uid);
    if (i >= 0) { sel.splice(i, 1); ce.classList.remove("sel"); SFX.deselect(); }
    else {
      if (sel.length >= 5) { SFX.error(); toast("選べるのは5枚まで", true); return; }
      sel.push(uid); ce.classList.add("sel"); SFX.select(); buzz(6);
    }
    updateButtons();
    updatePreview();
  }

  function resetCalc() {
    $("#played").innerHTML = "";
    $("#yaku-chips").innerHTML = "";
    $("#c-bun").textContent = "0";
    $("#c-bai").textContent = "0";
    $("#c-total").innerHTML = "";
    $("#c-total").classList.remove("big");
    updatePreview();
  }

  // 選択中の札の見込み
  function updatePreview() {
    if (busy || !run.round) return;
    const chips = $("#yaku-chips");
    if (!sel.length) {
      chips.innerHTML = "";
      $("#c-bun").textContent = "0"; $("#c-bai").textContent = "0";
      const r = run.round;
      const left = Math.max(0, r.target - r.score);
      $("#c-total").innerHTML = r.handsPlayed === 0 && run.month === 1 && run.year === 1
        ? `<div class="hint">札をタップして選び（最大5枚）、<b>打つ</b>で役を作ろう。<br>同じ月の札をそろえると「合わせ」。長押しで札の説明。</div>`
        : `<small>あと ${fmt(left)}</small>`;
      return;
    }
    // 伏せ札（土蜘蛛）が混じっていたら、見込みは出さない（中身が分かってしまうため）
    if (sel.some((u) => run.round.faceDown.includes(u))) {
      chips.innerHTML = `<span class="ychip">伏せ札あり</span>`;
      $("#c-bun").textContent = "？"; $("#c-bai").textContent = "？";
      $("#c-total").innerHTML = `<small>打ってみるまで分からない</small>`;
      return;
    }
    const pv = Run.preview(run, sel);
    chips.innerHTML = pv.yaku.map((y) => yakuChip(y)).join("") + (pv.blocked ? `<span class="ychip blocked">${YAKU[pv.blocked].name}</span>` : "");
    $("#c-bun").textContent = fmt(pv.bun);
    $("#c-bai").textContent = fmtBai(pv.bai);
    const hasRandom = run.shiki.some((s) => s.id === "amanojaku");
    $("#c-total").innerHTML = `<small>見込み</small> ${fmt(pv.total)}${hasRandom ? "<small>前後</small>" : ""}`;
  }
  function yakuChip(y, anim) {
    const Y = YAKU[y.key];
    const lv = y.lvl > 1 ? `<span class="lv">${y.lvl}段</span>` : "";
    return `<span class="ychip ${Y.cat} ${anim ? "stampin" : ""}">${esc(Y.name)}${lv}</span>`;
  }

  function updateButtons() {
    const r = run.round;
    if (!r) return;
    const cp = Run.canPlay(run, sel);
    const cd = Run.canDiscard(run, sel);
    $("#btn-play").classList.toggle("off", busy || !cp.ok);
    $("#btn-discard").classList.toggle("off", busy || !cd.ok);
    $("#n-play").textContent = `残り${r.hands}`;
    $("#n-discard").textContent = `残り${r.discards}`;
    $("#btn-sort").textContent = sortMode === "month" ? "月順" : "種順";
  }

  // ---------- 打つ ----------
  async function doPlay() {
    if (busy) return;
    const cp = Run.canPlay(run, sel);
    if (!cp.ok) { SFX.error(); toast(cp.reason, true); return; }
    busy = true; skip = false;
    updateButtons();
    const uids = Run.orderInHand(run, sel).map((c) => c.uid);
    // 場へ出す演出
    $$("#hand .card").forEach((ce) => { if (uids.includes(+ce.dataset.uid)) ce.classList.add("gone"); });
    SFX.play();
    await wait(200);
    const res = Run.play(run, uids);
    sel = [];
    if (res.error) { busy = false; SFX.error(); toast(res.error, true); renderHand(false); updateButtons(); return; }
    save();
    // 妖の癖の通知
    for (const e of res.events) {
      if (e.t === "sleep") toast(`${SHIKI_BY_ID[run.shiki[e.idx].id].name}が化かされて眠った…`, true);
      if (e.t === "shuffleShiki") toast("ぬらりひょん：「並びを変えてやろうかの」", true);
    }
    renderShikiRow($("#shiki-row"));
    await playScoring(res);
    // 打ったあとの出来事
    for (const e of res.events) {
      if (e.t === "break") toast("薄氷の札が割れた！", true);
      if (e.t === "gild") toast("雷獣が札に金箔を焼きつけた");
      if (e.t === "zeni") toast(`${e.d}銭（崇徳院の取り立て）`, true);
      if (e.t === "drop") toast("雨降り小僧：札が1枚流された", true);
      if (e.t === "empty") toast("札が尽きた……", true);
    }
    renderYokaiBar();
    renderShikiRow($("#shiki-row"));
    // 祓いが決着したら、次の画面が出るまで操作を止めたままにする（busy は次の画面で解く）
    if (res.cleared) {
      talk("clear");
      await wait(350);
      Main.roundCleared();
      return;
    }
    if (!res.failed) {
      const r = run.round;
      if (res.score.total >= r.target * 0.4) talk("big");
      else if (r.hands === 1) setTimeout(() => talk("last"), 400);
    }
    if (res.failed) {
      await wait(500);
      Main.endRun(false);
      return;
    }
    await wait(250);
    busy = false;
    resetCalc();
    renderHand(true, res.drawn);
    updateButtons();
    $("#top-zeni");
    $("#round-top").innerHTML = topbarHtml();
    bindTop($("#round-top"));
  }

  // 採点の再生
  async function playScoring(res) {
    const sc = res.score;
    const played = $("#played");
    played.innerHTML = res.played.map((c) => Art.card(c, { month: run.round ? run.round.month : null })).join("");
    const chips = $("#yaku-chips");
    chips.innerHTML = "";
    let bun = 0, bai = 0, nb = 0, nm = 0;
    const B = $("#c-bun"), M = $("#c-bai"), T = $("#c-total");
    T.innerHTML = ""; T.classList.remove("big");
    B.textContent = "0"; M.textContent = "0";
    await wait(150);
    // 数えない札は暗く
    const scoredSet = new Set(sc.scored.map((c) => c.uid));
    $$(".card", played).forEach((ce) => { if (!scoredSet.has(+ce.dataset.uid)) ce.style.opacity = ".45"; });
    let yi = 0;
    for (const st of sc.steps) {
      let el = null;
      if (st.k === "yaku") {
        chips.insertAdjacentHTML("beforeend", yakuChip({ key: st.key, lvl: st.lvl }, true));
        SFX.yaku(yi++);
        Profile.seeYaku(st.key);
        bun += st.dBun; bai += st.dBai;
        B.textContent = fmt(bun); M.textContent = fmtBai(bai);
        B.classList.remove("bump"); void B.offsetWidth; B.classList.add("bump");
        await wait(380);
        continue;
      }
      if (st.k === "card") el = $(`.card[data-uid="${st.uid}"]`, played);
      if (st.k === "held") el = $(`#hand .card[data-uid="${st.uid}"]`);
      if (st.k === "shiki") el = $(`#shiki-row .shiki[data-si="${st.idx}"]`);
      if (st.k === "jingi") el = $("#c-total");
      if (st.debuff) {
        if (el) { el.classList.add("debuff"); floatAt(el, "無効", "info"); }
        SFX.debuff();
        await wait(220);
        continue;
      }
      if (el) {
        if (st.k === "card") { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
        if (st.k === "shiki") { el.classList.remove("fire"); void el.offsetWidth; el.classList.add("fire"); SFX.shiki(); }
      }
      if (st.dBun) { bun += st.dBun; B.textContent = fmt(bun); floatAt(el || B, `+${fmt(st.dBun)}${st.label && st.label !== "文" ? " " + st.label : ""}`, "bun"); SFX.bun(nb++); B.classList.remove("bump"); void B.offsetWidth; B.classList.add("bump"); }
      if (st.dBai) { bai += st.dBai; M.textContent = fmtBai(bai); floatAt(el || M, `+${fmtBai(st.dBai)}倍${st.label ? " " + st.label : ""}`, "bai"); SFX.bai(nm++); M.classList.remove("bump"); void M.offsetWidth; M.classList.add("bump"); }
      if (st.xBai) { bai *= st.xBai; M.textContent = fmtBai(bai); floatAt(el || M, `×${st.xBai}${st.label ? " " + st.label : ""}`, "xbai"); SFX.xbai(); M.classList.remove("bump"); void M.offsetWidth; M.classList.add("bump"); }
      await wait(st.xBai ? 330 : 230);
    }
    // 合計
    await wait(120);
    const total = sc.total;
    T.innerHTML = fmt(total);
    T.classList.add("big");
    const r = run.round;
    const big = r ? total >= r.target * 0.5 : total > 1000;
    SFX.total(big);
    buzz(big ? [18, 50, 30] : 14);
    if (Profile.hand(total, sc.keys)) setTimeout(() => toast(`一打の新記録！ ${fmt(total)}`), 400);
    // 目標の帯
    const g = $("#g-score");
    if (g && run.round) {
      g.textContent = fmt(run.round.score);
      const fill = $(".goal-fill");
      if (fill) fill.style.width = Math.min(100, (run.round.score / run.round.target) * 100) + "%";
    } else if (g) {
      // 祓いが終わった（run.round は精算で消えている）
      const fill = $(".goal-fill");
      if (fill) fill.style.width = "100%";
      g.textContent = fmt(run.lastPayout ? total : total);
    }
    await wait(700);
  }

  // ---------- 流す ----------
  async function doDiscard() {
    if (busy) return;
    const cd = Run.canDiscard(run, sel);
    if (!cd.ok) { SFX.error(); toast(cd.reason, true); return; }
    busy = true;
    $$("#hand .card").forEach((ce) => { if (sel.includes(+ce.dataset.uid)) ce.classList.add("discarded"); });
    SFX.discard();
    await wait(260);
    const res = Run.discard(run, sel.slice());
    sel = [];
    for (const e of res.events) if (e.t === "zeni") toast(`${e.d}銭（小豆代）`, true);
    save();
    if (res.failed) { toast("札が尽きた……", true); await wait(600); Main.endRun(false); return; }
    busy = false;
    renderHand(true, res.drawn);
    renderShikiRow($("#shiki-row"));
    $("#round-top").innerHTML = topbarHtml();
    bindTop($("#round-top"));
    resetCalc();
    updateButtons();
  }

  // ---------- 精算 ----------
  function showCashout(then) {
    const p = run.lastPayout;
    const y = YOKAI[p.yokai];
    const lines = [];
    lines.push([`${y.name}を祓った`, p.base]);
    if (p.handsBonus) lines.push([`残りの打ち（${p.handsBonus}回）`, p.handsBonus]);
    if (p.interest) lines.push([`利子（5銭ごとに1）`, p.interest]);
    for (const s of p.shikiPay) lines.push([`${SHIKI_BY_ID[run.shiki[s.idx].id].name}`, s.amt]);
    const c = modal(`<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px">
        <div style="width:64px;height:64px;border-radius:50%;overflow:hidden;background:#fffaf0;border:2px solid #1d1a17;flex:none">${Art.portrait(y.portrait)}</div>
        <div><h3 style="margin:0">祓い成功</h3><p style="font-size:12.5px;color:#5c4d33;font-style:italic">「${esc(y.lose)}」</p></div>
      </div>
      <div class="payout">${lines.map(([t, v], i) => `<div class="pl" style="animation-delay:${i * 0.15}s"><span>${esc(t)}</span><b>${Art.coin(14)}+${v}</b></div>`).join("")}
        <div class="pl total" style="animation-delay:${lines.length * 0.15}s"><span>合計</span><b>${Art.coin(18)}+${p.total}</b></div></div>
      <div class="mrow"><button class="btn gold big" data-go>${run.round && run.round.kind === "final" && !run.endless ? "結びへ" : "夜市へ"}</button></div>`, { noClose: true });
    lines.forEach((_, i) => setTimeout(() => SFX.coin(i), 150 * i + 100));
    $("[data-go]", c).onclick = () => { closeModal(); then(); };
  }

  // ============================================================
  //  夜市
  // ============================================================
  const MERCHANT_LINES = [
    "へい、いらっしゃい。今宵も掘り出し物がそろってますよ",
    "式神は左から順に働く。並びも大事ですぜ",
    "歌の札で役を磨けば、同じ役でも桁が変わる",
    "銭は五枚ごとに一枚の利子がつく。貯めるのも手ですよ",
    "神器は季節にひとつ。五つそろえば……ふふ",
    "札を祓って山を薄くすると、狙いの役が来やすくなる",
    "絆のある式神は、そろうと化けますぜ",
  ];
  function renderShop() {
    show("shop");
    const top = $("#shop-top");
    top.innerHTML = topbarHtml();
    bindTop(top);
    renderShikiRow($("#shop-shiki"), { allowSell: true });
    renderFuRow($("#shop-fu"), false);
    const s = run.shop;
    const body = $("#shop-body");
    const line = MERCHANT_LINES[(run.month + run.year * 3 + (s.rerolls || 0)) % MERCHANT_LINES.length];
    const ware = (kind, i, inner, name, cost, desc, sold) =>
      `<div class="ware ${sold ? "sold" : ""} ${cost > run.zeni ? "cant" : ""}" data-k="${kind}" data-i="${i}">${inner}<div class="wname">${esc(name)}</div>${desc ? `<div class="wdesc">${esc(desc)}</div>` : ""}<div class="price">${Art.coin(13)}${cost}</div></div>`;
    let h = `<div class="merchant"><div class="mp">${Art.portrait("bakedanuki")}</div><div class="say">${esc(line)}</div></div>`;
    h += `<div class="shop-sec"><h4>式神</h4><div class="wares">${s.shiki.map((w, i) => ware("shiki", i, shikiHtml({ id: w.id, data: SHIKI_BY_ID[w.id].init || {} }, -1), SHIKI_BY_ID[w.id].name, w.cost, "", w.sold)).join("")}</div></div>`;
    h += `<div class="shop-sec"><h4>呪符・詠み札</h4><div class="wares">${s.items.map((w, i) => w.kind === "fu"
      ? ware("items", i, Art.fu(w.id), FU[w.id].name, w.cost, "", w.sold)
      : ware("items", i, Art.yomi(w.id), `${YAKU[w.id].name}の歌`, w.cost, `${YAKU[w.id].name} ${run.levels[w.id] || 1}→${(run.levels[w.id] || 1) + 1}段`, w.sold)).join("")}</div></div>`;
    h += `<div class="shop-sec"><h4>文箱</h4><div class="wares">${s.packs.map((w, i) => ware("packs", i, Art.pack(w.kind), PACKS[w.kind].name, w.cost, "", w.sold)).join("")}</div></div>`;
    if (s.jingi) {
      const j = JINGI.find((x) => x.id === s.jingi.id);
      h += `<div class="shop-sec"><h4>神器（この季節だけ）</h4><div class="wares">${ware("jingi", 0, Art.jingi(j.id), j.name, s.jingi.cost, j.text, s.jingi.sold)}</div></div>`;
    }
    body.innerHTML = h;
    $$(".ware", body).forEach((w) => w.onclick = () => showWare(w.dataset.k, +w.dataset.i));
    $("#n-reroll").textContent = `${Run.rerollCost(run)}銭`;
    $("#btn-reroll").classList.toggle("off", run.zeni < Run.rerollCost(run));
    BGM.setTrack("pack");
    if (Profile.tip("shop")) {
      setTimeout(() => modal(`<div class="det"><div class="big-pt" style="border-radius:50%">${Art.portrait("bakedanuki")}</div><div><h3>夜市へようこそ</h3>
        <p style="font-size:13px">狸のぽん太と申します。祓いで稼いだ銭で、旅の支度をどうぞ。</p></div></div>
        <div class="howto"><ul>
        <li><b>式神</b>：連れて歩く仲間。文や倍を増やす（5体まで・左から順に働く）</li>
        <li><b>呪符</b>：祓いの最中に、選んだ手札を作り替える</li>
        <li><b>詠み札</b>：百人一首の歌。役の段位が上がり、文と倍が増える</li>
        <li><b>文箱</b>：中から一つ選べる福袋</li>
        <li><b>神器</b>：季節にひとつ。五つそろえば「五神器顕現」</li></ul>
        <p style="font-size:12.5px">銭は手元に5枚ごとに利子が1枚つきます。</p></div>
        <div class="mrow"><button class="btn gold" data-close>わかった</button></div>`), 200);
    }
  }

  function showWare(kind, i) {
    const s = run.shop;
    const w = kind === "jingi" ? s.jingi : s[kind][i];
    if (!w || w.sold) return;
    let head = "", body = "";
    if (kind === "shiki") {
      const d = SHIKI_BY_ID[w.id];
      Profile.seeShiki(w.id);
      head = `<div class="det"><div class="big-pt">${Art.portrait(d.id)}</div><div><span class="rar" style="background:${RAR[d.rar].color}">${RAR[d.rar].name}</span>
        <h3>${esc(d.name)}</h3><div class="effect">${esc(d.text.replace("{n}", 0).replace("{x}", "1.0"))}</div>
        ${d.bond ? `<p style="font-size:12px;color:#7a4a10">🤝 絆: ${esc(bondName(d.bond))}</p>` : ""}</div></div><p class="lore" style="margin-top:8px;font-size:13px;color:#5c4d33">${esc(d.lore)}</p>`;
    } else if (kind === "items" && w.kind === "fu") {
      const f = FU[w.id];
      head = `<div class="det"><div style="flex:none">${Art.fu(w.id).replace('class="fu-card', 'style="width:60px;height:96px" class="fu-card')}</div><div><h3>${esc(f.name)}</h3><div class="effect">${esc(f.text)}</div>
        <p style="font-size:12px;color:#7a6a4a">買うと呪符の枠に入ります（最大${Run.passives(run).fuSlots}枚）。</p></div></div>`;
    } else if (kind === "items") {
      const Y = YAKU[w.id], lv = run.levels[w.id] || 1, y = YOMI[w.id];
      const a = Score.yakuValue(run, w.id), b = { bun: a.bun + Y.lv[0], bai: a.bai + Y.lv[1] };
      head = `<h3>詠み札「${esc(Y.name)}」</h3><p style="font-size:15px;line-height:1.9;margin:6px 0 2px">${esc(y.uta)}</p><p style="font-size:12px;color:#7a6a4a;text-align:right">— ${esc(y.poet)}</p>
        <p style="margin-top:8px">${esc(Y.name)}（${esc(Y.desc)}）が <b>${lv}段→${lv + 1}段</b><br>
        <span class="kbd-bun">文 ${a.bun}→${b.bun}</span> ／ <span class="kbd-bai">倍 ${a.bai}→${b.bai}</span></p>`;
    } else if (kind === "packs") {
      const P = PACKS[w.kind];
      head = `<div class="det"><div style="flex:none;width:96px">${Art.pack(w.kind)}</div><div><h3>${esc(P.name)}</h3><div class="effect">${esc(P.text)}</div></div></div>`;
    } else if (kind === "jingi") {
      const j = JINGI.find((x) => x.id === w.id);
      head = `<div class="det"><div style="flex:none;width:80px">${Art.jingi(j.id)}</div><div><h3>${esc(j.name)}</h3><div class="effect">${esc(j.text)}</div>
        <p style="font-size:12px;color:#7a6a4a">神器はこの季節（三か月）のあいだ市に並びます。<b>五つすべて集めると「五神器顕現」</b>——以後すべての打ちで 倍×${JINGI_ALL_BONUS}。（いま ${run.jingi.length}/5）</p></div></div>`;
    }
    let block = w.cost > run.zeni ? "銭が足りない" : "";
    if (!block && kind === "shiki" && Run.slotsFree(run) <= 0) block = "式神の枠がいっぱい";
    if (!block && kind === "items" && w.kind === "fu" && run.fu.length >= Run.passives(run).fuSlots) block = "呪符の枠がいっぱい";
    const hintFull = block === "式神の枠がいっぱい" ? `<p style="font-size:12px;color:#7a4a10;margin-top:6px">上の式神をタップすると手放せます。</p>` : "";
    const c = modal(head + body + hintFull + `<div class="mrow"><button class="btn gold" data-buy ${block ? "disabled" : ""}>${block || "買う"}（${w.cost}銭）</button><button class="btn" data-close>やめる</button></div>`);
    $("[data-buy]", c).onclick = () => {
      const res = Run.buy(run, kind, i);
      if (res.error) { SFX.error(); toast(res.error, true); return; }
      SFX.buy();
      closeModal();
      if (kind === "shiki") { Profile.seeShiki(w.id); setTimeout(() => talk("join", run.shiki.length - 1), 250); }
      if (res.jingi) {
        const j = JINGI.find((x) => x.id === res.jingi);
        toast(`${j.name}を台座に嵌めた`);
        if (res.all) setTimeout(() => showGoshinki(), 300);
      }
      if (kind === "items" && w.kind === "yomi") toast(`${YAKU[w.id].name}が ${run.levels[w.id]}段 になった`);
      save();
      if (res.pack) { renderShop(); showPack(); return; }
      renderShop();
    };
  }

  function showGoshinki() {
    SFX.clear();
    modal(`<div style="text-align:center"><h3 style="font-size:24px;color:#7a1a10">五神器顕現</h3>
      <div style="display:flex;justify-content:center;gap:4px;margin:10px 0">${JINGI.map((j) => `<div style="width:52px">${Art.jingi(j.id)}</div>`).join("")}</div>
      <p>剣・鏡・勾玉・宝珠・鈴。五つの神器が台座に並び、札が金色に脈打つ。</p>
      <p style="margin-top:6px"><b>以後すべての打ちで 倍×${JINGI_ALL_BONUS}</b></p>
      <div class="mrow"><button class="btn gold" data-close>ありがたく</button></div></div>`);
  }

  // ---------- 文箱 ----------
  let packSel = [];
  function showPack() {
    const pk = run.pack;
    if (!pk) return;
    SFX.open();
    packSel = [];
    const P = PACKS[pk.kind];
    const choiceHtml = (ch, i) => {
      if (ch === null) return `<div class="pack-choice" style="opacity:.2"></div>`;
      if (pk.kind === "fuda") {
        const extra = [ch.enh ? ENH[ch.enh].name : "", ch.seal ? SEAL[ch.seal].name : ""].filter(Boolean).join("・");
        return `<div class="pack-choice" data-c="${i}">${Art.card({ ...ch, uid: "p" + i })}<div class="pdesc">${esc(cardName(ch))}${extra ? "<br><b>" + esc(extra) + "</b>" : ""}</div></div>`;
      }
      if (pk.kind === "yomi") return `<div class="pack-choice" data-c="${i}">${Art.yomi(ch)}<div class="pdesc">${esc(YAKU[ch].name)} ${run.levels[ch] || 1}→${(run.levels[ch] || 1) + 1}段</div></div>`;
      if (pk.kind === "jufu") return `<div class="pack-choice" data-c="${i}">${Art.fu(ch)}<div class="pdesc">${esc(FU[ch].text)}</div></div>`;
      if (pk.kind === "shiki") { const d = SHIKI_BY_ID[ch]; Profile.seeShiki(ch); return `<div class="pack-choice" data-c="${i}">${shikiHtml({ id: ch, data: d.init || {} }, -1)}<div class="pdesc"><b>${esc(d.name)}</b><br>${esc(d.text.replace("{n}", 0).replace("{x}", "1.0"))}</div></div>`; }
      return "";
    };
    const sample = pk.kind === "jufu" ? `<p style="font-size:12px;color:#5c4d33">札に使う呪符は、下の札（山札から5枚）を選んでから呪符をタップするとすぐ使えます。札を選ばずにタップすると持ち帰り。</p>
      <div class="pack-sample">${pk.sample.map((u) => Run.card(run, u)).filter(Boolean).map((c) => Art.card(c)).join("")}</div>` : "";
    const c = modal(`<h3>${esc(P.name)}</h3><p style="font-size:12.5px;color:#5c4d33">${pk.picks}つ選べます</p>
      <div class="pack-view">${sample}<div class="pack-choices">${pk.choices.map(choiceHtml).join("")}</div></div>
      <div class="mrow"><button class="btn" data-skip>選ばずに閉じる</button></div>`, { noClose: true });
    $$(".pack-sample .card", c).forEach((ce) => ce.onclick = () => {
      const u = +ce.dataset.uid;
      const k = packSel.indexOf(u);
      if (k >= 0) { packSel.splice(k, 1); ce.classList.remove("sel"); } else { packSel.push(u); ce.classList.add("sel"); }
      SFX.select();
    });
    $$(".pack-choice[data-c]", c).forEach((pc) => pc.onclick = () => {
      const i = +pc.dataset.c;
      const chosen = pk.choices[i];
      const res = Run.pickPack(run, i, packSel.slice());
      if (res.error) { SFX.error(); toast(res.error, true); return; }
      SFX.buy();
      if (res.level) toast(`${YAKU[res.key].name}が ${res.level}段 になった`);
      if (res.card) toast(`${cardName(res.card)}を山札に加えた`);
      if (res.used) {
        toast(`${FU[chosen].name}を使った${res.zeni ? `（+${res.zeni}銭）` : ""}${res.shiki ? `：${SHIKI_BY_ID[res.shiki].name}が来た！` : ""}`);
        if (res.shiki) Profile.seeShiki(res.shiki);
      }
      if (res.kept) toast("呪符を持ち帰った");
      save();
      const joined = pk.kind === "shiki" || (res.used && res.shiki);
      if (!run.pack) { closeModal(); renderShop(); } else showPack();
      if (joined) setTimeout(() => talk("join", run.shiki.length - 1), 250);
    });
    $("[data-skip]", c).onclick = () => { Run.closePack(run); save(); closeModal(); renderShop(); };
  }

  // ============================================================
  //  一覧・説明
  // ============================================================
  function showYakuList() {
    const cats = [["month", "月の役（いちばん高いもの1つ）"], ["sorou", "揃い（5枚すべて同じ種類）"], ["deki", "出来役（成立したものはすべて重なる）"]];
    const ex = {
      awase: [[1, "hikari", "tsuru"], [1, "kasu"]], futaawase: [[1, "hikari", "tsuru"], [1, "kasu"], [8, "tane", "kari"], [8, "kasu"]],
      sanbon: [[3, "hikari", "maku"], [3, "tan", "akatan"], [3, "kasu"]], nagare: [[4, "kasu"], [5, "kasu"], [6, "kasu"], [7, "kasu"], [8, "kasu"]],
      oyako: [[9, "tane", "sakazuki"], [9, "tan", "aotan"], [9, "kasu"], [2, "kasu"], [2, "tane", "uguisu"]],
      teshi: [[11, "hikari", "ame"], [11, "tane", "tsubame"], [11, "tan", "tan"], [11, "kasu", "kaminari"]],
      kasuzoroi: [[1, "kasu"], [3, "kasu"], [5, "kasu"], [7, "kasu"], [12, "kasu"]],
      tanzoroi: [[1, "tan", "akatan"], [4, "tan", "tan"], [6, "tan", "aotan"], [7, "tan", "tan"], [11, "tan", "tan"]],
      tanezoroi: [[2, "tane", "uguisu"], [4, "tane", "hototogisu"], [5, "tane", "yatsuhashi"], [7, "tane", "inoshishi"], [10, "tane", "shika"]],
      hanami: [[3, "hikari", "maku"], [9, "tane", "sakazuki"]], tsukimi: [[8, "hikari", "tsuki"], [9, "tane", "sakazuki"]],
      sugawara: [[1, "hikari", "tsuru"], [2, "tane", "uguisu"], [3, "hikari", "maku"]],
      akatan: [[1, "tan", "akatan"], [2, "tan", "akatan"], [3, "tan", "akatan"]], aotan: [[6, "tan", "aotan"], [9, "tan", "aotan"], [10, "tan", "aotan"]],
      inoshikacho: [[7, "tane", "inoshishi"], [10, "tane", "shika"], [6, "tane", "chou"]],
      sankou: [[1, "hikari", "tsuru"], [3, "hikari", "maku"], [8, "hikari", "tsuki"]],
      ameshikou: [[1, "hikari", "tsuru"], [3, "hikari", "maku"], [8, "hikari", "tsuki"], [11, "hikari", "ame"]],
      shikou: [[1, "hikari", "tsuru"], [3, "hikari", "maku"], [8, "hikari", "tsuki"], [12, "hikari", "houou"]],
      gokou: [[1, "hikari", "tsuru"], [3, "hikari", "maku"], [8, "hikari", "tsuki"], [11, "hikari", "ame"], [12, "hikari", "houou"]],
      sufuda: [[12, "hikari", "houou"]],
    };
    let h = `<h3>役と歌</h3><p style="font-size:12.5px;color:#5c4d33">打った札の中で成立した役は<b>すべて重なり</b>、文と倍が足し算されます。霊力＝文×倍。<br>札の文：光20・種10・短冊5・カス1。旬（その月の札）は倍+2。</p>`;
    for (const [cat, title] of cats) {
      h += `<div class="cat-h" style="color:#7a1a10">${title}</div><div class="yaku-list">`;
      for (const k of YAKU_ORDER) {
        const Y = YAKU[k];
        if (Y.cat !== cat) continue;
        if (Y.hidden && !(run && run.stats.yaku[k]) && !Profile.data.seenYaku[k]) continue;
        const v = run ? Score.yakuValue(run, k) : { bun: Y.bun, bai: Y.bai, lvl: 1 };
        const cards = (ex[k] || []).map(([m, t, sp]) => Art.card({ m, t, sp, v: 0, uid: "" }, { noIdx: true })).join("");
        h += `<div class="yaku-row" style="background:#fff8;border-color:#a8946a;color:#1d1a17"><div class="yr-h"><span class="yr-name">${esc(Y.name)}</span>
          <span class="yr-val"><span class="kbd-bun">${v.bun}</span> × <span class="kbd-bai">${v.bai}</span></span>${v.lvl > 1 ? `<span class="yr-lv" style="color:#7a1a10">${v.lvl}段</span>` : ""}</div>
          <div class="yr-desc" style="color:#5c4d33">${esc(Y.desc)}</div><div class="yr-cards">${cards}</div></div>`;
      }
      h += `</div>`;
    }
    modal(h);
  }

  function showDeck() {
    const inHand = run.round ? new Set(run.round.hand) : new Set();
    const inDraw = run.round ? new Set(run.round.draw) : null;
    const cards = run.deck.slice().sort((a, b) => a.m - b.m || TYPES[b.t].rank - TYPES[a.t].rank);
    const cnt = { hikari: 0, tane: 0, tan: 0, kasu: 0 };
    for (const c of run.deck) cnt[c.t]++;
    const left = inDraw ? run.deck.filter((c) => inDraw.has(c.uid)) : run.deck;
    modal(`<h3>山札 ${run.deck.length}枚</h3>
      <p class="deck-sum">光${cnt.hikari}・種${cnt.tane}・短冊${cnt.tan}・カス${cnt.kasu}${inDraw ? `　／　残り山 ${left.length}枚（薄い札は手札か使用済み）` : ""}</p>
      <div class="deck-grid">${cards.map((c) => Art.card(c).replace('class="card', `class="card ${inDraw && !inDraw.has(c.uid) ? "used" : ""}`)).join("")}</div>`);
  }

  function showHowto() {
    const ex = (arr) => `<div class="ex">${arr.map(([m, t, sp]) => Art.card({ m, t, sp, v: 0, uid: "" })).join("")}</div>`;
    modal(`<div class="howto"><h3>遊び方</h3>
      <p>一年十二か月、月ごとに現れる妖を<b>花札の役</b>で祓います。師走の「百鬼夜行の主」を祓えば一年の結び。</p>
      <h4>一、札を打つ</h4>
      <p>手札から<b>1〜5枚</b>選んで「打つ」。打った札で役ができると<b>霊力＝<span class="kbd-bun">文</span>×<span class="kbd-bai">倍</span></b>が入ります。
      祓いの目標に届けば成功。打ちは4回、札を捨てて引き直す「流す」は3回まで。</p>
      <h4>二、役は重なる</h4>
      <p>同じ月2枚で「合わせ」、3枚で「三本」、5か月続きで「月流れ」。5枚同じ種類で「揃い」。
      花見酒・猪鹿蝶・三光などの<b>出来役</b>は、成立したものが<b>全部いっしょに</b>数えられます。</p>
      ${ex([[3, "hikari", "maku"], [9, "tane", "sakazuki"], [8, "hikari", "tsuki"], [8, "kasu"]])}
      <p style="font-size:12.5px">↑ 花見酒＋月見酒＋合わせ（芒）が一度に成立！</p>
      <h4>三、札の文と旬</h4>
      <p>光20・種10・短冊5・カス1。その月の札は<b>旬</b>で、役に加わると倍+2。札の右下に種類、左上に月が書いてあります。</p>
      <h4>四、夜市と式神</h4>
      <p>祓いのあとは化け狸の夜市。<b>式神</b>は5体まで連れて行け、それぞれの力で文や倍を増やします（左から順に発動）。
      <b>呪符</b>で札を作り替え、<b>詠み札</b>（百人一首）で役を磨き、季節ごとの<b>神器</b>を五つ集めれば「五神器顕現」。</p>
      <h4>五、妖の癖</h4>
      <p>妖はそれぞれ意地悪な癖を持ちます。3・6・9月は季節の大妖、12月は百鬼夜行の主。絵巻の地図で先の妖を確かめて備えましょう。</p>
      <h4>こつ</h4>
      <ul><li>最初は「合わせ」「二つ合わせ」「三本」で十分。式神で倍を伸ばす</li>
      <li>「倍＋」の式神を左、「倍×」の式神を右に置くと伸びる</li>
      <li>銭を5枚ごとに利子。無駄遣いを控える月もあり</li>
      <li>札を長押しすると説明が出ます</li></ul></div>`);
  }

  function showSettings() {
    const sp = Profile.data.speed || 1;
    const c = modal(`<h3>設定</h3>
      <div class="set-row"><span>演出の速さ</span><div class="seg">${[1, 2, 3].map((v) => `<button class="btn ${sp === v ? "on" : ""}" data-sp="${v}">${["", "ふつう", "はやい", "とても"][v]}</button>`).join("")}</div></div>
      <div class="set-row"><span>BGM</span><button class="btn" data-bgm>${BGM.enabled ? "ON" : "OFF"}</button></div>
      <div class="set-row"><span>効果音</span><button class="btn" data-sfx>${SFX.enabled ? "ON" : "OFF"}</button></div>
      <div class="set-row"><span>記録を消す</span><button class="btn shu" data-reset>消す</button></div>
      <p style="font-size:11px;color:#7a6a4a;margin-top:10px">遊んだ記録はこの端末のブラウザに保存されます。</p>`);
    $$("[data-sp]", c).forEach((b) => b.onclick = () => { Profile.setSpeed(+b.dataset.sp); showSettings(); });
    $("[data-bgm]", c).onclick = () => { BGM.toggle(); showSettings(); };
    $("[data-sfx]", c).onclick = () => { SFX.toggle(); showSettings(); };
    $("[data-reset]", c).onclick = () => {
      const cc = modal(`<h3>記録を消しますか？</h3><p>図鑑・解放・続きのデータがすべて消えます。</p><div class="mrow"><button class="btn shu" data-yes>消す</button><button class="btn" data-close>やめる</button></div>`);
      $("[data-yes]", cc).onclick = () => { Profile.reset(); Run.clearSave(); closeModal(); location.reload(); };
    };
  }

  // ============================================================
  //  タイトル・陰陽師えらび・終わり・図鑑
  // ============================================================
  function renderTitle(hasSave) {
    show("title");
    $("#btn-continue").classList.toggle("hidden", !hasSave);
    // 百鬼夜行の行列
    const ids = ["y_nurarihyon", "kappa", "y_hitotsume", "karakasa", "chochin", "y_tsuchigumo", "kitsunebi", "y_mikoshi", "nekomata", "y_tamamo", "ittan", "kooni", "y_gashadokuro", "tengu", "y_orochi", "bakedanuki"];
    const seq = ids.map((id, i) => `<div class="pm">${Art.portrait(id)}</div>${i % 3 === 1 ? '<div class="lantern"></div>' : ""}`).join("");
    $("#parade").innerHTML = `<div class="parade-track">${seq}${seq}</div>`;
    BGM.setTrack("title");
  }

  let pickRank = 0;
  function renderSelect(onPick) {
    show("select");
    const list = $("#om-list");
    const u = Profile.data.unlocked;
    const maxR = Profile.data.maxRank || 0;
    pickRank = Math.min(pickRank, maxR);
    const rankRow = maxR > 0 ? `<div class="rank-box"><div class="rank-h">位階（難しさ）</div><div class="rank-row">${RANKS.slice(0, maxR + 1).map((r, i) =>
      `<button class="btn rank ${i === pickRank ? "on" : ""}" data-r="${i}">${esc(r.name)}</button>`).join("")}</div>
      <div class="rank-desc">${RANKS.slice(1, pickRank + 1).map((r) => "・" + esc(r.text)).join("<br>") || "ふつうの一年"}</div></div>` : "";
    list.innerHTML = rankRow + ONMYOJI.map((o) => `<div class="om ${u[o.id] ? "" : "locked"}" data-o="${o.id}">
      <div class="opt">${Art.portrait(o.portrait)}</div>
      <div><div class="ot">${esc(o.title)}</div><h4>${u[o.id] ? esc(o.name) : "？？？"}</h4>
      <p>${u[o.id] ? esc(o.text) : "一年を結ぶと解放"}</p>${u[o.id] ? `<p style="font-size:12px;color:#7a4a10">「${esc(o.line)}」</p>` : ""}</div></div>`).join("");
    $$(".om", list).forEach((e) => e.onclick = () => { if (u[e.dataset.o]) onPick(e.dataset.o, pickRank); else { SFX.error(); toast("一年を結ぶと解放されます"); } });
    $$("[data-r]", list).forEach((b) => b.onclick = () => { pickRank = +b.dataset.r; SFX.select(); renderSelect(onPick); });
  }

  function renderEnd(cleared, newly) {
    show("end");
    const body = $("#end-body");
    const reached = cleared ? 12 : run.month - (run.phase === "over" ? 0 : 0);
    const y = run.round ? YOKAI[run.round.yokai] : null;
    const topYaku = Object.entries(run.stats.yaku).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${YAKU[k].name}×${n}`).join("・") || "—";
    const best = run.stats.bestYaku ? run.stats.bestYaku.map((k) => YAKU[k].name).join("＋") : "";
    const lines = cleared ? STORY.ending : [
      `${MONTHS[run.month].wa}。${y ? y.name : "妖"}の前に、札が尽きた。`,
      y && y.win ? `「${y.win}」` : "「ひっひっ、また来年だねえ」",
      "式神たちが、ちぎれた紙の袖を引く。まだ、終わりじゃない。",
    ];
    body.innerHTML = `
      <div class="end-title ${cleared ? "" : "lose"}">${cleared ? "一年の結び" : "一年の終わり"}</div>
      <div class="end-lines">${lines.map((l, i) => `<p style="animation-delay:${i * 0.5}s">${esc(l)}</p>`).join("")}</div>
      ${run.shiki.length ? `<div class="end-team">${run.shiki.map((s) => `<div class="et"><div class="et-pt">${Art.portrait(s.id)}</div><div class="et-n">${esc(SHIKI_BY_ID[s.id].name)}</div></div>`).join("")}</div>` : ""}
      <div class="end-stats">
        <div><span>たどり着いた月</span><b>${run.year > 1 ? run.year + "年目 " : ""}${MONTHS[Math.min(12, run.month)].wa}</b></div>
        <div><span>一打の最高</span><b>${fmt(run.stats.best)}</b></div>
        ${best ? `<div><span>その役</span><b style="font-size:12px">${esc(best)}</b></div>` : ""}
        <div><span>よく打った役</span><b style="font-size:12px">${esc(topYaku)}</b></div>
        <div><span>連れていた式神</span><b style="font-size:12px">${esc(run.shiki.map((s) => SHIKI_BY_ID[s.id].name).join("・") || "—")}</b></div>
        <div><span>神器</span><b>${run.jingi.length}/5</b></div>
      </div>
      ${newly && newly.length ? `<div class="end-stats" style="text-align:center;color:var(--gold)">新たな陰陽師が解放された：${newly.map((id) => ONMYOJI.find((o) => o.id === id).name).join("・")}</div>` : ""}
      ${cleared && Profile.data.newRank ? `<div class="end-stats" style="text-align:center;color:var(--gold)">位階が上がった：<b>${RANKS[Profile.data.newRank].name}</b><br><span style="font-size:12px;color:#f2b8a8">${esc(RANKS[Profile.data.newRank].text)}</span></div>` : ""}
      <div class="end-actions">
        ${cleared ? `<button class="btn big gold" data-a="endless">二年目へ（無限の絵巻）</button>` : ""}
        <button class="btn big ${cleared ? "" : "shu"}" data-a="again">もう一度、一年を</button>
        <button class="btn" data-a="title">タイトルへ</button>
      </div>`;
    if (Profile.data.newRank) { Profile.data.newRank = 0; Profile.save(); }
    $$("[data-a]", body).forEach((b) => b.onclick = () => {
      const a = b.dataset.a;
      if (a === "again") Main.newGame();
      if (a === "title") Main.toTitle();
      if (a === "endless") Main.endless();
    });
    BGM.setTrack(cleared ? "win" : "lose");
  }

  function renderBook(tab = "shiki") {
    show("book");
    $$("#book-tabs .tab").forEach((t) => { t.classList.toggle("on", t.dataset.tab === tab); t.onclick = () => renderBook(t.dataset.tab); });
    const body = $("#book-body");
    const P = Profile.data;
    if (tab === "shiki") {
      const seen = SHIKI.filter((s) => P.seenShiki[s.id]).length;
      body.innerHTML = `<p class="dim" style="font-size:12px;margin-bottom:8px">出会った式神 ${seen}/${SHIKI.length}</p><div class="book-grid">${SHIKI.map((s) => {
        const known = P.seenShiki[s.id];
        return `<div data-s="${s.id}">${known ? `<div class="shiki r${s.rar}"><div class="pt">${Art.portrait(s.id)}</div><div class="sn">${esc(s.name)}</div></div>` : `<div class="shiki r${s.rar}"><div class="pt unknown">${Art.portrait(s.id)}</div><div class="sn">？？？</div></div>`}</div>`;
      }).join("")}</div>`;
      $$("[data-s]", body).forEach((e) => e.onclick = () => {
        const s = SHIKI_BY_ID[e.dataset.s];
        if (!P.seenShiki[s.id]) { toast("まだ出会っていない"); return; }
        modal(`<div class="det"><div class="big-pt">${Art.portrait(s.id)}</div><div><span class="rar" style="background:${RAR[s.rar].color}">${RAR[s.rar].name}</span><h3>${esc(s.name)} <span class="yomi-kana">${esc(s.yomi)}</span></h3>
          <div class="effect">${esc(s.text.replace("{n}", 0).replace("{x}", "1.0"))}</div></div></div><p class="lore" style="margin-top:8px;font-size:13px;color:#5c4d33">${esc(s.lore)}</p>`);
      });
    }
    if (tab === "yaku") {
      body.innerHTML = `<div class="yaku-list">${YAKU_ORDER.filter((k) => !YAKU[k].hidden || P.seenYaku[k]).map((k) => {
        const Y = YAKU[k], y = YOMI[k];
        return `<div class="yaku-row"><div class="yr-h"><span class="yr-name">${esc(Y.name)}</span><span class="yr-val"><span class="b1">${Y.bun}</span> × <span class="b2">${Y.bai}</span></span>
          <span class="yr-lv">${P.seenYaku[k] ? `${P.seenYaku[k]}回` : "未"}</span></div><div class="yr-desc">${esc(Y.desc)}</div>
          <div class="yr-uta">${esc(y.uta)}　— ${esc(y.poet)}</div></div>`;
      }).join("")}</div>`;
    }
    if (tab === "yokai") {
      const all = Object.entries(YOKAI).filter(([, v]) => v);
      body.innerHTML = `<div class="book-grid" style="grid-template-columns:repeat(auto-fill,minmax(78px,1fr))">${all.map(([id, y]) => {
        const met = P.metYokai[id];
        return `<div data-y="${id}" style="text-align:center"><div style="width:66px;height:66px;margin:0 auto;border-radius:50%;overflow:hidden;background:#f3e9d2;border:2px solid #1d1a17" class="${met ? "" : "unknown"}">${Art.portrait(y.portrait)}</div>
          <div class="bname">${met ? esc(y.name) : "？？？"}${P.beatYokai[id] ? " 祓" : ""}</div></div>`;
      }).join("")}</div>`;
      $$("[data-y]", body).forEach((e) => e.onclick = () => {
        const y = YOKAI[e.dataset.y];
        if (!P.metYokai[e.dataset.y]) { toast("まだ出会っていない"); return; }
        modal(`<div class="det"><div class="big-pt" style="border-radius:50%">${Art.portrait(y.portrait)}</div><div><h3>${esc(y.name)}</h3>
          <div class="effect">${esc(y.qtext || "癖なし")}</div><p class="lore">「${esc(y.line)}」</p></div></div>`);
      });
    }
    if (tab === "fuda") {
      body.innerHTML = `<p class="dim" style="font-size:12px;margin-bottom:8px">花札四十八枚。月（植物）が12、種類が4（光・種・短冊・カス）。</p>
        <div class="deck-grid">${BASE_DECK.map((c, i) => Art.card({ ...c, uid: "b" + i })).join("")}</div>`;
      $$(".card", body).forEach((ce, i) => ce.onclick = () => {
        const c = BASE_DECK[i];
        modal(`<div class="det"><div style="flex:none;--cw:110px">${Art.card({ ...c, uid: "" })}</div><div><h3>${esc(cardName(c))}</h3>
          <p>${MONTHS[c.m].wa}（${KANSUJI[c.m]}月）</p><p>${TYPES[c.t].name}・文${TYPES[c.t].bun}</p></div></div>`);
      });
    }
  }

  // ---------- 保存 ----------
  function save() { if (run) Run.save(run); }

  // ---------- 操作の結線（1回だけ） ----------
  function bindStatic() {
    $("#btn-play").onclick = () => doPlay();
    $("#btn-discard").onclick = () => doDiscard();
    $("#btn-sort").onclick = () => { sortMode = sortMode === "month" ? "type" : "month"; renderHand(false); updateButtons(); SFX.page(); };
    $("#btn-deck").onclick = () => showDeck();
    $("#btn-reroll").onclick = () => {
      const res = Run.reroll(run);
      if (res.error) { SFX.error(); toast(res.error, true); return; }
      SFX.page(); save(); renderShop();
    };
    $("#btn-leave").onclick = () => Main.leaveShop();
    // 採点中にタップで早送り
    $("#field").addEventListener("click", () => { if (busy) skip = true; });
    $$("[data-back]").forEach((b) => b.onclick = () => Main.toTitle());
    window.addEventListener("resize", () => { if (run && run.phase === "round" && !busy) renderHand(false); });
  }

  return {
    bindStatic, show, toast, modal, closeModal, talk, renderTitle, renderSelect, renderEmaki, renderRound, renderShop, renderEnd, renderBook,
    showCashout, showPack, showSeason, showHowto, showSettings, showYakuList, showDeck,
    setRun(r) { run = r; sel = []; armedFu = null; busy = false; },
    get run() { return run; },
    get busy() { return busy; },
  };
})();
