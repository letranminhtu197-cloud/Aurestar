const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourceDir = process.env.AURESTAR_SOURCE_DIR || path.join(__dirname, '..', 'app-source');
const rendererPath = path.join(sourceDir, 'renderer.js');
const renderer = fs.readFileSync(rendererPath, 'utf8');
const match = renderer.match(/function bindGlobal\(\)\s*\{[\s\S]*?\n\}/);

test('bindGlobal is safe when optional task controls are absent', () => {
  assert.ok(match, 'bindGlobal() must exist in renderer.js');
  const queried = [];
  const $$ = (selector) => { queried.push(selector); return []; };
  const $ = () => null;
  const bindGlobal = vm.runInNewContext(`(${match[0]})`, {
    $$,
    $,
    action: async () => null,
    confirm: () => false,
    renderShell: () => {},
    openTaskForm: () => {},
    openTaskMenu: () => {},
    navigate: () => {},
    closeModal: () => {},
    startGymFromTask: async () => {}
  });

  assert.doesNotThrow(() => bindGlobal());
  assert.ok(queried.includes('[data-edit-task]'));
  assert.ok(queried.includes('[data-task-menu]'));
});

test('all recovered JavaScript entry points parse successfully', () => {
  const files = ['main.cjs', 'preload.cjs', 'renderer.js', 'itsuki.js', 'pomodoro-widget.js', 'bridge-alias.js'];
  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    assert.ok(fs.existsSync(filePath), `${file} should exist in recovered source`);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.length > 0, `${file} should not be empty`);
    new vm.Script(content, { filename: file });
  }
});
