// ===== 確定メニュー（PUSH / PULL / LEGS） =====
const WORKOUTS = [
  {
    id: "PUSH",
    name: "PUSH｜胸・肩前・三頭",
    items: [
      { ex: "ベンチプレス", sets: 4, repMin: 6, repMax: 8, restSec: 120 },
      { ex: "スミス・インクラインプレス（20〜30°）", sets: 3, repMin: 8, repMax: 10, restSec: 90 },
      { ex: "スミス・オーバーヘッドプレス", sets: 3, repMin: 6, repMax: 8, restSec: 120 },
      { ex: "サイドレイズ", sets: 3, repMin: 12, repMax: 15, restSec: 90 },
      { ex: "オーバーヘッドトライセプスエクステンション", sets: 3, repMin: 10, repMax: 12, restSec: 90 },
    ],
  },
  {
    id: "PULL",
    name: "PULL｜背中・二頭",
    items: [
      { ex: "チンニング（順手 or パラレル）", sets: 4, repMin: 6, repMax: 10, restSec: 90, note: "10回超えたら加重" },
      { ex: "シーテッドロー", sets: 3, repMin: 8, repMax: 10, restSec: 90 },
      { ex: "デッドリフト", sets: 3, repMin: 5, repMax: 6, restSec: 120 },
      { ex: "インクラインダンベルカール", sets: 3, repMin: 8, repMax: 10, restSec: 90 },
    ],
  },
  {
    id: "LEGS",
    name: "LEGS｜脚",
    items: [
      { ex: "バーベルスクワット", sets: 4, repMin: 6, repMax: 8, restSec: 120 },
      { ex: "レッグプレス", sets: 3, repMin: 10, repMax: 12, restSec: 90 },
      { ex: "ルーマニアンデッドリフト", sets: 3, repMin: 8, repMax: 10, restSec: 120 },
      { ex: "レッグカール", sets: 3, repMin: 10, repMax: 12, restSec: 90 },
    ],
  },
];

// ===== 保存 =====
let logs = JSON.parse(localStorage.getItem("logs") || "[]");
let chart;

// 推定1RM（Epley）
function e1RM(w, r) {
  return Math.round(w * (1 + r / 30));
}

function saveLogs() {
  localStorage.setItem("logs", JSON.stringify(logs));
}

function addLog(log) {
  logs.push(log);
  saveLogs();
}

// ===== DOM helper =====
function $(id) { return document.getElementById(id); }

// ===== 初期日付 =====
function setTodayDefault() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  $("date").value = `${yyyy}-${mm}-${dd}`;
}

// ===== UI: ワークアウト選択 =====
function populateWorkoutSelect() {
  const sel = $("workoutSelect");
  sel.innerHTML = "";

  WORKOUTS.forEach(w => {
    const o = document.createElement("option");
    o.value = w.id;
    o.textContent = w.name;
    sel.appendChild(o);
  });

  sel.value = WORKOUTS[0].id; // 初期PUSH
}

function currentWorkout() {
  return WORKOUTS.find(w => w.id === $("workoutSelect").value) || WORKOUTS[0];
}

function currentItem() {
  const w = currentWorkout();
  const ex = $("exerciseSelect").value;
  return w.items.find(i => i.ex === ex) || w.items[0];
}

// ===== UI: 種目プルダウン =====
function populateExerciseSelect() {
  const w = currentWorkout();
  const sel = $("exerciseSelect");
  sel.innerHTML = "";

  w.items.forEach(item => {
    const o = document.createElement("option");
    o.value = item.ex;
    o.textContent = item.ex;
    sel.appendChild(o);
  });

  sel.value = w.items[0].ex;
}

// ===== UI: セット番号 =====
function populateSetNo(maxSets) {
  const sel = $("setNo");
  const current = Number(sel.value || 1);

  sel.innerHTML = "";
  for (let s = 1; s <= 6; s++) { // 最大6まで出す（安全側）
    const o = document.createElement("option");
    o.value = String(s);
    o.textContent = `Set ${s}`;
    sel.appendChild(o);
  }
  // 種目の規定セット数より多いのは見た目で分かるようにするだけ（入力は許可）
  sel.value = String(Math.min(current, 6));
}

// ===== ガイド表示 =====
function renderGuide() {
  const item = currentItem();
  const rest = item.restSec === 120 ? "120秒" : "60〜90秒（目安）";
  const rep = `${item.repMin}–${item.repMax}回 × ${item.sets}セット`;
  const note = item.note ? `<br>📝 ${item.note}` : "";

  $("guide").innerHTML = `
    <strong>今日の目標</strong><br>
    ${rep}<br>
    休憩：${rest}${note}<br>
    強度：RIR 1〜2
  `;

  populateSetNo(item.sets);
}

