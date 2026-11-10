'use strict';

const port = Number(process.env.AURESTAR_CDP_PORT || 9222);
const mode = process.env.AURESTAR_SMOKE_MODE || 'write';
const deadline = Date.now() + 30000;

async function waitForTarget() {
  while (Date.now() < deadline) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json/list');
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find(target => target.type === 'page' && /index\.html/.test(target.url || ''));
        if (page?.webSocketDebuggerUrl) return page;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Electron renderer did not expose a DevTools page within 30 seconds.');
}

async function main() {
  const target = await waitForTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map();

  socket.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(message.error.message || 'DevTools command failed.'));
    else item.resolve(message.result);
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('DevTools WebSocket connection timed out.')), 10000);
    socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('DevTools WebSocket connection failed.')); }, { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error('DevTools command timed out: ' + method));
    }, 20000);
  });

  try {
    await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
    const writeExpression = [
      '(async () => {',
      'const pause = ms => new Promise(resolve => setTimeout(resolve, ms));',
      'for (let i = 0; i < 40; i++) { const root = document.querySelector("#root"); if (root && root.innerText.includes("AURESTAR")) break; await pause(250); }',
      'const root = document.querySelector("#root");',
      'if (!root || !root.innerText.includes("AURESTAR")) throw new Error("React application shell did not render.");',
      'const api = window.aurestarV2;',
      'if (!api) throw new Error("The secure SQLite preload bridge is unavailable.");',
      'if (document.documentElement.scrollWidth > window.innerWidth + 2) throw new Error("The 1024px desktop layout overflows horizontally.");',
      'const themeButton = [...document.querySelectorAll("button")].find(button => button.title === "Đổi giao diện sáng/tối");',
      'if (!themeButton) throw new Error("Theme toggle is missing.");',
      'const initialTheme = document.documentElement.dataset.theme;',
      'themeButton.click(); await pause(350);',
      'if (document.documentElement.dataset.theme === initialTheme) throw new Error("Theme toggle did not change the active theme.");',
      'let prefs = await api.loadWorkspace();',
      'if (prefs.settings.theme !== document.documentElement.dataset.theme) throw new Error("Theme preference was not persisted to SQLite.");',
      'themeButton.click(); await pause(350);',
      'const collapse = document.querySelector("button[title=\\"Thu gọn thanh bên\\"]");',
      'if (!collapse) throw new Error("Sidebar collapse control is missing.");',
      'collapse.click(); await pause(250);',
      'if (!document.querySelector(".app-shell.is-collapsed")) throw new Error("Sidebar did not collapse.");',
      'prefs = await api.loadWorkspace(); if (prefs.settings.sidebarCollapsed !== true) throw new Error("Sidebar state was not persisted.");',
      'document.querySelector("button[title=\\"Mở rộng thanh bên\\"]")?.click(); await pause(250);',
      'const goal = await api.saveGoal({ title: "AURESTAR CI restart marker", progressMode: "automatic" });',
      'const project = await api.saveProject({ name: "AURESTAR CI restart project", goalIds: [goal.id] });',
      'const task = await api.saveTask({ title: "AURESTAR CI restart task", projectId: project.id, goalIds: [goal.id], tags: ["ci-smoke"], dueTime: "09:30" }); const formulaTask = await api.saveTask({ title: "=1+1" });',
      'await api.saveMilestone({ goalId: goal.id, title: "AURESTAR CI restart milestone" });',
      'let data = await api.loadWorkspace();',
      'const linked = data.tasks.find(item => item.id === task.id);',
      'if (!linked || linked.project_id !== project.id || !linked.goalIds.includes(goal.id) || !linked.tags.includes("ci-smoke")) throw new Error("SQLite task relationships or tags did not round-trip through IPC.");',
      'if (!data.milestones.some(item => item.goal_id === goal.id)) throw new Error("Milestone did not persist.");',
      'if (data.goals.find(item => item.id === goal.id)?.progress_value !== 0) throw new Error("Automatic goal progress did not initialize correctly.");',
      'await api.setTaskStatus(task.id, "completed"); await api.archiveTask(task.id, true);',
      'data = await api.loadWorkspace(); if (!data.tasks.find(item => item.id === task.id)?.archived_at) throw new Error("Task archive did not persist.");',
      'await api.archiveTask(task.id, false);',
      'const stamp = new Date(); const date = stamp.toISOString().slice(0,10); const week = new Date(stamp); week.setHours(12,0,0,0); week.setDate(week.getDate()-((week.getDay()+6)%7)); const fmt = d => d.toISOString().slice(0,10); const weekStart = fmt(week); week.setDate(week.getDate()+6); const weekEnd = fmt(week);',
      'const habit = await api.saveHabit({ name: "AURESTAR CI habit marker", frequency: "daily", targetCount: 1, startDate: date });',
      'await api.logHabit({ habitId: habit.id, date, completedCount: 1, value: 1, note: "CI smoke log" });',
      'await api.saveFocusSession({ id: "aurestar-ci-focus-session", taskId: task.id, sessionType: "focus", startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), plannedSeconds: 1500, actualSeconds: 1200, status: "completed", note: "AURESTAR CI focus marker" });',
      'const journal = await api.saveJournalEntry({ date, entryType: "freewriting", title: "AURESTAR CI journal marker", content: "# CI journal\\nPersistence check" });',
      'await api.saveWeeklyReview({ weekStart, weekEnd, wins: "CI weekly wins", challenges: "CI challenge", lessons: "CI lesson", nextWeek: "CI next week", rating: 5 });',
      'const insight = await api.getInsights(date, date); if (insight.focus.seconds !== 1200) throw new Error("Phase 2 focus analytics did not include the persisted session.");',
      'const search = await api.searchAll("AURESTAR CI journal marker", 10); if (!search.some(item => item.type === "journal" && item.id === journal.id)) throw new Error("Phase 2 global search did not find the Journal entry.");',
      'const snapshot = await api.exportData(); const preview = await api.previewImport(snapshot); if (!preview.valid || !snapshot.tables.habits.some(item => item.id === habit.id) || !snapshot.tables.journal_entries.some(item => item.id === journal.id)) throw new Error("Phase 2 JSON export/import preview did not round-trip.");',
      'const phase2 = { habitId: habit.id, journalId: journal.id, reviewStart: weekStart, date, formulaTaskId: formulaTask.id };',
      'await api.saveSettings({ theme: "dark", density: "compact", sidebarCollapsed: false, defaultLandingPage: "tasks", language: "vi" });',
      'data = await api.loadWorkspace(); if (data.settings.density !== "compact" || data.settings.language !== "vi") throw new Error("Settings did not persist.");',
      'return { ok: true, mode: "write", title: document.title, theme: initialTheme, goal: goal.title, phase2 };',
      '})()'
    ].join('\n');

    const uiAfterReload = [
      '(async () => {',
      'const pause = ms => new Promise(resolve => setTimeout(resolve, ms));',
      'for (let i = 0; i < 40; i++) { const root = document.querySelector("#root"); if (root && root.innerText.includes("AURESTAR")) break; await pause(250); }',
      'const root = document.querySelector("#root"); if (!root || !root.innerText.includes("AURESTAR")) throw new Error("Renderer did not recover after page reload.");',
      'const goalsNav = [...document.querySelectorAll(".nav-item")].find(button => button.innerText.includes("Mục tiêu")); goalsNav?.click(); await pause(500);',
      'if (!document.querySelector("#root")?.innerText.includes("AURESTAR CI restart marker")) throw new Error("Goals view did not load the persisted Goal after reload.");',
      'return { ok: true, mode: "ui-after-reload", page: "Goals", persistedGoalVisible: true };',
      '})()'
    ].join('\n');
    const uiAfterSearch = [
      '(async () => {',
      'const pause = ms => new Promise(resolve => setTimeout(resolve, ms));',
      'const projectsNav = [...document.querySelectorAll(".nav-item")].find(button => button.innerText.includes("Dự án")); projectsNav?.click(); await pause(150);',
      'if (![...document.querySelectorAll("h2")].some(el => el.innerText === "Dự án")) throw new Error("Projects navigation failed.");',
      'const tasksNav = [...document.querySelectorAll(".nav-item")].find(button => button.innerText.includes("Công việc")); tasksNav?.click(); await pause(150);',
      'if (![...document.querySelectorAll("h2")].some(el => el.innerText === "Công việc")) throw new Error("Tasks navigation failed.");',
      'for (const [label, heading] of [["Thói quen","Thói quen"],["Tập trung","Tập trung"],["Nhật ký","Nhật ký"],["Tổng kết tuần","Tổng kết tuần"],["Phân tích","Phân tích"]]) { const item=[...document.querySelectorAll(".nav-item")].find(button=>button.innerText.includes(label)); if(!item) throw new Error("Missing Vietnamese navigation item: "+label); item.click(); await pause(250); if(![...document.querySelectorAll("h2")].some(el=>el.innerText===heading)) throw new Error("Phase 2 page did not render: "+heading); if(label==="Thói quen"&&!document.querySelector(".page-content")?.innerText.includes("AURESTAR CI habit marker")) throw new Error("Persisted Habit was not visible in the Habits page."); if(label==="Nhật ký"&&!document.querySelector(".page-content")?.innerText.includes("AURESTAR CI journal marker")) throw new Error("Persisted Journal entry was not visible."); }',
      'const dataPage=[...document.querySelectorAll(".nav-item")].find(button=>button.innerText.includes("Quản lý dữ liệu")); if(!dataPage) throw new Error("Data Management navigation item is missing."); dataPage.click(); await pause(200); if(![...document.querySelectorAll("h3")].some(el=>el.innerText==="Quản lý dữ liệu")) throw new Error("Data Management page did not render."); const csvSelect=[...document.querySelectorAll("select")].find(el=>[...el.options].some(option=>option.value==="tasks")); if(!csvSelect) throw new Error("CSV table selector is missing."); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(csvSelect,"tasks"); csvSelect.dispatchEvent(new Event("change",{bubbles:true})); await pause(50); const csvButton=[...document.querySelectorAll("button")].find(button=>button.innerText==="Xuất CSV"); if(!csvButton) throw new Error("CSV export control is missing."); const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldClick=HTMLAnchorElement.prototype.click; URL.createObjectURL=blob=>{window.__aurestarCsvPromise=blob.arrayBuffer();return "blob:smoke";}; URL.revokeObjectURL=()=>{}; HTMLAnchorElement.prototype.click=function(){}; csvButton.click(); await pause(100); const bytes=new Uint8Array(await window.__aurestarCsvPromise); const csv=new TextDecoder("utf-8").decode(bytes); URL.createObjectURL=oldCreate; URL.revokeObjectURL=oldRevoke; HTMLAnchorElement.prototype.click=oldClick; const csvChecks={bom:bytes[0]===0xEF&&bytes[1]===0xBB&&bytes[2]===0xBF,header:csv.includes("Tiêu đề"),task:csv.includes("AURESTAR CI restart task"),crlf:csv.includes(String.fromCharCode(13,10)),formula:csv.includes(String.fromCharCode(34,39)+"=1+1"+String.fromCharCode(34))}; if(Object.values(csvChecks).some(value=>!value)) throw new Error("CSV export checks failed: "+JSON.stringify(csvChecks)+"; sample="+csv.slice(0,350)); const settingsButton=[...document.querySelectorAll("button")].find(button=>button.title==="Mở cài đặt"); if(!settingsButton) throw new Error("Settings control is missing."); settingsButton.click(); await pause(250); if(![...document.querySelectorAll(".settings-modal h3")].some(el=>el.innerText==="Quản lý dữ liệu") || ![...document.querySelectorAll(".settings-modal button")].some(el=>el.innerText==="Xóa toàn bộ dữ liệu")) throw new Error("Vietnamese Settings and Data Management controls did not render."); document.querySelector(".settings-modal .icon-button")?.click(); await pause(100);',
      'const journalNav=[...document.querySelectorAll(".nav-item")].find(button=>button.innerText.includes("Nhật ký")); journalNav?.click(); await pause(250); const type=[...document.querySelectorAll("select")].find(el=>[...el.options].some(o=>o.value==="freewriting")); if(type){Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(type,"freewriting");type.dispatchEvent(new Event("change",{bubbles:true}));await pause(100);} const editor=document.querySelector("textarea[placeholder=\\\"Viết bằng Markdown...\\\"]"); if(!editor) throw new Error("Journal Markdown editor is missing."); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(editor,"# Kiểm thử\\n**Markdown**"); editor.dispatchEvent(new Event("input",{bubbles:true})); await pause(100); const preview=[...document.querySelectorAll("button")].find(button=>button.innerText==="Xem trước"); if(!preview) throw new Error("Markdown preview control is missing."); preview.click(); await pause(100); if(!document.querySelector(".page-content")?.innerText.includes("Kiểm thử") || ![...document.querySelectorAll("strong")].some(el=>el.innerText==="Markdown")) throw new Error("Journal Markdown preview did not render formatted content.");',
      'const quick = [...document.querySelectorAll("button")].find(button => button.innerText.includes("Thêm nhanh")); quick?.click(); await pause(150);',
      'if (!document.querySelector(".editor-modal")) throw new Error("Quick Add did not open the task editor.");',
      'document.querySelector(".editor-modal .modal-head .icon-button")?.click();',
      'return { ok: true, mode: "navigation-after-search", pages: ["Projects", "Tasks"], quickAdd: true };',
      '})()'
    ].join('\n');

    const verifyExpression = [
      '(async () => {',
      'const api = window.aurestarV2;',
      'const data = await api.loadWorkspace();',
      'const goal = data.goals.find(item => item.title === "AURESTAR CI restart marker");',
      'const project = data.projects.find(item => item.name === "AURESTAR CI restart project");',
      'const task = data.tasks.find(item => item.title === "AURESTAR CI restart task"); const formulaTask = data.tasks.find(item => item.title === "=1+1");',
      'const milestone = data.milestones.find(item => item.title === "AURESTAR CI restart milestone");',
      'if (!goal || !project || !task || !formulaTask || !milestone) throw new Error("Data was not preserved after restarting the packaged application.");',
      'if (task.project_id !== project.id || !task.goalIds.includes(goal.id) || !task.tags.includes("ci-smoke")) throw new Error("Relationships were not preserved after application restart.");',
      'if (data.settings.defaultLandingPage !== "tasks" || data.settings.density !== "compact" || data.settings.theme !== "dark" || data.settings.language !== "vi") throw new Error("Settings were not preserved after application restart.");',
      'const habit = data && (await api.listHabits()).find(item => item.name === "AURESTAR CI habit marker");',
      'const focus = (await api.listFocusSessions(100)).find(item => item.id === "aurestar-ci-focus-session");',
      'const journal = (await api.listJournalEntries(100)).find(item => item.title === "AURESTAR CI journal marker");',
      'const review = (await api.listWeeklyReviews(100)).find(item => item.wins === "CI weekly wins");',
      'if (!habit || !focus || !journal || !review) throw new Error("Phase 2 records did not persist across the packaged app restart: "+JSON.stringify({habit:!!habit,focus:!!focus,journal:!!journal,review:!!review,habitCount:(await api.listHabits()).length,focusCount:(await api.listFocusSessions(100)).length,journalCount:(await api.listJournalEntries(100)).length,reviewCount:(await api.listWeeklyReviews(100)).length}));',
      'if (!(await api.searchAll("AURESTAR CI journal marker", 10)).some(item => item.id === journal.id)) throw new Error("Phase 2 search did not survive restart.");',
      'if (!(await api.previewImport(await api.exportData())).valid) throw new Error("Phase 2 export/preview validation failed after restart.");',

      'await api.deleteTask(task.id); await api.deleteTask(formulaTask.id); await api.deleteProject(project.id); await api.deleteGoal(goal.id);',
      'return { ok: true, mode: "verify-restart", persistedGoal: goal.title, persistedSettings: true, phase2: { habit: habit.name, journal: journal.title, review: review.week_start, focus: focus.id } };',
      '})()'
    ].join('\n');

    const expression = mode === 'verify' ? verifyExpression : writeExpression;
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    await send('Emulation.clearDeviceMetricsOverride');
    if (mode === 'write') {
      await send('Page.reload', { ignoreCache: true });
      await new Promise(resolve => setTimeout(resolve, 1200));
      for (let i = 0; i < 40; i++) { try { const ready = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }); const shell = await send('Runtime.evaluate', { expression: '!!document.querySelector(\"#root\") && !document.querySelector(\".loading-state\")', returnByValue: true }); if (ready.result?.value === 'complete' && shell.result?.value === true) break; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
      const uiResult = await send('Runtime.evaluate', { expression: uiAfterReload, awaitPromise: true, returnByValue: true });
      if (uiResult.exceptionDetails || !uiResult.result?.value?.ok) throw new Error(uiResult.exceptionDetails?.text || uiResult.result?.value?.error || 'Post-reload UI smoke test failed.');
      await send('Runtime.evaluate', { expression: 'document.querySelector(".top-search input")?.focus()', returnByValue: true });
      await send('Input.insertText', { text: 'AURESTAR CI restart marker' });
      await new Promise(resolve => setTimeout(resolve, 400));
      const searchResult = await send('Runtime.evaluate', { expression: 'document.querySelector(".search-results")?.innerText.includes("AURESTAR CI restart marker") === true', returnByValue: true });
      if (searchResult.result?.value !== true) throw new Error('Global search did not return the persisted Goal after reload.');
      await send('Runtime.evaluate', { expression: 'document.querySelector(".top-search input")?.blur()', returnByValue: true });
      const navResult = await send('Runtime.evaluate', { expression: uiAfterSearch, awaitPromise: true, returnByValue: true });
      if (navResult.exceptionDetails || !navResult.result?.value?.ok) throw new Error(navResult.exceptionDetails?.text || navResult.result?.value?.error || 'Navigation/Quick Add smoke test failed.');
      process.stdout.write('Renderer UI smoke test passed: ' + JSON.stringify(uiResult.result.value) + ' ' + JSON.stringify(navResult.result.value) + '\n');
    }

    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Renderer smoke test threw an exception.');
    const value = result.result?.value;
    if (!value?.ok) throw new Error(value?.error || 'Renderer smoke test did not return success.');
    process.stdout.write('Packaged Electron smoke test passed: ' + JSON.stringify(value) + '\n');
  } finally {
    socket.close();
  }
}

main().catch(error => {
  process.stderr.write((error.stack || String(error)) + '\n');
  process.exitCode = 1;
});
