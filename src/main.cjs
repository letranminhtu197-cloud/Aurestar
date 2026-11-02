const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, dialog, shell, nativeImage, globalShortcut, powerMonitor } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { migrateJsonStores, writeJsonAtomic } = require('./core/persistence.cjs');
const { createAlarmScheduler } = require('./core/alarm-scheduler.cjs');

const testDataPath=!app.isPackaged&&process.env.AURESTAR_TEST_DATA_DIR?path.resolve(process.env.AURESTAR_TEST_DATA_DIR):null;
const portableDataPath=process.env.PORTABLE_EXECUTABLE_DIR?path.join(process.env.PORTABLE_EXECUTABLE_DIR,'AurestarData'):null;
app.setPath('userData',testDataPath||portableDataPath||path.join(app.getPath('appData'),'aurestar-desktop'));

const APP_NAME = 'Aurestar';
let win = null, tray = null, pomodoroWidget = null, itsukiWindow = null, reminderWindow = null, reminderTimer = null, focusTickTimer = null, focusSaveCounter = 0;
let state = null;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const dataDir = () => app.getPath('userData');
const dataFile = () => path.join(dataDir(), 'aurestar-data.json');
const backupDir = () => path.join(dataDir(), 'backups');
let backgroundWin=null, chromeBackgroundReady=false;
const pendingChromeMessages=new Map();
const chromeBackgroundWaiters=[];
const pendingNativeAlarms=[];
let chromeStorageCache=null;
let nativeAlarms=null, idlePollTimer=null, idleDetectionSeconds=60, lastIdleState='active';
const chromeStorageFile=()=>dataFile();
const legacyChromeStorageFile=()=>path.join(dataDir(),'aurestar-chrome-storage.json');
function isTrustedLocalUrl(rawUrl){
  try{
    const url=new URL(rawUrl);
    if(url.protocol!=='file:')return false;
    const file=path.resolve(fileURLToPath(url));
    const root=path.resolve(app.getAppPath());
    return file===root||file.startsWith(root+path.sep);
  }catch{return false;}
}
function isTrustedSender(event){return isTrustedLocalUrl(event?.senderFrame?.url||'');}
const rawHandle=ipcMain.handle.bind(ipcMain);
ipcMain.handle=(channel,listener)=>rawHandle(channel,(event,...args)=>{
  if(!isTrustedSender(event))throw new Error(`Rejected IPC from an untrusted page (${channel})`);
  return listener(event,...args);
});
const rawOn=ipcMain.on.bind(ipcMain);
ipcMain.on=(channel,listener)=>rawOn(channel,(event,...args)=>{
  if(!isTrustedSender(event)){console.warn(`Rejected IPC from an untrusted page (${channel})`);return;}
  listener(event,...args);
});
function secureWindow(browserWindow){
  browserWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  browserWindow.webContents.on('will-navigate',(event,url)=>{
    if(isTrustedLocalUrl(url))return;
    event.preventDefault();
    if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(error=>console.warn('Could not open external URL',error));
  });
  browserWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
}
function cloneValue(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function readChromeStorage(){
  if(chromeStorageCache)return chromeStorageCache;
  chromeStorageCache=migrateJsonStores({canonicalPath:chromeStorageFile(),legacyPaths:[legacyChromeStorageFile()],preferredPaths:[legacyChromeStorageFile()],backupDir:backupDir()});
  return chromeStorageCache;
}
function saveChromeStorage(){
  writeJsonAtomic(chromeStorageFile(),chromeStorageCache||{});
}
function chromeStorageGet(keys){
  const source=readChromeStorage();
  if(keys===null||keys===undefined)return cloneValue(source);
  const wanted=typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys);
  const out={};
  for(const key of wanted){
    if(Object.prototype.hasOwnProperty.call(source,key))out[key]=cloneValue(source[key]);
    else if(keys&&typeof keys==='object'&&!Array.isArray(keys)&&Object.prototype.hasOwnProperty.call(keys,key))out[key]=cloneValue(keys[key]);
  }
  return out;
}
function broadcastChromeStorage(changes){
  if(!Object.keys(changes).length)return;
  for(const w of BrowserWindow.getAllWindows()){
    if(!w.isDestroyed())w.webContents.send('chrome:storage-changed',changes,'local');
  }
}
function chromeStorageSet(items){
  const store=readChromeStorage(),changes={};
  for(const [key,value] of Object.entries(items||{})){
    const oldValue=store[key],newValue=cloneValue(value);
    if(JSON.stringify(oldValue)!==JSON.stringify(newValue)){
      changes[key]={...(oldValue===undefined?{}:{oldValue:cloneValue(oldValue)}),newValue:cloneValue(newValue)};
      store[key]=newValue;
    }
  }
  state=store;saveChromeStorage();
  const settingsChange=changes.settings;
  if(settingsChange){
    const previous=settingsChange.oldValue||{},settings=store.settings||{};
    const wasWidgetEnabled=previous.focusWidgetEnabled!==false,nextWidgetEnabled=settings.focusWidgetEnabled!==false;
    if(wasWidgetEnabled!==nextWidgetEnabled){if(nextWidgetEnabled)createPomodoroWidget();else closePomodoroWidget();}
    const wasCompanionEnabled=previous.privacyMode!==true&&previous.itsukiCompanionEnabled!==false;
    const nextCompanionEnabled=settings.privacyMode!==true&&settings.itsukiCompanionEnabled!==false;
    if(wasCompanionEnabled!==nextCompanionEnabled){if(nextCompanionEnabled)createItsuki();else hideItsuki();}
  }
  broadcastChromeStorage(changes);return true;
}
function chromeStorageRemove(keys){
  const store=readChromeStorage(),changes={};
  for(const key of (Array.isArray(keys)?keys:[keys])){
    if(typeof key!=='string'||!Object.prototype.hasOwnProperty.call(store,key))continue;
    changes[key]={oldValue:cloneValue(store[key])};delete store[key];
  }
  state=store;saveChromeStorage();broadcastChromeStorage(changes);return true;
}
function chromeStorageClear(){
  const store=readChromeStorage(),changes={};
  for(const [key,value] of Object.entries(store))changes[key]={oldValue:cloneValue(value)};
  chromeStorageCache={};state=chromeStorageCache;saveChromeStorage();broadcastChromeStorage(changes);return true;
}
function waitForChromeBackground(){
  if(chromeBackgroundReady&&backgroundWin&&!backgroundWin.isDestroyed())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Desktop background service did not start')),15000);
    chromeBackgroundWaiters.push(()=>{clearTimeout(timer);resolve();});
  });
}
function sendChromeMessage(message){
  return waitForChromeBackground().then(()=>new Promise((resolve,reject)=>{
    const id=crypto.randomUUID(),timer=setTimeout(()=>{
      pendingChromeMessages.delete(id);reject(new Error('Chrome background message timed out'));
    },20000);
    pendingChromeMessages.set(id,{resolve,reject,timer});
    backgroundWin.webContents.send('chrome:dispatch-message',{id,message,sender:{id:'aurestar-desktop',url:'aurestar://desktop'}});
  }));
}
function toggleItsuki(){
  if(itsukiWindow&&!itsukiWindow.isDestroyed()&&itsukiWindow.isVisible())hideItsuki();
  else createItsuki();
}
function installItsukiHotkeys(){
  // F6 hides the companion; Ctrl+F6 brings it back.
  globalShortcut.register('F6',hideItsuki);
  globalShortcut.register('Control+F6',createItsuki);
}
function bindAltToggle(browserWindow){
  // Avoid opening Chromium's menu bar when Alt is pressed inside an Aurestar window.
  // Global show/hide handling is performed once by the OS-level hook.
  browserWindow.webContents.on('before-input-event',(event,input)=>{
    if(input.type==='keyDown'&&input.key==='Alt')event.preventDefault();
  });
}
function createBackgroundWindow(){
  if(backgroundWin&&!backgroundWin.isDestroyed())return;
  chromeBackgroundReady=false;
  backgroundWin=new BrowserWindow({width:2,height:2,show:false,frame:false,skipTaskbar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(backgroundWin);
  backgroundWin.webContents.setBackgroundThrottling(false);
  backgroundWin.loadFile(path.join(__dirname,'background-host.html'));
  backgroundWin.on('closed',()=>{backgroundWin=null;chromeBackgroundReady=false;});
}

const defaultState = () => ({
  schemaVersion: 1, createdAt: Date.now(),
  settings: { notifications:true, dailyReminder:'08:00', taskReminders:true, autoBackup:true, backupTime:'23:30', focusPreset:25, focusShortBreak:5, focusLongBreak:15, focusLongBreakEvery:4, blockedWebsites:['tiktok.com','facebook.com','youtube.com'], blockDuringFocus:true, startWithWindows:false, minimizeToTray:true, theme:'dark', language:'en' },
  profile:{totalFocusMinutes:0,level:1,xp:0,streak:0,lastActiveDate:''},
  tasks:[], habits:[], lists:[{id:'inbox',name:'Inbox',color:'red',createdAt:Date.now()}],
  focusSessions:[], workoutSessions:[], completions:[], remindersSent:{}, training:{active:false,paused:false,remaining:0,elapsed:0,exerciseIndex:0,exercises:[]}, focus:{active:false,paused:false,phase:'focus',remaining:1500,total:1500,startedAt:0,taskId:null,completedCycles:0},

});
function readState(){
  const s=readChromeStorage();
  const base=defaultState();
  const merged={...base,...s,settings:{...base.settings,...s.settings},profile:{...base.profile,...s.profile},focus:{...base.focus,...s.focus},training:{...base.training,...s.training}};
  merged.tasks=Array.isArray(merged.tasks)?merged.tasks:[];
  merged.workoutSessions=Array.isArray(merged.workoutSessions)?merged.workoutSessions:[];
  chromeStorageCache=merged;
  return merged;
}
function saveState(){ if(!state||typeof state!=='object')return;chromeStorageCache=state;saveChromeStorage(); }
function notify(title,body){
  if (!state?.settings?.notifications || !Notification.isSupported()) return;
  new Notification({title,body,silent:false}).show();
}
function showReminderLine(text){
  const message=String(text||'Aurestar reminder').replace(/[\r\n\t]+/g,' ').trim().slice(0,220)||'Aurestar reminder';
  if(reminderWindow&&!reminderWindow.isDestroyed()){
    reminderWindow.webContents.send('reminder:show',message);
    reminderWindow.showInactive();
  }else{
    const {screen}=require('electron'),area=screen.getPrimaryDisplay().workArea;
    reminderWindow=new BrowserWindow({width:420,height:92,x:area.x+24,y:area.y+area.height-116,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,show:false,focusable:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    secureWindow(reminderWindow);
    reminderWindow.loadFile(path.join(__dirname,'reminder.html'));
    reminderWindow.webContents.once('did-finish-load',()=>reminderWindow?.webContents.send('reminder:show',message));
    reminderWindow.on('closed',()=>{reminderWindow=null;});
    reminderWindow.once('ready-to-show',()=>reminderWindow?.showInactive());
  }
  if(reminderTimer)clearTimeout(reminderTimer);
  reminderTimer=setTimeout(()=>{if(reminderWindow&&!reminderWindow.isDestroyed())reminderWindow.hide();},8000);
}
function sendReminder(type, text){
  const key = `${today()}:${type}`;
  if(state.remindersSent[key]) return;
  state.remindersSent[key]=Date.now(); saveState(); showReminderLine(text);
}
function checkSchedule(){
  if(!state) return;
  const now=new Date(), hm=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const stamp=`${today()}:${hm}`;
  if(hm==='05:30') sendReminder('wake-0530','Every morning is a new beginning.');
  if(hm==='06:00') sendReminder('wake-0600','The secret of getting ahead is getting started.');
  if(hm==='20:45') sendReminder('wind-down','Rest is part of the work. Begin winding down.');
  if(hm==='21:00') sendReminder('sleep','A well-spent day brings happy sleep.');
  if(hm===state.settings.dailyReminder) sendReminder('daily','Your study plan is ready. Choose one clear task and take the first step.');
  if(state.settings.taskReminders){
    for(const t of state.tasks||[]) if(!t.archived && t.dueDate===today() && t.dueTime===hm && !(t.completedDates||[]).includes(today())) sendReminder('task-'+t.id,`Task reminder: ${t.title}`);
  }
  if(state.settings.autoBackup && hm===state.settings.backupTime && !state.remindersSent[today()+':backup']){
    try{fs.mkdirSync(backupDir(),{recursive:true});fs.copyFileSync(dataFile(),path.join(backupDir(),`aurestar-${today()}.json`));state.remindersSent[today()+':backup']=Date.now();saveState();}catch(e){console.error('Auto backup failed',e);}
  }
}
function tickFocus(){
  if(!state?.focus?.active || state.focus.paused) return;
  state.focus.remaining=Math.max(0,Number(state.focus.remaining||0)-1);
  focusSaveCounter++;
  if(state.focus.remaining===0){
    if(state.focus.phase==='break'){
      const next=(Number(state.settings.focusPreset)||25)*60;
      state.focus={...state.focus,active:false,paused:false,phase:'focus',remaining:next,total:next,startedAt:0};
      showReminderLine('Break complete. Start your next focus session.');
    } else {
      const minutes=Math.max(1,Math.round((Number(state.focus.total)||1500)/60));
      state.focusSessions.push({id:crypto.randomUUID(),date:today(),minutes,createdAt:Date.now()});
      state.profile.totalFocusMinutes=(state.profile.totalFocusMinutes||0)+minutes;
      state.profile.xp=(state.profile.xp||0)+minutes;
      state.completions.push({kind:'focus',date:today(),minutes,at:Date.now()});
      const cycles=(state.focus.completedCycles||0)+1;
      const every=Math.max(1,Number(state.settings.focusLongBreakEvery)||4);
      const breakMinutes=cycles%every===0?(Number(state.settings.focusLongBreak)||15):(Number(state.settings.focusShortBreak)||5);
      state.focus={...state.focus,active:false,paused:false,phase:'break',remaining:breakMinutes*60,total:breakMinutes*60,startedAt:0,completedCycles:cycles};
      showReminderLine('Take a breath. Drink some water. Begin again.');
    }
    focusSaveCounter=0;
  }
  if(focusSaveCounter>=10 || focusSaveCounter===0){saveState();focusSaveCounter=0;}
  win?.webContents.send('aurestar:state',state);broadcastWidget();broadcastItsuki('focus-tick');
}

function widgetPayload(){return {focus:state?.focus||{},settings:state?.settings||{}};}
function broadcastWidget(){if(pomodoroWidget&&!pomodoroWidget.isDestroyed())pomodoroWidget.webContents.send('pomodoro:state',widgetPayload());}

function broadcastItsuki(eventName){
  if(itsukiWindow&&!itsukiWindow.isDestroyed())itsukiWindow.webContents.send('itsuki:event',{event:eventName,focus:state?.focus||{}});
}
function createItsuki(){
  if(itsukiWindow&&!itsukiWindow.isDestroyed()){itsukiWindow.show();itsukiWindow.moveTop();return;}
  const area=require('electron').screen.getPrimaryDisplay().workArea;
  itsukiWindow=new BrowserWindow({width:370,height:330,x:18,y:Math.max(12,area.y+area.height-350),frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,show:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(itsukiWindow);
  bindAltToggle(itsukiWindow);
  itsukiWindow.loadFile(path.join(__dirname,'itsuki.html'));
  itsukiWindow.once('ready-to-show',()=>{itsukiWindow?.show();itsukiWindow?.moveTop();broadcastItsuki('startup');});
  itsukiWindow.on('close',e=>{if(!app.isQuitting){e.preventDefault();itsukiWindow.hide();}});
  itsukiWindow.on('closed',()=>{itsukiWindow=null;});
}
function hideItsuki(){if(itsukiWindow&&!itsukiWindow.isDestroyed())itsukiWindow.hide();}

function createPomodoroWidget(){
  if(pomodoroWidget&&!pomodoroWidget.isDestroyed()){pomodoroWidget.show();pomodoroWidget.moveTop();return;}
  pomodoroWidget=new BrowserWindow({width:300,height:176, x:Math.max(12,require('electron').screen.getPrimaryDisplay().workAreaSize.width-320),y:90,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,minimizable:false,maximizable:false,closable:true,show:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(pomodoroWidget);
  bindAltToggle(pomodoroWidget);
  pomodoroWidget.loadFile(path.join(__dirname,'pomodoro-widget.html'));
  pomodoroWidget.once('ready-to-show',()=>{pomodoroWidget?.show();pomodoroWidget?.moveTop();broadcastWidget();});
  pomodoroWidget.on('closed',()=>{pomodoroWidget=null;});
}
function closePomodoroWidget(){if(pomodoroWidget&&!pomodoroWidget.isDestroyed())pomodoroWidget.close();}

function createWindow(initialView='dashboard'){
  win=new BrowserWindow({width:1440,height:920,minWidth:1024,minHeight:700,show:false,backgroundColor:'#211217',title:APP_NAME,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(win);
  bindAltToggle(win);
  win.loadFile(path.join(__dirname,'index.html'),{hash:String(initialView||'dashboard').replace(/^#/,'')});
  win.once('ready-to-show',()=>win.show());
  win.on('close',(e)=>{if(state?.settings?.minimizeToTray && tray && !app.isQuitting){e.preventDefault();win.hide();}});
  win.on('closed',()=>{win=null;});
}
function createTray(){
  const iconPath=path.join(__dirname,'icons','icon16.png');
  let icon=fs.existsSync(iconPath)?nativeImage.createFromPath(iconPath):nativeImage.createEmpty();
  if(process.platform==='win32' && !icon.isEmpty()) icon=icon.resize({width:16,height:16});
  tray=new Tray(icon);tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Open Aurestar',click:()=>{if(!win)createWindow();else win.show();}},
    {label:'Show Pomodoro widget',click:()=>createPomodoroWidget()},
    {label:'Show Itsuki (Ctrl+Alt)',click:()=>createItsuki()},
    {label:'Hide Itsuki (Alt)',click:()=>hideItsuki()},
    {label:'Start / pause focus',click:()=>toggleFocus()},
    {label:'Quick add task',click:()=>{if(!win)createWindow();win?.show();win?.webContents.send('aurestar:quick-add');}},
    {type:'separator'},{label:'Quit',click:()=>{app.isQuitting=true;app.quit();}}
  ]));
  tray.on('double-click',()=>{if(!win)createWindow();else win.show();});
}
function showMainWindow(view='dashboard'){
  if(!win||win.isDestroyed())createWindow(view);
  else{
    win.show();win.focus();
    const target=String(view||'dashboard');
    if(!['dashboard','today','tasks','focus','gym','calendar','analytics','motivation','settings'].includes(target))return;
    const navigate=()=>win&&!win.isDestroyed()&&win.webContents.send('aurestar:navigate',target);
    if(win.webContents.isLoadingMainFrame())win.webContents.once('did-finish-load',navigate);else navigate();
  }
}
function createApplicationMenu(){
  const view=(name)=>()=>showMainWindow(name);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'File',submenu:[
      {label:'Open Aurestar',click:view('dashboard')},
      {label:'Quick add task',click:()=>{showMainWindow('today');win?.webContents.send('aurestar:quick-add');}},
      {label:'Back up data now',click:()=>{fs.mkdirSync(backupDir(),{recursive:true});const target=path.join(backupDir(),`aurestar-${today()}-${Date.now()}.json`);fs.copyFileSync(dataFile(),target);notify(APP_NAME,'Backup saved in Aurestar backups.');}},
      {type:'separator'},{label:'Quit Aurestar',accelerator:'Alt+F4',click:()=>{app.isQuitting=true;app.quit();}}
    ]},
    {label:'View',submenu:[
      {label:'Overview',click:view('dashboard')},{label:'Tasks',click:view('tasks')},{label:'Focus',click:view('focus')},
      {label:'Training',click:view('gym')},{label:'Calendar',click:view('calendar')},{label:'Progress',click:view('analytics')},{label:'Settings',click:view('settings')}
    ]},
    {label:'Tools',submenu:[
      {label:'Start / pause focus',click:toggleFocus},
      {label:'Show Pomodoro widget',click:createPomodoroWidget},{label:'Show Itsuki',click:createItsuki},{label:'Hide Itsuki',click:hideItsuki}
    ]},
    {label:'Help',submenu:[{label:`About ${APP_NAME}`,click:()=>showMainWindow('settings')} ]}
  ]));
}
async function toggleFocus(){
  try{
    const current=await sendChromeMessage({type:'getFocusState'});
    const active=Boolean(current?.result?.focus?.active);
    return await sendChromeMessage({type:active?'focusPause':'focusStart'});
  }catch(error){console.error('Focus shortcut failed',error);}
}
ipcMain.on('chrome:background-ready',()=>{
  chromeBackgroundReady=true;
  for(const alarm of pendingNativeAlarms.splice(0))backgroundWin?.webContents.send('chrome:alarm-fired',alarm);
  for(const resolve of chromeBackgroundWaiters.splice(0))resolve();
});
ipcMain.on('chrome:send-response',(_event,payload)=>{
  const pending=pendingChromeMessages.get(payload?.id);if(!pending)return;
  clearTimeout(pending.timer);pendingChromeMessages.delete(payload.id);pending.resolve(payload.response);
});
ipcMain.handle('chrome:send-message',(_event,message)=>sendChromeMessage(message));
ipcMain.handle('chrome:storage:get',(_event,keys)=>chromeStorageGet(keys));
ipcMain.handle('chrome:storage:set',(_event,items)=>chromeStorageSet(items));
ipcMain.handle('chrome:storage:remove',(_event,keys)=>chromeStorageRemove(keys));
ipcMain.handle('chrome:storage:clear',()=>chromeStorageClear());
ipcMain.handle('chrome:alarm:create',(_event,payload)=>{nativeAlarms?.create(payload?.name,payload?.info||{});return true;});
ipcMain.handle('chrome:alarm:clear',(_event,name)=>nativeAlarms?.clear(name)||false);
ipcMain.handle('chrome:alarm:clear-all',()=>nativeAlarms?.clearAll()||true);
ipcMain.handle('chrome:alarm:get',(_event,name)=>nativeAlarms?.get(name));
ipcMain.handle('chrome:alarm:get-all',()=>nativeAlarms?.getAll()||[]);
ipcMain.handle('system:idle-state',(_event,seconds=60)=>{
  try{return powerMonitor.getSystemIdleState(Math.min(86400,Math.max(15,Number(seconds)||60)));}
  catch{return 'active';}
});
ipcMain.on('system:idle-detection-set',(_event,seconds)=>{
  idleDetectionSeconds=Math.min(86400,Math.max(15,Number(seconds)||60));
});
ipcMain.handle('app:reminder',(_event,payload)=>{
  const messages={wake:'Good morning. Get ready and start with one small task.',study:'Choose one task and begin now.', 'wind-down':'It is time to wind down and prepare for sleep.',sleep:'Put your devices away and get ready for bed.'};
  showReminderLine(payload?.text||messages[String(payload?.type||'').toLowerCase()]||'Your Aurestar reminder is ready.');return {ok:true};
});
ipcMain.handle('app:open-motivation',async(_event,id)=>{
  const item=(state?.motivationVideos||[]).find(video=>String(video.id)===String(id));
  if(!item?.url)return {ok:false};
  let url;try{url=new URL(String(item.url));}catch{return {ok:false};}
  if(!['http:','https:'].includes(url.protocol))return {ok:false};
  await shell.openExternal(url.href);return {ok:true};
});
ipcMain.handle('chrome:background-script-url',()=>{
  const file=app.isPackaged?path.join(process.resourcesPath,'aurestar-chrome','background.js'):path.join(__dirname,'..','resources','aurestar-chrome','background.js');
  return require('node:url').pathToFileURL(file).href;
});
ipcMain.handle('chrome:notification',(_event,payload)=>{
  const options=payload?.options||{};
  if(Notification.isSupported())new Notification({title:String(options.title||APP_NAME),body:String(options.message||''),silent:!!options.silent}).show();
  return String(payload?.id||'');
});
ipcMain.on('itsuki:drag',(_event,{dx=0,dy=0}={})=>{
  if(!itsukiWindow||itsukiWindow.isDestroyed())return;
  const [x,y]=itsukiWindow.getPosition();itsukiWindow.setPosition(x+Math.round(Number(dx)||0),y+Math.round(Number(dy)||0));
});
ipcMain.handle('state:get',()=>state);
ipcMain.handle('pomodoro:widget-close',()=>{closePomodoroWidget();return {ok:true};});
ipcMain.handle('pomodoro:widget-open',()=>{createPomodoroWidget();return {ok:true};});
ipcMain.handle('itsuki:hide',()=>{hideItsuki();return {ok:true};});
ipcMain.handle('itsuki:show',()=>{createItsuki();return {ok:true};});
ipcMain.handle('itsuki:dismiss',()=>{broadcastItsuki('dismiss');return {ok:true};});
ipcMain.handle('app:show',(_event,view='dashboard')=>{showMainWindow(view);return {ok:true};});
ipcMain.handle('itsuki:art-url',(_e,index=0)=>{const n=Math.max(1,Math.min(30,Number(index)||1));const file=path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..','resources'),'itsuki','expressions',`${n}.jpg`);return require('node:url').pathToFileURL(file).href;});
ipcMain.handle('state:save',(_e,next)=>{if(!next||typeof next!=='object')throw new Error('Invalid state');const previousStart=Boolean(state?.settings?.startWithWindows);state={...state,...next};saveState();broadcastWidget();if(process.platform==='win32'&&Boolean(state.settings?.startWithWindows)!==previousStart)app.setLoginItemSettings({openAtLogin:Boolean(state.settings.startWithWindows)});return state;});
ipcMain.handle('task:complete',(_e,{id,date=today()})=>{
  const t=state.tasks.find(x=>String(x.id)===String(id));if(!t)return {ok:false};
  t.completedDates=Array.isArray(t.completedDates)?t.completedDates:[];
  const done=t.completedDates.includes(date);
  if(done)t.completedDates=t.completedDates.filter(d=>d!==date);else{t.completedDates.push(date);state.completions.push({id:String(id),kind:'task',date,at:Date.now()});state.profile.xp=(state.profile.xp||0)+10;}
  saveState();return {ok:true,done:!done,state};
});
ipcMain.handle('focus:toggle',()=>{toggleFocus();return state.focus;});
ipcMain.handle('focus:reset',(_e,minutes)=>{state.focus={...state.focus,active:false,paused:false,phase:'focus',remaining:Math.max(1,Number(minutes)||25)*60,total:Math.max(1,Number(minutes)||25)*60,startedAt:0};saveState();broadcastWidget();return state.focus;});
ipcMain.handle('focus:finish',(_e,minutes)=>{const n=Math.max(1,Number(minutes)||25);state.focusSessions.push({id:crypto.randomUUID(),date:today(),minutes:n,createdAt:Date.now()});state.profile.totalFocusMinutes=(state.profile.totalFocusMinutes||0)+n;state.profile.xp=(state.profile.xp||0)+n;const cycles=(state.focus.completedCycles||0)+1;const every=Math.max(1,Number(state.settings.focusLongBreakEvery)||4);const breakMinutes=cycles%every===0?(Number(state.settings.focusLongBreak)||15):(Number(state.settings.focusShortBreak)||5);state.focus={...state.focus,active:false,paused:false,phase:'break',remaining:breakMinutes*60,total:breakMinutes*60,startedAt:0,completedCycles:cycles};state.completions.push({kind:'focus',date:today(),minutes:n,at:Date.now()});saveState();showReminderLine('Take a breath. Drink some water. Begin again.');broadcastWidget();return state;});
ipcMain.handle('data:export',async()=>{const r=await dialog.showSaveDialog(win,{title:'Export Aurestar backup',defaultPath:`Aurestar-${today()}.json`,filters:[{name:'JSON backup',extensions:['json']}]});if(r.canceled||!r.filePath)return {canceled:true};writeJsonAtomic(r.filePath,state);return {ok:true,filePath:r.filePath};});
ipcMain.handle('data:import',async()=>{const r=await dialog.showOpenDialog(win,{title:'Restore Aurestar backup',properties:['openFile'],filters:[{name:'JSON backup',extensions:['json']}]});if(r.canceled||!r.filePaths[0])return {canceled:true};const next=JSON.parse(fs.readFileSync(r.filePaths[0],'utf8'));if(!next||typeof next!=='object'||!Array.isArray(next.tasks))throw new Error('This file is not a valid Aurestar data backup.');if(fs.existsSync(dataFile())){fs.mkdirSync(backupDir(),{recursive:true});fs.copyFileSync(dataFile(),path.join(backupDir(),`aurestar-pre-import-${Date.now()}.json`));}state={...defaultState(),...next,settings:{...defaultState().settings,...next.settings}};chromeStorageCache=state;saveState();win?.webContents.send('aurestar:state',state);return {ok:true,state};});
ipcMain.handle('backup:now',()=>{fs.mkdirSync(backupDir(),{recursive:true});const p=path.join(backupDir(),`aurestar-${today()}-${Date.now()}.json`);fs.copyFileSync(dataFile(),p);return {ok:true,path:p};});
ipcMain.handle('notification:test',()=>{notify(APP_NAME,'Notifications are working.');return {ok:true};});
ipcMain.handle('app:open-external',async(_e,value)=>{let url;try{url=new URL(String(value||''));}catch{return false;}if(!['http:','https:'].includes(url.protocol))return false;await shell.openExternal(url.href);return true;});
ipcMain.handle('app:version',()=>app.getVersion());
function broadcastIdleState(next){
  if(next===lastIdleState)return;
  lastIdleState=next;
  if(backgroundWin&&!backgroundWin.isDestroyed())backgroundWin.webContents.send('chrome:idle-state',next);
}
function pollSystemIdle(){
  try{broadcastIdleState(powerMonitor.getSystemIdleState(idleDetectionSeconds));}
  catch{broadcastIdleState('active');}
}
function initializeNativeServices(){
  nativeAlarms=createAlarmScheduler({onAlarm:alarm=>{
    if(chromeBackgroundReady&&backgroundWin&&!backgroundWin.isDestroyed())backgroundWin.webContents.send('chrome:alarm-fired',alarm);
    else pendingNativeAlarms.push(alarm);
  }});
  lastIdleState=powerMonitor.getSystemIdleState(idleDetectionSeconds);
  idlePollTimer=setInterval(pollSystemIdle,5000);
  powerMonitor.on('resume',()=>{nativeAlarms?.resume();pollSystemIdle();});
  powerMonitor.on('lock-screen',()=>broadcastIdleState('locked'));
  powerMonitor.on('unlock-screen',()=>{lastIdleState='idle';pollSystemIdle();});
}
app.whenReady().then(()=>{
  initializeNativeServices();state=readState();saveState();createBackgroundWindow();createWindow();createTray();createApplicationMenu();if(state.settings?.focusWidgetEnabled!==false)createPomodoroWidget();
  globalShortcut.register('CommandOrControl+Shift+L',toggleFocus);
  globalShortcut.register('CommandOrControl+Shift+K',()=>{if(!win)createWindow();win?.show();win?.webContents.send('aurestar:quick-add');});
  // A bare Alt key is handled by before-input-event while an Aurestar window is focused.
  installItsukiHotkeys();
  if(process.platform==='win32' && state.settings.startWithWindows){app.setLoginItemSettings({openAtLogin:true});}
  app.on('activate',()=>{if(!win)createWindow();else win.show();const prefs=chromeStorageGet('settings').settings||{};if(!pomodoroWidget&&prefs.focusWidgetEnabled!==false)createPomodoroWidget();});
});
app.on('before-quit',()=>{app.isQuitting=true;if(reminderTimer)clearTimeout(reminderTimer);if(idlePollTimer)clearInterval(idlePollTimer);nativeAlarms?.close();if(focusTickTimer)clearInterval(focusTickTimer);globalShortcut.unregisterAll();if(state&&chromeStorageCache)saveState();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin' && !state?.settings?.minimizeToTray)app.quit();});
app.whenReady().catch(error=>{
  console.error('Aurestar startup failed safely:',error);
  dialog.showErrorBox('Aurestar could not open its data',`${String(error?.message||error)}\n\nThe original data files were preserved. Restore a backup or inspect the backups folder before trying again.`);
  app.quit();
});
