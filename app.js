function $(id) { return document.getElementById(id); }

// ===== storage keys =====
const KEY_PRESETS = "presets_v1";
const KEY_SESSION = "current_session_v1";
const KEY_SWAPS = "swap_history_v1";
const KEY_LOGS = "logs";

// ===== state =====
let presets = [];
let currentSession = null; // {date, presetId, workout, exercises:[{name,min,max}], overrides:[]}
let swapHistory = [];      // [{from,to}]
let logs = [];
let chart = null;
let lastAdded = null;

// ===== utils =====
function uid() { return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now(); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function loadAll() {
  // presets
  try { presets = JSON.parse(localStorage.getItem(KEY_PRESETS) || "[]"); } catch { presets = []; }
  // session
  try { currentSession = JSON.parse(localStorage.getItem(KEY_SESSION) || "null"); } catch { currentSession = null; }
  // swaps
  try { swapHistory = JSON.parse(localStorage.getItem(KEY_SWAPS) || "[]"); } catch { swapHistory = []; }
  // logs
  try { logs = JSON.parse(localStorage.getItem(KEY_LOGS) || "[]"); } catch { logs = []; }

  // 初回だけ：デフォルトプリセット作成
  if (!Array.isArray(presets) || presets.length === 0) {
    presets = makeDefaultPresets();
    savePresets();
  }
}

function savePresets() { localStorage.setItem(KEY_PRESETS, JSON.stringify(presets)); }
function saveSession() { localStorage.setItem(KEY_SESSION, JSON.stringify(currentSession)); }
function saveSwaps() { localStorage.setItem(KEY_SWAPS, JSON.stringify(swapHistory)); }
function saveLogs() { localStorage.setItem(KEY_LOGS, JSON.stringify(logs)); }

function setFeedback(text) {
  const box = $("feedback");
  if (!box) return;
  box.textContent = text || "";
}

// ===== default presets =====
function makeDefaultPresets() {
  return [
    {
      id: uid(),
      name: "PUSH 基本",
      workout: "PUSH",
      exercises: [
        { name: "ベンチプレス", min: 6, max: 8 },
        { name: "スミス・インクラインプレス（20〜30°）", min: 8, max: 10 },
        { name: "スミス・オーバーヘッドプレス", min: 6, max: 8 },
        { name: "サイドレイズ", min: 12, max: 15 },
        { name: "オーバーヘッドトライセプスEX", min: 10, max: 12 },
      ],
    },
    {
      id: uid(),
      name: "PULL 基本",
      workout: "PULL",
      exercises: [
        { name: "チンニング（順手 or パラレル）", min: 6, max: 10 },
        { name: "チェストサポート・ダンベルロー", min: 8, max: 10 },
        { name: "デッドリフト", min: 5, max: 6 },
        { name: "インクラインダンベルカール", min: 8, max: 10 },
      ],
    },
    {
      id: uid(),
      name: "LEGS 基本",
      workout: "LEGS",
      exercises: [
        { name: "バーベルスクワット", min: 6, max: 8 },
        { name: "レッグプレス", min: 10, max: 12 },
        { name: "ルーマニアンデッドリフト", min: 8, max: 10 },
        { name: "ライイングレッグカール", min: 10, max: 12 },
      ],
    },
  ];
}

// ===== presets UI =====
function renderPresetSelects() {
  const sel = $("presetSelect");
  const msel = $("managePresetSelect");
  if (!sel || !msel) return;

  sel.innerHTML = "";
  msel.innerHTML = "";

  presets.forEach(p => {
    const o1 = document.createElement("option");
    o1.value = p.id;
    o1.textContent = p.name;
    sel.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = p.id;
    o2.textContent = p.name;
    msel.appendChild(o2);
  });

  // 選択維持
  if (currentSession?.presetId && presets.some(p => p.id === currentSession.presetId)) {
    sel.value = currentSession.presetId;
    msel.value = currentSession.presetId;
  } else if (presets[0]) {
    sel.value = presets[0].id;
    msel.value = presets[0].id;
  }

  renderPresetEditor();
}

function getSelectedPresetId() { return $("managePresetSelect")?.value || null; }
function getPresetById(id) { return presets.find(p => p.id === id) || null; }

function renderPresetEditor() {
  const box = $("presetExercises");
  if (!box) return;

  const pid = getSelectedPresetId();
  const p = getPresetById(pid);

  if (!p) {
    box.innerHTML = "（プリセットなし）";
    return;
  }

  const rows = p.exercises.map((ex, idx) => {
    return `
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #333;">
        <div style="flex:1;min-width:0;">
          <div><strong>${ex.name}</strong></div>
          <div style="font-size:12px;opacity:.8;">${ex.min}-${ex.max}回</div>
        </div>
        <button type="button" data-up="${idx}">↑</button>
        <button type="button" data-down="${idx}">↓</button>
        <button type="button" data-del="${idx}">削除</button>
      </div>
    `;
  }).join("");

  box.innerHTML = rows || "（種目なし）";

  box.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-del"));
      if (!confirm("この種目を削除しますか？")) return;
      p.exercises.splice(idx, 1);
      savePresets();
      renderPresetEditor();
      // セッション中なら当日メニューにも反映したい場合は、次回開始で反映（思想：プリセットは次回から）
    });
  });

  box.querySelectorAll("button[data-up]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-up"));
      if (idx <= 0) return;
      const tmp = p.exercises[idx - 1];
      p.exercises[idx - 1] = p.exercises[idx];
      p.exercises[idx] = tmp;
      savePresets();
      renderPresetEditor();
    });
  });

  box.querySelectorAll("button[data-down]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-down"));
      if (idx >= p.exercises.length - 1) return;
      const tmp = p.exercises[idx + 1];
      p.exercises[idx + 1] = p.exercises[idx];
      p.exercises[idx] = tmp;
      savePresets();
      renderPresetEditor();
    });
  });
}

