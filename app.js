// =========================
// Workout Log (SPA)
// record / presets / history
// with goals based on last performance
// =========================

// ----- Storage -----
const DB_KEY = "workoutlog_v2";

function initDB() {
  const db = { version: 2, presets: [], sessions: [], ui: { activeSessionId: null } };
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}
function loadDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return initDB();
  try {
    const db = JSON.parse(raw);
    if (!db.version) return initDB();
    if (!Array.isArray(db.presets)) db.presets = [];
    if (!Array.isArray(db.sessions)) db.sessions = [];
    if (!db.ui) db.ui = { activeSessionId: null };
    return db;
  } catch {
    return initDB();
  }
}
function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
function uid(prefix = "id") {
  return `${prefix}_${(crypto.randomUUID ? crypto.randomUUID() : Date.now() + "_" + Math.random().toString(16).slice(2))}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ----- Goal logic (筋トレMEMO風：ダブルプログレッション 8-12) -----
function pickPrevBestSet(sets) {
  if (!sets || !sets.length) return null;
  return sets.reduce((best, cur) => {
    if (!best) return cur;
    if (cur.w > best.w) return cur;
    if (cur.w === best.w && cur.r > best.r) return cur;
    return best;
  }, null);
}
function getPrevForExercise(db, exerciseName) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const s = db.sessions[i];
    const item = (s.items || []).find(it => it.name === exerciseName);
    if (item && item.sets && item.sets.length) {
      const best = pickPrevBestSet(item.sets);
      return { session: s, best };
    }
  }
  return null;
}
function makeGoal(prevBest, rule) {
  const min = rule?.min ?? 8;
  const max = rule?.max ?? 12;
  const inc = rule?.inc ?? 2.5;

  if (!prevBest) {
    return { w: null, r: null, msg: `初回：${min}〜${max}回を狙う`, status: "warn" };
  }
  const w = prevBest.w, r = prevBest.r;

  if (r >= max) {
    return { w: round1(w + inc), r: min, msg: `前回${max}達成 → +${inc}kgで${min}回`, status: "ok" };
  }
  if (r >= min && r < max) {
    return { w: w, r: r + 1, msg: `同重量で+1回（${r + 1}回）`, status: "ok" };
  }
  return { w: w, r: min, msg: `まず${min}回を安定`, status: "warn" };
}
function round1(n) { return Math.round(n * 10) / 10; }

// ----- App state -----
let db = loadDB();
let route = "record";

// ----- DOM -----
const $ = (sel) => document.querySelector(sel);
const viewRecord = $("#view-record");
const viewPresets = $("#view-presets");
const viewHistory = $("#view-history");

const toastEl = $("#toast");
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastEl.__t);
  toastEl.__t = setTimeout(() => toastEl.classList.add("hidden"), 1800);
}

// ----- Drawer -----
const drawer = $("#drawer");
const drawerBackdrop = $("#drawerBackdrop");
function openDrawer() {
  drawer.classList.remove("hidden");
  drawerBackdrop.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  drawer.classList.add("hidden");
  drawerBackdrop.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
}
$("#btnMenu").addEventListener("click", openDrawer);
$("#btnBackup").addEventListener("click", openDrawer);
$("#btnDrawerClose").addEventListener("click", closeDrawer);
drawerBackdrop.addEventListener("click", closeDrawer);

// Export / Import / Reset
$("#btnExport").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `workoutlog_backup_${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("JSONを書き出しました");
});
$("#btnImport").addEventListener("click", () => $("#fileImport").click());
$("#fileImport").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!imported || !imported.version) throw new Error("invalid");
    db = imported;
    saveDB(db);
    renderAll();
    toast("読み込みOK");
    closeDrawer();
  } catch {
    toast("読み込み失敗：JSONが不正です");
  } finally {
    e.target.value = "";
  }
});
$("#btnReset").addEventListener("click", () => {
  if (!confirm("全データを削除します。よろしいですか？")) return;
  localStorage.removeItem(DB_KEY);
  db = loadDB();
  renderAll();
  toast("リセットしました");
  closeDrawer();
});

// ----- Tabs routing -----
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    const r = btn.dataset.route;
    setRoute(r);
  });
});
function setRoute(r) {
  route = r;
  renderAll();
  // URL hash (任意)
  location.hash = `#${route}`;
}
function initRouteFromHash() {
  const h = (location.hash || "").replace("#", "");
  if (h === "record" || h === "presets" || h === "history") route = h;
}
window.addEventListener("hashchange", () => {
  initRouteFromHash();
  renderAll();
});

// ----- Core helpers -----
function getActiveSession() {
  const id = db.ui?.activeSessionId;
  if (!id) return null;
  return db.sessions.find(s => s.id === id) || null;
}
function setActiveSession(id) {
  db.ui.activeSessionId = id;
  saveDB(db);
}
function stopActiveSession() {
  db.ui.activeSessionId = null;
  saveDB(db);
}

