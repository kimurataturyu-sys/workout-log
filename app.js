// =====================
// ① 画面切替（SPA）
// =====================
const ROUTES = ["log", "presets", "history"];

function showRoute(route) {
  if (!ROUTES.includes(route)) route = "log";

  ROUTES.forEach(r => {
    const v = document.getElementById(`view-${r}`);
    if (v) v.classList.toggle("active", r === route);

    const b = document.querySelector(`.tab[data-route="${r}"]`);
    if (b) b.classList.toggle("active", r === route);
  });

  // log画面に戻った瞬間、Chartが崩れないように再描画
  if (route === "log") {
    const ex = document.getElementById("filterExercise")?.value;
    if (ex) drawChart(ex);
  }
}
function navigate(route) { location.hash = `#${route}`; }

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => navigate(btn.dataset.route));
});
window.addEventListener("hashchange", () => {
  const route = location.hash.replace("#", "") || "log";
  showRoute(route);
});

// =====================
// ② ワークアウト（固定版）
//  ※次のステップで「自由登録」に置き換え予定
// =====================
const WORKOUTS = [
  {
    id: "PUSH",
    name: "PUSH｜胸・肩前・三頭",
    items: [
      { ex: "ベンチプレス", repMin: 6, repMax: 8, restSec: 120 },
      { ex: "スミス・インクラインプレス（20〜30°）", repMin: 8, repMax: 10, restSec: 90 },
      { ex: "スミス・オーバーヘッドプレス", repMin: 6, repMax: 8, restSec: 120 },
      { ex: "サイドレイズ", repMin: 12, repMax: 15, restSec: 90 },
      { ex: "オーバーヘッドトライセプスEX", repMin: 10, repMax: 12, restSec: 90 },
    ],
  },
  {
    id: "PULL",
    name: "PULL｜背中・二頭",
    items: [
      { ex: "チンニング（順手 or パラレル）", repMin: 6, repMax: 10, restSec: 90 },
      { ex: "チェストサポート・ダンベルロー", repMin: 8, repMax: 10, restSec: 90 },
      { ex: "デッドリフト", repMin: 5, repMax: 6, restSec: 120 },
      { ex: "インクラインダンベルカール", repMin: 8, repMax: 10, restSec: 90 },
    ],
  },
  {
    id: "LEGS",
    name: "LEGS｜脚",
    items: [
      { ex: "バーベルスクワット", repMin: 6, repMax: 8, restSec: 120 },
      { ex: "レッグプレス", repMin: 10, repMax: 12, restSec: 90 },
      { ex: "ルーマニアンデッドリフト", repMin: 8, repMax: 10, restSec: 120 },
      { ex: "ライイングレッグカール", repMin: 10, repMax: 12, restSec: 90 },
    ],
  },
];

// =====================
// ③ データ（localStorage）
// =====================
let logs = JSON.parse(localStorage.getItem("logs") || "[]");
let chart = null;

function $(id) { return document.getElementById(id); }
function saveLogs() { localStorage.setItem("logs", JSON.stringify(logs)); }

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 推定1RM（Epley）
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

// =====================
// ④ セレクト初期化
// =====================
function populateSetNo(max = 10) {
  const sel = $("setNo");
  if (!sel) return;
  sel.innerHTML = "";
  for (let i = 1; i <= max; i++) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = `Set ${i}`;
    sel.appendChild(o);
  }
  sel.value = "1";
}

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
  workout.items.forEach(item => {
    const o = document.createElement("option");
    o.value = item.ex;
    o.textContent = item.ex;
    sel.appendChild(o);
  });

  sel.value = workout.items[0].ex;
  updateGuide();
}

function getCurrentGuide() {
  const workoutId = $("workoutSelect")?.value;
  const ex = $("exerciseSelect")?.value;
  const w = WORKOUTS.find(x => x.id === workoutId);
  const item = w?.items?.find(i => i.ex === ex);
  return item || null;
}

// =====================
// ⑤ ガイド / フィードバック
// =====================
function updateGuide() {
  const g = getCurrentGuide();
  const box = $("guide");
  if (!box) return;

  if (!g) {
    box.textContent = "ガイドなし";
    return;
  }

  box.textContent =
    `目標：${g.repMin}〜${g.repMax}回 / 休憩：${g.restSec}秒`;
}