// ===== session =====
function startSession(presetId) {
  const p = getPresetById(presetId);
  if (!p) return;

  const date = $("date")?.value || todayStr();

  currentSession = {
    date,
    presetId: p.id,
    workout: p.workout,
    exercises: p.exercises.map(x => ({ ...x })), // 当日メニュー（コピー）
    overrides: [], // {from,to}
  };

  saveSession();
  renderSession();
  syncWorkoutAndExerciseSelects();
}

function renderSession() {
  const info = $("sessionInfo");
  const list = $("sessionExercises");
  if (!info || !list) return;

  if (!currentSession) {
    info.textContent = "まだ開始していません。プリセットを選んで開始してください。";
    list.innerHTML = "";
    return;
  }

  info.textContent = `今日(${currentSession.date})：${getPresetById(currentSession.presetId)?.name || ""} を開始中`;

  list.innerHTML = currentSession.exercises.map((ex, i) => {
    return `
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #333;">
        <div style="flex:1;min-width:0;">
          <div><strong>${ex.name}</strong></div>
          <div style="font-size:12px;opacity:.8;">${ex.min}-${ex.max}回</div>
        </div>
        <button type="button" data-swap="${i}">差替え</button>
      </div>
    `;
  }).join("");

  list.querySelectorAll("button[data-swap]").forEach(btn => {
    btn.addEventListener("click", () => openSwapModal(Number(btn.getAttribute("data-swap"))));
  });
}

// ===== swap modal =====
let swapIndex = null;

function allKnownExercises() {
  // プリセット全種目 + ログにある種目 + swap履歴
  const fromPresets = presets.flatMap(p => p.exercises.map(e => e.name));
  const fromLogs = logs.map(l => l.exercise);
  const fromSwaps = swapHistory.flatMap(s => [s.from, s.to]);
  const uniq = [...new Set([...fromPresets, ...fromLogs, ...fromSwaps].filter(Boolean))];
  return uniq.sort((a, b) => a.localeCompare(b));
}

function openSwapModal(index) {
  if (!currentSession) return;
  swapIndex = index;

  const from = currentSession.exercises[index]?.name;
  $("swapTitle").textContent = `差替え元：${from}`;

  const candidates = buildSwapCandidates(from);
  const sel = $("swapToSelect");
  sel.innerHTML = "";
  candidates.forEach(name => {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    sel.appendChild(o);
  });

  $("modal").style.display = "block";
}

function closeSwapModal() {
  $("modal").style.display = "none";
  swapIndex = null;
}