function ensureSampleIfEmpty() {
  if (db.presets.length) return;
  db.presets.push({
    id: uid("p"),
    name: "PUSH（サンプル）",
    items: [
      { name: "ベンチプレス", rule: { type: "double", min: 8, max: 12, inc: 2.5 } },
      { name: "ショルダープレス", rule: { type: "double", min: 8, max: 12, inc: 2.5 } },
      { name: "トライセプスプレスダウン", rule: { type: "double", min: 10, max: 15, inc: 2.5 } },
    ],
  });
  saveDB(db);
}
ensureSampleIfEmpty();

// ----- Render -----
function renderAll() {
  // activate view
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));

  if (route === "record") {
    viewRecord.classList.add("active");
    document.querySelector('.tab[data-route="record"]').classList.add("active");
    renderRecord();
  } else if (route === "presets") {
    viewPresets.classList.add("active");
    document.querySelector('.tab[data-route="presets"]').classList.add("active");
    renderPresets();
  } else {
    viewHistory.classList.add("active");
    document.querySelector('.tab[data-route="history"]').classList.add("active");
    renderHistory();
  }
}

function renderRecord() {
  const active = getActiveSession();

  // Preset selector
  const presetOptions = db.presets.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");

  const header = `
    <div class="card">
      <div class="row">
        <div class="cardTitle">記録</div>
        <span class="spacer"></span>
        ${active ? `<span class="pill accent">進行中</span>` : `<span class="pill">未開始</span>`}
      </div>
      <div class="row">
        <label class="muted">プリセット</label>
        <select id="selPreset" ${active ? "disabled" : ""}>${presetOptions}</select>
        ${active
          ? `<button id="btnFinish" class="btn ok">完了</button>
             <button id="btnCancelSession" class="btn danger">中止</button>`
          : `<button id="btnStart" class="btn primary">開始</button>`}
      </div>
      ${active ? `<p class="muted">「完了」で履歴に保存されます（すでに保存されていて、表示が確定するだけ）。</p>` : `<p class="muted">開始すると、各種目に「前回」と「今回目標」が出ます。</p>`}
    </div>
  `;

  let body = "";
  if (!active) {
    body = `
      <div class="card">
        <div class="cardTitle">使い方</div>
        <ul class="list">
          <li>まず「プリセット」でメニューを作成</li>
          <li>ここでプリセットを選んで開始</li>
          <li>各種目カードの「目標」を見ながら入力</li>
        </ul>
      </div>
    `;
  } else {
    body = `
      <div class="card">
        <div class="row">
          <div class="cardTitle">${escapeHtml(active.presetName)}（${active.date}）</div>
          <span class="spacer"></span>
          <button id="btnAddExerciseToday" class="btn">＋種目追加（今日だけ）</button>
        </div>
        <div class="hr"></div>
        <div class="grid2">
          ${active.items.map((ex, idx) => renderExerciseCard(active, ex, idx)).join("")}
        </div>
      </div>
    `;
  }

  viewRecord.innerHTML = header + body;

  // wire events
  if (!active) {
    $("#btnStart").addEventListener("click", () => {
      const presetId = $("#selPreset").value;
      const preset = db.presets.find(p => p.id === presetId);
      if (!preset) return toast("プリセットが見つかりません");

      const session = {
        id: uid("s"),
        date: todayStr(),
        presetId: preset.id,
        presetName: preset.name,
        items: preset.items.map(it => ({
          name: it.name,
          rule: it.rule || { type: "double", min: 8, max: 12, inc: 2.5 },
          sets: [],
        })),
      };
      db.sessions.push(session);
      setActiveSession(session.id);
      saveDB(db);
      toast("開始しました");
      renderRecord();
    });
  } else {
    $("#btnFinish").addEventListener("click", () => {
      stopActiveSession();
      toast("完了！");
      renderRecord();
      setRoute("history");
    });
    $("#btnCancelSession").addEventListener("click", () => {
      if (!confirm("このセッションを削除して中止しますか？")) return;
      const sid = active.id;
      db.sessions = db.sessions.filter(s => s.id !== sid);
      stopActiveSession();
      saveDB(db);
      toast("中止しました");
      renderRecord();
    });

    $("#btnAddExerciseToday").addEventListener("click", () => {
      const name = prompt("追加する種目名（今日だけ）");
      if (!name) return;
      const a = getActiveSession();
      if (!a) return;
      a.items.push({ name, rule: { type: "double", min: 8, max: 12, inc: 2.5 }, sets: [] });
      saveDB(db);
      toast("追加しました");
      renderRecord();
    });

    // delegate buttons inside exercises
    viewRecord.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const action = e.currentTarget.dataset.action;
        const exIndex = Number(e.currentTarget.dataset.exIndex);
        const setIndex = e.currentTarget.dataset.setIndex ? Number(e.currentTarget.dataset.setIndex) : null;

        const a = getActiveSession();
        if (!a) return;

        const ex = a.items[exIndex];
        if (!ex) return;

        if (action === "addSet") {
          ex.sets.push({ w: null, r: null });
          saveDB(db);
          renderRecord();
        }
        if (action === "delSet") {
          ex.sets.splice(setIndex, 1);
          saveDB(db);
          renderRecord();
        }
        if (action === "delExercise") {
          if (!confirm(`「${ex.name}」を今日のセッションから削除しますか？`)) return;
          a.items.splice(exIndex, 1);
          saveDB(db);
          renderRecord();
        }
      });
    });

    // inputs
    viewRecord.querySelectorAll("input[data-bind]").forEach(inp => {
      inp.addEventListener("input", (e) => {
        const a = getActiveSession();
        if (!a) return;

        const exIndex = Number(e.target.dataset.exIndex);
        const setIndex = Number(e.target.dataset.setIndex);
        const key = e.target.dataset.bind;

        const ex = a.items[exIndex];
        const st = ex?.sets?.[setIndex];
        if (!st) return;

        const val = e.target.value === "" ? null : Number(e.target.value);
        st[key] = Number.isFinite(val) ? val : null;
        saveDB(db);
      });
    });
  }
}

