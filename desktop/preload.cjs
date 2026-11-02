const { contextBridge, ipcRenderer } = require('electron');

function makeEvent() {
  const listeners = new Set();
  return {
    addListener(fn) { if (typeof fn === 'function') listeners.add(fn); },
    removeListener(fn) { listeners.delete(fn); },
    hasListener(fn) { return listeners.has(fn); },
    dispatch(...args) {
      for (const fn of [...listeners]) {
        try { const result = fn(...args); if (result && typeof result.catch === 'function') result.catch(() => {}); }
        catch (error) { console.error('Aurestar event listener failed', error); }
      }
    },
    dispatchWithResults(...args) {
      const results = [];
      for (const fn of [...listeners]) {
        try { results.push(fn(...args)); }
        catch (error) { console.error('Aurestar event listener failed', error); }
      }
      return results;
    }
  };
}
function callbackResult(promise, callback) {
  if (typeof callback === 'function') promise.then(value => callback(value)).catch(() => callback(undefined));
  return promise;
}

const runtimeMessageEvent = makeEvent();
const storageChangedEvent = makeEvent();
const startupEvent = makeEvent();
const installedEvent = makeEvent();
const commandEvent = makeEvent();
const alarmEvent = makeEvent();
const activatedTabEvent = makeEvent();
const updatedTabEvent = makeEvent();
const idleEvent = makeEvent();
const sessionStore = Object.create(null);
const alarms = new Map();

function getSession(keys) {
  if (keys == null) return { ...sessionStore };
  const out = {};
  for (const key of (Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys))) {
    if (Object.prototype.hasOwnProperty.call(sessionStore, key)) out[key] = sessionStore[key];
    else if (keys && !Array.isArray(keys) && typeof keys === 'object' && Object.prototype.hasOwnProperty.call(keys, key)) out[key] = keys[key];
  }
  return out;
}
function setAlarm(name, info = {}) {
  const key = String(name);
  const existing = alarms.get(key);
  if (existing?.timer) clearTimeout(existing.timer);
  const period = Math.max(0, Number(info.periodInMinutes) || 0);
  const scheduledTime = Number(info.when) > 0 ? Number(info.when) :
    Date.now() + Math.max(0, Number(info.delayInMinutes) || 0) * 60000;
  const delay = Math.max(0, Math.min(2147483000, scheduledTime - Date.now()));
  const record = { name: key, scheduledTime, periodInMinutes: period, timer: null };
  record.timer = setTimeout(() => {
    alarmEvent.dispatch({ name: key, scheduledTime });
    if (period > 0) setAlarm(key, { when: Date.now() + period * 60000, periodInMinutes: period });
    else alarms.delete(key);
  }, delay);
  alarms.set(key, record);
}
function clearAlarm(name) {
  const record = alarms.get(String(name));
  if (record?.timer) clearTimeout(record.timer);
  return alarms.delete(String(name));
}

const chromeApi = {
  runtime: {
    id: 'aurestar-desktop',
    lastError: null,
    getURL(resource) { return new URL(String(resource || '').replace(/^\/+/, ''), window.location.href).href; },
    sendMessage(message, callback) {
      const p = ipcRenderer.invoke('chrome:send-message', message);
      return callbackResult(p, callback);
    },
    onMessage: runtimeMessageEvent,
    onInstalled: installedEvent,
    onStartup: startupEvent,
    getContexts: () => Promise.resolve([])
  },
  storage: {
    local: {
      get(keys, callback) { return callbackResult(ipcRenderer.invoke('chrome:storage:get', keys ?? null), callback); },
      set(items, callback) { return callbackResult(ipcRenderer.invoke('chrome:storage:set', items || {}), callback); },
      remove(keys, callback) { return callbackResult(ipcRenderer.invoke('chrome:storage:remove', keys), callback); },
      clear(callback) { return callbackResult(ipcRenderer.invoke('chrome:storage:clear'), callback); }
    },
    session: {
      get(keys, callback) { return callbackResult(Promise.resolve(getSession(keys)), callback); },
      set(items, callback) { Object.assign(sessionStore, items || {}); return callbackResult(Promise.resolve(), callback); },
      remove(keys, callback) {
        for (const key of (Array.isArray(keys) ? keys : [keys])) delete sessionStore[key];
        return callbackResult(Promise.resolve(), callback);
      },
      clear(callback) { for (const key of Object.keys(sessionStore)) delete sessionStore[key]; return callbackResult(Promise.resolve(), callback); }
    },
    onChanged: storageChangedEvent
  },
  alarms: {
    create(name, info) { setAlarm(name, info || {}); },
    clear(name, callback) { return callbackResult(Promise.resolve(clearAlarm(name)), callback); },
    clearAll(callback) { for (const key of [...alarms.keys()]) clearAlarm(key); return callbackResult(Promise.resolve(true), callback); },
    get(name, callback) { const a=alarms.get(String(name)); const value=a?{name:a.name,scheduledTime:a.scheduledTime,periodInMinutes:a.periodInMinutes||undefined}:undefined; return callbackResult(Promise.resolve(value), callback); },
    getAll(callback) { const value=[...alarms.values()].map(a=>({name:a.name,scheduledTime:a.scheduledTime,periodInMinutes:a.periodInMinutes||undefined})); return callbackResult(Promise.resolve(value), callback); },
    onAlarm: alarmEvent
  },
  notifications: {
    create(id, options, callback) { return callbackResult(ipcRenderer.invoke('chrome:notification', { id, options }), callback); },
    clear(id, callback) { return callbackResult(Promise.resolve(true), callback); }
  },
  tabs: {
    query(_query, callback) { return callbackResult(Promise.resolve([]), callback); },
    get(_id, callback) { return callbackResult(Promise.reject(new Error('Browser tabs are not available in desktop mode')), callback); },
    create(options, callback) { const url=String(options?.url||''); const p=(url.startsWith('http://')||url.startsWith('https://'))?ipcRenderer.invoke('app:open-external',url).then(()=>({id:-1,url,active:options?.active!==false})):Promise.resolve(null); return callbackResult(p, callback); },
    update(_id, _options, callback) { return callbackResult(Promise.resolve(null), callback); },
    sendMessage(_id, _message, callback) { return callbackResult(Promise.resolve(null), callback); },
    onActivated: activatedTabEvent,
    onUpdated: updatedTabEvent
  },
  windows: {
    create(_options, callback) { return callbackResult(ipcRenderer.invoke('app:show').then(() => ({ id: 1 })), callback); },
    update(_id, _options, callback) { return callbackResult(Promise.resolve({ id: 1 }), callback); }
  },
  commands: { onCommand: commandEvent },
  idle: {
    setDetectionInterval() {},
    queryState(_seconds, callback) { return callbackResult(Promise.resolve('active'), callback); },
    onStateChanged: idleEvent
  },
  scripting: {
    executeScript(_details, callback) { return callbackResult(Promise.resolve([]), callback); },
    insertCSS(_details, callback) { return callbackResult(Promise.resolve(), callback); }
  },
  declarativeNetRequest: { updateDynamicRules() { return Promise.resolve(); } },
  offscreen: {
    hasDocument() { return Promise.resolve(false); },
    createDocument() { return Promise.resolve(); },
    closeDocument() { return Promise.resolve(); }
  },
  sidePanel: { setPanelBehavior() { return Promise.resolve(); } },
  downloads: { download(options = {}, callback) { const anchor=document.createElement('a'); anchor.href=String(options.url||''); anchor.download=String(options.filename||'aurestar-backup.json').split(/[\\/]/).pop(); anchor.style.display='none'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); return callbackResult(Promise.resolve(1),callback); } }
};