// ===== フィルタ（記録済み種目） =====
function updateFilterExercises() {
  const sel = $("filterExercise");
  sel.innerHTML = "";

  const uniq = [...new Set(logs.map(l => l.exercise))].sort();
  if (uniq.length === 0) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "（記録がまだありません）";
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

// ===== チャート =====
function drawChart(exercise) {
  if (!exercise) return;

  const data = logs
    .filter(l => l.exercise === exercise)
    .sort((a, b) => a.date.localeCompare(b.date));

  const labels = data.map(d => d.date);
  const values = data.map(d => e1RM(d.weight, d.reps));

  if (chart) chart.destroy();

  chart = new Chart($("chart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `${exercise} 推定1RM`,
        data: values
      }]
    }
  });
}

// ===== 進め方ルール判定（前回比較） =====
function lastLogForExercise(exercise) {
  const data = logs
    .filter(l => l.exercise === exercise)
    .sort((a, b) => a.date.localeCompare(b.date));
  return data.length ? data[data.length - 1] : null;
}

function renderFeedback(newLog) {
  const prev = lastLogForExercise(newLog.exercise);

  // prev は「追加後」になっちゃうので、直前を探す
  const prev2 = logs
    .filter(l => l.exercise === newLog.exercise)
    .slice(0, -1)
    .sort((a, b) => a.date.localeCompare(b.date))
    .pop() || null;

  if (!prev2) {
    $("feedback").innerHTML = `✅ 初記録！この調子でRIR1〜2を守っていこう。`;
    return;
  }

  const wDiff = newLog.weight - prev2.weight;
  const rDiff = newLog.reps - prev2.reps;

  // 重量アップ時の回数落ち許容
  if (wDiff > 0) {
    if (rDiff >= -2) {
      $("feedback").innerHTML =
        `✅ 重量アップOK（前回比：重量 +${wDiff}kg / 回数 ${rDiff}）<br>ルール内（−1〜−2回までOK）`;
    } else {
      $("feedback").innerHTML =
        `⚠️ 落ちすぎ（前回比：重量 +${wDiff}kg / 回数 ${rDiff}）<br>−3回以上なので、次回は<strong>${(newLog.weight - 2.5).toFixed(1)}kg</strong>にして立て直し推奨`;
    }
    return;
  }

  // 同重量 or 減量時は“伸びたらOK”表示
  if (wDiff === 0 && rDiff > 0) {
    $("feedback").innerHTML = `✅ 同重量で回数UP（+${rDiff}回）。最高。`;
    return;
  }

  $("feedback").innerHTML =
    `ℹ️ 前回比：重量 ${wDiff}kg / 回数 ${rDiff}<br>毎週どれか1種目で重量 or 回数が伸びていればOK`;
}

// ===== セット番号を次に進める =====
function incrementSetNo() {
  const current = Number($("setNo").value || 1);
  const next = Math.min(current + 1, 6);
  $("setNo").value = String(next);
}

// ===== イベント =====
$("logForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const workoutId = $("workoutSelect").value;
  const exercise = $("exerciseSelect").value;

  const log = {
    date: $("date").value,
    workout: workoutId,
    exercise,
    setNo: Number($("setNo").value),
    weight: Number($("weight").value),
    reps: Number($("reps").value),
    rir: $("rir").value === "" ? null : Number($("rir").value),
  };

  addLog(log);

  updateFilterExercises();
  $("filterExercise").value = exercise;
  drawChart(exercise);
  renderFeedback(log);

  // 次セットへ（ワークアウト/種目は維持）
  incrementSetNo();
  $("weight").value = "";
  $("reps").value = "";
  $("rir").value = "";
});

$("workoutSelect").addEventListener("change", () => {
  populateExerciseSelect();
  renderGuide();
  $("feedback").innerHTML = "";
});

$("exerciseSelect").addEventListener("change", () => {
  renderGuide();
  $("feedback").innerHTML = "";
});

$("filterExercise").addEventListener("change", (e) => {
  drawChart(e.target.value);
});

$("clearBtn").addEventListener("click", () => {
  if (!confirm("全ログを削除します。よろしいですか？")) return;
  logs = [];
  saveLogs();
  updateFilterExercises();
  $("feedback").innerHTML = "";
  $("guide").innerHTML = "";
  if (chart) chart.destroy();
});

// ===== 初期化 =====
populateWorkoutSelect();
populateExerciseSelect();
setTodayDefault();
renderGuide();
updateFilterExercises();

if (logs.length > 0) {
  $("filterExercise").value = $("filterExercise").options[0].value;
  drawChart($("filterExercise").value);
}
