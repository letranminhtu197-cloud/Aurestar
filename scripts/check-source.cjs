'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const jsFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { if (['dist', 'node_modules'].includes(entry.name)) continue; walk(file); }
    else if (/\.(?:js|cjs)$/.test(entry.name)) jsFiles.push(file);
  }
}
walk(path.join(root, 'src'));
jsFiles.push(path.join(root, 'resources', 'aurestar-chrome', 'background.js'));
for (const file of jsFiles) {
  try { new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }); }
  catch (error) { process.stderr.write(`${error.stack || error}\n`); process.exit(1); }
}

const renderer = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
if (/(?<!\$)\$\([^\n]*\)\.forEach\s*\(/.test(renderer)) {
  throw new Error('A single-element query is used as a collection; use querySelectorAll / $$ for .forEach().');
}
for (const page of ['index.html', 'background-host.html', 'pomodoro-widget.html', 'itsuki.html', 'reminder.html', 'app/index.html']) {
  const html = fs.readFileSync(path.join(root, 'src', page), 'utf8');
  if (!/Content-Security-Policy/i.test(html)) throw new Error(`Missing Content-Security-Policy in ${page}`);
}

const mainProcess = fs.readFileSync(path.join(root, 'src', 'main.cjs'), 'utf8');
if (!/app\.requestSingleInstanceLock\(\)/.test(mainProcess)) throw new Error('Electron must enforce a single application instance.');
if (!/render-process-gone/.test(mainProcess) || !/webContents\.reload\(\)/.test(mainProcess)) throw new Error('Main window must have bounded renderer crash recovery.');
if (!/readJsonFile\(r\.filePaths\[0\]\)/.test(mainProcess)) throw new Error('Backup import must validate JSON before replacing live state.');
if (!/normalizeStateCollections\(merged,base\)/.test(mainProcess)) throw new Error('Loaded state collections must be normalized before rendering.');
const backgroundProcess = fs.readFileSync(path.join(root, 'resources', 'aurestar-chrome', 'background.js'), 'utf8');
const rendererProcess = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
if (!/case"updateHabit":/.test(backgroundProcess) || !/action\("updateHabit"/.test(rendererProcess)) throw new Error('Habit editing must be available in the UI and background action handler.');
if (/focusSessions\|\|\[\]\)\]\.sort\([^]*?\.slice\(0,10\)/.test(rendererProcess)) throw new Error('Focus history must not be truncated to ten sessions.');
if (/workoutSessions\|\|\[\]\)\.slice\(-8\)/.test(rendererProcess)) throw new Error('Training history must not be truncated to eight sessions.');
const readyStart = mainProcess.indexOf('app.whenReady().then(()=>{');
const readyEnd = mainProcess.indexOf('\n});', readyStart);
const displaySubscriptions = [...mainProcess.matchAll(/screen\.on\(['"]display-(?:metrics-changed|added|removed)['"]/g)];
if (readyStart < 0 || readyEnd < 0 || displaySubscriptions.length !== 3 || displaySubscriptions.some(match => match.index < readyStart || match.index > readyEnd)) {
  throw new Error('Electron screen event subscriptions must be registered after app.whenReady().');
}

process.stdout.write(`Checked ${jsFiles.length} JavaScript files and desktop security invariants.\n`);

const appRenderer = fs.readFileSync(path.join(root, 'src', 'app', 'App.tsx'), 'utf8');
const v2Preload = fs.readFileSync(path.join(root, 'src', 'preload-v2.cjs'), 'utf8');
const v2Handlers = [...mainProcess.matchAll(/ipcMain\.handle\('v2:[^']+'/g)];
const guardedV2Handlers = [...mainProcess.matchAll(/ipcMain\.handle\('v2:[^']+',\s*(?:event|\(event,[^)]*\))=>\{assertWorkspaceSender\(event\);/g)];
if (!/function assertWorkspaceSender\(event\)/.test(mainProcess) || guardedV2Handlers.length !== v2Handlers.length) {
  throw new Error('Every workspace IPC handler must verify that its caller is the trusted React window.');
}
const mainWindowStart = mainProcess.indexOf('function createWindow');
const mainWindowEnd = mainProcess.indexOf('\nfunction ', mainWindowStart + 10);
const mainWindowSource = mainProcess.slice(mainWindowStart, mainWindowEnd > mainWindowStart ? mainWindowEnd : undefined);
if (!/contextIsolation:\s*true/.test(mainWindowSource) || !/nodeIntegration:\s*false/.test(mainWindowSource) || !/sandbox:\s*true/.test(mainWindowSource)) {
  throw new Error('The primary Electron window must use context isolation, disabled Node integration and sandboxing.');
}
if (!/contextBridge\.exposeInMainWorld\('aurestarV2', api\)/.test(v2Preload) || /exposeInMainWorld\([^\n]*ipcRenderer/.test(v2Preload)) {
  throw new Error('The React renderer must use a narrow, allowlisted preload bridge.');
}
for (const feature of ['function SettingsModal', 'search-results', 'task-board', 'archiveGoal', 'duplicateProject', 'saveSettings']) {
  if (!appRenderer.includes(feature)) throw new Error(`Phase 1 UI is missing required interaction: ${feature}`);
}
for (const channel of ['v2:goal:archive', 'v2:project:archive', 'v2:task:archive', 'v2:goal:duplicate', 'v2:project:duplicate', 'v2:task:duplicate', 'v2:settings:save']) {
  if (!mainProcess.includes(channel)) throw new Error(`Missing main-process IPC handler: ${channel}`);
}
