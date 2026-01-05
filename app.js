// ===== 共通 =====
function $(id) { return document.getElementById(id); }

let logs = [];
let chart = null;

// 削除Undo用（最後の削除1回だけ戻す）
let lastDeleted = null; // { index, item }

function saveLogs() { localStorage.setItem("logs", JSON.stringify(logs)); }
function loadLogs() {
  try { logs = JSON.parse(localStorage.getItem("logs") || "[]"); }
  catch { logs = []; }
}

function e1RM(w, r) { return Math.round(w * (1 + r / 30)); }

function metricValue(log, metric) {
  switch (metric) {
    case "weight": return log.weight;
    case "reps": return log.reps;
    case "volume": return log.weight * log.reps;
    default: return e1RM(log.weight, log.reps);
  }
}

// ===== ワークアウト定義 =====
const WORKOUTS = [
  {
    id: "PUSH",
    name: "PUSH｜胸・肩前・三頭",
    items: [
      "ベンチプレス",
      "スミス・インクラインプレス（20〜30°）",
      "スミス・オーバーヘッドプレス",
      "サイドレイズ",
      "オーバーヘッドトライセプスエクステンション",
    ],
  },
  {
    id: "PULL",
    name: "PULL｜背中・二頭",
    items: [
      "チンニング（順手 or パラレル）",
      "シーテッドロー",
      "デッドリフト",
      "インクラインダンベルカール",
    ],
  },
  {
    id: "LEGS",
    name: "LEGS｜脚",
    items: [
      "バーベルスクワット",
      "レッグプレス",
      "ルーマニアンデッドリフト",
      "レッグカール",
    ],
  },
];

// ===== セレクト生成 =====
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
  sel.value = "1";
}

function populateWorkoutSelect() {
  const sel = $("workoutSelect");
  if (!sel) { console.error("workoutSelect が見つからない"); return; }

  sel.innerHTML = "";
  WORKOUTS.forEach(w => {
    const o = document.createElement("option");
    o.value = w.id;
    o.textContent = w.name;
    sel.appendChild(o);
  });

  if (!sel.value) sel.value = WORKOUTS[0].id;
}

function populateExerciseSelect() {
  const wsel = $("workoutSelect");
  const sel = $("exerciseSelect");
  if (!wsel || !sel) { console.error("exerciseSelect/workoutSelect が見つからない"); return; }

  const workout = WORKOUTS.find(w => w.id === wsel.value) || WORKOUTS[0];
  sel.innerHTML = "";
  workout.items.forEach(ex => {
    const o = document.createElement("option");
    o.value = ex;
    o.textContent = ex;
    sel.appendChild(o);
  });

  if (!sel.value) sel.value = workout.items[0];
}

// ===== フィルタ（グラフ用）=====
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

  // できるだけ前の選択を維持
  sel.value = uniq.includes(current) ? current : uniq[0];
}

// ===== グラフ =====
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

// ===== 直前の入力を取り消す（Undo追加）=====
function undoLastLog() {
  if (logs.length === 0) {
    alert("取り消せる記録がありません");
    return;
  }
  const last = logs[logs.length - 1];
  const ok = confirm(
    `直前の記録を削除しますか？\n\n${last.date}\n${last.exercise}\n${last.weight}kg × ${last.reps}回 (Set ${last.setNo})`
  );
  if (!ok) return;

  logs.pop();
  saveLogs();

  updateFilterExercises();
  const ex = $("filterExercise")?.value;
  if (ex && !$("filterExercise")?.disabled) drawChart(ex);

  // 管理画面の表示中なら更新
  renderManageList();
}

// ===== 管理：削除対象の種目プルダウン =====
function updateManageExerciseSelect() {
  const sel = $("manageExercise");
  if (!sel) return;

  const current = sel.value;
  sel.innerHTML = "";

  const uniq = [...new Set(logs.map(l => l.exercise).filter(Boolean))];

  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "（種目を選択）";
  sel.appendChild(o0);

  uniq.forEach(ex => {
    const o = document.createElement("option");
    o.value = ex;
    o.textContent = ex;
    sel.appendChild(o);
  });

  // できるだけ維持
  if (uniq.includes(current)) sel.value = current;
  else sel.value = "";
}

// ===== 管理：条件に合うログを一覧表示 =====
function getManageFilteredLogs() {
  const date = $("manageDate")?.value || "";
  const ex = $("manageExercise")?.value || "";

  return logs
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      const okDate = date ? item.date === date : true;
      const okEx = ex ? item.exercise === ex : true;
      return okDate && okEx;
    })
    .sort((a, b) => {
      // 日付→種目→setNo
      if (a.item.date !== b.item.date) return a.item.date.localeCompare(b.item.date);
      if (a.item.exercise !== b.item.exercise) return a.item.exercise.localeCompare(b.item.exercise);
      return a.item.setNo - b.item.setNo;
    });
}

