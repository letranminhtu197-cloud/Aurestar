'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { mergeStores, migrateJsonStores, readJsonFile } = require('../src/core/persistence.cjs');
const { createAlarmScheduler } = require('../src/core/alarm-scheduler.cjs');

test('migration prioritizes current UI data, restores unique legacy records and saves backups', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aurestar-migration-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const canonicalPath = path.join(root, 'aurestar-data.json');
  const legacyPath = path.join(root, 'aurestar-chrome-storage.json');
  const backupDir = path.join(root, 'backups');
  fs.writeFileSync(canonicalPath, JSON.stringify({ settings: { theme: 'dark' }, tasks: [{ id: 'same', title: 'new' }, { id: 'new' }] }));
  fs.writeFileSync(legacyPath, JSON.stringify({ settings: { theme: 'light', language: 'vi' }, tasks: [{ id: 'same', title: 'old' }, { id: 'old' }] }));

  const result = migrateJsonStores({ canonicalPath, legacyPaths: [legacyPath], preferredPaths: [legacyPath], backupDir });
  assert.deepEqual(result.settings, { theme: 'light', language: 'vi' });
  assert.deepEqual(result.tasks, [{ id: 'same', title: 'old' }, { id: 'old' }, { id: 'new' }]);
  assert.equal(fs.readdirSync(backupDir).length, 2);
  assert.equal(readJsonFile(canonicalPath).valid, true);
});

test('migration refuses to overwrite corrupt data when no readable copy exists', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aurestar-corrupt-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const canonicalPath = path.join(root, 'aurestar-data.json');
  fs.writeFileSync(canonicalPath, '{broken');
  assert.throws(() => migrateJsonStores({ canonicalPath }), /original file was preserved/);
  assert.equal(fs.readFileSync(canonicalPath, 'utf8'), '{broken');
  assert.equal(fs.readdirSync(path.join(root, 'backups')).length, 1);
});

test('store merge prioritizes matching canonical task versions and de-duplicates anonymous values', () => {
  const merged = mergeStores({ tasks: [{ id: 'a', title: 'canonical' }], completions: [{ kind: 'task', date: '2026-01-01' }] }, { tasks: [{ id: 'a', title: 'legacy' }, { id: 'b' }], completions: [{ kind: 'task', date: '2026-01-01' }] });
  assert.deepEqual(merged.tasks, [{ id: 'a', title: 'canonical' }, { id: 'b' }]);
  assert.equal(merged.completions.length, 1);
});

test('alarm scheduler fires on absolute time, replaces duplicate names and resumes overdue alarms once', () => {
  let clock = 1_000;
  let id = 0;
  const timers = new Map();
  const fired = [];
  const setTimer = (fn, ms) => { const key = ++id; timers.set(key, { fn, at: clock + ms }); return key; };
  const clearTimer = key => timers.delete(key);
  const scheduler = createAlarmScheduler({ now: () => clock, setTimer, clearTimer, onAlarm: alarm => fired.push(alarm) });
  const runDue = () => {
    let next;
    while ((next = [...timers.entries()].find(([, timer]) => timer.at <= clock))) {
      timers.delete(next[0]); next[1].fn();
    }
  };

  scheduler.create('focus', { when: 3_000 });
  scheduler.create('focus', { when: 4_000 });
  clock = 3_000; runDue(); assert.equal(fired.length, 0);
  clock = 4_000; runDue(); assert.equal(fired.length, 1);
  scheduler.create('daily', { when: 9_000 });
  clock = 10_000; scheduler.resume();
  assert.equal(fired.length, 2);
  scheduler.resume(); assert.equal(fired.length, 2);
  scheduler.close();
});