function updateFeedback() {
  const fb = $("feedback");
  if (!fb) return;

  const g = getCurrentGuide();
  const w = Number($("weight")?.value || 0);
  const r = Number($("reps")?.value || 0);
  const rir = $("rir")?.value === "" ? null : Number($("rir")?.value);

  if (!g || !w || !r) {
    fb.textContent = "入力すると、目標レンジ/RIRの目安を表示します";
    return;
  }

  // ざっくり判定（あなたのルールを反映しやすい形）
  let msg = [];
  msg.push(`推定1RM：${e1RM(w, r)}kg`);

  if (r < g.repMin) msg.push("回数がレンジ未満 → 重すぎの可能性（-2.5kg目安）");
  else if (r > g.repMax) msg.push("回数がレンジ超え → 次回重量UP候補");
  else msg.push("回数レンジ内 → OK（RIR1〜2で揃える）");

  if (rir !== null) {
    if (rir <= 0) msg.push("RIR0以下 → 追い込みすぎ。次は重量/回数を調整");
    else if (rir >= 3) msg.push("RIR高め → 余裕あり。回数/重量UP検討");
    else msg.push("RIR1〜2 → 理想");
  }

  fb.textContent = msg.join(" / ");
}

// =====================
// ⑥ ログ追加（重量・回数は残す仕様）
// =====================
function addLog(log) {
  // idは編集/削除のために入れておく（後で履歴画面で使う）
  log.id = log.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  logs.push(log);
  saveLogs();
}

$("logForm")?.addEventListener("submit", e => {
  e.preventDefault();

  const log = {
    date: $("date").value,
    workout: $("workoutSelect")?.value,
    exercise: $("exerciseSelect")?.value,
    setNo: Number($("setNo")?.value || 1),
    weight: Number($("weight").value),
    reps: Number($("reps").value),
    rir: $("rir").value === "" ? null : Number($("rir").value),
  };

  addLog(log);

  // グラフ更新
  updateFilterExercises();
  if ($("filterExercise")) {
    $("filterExercise").value = log.exercise;
  }
  drawChart(log.exercise);

  // 次セットへ（重量・回数は残す）
  $("setNo").value = String(Math.min(log.setNo + 1, 10));
  $("rir").value = "";
});

// 入力中フィードバック
$("workoutSelect")?.addEventListener("change", () => {
  populateExerciseSelect();
});
$("exerciseSelect")?.addEventListener("change", () => {
  updateGuide();
});
["weight", "reps", "rir"].forEach(id => {
  $(id)?.addEventListener("input", updateFeedback);
});

// =====================
// ⑦ グラフ（セット別 / セット合計 / 両方）
// =====================
function updateFilterExercises() {
  const sel = $("filterExercise");
  if (!sel) return;

  const uniq = [...new Set(logs.map(l => l.exercise))].filter(Boolean);
  sel.innerHTML = "";

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

function drawChart(exercise) {
  if (!exercise || !$("chart")) return;

  const metric = $("chartMetric")?.value || "e1rm";
  const mode = $("chartMode")?.value || "bySet";

  const data = logs
    .filter(l => l.exercise === exercise)
    .sort((a, b) => {
      if (a.date === b.date) return a.setNo - b.setNo;
      return a.date.localeCompare(b.date);
    });

  if (data.length === 0) return;

  const labels = [...new Set(data.map(d => d.date))];

  const byDate = {};
  data.forEach(d => {
    byDate[d.date] ||= {};
    byDate[d.date][d.setNo] = metricValue(d, metric);
  });

  const sets = [...new Set(data.map(d => d.setNo))].sort((a, b) => a - b);

  let datasets = [];

  // セット別
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

  // セット合計（その日）
  if (mode === "sum" || mode === "both") {
    const sumValues = labels.map(dt => {
      const setsObj = byDate[dt];
      if (!setsObj) return null;

      const vals = Object.values(setsObj);
      if (metric === "volume") {
        return vals.reduce((a, b) => a + b, 0);
      } else {
        return Math.max(...vals);
      }
    });

    datasets.push({
      label: "その日の代表値（合計/最大）",
      data: sumValues,
      borderWidth: 3,
      borderDash: [6, 4],
    });
  }

  if (chart) chart.destroy();

  chart = new Chart($("chart"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#ffffff" } }
      },
      scales: {
        x: { ticks: { color: "#cfcfcf" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#cfcfcf" }, grid: { color: "rgba(255,255,255,0.06)" } },
      }
    }
  });
}

$("filterExercise")?.addEventListener("change", e => drawChart(e.target.value));
$("chartMetric")?.addEventListener("change", () => {
  const ex = $("filterExercise")?.value;
  if (ex) drawChart(ex);
});
$("chartMode")?.addEventListener("change", () => {
  const ex = $("filterExercise")?.value;
  if (ex) drawChart(ex);
});

// =====================
// ⑧ 初期化
// =====================
function init() {
  // 日付デフォルト
  if ($("date") && !$("date").value) $("date").value = todayStr();

  populateSetNo(10);
  populateWorkoutSelect();
  populateExerciseSelect();
  updateGuide();
  updateFeedback();

  updateFilterExercises();
  if ($("filterExercise") && !$("filterExercise").disabled) {
    drawChart($("filterExercise").value);
  }

  // 初期画面
  showRoute(location.hash.replace("#", "") || "log");
}
init();
