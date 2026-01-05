// ===== 共通 =====
function $(id) { return document.getElementById(id); }

let logs = [];
let chart = null;

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

// ===== フィルタ（記録済み種目）=====
function updateFilterExercises() {
  const sel = $("filterExercise");
  if (!sel) { console.error("filterExercise が見つからない"); return; }

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
}

// ===== グラフ =====
function drawChart(exercise) {
  if (!exercise) return;

  const metricSel = $("chartMetric");
  const modeSel = $("chartMode");
  const canvas = $("chart");

  if (!metricSel || !modeSel || !canvas) {
    console.error("chartMetric/chartMode/chart が見つからない");
    return;
  }

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

// ===== 初期化（ここが超重要）=====
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ app.js 読み込みOK");

  // 日付を今日に（空だと記録できないので）
  const d = $("date");
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);

  loadLogs();

  populateWorkoutSelect();
  populateExerciseSelect();
  updateFilterExercises();

  // イベント
  $("workoutSelect")?.addEventListener("change", () => {
    populateExerciseSelect();
  });

  $("filterExercise")?.addEventListener("change", e => drawChart(e.target.value));
  $("chartMetric")?.addEventListener("change", () => drawChart($("filterExercise")?.value));
  $("chartMode")?.addEventListener("change", () => drawChart($("filterExercise")?.value));

  $("clearBtn")?.addEventListener("click", () => {
    if (!confirm("全ログを削除します。よろしいですか？")) return;
    logs = [];
    saveLogs();
    updateFilterExercises();
    if (chart) chart.destroy();
    chart = null;
  });

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

    updateFilterExercises();
    const f = $("filterExercise");
    if (f && !f.disabled) {
      f.value = log.exercise;
      drawChart(log.exercise);
    }

    // 次セットへ（重量・回数保持）
    const s = $("setNo");
    if (s) s.value = String(Math.min(log.setNo + 1, 10));
    if ($("rir")) $("rir").value = "";
  });

  // 初期表示：記録があるなら最初の種目で描画
  const f = $("filterExercise");
  if (f && !f.disabled && f.value) drawChart(f.value);
});