function renderExerciseCard(activeSession, exercise, exIndex) {
  const prev = getPrevForExercise(db, exercise.name);
  const prevText = prev?.best ? `前回: ${prev.best.w}kg × ${prev.best.r}` : "前回: なし";
  const goal = makeGoal(prev?.best, exercise.rule);
  const goalText = (goal.w != null && goal.r != null)
    ? `目標: ${goal.w}kg × ${goal.r}（${goal.msg}）`
    : `目標: ${goal.msg}`;

  const goalClass = goal.status === "ok" ? "goalOk" : "goalWarn";

  const setsHtml = (exercise.sets || []).map((s, i) => `
    <div class="setRow">
      <div class="setIdx">#${i + 1}</div>
      <input type="number" inputmode="decimal" placeholder="kg" value="${s.w ?? ""}"
        data-bind="w" data-ex-index="${exIndex}" data-set-index="${i}" />
      <input type="number" inputmode="numeric" placeholder="rep" value="${s.r ?? ""}"
        data-bind="r" data-ex-index="${exIndex}" data-set-index="${i}" />
      <button class="smallBtn danger" data-action="delSet" data-ex-index="${exIndex}" data-set-index="${i}">削除</button>
    </div>
  `).join("");

  return `
    <div class="exercise">
      <div class="row">
        <div class="exerciseTitle">${escapeHtml(exercise.name)}</div>
        <span class="spacer"></span>
        <button class="smallBtn danger" data-action="delExercise" data-ex-index="${exIndex}">種目削除</button>
      </div>
      <div class="exerciseMeta">
        <span>${prevText}</span>
      </div>
      <div class="exerciseGoal ${goalClass}">${goalText}</div>

      ${setsHtml ? `<div class="hr"></div>${setsHtml}` : `<p class="muted">セットが未入力です。</p>`}

      <div class="row">
        <button class="btn" data-action="addSet" data-ex-index="${exIndex}">＋セット追加</button>
      </div>
    </div>
  `;
}

function renderPresets() {
  const list = db.presets.map(p => `
    <div class="card">
      <div class="row">
        <div class="cardTitle">${escapeHtml(p.name)}</div>
        <span class="spacer"></span>
        <button class="btn" data-action="editPreset" data-id="${p.id}">編集</button>
        <button class="btn danger" data-action="delPreset" data-id="${p.id}">削除</button>
      </div>
      <div class="pills">
        ${(p.items || []).slice(0, 8).map(it => `<span class="pill">${escapeHtml(it.name)}</span>`).join("")}
        ${(p.items || []).length > 8 ? `<span class="pill">…</span>` : ``}
      </div>
    </div>
  `).join("");

  viewPresets.innerHTML = `
    <div class="card">
      <div class="row">
        <div class="cardTitle">プリセット</div>
        <span class="spacer"></span>
        <button id="btnNewPreset" class="btn primary">＋新規作成</button>
      </div>
      <p class="muted">作ったプリセットを「記録」で選んで開始。</p>
    </div>
    ${list || `<div class="card"><p class="muted">まだプリセットがありません。</p></div>`}
  `;

  $("#btnNewPreset").addEventListener("click", () => openPresetEditor(null));

  viewPresets.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const action = e.currentTarget.dataset.action;
      const id = e.currentTarget.dataset.id;
      if (action === "editPreset") openPresetEditor(id);
      if (action === "delPreset") {
        if (!confirm("このプリセットを削除しますか？")) return;
        db.presets = db.presets.filter(p => p.id !== id);
        saveDB(db);
        toast("削除しました");
        renderPresets();
      }
    });
  });
}

