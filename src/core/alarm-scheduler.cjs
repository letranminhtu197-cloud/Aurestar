'use strict';

const MAX_TIMEOUT_MS = 2_147_483_000;

function createAlarmScheduler({ onAlarm, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (typeof onAlarm !== 'function') throw new TypeError('onAlarm callback is required');
  const records = new Map();
  let closed = false;

  function arm(record) {
    if (closed || records.get(record.name) !== record) return;
    if (record.timer) clearTimer(record.timer);
    const remaining = Math.max(0, record.scheduledTime - now());
    record.timer = setTimer(() => fireIfDue(record.name), Math.min(MAX_TIMEOUT_MS, remaining));
  }

  function fireIfDue(name) {
    if (closed) return;
    const record = records.get(String(name));
    if (!record) return;
    record.timer = null;
    if (record.scheduledTime > now()) return arm(record);
    const alarm = { name: record.name, scheduledTime: record.scheduledTime };
    if (record.periodInMinutes > 0) {
      const periodMs = record.periodInMinutes * 60_000;
      const missed = Math.max(0, Math.floor((now() - record.scheduledTime) / periodMs));
      record.scheduledTime += (missed + 1) * periodMs;
      arm(record);
    } else {
      records.delete(record.name);
    }
    try { onAlarm(alarm); } catch (error) { queueMicrotask(() => { throw error; }); }
  }

  function create(name, info = {}) {
    if (closed) return;
    const key = String(name);
    const when = Number(info.when);
    const delay = Math.max(0, Number(info.delayInMinutes) || 0) * 60_000;
    const scheduledTime = Number.isFinite(when) && when > 0 ? when : now() + delay;
    const periodInMinutes = Math.max(0, Number(info.periodInMinutes) || 0);
    const old = records.get(key);
    if (old?.timer) clearTimer(old.timer);
    const record = { name: key, scheduledTime, periodInMinutes, timer: null };
    records.set(key, record);
    arm(record);
  }

  function clear(name) {
    const key = String(name);
    const record = records.get(key);
    if (record?.timer) clearTimer(record.timer);
    return records.delete(key);
  }

  function clearAll() {
    for (const key of [...records.keys()]) clear(key);
    return true;
  }

  function get(name) {
    const record = records.get(String(name));
    return record ? { name: record.name, scheduledTime: record.scheduledTime, periodInMinutes: record.periodInMinutes || undefined } : undefined;
  }

  function getAll() {
    return [...records.values()].map(record => ({ name: record.name, scheduledTime: record.scheduledTime, periodInMinutes: record.periodInMinutes || undefined }));
  }

  function resume() {
    if (closed) return;
    for (const record of [...records.values()]) {
      if (record.scheduledTime <= now()) fireIfDue(record.name);
      else arm(record);
    }
  }

  function close() {
    closed = true;
    for (const record of records.values()) if (record.timer) clearTimer(record.timer);
    records.clear();
  }

  return { create, clear, clearAll, get, getAll, resume, close };
}

module.exports = { createAlarmScheduler };
