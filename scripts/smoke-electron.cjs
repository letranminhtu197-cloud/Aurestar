'use strict';

const port = Number(process.env.AURESTAR_CDP_PORT || 9222);
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
    }, 15000);
  });

  try {
    const expression = [
      '(async () => {',
      'const pause = ms => new Promise(resolve => setTimeout(resolve, ms));',
      'for (let i = 0; i < 40; i++) { const root = document.querySelector("#root"); if (root && root.innerText.includes("AURESTAR")) break; await pause(250); }',
      'const root = document.querySelector("#root");',
      'if (!root || !root.innerText.includes("AURESTAR")) throw new Error("React application shell did not render.");',
      'const api = window.aurestarV2;',
      'if (!api) throw new Error("The secure SQLite preload bridge is unavailable.");',
      'const goal = await api.saveGoal({ title: "CI smoke goal", progressMode: "automatic" });',
      'const project = await api.saveProject({ name: "CI smoke project", goalIds: [goal.id] });',
      'const task = await api.saveTask({ title: "CI smoke task", projectId: project.id, goalIds: [goal.id], tags: ["ci-smoke"], dueTime: "09:30" });',
      'await api.saveMilestone({ goalId: goal.id, title: "CI smoke milestone" });',
      'let data = await api.loadWorkspace();',
      'const linked = data.tasks.find(item => item.id === task.id);',
      'if (!linked || linked.project_id !== project.id || !linked.goalIds.includes(goal.id) || !linked.tags.includes("ci-smoke")) throw new Error("SQLite task relationships or tags did not round-trip through IPC.");',
      'if (!data.milestones.some(item => item.goal_id === goal.id)) throw new Error("Milestone did not persist.");',
      'if (data.goals.find(item => item.id === goal.id)?.progress_value !== 0) throw new Error("Goal data did not persist.");',
      'await api.setTaskStatus(task.id, "completed");',
      'await api.archiveTask(task.id, true);',
      'data = await api.loadWorkspace();',
      'if (!data.tasks.find(item => item.id === task.id)?.archived_at) throw new Error("Task archive did not persist.");',
      'await api.archiveTask(task.id, false);',
      'await api.saveSettings({ theme: "light", density: "compact", defaultLandingPage: "tasks" });',
      'data = await api.loadWorkspace();',
      'if (data.settings.theme !== "light" || data.settings.density !== "compact") throw new Error("Settings did not persist.");',
      'await api.deleteTask(task.id); await api.deleteProject(project.id); await api.deleteGoal(goal.id);',
      'return { ok: true, title: document.title, rootText: root.innerText.slice(0, 100) };',
      '})()'
    ].join('\n');
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Renderer smoke test threw an exception.');
    const value = result.result?.value;
    if (!value?.ok) throw new Error(value?.error || 'Renderer smoke test did not return success.');
    process.stdout.write('Electron renderer + secure IPC + SQLite smoke test passed: ' + JSON.stringify(value) + '\n');
  } finally {
    socket.close();
  }
}

main().catch(error => {
  process.stderr.write((error.stack || String(error)) + '\n');
  process.exitCode = 1;
});
