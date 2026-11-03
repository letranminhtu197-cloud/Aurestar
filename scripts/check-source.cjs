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
const readyStart = mainProcess.indexOf('app.whenReady().then(()=>{');
const readyEnd = mainProcess.indexOf('\n});', readyStart);
const displaySubscriptions = [...mainProcess.matchAll(/screen\.on\(['"]display-(?:metrics-changed|added|removed)['"]/g)];
if (readyStart < 0 || readyEnd < 0 || displaySubscriptions.length !== 3 || displaySubscriptions.some(match => match.index < readyStart || match.index > readyEnd)) {
  throw new Error('Electron screen event subscriptions must be registered after app.whenReady().');
}


/* Aurestar complete natural-flow layout invariants. */
const styles = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const layoutStart = styles.lastIndexOf('AURESTAR — COMPLETE PAGE LAYOUT REWORK');
if (layoutStart < 0) throw new Error('Missing the complete Aurestar page layout rework.');
const layoutStyles = styles.slice(layoutStart);
const layoutRequirements = [
  ['fixed app frame', /\.app-shell\s*\{[^}]*overflow\s*:\s*hidden/s],
  ['main content vertical scrolling', /\.view,\s*#view\s*\{[^}]*overflow-y\s*:\s*auto/s],
  ['touch / trackpad vertical scrolling', /\.view,\s*#view\s*\{[^}]*touch-action\s*:\s*pan-y/s],
  ['Overview responsive grid', /\.overview-v2-grid\s*\{[^}]*display\s*:\s*grid/s],
  ['Tasks responsive grid', /\.task-reference-layout\s*\{[^}]*display\s*:\s*grid/s],
  ['Focus responsive grid', /\.focus-workspace-grid\s*\{[^}]*display\s*:\s*grid/s],
  ['Calendar responsive grid', /\.calendar-core-fit\s*\{[^}]*display\s*:\s*grid/s],
  ['Progress natural-flow page', /\.progress-v2-scroll\s*\{\s*display\s*:\s*contents\s*!important/s],
  ['Training natural-flow page', /\.gym-page-scroll,\s*\.progress-v2-scroll\s*\{\s*display\s*:\s*contents\s*!important/s],
];
for (const [label, pattern] of layoutRequirements) {
  if (!pattern.test(layoutStyles)) throw new Error(`Missing layout invariant: ${label}.`);
}
for (const [label, fragment] of [
  ['unlimited Focus history', 'sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0)),isRunning='],
  ['unlimited Training history', '(state.workoutSessions||[]).slice().reverse().map(s=>'],
]) {
  if (!rendererSource.includes(fragment)) throw new Error(`Missing complete content rendering: ${label}.`);
}
if (rendererSource.includes('.slice(0,10),isRunning=')) {
  throw new Error('Focus history is still capped at ten sessions.');
}
if (rendererSource.includes('(state.workoutSessions||[]).slice(-8)')) {
  throw new Error('Training history is still capped at eight sessions.');
}
const cssWithoutComments = styles.replace(/\/\*[\s\S]*?\*\//g, '');
if ((cssWithoutComments.match(/\{/g) || []).length !== (cssWithoutComments.match(/\}/g) || []).length) {
  throw new Error('Unbalanced CSS rule braces in styles.css.');
}

process.stdout.write(`Checked ${jsFiles.length} JavaScript files and desktop security invariants.\n`);