ipcRenderer.on('chrome:storage-changed', (_event, changes, area) => storageChangedEvent.dispatch(changes, area));
ipcRenderer.on('chrome:dispatch-message', async (_event, envelope) => {
  let responded = false;
  let asyncResponseExpected = false;
  const respond = response => {
    if (responded) return;
    responded = true;
    ipcRenderer.send('chrome:send-response', { id: envelope.id, response });
  };
  const sender = envelope.sender || { id: 'aurestar-desktop' };
  const results = runtimeMessageEvent.dispatchWithResults(envelope.message, sender, respond);
  if (results.some(result => result === true)) asyncResponseExpected = true;
  for (const result of results) {
    if (result && typeof result.then === 'function') {
      try { const value = await result; if (!responded && value !== undefined) respond(value); }
      catch (error) { respond({ ok: false, error: String(error?.message || error) }); }
    } else if (!responded && result !== undefined && result !== true) respond(result);
  }
  if (!responded && !asyncResponseExpected) respond(undefined);
});

window.addEventListener('DOMContentLoaded', () => {
  if (location.pathname.endsWith('background-host.html')) {
    // The host page calls this again after background.js has actually loaded.
  }
});

const desktopApi = {
  getState: () => ipcRenderer.invoke('state:get'),
  saveState: (state) => ipcRenderer.invoke('state:save', state),
  completeTask: (payload) => ipcRenderer.invoke('task:complete', payload),
  toggleFocus: () => ipcRenderer.invoke('focus:toggle'),
  closePomodoroWidget: () => ipcRenderer.invoke('pomodoro:widget-close'),
  hideItsuki: () => ipcRenderer.invoke('itsuki:hide'),
  showItsuki: () => ipcRenderer.invoke('itsuki:show'),
  dismissItsuki: () => ipcRenderer.invoke('itsuki:dismiss'),
  openWorkspace: () => ipcRenderer.invoke('app:show'),
  getItsukiArtUrl: (index) => ipcRenderer.invoke('itsuki:art-url', index),
  dragItsukiBy: (dx, dy) => ipcRenderer.send('itsuki:drag', { dx, dy }),
  getBackgroundScriptUrl: () => ipcRenderer.invoke('chrome:background-script-url'),
  announceBackgroundReady: () => { startupEvent.dispatch(); ipcRenderer.send('chrome:background-ready'); },
  onItsukiEvent: (fn) => { const handler=(_e,p)=>fn(p); ipcRenderer.on('itsuki:event',handler); return () => ipcRenderer.removeListener('itsuki:event',handler); },
  onPomodoroState: (fn) => { const handler=(_e,s)=>fn(s); ipcRenderer.on('pomodoro:state',handler); return () => ipcRenderer.removeListener('pomodoro:state',handler); },
  resetFocus: (minutes) => ipcRenderer.invoke('focus:reset', minutes),
  finishFocus: (minutes) => ipcRenderer.invoke('focus:finish', minutes),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  testNotification: () => ipcRenderer.invoke('notification:test'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  getVersion: () => ipcRenderer.invoke('app:version'),
  onState: (fn) => { const handler=(_e,state)=>fn(state); ipcRenderer.on('aurestar:state',handler); return () => ipcRenderer.removeListener('aurestar:state',handler); },
  onQuickAdd: (fn) => { const handler=()=>fn(); ipcRenderer.on('aurestar:quick-add',handler); return () => ipcRenderer.removeListener('aurestar:quick-add',handler); }
};
contextBridge.exposeInMainWorld('aurestarDesktop', desktopApi);
contextBridge.exposeInMainWorld('aurestarChrome', chromeApi);
