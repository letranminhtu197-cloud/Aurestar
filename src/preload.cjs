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

function getSession(keys) {
  if (keys == null) return { ...sessionStore };
  const out = {};
  for (const key of (Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys))) {
    if (Object.prototype.hasOwnProperty.call(sessionStore, key)) out[key] = sessionStore[key];
    else if (keys && !Array.isArray(keys) && typeof keys === 'object' && Object.prototype.hasOwnProperty.call(keys, key)) out[key] = keys[key];
  }
  return out;
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
    create(name, info) { return ipcRenderer.invoke('chrome:alarm:create',{name:String(name),info:info||{}}); },
    clear(name, callback) { return callbackResult(ipcRenderer.invoke('chrome:alarm:clear',String(name)), callback); },
    clearAll(callback) { return callbackResult(ipcRenderer.invoke('chrome:alarm:clear-all'), callback); },
    get(name, callback) { return callbackResult(ipcRenderer.invoke('chrome:alarm:get',String(name)), callback); },
    getAll(callback) { return callbackResult(ipcRenderer.invoke('chrome:alarm:get-all'), callback); },
    onAlarm: alarmEvent
  },
  notifications: {
    create(id, options, callback) { return callbackResult(ipcRenderer.invoke('chrome:notification', { id, options }), callback); },
    clear(id, callback) { return callbackResult(Promise.resolve(true), callback); }
  },
  tabs: {
    query(_query, callback) { return callbackResult(Promise.resolve([]), callback); },
    get(_id, callback) { return callbackResult(Promise.reject(new Error('Browser tabs are not available in desktop mode')), callback); },
    create(options, callback) {
      const raw=String(options?.url||'');let target;
      try{target=new URL(raw,window.location.href);}catch{return callbackResult(Promise.resolve(null),callback);}
      let p=Promise.resolve(null);
      if(target.protocol==='https:'||target.protocol==='http:')p=ipcRenderer.invoke('app:open-external',target.href).then(ok=>ok?({id:-1,url:target.href,active:options?.active!==false}):null);
      else if(target.protocol==='file:'&&/reminder\.html$/i.test(target.pathname))p=ipcRenderer.invoke('app:reminder',{type:target.searchParams.get('type'),reason:target.searchParams.get('reason')}).then(()=>({id:-2,url:target.href,active:false}));
      else if(target.protocol==='file:'&&/app\.html$/i.test(target.pathname))p=ipcRenderer.invoke('app:show',target.hash.slice(1)||'dashboard').then(()=>({id:1,url:target.href,active:true}));
      return callbackResult(p,callback);
    },
    update(_id, _options, callback) { return callbackResult(Promise.resolve(null), callback); },
    sendMessage(_id, _message, callback) { return callbackResult(Promise.resolve(null), callback); },
    onActivated: activatedTabEvent,
    onUpdated: updatedTabEvent
  },
  windows: {
    create(options, callback) {
      let view='dashboard';try{const target=new URL(String(options?.url||''),window.location.href);view=target.hash.slice(1)||view;}catch{}
      return callbackResult(ipcRenderer.invoke('app:show',view).then(() => ({ id: 1 })), callback);
    },
    update(_id, _options, callback) { return callbackResult(Promise.resolve({ id: 1 }), callback); }
  },
  commands: { onCommand: commandEvent },
  idle: {
    setDetectionInterval(seconds) { ipcRenderer.send('system:idle-detection-set',seconds); },
    queryState(seconds, callback) { return callbackResult(ipcRenderer.invoke('system:idle-state',seconds), callback); },
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
ipcRenderer.on('chrome:alarm-fired', (_event, alarm) => alarmEvent.dispatch(alarm));
ipcRenderer.on('chrome:idle-state', (_event, state) => idleEvent.dispatch(state));
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
  closePomodoroWidget: () => ipcRenderer.invoke('pomodoro:widget-close'),
  hideItsuki: () => ipcRenderer.invoke('itsuki:hide'),
  showItsuki: () => ipcRenderer.invoke('itsuki:show'),
  openWorkspace: () => ipcRenderer.invoke('app:show'),
  getItsukiArtUrl: (index) => ipcRenderer.invoke('itsuki:art-url', index),
  getBackgroundScriptUrl: () => ipcRenderer.invoke('chrome:background-script-url'),
  announceBackgroundReady: () => { startupEvent.dispatch(); ipcRenderer.send('chrome:background-ready'); },
  onReminder: (fn) => { const handler=(_event,message)=>fn(message); ipcRenderer.on('reminder:show',handler); return () => ipcRenderer.removeListener('reminder:show',handler); },
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: () => ipcRenderer.invoke('data:import'),
  backupNow: () => ipcRenderer.invoke('backup:now'),
  testNotification: () => ipcRenderer.invoke('notification:test'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  getVersion: () => ipcRenderer.invoke('app:version'),
  onState: (fn) => { const handler=(_e,state)=>fn(state); ipcRenderer.on('aurestar:state',handler); return () => ipcRenderer.removeListener('aurestar:state',handler); },
  onQuickAdd: (fn) => { const handler=()=>fn(); ipcRenderer.on('aurestar:quick-add',handler); return () => ipcRenderer.removeListener('aurestar:quick-add',handler); },
  onNavigate: (fn) => { const handler=(_e,view)=>fn(view); ipcRenderer.on('aurestar:navigate',handler); return () => ipcRenderer.removeListener('aurestar:navigate',handler); }
};
contextBridge.exposeInMainWorld('aurestarDesktop', desktopApi);
contextBridge.exposeInMainWorld('aurestarChrome', chromeApi);