function buildSwapCandidates(fromName) {
  const uniq = allKnownExercises().filter(x => x !== fromName);

  // 履歴優先（from->to を上に）
  const hist = swapHistory
    .filter(s => s.from === fromName)
    .map(s => s.to)
    .filter(Boolean);

  const histUniq = [...new Set(hist)];
  const rest = uniq.filter(x => !histUniq.includes(x));

  return [...histUniq, ...rest];
}

function confirmSwap() {
  if (!currentSession || swapIndex === null) return;

  const from = currentSession.exercises[swapIndex]?.name;
  const to = $("swapToSelect")?.value;
  if (!from || !to) return;

  // 回数レンジは「差替え先がプリセット内に存在すればそれを採用」、なければ前のレンジを維持
  const found = presets
    .flatMap(p => p.exercises)
    .find(e => e.name === to);

  const prev = currentSession.exercises[swapIndex];
  const next = {
    name: to,
    min: found?.min ?? prev.min ?? 8,
    max: found?.max ?? prev.max ?? 10,
  };

  currentSession.exercises[swapIndex] = next;
  currentSession.overrides.push({ from, to });

  // 履歴保存（資産化）
  swapHistory.unshift({ from, to });
  // 同一ペアが溜まりすぎないように軽く重複排除
  swapHistory = swapHistory.filter((s, i, arr) => {
    return i === arr.findIndex(x => x.from === s.from && x.to === s.to);
  }).slice(0, 50);

  saveSwaps();
  saveSession();

  renderSession();
  syncWorkoutAndExerciseSelects();

  closeSwapModal();
}

// ===== log / chart =====
function populateSetNo() {
  const sel = $("setNo");
  if (!sel) return;
  sel.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `Set ${i}`;
    sel.appendChild(o);
  }
  if (!sel.value) sel.value = "1";
}

function updateFilterExercises() {
  const sel = $("filterExercise");
  if (!sel) return;

  const current = sel.value;
  sel.innerHTML = "";

  const uniq = [...new Set(logs.map(l => l.exercise).filter(Boolean))];

  if (uniq.length === 0) {
    const o = document.createElement("option");
    o.textContent = "（記録なし）";
    sel.appendChild(o);
    sel.disabled = true;
    return;
  }

  sel.disabled = false;
  uniq.forEach(ex => {
    const o = document.createElement("option");
    o.value = ex;
    o.textContent = ex;
    sel.appendChild(o);
  });

  sel.value = uniq.includes(current) ? current : uniq[0];
}

function e1RM(w, r) { return Math.round(w * (1 + r / 30)); }

function metricValue(log, metric) {
  switch (metric) {
    case "weight": return log.weight;
    case "reps": return log.reps;
    case "volume": return Math.round(log.weight * log.reps);
    default: return e1RM(log.weight, log.reps);
  }
}

function drawChart(exercise) {
  if (!exercise) return;

  const metricSel = $("chartMetric");
  const modeSel = $("chartMode");
  const canvas = $("chart");
  if (!metricSel || !modeSel || !canvas) return;

  const metric = metricSel.value;
  const mode = modeSel.value;

  const data = logs
    .filter(l => l.exercise === exercise)
    .sort((a, b) => (a.date === b.date) ? a.setNo - b.setNo : a.date.localeCompare(b.date));

  if (data.length === 0) {
    if (chart) chart.destroy();
    chart = null;
    return;
  }

  const labels = [...new Set(data.map(d => d.date))];

  const byDate = {};
  data.forEach(d => {
    byDate[d.date] ??= {};
    byDate[d.date][d.setNo] = metricValue(d, metric);
  });

  const sets = [...new Set(data.map(d => d.setNo))].sort((a, b) => a - b);
  const datasets = [];

  if (mode === "bySet" || mode === "both") {
    sets.forEach(s => {
      datasets.push({
        label: `Set ${s}`,
        data: labels.map(dt => byDate[dt]?.[s] ?? null),
        borderWidth: 2,
      });
    });
  }

  if (mode === "sum" || mode === "both") {
    datasets.push({
      label: "セット合計（その日）",
      data: labels.map(dt => {
        const vals = Object.values(byDate[dt] || {});
        if (vals.length === 0) return null;
        return (metric === "volume")
          ? vals.reduce((a, b) => a + b, 0)
          : Math.max(...vals);
      }),
      borderWidth: 3,
      borderDash: [6, 4],
    });
  }

  if (chart) chart.destroy();
  chart = new Chart(canvas, { type: "line", data: { labels, datasets } });
}

