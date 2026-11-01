const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, dialog, shell, nativeImage, globalShortcut } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

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
let chromeStorageCache=null;
const chromeStorageFile=()=>path.join(dataDir(),'aurestar-chrome-storage.json');
function cloneValue(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function readChromeStorage(){
  if(chromeStorageCache)return chromeStorageCache;
  try{chromeStorageCache=JSON.parse(fs.readFileSync(chromeStorageFile(),'utf8'))||{};}
  catch{
    chromeStorageCache={};
    try{
      const legacy=JSON.parse(fs.readFileSync(dataFile(),'utf8'));
      for(const key of ['settings','profile','lists','tasks','habits','focusSessions','workoutSessions','completions','achievements','goals','reviews']){
        if(legacy[key]!==undefined)chromeStorageCache[key]=legacy[key];
      }
    }catch{}
    saveChromeStorage();
  }
  return chromeStorageCache;
}
function saveChromeStorage(){
  fs.mkdirSync(dataDir(),{recursive:true});
  fs.writeFileSync(chromeStorageFile(),JSON.stringify(chromeStorageCache||{},null,2),'utf8');
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
  saveChromeStorage();broadcastChromeStorage(changes);return true;
}
function chromeStorageRemove(keys){
  const store=readChromeStorage(),changes={};
  for(const key of (Array.isArray(keys)?keys:[keys])){
    if(typeof key!=='string'||!Object.prototype.hasOwnProperty.call(store,key))continue;
    changes[key]={oldValue:cloneValue(store[key])};delete store[key];
  }
  saveChromeStorage();broadcastChromeStorage(changes);return true;
}
function chromeStorageClear(){
  const store=readChromeStorage(),changes={};
  for(const [key,value] of Object.entries(store))changes[key]={oldValue:cloneValue(value)};
  chromeStorageCache={};saveChromeStorage();broadcastChromeStorage(changes);return true;
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
  let s;try{s=JSON.parse(fs.readFileSync(dataFile(),'utf8'));}catch{return defaultState();}
  const base=defaultState();
  const merged={...base,...s,settings:{...base.settings,...s.settings},profile:{...base.profile,...s.profile},focus:{...base.focus,...s.focus},training:{...base.training,...s.training}};
  merged.tasks=Array.isArray(merged.tasks)?merged.tasks:[];
  const exerciseTasks=merged.tasks.filter(t=>t.workoutConfig?.enabled||t.workoutExercise===true);
  const aggregate=merged.tasks.find(t=>t.trainingAggregate)||{id:'training-aggregate',title:'Training',trainingAggregate:true,priority:'medium',estimate:30,repeat:{type:'none'},createdAt:Date.now(),completedDates:[],archived:false,notes:'All exercises are tracked within the Training session.'};
  if(exerciseTasks.length){
    const daySets=exerciseTasks.map(t=>new Set(t.completedDates||[]));
    const common=[...(daySets[0]||[])].filter(day=>daySets.every(set=>set.has(day)));
    aggregate.completedDates=[...new Set([...(aggregate.completedDates||[]),...common])];
    merged.tasks=merged.tasks.filter(t=>!exerciseTasks.includes(t));
  }
  if(!merged.tasks.includes(aggregate))merged.tasks.push(aggregate);
  merged.workoutSessions=Array.isArray(merged.workoutSessions)?merged.workoutSessions:[];
  return merged;
}
function saveState(){ fs.mkdirSync(dataDir(),{recursive:true}); fs.writeFileSync(dataFile(),JSON.stringify(state,null,2),'utf8'); }
function notify(title,body){
  if (!state?.settings?.notifications || !Notification.isSupported()) return;
  new Notification({title,body,silent:false}).show();
}
function showReminderLine(_text){ /* Motivation-style overlays intentionally removed. */ }
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
  bindAltToggle(pomodoroWidget);
  pomodoroWidget.loadFile(path.join(__dirname,'pomodoro-widget.html'));
  pomodoroWidget.once('ready-to-show',()=>{pomodoroWidget?.show();pomodoroWidget?.moveTop();broadcastWidget();});
  pomodoroWidget.on('closed',()=>{pomodoroWidget=null;});
}
function closePomodoroWidget(){if(pomodoroWidget&&!pomodoroWidget.isDestroyed())pomodoroWidget.close();}

