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


/* Aurestar viewport scrolling invariants. */
const styles = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const rendererSource = fs.readFileSync(path.join(root, 'src', 'renderer.js'), 'utf8');
const viewportStart = styles.lastIndexOf('AURESTAR VIEWPORT LAYOUT SYSTEM');
if (viewportStart < 0) throw new Error('Missing the shared Aurestar viewport layout system.');
const viewportStyles = styles.slice(viewportStart);
const viewportRequirements = [
  ['fixed application shell', /\.app-shell\s*\{[^}]*overflow\s*:\s*hidden/s],
  ['fixed page viewport', /\.view,\s*#view\s*\{[^}]*overflow\s*:\s*hidden/s],
  ['independent task-list scrolling', /\.task-reference-groups\s*\{[^}]*overflow-x\s*:\s*hidden[^}]*overflow-y\s*:\s*auto/s],
  ['independent focus-history scrolling', /\.focus-history-scroll\s*\{[^}]*overflow-x\s*:\s*hidden[^}]*overflow-y\s*:\s*auto/s],
  ['independent Progress scrolling', /\.progress-v2-scroll\s*\{[^}]*overflow-x\s*:\s*hidden[^}]*overflow-y\s*:\s*auto/s],
  ['independent Training scrolling', /\.gym-page-scroll\s*\{[^}]*overflow-x\s*:\s*hidden[^}]*overflow-y\s*:\s*auto/s],
];
for (const [label, pattern] of viewportRequirements) {
  if (!pattern.test(viewportStyles)) throw new Error(`Missing viewport requirement: ${label}.`);
}
if (!rendererSource.includes('class="progress-v2-scroll"')) {
  throw new Error('Progress lower sections must be inside their own scroll container.');
}
if (!rendererSource.includes('class="gym-page-scroll"')) {
  throw new Error('Training guidance, schedule and history must be inside their own scroll container.');
}
const cssWithoutComments = viewportStyles.replace(/\/\*[\s\S]*?\*\//g, '');
if ((cssWithoutComments.match(/\{/g) || []).length !== (cssWithoutComments.match(/\}/g) || []).length) {
  throw new Error('Unbalanced CSS rule braces in the viewport layout system.');
}

process.stdout.write(`Checked ${jsFiles.length} JavaScript files and desktop security invariants.\n`);
