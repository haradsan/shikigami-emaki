// ============================================================
// weekly.js — 週替わりの神事（週替わりの特殊ルール戦）
// 毎週月曜0時に切り替わる特殊ルールを1つ選び、ONのとき正規対戦・2人対戦に適用する
// （稽古には適用しない）。ONで正規対戦・⚔三つ巴に勝つとボーナスカード+2枚（v22で三つ巴も対象に）。
// newGame（state.js）が activeWeeklyRule() を参照して RULES を上書きする。
// ============================================================
"use strict";

const WEEKLY_KEY = "shiki-emaki-weekly"; // ON/OFF はプレイヤー共通
const WEEKLY_BONUS_CARDS = 2; // ONで正規対戦に勝ったときの追加報酬

// apply(r): DEFAULT_RULES＋ステージrules 適用後の RULES をさらに上書きする。
// hook: RULESでは表現できない特殊処理の目印（newGame が個別に対応）。
const WEEKLY_RULES = [
  { id: "toll2",    icon: "💰", name: "商いの週", desc: "すべての通行料が2倍！ 連鎖の破壊力が倍増する", apply: r => { r.tollRate *= 2; } },
  { id: "legend",   icon: "🏆", name: "豪傑の週", desc: "両者の初期手札に極（レジェンド）1枚を保証（無ければ1枚と入れ替え）", hook: "legendHand" },
  { id: "magic2",   icon: "💎", name: "豊穣の週", desc: "霊力マスの獲得霊力が2倍", apply: r => { r.magicTileG *= 2; } },
  { id: "fastdice", icon: "🎲", name: "韋駄天の週", desc: "賽の出目は4〜6のみ（両者とも高速移動）", apply: r => { r.minDice = 4; } },
  { id: "lap2",     icon: "🏯", name: "巡礼の週", desc: "周回ボーナスの基本値が2倍", apply: r => { r.lapBase *= 2; } },
  { id: "rich",     icon: "👑", name: "千両の週", desc: "両者の初期霊力+300G（速攻で高額カードが飛び交う）", apply: r => { r.startMagic += 300; } },
  { id: "gate3",    icon: "⛩️", name: "鳥居の週", desc: "鳥居をくぐったときのボーナスが3倍", apply: r => { r.gateBonus *= 3; } },
];

// 今週のルール。1970-01-01(木)基準の通算日から-4日して「月曜区切りの週番号」を作る
function currentWeeklyRule() {
  const days = Math.floor(Date.now() / 86400000);
  const week = Math.floor((days - 4) / 7);
  const n = WEEKLY_RULES.length;
  return WEEKLY_RULES[((week % n) + n) % n];
}

function weeklyEnabled() {
  try { return localStorage.getItem(WEEKLY_KEY) === "1"; } catch (e) { return false; }
}
function setWeeklyEnabled(on) {
  try { localStorage.setItem(WEEKLY_KEY, on ? "1" : "0"); } catch (e) { /* 無視 */ }
}
// 対戦に適用するルール（OFFなら null）。newGame（state.js）が参照する
function activeWeeklyRule() { return weeklyEnabled() ? currentWeeklyRule() : null; }

// タイトル画面の「🎪 週替り」ダイアログ（今週のルール説明＋ON/OFF切替）
async function showWeeklyDialog() {
  const rule = currentWeeklyRule();
  const on = weeklyEnabled();
  const res = await showDialog({
    title: "🎪 週替わりの神事",
    body: `毎週月曜に切り替わる<b>週替わりの特殊ルール</b>で、クリア済みステージも新鮮に遊べます。<br><br>` +
      `今週のルール: <b>${rule.icon} ${esc(rule.name)}</b><br>${esc(rule.desc)}<br><br>` +
      `・ONのとき<b>正規対戦・⚔三つ巴・🎮2人対戦</b>に適用されます（🎯稽古には適用されません）<br>` +
      `・ONで<b>正規対戦・⚔三つ巴</b>に勝つと<b>ボーナスカード+${WEEKLY_BONUS_CARDS}枚</b>！<br><br>` +
      `現在: <b>${on ? "🎪 ON（適用中）" : "OFF"}</b>`,
    buttons: [
      { label: on ? "OFFにする" : "🎪 ONにする", value: "toggle", primary: true },
      { label: "閉じる", value: "close" },
    ],
  });
  if (res.action === "toggle") setWeeklyEnabled(!on);
}
