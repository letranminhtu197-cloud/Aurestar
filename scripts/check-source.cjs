'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const jsFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
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
for (const page of ['index.html', 'background-host.html', 'pomodoro-widget.html', 'itsuki.html', 'reminder.html']) {
  const html = fs.readFileSync(path.join(root, 'src', page), 'utf8');
  if (!/Content-Security-Policy/i.test(html)) throw new Error(`Missing Content-Security-Policy in ${page}`);
}

const mainProcess = fs.readFileSync(path.join(root, 'src', 'main.cjs'), 'utf8');
if (!/app\.requestSingleInstanceLock\(\)/.test(mainProcess)) throw new Error('Electron must enforce a single application instance.');
if (!/render-process-gone/.test(mainProcess) || !/webContents\.reload\(\)/.test(mainProcess)) throw new Error('Main window must have bounded renderer crash recovery.');
if (!/readJsonFile\(r\.filePaths\[0\]\)/.test(mainProcess)) throw new Error('Backup import must validate JSON before replacing live state.');
if (!/normalizeStateCollections\(merged,base\)/.test(mainProcess)) throw new Error('Loaded state collections must be normalized before rendering.');
const readyStart = mainProcess.indexOf('app.whenReady().then(()=>{');
const readyEnd = mainProcess.indexOf('\n});', readyStart);
const displaySubscriptions = [...mainProcess.matchAll(/screen\.on\(['"]display-(?:metrics-changed|added|removed)['"]/g)];
if (readyStart < 0 || readyEnd < 0 || displaySubscriptions.length !== 3 || displaySubscriptions.some(match => match.index < readyStart || match.index > readyEnd)) {
  throw new Error('Electron screen event subscriptions must be registered after app.whenReady().');
}

process.stdout.write(`Checked ${jsFiles.length} JavaScript files and desktop security invariants.\n`);
