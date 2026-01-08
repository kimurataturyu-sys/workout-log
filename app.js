function $(id) { return document.getElementById(id); }

let logs = [];
let chart = null;

// 編集で選択中のログ（logs配列の index）
let selectedIndex = null;

// Undo（直前追加の取り消し）
let lastAdded = null; // { item }

// 削除Undo（編集パネルから1件削除した場合の復元用）
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

function populateWorkoutSelect() {
  const sel = $("workoutSelect");
  if (!sel) return;
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
  if (!wsel || !sel) return;
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

function populateSetNo(selectId) {
  const sel = $(selectId);
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

// ===== 直前追加をUndo =====
function undoLastAdd() {
  if (!lastAdded || logs.length === 0) {
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
  lastAdded = null;

  updateFilterExercises();
  const ex = $("filterExercise")?.value;
  if (ex && !$("filterExercise")?.disabled) drawChart(ex);

  // 編集一覧が表示中なら更新
  renderEditList();
}

// ===== 編集：日付で一覧表示 =====
function getLogsByDate(dateStr) {
  return logs
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.date === dateStr)
    .sort((a, b) => {
      if (a.item.exercise !== b.item.exercise) return a.item.exercise.localeCompare(b.item.exercise);
      return a.item.setNo - b.item.setNo;
    });
}

function renderEditList() {
  const dateStr = $("editDate")?.value;
  const info = $("editInfo");
  const list = $("editList");
  if (!info || !list) return;

  if (!dateStr) {
    info.textContent = "日付を指定して「一覧表示」を押してください。";
    list.innerHTML = "";
    hideEditPanel();
    return;
  }

  const rows = getLogsByDate(dateStr);
  info.textContent = `日付：${dateStr} / ${rows.length}件（タップして編集）`;

  if (rows.length === 0) {
    list.innerHTML = "（この日のログはありません）";
    hideEditPanel();
    return;
  }

  list.innerHTML = rows.map(({ item, idx }) => {
    const selected = (idx === selectedIndex) ? " style='background:rgba(255,255,255,0.08);'" : "";
    const rirText = (item.rir === null || item.rir === undefined) ? "-" : item.rir;
    return `
      <div data-idx="${idx}"${selected}
        style="padding:10px;border-bottom:1px solid #333;cursor:pointer;">
        <div><strong>${item.exercise}</strong> / Set ${item.setNo}</div>
        <div>${item.weight}kg × ${item.reps}回 / RIR ${rirText}</div>
      </div>
    `;
  }).join("");

  // クリックで選択
  list.querySelectorAll("[data-idx]").forEach(el => {
    el.addEventListener("click", () => {
      const idx = Number(el.getAttribute("data-idx"));
      openEditPanel(idx);
      renderEditList(); // 選択ハイライト更新
    });
  });
}

function openEditPanel(index) {
  const item = logs[index];
  if (!item) return;

  selectedIndex = index;

  $("editPanel").style.display = "block";
  $("editExerciseLabel").textContent = item.exercise;
  $("editDateLabel").textContent = item.date;

  $("editSetNo").value = String(item.setNo);
  $("editWeight").value = String(item.weight);
  $("editReps").value = String(item.reps);
  $("editRir").value = (item.rir === null || item.rir === undefined) ? "" : String(item.rir);
}

function hideEditPanel() {
  selectedIndex = null;
  const p = $("editPanel");
  if (p) p.style.display = "none";
}

function saveEdit() {
  if (selectedIndex === null) return;
  const old = logs[selectedIndex];
  if (!old) return;

  const next = {
    ...old,
    setNo: Number($("editSetNo").value),
    weight: Number($("editWeight").value),
    reps: Number($("editReps").value),
    rir: $("editRir").value === "" ? null : Number($("editRir").value),
  };

  const ok = confirm(
    `この内容で保存しますか？\n\n${next.date}\n${next.exercise}\nSet ${next.setNo}\n${next.weight}kg × ${next.reps}回 / RIR ${next.rir ?? "-"}`
  );
  if (!ok) return;

  logs[selectedIndex] = next;
  saveLogs();

  // 表示更新
  updateFilterExercises();
  const ex = $("filterExercise")?.value;
  if (ex && !$("filterExercise")?.disabled) drawChart(ex);

  renderEditList();
  openEditPanel(selectedIndex); // 編集欄を最新値で更新
}

function deleteSelected() {
  if (selectedIndex === null) return;
  const item = logs[selectedIndex];
  if (!item) return;

  const ok = confirm(
    `この1件を削除しますか？\n\n${item.date}\n${item.exercise}\n${item.weight}kg × ${item.reps}回 (Set ${item.setNo})`
  );
  if (!ok) return;

  lastDeleted = { index: selectedIndex, item };
  logs.splice(selectedIndex, 1);
  saveLogs();

  hideEditPanel();
  renderEditList();

  updateFilterExercises();
  const ex = $("filterExercise")?.value;
  if (ex && !$("filterExercise")?.disabled) drawChart(ex);

  alert("削除しました（※取り消し機能は今後追加可能）");
}

// ===== 起動 =====
document.addEventListener("DOMContentLoaded", () => {
  loadLogs();

  // 今日をセット
  const d = $("date");
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);

  // 編集日付も今日にしておく（好み）
  const ed = $("editDate");
  if (ed && !ed.value) ed.value = new Date().toISOString().slice(0, 10);

  populateWorkoutSelect();
  populateExerciseSelect();
  populateSetNo("setNo");
  populateSetNo("editSetNo");

  updateFilterExercises();
  const f = $("filterExercise");
  if (f && !f.disabled && f.value) drawChart(f.value);

  // イベント
  $("workoutSelect")?.addEventListener("change", populateExerciseSelect);

  $("filterExercise")?.addEventListener("change", e => drawChart(e.target.value));
  $("chartMetric")?.addEventListener("change", () => drawChart($("filterExercise")?.value));
  $("chartMode")?.addEventListener("change", () => drawChart($("filterExercise")?.value));

  $("undoBtn")?.addEventListener("click", undoLastAdd);

  $("showByDateBtn")?.addEventListener("click", renderEditList);
  $("clearEditBtn")?.addEventListener("click", () => {
    if ($("editDate")) $("editDate").value = "";
    hideEditPanel();
    renderEditList();
  });

  $("saveEditBtn")?.addEventListener("click", saveEdit);
  $("cancelEditBtn")?.addEventListener("click", () => {
    hideEditPanel();
    renderEditList();
  });

  $("deleteSelectedBtn")?.addEventListener("click", deleteSelected);

  // 記録
  $("logForm")?.addEventListener("submit", e => {
    e.preventDefault();

    const log = {
      date: $("date").value,
      workout: $("workoutSelect").value,
      exercise: $("exerciseSelect").value,
      setNo: Number($("setNo").value),
      weight: Number($("weight").value),
      reps: Number($("reps").value),
      rir: $("rir").value === "" ? null : Number($("rir").value),
    };

    logs.push(log);
    saveLogs();
    lastAdded = { item: log };

    // グラフ更新
    updateFilterExercises();
    const fx = $("filterExercise");
    if (fx && !fx.disabled) {
      fx.value = log.exercise;
      drawChart(log.exercise);
    }

    // 編集一覧も更新（同じ日付なら即反映）
    renderEditList();

    // 次セットへ（重量/回数保持、RIRだけ空）
    $("setNo").value = String(Math.min(log.setNo + 1, 10));
    $("rir").value = "";
  });

  // 初期表示
  renderEditList();
});
