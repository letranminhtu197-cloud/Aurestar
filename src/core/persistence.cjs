'use strict';

const fs = require('node:fs');
const path = require('node:path');

const COLLECTION_KEYS = new Set([
  'tasks', 'habits', 'lists', 'focusSessions', 'workoutSessions', 'completions',
  'achievements', 'goals', 'reviews', 'motivationVideos', 'challenges', 'penalties'
]);
const MAX_JSON_BYTES = 64 * 1024 * 1024;

function readJsonFile(file) {
  if (!fs.existsSync(file)) return { exists: false, valid: false, value: null };
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > MAX_JSON_BYTES) throw new Error('JSON file is too large or not a regular file');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON root must be an object');
    return { exists: true, valid: true, value };
  } catch (error) {
    return { exists: true, valid: false, value: null, error };
  }
}

function stableKey(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableKey(value[key])}`).join(',')}}`;
  }
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`;
  return JSON.stringify(value);
}

function mergeArray(primary, fallback) {
  const merged = [];
  const positions = new Map();
  for (const value of [...primary, ...fallback]) {
    if (!value || typeof value !== 'object') continue;
    const key = value.id != null ? `id:${String(value.id)}` : `json:${stableKey(value)}`;
    if (!positions.has(key)) {
      positions.set(key, merged.length);
      merged.push(value);
    }
  }
  return merged;
}

function mergeStores(primary, fallback) {
  const merged = { ...fallback, ...primary };
  for (const key of COLLECTION_KEYS) {
    if (Array.isArray(primary[key]) || Array.isArray(fallback[key])) {
      merged[key] = mergeArray(Array.isArray(primary[key]) ? primary[key] : [], Array.isArray(fallback[key]) ? fallback[key] : []);
    }
  }
  merged.settings = { ...(fallback.settings || {}), ...(primary.settings || {}) };
  merged.profile = { ...(fallback.profile || {}), ...(primary.profile || {}) };
  for (const key of ['xp', 'coins', 'totalFocusMinutes', 'level']) {
    if (Number.isFinite(Number(fallback.profile?.[key]))) {
      merged.profile[key] = Math.max(Number(primary.profile?.[key]) || 0, Number(fallback.profile[key]));
    }
  }
  return merged;
}

const STATE_COLLECTION_KEYS = Object.freeze([
  'tasks', 'habits', 'lists', 'focusSessions', 'workoutSessions', 'completions',
  'achievements', 'goals', 'reviews', 'motivationVideos', 'challenges', 'penalties'
]);

function normalizeStateCollections(value, defaults = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = { ...defaults, ...source };
  for (const key of STATE_COLLECTION_KEYS) {
    if (!Array.isArray(result[key])) result[key] = Array.isArray(defaults[key]) ? [...defaults[key]] : [];
  }
  result.settings = { ...(defaults.settings || {}), ...(source.settings || {}) };
  result.profile = { ...(defaults.profile || {}), ...(source.profile || {}) };
  return result;
}

function writeJsonAtomic(file, value) {
  const directory = path.dirname(file);
  fs.mkdirSync(directory, { recursive: true });
  const temporary = path.join(directory, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, JSON.stringify(value, null, 2), 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.renameSync(temporary, file);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.rmSync(temporary, { force: true }); } catch {}
    throw error;
  }
}

function migrateJsonStores({ canonicalPath, legacyPaths = [], preferredPaths = [], backupDir, markerPath }) {
  const marker = markerPath || path.join(path.dirname(canonicalPath), '.aurestar-storage-migrated-v1');
  const canonicalRead = readJsonFile(canonicalPath);
  if (fs.existsSync(marker) && canonicalRead.valid) return canonicalRead.value;

  const sourceOrder = [...preferredPaths, canonicalPath, ...legacyPaths]
    .filter((file, index, all) => file && all.indexOf(file) === index);
  const candidates = sourceOrder
    .filter((file, index, all) => file && all.indexOf(file) === index)
    .map(file => ({ file, ...readJsonFile(file) }));
  const valid = candidates.filter(item => item.valid);
  if (!valid.length && candidates.some(item => item.exists)) {
    const backupRoot = backupDir || path.join(path.dirname(canonicalPath), 'backups');
    fs.mkdirSync(backupRoot, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (const item of candidates.filter(row => row.exists)) {
      const destination = path.join(backupRoot, `${path.basename(item.file)}.unreadable-${stamp}.bak`);
      fs.copyFileSync(item.file, destination, fs.constants.COPYFILE_EXCL);
    }
    throw new Error('Aurestar data could not be read. The original file was preserved; no empty data file was written.');
  }

  const existing = candidates.filter(item => item.exists);
  if (existing.length) {
    const backupRoot = backupDir || path.join(path.dirname(canonicalPath), 'backups');
    fs.mkdirSync(backupRoot, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    for (const item of existing) {
      const destination = path.join(backupRoot, `${path.basename(item.file)}.pre-migration-${stamp}.bak`);
      fs.copyFileSync(item.file, destination, fs.constants.COPYFILE_EXCL);
    }
  }

  let result = {};
  for (const item of candidates.filter(row => row.valid)) result = mergeStores(result, item.value);
  if (existing.length || !fs.existsSync(marker)) writeJsonAtomic(canonicalPath, result);
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  fs.writeFileSync(marker, '1', { encoding: 'utf8', flag: 'w', mode: 0o600 });
  return result;
}

module.exports = { mergeStores, migrateJsonStores, normalizeStateCollections, readJsonFile, writeJsonAtomic };
