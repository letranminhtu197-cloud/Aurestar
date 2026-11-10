const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, dialog, shell, nativeImage, globalShortcut, powerMonitor, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { migrateJsonStores, normalizeStateCollections, readJsonFile, writeJsonAtomic } = require('./core/persistence.cjs');
const { createAlarmScheduler } = require('./core/alarm-scheduler.cjs');
const { createDatabase } = require('./core/sqlite.cjs');
const { createZipBackup, readZipBackup } = require('./core/zip-backup.cjs');
let database = null;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) app.quit();
else app.on('second-instance', () => {
  if (!app.isReady()) return;
  showMainWindow('dashboard');
});

const testDataPath=!app.isPackaged&&process.env.AURESTAR_TEST_DATA_DIR?path.resolve(process.env.AURESTAR_TEST_DATA_DIR):null;
const portableDataPath=process.env.PORTABLE_EXECUTABLE_DIR?path.join(process.env.PORTABLE_EXECUTABLE_DIR,'AurestarData'):null;
app.setPath('userData',testDataPath||portableDataPath||path.join(app.getPath('appData'),'aurestar-desktop'));

const APP_NAME = 'Aurestar';
const companionWidgetsEnabled = false;
let win = null, tray = null, pomodoroWidget = null, itsukiWindow = null, reminderWindow = null, reminderTimer = null;
let state = null;
const widgetPositionTimers=new Map();
const widgetLayout={pomodoro:{width:228,height:92,setting:'pomodoroWidgetPosition'},itsuki:{width:460,height:260,setting:'itsukiWidgetPosition'}};
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const dataDir = () => app.getPath('userData');
const dataFile = () => path.join(dataDir(), 'aurestar-data.json');
const backupDir = () => path.join(dataDir(), 'backups');
let backgroundWin=null, chromeBackgroundReady=false;
let rendererCrashTimes=[];
let rendererRecoveryTimer=null;
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
function assertWorkspaceSender(event){if(!win||win.isDestroyed()||event.sender!==win.webContents)throw new Error('Giao diện không đáng tin cậy đã cố truy cập IPC của không gian làm việc.');}
function secureWindow(browserWindow){
  browserWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  browserWindow.webContents.on('will-navigate',(event,url)=>{
    if(isTrustedLocalUrl(url))return;
    event.preventDefault();
    if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(error=>console.warn('Không thể mở liên kết bên ngoài.',error));
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
    const wasCompanionEnabled=previous.privacyMode!==true&&previous.itsukiCompanionEnabled!==false;
    const nextCompanionEnabled=settings.privacyMode!==true&&settings.itsukiCompanionEnabled!==false;
    if(wasCompanionEnabled!==nextCompanionEnabled){if(nextCompanionEnabled)createItsuki();else hideItsuki({persist:false});}
  }
  const expression=changes.itsukiExpressionState?.newValue;
  if(['wind-down','sleep'].includes(String(expression?.event||''))&&store.settings?.privacyMode!==true&&store.settings?.itsukiCompanionEnabled!==false){
    store.settings.itsukiWidgetHiddenByUser=false;state=store;saveState();createItsuki({scheduled:true});
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
    const timer=setTimeout(()=>reject(new Error('Dịch vụ nền của ứng dụng không khởi động được.')),15000);
    chromeBackgroundWaiters.push(()=>{clearTimeout(timer);resolve();});
  });
}
function sendChromeMessage(message){
  return waitForChromeBackground().then(()=>new Promise((resolve,reject)=>{
    const id=crypto.randomUUID(),timer=setTimeout(()=>{
      pendingChromeMessages.delete(id);reject(new Error('Đã hết thời gian chờ phản hồi từ dịch vụ nền.'));
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
  settings: { notifications:true, dailyReminder:'08:00', taskReminders:true, autoBackup:true, backupTime:'23:30', focusPreset:25, focusShortBreak:5, focusLongBreak:15, focusLongBreakEvery:4, blockedWebsites:['tiktok.com','facebook.com','youtube.com'], blockDuringFocus:true, startWithWindows:false, minimizeToTray:true, theme:'dark', language:'vi', itsukiCompanionEnabled:false, itsukiWidgetHiddenByUser:true },
  profile:{totalFocusMinutes:0,level:1,xp:0,streak:0,lastActiveDate:''},
  tasks:[], habits:[], lists:[{id:'inbox',name:'Inbox',color:'red',createdAt:Date.now()}],
  focusSessions:[], workoutSessions:[], completions:[], remindersSent:{}, training:{active:false,paused:false,remaining:0,elapsed:0,exerciseIndex:0,exercises:[]}, focus:{active:false,paused:false,phase:'focus',remaining:1500,total:1500,startedAt:0,taskId:null,completedCycles:0},

});
function readState(){
  const s=readChromeStorage();
  const base=defaultState();
  const merged={...base,...s,settings:{...base.settings,...s.settings},profile:{...base.profile,...s.profile},focus:{...base.focus,...s.focus},training:{...base.training,...s.training}};
  const safe=normalizeStateCollections(merged,base);
  safe.tasks=Array.isArray(safe.tasks)?safe.tasks:[];
  chromeStorageCache=safe;
  return safe;
}
function saveState(){ if(!state||typeof state!=='object')return;chromeStorageCache=state;saveChromeStorage(); }
function notify(title,body){
  if (!state?.settings?.notifications || !Notification.isSupported()) return;
  new Notification({title,body,silent:false}).show();
}
function showReminderLine(text){
  const message=String(text||'Nhắc nhở từ Aurestar').replace(/[\r\n\t]+/g,' ').trim().slice(0,220)||'Nhắc nhở từ Aurestar';
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
  if(hm==='05:30') sendReminder('wake-0530','Mỗi buổi sáng là một khởi đầu mới.');
  if(hm==='06:00') sendReminder('wake-0600','Muốn tiến về phía trước, hãy bắt đầu từ một việc nhỏ.');
  if(hm==='20:45') sendReminder('wind-down','Nghỉ ngơi cũng là một phần của hành trình. Hãy bắt đầu thư giãn.');
  if(hm==='21:00') sendReminder('sleep','Một ngày ý nghĩa sẽ mang đến giấc ngủ an lành.');
  if(hm===state.settings.dailyReminder) sendReminder('daily','Kế hoạch học tập đã sẵn sàng. Hãy chọn một việc cụ thể và bắt đầu từ bước đầu tiên.');
  if(state.settings.taskReminders){
    for(const t of state.tasks||[]) if(!t.archived && t.dueDate===today() && t.dueTime===hm && !(t.completedDates||[]).includes(today())) sendReminder('task-'+t.id,`Task reminder: ${t.title}`);
  }
  if(state.settings.autoBackup && hm===state.settings.backupTime && !state.remindersSent[today()+':backup']){
    try{fs.mkdirSync(backupDir(),{recursive:true});fs.copyFileSync(dataFile(),path.join(backupDir(),`aurestar-${today()}.json`));state.remindersSent[today()+':backup']=Date.now();saveState();}catch(e){console.error('Sao lưu tự động thất bại',e);}
  }
}
function clampWidgetPosition(bounds){
  const display=screen.getDisplayNearestPoint({x:Math.round(bounds.x+bounds.width/2),y:Math.round(bounds.y+bounds.height/2)}),area=display.workArea;
  return {x:Math.min(area.x+area.width-bounds.width,Math.max(area.x,Math.round(bounds.x))),y:Math.min(area.y+area.height-bounds.height,Math.max(area.y,Math.round(bounds.y)))};
}
function widgetPosition(key){
  const layout=widgetLayout[key],area=screen.getPrimaryDisplay().workArea,stored=state?.settings?.[layout.setting];
  const desired=stored&&Number.isFinite(Number(stored.x))&&Number.isFinite(Number(stored.y))?{x:Number(stored.x),y:Number(stored.y)}:
    key==='pomodoro'?{x:area.x+area.width-layout.width-16,y:area.y+16}:{x:area.x+16,y:area.y+area.height-layout.height-16};
  return clampWidgetPosition({...desired,width:layout.width,height:layout.height});
}
function overlaps(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
function persistWidgetPositionNow(key,browserWindow){
  const pending=widgetPositionTimers.get(key);if(pending)clearTimeout(pending);widgetPositionTimers.delete(key);
  if(!browserWindow||browserWindow.isDestroyed()||!state)return;
  const [x,y]=browserWindow.getPosition(),setting=widgetLayout[key].setting;state.settings={...(state.settings||{}),[setting]:{x,y}};saveState();
}
function saveWidgetPosition(key,browserWindow){
  const pending=widgetPositionTimers.get(key);if(pending)clearTimeout(pending);
  widgetPositionTimers.set(key,setTimeout(()=>persistWidgetPositionNow(key,browserWindow),350));
}
function trackWidgetPosition(key,browserWindow){
  browserWindow.on('move',()=>{
    if(browserWindow.isDestroyed())return;
    const [x,y]=browserWindow.getPosition(),layout=widgetLayout[key],clamped=clampWidgetPosition({x,y,width:layout.width,height:layout.height});
    if(x!==clamped.x||y!==clamped.y)browserWindow.setPosition(clamped.x,clamped.y);
    const other=key==='pomodoro'?itsukiWindow:pomodoroWidget;
    if(other&&!other.isDestroyed()&&other.isVisible()){
      const [ox,oy]=other.getPosition(),otherSize=other.getBounds(),otherBounds={x:ox,y:oy,width:otherSize.width,height:otherSize.height};
      if(overlaps({...clamped,width:layout.width,height:layout.height},otherBounds)){
        const area=screen.getDisplayNearestPoint({x:clamped.x+layout.width/2,y:clamped.y+layout.height/2}).workArea;
        const candidates=[{x:area.x+12,y:area.y+12},{x:area.x+area.width-layout.width-12,y:area.y+12},{x:area.x+12,y:area.y+area.height-layout.height-12},{x:area.x+area.width-layout.width-12,y:area.y+area.height-layout.height-12}]
          .map(pos=>({...pos,width:layout.width,height:layout.height})).filter(pos=>!overlaps(pos,otherBounds));
        if(candidates.length){candidates.sort((a,b)=>Math.hypot(a.x-clamped.x,a.y-clamped.y)-Math.hypot(b.x-clamped.x,b.y-clamped.y));browserWindow.setPosition(candidates[0].x,candidates[0].y);}
      }
    }
    saveWidgetPosition(key,browserWindow);
  });
  browserWindow.on('close',()=>persistWidgetPositionNow(key,browserWindow));
}
function separateWidgets(){
  if(!pomodoroWidget||pomodoroWidget.isDestroyed()||!pomodoroWidget.isVisible()||!itsukiWindow||itsukiWindow.isDestroyed()||!itsukiWindow.isVisible())return;
  const [px,py]=pomodoroWidget.getPosition(),[ix,iy]=itsukiWindow.getPosition(),ib=itsukiWindow.getBounds(),pb=pomodoroWidget.getBounds();
  if(!overlaps({x:px,y:py,width:pb.width,height:pb.height},{x:ix,y:iy,width:ib.width,height:ib.height}))return;
  const area=screen.getDisplayNearestPoint({x:ix+ib.width/2,y:iy+ib.height/2}).workArea;
  const positions=[{x:area.x+12,y:area.y+area.height-ib.height-12},{x:area.x+area.width-ib.width-12,y:area.y+12},{x:area.x+area.width-ib.width-12,y:area.y+area.height-ib.height-12},{x:area.x+12,y:area.y+12}];
  const open=positions.find(pos=>!overlaps({...pos,width:ib.width,height:ib.height},{x:px,y:py,width:pb.width,height:pb.height}));
  if(open){itsukiWindow.setPosition(open.x,open.y);saveWidgetPosition('itsuki',itsukiWindow);}
}
function repositionWidgetsForDisplayChange(){
  for(const [key,browserWindow] of [['pomodoro',pomodoroWidget],['itsuki',itsukiWindow]]){
    if(!browserWindow||browserWindow.isDestroyed())continue;
    const [x,y]=browserWindow.getPosition(),layout=widgetLayout[key],next=clampWidgetPosition({x,y,width:layout.width,height:layout.height});
    if(x!==next.x||y!==next.y){browserWindow.setPosition(next.x,next.y);saveWidgetPosition(key,browserWindow);}
  }
  separateWidgets();
}
function createItsuki(options={}){
  if(!companionWidgetsEnabled)return;
  if(state?.settings?.privacyMode===true||state?.settings?.itsukiCompanionEnabled===false)return;
  if(options.startup&&state?.settings?.itsukiWidgetHiddenByUser===true)return;
  if(!options.startup){state.settings={...(state.settings||{}),itsukiWidgetHiddenByUser:false};saveState();}
  if(itsukiWindow&&!itsukiWindow.isDestroyed()){itsukiWindow.show();itsukiWindow.moveTop();return;}
  const {x,y}=widgetPosition('itsuki');
  itsukiWindow=new BrowserWindow({width:widgetLayout.itsuki.width,height:widgetLayout.itsuki.height,x,y,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,show:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(itsukiWindow);bindAltToggle(itsukiWindow);trackWidgetPosition('itsuki',itsukiWindow);
  itsukiWindow.loadFile(path.join(__dirname,'itsuki.html'));
  itsukiWindow.once('ready-to-show',()=>{itsukiWindow?.show();itsukiWindow?.moveTop();separateWidgets();});
  itsukiWindow.on('close',e=>{if(!app.isQuitting){e.preventDefault();hideItsuki();}});
  itsukiWindow.on('closed',()=>{itsukiWindow=null;});
}
function hideItsuki({persist=true}={}){if(persist&&state){state.settings={...(state.settings||{}),itsukiWidgetHiddenByUser:true};saveState();}if(itsukiWindow&&!itsukiWindow.isDestroyed())itsukiWindow.hide();}

function createPomodoroWidget(){
  if(pomodoroWidget&&!pomodoroWidget.isDestroyed()){pomodoroWidget.show();pomodoroWidget.moveTop();return;}
  const {x,y}=widgetPosition('pomodoro');
  pomodoroWidget=new BrowserWindow({width:widgetLayout.pomodoro.width,height:widgetLayout.pomodoro.height,x,y,frame:false,transparent:true,alwaysOnTop:true,skipTaskbar:true,resizable:false,minimizable:false,maximizable:false,closable:true,show:false,backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(pomodoroWidget);bindAltToggle(pomodoroWidget);trackWidgetPosition('pomodoro',pomodoroWidget);
  pomodoroWidget.loadFile(path.join(__dirname,'pomodoro-widget.html'));
  pomodoroWidget.once('ready-to-show',()=>{pomodoroWidget?.show();pomodoroWidget?.moveTop();separateWidgets();});
  pomodoroWidget.on('closed',()=>{pomodoroWidget=null;});
}
function closePomodoroWidget(){if(pomodoroWidget&&!pomodoroWidget.isDestroyed())pomodoroWidget.close();}

function createWindow(initialView='home'){
  const allowedViews=['home','goals','projects','tasks'];
  const route=allowedViews.includes(String(initialView))?String(initialView):'home';
  win=new BrowserWindow({width:1440,height:920,minWidth:1024,minHeight:700,show:false,backgroundColor:'#211217',title:APP_NAME,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload-v2.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  secureWindow(win);
  bindAltToggle(win);
  win.loadFile(path.join(__dirname,'app','dist','index.html'),{hash:route.replace(/^#/,'')});
  win.once('ready-to-show',()=>win.show());
  win.webContents.on('render-process-gone',(_event,details)=>{
    if(app.isQuitting||!win||win.isDestroyed())return;
    const now=Date.now();
    rendererCrashTimes=rendererCrashTimes.filter(at=>now-at<60_000);
    rendererCrashTimes.push(now);
    console.error('Tiến trình giao diện Aurestar đã thoát:',details);
    if(rendererCrashTimes.length>2){
      dialog.showErrorBox('Giao diện Aurestar đã dừng', 'Giao diện đã dừng nhiều lần. Aurestar sẽ đóng an toàn. Dữ liệu đã lưu vẫn được giữ nguyên.');
      app.quit();
      return;
    }
    if(rendererRecoveryTimer)clearTimeout(rendererRecoveryTimer);
    rendererRecoveryTimer=setTimeout(()=>{
      rendererRecoveryTimer=null;
      if(!app.isQuitting&&win&&!win.isDestroyed())win.webContents.reload();
    },800);
  });
  win.on('close',(e)=>{if(state?.settings?.minimizeToTray && tray && !app.isQuitting){e.preventDefault();win.hide();}});
  win.on('closed',()=>{win=null;});
}
function openQuickAddTask(){
  if(!win||win.isDestroyed())createWindow('tasks');
  else { win.show(); win.focus(); }
  const send=()=>{if(win&&!win.isDestroyed())win.webContents.send('aurestar:quick-add');};
  if(win?.webContents.isLoadingMainFrame())win.webContents.once('did-finish-load',send);else send();
}
function createTray(){
  const iconPath=path.join(__dirname,'icons','icon16.png');
  let icon=fs.existsSync(iconPath)?nativeImage.createFromPath(iconPath):nativeImage.createEmpty();
  if(process.platform==='win32' && !icon.isEmpty()) icon=icon.resize({width:16,height:16});
  tray=new Tray(icon);tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'Mở Aurestar',click:()=>showMainWindow('home')},
    {label:'Hiện Itsuki (Ctrl+F6)',click:()=>createItsuki()},
    {label:'Ẩn Itsuki (F6)',click:()=>hideItsuki()},
    {label:'Bắt đầu / tạm dừng tập trung',click:()=>toggleFocus()},
    {label:'Thêm công việc nhanh',click:openQuickAddTask},
    {type:'separator'},{label:'Thoát Aurestar',click:()=>{app.isQuitting=true;app.quit();}}
  ]));
  tray.on('double-click',()=>showMainWindow('home'));
}
function showMainWindow(view='home'){
  const requested=String(view||'home');
  const target=requested==='dashboard'?'home':requested;
  if(!['home','goals','projects','tasks'].includes(target))return;
  if(!win||win.isDestroyed())createWindow(target);
  else{
    win.show();win.focus();
    const navigate=()=>win&&!win.isDestroyed()&&win.webContents.send('aurestar:navigate',target);
    if(win.webContents.isLoadingMainFrame())win.webContents.once('did-finish-load',navigate);else navigate();
  }
}
function createApplicationMenu(){
  const view=(name)=>()=>showMainWindow(name);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'File',submenu:[
      {label:'Mở Aurestar',click:view('home')},
      {label:'Thêm công việc nhanh',accelerator:'CommandOrControl+N',click:openQuickAddTask},
      {type:'separator'},{label:'Thoát Aurestar',accelerator:'Alt+F4',click:()=>{app.isQuitting=true;app.quit();}}
    ]},
    {label:'View',submenu:[
      {label:'Overview',click:view('home')},{label:'Goals',click:view('goals')},
      {label:'Projects',click:view('projects')},{label:'Tasks',click:view('tasks')}
    ]},
    {label:'Tools',submenu:[
      {label:'Hiện Itsuki',click:createItsuki},{label:'Ẩn Itsuki',click:hideItsuki}
    ]},
    {label:'Help',submenu:[{label:`About ${APP_NAME}`,click:()=>dialog.showMessageBox({title:`About ${APP_NAME}`,message:`${APP_NAME} ${app.getVersion()}`,detail:'Không gian quản lý năng suất cá nhân, ưu tiên ngoại tuyến.'})}]}
  ]));
}
async function toggleFocus(){
  try{
    const current=await sendChromeMessage({type:'getFocusState'});
    const active=Boolean(current?.result?.focus?.active);
    return await sendChromeMessage({type:active?'focusPause':'focusStart'});
  }catch(error){console.error('Phím tắt tập trung không hoạt động',error);}
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
  const messages={wake:'Chào buổi sáng. Hãy chuẩn bị và bắt đầu với một việc nhỏ.',study:'Hãy chọn một công việc và bắt đầu ngay.', 'wind-down':'Đã đến lúc thư giãn và chuẩn bị đi ngủ.',sleep:'Hãy cất thiết bị và chuẩn bị nghỉ ngơi.'};
  showReminderLine(payload?.text||messages[String(payload?.type||'').toLowerCase()]||'Your Aurestar reminder is ready.');return {ok:true};
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
ipcMain.handle('state:get',()=>state);
ipcMain.handle('v2:workspace:load',event=>{assertWorkspaceSender(event);return database.loadWorkspace();});
ipcMain.handle('v2:goal:save',(event,input)=>{assertWorkspaceSender(event);return database.saveGoal(input);});
ipcMain.handle('v2:goal:delete',(event,id)=>{assertWorkspaceSender(event);return database.deleteGoal(id);});
ipcMain.handle('v2:milestone:save',(event,input)=>{assertWorkspaceSender(event);return database.saveMilestone(input);});
ipcMain.handle('v2:milestone:delete',(event,id)=>{assertWorkspaceSender(event);return database.deleteMilestone(id);});
ipcMain.handle('v2:project:save',(event,input)=>{assertWorkspaceSender(event);return database.saveProject(input);});
ipcMain.handle('v2:project:delete',(event,id)=>{assertWorkspaceSender(event);return database.deleteProject(id);});
ipcMain.handle('v2:task:save',(event,input)=>{assertWorkspaceSender(event);return database.saveTask(input);});
ipcMain.handle('v2:task:toggle',(event,id)=>{assertWorkspaceSender(event);return database.toggleTask(id);});
ipcMain.handle('v2:task:status',(event,id,status)=>{assertWorkspaceSender(event);return database.setTaskStatus(id,status);});
ipcMain.handle('v2:goal:archive',(event,id,archived)=>{assertWorkspaceSender(event);return database.setArchived('goal',id,archived);});
ipcMain.handle('v2:project:archive',(event,id,archived)=>{assertWorkspaceSender(event);return database.setArchived('project',id,archived);});
ipcMain.handle('v2:task:archive',(event,id,archived)=>{assertWorkspaceSender(event);return database.setArchived('task',id,archived);});
ipcMain.handle('v2:goal:duplicate',(event,id)=>{assertWorkspaceSender(event);return database.duplicateGoal(id);});
ipcMain.handle('v2:project:duplicate',(event,id)=>{assertWorkspaceSender(event);return database.duplicateProject(id);});
ipcMain.handle('v2:task:duplicate',(event,id)=>{assertWorkspaceSender(event);return database.duplicateTask(id);});
ipcMain.handle('v2:notification:show',(event,input)=>{assertWorkspaceSender(event);if(!Notification.isSupported())return {supported:false};const title=String(input?.title||'Aurestar').slice(0,100),body=String(input?.body||'').slice(0,300);new Notification({title,body,silent:input?.silent===true}).show();return {supported:true};});
ipcMain.handle('v2:app:info',event=>{assertWorkspaceSender(event);return {name:app.getName(),version:app.getVersion(),electron:process.versions.electron,node:process.versions.node,platform:process.platform,arch:process.arch,build:app.isPackaged?'production':'development'};});
ipcMain.handle('v2:settings:save',(event,input)=>{assertWorkspaceSender(event);const saved=database.saveSettings(input);if(Object.prototype.hasOwnProperty.call(input||{},'privacyMode')){if(input.privacyMode===true)hideItsuki();else if(state?.settings?.itsukiCompanionEnabled!==false)createItsuki();}return saved;});
ipcMain.handle('v2:task:delete',(event,id)=>{assertWorkspaceSender(event);return database.deleteTask(id);});
ipcMain.handle('v2:phase2:habits:list',event=>{assertWorkspaceSender(event);return database.phase2.listHabits();});
ipcMain.handle('v2:phase2:habits:delete',(event,id)=>{assertWorkspaceSender(event);return database.phase2.deleteHabit(id);});
ipcMain.handle('v2:phase2:habits:archive',(event,id,archived)=>{assertWorkspaceSender(event);return database.phase2.archiveHabit(id,archived);});
ipcMain.handle('v2:phase2:habits:save',(event,input)=>{assertWorkspaceSender(event);return database.phase2.saveHabit(input);});
ipcMain.handle('v2:phase2:habits:log',(event,input)=>{assertWorkspaceSender(event);return database.phase2.logHabit(input);});
ipcMain.handle('v2:phase2:habits:logs',(event,from,to)=>{assertWorkspaceSender(event);return database.phase2.listHabitLogs(from,to);});
ipcMain.handle('v2:phase2:focus:save',(event,input)=>{assertWorkspaceSender(event);return database.phase2.saveFocusSession(input);});
ipcMain.handle('v2:phase2:focus:list',(event,limit)=>{assertWorkspaceSender(event);return database.phase2.listFocusSessions(limit);});
ipcMain.handle('v2:phase2:journal:delete',(event,id)=>{assertWorkspaceSender(event);return database.phase2.deleteJournalEntry(id);});
ipcMain.handle('v2:phase2:journal:save',(event,input)=>{assertWorkspaceSender(event);return database.phase2.saveJournalEntry(input);});
ipcMain.handle('v2:phase2:journal:list',(event,limit)=>{assertWorkspaceSender(event);return database.phase2.listJournalEntries(limit);});
ipcMain.handle('v2:phase2:review:summary',(event,from,to)=>{assertWorkspaceSender(event);return database.phase2.getWeeklyReviewSummary(from,to);});
ipcMain.handle('v2:phase2:review:save',(event,input)=>{assertWorkspaceSender(event);return database.phase2.saveWeeklyReview(input);});
ipcMain.handle('v2:phase2:review:list',(event,limit)=>{assertWorkspaceSender(event);return database.phase2.listWeeklyReviews(limit);});
ipcMain.handle('v2:phase2:search',(event,q,limit)=>{assertWorkspaceSender(event);return database.phase2.searchAll(q,limit);});
ipcMain.handle('v2:phase2:insights',(event,from,to)=>{assertWorkspaceSender(event);return database.phase2.getInsights(from,to);});
ipcMain.handle('v2:phase2:export',event=>{assertWorkspaceSender(event);return database.phase2.exportData();});
ipcMain.handle('v2:phase2:import:preview',(event,payload)=>{assertWorkspaceSender(event);return database.phase2.previewImport(payload);});
ipcMain.handle('v2:phase2:import:apply',(event,payload,mode)=>{assertWorkspaceSender(event);const apply=()=>database.phase2.importData(payload,mode);const dir=path.join(app.getPath('userData'),'backups');fs.mkdirSync(dir,{recursive:true});return createPhase2ZipBackup(path.join(dir,'aurestar-pre-import-'+Date.now()+'.zip')).then(apply);});
function createPhase2ZipBackup(destination) {
  const temp=path.join(app.getPath('temp'),'aurestar-sqlite-backup-'+Date.now()+'.sqlite');
  return database.backupTo(temp).then(()=>{
    const extras={'aurestar.sqlite':fs.readFileSync(temp),'metadata.json':Buffer.from(JSON.stringify({app:'Aurestar',version:app.getVersion(),schemaVersion:7,createdAt:new Date().toISOString()}))};
    const assetRoot=app.isPackaged?path.join(process.resourcesPath,'itsuki'):path.join(__dirname,'..','resources','itsuki');
    const addFiles=(directory,prefix)=>{if(!fs.existsSync(directory))return;for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const full=path.join(directory,entry.name),name=prefix+'/'+entry.name;if(entry.isDirectory())addFiles(full,name);else if(entry.isFile())extras[name]=fs.readFileSync(full);}};
    addFiles(assetRoot,'assets/itsuki');
    try{return createZipBackup(destination,database.exportBackupData(temp),extras);}
    finally{fs.rmSync(temp,{force:true});}
  }).catch(error=>{fs.rmSync(temp,{force:true});throw error;});
}
ipcMain.handle('v2:phase2:zip:export',event=>{assertWorkspaceSender(event);return dialog.showSaveDialog(win,{title:'Tạo bản sao lưu ZIP của Aurestar',defaultPath:'Aurestar-backup.zip',filters:[{name:'Bản sao lưu ZIP',extensions:['zip']}] }).then(result=>{if(result.canceled||!result.filePath)return {canceled:true};return createPhase2ZipBackup(result.filePath).then(backup=>({ok:true,...backup}));});});
ipcMain.handle('v2:phase2:zip:preview',event=>{assertWorkspaceSender(event);return dialog.showOpenDialog(win,{title:'Xem trước bản sao lưu ZIP của Aurestar',properties:['openFile'],filters:[{name:'Bản sao lưu ZIP',extensions:['zip']}] }).then(result=>{if(result.canceled||!result.filePaths[0])return {canceled:true};const payload=readZipBackup(result.filePaths[0]);return {payload,preview:database.phase2.previewImport(payload)};});});
ipcMain.handle('v2:phase2:zip:restore',(event,payload,mode)=>{assertWorkspaceSender(event);const apply=()=>database.phase2.importData(payload,mode);const dir=path.join(app.getPath('userData'),'backups');fs.mkdirSync(dir,{recursive:true});return createPhase2ZipBackup(path.join(dir,'aurestar-pre-restore-'+Date.now()+'.zip')).then(apply);});
ipcMain.handle('pomodoro:widget-close',()=>{closePomodoroWidget();return {ok:true};});
ipcMain.handle('pomodoro:widget-open',()=>({ok:false,disabled:true}));
ipcMain.handle('itsuki:hide',()=>{hideItsuki();return {ok:true};});
ipcMain.handle('itsuki:show',()=>{createItsuki();return {ok:true};});
ipcMain.handle('app:show',(_event,view='dashboard')=>{showMainWindow(view);return {ok:true};});
ipcMain.handle('itsuki:art-url',(_e,index=0)=>{const n=Math.max(1,Math.min(30,Number(index)||1));const file=path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..','resources'),'itsuki','expressions',`${n}.jpg`);return require('node:url').pathToFileURL(file).href;});
ipcMain.handle('state:save',(_e,next)=>{if(!next||typeof next!=='object')throw new Error('Trạng thái không hợp lệ');const previousStart=Boolean(state?.settings?.startWithWindows);state={...state,...next};saveState();if(process.platform==='win32'&&Boolean(state.settings?.startWithWindows)!==previousStart)app.setLoginItemSettings({openAtLogin:Boolean(state.settings.startWithWindows)});return state;});
ipcMain.handle('task:complete',(_e,{id,date=today()})=>{
  const t=state.tasks.find(x=>String(x.id)===String(id));if(!t)return {ok:false};
  t.completedDates=Array.isArray(t.completedDates)?t.completedDates:[];
  const done=t.completedDates.includes(date);
  if(done)t.completedDates=t.completedDates.filter(d=>d!==date);else{t.completedDates.push(date);state.completions.push({id:String(id),kind:'task',date,at:Date.now()});state.profile.xp=(state.profile.xp||0)+10;}
  saveState();return {ok:true,done:!done,state};
});
ipcMain.handle('data:export',async()=>{const r=await dialog.showSaveDialog(win,{title:'Xuất bản sao lưu Aurestar',defaultPath:`Aurestar-${today()}.json`,filters:[{name:'Bản sao lưu JSON',extensions:['json']}]});if(r.canceled||!r.filePath)return {canceled:true};writeJsonAtomic(r.filePath,state);return {ok:true,filePath:r.filePath};});
ipcMain.handle('data:import',async()=>{
  const r=await dialog.showOpenDialog(win,{title:'Khôi phục bản sao lưu Aurestar',properties:['openFile'],filters:[{name:'Bản sao lưu JSON',extensions:['json']}]});
  if(r.canceled||!r.filePaths[0])return {canceled:true};
  const imported=readJsonFile(r.filePaths[0]);
  if(!imported.valid||!Array.isArray(imported.value?.tasks))throw new Error('Tệp này không phải bản sao lưu dữ liệu Aurestar hợp lệ. Dữ liệu hiện tại chưa bị thay đổi.');
  if(fs.existsSync(dataFile())){
    fs.mkdirSync(backupDir(),{recursive:true});
    fs.copyFileSync(dataFile(),path.join(backupDir(),`aurestar-pre-import-${Date.now()}.json`));
  }
  state=normalizeStateCollections(imported.value,defaultState());
  chromeStorageCache=state;
  saveState();
  win?.webContents.send('aurestar:state',state);
  return {ok:true,state};
});
ipcMain.handle('backup:now',()=>{fs.mkdirSync(backupDir(),{recursive:true});const p=path.join(backupDir(),`aurestar-${today()}-${Date.now()}.json`);fs.copyFileSync(dataFile(),p);return {ok:true,path:p};});
ipcMain.handle('notification:test',()=>{notify(APP_NAME,'Thông báo đang hoạt động bình thường.');return {ok:true};});
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
  if(!hasSingleInstanceLock)return;
  // Electron's screen APIs are only available after the app is ready.
  screen.on('display-metrics-changed',repositionWidgetsForDisplayChange);
  screen.on('display-added',repositionWidgetsForDisplayChange);
  screen.on('display-removed',repositionWidgetsForDisplayChange);
  initializeNativeServices();state=readState();state.settings={...(state.settings||{}),itsukiCompanionEnabled:false,itsukiWidgetHiddenByUser:true};saveState();database=createDatabase(path.join(dataDir(),'aurestar.sqlite'));createBackgroundWindow();createWindow();createTray();createApplicationMenu();
  globalShortcut.register('CommandOrControl+Shift+L',toggleFocus);
  globalShortcut.register('CommandOrControl+Shift+K',openQuickAddTask);
  // A bare Alt key is handled by before-input-event while an Aurestar window is focused.
  // Floating companion and Pomodoro widgets are disabled; Focus lives in the main workspace.
  if(process.platform==='win32' && state.settings.startWithWindows){app.setLoginItemSettings({openAtLogin:true});}
  app.on('activate',()=>{if(!win)createWindow();else win.show();});
});
app.on('before-quit',()=>{app.isQuitting=true;database?.close();database=null;if(rendererRecoveryTimer)clearTimeout(rendererRecoveryTimer);if(reminderTimer)clearTimeout(reminderTimer);if(idlePollTimer)clearInterval(idlePollTimer);nativeAlarms?.close();persistWidgetPositionNow('pomodoro',pomodoroWidget);persistWidgetPositionNow('itsuki',itsukiWindow);globalShortcut.unregisterAll();if(state&&chromeStorageCache)saveState();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin' && !state?.settings?.minimizeToTray)app.quit();});
app.whenReady().catch(error=>{
  console.error('Aurestar gặp lỗi khi khởi động:',error);
  dialog.showErrorBox('Aurestar không thể mở dữ liệu của ứng dụng',`${String(error?.message||error)}\n\nThe original data files were preserved. Restore a backup or inspect the backups folder before trying again.`);
  app.quit();
});
