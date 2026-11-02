const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rendererPath = path.join(__dirname, '..', 'renderer.js');
const renderer = fs.readFileSync(rendererPath, 'utf8');
const match = renderer.match(/function bindGlobal\(\)\s*\{[\s\S]*?\n\}/);

test('bindGlobal is safe when optional task controls are absent', () => {
  assert.ok(match, 'bindGlobal() must exist in renderer.js');
  const queried = [];
  const $$ = (selector) => { queried.push(selector); return []; };
  // Mirrors querySelector(): null when a singular optional control is absent.
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

test('all shipped JavaScript entry points parse successfully', () => {
  for (const file of ['main.cjs', 'preload.cjs', 'renderer.js', 'itsuki.js', 'pomodoro-widget.js', 'bridge-alias.js']) {
    const filePath = path.join(__dirname, '..', file);
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.length > 0, `${file} should not be empty`);
    new vm.Script(content, { filename: file });
  }
});
