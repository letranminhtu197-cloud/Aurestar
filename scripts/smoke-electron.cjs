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
      'const themeButton = [...document.querySelectorAll("button")].find(button => button.title === "Toggle theme");',
      'if (!themeButton) throw new Error("Theme toggle is missing.");',
      'const initialTheme = document.documentElement.dataset.theme;',
      'themeButton.click(); await pause(350);',
      'if (document.documentElement.dataset.theme === initialTheme) throw new Error("Theme toggle did not change the active theme.");',
      'let prefs = await api.loadWorkspace();',
      'if (prefs.settings.theme !== document.documentElement.dataset.theme) throw new Error("Theme preference was not persisted to SQLite.");',
      'themeButton.click(); await pause(350);',
      'const collapse = document.querySelector("button[title=\\"Collapse sidebar\\"]");',
      'if (!collapse) throw new Error("Sidebar collapse control is missing.");',
      'collapse.click(); await pause(250);',
      'if (!document.querySelector(".app-shell.is-collapsed")) throw new Error("Sidebar did not collapse.");',
      'prefs = await api.loadWorkspace(); if (prefs.settings.sidebarCollapsed !== true) throw new Error("Sidebar state was not persisted.");',
      'document.querySelector("button[title=\\"Expand sidebar\\"]")?.click(); await pause(250);',
      'const goal = await api.saveGoal({ title: "AURESTAR CI restart marker", progressMode: "automatic" });',
      'const project = await api.saveProject({ name: "AURESTAR CI restart project", goalIds: [goal.id] });',
      'const task = await api.saveTask({ title: "AURESTAR CI restart task", projectId: project.id, goalIds: [goal.id], tags: ["ci-smoke"], dueTime: "09:30" });',
      'await api.saveMilestone({ goalId: goal.id, title: "AURESTAR CI restart milestone" });',
      'let data = await api.loadWorkspace();',
      'const linked = data.tasks.find(item => item.id === task.id);',
      'if (!linked || linked.project_id !== project.id || !linked.goalIds.includes(goal.id) || !linked.tags.includes("ci-smoke")) throw new Error("SQLite task relationships or tags did not round-trip through IPC.");',
      'if (!data.milestones.some(item => item.goal_id === goal.id)) throw new Error("Milestone did not persist.");',
      'if (data.goals.find(item => item.id === goal.id)?.progress_value !== 0) throw new Error("Automatic goal progress did not initialize correctly.");',
      'await api.setTaskStatus(task.id, "completed"); await api.archiveTask(task.id, true);',
      'data = await api.loadWorkspace(); if (!data.tasks.find(item => item.id === task.id)?.archived_at) throw new Error("Task archive did not persist.");',
      'await api.archiveTask(task.id, false);',
      'await api.saveSettings({ theme: "dark", density: "compact", sidebarCollapsed: false, defaultLandingPage: "tasks" });',
      'data = await api.loadWorkspace(); if (data.settings.density !== "compact") throw new Error("Settings did not persist.");',
      'return { ok: true, mode: "write", title: document.title, theme: initialTheme, goal: goal.title };',
      '})()'
    ].join('\n');

    const uiAfterReload = [
      '(async () => {',
      'const pause = ms => new Promise(resolve => setTimeout(resolve, ms));',
      'for (let i = 0; i < 40; i++) { const root = document.querySelector("#root"); if (root && root.innerText.includes("AURESTAR")) break; await pause(250); }',
      'const root = document.querySelector("#root"); if (!root || !root.innerText.includes("AURESTAR")) throw new Error("Renderer did not recover after page reload.");',
      'const goalsNav = [...document.querySelectorAll(".nav-item")].find(button => button.innerText.includes("Goals")); goalsNav?.click(); await pause(150);',
      'if (![...document.querySelectorAll("h2")].some(el => el.innerText === "Goals")) throw new Error("Goals navigation failed.");',
      'const projectsNav = [...document.querySelectorAll(".nav-item")].find(button => button.innerText.includes("Projects")); projectsNav?.click(); await pause(150);',
      'if (![...document.querySelectorAll("h2")].some(el => el.innerText === "Projects")) throw new Error("Projects navigation failed.");',
      'const tasksNav = [...document.querySelectorAll(".nav-item")].find(button => button.innerText.includes("Tasks")); tasksNav?.click(); await pause(150);',
      'if (![...document.querySelectorAll("h2")].some(el => el.innerText === "Tasks")) throw new Error("Tasks navigation failed.");',
      'const quick = [...document.querySelectorAll("button")].find(button => button.innerText.includes("Quick Add")); quick?.click(); await pause(150);',
      'if (!document.querySelector(".editor-modal")) throw new Error("Quick Add did not open the task editor.");',
      'document.querySelector(".editor-modal .modal-head .icon-button")?.click();',
      'return { ok: true, mode: "ui-after-reload", page: "Tasks", globalSearch: true, quickAdd: true };',
      '})()'
    ].join('\n');
    const verifyExpression = [
      '(async () => {',
      'const api = window.aurestarV2;',
      'const data = await api.loadWorkspace();',
      'const goal = data.goals.find(item => item.title === "AURESTAR CI restart marker");',
      'const project = data.projects.find(item => item.name === "AURESTAR CI restart project");',
      'const task = data.tasks.find(item => item.title === "AURESTAR CI restart task");',
      'const milestone = data.milestones.find(item => item.title === "AURESTAR CI restart milestone");',
      'if (!goal || !project || !task || !milestone) throw new Error("Data was not preserved after restarting the packaged application.");',
      'if (task.project_id !== project.id || !task.goalIds.includes(goal.id) || !task.tags.includes("ci-smoke")) throw new Error("Relationships were not preserved after application restart.");',
      'if (data.settings.defaultLandingPage !== "tasks" || data.settings.density !== "compact" || data.settings.theme !== "dark") throw new Error("Settings were not preserved after application restart.");',
      'await api.deleteTask(task.id); await api.deleteProject(project.id); await api.deleteGoal(goal.id);',
      'return { ok: true, mode: "verify-restart", persistedGoal: goal.title, persistedSettings: true };',
      '})()'
    ].join('\n');

    const expression = mode === 'verify' ? verifyExpression : writeExpression;
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    await send('Emulation.clearDeviceMetricsOverride');
    if (mode === 'write') {
      await send('Page.reload', { ignoreCache: true });
      await new Promise(resolve => setTimeout(resolve, 1200));
      for (let i = 0; i < 40; i++) { try { const ready = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }); const shell = await send('Runtime.evaluate', { expression: '!!document.querySelector(\"#root\") && !document.querySelector(\".loading-state\")', returnByValue: true }); if (ready.result?.value === 'complete' && shell.result?.value === true) break; } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
      await send('Runtime.evaluate', { expression: 'document.querySelector(".top-search input")?.focus()', returnByValue: true });
      await send('Input.insertText', { text: 'AURESTAR CI restart marker' });
      await new Promise(resolve => setTimeout(resolve, 400));
      const searchResult = await send('Runtime.evaluate', { expression: 'document.querySelector(".search-results")?.innerText.includes("AURESTAR CI restart marker") === true', returnByValue: true });
      if (searchResult.result?.value !== true) throw new Error('Global search did not return the persisted Goal after reload.');
      await send('Runtime.evaluate', { expression: 'document.querySelector(".top-search input")?.blur()', returnByValue: true });
      const uiResult = await send('Runtime.evaluate', { expression: uiAfterReload, awaitPromise: true, returnByValue: true });
      if (uiResult.exceptionDetails || !uiResult.result?.value?.ok) throw new Error(uiResult.exceptionDetails?.text || uiResult.result?.value?.error || 'Post-reload UI smoke test failed.');
      process.stdout.write('Renderer UI smoke test passed: ' + JSON.stringify(uiResult.result.value) + '\\n');
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