function createWindow(){
  win=new BrowserWindow({width:1440,height:920,minWidth:1024,minHeight:700,show:false,backgroundColor:'#211217',title:APP_NAME,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  bindAltToggle(win);
  win.loadFile(path.join(__dirname,'index.html'));
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
    {label:'Start / pause focus',accelerator:'Ctrl+Shift+L',click:()=>toggleFocus()},
    {label:'Quick add task',accelerator:'Ctrl+Shift+K',click:()=>{if(!win)createWindow();win?.show();win?.webContents.send('aurestar:quick-add');}},
    {type:'separator'},{label:'Quit',click:()=>{app.isQuitting=true;app.quit();}}
  ]));
  tray.on('double-click',()=>{if(!win)createWindow();else win.show();});
}
async function toggleFocus(){
  try{
    const current=await sendChromeMessage({type:'getFocusState'});
    const active=Boolean(current?.result?.focus?.active);
    await sendChromeMessage({type:active?'focusPause':'focusStart'});
  }catch(error){console.error('Focus shortcut failed',error);}
}
ipcMain.on('chrome:background-ready',()=>{
  chromeBackgroundReady=true;
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
ipcMain.handle('chrome:background-script-url',()=>{
  const file=app.isPackaged?path.join(process.resourcesPath,'aurestar-chrome','background.js'):path.join(__dirname,'..','legacy-extension','Aurestar','background.js');
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
ipcMain.handle('app:show',()=>{if(!win)createWindow();win?.show();win?.focus();return {ok:true};});
ipcMain.handle('itsuki:art-url',(_e,index=0)=>{const n=Math.max(1,Math.min(30,Number(index)||1));const file=app.isPackaged?path.join(process.resourcesPath,'itsuki','expressions',`${n}.jpg`):path.join(__dirname,'..','legacy-extension','Aurestar','assets','itsuki',`${n}.jpg`);return require('node:url').pathToFileURL(file).href;});
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
ipcMain.handle('data:export',async()=>{const r=await dialog.showSaveDialog(win,{title:'Export Aurestar backup',defaultPath:`Aurestar-${today()}.json`,filters:[{name:'JSON backup',extensions:['json']}]});if(r.canceled||!r.filePath)return {canceled:true};fs.writeFileSync(r.filePath,JSON.stringify(state,null,2),'utf8');return {ok:true,filePath:r.filePath};});
ipcMain.handle('data:import',async()=>{const r=await dialog.showOpenDialog(win,{title:'Restore Aurestar backup',properties:['openFile'],filters:[{name:'JSON backup',extensions:['json']}]});if(r.canceled||!r.filePaths[0])return {canceled:true};const next=JSON.parse(fs.readFileSync(r.filePaths[0],'utf8'));if(!next||typeof next!=='object'||!Array.isArray(next.tasks))throw new Error('This file is not a valid Aurestar data backup.');state={...defaultState(),...next,settings:{...defaultState().settings,...next.settings}};saveState();win?.webContents.send('aurestar:state',state);return {ok:true,state};});
ipcMain.handle('backup:now',()=>{fs.mkdirSync(backupDir(),{recursive:true});const p=path.join(backupDir(),`aurestar-${today()}-${Date.now()}.json`);fs.copyFileSync(dataFile(),p);return {ok:true,path:p};});
ipcMain.handle('notification:test',()=>{notify(APP_NAME,'Notifications are working.');return {ok:true};});
ipcMain.handle('app:open-external',async(_e,url)=>{if(typeof url!=='string'||!/^https?:\/\//i.test(url))return false;await shell.openExternal(url);return true;});
ipcMain.handle('app:version',()=>app.getVersion());
app.whenReady().then(()=>{
  state=readState();saveState();createBackgroundWindow();createWindow();createTray();createPomodoroWidget();createItsuki();
  globalShortcut.register('CommandOrControl+Shift+L',toggleFocus);
  globalShortcut.register('CommandOrControl+Shift+K',()=>{if(!win)createWindow();win?.show();win?.webContents.send('aurestar:quick-add');});
  // A bare Alt key is handled by before-input-event while an Aurestar window is focused.
  installItsukiHotkeys();
  if(process.platform==='win32' && state.settings.startWithWindows){app.setLoginItemSettings({openAtLogin:true});}
  app.on('activate',()=>{if(!win)createWindow();else win.show();if(!pomodoroWidget)createPomodoroWidget();});
});
app.on('before-quit',()=>{app.isQuitting=true;if(reminderTimer)clearInterval(reminderTimer);if(focusTickTimer)clearInterval(focusTickTimer);globalShortcut.unregisterAll();saveState();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin' && !state?.settings?.minimizeToTray)app.quit();});
