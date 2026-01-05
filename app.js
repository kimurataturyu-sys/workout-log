
// ===== 確定メニュー（PUSH / PULL / LEGS）=====
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
  sel.value = WORKOUTS[0].id;
}

function populateExerciseSelect() {
  const workoutId = $("workoutSelect")?.value;
  const workout = WORKOUTS.find(w => w.id === workoutId);
  const sel = $("exerciseSelect");
  if (!sel || !workout) return;

  sel.innerHTML = "";
  workout.items.forEach(ex => {
    const o = document.createElement("option");
    o.value = ex;
    o.textContent = ex;
    sel.appendChild(o);
  });
  sel.value = workout.items[0];
}

// ===== データ =====
let logs = JSON.parse(localStorage.getItem("logs") || "[]");
let chart;

// ===== 共通 =====
function $(id) { return document.getElementById(id); }
function saveLogs() { localStorage.setItem("logs", JSON.stringify(logs)); }
function e1RM(w, r) { return Math.round(w * (1 + r / 30)); }

function metricValue(log, metric) {
  switch (metric) {
    case "e1rm": return e1RM(log.weight, log.reps);
    case "weight": return log.weight;
    case "reps": return log.reps;
    case "volume": return Math.round(log.weight * log.reps);
    default: return e1RM(log.weight, log.reps);
  }
}

// ===== 記録 =====
function addLog(log) {
  logs.push(log);
  saveLogs();
}

// ===== グラフ =====
function drawChart(exercise) {
  if (!exercise) return;

  const metric = $("chartMetric")?.value || "e1rm";
  const mode = $("chartMode")?.value || "bySet";

  const data = logs
    .filter(l => l.exercise === exercise)
    .sort((a, b) => {
      if (a.date === b.date) return a.setNo - b.setNo;
      return a.date.localeCompare(b.date);
    });

  if (data.length === 0) return;

  // 日付ラベル
  const labels = [...new Set(data.map(d => d.date))];

  // 日付×セットで整理
  const byDate = {};
  data.forEach(d => {
    byDate[d.date] ||= {};
    byDate[d.date][d.setNo] = metricValue(d, metric);
  });

  // セット番号一覧
  const sets = [...new Set(data.map(d => d.setNo))].sort((a,b)=>a-b);

  let datasets = [];

  // ---- セット別 ----
  if (mode === "bySet" || mode === "both") {
    sets.forEach(setNo => {
      const values = labels.map(dt => byDate[dt]?.[setNo] ?? null);
      datasets.push({
        label: `Set ${setNo}`,
        data: values,
        borderWidth: 2,
      });
    });
  }

  // ---- セット合計（その日の代表値）----
  // e1RM/重量/回数 → その日の「最大値」
  // volume → その日の「合計」
  if (mode === "sum" || mode === "both") {
    const sumValues = labels.map(dt => {
      const setsObj = byDate[dt];
      if (!setsObj) return null;

      const vals = Object.values(setsObj);
      if (metric === "volume") {
        return vals.reduce((a,b)=>a+b,0);
      } else {
        return Math.max(...vals);
      }
    });

    datasets.push({
      label: "Set合計（その日）",
      data: sumValues,
      borderWidth: 3,
      borderDash: [6,4],
    });
  }

  if (chart) chart.destroy();

  chart = new Chart($("chart"), {
    type: "line",
    data: { labels, datasets }
  });
}

// ===== フィルタ =====
// ===== フィルタ =====
function updateFilterExercises() {
  const sel = $("filterExercise");
  if (!sel) return;
  if (!sel) return;
  sel.innerHTML = "";

  const uniq = [...new Set(logs.map(l => l.exercise))];
  const uniq = [...new Set(logs.map(l => l.exercise))];
  if (uniq.length === 0) {
    const o = document.createElement("option");
    o.textContent = "（記録なし）";
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

// ===== イベント =====
$("filterExercise")?.addEventListener("change", e => {
  drawChart(e.target.value);
});

$("chartMetric")?.addEventListener("change", () => {
  const ex = $("filterExercise")?.value;
  if (ex) drawChart(ex);
});

$("chartMode")?.addEventListener("change", () => {
  const ex = $("filterExercise")?.value;
  if (ex) drawChart(ex);
});

// ===== フォーム送信（※重量・回数は残す）=====
$("logForm")?.addEventListener("submit", e => {
$("filterExercise")?.addEventListener("change", e => {
  drawChart(e.target.value);
});

$("chartMetric")?.addEventListener("change", () => {
  const ex = $("filterExercise")?.value;
  if (ex) drawChart(ex);
});

$("chartMode")?.addEventListener("change", () => {
  const ex = $("filterExercise")?.value;
  if (ex) drawChart(ex);
});

// ===== フォーム送信（※重量・回数は残す）=====
$("logForm")?.addEventListener("submit", e => {
  e.preventDefault();

  const log = {
    date: $("date").value,
    workout: $("workoutSelect")?.value,
    exercise: $("exerciseSelect")?.value,
    setNo: Number($("setNo")?.value || 1),
    workout: $("workoutSelect")?.value,
    exercise: $("exerciseSelect")?.value,
    setNo: Number($("setNo")?.value || 1),
    weight: Number($("weight").value),
    reps: Number($("reps").value),
    rir: $("rir").value === "" ? null : Number($("rir").value),
  };

  addLog(log);
  updateFilterExercises();
  $("filterExercise").value = log.exercise;
  drawChart(log.exercise);

  // 次セットへ
  $("setNo").value = String(Math.min(log.setNo + 1, 10));

  // 重量・回数は残す
  $("filterExercise").value = log.exercise;
  drawChart(log.exercise);

  // 次セットへ
  $("setNo").value = String(Math.min(log.setNo + 1, 10));

  // 重量・回数は残す
  $("rir").value = "";
});

// ===== 初期 =====
// ===== 初期 =====
updateFilterExercises();
if ($("filterExercise") && $("filterExercise").value) {
if ($("filterExercise") && $("filterExercise").value) {
  drawChart($("filterExercise").value);
}