// ===== rule engine (your rules) =====
function getRepRangeFromSession(exName) {
  // 当日メニュー優先
  const s = currentSession?.exercises?.find(e => e.name === exName);
  if (s) return { min: s.min, max: s.max };

  // プリセットから拾う（念のため）
  const found = presets.flatMap(p => p.exercises).find(e => e.name === exName);
  return found ? { min: found.min, max: found.max } : null;
}

function ruleAdvice(log) {
  const { exercise, weight, reps, rir, date } = log;

  // 同日・同種目・同重量
  const sameDaySameWeight = logs.filter(l =>
    l.exercise === exercise && l.date === date && l.weight === weight
  );

  if (rir !== null && rir <= 0) {
    return "⚠️ RIR0以下（潰れ）。今日は勝たなくてOK。次回は重量そのまま or 下げてRIR1〜2に戻そう。";
  }
  if (rir !== null && (rir < 1 || rir > 2)) {
    return "⚠️ RIRが1〜2から外れています。重量/回数を調整してRIR1〜2に揃えよう。";
  }

  // −3回以上落ちたら「その場で下げる」提案
  if (sameDaySameWeight.length >= 2) {
    const prev = sameDaySameWeight[sameDaySameWeight.length - 2];
    if (prev.reps - reps >= 3) {
      return "❌ 回数が−3以上低下。今日は −2.5kg（or −5%）して回数レンジに戻してOK。帳尻合わせ不要。";
    }
  }

  const range = getRepRangeFromSession(exercise);
  if (!range) return "OK：RIR1〜2想定。次セットも同条件で。";

  const { max } = range;

  // 同日同種目のセット（その日の全セット）
  const sameDaySets = logs.filter(l => l.exercise === exercise && l.date === date);

  // 全セット上限達成なら次回UP
  const allAtUpper = sameDaySets.length >= 3 && sameDaySets.every(l => l.reps >= max && l.weight === weight);
  if (allAtUpper) {
    return "✅ 全セット上限達成。次回：重量UPしてOK（回数−1〜−2は許容）。";
  }

  if (reps < max) return "OK：重量はそのまま。回数UP狙いで継続。";
  return "OK：この重量は適正。安定して継続。";
}

// ===== sync workout/exercise selects =====
function syncWorkoutAndExerciseSelects() {
  // workoutSelect：セッションがあればそれ、なければPUSH/PULL/LEGS固定
  const wsel = $("workoutSelect");
  const esel = $("exerciseSelect");
  if (!wsel || !esel) return;

  const workouts = ["PUSH", "PULL", "LEGS"];
  wsel.innerHTML = "";
  workouts.forEach(w => {
    const o = document.createElement("option");
    o.value = w;
    o.textContent = w;
    wsel.appendChild(o);
  });

  const w = currentSession?.workout || "PUSH";
  wsel.value = workouts.includes(w) ? w : "PUSH";

  // 種目：セッションがあれば当日メニューから
  esel.innerHTML = "";
  const list = currentSession?.exercises?.length ? currentSession.exercises : (getPresetById($("presetSelect")?.value)?.exercises || []);
  list.forEach(ex => {
    const o = document.createElement("option");
    o.value = ex.name;
    o.textContent = ex.name;
    esel.appendChild(o);
  });

  if (!esel.value && list[0]) esel.value = list[0].name;
}

// ===== actions =====
function addLog(log) {
  logs.push(log);
  saveLogs();
  lastAdded = log;
}

function undoLastLog() {
  if (!logs.length) return alert("取り消せる記録がありません");
  const last = logs[logs.length - 1];
  const ok = confirm(`直前の記録を削除しますか？\n\n${last.date}\n${last.exercise}\n${last.weight}kg × ${last.reps}回 (Set ${last.setNo})`);
  if (!ok) return;
  logs.pop();
  saveLogs();
  updateFilterExercises();
  const ex = $("filterExercise")?.value;
  if (ex && !$("filterExercise")?.disabled) drawChart(ex);
  setFeedback("直前の記録を取り消しました。");
}

