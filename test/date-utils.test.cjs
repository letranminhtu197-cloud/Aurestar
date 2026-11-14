'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { addCalendarDays, startOfWeek, endOfWeek, parseCalendarDate } = require('../src/core/date-utils.cjs');

test('calendar date arithmetic is stable across month, year and leap-day boundaries', () => {
  assert.equal(addCalendarDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addCalendarDays('2026-01-01', -1), '2025-12-31');
  assert.equal(addCalendarDays('2026-11-14', 1), '2026-11-15');
});

test('week boundaries respect the configured first day', () => {
  assert.equal(startOfWeek('2026-11-14', 1), '2026-11-09');
  assert.equal(endOfWeek('2026-11-14', 1), '2026-11-15');
  assert.equal(startOfWeek('2026-11-14', 0), '2026-11-08');
});

test('invalid calendar dates are rejected rather than normalized', () => {
  assert.throws(() => parseCalendarDate('2026-02-30'), /Invalid calendar date/);
  assert.throws(() => parseCalendarDate('14/11/2026'), /Invalid calendar date/);
});

test('local date formatting follows the configured operating-system timezone', () => {
  const script = "const {formatLocalDate}=require('./src/core/date-utils.cjs');process.stdout.write(formatLocalDate(new Date('2026-11-14T18:00:00.000Z')))";
  const vietnam = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: { ...process.env, TZ: 'Asia/Ho_Chi_Minh' } });
  const losAngeles = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', env: { ...process.env, TZ: 'America/Los_Angeles' } });
  assert.equal(vietnam.status, 0, vietnam.stderr);
  assert.equal(losAngeles.status, 0, losAngeles.stderr);
  assert.equal(vietnam.stdout, '2026-11-15');
  assert.equal(losAngeles.stdout, '2026-11-14');
});