function renderManageList() {
  const box = $("manageList");
  const countBox = $("manageCount");
  if (!box || !countBox) return;

  const filtered = getManageFilteredLogs();
  countBox.textContent = `表示件数：${filtered.length}件（条件：日付=${$("manageDate")?.value || "指定なし"} / 種目=${$("manageExercise")?.value || "指定なし"}）`;

  if (filtered.length === 0) {
    box.innerHTML = "（該当ログなし）";
    return;
  }

  // 一覧HTML
  const rows = filtered.map(({ item, idx }) => {
    const rirText = (item.rir === null || item.rir === undefined) ? "-" : item.rir;
    return `
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #333;">
        <div style="flex:1;min-width:0;">
          <div><strong>${item.date}</strong> / ${item.workout || ""}</div>
          <div>${item.exercise} / Set ${item.setNo}： <strong>${item.weight}kg × ${item.reps}</strong> / RIR ${rirText}</div>
        </div>
        <button type="button" data-del="${idx}" style="white-space:nowrap;">🗑 削除</button>
      </div>
    `;
  }).join("");

  box.innerHTML = rows;

  // 削除ボタンイベント
  box.querySelectorAll("button[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.getAttribute("data-del"));
      deleteLogAtIndex(idx);
    });
  });
}

// ===== 管理：指定ログ削除（確認 + Undo）=====
function deleteLogAtIndex(index) {
  const item = logs[index];
  if (!item) return;

  const ok = confirm(
    `このログを削除しますか？\n\n${item.date}\n${item.exercise}\n${item.weight}kg × ${item.reps}回 (Set ${item.setNo})`
  );
  if (!ok) return;

  // Undo用に保存
  lastDeleted = { index, item };

  logs.splice(index, 1);
  saveLogs();

  // Undoボタン有効化
  const u = $("undoDeleteBtn");
  if (u) u.disabled = false;

  // 画面更新
  updateFilterExercises();
  updateManageExerciseSelect();
  renderManageList();

  const ex = $("filterExercise")?.value;
  if (ex && !$("filterExercise")?.disabled) drawChart(ex);
}

// ===== 管理：削除Undo（1回）=====
function undoDeleteOnce() {
  if (!lastDeleted) return;

  const { index, item } = lastDeleted;

  // なるべく元の位置に戻す（範囲外なら末尾）
  const pos = Math.min(Math.max(index, 0), logs.length);
  logs.splice(pos, 0, item);
  saveLogs();

  lastDeleted = null;
  const u = $("undoDeleteBtn");
  if (u) u.disabled = true;

  updateFilterExercises();
  updateManageExerciseSelect();
  renderManageList();

  const ex = $("filterExercise")?.value;
  if (ex && !$("filterExercise")?.disabled) drawChart(ex);
}

// ===== 起動 =====
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ app.js 読み込みOK");

  loadLogs();

  // 日付
  const d = $("date");
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);

  const md = $("manageDate");
  if (md && !md.value) md.value = ""; // 管理側は空でOK

  // セレクト初期化
  populateWorkoutSelect();
  populateExerciseSelect();
  populateSetNo();

  // ログ反映
  updateFilterExercises();
  updateManageExerciseSelect();
  renderManageList();

  // イベント
  $("workoutSelect")?.addEventListener("change", () => populateExerciseSelect());

  $("filterExercise")?.addEventListener("change", e => drawChart(e.target.value));
  $("chartMetric")?.addEventListener("change", () => drawChart($("filterExercise")?.value));
  $("chartMode")?.addEventListener("change", () => drawChart($("filterExercise")?.value));

  $("undoBtn")?.addEventListener("click", undoLastLog);

  $("searchLogsBtn")?.addEventListener("click", renderManageList);
  $("clearFilterBtn")?.addEventListener("click", () => {
    if ($("manageDate")) $("manageDate").value = "";
    if ($("manageExercise")) $("manageExercise").value = "";
    renderManageList();
  });

  $("undoDeleteBtn")?.addEventListener("click", undoDeleteOnce);

  // 記録
  $("logForm")?.addEventListener("submit", e => {
    e.preventDefault();

    const log = {
      date: $("date")?.value,
      workout: $("workoutSelect")?.value,
      exercise: $("exerciseSelect")?.value,
      setNo: Number($("setNo")?.value || 1),
      weight: Number($("weight")?.value || 0),
      reps: Number($("reps")?.value || 0),
      rir: $("rir")?.value === "" ? null : Number($("rir")?.value),
    };

    logs.push(log);
    saveLogs();

    // グラフ更新
    updateFilterExercises();
    const f = $("filterExercise");
    if (f && !f.disabled) {
      f.value = log.exercise;
      drawChart(log.exercise);
    }

    // 管理側更新
    updateManageExerciseSelect();
    renderManageList();

    // 次セットへ（重量・回数保持、RIRだけクリア）
    const s = $("setNo");
    if (s) s.value = String(Math.min(log.setNo + 1, 10));
    if ($("rir")) $("rir").value = "";
  });

  // 初期グラフ
  const f = $("filterExercise");
  if (f && !f.disabled && f.value) drawChart(f.value);
});