// ===== wiring =====
document.addEventListener("DOMContentLoaded", () => {
  loadAll();

  // 日付
  if ($("date") && !$("date").value) $("date").value = todayStr();

  populateSetNo();
  renderPresetSelects();
  renderSession();
  syncWorkoutAndExerciseSelects();

  // グラフ初期化
  updateFilterExercises();
  const f = $("filterExercise");
  if (f && !f.disabled && f.value) drawChart(f.value);

  // start session
  $("startSessionBtn")?.addEventListener("click", () => {
    const pid = $("presetSelect")?.value;
    if (!pid) return;
    startSession(pid);
  });

  // preset editor change
  $("managePresetSelect")?.addEventListener("change", renderPresetEditor);

  // create preset
  $("createPresetBtn")?.addEventListener("click", () => {
    const name = ($("presetName")?.value || "").trim();
    const workout = $("presetBaseWorkout")?.value || "PUSH";
    if (!name) return alert("プリセット名を入力してね");

    presets.unshift({ id: uid(), name, workout, exercises: [] });
    savePresets();
    renderPresetSelects();

    $("presetName").value = "";
    setFeedback("プリセットを作成しました。");
  });

  // rename
  $("renamePresetBtn")?.addEventListener("click", () => {
    const pid = getSelectedPresetId();
    const p = getPresetById(pid);
    if (!p) return;

    const name = prompt("新しい名前", p.name);
    if (!name) return;

    p.name = name.trim();
    savePresets();
    renderPresetSelects();
  });

  // delete preset
  $("deletePresetBtn")?.addEventListener("click", () => {
    const pid = getSelectedPresetId();
    const p = getPresetById(pid);
    if (!p) return;

    if (!confirm(`プリセット「${p.name}」を削除しますか？`)) return;
    presets = presets.filter(x => x.id !== pid);
    savePresets();

    // セッションがこれなら解除
    if (currentSession?.presetId === pid) {
      currentSession = null;
      saveSession();
    }

    renderPresetSelects();
    renderSession();
    syncWorkoutAndExerciseSelects();
  });

  // add exercise to preset
  $("addExerciseBtn")?.addEventListener("click", () => {
    const pid = getSelectedPresetId();
    const p = getPresetById(pid);
    if (!p) return;

    const name = ($("newExerciseName")?.value || "").trim();
    const min = Number($("newMin")?.value || 0);
    const max = Number($("newMax")?.value || 0);

    if (!name) return alert("種目名を入れてね");
    if (!min || !max || min >= max) return alert("min/max回数を正しく入れてね（例：8 と 10）");

    p.exercises.push({ name, min, max });
    savePresets();
    renderPresetEditor();

    $("newExerciseName").value = "";
    $("newMin").value = "";
    $("newMax").value = "";
  });

  // modal
  $("swapCancelBtn")?.addEventListener("click", closeSwapModal);
  $("swapConfirmBtn")?.addEventListener("click", confirmSwap);

  // chart controls
  $("filterExercise")?.addEventListener("change", e => drawChart(e.target.value));
  $("chartMetric")?.addEventListener("change", () => drawChart($("filterExercise")?.value));
  $("chartMode")?.addEventListener("change", () => drawChart($("filterExercise")?.value));

  // undo
  $("undoBtn")?.addEventListener("click", undoLastLog);

  // submit log
  $("logForm")?.addEventListener("submit", e => {
    e.preventDefault();

    const log = {
      date: $("date")?.value || todayStr(),
      workout: $("workoutSelect")?.value || (currentSession?.workout || "PUSH"),
      presetId: currentSession?.presetId || null,
      exercise: $("exerciseSelect")?.value || "",
      setNo: Number($("setNo")?.value || 1),
      weight: Number($("weight")?.value || 0),
      reps: Number($("reps")?.value || 0),
      rir: $("rir")?.value === "" ? null : Number($("rir")?.value),
    };

    addLog(log);

    // 判定
    setFeedback(ruleAdvice(log));

    // グラフ更新
    updateFilterExercises();
    if ($("filterExercise") && !$("filterExercise").disabled) {
      $("filterExercise").value = log.exercise;
      drawChart(log.exercise);
    }

    // 次セットへ
    $("setNo").value = String(Math.min(log.setNo + 1, 10));
    $("rir").value = "";
  });
});