function openPresetEditor(presetId) {
  const preset = presetId ? db.presets.find(p => p.id === presetId) : null;
  const name = preset ? preset.name : "";
  const items = preset ? preset.items.map(it => it.name).join("\n") : "";

  const newName = prompt(
    preset ? "プリセット名を編集" : "プリセット名を入力",
    name || "PUSH"
  );
  if (!newName) return;

  const exText = prompt(
    "種目を1行ずつ入力（改行OK）\n例）ベンチプレス\nショルダープレス\nトライセプス",
    items || "ベンチプレス\nショルダープレス"
  );
  if (exText == null) return;

  const exerciseNames = exText.split("\n").map(s => s.trim()).filter(Boolean);
  if (!exerciseNames.length) return toast("種目が空です");

  const toItems = exerciseNames.map(n => ({
    name: n,
    rule: { type: "double", min: 8, max: 12, inc: 2.5 }, // 最初は固定でOK（後で種目別編集も可能）
  }));

  if (!preset) {
    db.presets.push({ id: uid("p"), name: newName, items: toItems });
    saveDB(db);
    toast("作成しました");
  } else {
    preset.name = newName;
    preset.items = toItems;
    saveDB(db);
    toast("更新しました");
  }
  renderPresets();
}

function renderHistory() {
  // newest first
  const sessions = [...db.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));

  const cards = sessions.map(s => {
    const totalSets = (s.items || []).reduce((sum, it) => sum + (it.sets?.length || 0), 0);
    return `
      <div class="card">
        <div class="row">
          <div class="cardTitle">${escapeHtml(s.presetName)}（${s.date}）</div>
          <span class="spacer"></span>
          <button class="btn" data-action="openSession" data-id="${s.id}">開く</button>
          <button class="btn danger" data-action="delSession" data-id="${s.id}">削除</button>
        </div>
        <div class="exerciseMeta">
          <span class="pill">種目 ${s.items?.length || 0}</span>
          <span class="pill">セット ${totalSets}</span>
        </div>
      </div>
    `;
  }).join("");

  viewHistory.innerHTML = `
    <div class="card">
      <div class="row">
        <div class="cardTitle">履歴</div>
        <span class="spacer"></span>
        <button id="btnBackToRecord" class="btn">記録へ</button>
      </div>
      <p class="muted">タップして詳細を表示。不要なら削除できます。</p>
    </div>
    ${cards || `<div class="card"><p class="muted">まだ履歴がありません。</p></div>`}
    <div id="historyDetail"></div>
  `;

  $("#btnBackToRecord").addEventListener("click", () => setRoute("record"));

  viewHistory.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const action = e.currentTarget.dataset.action;
      const id = e.currentTarget.dataset.id;

      if (action === "delSession") {
        if (!confirm("この履歴を削除しますか？")) return;
        db.sessions = db.sessions.filter(s => s.id !== id);
        if (db.ui.activeSessionId === id) db.ui.activeSessionId = null;
        saveDB(db);
        toast("削除しました");
        renderHistory();
      }
      if (action === "openSession") {
        const s = db.sessions.find(x => x.id === id);
        if (!s) return;
        renderHistoryDetail(s);
      }
    });
  });
}

function renderHistoryDetail(session) {
  const el = $("#historyDetail");
  const exHtml = (session.items || []).map(it => {
    const best = pickPrevBestSet(it.sets || []);
    const bestText = best ? `${best.w}kg×${best.r}` : "—";
    return `
      <div class="exercise">
        <div class="exerciseTitle">${escapeHtml(it.name)}</div>
        <div class="exerciseMeta">
          <span class="pill">ベスト ${bestText}</span>
          <span class="pill">セット ${(it.sets || []).length}</span>
        </div>
        ${(it.sets || []).map((s, i) => `
          <div class="setRow">
            <div class="setIdx">#${i + 1}</div>
            <div class="pill">${s.w ?? "—"}kg</div>
            <div class="pill">${s.r ?? "—"}rep</div>
          </div>
        `).join("")}
      </div>
    `;
  }).join("");

  el.innerHTML = `
    <div class="card">
      <div class="row">
        <div class="cardTitle">詳細：${escapeHtml(session.presetName)}（${session.date}）</div>
        <span class="spacer"></span>
        <button class="btn" id="btnCloseDetail">閉じる</button>
      </div>
      <div class="hr"></div>
      <div class="grid2">${exHtml}</div>
    </div>
  `;

  $("#btnCloseDetail").addEventListener("click", () => {
    el.innerHTML = "";
  });
}

// ----- utilities -----
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// init
initRouteFromHash();
renderAll();
