let logs = JSON.parse(localStorage.getItem("logs") || "[]");
let chart;

function e1RM(w, r) {
  return Math.round(w * (1 + r / 30));
}

function saveLog(log) {
  logs.push(log);
  localStorage.setItem("logs", JSON.stringify(logs));
}

function updateFilter() {
  const sel = document.getElementById("filterExercise");
  sel.innerHTML = "";
  [...new Set(logs.map(l => l.exercise))].forEach(ex => {
    const o = document.createElement("option");
    o.value = ex;
    o.textContent = ex;
    sel.appendChild(o);
  });
}

function drawChart(exercise) {
  const data = logs.filter(l => l.exercise === exercise);
  const labels = data.map(d => d.date);
  const values = data.map(d => e1RM(d.weight, d.reps));

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("chart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "推定1RM",
        data: values
      }]
    }
  });
}

document.getElementById("logForm").onsubmit = e => {
  e.preventDefault();
  const log = {
    date: date.value,
    exercise: exercise.value,
    weight: +weight.value,
    reps: +reps.value,
    rir: +rir.value || null
  };
  saveLog(log);
  updateFilter();
  drawChart(log.exercise);
  e.target.reset();
};

document.getElementById("filterExercise").onchange = e =>
  drawChart(e.target.value);

updateFilter();
