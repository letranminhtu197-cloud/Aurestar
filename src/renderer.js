let state=null;
const initialRoute=(document.body.dataset.initialView||location.hash.replace(/^#/,"")||"dashboard");
let activeView=["dashboard","today","tasks","habits","focus","gym","calendar","analytics","settings"].includes(initialRoute)?initialRoute:"dashboard";
let selectedList="all";
let taskMode="today";
let searchQuery="";
let calendarDate=new Date();
let calendarHistoryDays=365;
let selectedDate=null;
let timer=null;
let seconds=25*60;
let timerTotal=25*60;
let timerMode="focus";
let focusPreset=25;
let clockInterval=null;
let gymUiTimer=null;
let gymLastStateKey="";
let progressRange=30;
let audioCtx=null,audioSources=[],audioMaster=null,audioType=null;
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const today=()=>localKey(new Date());
const localKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fromKey=k=>{const [y,m,d]=String(k).split("-").map(Number);return new Date(y||1970,(m||1)-1,d||1)};
const addDays=(k,n)=>{const d=fromKey(k);d.setDate(d.getDate()+n);return localKey(d)};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const send=(type,payload={})=>new Promise((resolve,reject)=>chrome.runtime.sendMessage({type,...payload},r=>{const e=chrome.runtime.lastError;if(e)return reject(new Error(e.message));resolve(r)}));
const sendWithTimeout=(type,payload={},timeoutMs=5000)=>new Promise((resolve,reject)=>{let settled=false;const timerId=setTimeout(()=>{if(settled)return;settled=true;reject(new Error(`Timed out waiting for background response: ${type}`));},timeoutMs);send(type,payload).then(value=>{if(settled)return;settled=true;clearTimeout(timerId);resolve(value);},error=>{if(settled)return;settled=true;clearTimeout(timerId);reject(error);});});
const priorityLabel={low:"Low",medium:"Medium",high:"High",urgent:"Urgent"};
const viewTitles={dashboard:"Overview",today:"Today",tasks:"Daily Routine",habits:"Habits",focus:"Focus",gym:"Training",calendar:"Calendar",analytics:"Progress",settings:"Settings"};
const attrMeta={};

const LOCALES = {
  en: {
    "Command Center":"Command Center","Today":"Today","Tasks":"Tasks","Habits":"Habits","Focus":"Focus","Gym":"Gym","Calendar":"Calendar","Progress":"Progress","Discipline":"Discipline","Settings":"Settings",
    "WORKSPACE":"WORKSPACE","LISTS":"LISTS","TOOLS":"TOOLS","Add list":"Add list","Search tasks…":"Search tasks…","Search tasks":"Search tasks",
    "Go beyond all limits":"GO BEYOND ALL LIMITS","GO BEYOND ALL LIMITS":"GO BEYOND ALL LIMITS","SYSTEM":"SYSTEM","Notifications & alarms":"Notifications & alarms","System notifications":"System notifications","Task reminders":"Task reminders","Alarm sound":"Alarm sound","Daily reminder":"Daily reminder","Alarm volume":"Alarm volume","Alarm duration":"Alarm duration","Save":"Save","▶ Test alarm":"▶ Test alarm","Test alarm":"Test alarm",
    "Data & backup":"Data & backup","Automatic daily backup":"Automatic daily backup","Backup time":"Backup time","Backup now":"Backup now","Export JSON":"Export JSON","⇩ Import tasks":"⇩ Import tasks","Restore data file":"Restore data file","Delete all data":"Delete all data",
    "Discipline enforcement":"Discipline enforcement","Every task with a deadline is checked automatically. After 60 minutes overdue, the configured penalty is applied once.":"Every task with a deadline is checked automatically. After 60 minutes overdue, the configured penalty is applied once.","Overdue grace":"Overdue grace","60 minutes":"60 minutes","Open Discipline":"Open Discipline","Check now":"Check now",
    "Application":"Application","Version":"Version","Engine":"Engine","Storage":"Storage","Manifest V3 · Local-first":"Manifest V3 · Local-first","Chrome local storage":"Chrome local storage",
    "CURRENT TIME":"CURRENT TIME","Local device time":"Local device time","UP NEXT":"UP NEXT","Scheduled":"Scheduled","NEXT ACTIONS":"NEXT ACTIONS","Priority queue":"Priority queue","ACTIVITY":"ACTIVITY","Last 7 days":"Last 7 days","Activity recorded":"Activity recorded","SYSTEM STATUS":"SYSTEM STATUS","Aurestar overview":"Aurestar overview","Today":"Today","Focus":"Focus","No future tasks yet.":"No future tasks yet.","No tasks scheduled for today. Add your next action to start the queue.":"No tasks scheduled for today. Add your next action to start the queue.","scheduled tasks completed":"scheduled tasks completed","tasks remaining today":"tasks remaining today",
    "DISCIPLINE OS":"DISCIPLINE OS","Website Gates":"Website Gates","Website gates":"Website gates","A gate stays active while its required tasks are incomplete for the current day.":"A gate stays active while its required tasks are incomplete for the current day.","No website gates yet.":"No website gates yet.","TASK DEADLINE":"TASK DEADLINE","Automatic overdue penalty":"Automatic overdue penalty","No website lock":"No website lock","Temporary lock:":"Temporary lock:","AUDIT LOG":"AUDIT LOG","Penalty history":"Penalty history","No penalties recorded.":"No penalties recorded.","OVERDUE PENALTY":"OVERDUE PENALTY","Automatic OVR discipline":"Automatic OVR discipline","Enable automatic overdue penalty":"Enable automatic overdue penalty","Every Task has a deadline + time. After 60 minutes overdue and still incomplete → subtract total OVR once.":"Every Task has a deadline + time. After 60 minutes overdue and still incomplete → subtract total OVR once.","OVR deduction per overdue task":"OVR deduction per overdue task","Temporarily block selected websites":"Temporarily block selected websites","Websites to block":"Websites to block","Block duration (minutes)":"Block duration (minutes)","Save discipline penalty":"Save discipline penalty","No consequence":"No consequence","Active":"Active","Disabled":"Disabled","60 MIN":"60 MIN","LOCKED":"LOCKED","UNLOCKED":"UNLOCKED","OFF":"OFF",
    "Habit name…":"Habit name…","Daily":"Daily","Weekly":"Weekly","＋ Add habit":"＋ Add habit","No habits yet.":"No habits yet.",
    "FOCUS ENGINE":"FOCUS ENGINE","A completed focus cycle is recorded in Focus history and activity analytics.":"A completed focus cycle is recorded in Focus history and activity analytics.","Break":"Break","Start":"Start","Pause":"Pause","Reset":"Reset","Audio":"Audio","White noise":"White noise","Brown noise":"Brown noise","Rain":"Rain","Night synth":"Night synth","Volume":"Volume","Stop audio":"Stop audio",
    "Import tasks":"Import tasks","No activity recorded yet.":"No activity recorded yet."
  },
  vi: {
    "Command Center":"Command Center","Today":"Today","Tasks":"Tasks","Habits":"Habits","Focus":"Focus","Gym":"Gym","Calendar":"Calendar","Progress":"Progress","Discipline":"Discipline","Settings":"Settings",
    "WORKSPACE":"WORKSPACE","LISTS":"LISTS","TOOLS":"TOOLS","Add list":"Add list","Search tasks…":"Search tasks…","Search tasks":"Search tasks",
    "Go beyond all limits":"GO BEYOND ALL LIMITS","GO BEYOND ALL LIMITS":"GO BEYOND ALL LIMITS","SYSTEM":"SYSTEM","Notifications & alarms":"Notifications & alarms","System notifications":"System notifications","Task reminders":"Task reminders","Alarm sound":"Alarm sound","Daily reminder":"Daily reminder","Alarm volume":"Alarm volume","Alarm duration":"Alarm duration","Save":"Save","▶ Test alarm":"▶ Test alarm","Test alarm":"Test alarm",
    "Data & backup":"Data & backup","Automatic daily backup":"Automatic daily backup","Backup time":"Backup time","Backup now":"Backup now","Export JSON":"Export JSON","⇩ Import tasks":"⇩ Import tasks","Restore data file":"Restore data file","Delete all data":"Delete all data",
    "Discipline enforcement":"Discipline enforcement","Every task with a deadline is checked automatically. After 60 minutes overdue, the configured penalty is applied once.":"Every task with a deadline is checked automatically. After 60 minutes overdue, the configured penalty is applied once.","Overdue grace":"Overdue grace","60 minutes":"60 minutes","Open Discipline":"Open Discipline","Check now":"Check now",
    "Application":"Application","Version":"Version","Engine":"Engine","Storage":"Storage","Manifest V3 · Local-first":"Manifest V3 · Local-first","Chrome local storage":"Chrome local storage",
    "CURRENT TIME":"CURRENT TIME","Local device time":"Local device time","UP NEXT":"UP NEXT","Scheduled":"Scheduled","NEXT ACTIONS":"NEXT ACTIONS","Priority queue":"Priority queue","ACTIVITY":"ACTIVITY","Last 7 days":"Last 7 days","Activity recorded":"Activity recorded","SYSTEM STATUS":"SYSTEM STATUS","Aurestar overview":"Aurestar overview","No future tasks yet.":"No future tasks yet.","No tasks scheduled for today. Add your next action to start the queue.":"No tasks scheduled for today. Add your next action to start the queue.","scheduled tasks completed":"scheduled tasks completed","tasks remaining today":"tasks remaining today",
    "DISCIPLINE OS":"DISCIPLINE OS","Website Gates":"Website Gates","Website gates":"Website gates","A gate stays active while its required tasks are incomplete for the current day.":"A gate stays active while its required tasks are incomplete for the current day.","No website gates yet.":"No website gates yet.","TASK DEADLINE":"TASK DEADLINE","Automatic overdue penalty":"Automatic overdue penalty","No website lock":"No website lock","Temporary lock:":"Temporary lock:","AUDIT LOG":"AUDIT LOG","Penalty history":"Penalty history","No penalties recorded.":"No penalties recorded.","OVERDUE PENALTY":"OVERDUE PENALTY","Automatic OVR discipline":"Automatic OVR discipline","Enable automatic overdue penalty":"Enable automatic overdue penalty","Every Task has a deadline + time. After 60 minutes overdue and still incomplete → subtract total OVR once.":"Every Task has a deadline + time. After 60 minutes overdue and still incomplete → subtract total OVR once.","OVR deduction per overdue task":"OVR deduction per overdue task","Temporarily block selected websites":"Temporarily block selected websites","Websites to block":"Websites to block","Block duration (minutes)":"Lock duration (minutes)","Save discipline penalty":"Save discipline penalty","No consequence":"No consequence","Active":"Active","Disabled":"Disabled","60 MIN":"60 MIN","LOCKED":"LOCKED","UNLOCKED":"UNLOCKED","OFF":"OFF",
    "Habit name…":"Habit name…","Daily":"Daily","Weekly":"Weekly","＋ Add habit":"＋ Add habit","No habits yet.":"No habits yet.",
    "FOCUS ENGINE":"FOCUS ENGINE","A completed focus cycle is recorded in Focus history and activity analytics.":"A completed focus cycle is recorded in Focus history and activity analytics.","Break":"Break","Start":"Start","Pause":"Pause","Reset":"Reset","Audio":"Audio","White noise":"White noise","Brown noise":"Brown noise","Rain":"Rain","Night synth":"Night synth","Volume":"Volume","Stop audio":"Stop audio",
    "Import tasks":"Import tasks","No activity recorded yet.":"No activity recorded yet."
  }
};
const LANG_REVERSE={en:{},vi:{}};
for(const l of ["en","vi"]) for(const [en,vi] of Object.entries(LOCALES.en).map(([k])=>[k,LOCALES.vi[k]||k])){}
// Build reverse lookup for both locale dictionaries.
for(const [canonical,enText] of Object.entries(LOCALES.en)){ LANG_REVERSE.en[enText]=canonical; const viText=LOCALES.vi[canonical]; if(viText) LANG_REVERSE.vi[viText]=canonical; }
const VI_EXTRA={"Quick add":"Quick add","No repeat":"No repeat","Daily":"Daily","Weekly":"Weekly","Repeat starts":"Repeat starts","Weekdays":"Weekdays","Remind me when due":"Remind me when due","Checklist":"Checklist","One step per line…":"One step per line…","Notes…":"Notes…","Create task":"Create task","Save changes":"Save changes","Select at least one weekday":"Select at least one weekday","Task updated":"Task updated","Task created":"Task created","NEW":"NEW","EDIT":"EDIT","TASK":"TASK","List":"List","Priority":"Priority","Date / start":"Date / start","Time":"Time","Minutes":"Minutes","Repeat":"Repeat","System settings":"System settings","Notifications & alarms":"Notifications & alarms","System notifications":"System notifications","Task reminders":"Task reminders","Alarm sound":"Alarm sound","Daily reminder":"Daily reminder","Alarm volume":"Alarm volume","Alarm duration":"Alarm duration","Save":"Save","Test alarm":"Test alarm","Data & backup":"Data & backup","Automatic daily backup":"Automatic daily backup","Backup time":"Backup time","Backup now":"Backup now","Export JSON":"Export JSON","Import tasks":"Import tasks","Restore data file":"Restore data file","Delete all data":"Delete all data","Discipline enforcement":"Website Gates","Open Discipline":"Open Website Gates","Application":"Application","Version":"Version","Engine":"Engine","Storage":"Storage","Manifest V3 · Local-first":"Manifest V3 · Local-first","Chrome local storage":"Chrome local storage","Current time":"Current time","Local device time":"Local device time","No future tasks yet.":"No future tasks yet.","scheduled tasks completed":"scheduled tasks completed","tasks remaining today":"tasks remaining today","No website gates yet.":"No website gates yet.","No penalties recorded.":"No penalties recorded.","Temporarily block selected websites":"Temporarily block selected websites","Websites to block":"Websites to block","Block duration (minutes)":"Lock duration (minutes)","Save discipline penalty":"Save discipline penalty","Lock websites until tasks are complete":"Lock websites until tasks are complete","Require every selected task":"Require every selected task","Minimum completed when not requiring all":"Minimum completed when not requiring all","Create website gate":"Create website gate","APPLIES ON":"APPLIES ON","Domains":"Domains","Required tasks":"Required tasks","Name":"Name","Study gate":"Study gate","One domain per line, e.g. youtube.com":"One domain per line, e.g. youtube.com","Select at least one task":"Select at least one task","Website gate created":"Website gate created","Automatic OVR discipline":"Automatic OVR discipline","Enable automatic overdue penalty":"Enable automatic overdue penalty","OVR deduction per overdue task":"OVR deduction per overdue task","One domain per line":"One domain per line","120 minutes = 2 hours. You can change it to any duration you want.":"120 minutes = 2 hours. You can change it to any duration you want.","Overdue discipline saved":"Overdue discipline saved","Lock duration (minutes)":"Lock duration (minutes)","No activity recorded yet.":"No activity recorded yet.","No habits yet.":"No habits yet.","Habit name…":"Habit name…","Target":"Target","Description":"Description","＋ Add habit":"＋ Add habit","One page for the numbers that actually show whether your routine is moving forward.":"One page for the numbers that actually show whether your routine is moving forward.","ACTIVITY":"ACTIVITY","Completed actions":"Completed actions","Each point is a completed task, habit check-in, or focus session.":"Each point is a completed task, habit check-in, or focus session.","best day":"best day","Choose format":"Choose a format","Choose a format":"Choose a format","Export visible tasks.":"Export visible tasks.","and":"and","more tasks":"more tasks","Choose a fixed cycle:":"Choose a fixed cycle:","White noise":"White noise","Brown noise":"Brown noise","Rain":"Rain","Night synth":"Night synth","Even and clean":"Even and clean","Deep and steady":"Deep and steady","Ambient":"Ambient","Light, lyric-free":"Light, lyric-free","Focus today":"Focus today","Total":"Total"};
function currentLang(){return "en"}
function tr(text){const raw=String(text??"");return VI_EXTRA[raw]??LOCALES.en?.[raw]??raw}
function localizeDOM(root=document){
  const lang=currentLang();document.documentElement.lang=lang;
  const skip=(el)=>!!el?.closest?.('.task-title-line,.task-main-copy,.task-row,.habit-card,.habit-detail,.command-upcoming-row,.calendar-day,.goal-card,.goal-mini-row-v53,.attribute-name-v53');
  root.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el=>{if(!skip(el))el.placeholder=tr(el.placeholder)});
  root.querySelectorAll('[title],[aria-label]').forEach(el=>{if(!skip(el)){if(el.hasAttribute('title'))el.title=tr(el.title);if(el.hasAttribute('aria-label'))el.setAttribute('aria-label',tr(el.getAttribute('aria-label')))}});
  const walker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT);const nodes=[];let n;while(n=walker.nextNode())nodes.push(n);
  for(const node of nodes){const p=node.parentElement;if(!p||skip(p)||['SCRIPT','STYLE','OPTION'].includes(p.tagName))continue;const text=node.nodeValue.trim();if(!text)continue;const translated=tr(text);if(translated!==text)node.nodeValue=node.nodeValue.replace(text,translated)}
}
function rawPlannedFor(k){return state.tasks.filter(t=>{if(t.archived)return false;const r=t.repeat?.type||"none";if(r==="daily")return !t.repeat.startDate||k>=t.repeat.startDate;if(r==="weekly")return (!t.repeat.startDate||k>=t.repeat.startDate)&&(t.repeat.weekdays||[]).map(Number).includes(fromKey(k).getDay());return t.dueDate===k})}
function rawGymTasksForDay(k=today(),listId=null){return rawPlannedFor(k).filter(t=>!t.archived&&t.workoutConfig?.enabled&&(!listId||t.listId===listId))}
function workoutDoneForDay(k=today(),listId=null){const xs=rawGymTasksForDay(k,listId);return xs.length>0&&xs.every(t=>(t.completedDates||[]).includes(k))}
function workoutAggregateForDay(k=today(),listId=null,includeUnscheduled=false){let xs=rawGymTasksForDay(k);if(!xs.length&&includeUnscheduled)xs=state.tasks.filter(t=>!t.archived&&t.workoutConfig?.enabled);if(!xs.length)return null;const first=xs[0];if(listId&&first.listId!==listId)return null;return {id:`__workout_aggregate__:${k}`,title:"Workout",listId:first.listId||"inbox",priority:"medium",estimate:Math.max(5,xs.reduce((n,t)=>n+(Number(t.estimate)||25),0)),dueDate:k,dueTime:first.dueTime||"",repeat:{type:"none",weekdays:[]},notes:`Complete ${xs.length} exercise${xs.length===1?"":"s"} in Training.`,completedDates:workoutDoneForDay(k)?[k]:[],archived:false,workoutAggregate:true,exerciseCount:xs.length}}
function plannedFor(k){const normal=rawPlannedFor(k).filter(t=>!t.workoutConfig?.enabled);const workout=workoutAggregateForDay(k);return workout?[...normal,workout]:normal}
function taskDone(t,k){return t?.workoutAggregate?workoutDoneForDay(k):(t.completedDates||[]).includes(k)}
function habitDone(h,k=today()){return(h.completions||[]).includes(k)}
function completionsOn(k){return state.completions.filter(c=>c.date===k)}
function listName(id){return state.lists.find(x=>x.id===id)?.name||"Inbox"}
function listIcon(id){return state.lists.find(x=>x.id===id)?.icon||"○"}

function localizedWeekdays(){return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]}


async function load(){
  const hash=location.hash.replace(/^#/,'');
  if(viewTitles[hash])activeView=hash;
  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await sendWithTimeout("getState",{},5000);
      if(!response?.ok)throw new Error(response?.error||"The background service worker did not return a valid state");
      if(!response.state||typeof response.state!=="object")throw new Error("The background service worker returned an empty state");
      state=response.state;
      renderShell();
      return;
    }catch(error){
      lastError=error;
      console.error(`Aurestar boot attempt ${attempt+1}/3 failed`,error);
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));
    }
  }
  showBootError(lastError||new Error("Unknown startup error"));
}
function showBootError(error){
  const message=String(error?.message||error||"Unknown startup error");
  const details=String(error?.stack||message);
  document.body.innerHTML=`<div class="fatal-error"><div><span class="badge danger-badge">BOOT ERROR</span><h2>Aurestar failed to start</h2><p>${esc(message)}</p><p class="muted">Restart Aurestar. If this continues, keep your data backup and share the details below with support.</p><details><summary>Error details</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-width:80vw">${esc(details)}</pre></details><button id="retryBoot" type="button" style="margin-top:16px;padding:10px 16px;cursor:pointer">Retry startup</button></div></div>`;
  document.getElementById("retryBoot")?.addEventListener("click",()=>load());
}
function progressWindow(days,end=today()){const n=Math.max(1,Number(days)||30);const dates=Array.from({length:n},(_,i)=>addDays(end,i-(n-1)));return{days:n,start:dates[0],end,dates}}
function progressStats(days,end=today()){const w=progressWindow(days,end), dates=w.dates, dateSet=new Set(dates);let scheduled=0,doneTasks=0;for(const d of dates){const planned=plannedFor(d);scheduled+=planned.length;doneTasks+=planned.filter(t=>taskDone(t,d)).length;}const tasksRate=scheduled?doneTasks/scheduled*100:null;let habitPossible=0,habitDoneCount=0;for(const h of state.habits){const created=h.createdAt?localKey(new Date(h.createdAt)):dates[0];for(const d of dates){if(d<created)continue;habitPossible++;if((h.completions||[]).includes(d))habitDoneCount++;}}const habitRate=habitPossible?habitDoneCount/habitPossible*100:null;const focus=state.focusSessions.filter(x=>dateSet.has(x.date));const focusMinutes=focus.reduce((n,x)=>n+Math.max(0,Number(x.minutes)||0),0);const focusSessions=focus.length;const daily=dates.map(d=>({date:d,actions:state.completions.filter(x=>x.date===d).length,tasks:state.completions.filter(x=>x.date===d&&x.kind==='task').length,focus:state.focusSessions.filter(x=>x.date===d).reduce((n,x)=>n+Number(x.minutes||0),0)}));const activeDays=daily.filter(x=>x.actions>0).length;const bestDay=daily.reduce((best,x)=>x.actions>best.actions?x:best,{date:dates[dates.length-1],actions:0});return{...w,scheduled,doneTasks,tasksRate,habitPossible,habitDoneCount,habitRate,focusMinutes,focusSessions,daily,activeDays,bestDay}}
function progressDeltaPct(current,previous){if(current==null||previous==null)return '—';const d=Math.round(current-previous);return `${d>0?'+':''}${d} pts`}
function progressDeltaValue(current,previous,unit='XP'){const d=Math.round(current-previous);return `${d>0?'+':''}${d} ${unit}`}
function formatDuration(min){const m=Math.max(0,Math.round(Number(min)||0));if(m<60)return `${m}m`;const h=Math.floor(m/60),r=m%60;return r?`${h}h ${r}m`:`${h}h`}
function progressChartSvg(daily){const n=daily.length;if(!n)return '<div class="progress-chart-empty">No activity recorded yet.</div>';const buckets=Math.min(14,n),size=daily.length<=14?daily:[];let data=size;if(!data.length){data=[];for(let i=0;i<buckets;i++){const a=Math.floor(i*n/buckets),b=Math.max(a+1,Math.floor((i+1)*n/buckets));const chunk=daily.slice(a,b);data.push({date:chunk[0].date,actions:chunk.reduce((sum,x)=>sum+x.actions,0)});}}const W=860,H=230,P=28,max=Math.max(1,...data.map(x=>x.actions));const pts=data.map((x,i)=>{const xx=P+i*(W-P*2)/Math.max(1,data.length-1);const yy=H-P-(x.actions/max)*(H-P*2);return[xx,yy,x]});const line=pts.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');const area=`${P},${H-P} ${line} ${W-P},${H-P}`;const marks=pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${data.length>10?2.2:3}" class="progress-chart-dot"><title>${p[2].date} · ${p[2].actions} completed actions</title></circle>`).join('');const grid=[0,.5,1].map(r=>{const y=H-P-r*(H-P*2);return `<line x1="${P}" y1="${y}" x2="${W-P}" y2="${y}" class="progress-chart-grid"/>`}).join('');return `<svg viewBox="0 0 ${W} ${H}" class="progress-chart" role="img" aria-label="Completed actions trend">${grid}<polygon points="${area}" class="progress-chart-area"/><polyline points="${line}" class="progress-chart-line" fill="none"/>${marks}</svg>`}
function startOfWeek(k){const d=fromKey(k);d.setDate(d.getDate()-((d.getDay()+6)%7));return localKey(d)}
function goalDay(g,k){return new Set(state.completions.filter(c=>g.scope==="all"||c.kind===g.scope).map(c=>c.date)).has(k)}
function goalProgress(g){const set=new Set(state.completions.filter(c=>g.scope==="all"||c.kind===g.scope).map(c=>c.date));let n=0,k=today();while(set.has(k)){n++;k=addDays(k,-1)}return Math.min(Number(g.target)||30,n)}
function normalizeBlockedDomainInput(value){let d=String(value||"").trim().toLowerCase();if(!d)return "";d=d.replace(/^[a-z][a-z0-9+.-]*:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0].replace(/:\d+$/,"").replace(/\.$/,"");if(d.length>253||!d.includes(".")||d.includes(".."))return "";const labels=d.split(".");if(labels.some(label=>!label||label.length>63||!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)))return "";if(!/^[a-z]{2,63}$/.test(labels[labels.length-1]))return "";return d}
function toast(msg,kind="info"){const t=document.createElement("div");t.className=`toast ${kind}`;t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2800)}
async function action(type,payload){
  const r=await send(type,payload);
  if(!r?.ok){toast(r?.error||"Action failed","error");return null}
  state=r.state||state;
  if(type==="focusStart")setItsukiMessage("Let’s begin. Stay with the task in front of you, one step at a time.","FOCUS","focus");
  return r;
}
function stat(label,value,sub=""){return `<div class="stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small></div>`}

let itsukiUserMessage="";
let itsukiLastImageId="";
function inferItsukiExpression(message,status){
  const text=`${status||""} ${message||""}`.toLowerCase();
  if(/xao nhãng|phân tâm|tiktok|chặn|distract|blocked|warning|scroll|unrelated tab|website|back to work|assignment|phone|put the phone/.test(text))return "warning";
  if(/hoàn thành|làm tốt|xong rồi|tuyệt vời|thành quả|task complete|habit complete|finished|completed|good work|well done/.test(text))return "done";
  if(/nghỉ|nước|uống|thả lỏng|giãn cơ|mắt|tired|break|paused|rest|water|stretch|shoulders/.test(text))return "break";
  if(/focus|tập trung|bài học|phiên học|bắt đầu học|study|concentrate|session/.test(text))return "focus";
  return "encouragement";
}
function applyItsukiExpressionRecord(record){
  if(!record||typeof record!="object")return;
  const img=$("#itsukiCompanion .itsuki-art-wrap img");
  if(img&&record.imageSrc){
    const localSrc=String(record.imageSrc);
    // Packaged artwork only. A bad/missing local file never falls back to a URL.
    if(localSrc.startsWith("assets/itsuki/")&&!localSrc.includes("..")){
      const resolved=chrome.runtime.getURL(localSrc.replace(/^\//,""));
      if(img.dataset.expressionId!==String(record.imageId||"")){img.dataset.expressionId=String(record.imageId||"");img.src=resolved;itsukiLastImageId=String(record.imageId||"");}
    }
  }
  const text=$("#itsukiCompanionDialogue");
  if(typeof record.message==="string"&&record.message){itsukiUserMessage=record.message;if(text&&text.textContent!==record.message)text.textContent=record.message;}
  const status=$("#itsukiCompanionStatus");
  if(status&&record.kind){
    const contexts={focus:"FOCUS","wind-down":"WIND DOWN",sleep:"SLEEP"};
    status.textContent=contexts[record.context]||"FOCUS";
  }
}
async function applyItsukiExpression(kind,message=""){
  const eventMap={warning:"distraction",done:"focus-complete",break:"break-start",focus:"focus-reminder",encouragement:"idle-reminder"};
  const event=eventMap[kind]||"idle-reminder";
  try{
    const response=await send("itsukiExpressionAction",{event,message:String(message||"").slice(0,240)});
    if(response?.ok&&response.state)applyItsukiExpressionRecord(response.state);
  }catch(error){console.warn("Shared expression update failed",error);}
}
if(chrome?.storage?.onChanged){chrome.storage.onChanged.addListener((changes,area)=>{
  if(area!=="local")return;
  const record=changes.itsukiExpressionState?.newValue;
  if(record)applyItsukiExpressionRecord(record);
});}
function setItsukiMessage(message,status="Study companion",kind=null){
  const nextMessage=String(message??"").trim();
  // Never blank the speech bubble because an event supplied an empty message.
  if(!nextMessage)return;
  itsukiUserMessage=nextMessage;
  const text=$("#itsukiCompanionDialogue"),st=$("#itsukiCompanionStatus");
  if(text)text.textContent=itsukiUserMessage;
  if(st)st.textContent=status;
  if(state?.settings?.privacyMode!==true&&state?.settings?.itsukiCompanionEnabled!==false)applyItsukiExpression(kind||inferItsukiExpression(nextMessage,status),itsukiUserMessage);
}
function refreshItsukiCompanion(){
  const root=$("#itsukiCompanion");if(!root||!state)return;
  const enabled=state.settings?.privacyMode!==true&&state.settings?.itsukiCompanionEnabled!==false;
  root.hidden=!enabled;
  const card=$("#itsukiCompanionCard"),tab=$("#itsukiCompanionTab");
  const collapsed=state.settings?.itsukiCompanionHiddenByUser===true;
  if(card)card.hidden=collapsed;
  if(tab){tab.setAttribute("aria-expanded",String(!collapsed));const i=tab.querySelector("i");if(i)i.textContent=collapsed?"＋":"−";}
  const day=today(),planned=plannedFor(day).filter(t=>!t.archived),done=planned.filter(t=>taskDone(t,day));
  const pct=planned.length?Math.round(done.length/planned.length*100):0;
  const value=$("#itsukiStudyProgressValue"),bar=$("#itsukiStudyProgressBar");
  if(value)value.textContent=planned.length?`${pct}% complete`:"No tasks planned";
  if(bar)bar.style.width=`${pct}%`;
  const fallback=state.focusEngine?.active&&state.focusEngine.phase==="focus"?"Stay with the task in front of you. One step at a time.":"Choose one clear task and take the first step.";
  if(!itsukiUserMessage){const dialogue=$("#itsukiCompanionDialogue");if(dialogue)dialogue.textContent=fallback;}
  const status=$("#itsukiCompanionStatus");if(status&&!itsukiUserMessage)status.textContent="FOCUS";
  const image=$("#itsukiCompanion .itsuki-art-wrap img");
  if(enabled&&image&&!image.dataset.expressionId)applyItsukiExpression("encouragement");
}
function bindItsukiCompanion(){
  const root=$("#itsukiCompanion");if(!root)return;
  if(root.dataset.bound==="1"){refreshItsukiCompanion();return;}root.dataset.bound="1";
  document.querySelectorAll(".itsuki-companion img,.itsuki-sidebar-avatar img").forEach(img=>img.addEventListener("error",()=>{
    if(!img.dataset.localFallback){img.dataset.localFallback="1";img.src=chrome.runtime.getURL("assets/itsuki/itsuki-pet.png");}
    else img.style.display="none";
  }));
  $("#itsukiCompanionTab")?.addEventListener("click",async()=>{const collapsed=$("#itsukiCompanionCard")?.hidden!==true;const card=$("#itsukiCompanionCard");if(card)card.hidden=collapsed;const tab=$("#itsukiCompanionTab");tab?.setAttribute("aria-expanded",String(!collapsed));const i=tab?.querySelector("i");if(i)i.textContent=collapsed?"＋":"−";if(state?.settings)state.settings.itsukiCompanionHiddenByUser=collapsed;try{await action("saveSettings",{settings:{itsukiCompanionHiddenByUser:collapsed,itsukiCompanionCollapsed:collapsed}})}catch{}});
  $("#itsukiCompanionClose")?.addEventListener("click",()=>{$("#itsukiCompanionCard").hidden=true;$("#itsukiCompanionTab")?.setAttribute("aria-expanded","false");const i=$("#itsukiCompanionTab i");if(i)i.textContent="＋";if(state?.settings)state.settings.itsukiCompanionHiddenByUser=true;action("saveSettings",{settings:{itsukiCompanionHiddenByUser:true,itsukiCompanionCollapsed:true}}).catch(()=>{});});
  $("#itsukiStartFocus")?.addEventListener("click",async()=>{if(state.focusEngine?.active&&state.focusEngine.phase==="focus"){navigate("focus");setItsukiMessage("Stay with the task in front of you. One step at a time.","FOCUS","focus");return;}try{const r=await action("focusStart",{mode:Number(state.settings.focusPreset)||25,taskId:"",free:false});if(r)navigate("focus");}catch{navigate("focus");}});
  $("#itsukiOpenTasks")?.addEventListener("click",()=>navigate("tasks"));
  $("#itsukiCompanionSettings")?.addEventListener("click",()=>navigate("settings"));
  refreshItsukiCompanion();
}

function renderShell(){
  document.body.classList.toggle("privacy-mode",state.settings?.privacyMode===true);
  // Recover from a stale/mismatched packaged HTML shell instead of aborting startup.
  let view=$("#view");
  if(!view){
    const main=$(".main-area")||document.querySelector("main")||document.body;
    view=document.createElement("section");
    view.id="view";
    view.className="view";
    main.appendChild(view);
  }
  if(!$("#nav")){
    renderView("settings");
    return;
  }
  const primaryForView=v=>({today:"dashboard",calendar:"calendar",gym:"gym",analytics:"analytics",settings:""}[v]||v);
  $$('[data-view]').forEach(b=>{
    const active=b.dataset.view===primaryForView(activeView);
    b.classList.toggle("active",active);
    b.onclick=()=>{
      if(b.dataset.view==="tasks"){taskMode="today";selectedList="all";}
      navigate(b.dataset.view);
    };
  });
  if($("#pageTitle"))$("#pageTitle").textContent=tr(viewTitles[activeView]||"Today");
  const m={cur:0,need:0,pct:0},o=0;
  $("#appSettings")&&( $("#appSettings").onclick=()=>navigate("settings") );
  $("#globalAddTask")&&( $("#globalAddTask").onclick=()=>openTaskForm() );
  $("#addListBtn")&&( $("#addListBtn").onclick=()=>openListForm() );
  const search=$("#globalSearch");
  if(search){search.value=searchQuery;search.oninput=e=>{searchQuery=e.target.value.trim().toLowerCase();if(activeView!=="tasks")navigate("tasks");else renderShell()};}
  const back=$("#backApp"); if(back) back.onclick=()=>location.href=chrome.runtime.getURL('app.html#today');
  $("#importTop")&&( $("#importTop").onclick=openTaskImportPicker );
  $("#exportTop")&&( $("#exportTop").onclick=openTaskExportMenu );
  renderView(activeView);renderListsSidebar();localizeDOM();refreshItsukiCompanion();bindItsukiCompanion();
}
function navigate(view){if(!viewTitles[view])return;activeView=view;history.replaceState(null,"",`#${view}`);renderShell()}
function renderView(view){const el=$("#view");document.body.classList.toggle("view-settings",view==="settings");if(clockInterval){clearInterval(clockInterval);clockInterval=null;}if(view!=="focus"&&focusUiTimer){clearInterval(focusUiTimer);focusUiTimer=null;}if(view!=="gym"&&gymUiTimer){clearInterval(gymUiTimer);gymUiTimer=null;gymLastStateKey="";}const renderer={dashboard:renderDashboard,today:renderToday,tasks:renderTasks,habits:renderHabits,focus:renderFocus,gym:renderGym,calendar:renderCalendar,analytics:renderAnalytics,settings:renderSettings}[view]||renderToday;renderer(el);injectSectionNav(view,el);localizeDOM(el)}
function injectSectionNav(view,el){
  // Tasks and habits now live together on one workspace. Calendar is a first-class
  // page in the main sidebar, so only the related Progress sub-navigation remains.
  const tabs=null;
  if(!tabs)return;
  const nav=document.createElement("nav");nav.className="group-subnav";nav.setAttribute("aria-label","Progress sections");
  nav.innerHTML=tabs.map(([key,label])=>`<button type="button" class="${view===key?"active":""}" data-subview="${key}">${label}</button>`).join("");
  el.prepend(nav);nav.querySelectorAll("[data-subview]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.subview)));
}
function renderListsSidebar(){
  const box=$("#listSidebar");if(!box)return;
  const customLists=state.lists.filter(l=>l.id!=="inbox");
  box.innerHTML=customLists.map(l=>`<button class="list-link ${selectedList===l.id&&activeView==="tasks"?"active-list":""}" data-list="${esc(l.id)}"><span class="list-icon ${esc(l.color||"red")}">${esc(l.icon)}</span><b>${esc(l.name)}</b><em>${state.tasks.filter(t=>t.listId===l.id&&plannedFor(today()).some(x=>x.id===t.id&&!taskDone(t,today()))).length||""}</em></button>`).join("");
  const area=box.closest(".list-area");
  area?.classList.toggle("empty-list-area",!customLists.length);
  $$('[data-list]').forEach(b=>b.onclick=()=>{selectedList=b.dataset.list;taskMode="list";navigate("tasks")});
}
function taskXPClient(){return 50;}
function taskCard(t,k=today(),completedView=false){
  if(t.workoutAggregate){const done=taskDone(t,k);return `<article class="task-row workout-aggregate-row ${done?"done":""}"><button type="button" class="check task-check ${done?"checked":""}" data-nav="gym" aria-label="Open Training">${done?"✓":""}</button><div class="task-main-copy" data-nav="gym"><div class="task-title-line"><b>Workout</b></div><div class="task-meta"><span class="priority-label">Priority · Medium</span></div></div><div class="task-actions"><button class="icon-btn" data-nav="gym" title="Open Training">⋮</button></div></article>`;}
  const latestCompleted=(t.completedDates||[]).slice().sort().at(-1)||k;
  const displayDate=completedView?latestCompleted:k,done=completedView||taskDone(t,k),overdue=!done&&t.dueDate&&t.dueDate<k&&!t.repeat?.type,priority=t.priority||"medium";
  return `<article class="task-row ${done?"done":""} ${overdue?"overdue":""}" data-open-task="${esc(t.id)}" data-open-date="${esc(displayDate)}"><button class="check task-check ${done?"checked":""}" data-task-toggle="${esc(t.id)}" data-date="${esc(displayDate)}" aria-label="${done?"Mark incomplete":"Complete"}">${done?"✓":""}</button><div class="task-main-copy"><div class="task-title-line"><b>${esc(t.title)}</b></div><div class="task-meta"><span class="priority-label ${esc(priority)}">Priority · ${esc(priorityLabel[priority]||priority)}</span></div></div><div class="task-actions"><button class="icon-btn" data-task-menu="${esc(t.id)}" title="More actions" aria-label="More actions">⋮</button></div></article>`;
}
function quickTaskForm(){return `<form id="quickTask" class="quick-add"><button type="button" class="quick-plus">+</button><input name="title" placeholder="Add a task…" autocomplete="off" required><button type="submit" class="quick-submit">Add</button><button type="button" class="ghost quick-more" id="moreTask">Details</button></form>`}
function bindQuickTask(){const f=$("#quickTask");if(!f)return;$("#moreTask")?.addEventListener("click",()=>openTaskForm());$(".quick-plus")?.addEventListener("click",()=>openTaskForm());f.addEventListener("submit",async e=>{e.preventDefault();const title=String(new FormData(f).get("title")||"").trim();if(!title)return;const r=await action("addTask",{item:{title,listId:selectedList==="all"?"inbox":selectedList,priority:"medium",estimate:25,dueDate:today(),dueTime:"",repeat:{type:"none",weekdays:[],startDate:""},notes:"",reminderAt:null,reminderEnabled:false,checklist:[]}});if(r){toast("Added to Today","success");renderShell()}})}

function timeWidgetMarkup(){const now=new Date();const locale="en-US";const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"Local time";const time=now.toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});const date=now.toLocaleDateString(locale,{weekday:"long",day:"numeric",month:"long",year:"numeric"});return `<section class="time-widget" aria-label="Current time"><div class="time-widget-main"><span class="section-kicker">${esc(tr("CURRENT TIME"))}</span><div class="time-widget-clock" id="timeWidgetClock">${esc(time)}</div><div class="time-widget-date" id="timeWidgetDate">${esc(date)}</div></div><div class="time-widget-meta"><span class="time-widget-dot"></span><b id="timeWidgetZone">${esc(tz)}</b><small>${esc(tr("Local device time"))}</small></div></section>`}
function startTimeWidget(){const render=()=>{const el=$("#timeWidgetClock"),dateEl=$("#timeWidgetDate"),zoneEl=$("#timeWidgetZone");if(!el)return;const now=new Date();const locale="en-US";el.textContent=now.toLocaleTimeString(locale,{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});if(dateEl)dateEl.textContent=now.toLocaleDateString(locale,{weekday:"long",day:"numeric",month:"long",year:"numeric"});if(zoneEl)zoneEl.textContent=Intl.DateTimeFormat().resolvedOptions().timeZone||"Local time"};render();clockInterval=setInterval(render,1000)}
function renderDashboard(el){
 const k=today(),todayTasks=plannedFor(k).filter(t=>!t.archived),taskDoneCount=todayTasks.filter(t=>taskDone(t,k)).length,taskPct=todayTasks.length?Math.round(taskDoneCount/todayTasks.length*100):0;
 const habits=state.habits||[],habitDoneCount=habits.filter(h=>habitDone(h,k)).length,habitPct=habits.length?Math.round(habitDoneCount/habits.length*100):0;
 const focusToday=(state.focusSessions||[]).filter(x=>x.date===k),focusMinutes=focusToday.reduce((n,x)=>n+Math.max(0,Number(x.minutes)||0),0),focusGoal=Math.max(1,Number(state.settings.dailyFocusGoalMin)||120),focusPct=Math.min(100,Math.round(focusMinutes/focusGoal*100));
 const streak=state.profile?.studyStreak||{current:0,best:0},activeDates=new Set((state.completions||[]).filter(x=>["task","habit","focus"].includes(String(x.kind||""))&&x.date).map(x=>String(x.date)));
 (state.workoutSessions||[]).filter(x=>x?.completed&&x.date).forEach(x=>activeDates.add(String(x.date)));if(focusMinutes)activeDates.add(k);
 const days=Array.from({length:7},(_,i)=>addDays(k,i-6)),momentum=days.map(day=>({day,count:(state.completions||[]).filter(x=>x.date===day).length})),maxMomentum=Math.max(1,...momentum.map(x=>x.count));
 const goals=(state.goals||[]).slice(0,5),openTasks=todayTasks.filter(t=>!taskDone(t,k)),todayTaskRows=todayTasks.map(t=>taskCard(t,k)).join("");
 const habitRows=habits.map(h=>{const done=habitDone(h,k);return `<article class="overview-habit-row ${done?"done":""}"><button type="button" class="check ${done?"checked":""}" data-habit-toggle="${esc(h.id)}" aria-label="${done?"Mark incomplete":"Complete habit"}">${done?"✓":""}</button><b>${esc(h.title)}</b><span>${done?"Done":"Open"}</span></article>`}).join("");
 const goalRows=goals.map(g=>`<div class="overview-goal-row"><div><b>${esc(g.title)}</b><small>${goalProgress(g)}/${Number(g.target)||0} days</small></div><button type="button" class="icon-btn danger-icon" data-delete-goal="${esc(g.id)}" title="Delete goal">×</button></div>`).join("");
 const monthDate=fromKey(k),monthYear=monthDate.getFullYear(),monthIndex=monthDate.getMonth(),monthOffset=(new Date(monthYear,monthIndex,1).getDay()+6)%7,monthLength=new Date(monthYear,monthIndex+1,0).getDate(),monthCells=Array.from({length:42},(_,i)=>{const n=i-monthOffset+1;if(n<1||n>monthLength)return '<span class="overview-month-empty"></span>';const day=localKey(new Date(monthYear,monthIndex,n));return '<button type="button" class="overview-month-day '+(day===k?'today ':'')+(activeDates.has(day)?'active':'')+'" data-cal-day="'+day+'" title="'+day+'">'+n+'</button>';}).join("");
 const weekDays=days.map(day=>`<button type="button" class="overview-calendar-day ${day===k?"today":""}" data-cal-day="${day}"><b>${fromKey(day).getDate()}</b><small>${fromKey(day).toLocaleDateString("en-US",{weekday:"short"})}</small><i class="${activeDates.has(day)?"active":""}"></i></button>`).join("");
 el.innerHTML=`<div class="overview-v2"><header class="overview-v2-head"><div><span class="eyebrow">OVERVIEW</span><h2>Today</h2><small>${fromKey(k).toLocaleDateString("en-US",{weekday:"long",day:"numeric",month:"long"})}</small></div><section class="overview-streak"><div><span>Streak</span><strong>🔥 ${Math.max(0,Number(streak.current)||0)}</strong><small>Best ${Math.max(Number(streak.best)||0,Number(streak.current)||0)} days</small></div><div class="overview-streak-days">${days.map(day=>`<i class="${activeDates.has(day)?"active":""}">${fromKey(day).toLocaleDateString("en-US",{weekday:"narrow"})}</i>`).join("")}</div></section></header>
 <section class="overview-progress"><button type="button" class="overview-progress-card" data-nav="tasks"><span>Tasks</span><strong>${taskDoneCount}<small> / ${todayTasks.length}</small></strong><div class="overview-progress-track"><i style="width:${taskPct}%"></i></div><small>${taskPct}% complete</small></button><button type="button" class="overview-progress-card" data-nav="tasks"><span>Habits</span><strong>${habitDoneCount}<small> / ${habits.length}</small></strong><div class="overview-progress-track"><i style="width:${habitPct}%"></i></div><small>${habitPct}% complete</small></button><button type="button" class="overview-progress-card" data-nav="focus"><span>Focus time</span><strong>${formatDuration(focusMinutes)}<small> / ${formatDuration(focusGoal)}</small></strong><div class="overview-progress-track"><i style="width:${focusPct}%"></i></div><small>${focusPct}% of daily goal</small></button></section>
 <div class="overview-v2-grid"><section class="overview-panel overview-momentum"><div class="overview-panel-head"><h3>Activity</h3><button type="button" class="ghost" data-nav="calendar">Calendar →</button></div><div class="overview-momentum-total"><strong>${momentum.reduce((n,x)=>n+x.count,0)}</strong><span>actions · last 7 days</span></div><div class="overview-bars">${momentum.map(x=>`<button type="button" class="overview-bar-day" data-cal-day="${x.day}" title="${x.day} · ${x.count} actions"><span><i style="height:${x.count?Math.max(8,Math.round(x.count/maxMomentum*100)):3}%"></i></span><b>${x.count}</b><small>${fromKey(x.day).toLocaleDateString("en-US",{weekday:"narrow"})}</small></button>`).join("")}</div><div class="overview-mini-calendar-head"><b>${monthDate.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</b><button type="button" class="ghost" data-nav="calendar">Month →</button></div><div class="overview-mini-weekdays">${["M","T","W","T","F","S","S"].map(x=>`<span>${x}</span>`).join("")}</div><div class="overview-mini-grid">${monthCells}</div></section>
 <section class="overview-panel overview-today-actions"><div class="overview-panel-head"><h3>Today&#39;s Focus</h3><span>${openTasks.length} tasks left</span></div><div class="overview-action-columns"><div class="overview-action-group"><div class="overview-subhead"><b>Tasks</b><button type="button" class="ghost" data-nav="tasks">All →</button></div><div class="overview-scroll-list">${todayTaskRows||'<div class="empty">No tasks</div>'}</div></div><div class="overview-action-group"><div class="overview-subhead"><b>Habits</b><button type="button" class="ghost" data-nav="tasks">All →</button></div><div class="overview-scroll-list">${habitRows||'<div class="empty">No habits</div>'}</div></div></div></section>
 <section class="overview-panel overview-goals-calendar"><div class="overview-panel-head"><h3>Goals</h3><button type="button" class="ghost" data-nav="calendar">Open →</button></div><div class="overview-goal-list">${goalRows||'<div class="empty">No goals</div>'}</div><div class="overview-panel-head overview-calendar-head"><h3>Calendar</h3><button type="button" class="ghost" data-nav="calendar">Month →</button></div><div class="overview-calendar-strip">${weekDays}</div></section></div></div>`;
 bindGlobal();$$('[data-cal-day]').forEach(b=>b.addEventListener('click',()=>{selectedDate=b.dataset.calDay;calendarDate=fromKey(selectedDate);navigate('calendar')}));
}
function renderToday(el){taskMode="today";renderTasks(el);}
function habitCard(h,k){const done=habitDone(h,k);return `<div class="habit-card ${done?"done":""}"><button class="check ${done?"checked":""}" data-habit-toggle="${esc(h.id)}">${done?"✓":""}</button><div><b>${esc(h.title)}</b><small>${(h.completions||[]).length} check-ins</small></div></div>`}

function workoutConfigLabel(cfg){
  if(!cfg?.enabled)return "Task only";
  if(cfg.mode==="circuit")return `${Number(cfg.circuitRounds)||2} round circuit`;
  if(cfg.mode==="max")return `${Math.max(1,Number(cfg.sets)||1)} × MAX timer`;
  if(cfg.mode==="time")return `${formatGymClock(Number(cfg.durationSeconds)||0)} timed set`;
  const sets=Math.max(1,Number(cfg.sets)||1),a=Math.max(0,Number(cfg.repsMin)||0),b=Math.max(a,Number(cfg.repsMax)||a);
  return `${sets} × ${a}${b!==a?`–${b}`:""} reps · ${Number(cfg.restSeconds)||0}s rest`;
}
function formatGymClock(sec){const n=Math.max(0,Math.round(Number(sec)||0)),m=Math.floor(n/60),s=n%60;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
function gymTasksForDay(day=today()){return rawGymTasksForDay(day)}
function gymEntryFor(taskId){return (state.workoutEngine?.session?.entries||[]).find(x=>String(x.taskId)===String(taskId))||null}
function currentGymContext(){
  const f=state.workoutEngine||{},ids=Array.isArray(f.taskIds)?f.taskIds:[],t=state.tasks.find(x=>String(x.id)===String(ids[Number(f.taskIndex)||0]));
  if(!t)return {f,task:null,cfg:null,step:null,entry:null};
  const cfg=t.workoutConfig||{};let step=null;
  if(cfg.mode==="circuit")step=(cfg.circuit||[])[Number(f.circuitIndex)||0]||null;
  else step={mode:cfg.mode||"reps",sets:cfg.sets,repsMin:cfg.repsMin,repsMax:cfg.repsMax,durationSeconds:cfg.durationSeconds,restSeconds:cfg.restSeconds};
  return {f,task:t,cfg,step,entry:gymEntryFor(t.id)};
}
function gymPhaseSeconds(){const f=state.workoutEngine||{};if((f.phase!=="rest"&&f.phase!=="roundRest")||!f.taskIds?.length)return 0;if(f.paused)return Math.max(0,Number(f.remaining)||0);return f.active&&Number(f.endsAt)>0?Math.max(0,Math.ceil((Number(f.endsAt)-Date.now())/1000)):Math.max(0,Number(f.remaining)||0)}
function gymExerciseCountdown(){const f=state.workoutEngine||{};if(f.phase!=="exercise"||f.timerKind!=="countdown")return 0;if(f.paused)return Math.max(0,Number(f.remaining)||0);if(f.active&&Number(f.endsAt)>0)return Math.max(0,Math.ceil((Number(f.endsAt)-Date.now())/1000));return Math.max(0,Number(f.remaining)||0)}
function gymMaxElapsed(){const f=state.workoutEngine||{};if(f.phase!=="exercise")return 0;const base=Math.max(0,Number(f.elapsedBase)||0);if(!f.active)return base;return base+Math.max(0,Math.floor((Date.now()-Math.max(0,Number(f.phaseStartedAt)||Date.now()))/1000))}
function gymProgress(){const ids=Array.isArray(state.workoutEngine?.taskIds)?state.workoutEngine.taskIds:[];const done=Math.min(ids.length,Math.max(0,Number(state.workoutEngine?.taskIndex)||0));return {done,total:ids.length,pct:ids.length?Math.round(done/ids.length*100):0}}
function workoutStepCount(cfg){if(cfg?.mode==="circuit")return (cfg.circuit||[]).length;return Math.max(1,Number(cfg?.sets)||1)}
function workoutStepLabel(f,cfg,step){if(f.phase==="rest")return "REST";if(f.phase==="roundRest")return "ROUND REST";if(cfg?.mode==="circuit")return `${(Number(f.circuitIndex)||0)+1} / ${workoutStepCount(cfg)} · Round ${(Number(f.circuitRound)||0)+1} / ${Number(cfg.circuitRounds)||2}`;return `Set ${(Number(f.setIndex)||0)+1} / ${Number(cfg?.sets)||1}`}
function renderGym(el){
  const day=today(),tasks=gymTasksForDay(day),f=state.workoutEngine||{};
  const workoutDone=workoutDoneForDay(day);
  const open=workoutDone?[]:tasks.filter(t=>!taskDone(t,day));
  const done=tasks.length-open.length;
  const dayLabel=fromKey(day).toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'});
  const activeWorkout=Array.isArray(f.taskIds)&&f.taskIds.length>0;

  if(activeWorkout){
    const {task,cfg,step}=currentGymContext(),p=gymProgress(),phase=f.phase||'exercise';
    const phaseLabel=workoutStepLabel(f,cfg,step);
    const display=phase==='rest'||phase==='roundRest'?formatGymClock(gymPhaseSeconds()):step?.mode==='max'?formatGymClock(gymMaxElapsed()):step?.mode==='time'?formatGymClock((f.active||f.paused)?gymExerciseCountdown():Number(step.durationSeconds)||0):'READY';
        const entry=state.workoutEngine?.session?.entries?.find(x=>String(x.taskId)===String(task?.id));
    const stepTarget=step?.mode==='reps'?`Target ${Number(step.repsMin)||0}${Number(step.repsMax)&&Number(step.repsMax)!==Number(step.repsMin)?`–${Number(step.repsMax)}`:''} reps`:step?.mode==='max'?'MAX — stop when finished':step?.mode==='time'?`Timed set · ${formatGymClock(Number(step.durationSeconds)||0)}`:'Circuit interval';
    el.innerHTML=`<div class="gym-page gym-active-page">
      <header class="gym-hero active">
        <div class="gym-hero-copy">
          <div class="eyebrow-row"><span class="badge">WORKOUT IN PROGRESS</span><span class="gym-day-label">${esc(dayLabel)}</span></div>
          <h2>${esc(task?.title||'Workout')}</h2>
          <p>Follow the current task, finish the set, and Aurestar will handle the recovery timer and move to the next task automatically.</p>
        </div>
        <div class="gym-hero-status"><span class="gym-status-dot ${f.active?'live':f.paused?'paused':''}"></span><strong>${f.active?'RUNNING':f.paused?'PAUSED':'READY'}</strong><small>${p.done}/${p.total} exercises completed · one guided session</small></div>
      </header>
      <div class="gym-active-grid">
        <section class="gym-focus-card">
          <div class="gym-focus-top"><div><span class="section-kicker">${esc(phaseLabel)}</span><h3>${esc(task?.title||'Workout')}</h3><p>${esc(workoutConfigLabel(cfg))}</p></div><div class="gym-task-counter">Exercise <b>${Math.min((Number(f.taskIndex)||0)+1,p.total)}</b><span>/ ${p.total}</span></div></div>
          <div class="gym-clock-wrap ${phase!=='exercise'?'recovery':''}">
            <span class="gym-clock-context">${phase==='rest'||phase==='roundRest'?'RECOVER':step?.mode==='max'?'MAX TIMER':step?.mode==='time'?'TIMED SET':'SET'}</span>
            <div id="gymTimerDisplay" class="gym-timer-display">${display}</div>
            <span class="gym-clock-target">${esc(stepTarget)}</span>
            ${cfg?.mode==='circuit'&&phase==='exercise'?`<span class="gym-clock-target gym-auto-note">${step?.mode==='time'?(f.active?'Timer running automatically':'Press Start timed set to begin'):step?.mode==='reps'?'Enter reps, then complete the interval':'Press Start MAX to begin'}</span>`:''}
          </div>
          ${step?.mode==='reps'&&phase==='exercise'?`<div class="gym-set-entry"><label><span>Actual reps completed</span><input id="gymActualReps" type="number" min="0" max="999" inputmode="numeric" placeholder="e.g. 10" autocomplete="off"></label><button class="gym-big-primary" id="gymCompleteStep">✓ Complete set</button></div>`:''}
          ${step?.mode==='time'&&phase==='exercise'&&!f.active&&!f.paused?`<button class="gym-big-primary gym-full-button" id="gymStartStep">▶ Start timed set</button>`:''}
          ${step?.mode==='max'&&phase==='exercise'?`<div class="gym-button-row"><button class="gym-big-primary" id="gymStartStep" ${f.active?'disabled':''}>▶ Start MAX</button><button class="gym-secondary-button" id="gymCompleteStep" ${f.active?'':'disabled'}>✓ Finish &amp; save</button></div>`:''}
          ${phase==='rest'||phase==='roundRest'?`<div class="gym-rest-box"><div><span>REST TIMER</span><strong>${formatGymClock(gymPhaseSeconds())}</strong></div><div class="gym-rest-controls"><button class="gym-small-button" id="gymRestMinus">−15s</button><button class="gym-small-button" id="gymRestPause">${f.paused?'Resume':'Pause'}</button><button class="gym-small-button" id="gymRestSkip">Skip</button><button class="gym-small-button" id="gymRestPlus">+15s</button></div></div>`:''}
          <div class="gym-bottom-controls">${phase==='exercise'&&step?.mode!=='max'?`<button class="gym-secondary-button" id="gymPause">${f.paused?'Resume':'Pause'}</button>`:''}<button class="gym-stop-button" id="gymStop">Stop workout</button></div>
          ${entry?.sets?.length?`<div class="gym-set-history"><span class="section-kicker">CURRENT EXERCISE</span><div>${entry.sets.map((x,i)=>x?`<span>Set ${i+1}: <b>${x.actualReps!=null?`${x.actualReps} reps`:formatGymClock(x.actualSeconds||0)}</b></span>`:'').join('')}</div></div>`:''}
        </section>
        <aside class="gym-sidebar-card">
          <div class="gym-side-head"><div><span class="section-kicker">FULL WORKOUT</span><h3>${p.done}/${p.total} exercises completed</h3><p>All remaining exercises are in this session</p></div><strong>${workoutDoneForDay(day)?100:0}%</strong></div>
          <div class="gym-progress"><i style="width:${workoutDoneForDay(day)?100:0}%"></i></div>
          <div class="gym-task-stack">${f.taskIds.map((id,i)=>{const tt=state.tasks.find(x=>String(x.id)===String(id));const isDone=i<(Number(f.taskIndex)||0);const isCurrent=i===Number(f.taskIndex||0);return `<button type="button" class="gym-task-stack-row ${isDone?'done':''} ${isCurrent?'current':''}" data-gym-current="${esc(id)}"><span>${isDone?'✓':i+1}</span><div><b>${esc(tt?.title||'Exercise')}</b><small>${esc(workoutConfigLabel(tt?.workoutConfig||{}))}</small></div><em>${isCurrent?'NOW':isDone?'DONE':''}</em></button>`}).join('')}</div>
          <div class="gym-side-note"><b>Next exercise</b><span>${esc(f.taskIds[(Number(f.taskIndex)||0)+1]?state.tasks.find(x=>String(x.id)===String(f.taskIds[(Number(f.taskIndex)||0)+1]))?.title||'Next task':'Last task of the workout')}</span></div>
        </aside>
      </div>
    </div>`;
    bindGymActive();
    startGymUiLoop();
    return;
  }

  el.innerHTML=`<div class="gym-page">
    <header class="gym-hero">
      <div class="gym-hero-copy">
        <div class="eyebrow-row"><span class="badge">GYM TIMER</span><span class="gym-day-label">${esc(dayLabel)}</span></div>
        <h2>Today's workout</h2>
        <p>All exercises, sets and recovery intervals are grouped into one Workout task.</p>
        <div class="gym-hero-actions">
          ${tasks.length?(open.length?`<button class="gym-start-today" id="gymStartToday"><span>▶</span><div><strong>Start all exercises</strong><small>One click starts all ${open.length} remaining exercises in one guided session.</small></div></button>`:`<div class="gym-complete-banner"><span>✓</span><div><strong>Today's workout is complete</strong><small>1/1 workout task completed · ${tasks.length} exercises</small></div></div>`):`<div class="gym-complete-banner"><span>＋</span><div><strong>No workout scheduled</strong><small>Add exercises to create one Workout task.</small></div></div>`}
          <button class="gym-task-start" id="gymAddExercise">＋ Add exercise</button>
        </div>
      </div>
      <div class="gym-hero-summary"><div><b>${tasks.length}</b><span>Exercises</span></div><div><b>${done}</b><span>Completed</span></div><div><b>${open.length}</b><span>Remaining</span></div></div>
    </header>

    <section class="gym-howto">
      <div><span class="gym-step-number">1</span><div><b>Start once</b><small>Starts the full schedule for today.</small></div></div>
      <div><span class="gym-step-number">2</span><div><b>Complete each set</b><small>Enter reps or run the timed exercise.</small></div></div>
      <div><span class="gym-step-number">3</span><div><b>Rest automatically</b><small>Aurestar counts down the configured rest.</small></div></div>
    </section>

    <section class="gym-workout-panel">
      <div class="gym-panel-header"><div><span class="section-kicker">ALL EXERCISES · ONE SESSION</span><h3>Today's exercise schedule</h3></div><span class="gym-panel-count">${tasks.length} exercises</span></div>
      <div class="gym-task-list">${tasks.map((t,i)=>{const isDone=taskDone(t,day);return `<article class="gym-task-card ${isDone?'done':''}">
        <div class="gym-task-index">${isDone?'✓':i+1}</div>
        <div class="gym-task-main"><div class="gym-task-title"><b>${esc(t.title)}</b>${isDone?'<span class="gym-done-chip">DONE</span>':''}</div><div class="gym-task-details"><span>${esc(workoutConfigLabel(t.workoutConfig))}</span>${t.dueTime?`<span>◷ ${esc(t.dueTime)}</span>`:''}</div></div>
        <div class="gym-task-actions">${!isDone?'<span class="gym-included-chip">IN FULL SESSION</span>':'<span class="gym-done-chip">DONE</span>'}<button class="gym-task-edit" data-gym-edit="${esc(t.id)}">Edit</button></div>
      </article>`}).join('')||`<div class="gym-empty-state"><strong>No gym tasks scheduled today.</strong><span>Open a Task and enable Gym Timer to add it to today's workout.</span><button class="gym-task-start" data-gym-new-task>＋ Create task</button></div>`}</div>
    </section>

    <section class="gym-history-panel"><div class="gym-panel-header"><div><span class="section-kicker">RECENT WORKOUTS</span><h3>History</h3></div><span class="gym-panel-count">${(state.workoutSessions||[]).length} sessions</span></div>${(state.workoutSessions||[]).length?`<div class="gym-history-list">${(state.workoutSessions||[]).slice().reverse().map(s=>`<article class="gym-history-row"><div><b>${esc(String(s.date||''))} · ${s.completed?'Completed':'Stopped'}</b><small>one guided session · ${Array.isArray(s.taskIds)?s.taskIds.length:0} exercises · ${formatGymClock(Number(s.duration)||0)}</small></div><strong class="${s.completed?'gym-history-ok':'gym-history-stopped'}">${s.completed?'✓':'—'}</strong></article>`).join('')}</div>`:`<div class="gym-empty-history">Your completed workout sessions will appear here.</div>`}</section>

    <section class="gym-customization-panel"><div><span class="section-kicker">EASY TO CUSTOMIZE</span><h3>Change the timer without rebuilding your Tasks</h3><p>Open any gym task to change sets, reps, time, rest, MAX mode or a cardio circuit. The task itself stays the same for Today, XP, quests and history.</p></div><button class="gym-task-edit" data-gym-new-task>＋ New task</button></section>
  </div>`;

  bindGlobal();
  $('#gymStartToday')?.addEventListener('click',()=>startGymWorkout());
  $('#gymAddExercise')?.addEventListener('click',()=>openTaskForm(null,{dueDate:day,workoutConfig:{enabled:true,mode:"reps",sets:3,repsMin:8,repsMax:12,restSeconds:60}}));
  $$('[data-gym-single]').forEach(b=>b.addEventListener('click',()=>startGymWorkout()));
  $$('[data-gym-edit]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();openTaskForm(b.dataset.gymEdit)}));
  $$('[data-gym-new-task]').forEach(b=>b.addEventListener('click',()=>openTaskForm(null,{dueDate:day,workoutConfig:{enabled:true,mode:"reps",sets:3,repsMin:8,repsMax:12,restSeconds:60}})));
}
async function startGymWorkout(){
  const day=today();
  const ids=gymTasksForDay(day).filter(t=>!taskDone(t,day)).map(t=>String(t.id));
  if(!ids.length){toast("All exercises for today are already complete","success");return;}
  const r=await action("startWorkout",{taskIds:ids,date:day});
  if(r){activeView="gym";gymLastStateKey="";history.replaceState(null,"","#gym");renderShell();}
}
async function startGymFromTask(){await startGymWorkout();}
function startGymUiLoop(){if(gymUiTimer)clearInterval(gymUiTimer);gymUiTimer=setInterval(async()=>{if(activeView!=="gym")return;try{const r=await send("getState");if(!r?.ok)return;state=r.state||state;const f=state.workoutEngine||{};if(!f.taskIds?.length){renderGym($('#view'));return;}const key=JSON.stringify({phase:f.phase,active:f.active,paused:f.paused,ti:f.taskIndex,si:f.setIndex,ri:f.circuitRound,ci:f.circuitIndex});if(key!==gymLastStateKey){gymLastStateKey=key;renderGym($('#view'));return;}const d=$('#gymTimerDisplay');if(!d)return;const {step}=currentGymContext();d.textContent=f.phase==="rest"||f.phase==="roundRest"?formatGymClock(gymPhaseSeconds()):step?.mode==="max"?formatGymClock(gymMaxElapsed()):step?.mode==="time"?formatGymClock((f.active||f.paused)?gymExerciseCountdown():Number(step.durationSeconds)||0):"READY";}catch(e){console.warn("gym ui",e)}},800)}
function bindGymActive(){
  $('#gymStop')?.addEventListener('click',async()=>{const r=await action('workoutStop');if(r){gymLastStateKey="";renderGym($('#view'));}});
  $('#gymPause')?.addEventListener('click',async()=>{const r=await action('workoutPause');if(r){gymLastStateKey="";renderGym($('#view'));}});
  $('#gymStartStep')?.addEventListener('click',async()=>{const r=await action('workoutStartStep');if(r){gymLastStateKey="";renderGym($('#view'));}});
  $('#gymCompleteStep')?.addEventListener('click',async()=>{const actual=Math.max(0,Math.floor(Number($('#gymActualReps')?.value)||0));const r=await action('workoutCompleteStep',{actual});if(r){gymLastStateKey="";renderGym($('#view'));}});
  $('#gymRestSkip')?.addEventListener('click',async()=>{const r=await action('workoutSkipRest');if(r){gymLastStateKey="";renderGym($('#view'));}});
  $('#gymRestMinus')?.addEventListener('click',async()=>{const r=await action('workoutAdjustRest',{delta:-15});if(r){gymLastStateKey="";renderGym($('#view'));}});
  $('#gymRestPlus')?.addEventListener('click',async()=>{const r=await action('workoutAdjustRest',{delta:15});if(r){gymLastStateKey="";renderGym($('#view'));}});
  $('#gymRestPause')?.addEventListener('click',async()=>{const r=await action('workoutPause');if(r){gymLastStateKey="";renderGym($('#view'));}});
  startGymUiLoop();
}

function renderTasks(el){
  const k=today(), tomorrow=addDays(k,1);
  let tasks=[],heading="All tasks",sub="";
  const matchesSearch=t=>!searchQuery||`${t.title} ${t.notes||""} ${listName(t.listId)}`.toLowerCase().includes(searchQuery);
  if(taskMode==="tomorrow"){heading="Tomorrow";sub=tomorrow;tasks=plannedFor(tomorrow);}
  else if(taskMode==="next7"){heading="Next 7 days";sub="Action plan for the next 7 days.";for(let i=0;i<7;i++)tasks.push(...plannedFor(addDays(k,i)));tasks=[...new Map(tasks.map(t=>[t.id,t])).values()];}
  else if(taskMode==="inbox"){heading="Inbox";sub="A place for tasks without a specific schedule.";tasks=state.tasks.filter(t=>t.listId==="inbox"&&!t.archived&&!t.workoutConfig?.enabled);{const w=workoutAggregateForDay(k,"inbox",true);if(w)tasks.push(w);}}
  else if(taskMode==="completed"){heading="Completed";sub="History of completed tasks.";tasks=state.tasks.filter(t=>t.completedDates?.length&&!t.workoutConfig?.enabled);{const w=workoutAggregateForDay(k);if(w&&taskDone(w,k))tasks.push(w);}}
  else if(taskMode==="list"){heading=listName(selectedList);sub="Your list.";tasks=state.tasks.filter(t=>!t.archived&&t.listId===selectedList&&!t.workoutConfig?.enabled);{const w=workoutAggregateForDay(k,selectedList,true);if(w)tasks.push(w);}}
  else if(taskMode==="all"){heading="All";sub="All tasks currently being tracked.";tasks=state.tasks.filter(t=>!t.archived&&!t.workoutConfig?.enabled);{const w=workoutAggregateForDay(k,null,true);if(w)tasks.push(w);}}
  else {heading="Today";sub=k;tasks=plannedFor(k);}
  tasks=tasks.filter(matchesSearch);
  const open=tasks.filter(t=>!taskDone(t,k));
  const doneToday=tasks.filter(t=>taskDone(t,k));
  const groups=taskMode==="next7"?Array.from({length:7},(_,i)=>{const day=addDays(k,i),items=tasks.filter(t=>plannedFor(day).some(x=>x.id===t.id));return{day,items}}).filter(g=>g.items.length):[{day:k,items:taskMode==="completed"?tasks:open}];
  const modeLabel={today:"Today",tomorrow:"Tomorrow",next7:"7 days",all:"All",inbox:"Inbox",completed:"Completed",list:"List"}[taskMode]||"Tasks";
  const totalVisible=state.tasks.filter(t=>!t.archived&&!t.workoutConfig?.enabled).length+(workoutAggregateForDay(k,null,true)?1:0);
  const completedCount=state.completions.filter(c=>c.date===k&&c.kind==="task").length;
  el.innerHTML=`<div class="task-workspace task-reference-page">
    <div class="task-page-head"><div><div class="eyebrow">${esc(modeLabel.toUpperCase())}</div><div class="task-heading-row"><h2>${esc(heading)}</h2></div><p class="task-date-line">${esc(sub)}</p></div><div class="task-head-actions"><button class="ghost" id="importTasksBtn">Import</button><button class="ghost" id="exportTasksBtn">Export</button><button class="primary" id="newTaskFocus"> + Tasks <kbd>N</kbd></button></div></div>
    <div class="task-controls"><div class="view-tabs">${[["today","Today"],["tomorrow","Tomorrow"],["next7","7 days"],["all","All"],["inbox","Inbox"],["completed","Completed"]].map(x=>`<button class="${taskMode===x[0]?"active":""}" data-task-switch="${x[0]}">${x[1]}</button>`).join("")}</div></div>
    ${quickTaskForm()}
    <div class="task-reference-layout">
      <section class="task-center-panel"><div class="task-board-title"><div><span class="section-kicker">TASK LIST</span><h3>${esc(heading)}</h3></div><span>${open.length} open</span></div><div class="task-reference-groups">${groups.map(g=>`<section class="task-group"><div class="task-group-head"><b>${g.day===k?"Today":fromKey(g.day).toLocaleDateString("en-US",{weekday:"long",day:"numeric",month:"numeric"})}</b><span>${g.items.length}</span></div><div class="task-list">${g.items.map(t=>taskCard(t,g.day,taskMode==="completed")).join("")||`<div class="empty">No tasks in this view.</div>`}</div></section>`).join("")}${taskMode!=="completed"&&doneToday.length?`<section class="task-group completed-group"><div class="task-group-head"><b>Completed today</b><span>${doneToday.length}</span></div><div class="task-list">${doneToday.map(t=>taskCard(t,k)).join("")}</div></section>`:""}</div></section>
      <aside class="task-reference-rail" id="dailyRoutineHabits">
        <section class="task-rail-card rail-stat-card"><div><span>Total tasks</span><strong>${totalVisible}</strong></div><div><span>Completed today</span><strong>${completedCount}</strong></div><div><span>Open in view</span><strong>${open.length}</strong></div></section>
      </aside>
    </div>
  </div>`;
  const quick=$("#quickTask"),taskPanel=$(".task-center-panel");if(quick&&taskPanel)taskPanel.prepend(quick);bindGlobal();bindQuickTask();renderHabits($("#dailyRoutineHabits"));
  $('[data-task-switch]').forEach(b=>b.onclick=()=>{taskMode=b.dataset.taskSwitch;selectedList="all";renderShell()});
  $("#newTaskFocus")?.addEventListener("click",openTaskForm);$("#importTasksBtn")?.addEventListener("click",openTaskImportPicker);$("#exportTasksBtn")?.addEventListener("click",openTaskExportMenu);
}

function openListForm(id=null){const l=id?state.lists.find(x=>x.id===id):null;openModal(`<div class="modal-head"><div><span class="badge">${l?"EDIT":"NEW"} LIST</span><h3>${l?"Edit list":"Create a list"}</h3></div><button class="icon-btn" data-close-modal>×</button></div><p class="muted">Each list is a focused area: Study, Training, Projects, Personal…</p><form id="listForm" class="modal-form"><label>List name<input name="name" value="${esc(l?.name||"")}" placeholder="Example: Exam prep" maxlength="40" required></label><div class="form-grid-2"><label>Icon<select name="icon">${["○","▣","⌘","△","◆","★","●","□"].map(i=>`<option ${l?.icon===i?"selected":""}>${i}</option>`).join("")}</select></label><label>Color<select name="color">${[["red","Red"],["orange","Orange"],["yellow","Yellow"]].map(x=>`<option value="${x[0]}" ${l?.color===x[0]?"selected":""}>${x[1]}</option>`).join("")}</select></label></div><button class="primary">${l?"Save changes":"Create list"}</button></form>`);$("#listForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),data={name:String(f.get("name")||"").trim(),icon:String(f.get("icon")||"○"),color:String(f.get("color")||"red")};const r=await action(l?"updateList":"addList",l?{id:l.id,...data}:data);if(r){closeModal();renderShell();toast(l?"List updated":"List created","success")}})}
function manageLists(){const body=state.lists.map(l=>`<div class="manage-list"><div class="manage-list-main"><span class="manage-list-icon">${esc(l.icon)}</span><div><b>${esc(l.name)}</b><small>${l.id==="inbox"||l.system?"Default":"Your list"}</small></div></div><div class="manage-list-actions">${l.id!=="inbox"?`<button class="icon-btn" data-edit-list="${esc(l.id)}">✎</button>`:""}${!(l.system||l.id==="inbox")?`<button class="icon-btn danger-icon" data-remove-list="${esc(l.id)}">×</button>`:""}</div></div>`).join("");openModal(`<div class="modal-head"><div><span class="badge">LISTS</span><h3>Lists</h3></div><button class="icon-btn" data-close-modal>×</button></div><div class="manage-list-stack">${body}</div><button class="primary" id="modalAddList">＋ Add list</button>`);$$('[data-remove-list]').forEach(b=>b.onclick=async()=>{if(!confirm("Delete this list? Its tasks will move to Inbox."))return;const r=await action("deleteList",{id:b.dataset.removeList});if(r){if(selectedList===b.dataset.removeList)selectedList="all";closeModal();renderShell();toast("List deleted","success")}});$$('[data-edit-list]').forEach(b=>b.onclick=()=>openListForm(b.dataset.editList));$("#modalAddList")?.addEventListener("click",()=>openListForm())}

function habitCompact(h){const done=habitDone(h),frequency=h.frequency==="weekly"?"Weekly":"Daily";return `<article class="habit-inline-card ${done?"done":""}"><button type="button" class="habit-inline-check ${done?"checked":""}" data-habit-toggle="${esc(h.id)}" aria-label="${done?"Mark habit incomplete":"Complete habit"}">${done?"✓":""}</button><div class="habit-inline-copy"><b>${esc(h.title)}</b><small>${frequency} · ${(h.completions||[]).length} check-ins</small></div><button type="button" class="habit-inline-edit" data-edit-habit="${esc(h.id)}" aria-label="Edit habit" title="Edit habit">✎</button><button type="button" class="habit-inline-delete" data-delete-habit="${esc(h.id)}" aria-label="Delete habit" title="Delete habit">×</button></article>`}
function bindHabitQuickAdd(){const form=$("#habitAdd");if(!form)return;form.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(form),title=String(f.get("title")||"").trim(),frequency=String(f.get("frequency")||"daily");if(!title)return;const r=await action("addHabit",{item:{title,xp:30,frequency}});if(r){renderShell();toast("Habit added","success")}})}
function openHabitForm(id){const h=state.habits.find(x=>String(x.id)===String(id));if(!h)return;openModal(`<div class="modal-head"><div><span class="badge">EDIT HABIT</span><h3>Edit habit</h3></div><button class="icon-btn" data-close-modal>×</button></div><form id="habitEditForm" class="modal-form"><label>Habit name<input name="title" maxlength="80" required value="${esc(h.title)}"></label><label>Frequency<select name="frequency"><option value="daily" ${h.frequency!=="weekly"?"selected":""}>Daily</option><option value="weekly" ${h.frequency==="weekly"?"selected":""}>Weekly</option></select></label><div class="modal-actions"><button type="button" class="ghost" data-close-modal>Cancel</button><button type="submit" class="primary">Save changes</button></div></form>`);$("#habitEditForm")?.addEventListener("submit",async e=>{e.preventDefault();const form=new FormData(e.currentTarget),title=String(form.get("title")||"").trim(),frequency=String(form.get("frequency")||"daily");if(!title)return;const r=await action("updateHabit",{id:h.id,item:{title,frequency}});if(r){closeModal();renderShell();toast("Habit updated","success")}})}
function renderHabits(el){
  const k=today(),habits=state.habits||[];
  const days=Array.from({length:7},(_,i)=>addDays(k,i-6));
  const completedToday=habits.filter(h=>habitDone(h,k)).length;
  const weekCheckins=habits.reduce((n,h)=>n+(h.completions||[]).filter(d=>days.includes(d)).length,0);
  const history=(h)=>days.map(day=>{
    const done=(h.completions||[]).includes(day);
    const label=fromKey(day).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    return `<span class="habit-week-cell ${done?"is-done":""} ${day===k?"is-today":""}" title="${esc(label)} · ${done?"Completed":"Not completed"}"><i></i><small>${fromKey(day).toLocaleDateString("en-US",{weekday:"narrow"})}</small></span>`;
  }).join("");
  const cards=habits.map(h=>{
    const done=habitDone(h,k),frequency=h.frequency==="weekly"?"Weekly":"Daily";
    return `<article class="habit-board-card ${done?"is-complete":""}">
      <div class="habit-board-main">
        <button type="button" class="habit-inline-check ${done?"checked":""}" data-habit-toggle="${esc(h.id)}" aria-label="${done?"Mark habit incomplete":"Complete habit"}">${done?"✓":""}</button>
        <div class="habit-board-copy"><b>${esc(h.title)}</b><small>${frequency} · ${(h.completions||[]).length} check-ins</small></div>
        <div class="habit-board-actions"><button type="button" class="habit-inline-edit" data-edit-habit="${esc(h.id)}" aria-label="Edit habit" title="Edit habit">✎</button><button type="button" class="habit-inline-delete" data-delete-habit="${esc(h.id)}" aria-label="Delete habit" title="Delete habit">×</button></div>
      </div>
      <div class="habit-week-history" aria-label="Last seven days">${history(h)}</div>
    </article>`;
  }).join("");
  el.innerHTML=`<div class="habits-workspace">
    <header class="habits-page-head"><div><span class="eyebrow">DAILY RHYTHM</span><h2>Habits</h2><p>Build consistency through small, repeatable actions.</p></div><div class="habits-head-date"><span>Today</span><b>${fromKey(k).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</b></div></header>
    <section class="habits-summary-grid">
      <article class="habits-summary-card"><span>Active habits</span><strong>${habits.length}</strong></article>
      <article class="habits-summary-card"><span>Completed today</span><strong>${completedToday}<small> / ${habits.length}</small></strong></article>
      <article class="habits-summary-card"><span>Check-ins · 7 days</span><strong>${weekCheckins}</strong></article>
    </section>
    <section class="habit-create-panel"><div><span class="section-kicker">NEW ROUTINE</span><h3>Add a habit</h3></div><form id="habitAdd" class="habit-quick-add"><input name="title" placeholder="e.g. Read for 20 minutes" maxlength="80" required aria-label="Habit name"><select name="frequency" aria-label="Habit frequency"><option value="daily" selected>Daily</option><option value="weekly">Weekly</option></select><button class="primary" type="submit">＋ Add habit</button></form></section>
    <section class="habit-board-section"><div class="habit-board-heading"><div><span class="section-kicker">YOUR ROUTINES</span><h3>Habit tracker</h3></div><span class="muted">Last 7 days</span></div>
      <div class="habit-board-list">${cards||'<div class="empty habit-empty">No habits yet. Add your first routine above.</div>'}</div>
    </section>
  </div>`;
  bindGlobal();bindHabitQuickAdd();
}
function habitDetail(h){const done=habitDone(h);const freq=h.frequency==="weekly"?"weekly":"daily";return `<article class="habit-detail ${done?"done":""}"><div class="habit-detail-head"><button class="check ${done?"checked":""}" data-habit-toggle="${esc(h.id)}">${done?"✓":""}</button><div><h3>${esc(h.title)}</h3><p>${freq} habit</p></div><button class="icon-btn danger-icon" data-delete-habit="${esc(h.id)}">×</button></div><div class="habit-stats"><div><b>${(h.completions||[]).length}</b><small>check-ins</small></div><div><b>${done?"Done":"Pending"}</b><small>today</small></div><div><b>${freq}</b><small>frequency</small></div></div></article>`}

let focusUiState={active:false,phase:"idle",mode:25,remaining:25*60,elapsed:0,paused:false,endsAt:0,pomodorosCompleted:0,roundsTarget:4,taskId:"",breakKind:"short",countdown:true,free:false,todayFocusMinutes:0,dailyFocusGoalMin:120};
let focusUiTimer=null;
function fmtFocusSeconds(s){const n=Math.max(0,Math.ceil(Number(s)||0));return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`};
async function refreshFocusEngine(){try{const r=await send("getFocusState");if(r?.ok&&r.result?.focus){focusUiState=r.result.focus;updateFocusUI();}}catch{}}
function updateFocusUI(){
 const f=focusUiState,display=$("#focusEngineDisplay"),status=$("#focusEngineStatus"),start=$("#timerStart"),stop=$("#timerStop"),reset=$("#timerReset"),seconds=Math.max(0,Number(f.remaining)||0);
 if(display)display.textContent=fmtFocusSeconds(seconds);
 const isBreak=f.phase==="break",isRunning=!!f.active,isPaused=!!f.paused,target=Math.max(1,Number(f.roundsTarget)||4),completed=Math.max(0,Number(f.pomodorosCompleted)||0);
 const label=isRunning?(isBreak?(f.breakKind==="long"?"Long break":"Short break"):"Focusing"):isPaused?"Paused":isBreak?"Break":"Ready";
 if(status)status.textContent=label;
 if(start)start.textContent=isRunning?"Pause":isPaused?"Resume":isBreak?"Resume break":"Start focus";
 if(stop){stop.disabled=!(isRunning||isPaused);stop.setAttribute("aria-disabled",String(!(isRunning||isPaused)));}
 if(reset){reset.disabled=!(isRunning||isPaused||isBreak);reset.setAttribute("aria-disabled",String(!(isRunning||isPaused||isBreak)));}
 const sel=$("#focusTaskSelect");if(sel&&document.activeElement!==sel){sel.value=f.taskId||"";sel.disabled=isRunning||isPaused||isBreak;}
 const rounds=$("#focusRoundsSelect");if(rounds){rounds.value=String(target);rounds.disabled=isRunning||isPaused||isBreak;}
 const count=$("#focusPomodoroCount");if(count)count.textContent=String(Math.min(completed,target));
 const roundText=$("#focusRoundText");if(roundText)roundText.textContent=`/ ${target}`;
 const goal=Number(f.dailyFocusGoalMin)||Number(state.settings.dailyFocusGoalMin)||120,mins=Math.min(goal,Number(f.todayFocusMinutes)||0),pct=Math.min(100,Math.round(mins/goal*100));
 const bar=$("#focusGoalBar");if(bar)bar.style.width=`${pct}%`;
 const goalText=$("#focusGoalText");if(goalText)goalText.textContent=`${Math.floor(mins)} / ${goal} min`;
 const shell=document.querySelector(".focus-clock-shell");if(shell){shell.classList.toggle("is-break",isBreak);shell.classList.toggle("is-paused",isPaused);}
 const phase=document.querySelector(".focus-phase-label");if(phase)phase.textContent=isBreak?(f.breakKind==="long"?"LONG BREAK":"SHORT BREAK"):"FOCUS";
 $$('[data-focus-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.focusMode===(isBreak?(f.breakKind==="long"?"long":"short"):"focus"))));
}
function exportFocusCSV(){const rows=[["Date","StartedAt","CompletedAt","Minutes","Mode","Task"],...(state.focusSessions||[]).map(x=>[x.date,x.startedAt?new Date(Number(x.startedAt)).toISOString():"",x.completedAt?new Date(Number(x.completedAt)).toISOString():"",Number(x.minutes)||0,x.mode||"focus",x.taskId?(state.tasks.find(t=>t.id===x.taskId)?.title||"Linked task"):"Free focus"] )];downloadText(`aurestar-focus-${today()}.csv`,"text/csv;charset=utf-8","\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\n"));toast("Focus history exported","success")}
function renderFocus(el){
 const f=focusUiState||{},totalMin=Number(state.profile?.totalFocusMinutes)||0,todaySessions=(state.focusSessions||[]).filter(x=>x.date===today()),todayMin=todaySessions.reduce((n,x)=>n+Math.max(0,Number(x.minutes)||0),0);
 const taskOptions=`<option value="">General focus</option>`+state.tasks.filter(t=>!t.archived).map(t=>`<option value="${esc(t.id)}" ${String(t.id)===String(f.taskId||"")?'selected':''}>${esc(t.title)}</option>`).join("");
 const sessions=[...(state.focusSessions||[])].sort((a,b)=>Number(b.completedAt||0)-Number(a.completedAt||0)),isRunning=!!f.active,isPaused=!!f.paused,isBreak=f.phase==="break";
 const statusLabel=isRunning?(isBreak?(f.breakKind==="long"?"Long break":"Short break"):"Focusing"):isPaused?"Paused":isBreak?"Break":"Ready";
 const goal=Math.max(1,Number(f.dailyFocusGoalMin)||Number(state.settings.dailyFocusGoalMin)||120),goalMinutes=Math.min(goal,Number(f.todayFocusMinutes)||todayMin),goalPct=Math.min(100,Math.round(goalMinutes/goal*100)),target=Math.max(1,Number(f.roundsTarget)||4),completed=Math.min(target,Math.max(0,Number(f.pomodorosCompleted)||0)),widgetEnabled=state.settings.focusWidgetEnabled!==false;
 el.innerHTML=`<div class="focus-workspace"><header class="focus-workspace-head"><div class="focus-title-group"><span class="eyebrow">POMODORO</span><h2>Focus</h2></div><div class="focus-round-picker"><label for="focusRoundsSelect">Rounds</label><select id="focusRoundsSelect" ${isRunning||isPaused||isBreak?'disabled':''}>${Array.from({length:20},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===target?'selected':''}>${n}</option>`).join("")}</select></div><div class="focus-mode-picker" role="group" aria-label="Focus timer mode"><button type="button" data-focus-mode="focus" aria-pressed="${!isBreak}" title="Focus · ${Number(state.settings.focusPreset)||25} minutes"><b>F</b><span>Focus</span><small>${Number(state.settings.focusPreset)||25}m</small></button><button type="button" data-focus-mode="short" aria-pressed="${isBreak&&f.breakKind!=="long"}" title="Short break · ${Number(state.settings.focusShortBreak)||5} minutes"><b>S</b><span>Short</span><small>${Number(state.settings.focusShortBreak)||5}m</small></button><button type="button" data-focus-mode="long" aria-pressed="${isBreak&&f.breakKind==="long"}" title="Long break · ${Number(state.settings.focusLongBreak)||15} minutes"><b>L</b><span>Long</span><small>${Number(state.settings.focusLongBreak)||15}m</small></button></div></header>
 <div class="focus-workspace-grid"><section class="focus-session-card"><div class="focus-session-top"><label>Task<select id="focusTaskSelect" ${isRunning||isPaused||isBreak?'disabled':''}>${taskOptions}</select></label><div class="focus-round-progress"><strong id="focusPomodoroCount">${completed}</strong><span id="focusRoundText">/ ${target}</span><small>rounds</small></div></div>
 
 <div class="focus-clock-shell focus-clock-v4 ${isBreak?'is-break':''} ${isPaused?'is-paused':''}"><span class="focus-phase-label">${isBreak?(f.breakKind==="long"?"LONG BREAK":"SHORT BREAK"):"FOCUS"}</span><div class="timer-display timer-display-v3" id="focusEngineDisplay">${fmtFocusSeconds(Number(f.remaining)||0)}</div><div class="focus-timer-meta"><span id="focusEngineStatus">${esc(statusLabel)}</span></div></div>
 <div class="focus-controls-v4"><button type="button" class="primary" id="timerStart">${isRunning?"Pause":isPaused?"Resume":isBreak?"Resume break":"Start focus"}</button><button type="button" class="ghost" id="timerStop" ${isRunning||isPaused?'':'disabled'}>Stop</button><button type="button" class="ghost" id="timerReset" ${isRunning||isPaused||isBreak?'':'disabled'}>Reset</button></div>
 <div class="focus-widget-row"><span>Pomodoro widget</span><button type="button" class="ghost" id="focusWidgetToggle">${widgetEnabled?"Hide widget":"Show widget"}</button></div></section>
 <aside class="focus-side-v4"><section class="focus-stats-card focus-stats-v4"><div><span>Today</span><strong>${formatDuration(todayMin)}</strong></div><div><span>Sessions</span><strong>${todaySessions.length}</strong></div><div><span>Total</span><strong>${Math.floor(totalMin/60)}h ${totalMin%60}m</strong></div></section>
 <section class="focus-goal focus-goal-v4"><div class="focus-goal-head"><span>Daily goal</span><b id="focusGoalText">${Math.floor(goalMinutes)} / ${goal} min</b></div><div class="focus-goal-track"><i id="focusGoalBar" style="width:${goalPct}%"></i></div></section>
 <section class="focus-history-panel focus-history-v4"><div class="section-head"><h3>History</h3><span class="muted">${(state.focusSessions||[]).length}</span></div><div class="focus-history-scroll">${sessions.length?sessions.map(x=>`<article class="focus-history-row"><span class="focus-history-icon">◉</span><div><b>${esc(x.taskId?(state.tasks.find(t=>String(t.id)===String(x.taskId))?.title||'Task'):'General focus')}</b><small>${new Date(Number(x.completedAt||0)).toLocaleDateString()} · ${Number(x.minutes)||0}m</small></div><strong>${Number(x.minutes)||0}m</strong></article>`).join(""):'<div class="empty">No sessions yet</div>'}</div></section></aside></div></div>`;
 $('#focusTaskSelect')?.addEventListener('change',async e=>{try{const r=await action('focusSetTask',{taskId:e.target.value});if(r){focusUiState=r.result?.focus||focusUiState;updateFocusUI();}}catch(err){toast(err.message||'Could not change focus task','error');}});
 $('#focusRoundsSelect')?.addEventListener('change',async e=>{try{const r=await action('focusSetRounds',{rounds:Number(e.target.value)});if(r){focusUiState=r.result?.focus||focusUiState;updateFocusUI();}}catch(err){toast(err.message||'Could not change rounds','error');}});
 $$('[data-focus-mode]').forEach(button=>button.addEventListener('click',async()=>{const mode=button.dataset.focusMode,current=focusUiState.phase==='break'?(focusUiState.breakKind==='long'?'long':'short'):'focus';if(mode===current)return;if((focusUiState.active||focusUiState.paused)&&!confirm('Switching modes will end the current timer without recording it. Continue?'))return;try{const r=await action('focusSelectMode',{mode});if(r){focusUiState=r.result?.focus||focusUiState;updateFocusUI();}}catch(err){toast(err.message||'Could not change timer mode','error');}}));
 $('#timerStart')?.addEventListener('click',async()=>{try{const r=focusUiState.active?await action('focusPause'):await action('focusStart',{mode:Number(focusUiState.mode)||Number(state.settings.focusPreset)||25,taskId:focusUiState.taskId||'',rounds:Number($('#focusRoundsSelect')?.value)||Number(focusUiState.roundsTarget)||4,free:false});if(r){focusUiState=r.result?.focus||focusUiState;updateFocusUI();}}catch(err){toast(err.message||'Focus action failed','error');}});
 $('#timerStop')?.addEventListener('click',async()=>{if(!(focusUiState.active||focusUiState.paused))return;if(!confirm('Stop this Focus session?'))return;try{const r=await action('focusStop');if(r){focusUiState=r.result?.focus||focusUiState;renderView('focus');}}catch(err){toast(err.message||'Could not stop focus','error');}});
 $('#timerReset')?.addEventListener('click',async()=>{if(!(focusUiState.active||focusUiState.paused||focusUiState.phase==="break"))return;if(!confirm('Reset the current timer?'))return;const mode=focusUiState.phase==='break'?(focusUiState.breakKind==='long'?'long':'short'):'focus';try{const r=await action('focusSelectMode',{mode});if(r){focusUiState=r.result?.focus||focusUiState;renderView('focus');}}catch(err){toast(err.message||'Could not reset focus','error');}});
 $('#focusWidgetToggle')?.addEventListener('click',async()=>{const enabled=state.settings.focusWidgetEnabled!==false;const r=await action('setFocusWidgetEnabled',{enabled:!enabled});if(r){state.settings.focusWidgetEnabled=!enabled;renderView('focus');}});
 if(focusUiTimer)clearInterval(focusUiTimer);focusUiTimer=setInterval(refreshFocusEngine,1000);refreshFocusEngine();
}
function focusXPClient(){return 60;}

function startTimer(){return refreshFocusEngine()}
function stopTimer(){return action("focusPause")}
function startSound(type){if(state?.settings?.privacyMode===true){stopSound();toast("Audio is disabled in Discreet Mode");return;}stopSound();const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return toast("Web Audio is not supported","error");audioCtx=new AC();audioMaster=audioCtx.createGain();audioMaster.gain.value=.045;audioMaster.connect(audioCtx.destination);audioType=type;const rate=audioCtx.sampleRate,buf=audioCtx.createBuffer(1,rate*4,rate),data=buf.getChannelData(0);if(type==="lofi"){for(let i=0;i<data.length;i++){const t=i/rate,wob=.45+.15*Math.sin(2*Math.PI*.08*t);data[i]=(.06*Math.sin(2*Math.PI*196*t)+.035*Math.sin(2*Math.PI*246.94*t)+.018*Math.sin(2*Math.PI*293.66*t))*wob;}}else{let last=0;for(let i=0;i<data.length;i++){const w=Math.random()*2-1;if(type==="brown"){last=(last+.02*w)/1.02;data[i]=last*2.8;}else if(type==="rain"){data[i]=w*.08+(i%(Math.floor(rate*.09)||1)<18?w*.32:0);}else data[i]=w*.32;}}const src=audioCtx.createBufferSource();src.buffer=buf;src.loop=true;src.connect(audioMaster);src.start();audioSources=[src];audioCtx.resume();renderView("focus")}
function stopSound(){for(const s of audioSources){try{s.stop()}catch{}}audioSources=[];try{audioCtx?.close()}catch{}audioCtx=null;audioMaster=null;audioType=null}

function activityCount(dayKey){return new Set(state.completions.filter(c=>c.date===dayKey).map(c=>`${c.kind}:${c.id}`)).size}
function contributionData(days=365){const end=today(),start=addDays(end,-(days-1));const rows=[];for(let i=0;i<days;i++){const k=addDays(start,i),count=activityCount(k);rows.push({date:k,count})}return rows}
function heatLevel(n,max=8){if(!n)return 0;return Math.min(4,Math.ceil(n/Math.max(1,max)*4))}
function renderCalendarHistory(days=365){
  const data=contributionData(days),max=Math.max(1,...data.map(x=>x.count)),first=fromKey(data[0].date),leading=(first.getDay()+6)%7,total=leading+data.length,weeks=Math.ceil(total/7),cells=Array.from({length:weeks*7},()=>null);
  data.forEach((item,i)=>cells[leading+i]=item);
  const monthLabels=[];let lastMonth=-1;
  for(let i=0;i<cells.length;i+=7){const d=cells[i]?.date?fromKey(cells[i].date):null;if(d&&d.getMonth()!==lastMonth){monthLabels.push({week:i/7,label:d.toLocaleDateString('en-US',{month:'short'}),offset:i/7});lastMonth=d.getMonth()}}
  const weekdays=['Mon','','Wed','','Fri','','Sun'];
  return `<div class="year-heatmap-wrap"><div class="year-heatmap-weekdays">${weekdays.map(x=>`<span>${x}</span>`).join('')}</div><div class="year-heatmap-body"><div class="year-heatmap-months" style="grid-template-columns:repeat(${weeks},18px)">${Array.from({length:weeks},(_,i)=>{const found=monthLabels.find(x=>x.offset===i);return `<span>${found?esc(found.label):''}</span>`}).join('')}</div><div class="year-heatmap-grid" style="grid-template-columns:repeat(${weeks},18px)">${cells.map(x=>x?`<button class="year-heat-cell level-${heatLevel(x.count,max)} ${x.date===selectedDate?'is-selected':''}" title="${x.count} actions · ${x.date}" data-cal-day="${x.date}"></button>`:`<span class="year-heat-cell blank"></span>`).join('')}</div></div></div><div class="heat-legend"><span>Less</span>${[0,1,2,3,4].map(i=>`<i class="level-${i}"></i>`).join('')}<span>More</span><b>${data.reduce((n,x)=>n+x.count,0)} actions</b></div>`;
}
function calendarDaySnapshot(k){
  const tasks=plannedFor(k),completedTasks=tasks.filter(t=>taskDone(t,k)),comps=completionsOn(k),focusMinutes=state.focusSessions.filter(x=>x.date===k).reduce((n,x)=>n+Math.max(0,Number(x.minutes)||0),0),habitHits=comps.filter(x=>x.kind==='habit').length;
  return{tasks,completedTasks,comps,focusMinutes,habitHits};
}
function renderCalendar(el){
 const y=calendarDate.getFullYear(),m=calendarDate.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),off=(first.getDay()+6)%7;let cells="";
 for(let i=0;i<off;i++)cells+=`<div class="calendar-day empty-day"></div>`;
 for(let d=1;d<=days;d++){const k=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,snap=calendarDaySnapshot(k),done=snap.completedTasks.length,planned=snap.tasks.length,actions=snap.comps.length;cells+=`<button class="calendar-day ${k===today()?'today-day':''} ${k===selectedDate?'selected-day':''}" data-cal-day="${k}"><div class="calendar-day-top"><b>${d}</b></div><div class="calendar-day-footer"><span class="activity-dot level-${heatLevel(actions,6)}"></span>${done?`<span class="day-count">${done}/${planned}</span>`:planned?`<span class="day-count">${planned}</span>`:`<span class="day-count muted">—</span>`}</div></button>`;}
 const k=selectedDate||today(),snap=calendarDaySnapshot(k),dayDate=fromKey(k),selectedName=dayDate.toLocaleDateString('en-US',{weekday:'long',day:'numeric',month:'long'}),goals=state.goals||[];
 const goalRows=goals.map(g=>`<article class="goal-mini-row-v53"><div><b>${esc(g.title)}</b><small>${goalProgress(g)}/${g.target} days</small></div><button class="icon-btn danger-icon" data-delete-goal="${esc(g.id)}" title="Delete goal">×</button></article>`).join("");
 const taskRows=snap.tasks.map(t=>taskCard(t,k)).join("");
 el.innerHTML=`<div class="calendar-page-v53 calendar-page-fit"><header class="calendar-header-v53"><div><span class="eyebrow">CALENDAR</span><h2>Calendar</h2></div><div class="calendar-header-actions"><button class="ghost" id="todayCalendar">Today</button><button class="primary" id="addTaskCalendar">＋ Task</button></div></header>
 <section class="calendar-core-v53 calendar-core-fit"><div class="calendar-overview-main calendar-main-v53"><div class="calendar-toolbar compact-toolbar"><button class="ghost" id="prevMonth" aria-label="Previous month">←</button><h3>${calendarDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h3><button class="ghost" id="nextMonth" aria-label="Next month">→</button></div><div class="calendar weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<b>${x}</b>`).join('')}</div><div class="calendar grid">${cells}</div></div>
 <aside class="calendar-day-panel calendar-day-panel-v53"><div class="calendar-panel-head"><div><span class="section-kicker">SELECTED DAY</span><h3>${selectedName}</h3></div><span class="day-activity-badge">${snap.comps.length}</span></div><div class="calendar-day-stats calendar-day-stats-v53"><div><b>${snap.completedTasks.length}/${snap.tasks.length}</b><span>Tasks</span></div><div><b>${formatDuration(snap.focusMinutes)}</b><span>Focus</span></div><div><b>${snap.habitHits}</b><span>Habits</span></div></div><div class="calendar-panel-section calendar-schedule-v53"><div class="section-head"><h4>Schedule</h4></div><div class="task-list compact-task-list calendar-schedule-scroll">${taskRows||'<div class="empty">Nothing scheduled</div>'}</div></div></aside></section>
 <div class="calendar-bottom-grid"><section class="calendar-history-card calendar-history-v25"><div class="calendar-history-head"><h3>Activity</h3><div class="calendar-range-switch"><button class="ghost ${calendarHistoryDays===30?'active-range':''}" data-history-days="30">30D</button><button class="ghost ${calendarHistoryDays===90?'active-range':''}" data-history-days="90">90D</button><button class="ghost ${calendarHistoryDays===180?'active-range':''}" data-history-days="180">180D</button><button class="ghost ${calendarHistoryDays===365?'active-range':''}" data-history-days="365">1Y</button></div></div><div class="calendar-history-scroll">${renderCalendarHistory(calendarHistoryDays)}</div></section>
 <section class="calendar-goals-strip calendar-goals-visible-v25"><div class="section-head"><h3>Goals</h3><button class="ghost" id="addGoal">＋</button></div><div class="calendar-goals-scroll"><div class="calendar-goals-grid">${goalRows||'<div class="empty">No goals yet</div>'}</div></div></section></div></div>`;
 bindGlobal();$$('[data-cal-day]').forEach(b=>b.onclick=()=>{selectedDate=b.dataset.calDay;calendarDate=fromKey(selectedDate);renderView('calendar')});
 $$('[data-history-days]').forEach(b=>b.onclick=()=>{calendarHistoryDays=Number(b.dataset.historyDays)||90;renderView('calendar')});
 $('#prevMonth')?.addEventListener('click',()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderView('calendar')});$('#nextMonth')?.addEventListener('click',()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderView('calendar')});
 $('#todayCalendar')?.addEventListener('click',()=>{calendarDate=new Date();selectedDate=today();renderView('calendar')});$('#addTaskCalendar')?.addEventListener('click',()=>openTaskForm(null,{dueDate:k}));$('#addGoal')?.addEventListener('click',openGoalForm);
 $$('[data-delete-goal]').forEach(b=>b.addEventListener('click',async()=>{if(confirm('Delete this goal?')){const r=await action('deleteGoal',{id:b.dataset.deleteGoal});if(r)renderView('calendar')}}));
}
function openGoalForm(){openModal(`<div class="modal-head"><div><span class="badge">GOAL</span><h3>New goal</h3></div><button class="icon-btn" data-close-modal>×</button></div><form id="goalForm" class="modal-form"><label>Goal name<input name="title" placeholder="Example: 30 days of discipline" required></label><textarea name="description" placeholder="What does this goal mean to you?"></textarea><div class="form-grid-2"><label>Days<input name="target" type="number" min="1" value="30"></label><label>Scope<select name="scope"><option value="all">All activity</option><option value="task">Tasks</option><option value="habit">Habits</option><option value="focus">Focus</option></select></label></div><button class="primary">Create goal</button></form>`);$("#goalForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const r=await action("addGoal",{item:{title:String(f.get("title")),description:String(f.get("description")),target:Number(f.get("target"))||30,scope:String(f.get("scope"))}});if(r){closeModal();renderShell();toast("Goal created","success")}})}

const disciplineMantras={
  general:[
    "Build the person who can be trusted with the life you want.",
    "Discipline is a daily vote for your future self.",
    "Train the standard. Keep the promise. Repeat.",
    "Small standards become a strong identity.",
    "Do the work, especially when nobody is watching."
  ],
  calendar:[
    "Plan the day. Protect the important work.",
    "A clear day creates a clear mind.",
    "Decide once. Execute without negotiation.",
    "Your calendar is where intention becomes action.",
    "Win the day in small, deliberate moves."
  ]
};
function dailyMantra(kind){const list=disciplineMantras[kind]||disciplineMantras.general;const seed=Number(String(today()).replace(/-/g,''))||0;return list[seed%list.length];}
const ITSUKI_DEFAULT_CUTOUT="assets/itsuki/itsuki-pet.png";
function renderAnalytics(el){
  const days=[7,30,90].includes(Number(progressRange))?Number(progressRange):30;progressRange=days;
  const cur=progressStats(days), prev=progressStats(days,addDays(cur.start,-1));
  const taskRate=cur.tasksRate==null?'—':`${Math.round(cur.tasksRate)}%`;
  const habitRate=cur.habitRate==null?'—':`${Math.round(cur.habitRate)}%`;
  const bestDay=cur.bestDay.actions?`${fromKey(cur.bestDay.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:'—';
  const biggest=Math.max(cur.tasksRate??0,cur.habitRate??0);
  const health=biggest>=85?'Consistent':biggest>=65?'Building':'Starting';
  const deltaFocus=progressDeltaValue(cur.focusMinutes,prev.focusMinutes,'min');
  const deltaTasks=progressDeltaPct(cur.tasksRate,prev.tasksRate);
  const deltaHabits=progressDeltaPct(cur.habitRate,prev.habitRate);
  const rangeLabel=`vs previous ${days} days`;
  el.innerHTML=`<div class="progress-v2">
    <header class="progress-v2-head">
      <div><span class="section-kicker">AURESTAR / WORKSPACE</span><h2>Progress</h2><p>One page for the numbers that actually show whether your routine is moving forward.</p></div>
      <div class="progress-range" role="tablist" aria-label="Progress range">${[7,30,90].map(n=>`<button type="button" data-progress-range="${n}" class="${n===days?'active':''}">${n}D</button>`).join('')}</div>
    </header>

    <section class="progress-hero-card">
      <div class="progress-hero-main"><div class="progress-health-badge">${health}</div><h3>${cur.activeDays}<span> active days</span></h3><p>${cur.doneTasks}/${cur.scheduled||0} scheduled tasks completed · ${formatDuration(cur.focusMinutes)} focused</p></div>
      <div class="progress-hero-side"><span>Active days</span><strong>${cur.activeDays}<small> / ${days}</small></strong><button class="ghost" data-nav="calendar">View activity →</button></div>
    </section>

    <section class="progress-metrics">
      <article class="progress-metric"><div class="progress-metric-top"><span>Execution</span><b>${taskRate}</b></div><div class="progress-mini-track"><i style="width:${Math.max(0,Math.min(100,cur.tasksRate||0))}%"></i></div><small>${cur.doneTasks}/${cur.scheduled||0} tasks · ${deltaTasks} ${rangeLabel}</small></article>
      <article class="progress-metric"><div class="progress-metric-top"><span>Focus</span><b>${formatDuration(cur.focusMinutes)}</b></div><div class="progress-metric-number">${cur.focusSessions} sessions</div><small>${deltaFocus} ${rangeLabel}</small></article>
      <article class="progress-metric"><div class="progress-metric-top"><span>Consistency</span><b>${habitRate}</b></div><div class="progress-mini-track"><i style="width:${Math.max(0,Math.min(100,cur.habitRate||0))}%"></i></div><small>${cur.habitDoneCount}/${cur.habitPossible||0} habit-days · ${deltaHabits} ${rangeLabel}</small></article>
      <article class="progress-metric"><div class="progress-metric-top"><span>Active days</span><b>${cur.activeDays}/${days}</b></div><div class="progress-mini-track"><i style="width:${Math.min(100,cur.activeDays/days*100)}%"></i></div><small>Days with recorded activity ${rangeLabel}</small></article>
    </section>

    <section class="progress-panel progress-trend-panel">
      <div class="progress-panel-head"><div><span class="section-kicker">ACTIVITY</span><h3>Completed actions</h3><p>Each point is a completed task, habit check-in, or focus session.</p></div><div class="progress-highlight"><strong>${cur.bestDay.actions}</strong><span>best day · ${bestDay}</span></div></div>
      ${progressChartSvg(cur.daily)}
      <div class="progress-axis"><span>${cur.start}</span><span>${cur.end}</span></div>
    </section>

    <section class="progress-bottom-grid">
      <article class="progress-panel progress-breakdown"><div class="progress-panel-head"><div><span class="section-kicker">BREAKDOWN</span><h3>What made the progress</h3></div></div><div class="progress-break-row"><span class="progress-break-icon">✓</span><div><b>Tasks</b><small>${cur.doneTasks} completed</small></div><strong>${cur.tasksRate==null?'—':`${Math.round(cur.tasksRate)}%`}</strong></div><div class="progress-break-row"><span class="progress-break-icon">◉</span><div><b>Focus</b><small>${cur.focusSessions} sessions</small></div><strong>${formatDuration(cur.focusMinutes)}</strong></div><div class="progress-break-row"><span class="progress-break-icon">○</span><div><b>Habits</b><small>${cur.habitDoneCount} check-ins</small></div><strong>${cur.habitRate==null?'—':`${Math.round(cur.habitRate)}%`}</strong></div></article>
      <article class="progress-panel progress-next"><div class="progress-panel-head"><div><span class="section-kicker">NEXT SIGNAL</span><h3>Keep the system simple</h3></div></div><div class="progress-next-main"><div class="progress-next-value">${cur.activeDays}/${days}</div><div><b>days with recorded progress</b><p>Review Tasks and Habits for daily execution, and use Focus to protect time for deep work.</p></div></div><div class="progress-next-links"><button class="ghost" data-nav="today">Today →</button><button class="ghost" data-nav="focus">Focus →</button></div></article>
    </section>
  </div>`;
  bindGlobal();
  $$('[data-progress-range]').forEach(b=>b.addEventListener('click',()=>{progressRange=Number(b.dataset.progressRange)||30;renderView('analytics')}));
}

function dayChecks(selected){const days=selected||[],labels=localizedWeekdays();return [1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" name="weekday" value="${d}" ${days.includes(d)?"checked":""}><span>${labels[d]}</span></label>`).join("")}






function openBackupHandleDBClient(){return new Promise((resolve,reject)=>{const r=indexedDB.open("ascended-backup",1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains("handles"))r.result.createObjectStore("handles")};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error("Unable to open backup storage"));});}
async function saveBackupDirectoryHandleClient(handle){const db=await openBackupHandleDBClient();return await new Promise((resolve,reject)=>{const tx=db.transaction("handles","readwrite");tx.objectStore("handles").put(handle,"directory");tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error("Unable to save backup folder"));});}

function renderSettings(el){
 el.innerHTML=`<div class="page-intro"><div><span class="badge">SYSTEM</span><h2>Settings</h2></div></div><div class="settings-grid settings-grid-55">
 <section class="settings-card"><h3>Notifications</h3><p class="muted settings-description">Choose which reminders and sounds Aurestar can use.</p><label class="switch-row"><span>System notifications</span><input id="notify" type="checkbox" ${state.settings.notifications?"checked":""}></label><label class="switch-row"><span>Task reminders</span><input id="taskReminders" type="checkbox" ${state.settings.taskReminders?"checked":""}></label><label class="switch-row"><span>Alarm sound</span><input id="alarmSound" type="checkbox" ${state.settings.alarmSound?"checked":""}></label><label>Daily reminder<input id="dailyReminder" type="time" value="${esc(state.settings.dailyReminder||"08:00")}"></label><label>Alarm volume<input id="alarmVolume" type="range" min="0.1" max="1" step="0.05" value="${Number(state.settings.alarmVolume)||1}"></label><label>Alarm duration<input id="alarmDuration" type="number" min="4" max="30" value="${Number(state.settings.alarmDuration)||12}"></label><div class="settings-buttons"><button class="primary" id="saveSettings">Save</button><button class="ghost" id="testAlarm">Test alarm</button></div></section>
 <section class="settings-card privacy-settings-card"><div class="settings-card-head"><h3>Privacy & Companion</h3><span class="settings-pill">PRIVATE</span></div><p class="muted settings-description">Choose whether the desktop companion and notifications can appear.</p><label class="switch-row"><span>Discreet mode</span><input id="privacyMode" type="checkbox" ${state.settings.privacyMode===true?"checked":""}></label>${state.settings.privacyMode===true?'':`<label class="switch-row"><span>Floating companion</span><input id="itsukiCompanionEnabled" type="checkbox" ${state.settings.itsukiCompanionEnabled!==false?"checked":""}></label><label class="switch-row"><span>Companion notifications</span><input id="itsukiCompanionNotifications" type="checkbox" ${state.settings.itsukiCompanionNotifications!==false?"checked":""}></label>`}</section>
 <section class="settings-card"><div class="settings-card-head"><h3>Focus</h3></div><p class="muted settings-description">Set session lengths and your daily focus target.</p><label>Focus interval (minutes)<input id="focusWorkInterval" type="number" min="15" max="120" value="${Number(state.settings.focusPreset)||25}"></label><label>Short break (minutes)<input id="focusShortBreak" type="number" min="1" max="30" value="${Number(state.settings.focusShortBreak)||5}"></label><label>Long break (minutes)<input id="focusLongBreak" type="number" min="1" max="60" value="${Number(state.settings.focusLongBreak)||15}"></label><label>Long break every (rounds)<input id="focusLongBreakEvery" type="number" min="1" max="12" value="${Number(state.settings.focusLongBreakEvery)||4}"></label><label>Daily focus goal (minutes)<input id="dailyFocusGoalMin" type="number" min="15" max="600" value="${Number(state.settings.dailyFocusGoalMin)||120}"></label></section>
 <section class="settings-card"><div class="settings-card-head"><h3>Data & backup</h3></div><p class="muted settings-description">Protect your local data or move it to another device.</p><label class="switch-row"><span>Automatic daily backup</span><input id="autoBackup" type="checkbox" ${state.settings.autoBackup!==false?"checked":""}></label><label>Backup time<input id="backupTime" type="time" value="${esc(state.settings.backupTime||"23:30")}"></label><div class="settings-buttons"><button class="ghost" id="backupNow">Backup now</button><button class="ghost" id="exportData">Export JSON</button><button class="primary" id="importTasksSettings">Import tasks</button><label class="ghost file-button">Restore backup<input id="importData" type="file" accept="application/json" hidden></label></div><button class="danger" id="resetData">Clear activity history</button></section>
 <section class="settings-card"><h3>Application</h3><p class="muted settings-description">Details about this Aurestar installation.</p><div class="info-row"><span>App</span><b>Aurestar Desktop</b></div><div class="info-row"><span>Engine</span><b>Electron</b></div><div class="info-row"><span>Storage</span><b>Local JSON</b></div><div class="info-row"><span>Website blocking</span><b>Not active in desktop mode</b></div><p class="muted">The app does not change Windows network or browser settings. Website blocking needs a browser integration that is not included in this build.</p></section></div>`;
 bindGlobal();
 $("#saveSettings")?.addEventListener("click",async()=>{
  const privacyMode=$("#privacyMode")?.checked??state.settings.privacyMode;
  const settings={privacyMode,itsukiCompanionEnabled:privacyMode?false:($("#itsukiCompanionEnabled")?.checked??state.settings.itsukiCompanionEnabled!==false),itsukiCompanionNotifications:privacyMode?false:($("#itsukiCompanionNotifications")?.checked??state.settings.itsukiCompanionNotifications!==false),
   notifications:privacyMode?false:($("#notify")?.checked??state.settings.notifications),taskReminders:privacyMode?false:($("#taskReminders")?.checked??state.settings.taskReminders),alarmSound:privacyMode?false:($("#alarmSound")?.checked??state.settings.alarmSound),
   dailyReminder:$("#dailyReminder")?.value||"08:00",alarmVolume:Number($("#alarmVolume")?.value)||1,alarmDuration:Math.min(30,Math.max(4,Number($("#alarmDuration")?.value)||12)),
   autoBackup:$("#autoBackup")?.checked??true,backupTime:$("#backupTime")?.value||"23:30",dailyFocusGoalMin:Math.min(600,Math.max(15,Number($("#dailyFocusGoalMin")?.value)||120)),
   focusPreset:Math.min(120,Math.max(15,Number($("#focusWorkInterval")?.value)||25)),focusShortBreak:Math.min(30,Math.max(1,Number($("#focusShortBreak")?.value)||5)),
   focusLongBreak:Math.min(60,Math.max(1,Number($("#focusLongBreak")?.value)||15)),focusLongBreakEvery:Math.min(12,Math.max(1,Number($("#focusLongBreakEvery")?.value)||4)),
   focusCountdown:true,focusAutoCycle:false,focusAutoBreak:false,focusAutoStart:false,focusBanBreak:false,focusWidgetEnabled:state.settings.focusWidgetEnabled!==false,language:"en"};
  const r=await action("saveSettings",{settings});if(r){toast("Settings saved","success");renderShell();}
 });
 $("#testAlarm")?.addEventListener("click",async()=>{const r=await action("testAlarm");if(r)toast("Alarm tested","success")});
 $("#backupNow")?.addEventListener("click",async()=>{const r=await action("backupNow");if(r)toast("Backup saved","success")});
 $("#exportData")?.addEventListener("click",()=>exportData());
 $("#importTasksSettings")?.addEventListener("click",openTaskImportPicker);
 $("#importData")?.addEventListener("change",importData);
 $("#resetData")?.addEventListener("click",resetData);
}
function exportData(){const backup={...state};delete backup.itsukiPasswordRecord;const a=document.createElement("a"),u=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}));a.href=u;a.download=`aurestar-itsuki-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function splitCSVLine(line){const out=[];let cur="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;}else q=!q;}else if(ch===','&&!q){out.push(cur);cur="";}else cur+=ch;}out.push(cur);return out.map(x=>x.trim());}
function csvRows(text){const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(!lines.length)return[];const headers=splitCSVLine(lines[0]).map(x=>x.toLowerCase().replace(/\s+/g,""));return lines.slice(1).map(line=>{const vals=splitCSVLine(line);const row={};headers.forEach((h,i)=>row[h]=vals[i]||"");return row;});}
function parseImportedTasks(name,text){const ext=name.toLowerCase().split('.').pop();const mapWeekdays=value=>String(value||"").split(/[|,;\s]+/).map(x=>x.trim().toUpperCase()).filter(Boolean).map(x=>({CN:0,"T2":1,"T3":2,"T4":3,"T5":4,"T6":5,"T7":6,SU:0,MO:1,TU:2,WE:3,TH:4,FR:5,SA:6}[x])).filter(Number.isInteger);const mapRepeat=(value,days,date)=>{const raw=String(value||"").trim().toLowerCase();let type=raw.includes("weekly")||raw.includes("week")||raw==="weekly"?"weekly":raw.includes("daily")||raw.includes("day")||raw==="daily"?"daily":"none";const parsed=mapWeekdays(days);if(type==="none"&&parsed.length)type="weekly";return {type,weekdays:[...new Set(parsed)],startDate:type==="none"?"":String(date||dateKey()).replace(/\//g,"-")};};const parseWorkoutField=value=>{if(value&&typeof value==="object")return value;try{const parsed=JSON.parse(String(value||""));return parsed&&typeof parsed==="object"?parsed:null}catch{return null}};const mapRow=r=>{const title=r.title||r.taskname||r.tasktitle||r.name||r.task||r.content||r.summary||r.subject||r.text||r.todo||"";let date=r.duedate||r.date||r.deadline||r.startdate||"";let time=r.duetime||r.time||"";if(r.datetime&&!date){const m=String(r.datetime).match(/(\d{4}[-/]\d{2}[-/]\d{2})[ T](\d{1,2}:\d{2})/);if(m){date=m[1].replace(/\//g,"-");time=m[2];}}const p=String(r.priority||r.pri||"medium").toLowerCase();const priority=p.includes("urgent")||p.includes("critical")?"urgent":p.includes("high")||p.includes("1")?"high":p.includes("low")?"low":"medium";const repeat=mapRepeat(r.repeat||r.recurrence||r.repeattype,r.weekdays||r.days,date);const workoutConfig=parseWorkoutField(r.workoutconfig||r.gymtimer||r.gymconfig);return {title:String(title).trim(),dueDate:repeat.type==="none"?String(date||"").replace(/\//g,"-"):"",dueTime:String(time||""),priority,listId:String(r.listid||r.list||r.project||r.category||"inbox").trim(),estimate:Number(r.estimate||r.duration||25)||25,notes:String(r.notes||r.note||r.description||"").trim(),repeat,reminderEnabled:false,reminderAt:null,checklist:[],...(workoutConfig?{workoutConfig}: {})};};
  if(ext==="json"){const d=JSON.parse(text);const arr=Array.isArray(d)?d:(Array.isArray(d.tasks)?d.tasks:Array.isArray(d.items)?d.items:[]);if(!arr.length)throw Error("JSON does not contain a task list");return arr.map(mapRow).filter(x=>x.title);}
  if(ext==="csv")return csvRows(text).map(mapRow).filter(x=>x.title);
  if(ext==="txt")return text.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(title=>({title,listId:"inbox",priority:"medium",estimate:25,dueDate:"",dueTime:"",repeat:{type:"none",weekdays:[],startDate:""},notes:"",reminderEnabled:false,reminderAt:null,checklist:[]}));
  if(ext==="ics"){const rows=[];for(const block of text.split(/BEGIN:VEVENT/i).slice(1)){const summary=(block.match(/(?:^|\n)SUMMARY(?:;[^:]*)?:([^\n\r]*)/i)||[])[1];if(!summary)continue;const dt=(block.match(/(?:^|\n)DTSTART(?:;VALUE=DATE)?(?:;TZID=[^:]*)?:([^\n\r]*)/i)||[])[1]||"";let date="",time="";if(/^\d{8}/.test(dt)){date=`${dt.slice(0,4)}-${dt.slice(4,6)}-${dt.slice(6,8)}`;if(dt.length>=15)time=`${dt.slice(9,11)}:${dt.slice(11,13)}`;}rows.push({title:summary.trim(),listId:"inbox",priority:"medium",estimate:25,dueDate:date,dueTime:time,repeat:{type:"none",weekdays:[],startDate:""},notes:"",reminderEnabled:false,reminderAt:null,checklist:[]});}return rows;}
  throw Error("Unsupported format. Use JSON, CSV, TXT, or ICS.");}
function openTaskImportPicker(){const input=document.createElement("input");input.type="file";input.accept=".json,.csv,.txt,.ics,application/json,text/csv,text/plain,text/calendar";input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{const items=parseImportedTasks(f.name,await f.text());if(!items.length)throw Error("No valid tasks found");showTaskImportPreview(f.name,items);}catch(err){toast(err.message||"Unable to read file","error")}};input.click();}
function showTaskImportPreview(filename,items){openModal(`<div class="modal-head"><div><span class="badge">IMPORT TASKS</span><h3>Import ${items.length} tasks</h3><small>${esc(filename)}</small></div><button class="icon-btn" data-close-modal>×</button></div><label>Add to list<select id="importList">${state.lists.map(l=>`<option value="${esc(l.id)}">${esc(l.icon)} ${esc(l.name)}</option>`).join("")}</select></label><div class="import-preview">${items.slice(0,12).map((t,i)=>`<div><span>${i+1}</span><b>${esc(t.title)}</b><small>${esc(t.dueDate||"Inbox")} ${esc(t.dueTime||"")} · ${priorityLabel[t.priority]}</small></div>`).join("")}${items.length>12?`<p class="muted">… and ${items.length-12} more tasks</p>`:""}</div><div class="modal-actions"><button class="ghost" data-close-modal>Cancel</button><button class="primary" id="confirmImportTasks">Import ${items.length} tasks</button></div>`);$("#confirmImportTasks")?.addEventListener("click",async()=>{const listId=$("#importList")?.value||"inbox";const payload=items.map(t=>({...t,listId}));const r=await action("importTasks",{items:payload});if(r){closeModal();renderShell();toast(`Imported ${r.result?.import?.imported||payload.length} task`+(r.result?.import?.failed?` · errors ${r.result.import.failed}`:""),"success")}});}
function tasksForExport(){
  const match=t=>!searchQuery||`${t.title} ${t.notes||""} ${listName(t.listId)}`.toLowerCase().includes(searchQuery);
  if(taskMode==="inbox")return state.tasks.filter(t=>!t.archived&&t.listId==="inbox"&&match(t));
  if(taskMode==="list")return state.tasks.filter(t=>!t.archived&&t.listId===selectedList&&match(t));
  if(taskMode==="completed")return state.tasks.filter(t=>t.completedDates?.length&&match(t));
  if(taskMode==="tomorrow")return plannedFor(addDays(today(),1)).filter(match);
  if(taskMode==="next7"){const seen=new Map();for(let i=0;i<7;i++)for(const t of plannedFor(addDays(today(),i)))if(match(t))seen.set(t.id,t);return [...seen.values()]}
  if(taskMode==="today")return plannedFor(today()).filter(match);
  if(taskMode==="all")return state.tasks.filter(t=>!t.archived&&match(t));
  return state.tasks.filter(t=>!t.archived&&match(t));
}
function downloadText(filename,mime,text){const a=document.createElement("a"),u=URL.createObjectURL(new Blob([text],{type:mime}));a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
function csvCell(v){return `"${String(v??"").replace(/"/g,'""')}"`}
function exportTasksAs(format){const tasks=tasksForExport();if(!tasks.length){toast("No tasks to export","error");return}const stamp=today();if(format==="json"){downloadText(`aurestar-tasks-${stamp}.json`,"application/json",JSON.stringify(tasks,null,2));return;}if(format==="csv"){const head=["Title","List","Priority","DueDate","DueTime","Repeat","Weekdays","Estimate","Notes","CompletedDates","WorkoutConfig"];const rows=tasks.map(t=>[t.title,listName(t.listId),t.priority||"medium",t.dueDate||"",t.dueTime||"",t.repeat?.type||"none",(t.repeat?.weekdays||[]).map(d=>["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join("|"),t.estimate||25,t.notes||"",(t.completedDates||[]).join("|"),t.workoutConfig?.enabled?JSON.stringify(t.workoutConfig):""]);downloadText(`aurestar-tasks-${stamp}.csv`,"text/csv;charset=utf-8","\uFEFF"+[head,...rows].map(r=>r.map(csvCell).join(",")).join("\n"));return;}const dayMap={0:"SU",1:"MO",2:"TU",3:"WE",4:"TH",5:"FR",6:"SA"};const escICS=v=>String(v||"").replace(/[\\;,\n]/g,c=>({"\\":"\\\\",",":"\\,",";":"\\;","\n":"\\n"}[c]));let ev=[];for(const t of tasks){const r=t.repeat?.type||"none";let date=t.dueDate||t.repeat?.startDate||"";if(!date)continue;const time=t.dueTime||"09:00";const dt=`${date.replace(/-/g,"")}T${time.replace(":","")}00`;let rr="";if(r==="daily")rr="RRULE:FREQ=DAILY";if(r==="weekly"){const days=(t.repeat?.weekdays||[]).map(Number).map(d=>dayMap[d]).filter(Boolean);if(days.length)rr=`RRULE:FREQ=WEEKLY;BYDAY=${days.join(",")}`}ev.push(["BEGIN:VEVENT",`UID:${escICS(t.id)}@ascended`,`DTSTART:${dt}`,`SUMMARY:${escICS(t.title)}`,t.notes?`DESCRIPTION:${escICS(t.notes)}`:"",rr,"END:VEVENT"].filter(Boolean).join("\r\n"));}const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Aurestar//Task Export//EN",...ev,"END:VCALENDAR"].join("\r\n");downloadText(`aurestar-tasks-${stamp}.ics`,"text/calendar;charset=utf-8",ics)}
function openTaskExportMenu(){openModal(`<div class="modal-head"><div><span class="badge">EXPORT TASKS</span><h3>Choose format</h3></div><button class="icon-btn" data-close-modal>×</button></div><p class="muted">Export ${tasksForExport().length} visible tasks.</p><div class="export-format-grid"><button class="ghost export-format" data-export-format="csv"><b>CSV</b><small>Task table, easy to open in Excel.</small></button><button class="ghost export-format" data-export-format="json"><b>JSON</b><small>Full data for backup/import.</small></button><button class="ghost export-format" data-export-format="ics"><b>ICS</b><small>Calendar and time data.</small></button></div></div>`);$$('[data-export-format]').forEach(b=>b.onclick=()=>{exportTasksAs(b.dataset.exportFormat);closeModal()})}
function downloadTaskTemplate(){const csv=["Title,DueDate,DueTime,Priority,List,Estimate,Notes","Math study,2026-10-05,19:00,high,Inbox,45,Review chapter 3","Training,2026-10-06,18:00,medium,Inbox,60,30 min cardio"].join("\n");const a=document.createElement("a"),u=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.href=u;a.download="aurestar-task-template.csv";a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
async function importData(e){const f=e.target.files?.[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!d.profile||!Array.isArray(d.tasks))throw Error("Backup format is not valid for Aurestar");const r=await action("saveAll",{data:d});if(r){toast("Backup restored","success");renderShell()}}catch(err){toast(err.message||"Unable to restore backup","error")}e.target.value="";}
async function resetData(){if(!confirm("Clear activity history while keeping your Tasks and Habits?"))return;const keepTasks=state.tasks,keepHabits=state.habits;const r=await action("saveAll",{data:{...state,tasks:keepTasks,habits:keepHabits,goals:[],focusSessions:[],completions:[],reviews:[]}});if(r){toast("Activity history cleared — Tasks and Habits kept","success");renderShell()}}

function openTaskMenu(id){
 const task=state.tasks.find(x=>String(x.id)===String(id));if(!task)return;
 openModal(`<div class="modal-head"><h3>${esc(task.title)}</h3><button class="icon-btn" data-close-modal>×</button></div><div class="task-menu-actions"><button type="button" class="ghost" id="taskMenuEdit">Edit task</button><button type="button" class="ghost" id="taskMenuFocus">Focus on task</button><button type="button" class="danger" id="taskMenuDelete">Delete task</button></div>`);
 $("#taskMenuEdit")?.addEventListener("click",()=>{closeModal();openTaskForm(task.id)});
 $("#taskMenuFocus")?.addEventListener("click",async()=>{closeModal();const r=await action("focusSetTask",{taskId:String(task.id)});if(r)navigate("focus")});
 $("#taskMenuDelete")?.addEventListener("click",async()=>{if(!confirm("Delete this task?"))return;const r=await action("deleteTask",{id:task.id});if(r){closeModal();renderShell()}});
}
function bindGlobal(){
  $$(`[data-open-task]`).forEach(card=>card.onclick=e=>{if(e.target.closest("button"))return;openTaskForm(card.dataset.openTask)});
  $$('[data-task-toggle]').forEach(b=>b.onclick=async()=>{const r=await action("toggleTask",{id:b.dataset.taskToggle,date:b.dataset.date});if(r)renderShell()});
  $$('[data-delete-task]').forEach(b=>b.onclick=async()=>{if(confirm("Delete this task?")){const r=await action("deleteTask",{id:b.dataset.deleteTask});if(r)renderShell()}});
  $$('[data-edit-task]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTaskForm(b.dataset.editTask)});
  $$('[data-task-menu]').forEach(b=>b.onclick=e=>{e.stopPropagation();openTaskMenu(b.dataset.taskMenu)});
  $$('[data-focus-task]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const r=await action('focusSetTask',{taskId:b.dataset.focusTask});if(r){window.location.hash='#focus';activeView='focus';renderShell();}});
  $$('[data-gym-task]').forEach(b=>b.onclick=async e=>{e.stopPropagation();await startGymFromTask(b.dataset.gymTask);});
  $$('[data-checklist]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const r=await action("toggleChecklist",{id:b.dataset.checklist,index:Number(b.dataset.index)});if(r)renderShell()});
  $$('[data-habit-toggle]').forEach(b=>b.onclick=async()=>{const r=await action("toggleHabit",{id:b.dataset.habitToggle});if(r)renderShell()});
  $$('[data-edit-habit]').forEach(b=>b.onclick=e=>{e.stopPropagation();openHabitForm(b.dataset.editHabit)});
  $$('[data-delete-habit]').forEach(b=>b.onclick=async()=>{if(confirm("Delete this habit?")){const r=await action("deleteHabit",{id:b.dataset.deleteHabit});if(r)renderShell()}});
  $$('[data-delete-goal]').forEach(b=>b.onclick=async()=>{if(confirm("Delete this goal?")){const r=await action("deleteGoal",{id:b.dataset.deleteGoal});if(r)renderShell()}});
  $$('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
  $$('[data-close-modal]').forEach(b=>b.onclick=closeModal);
}
function openTaskForm(id=null,prefill={}){
  const t=id?state.tasks.find(x=>x.id===id):null,rep=t?.repeat?.type||"none",days=(t?.repeat?.weekdays||[]).map(Number),base=t?.dueDate||t?.repeat?.startDate||prefill?.dueDate||today(),wd=fromKey(base).getDay(),wc=t?.workoutConfig||prefill?.workoutConfig||{};const mode=wc.mode||"reps";
  const circuitLines=(wc.circuit||[]).map(x=>{const spec=x.mode==="reps"?`reps:${Number(x.repsMin)||0}-${Number(x.repsMax)||Number(x.repsMin)||0}`:x.mode==="max"?"max":`time:${Number(x.durationSeconds)||30}`;return `${x.title||"Step"} | ${spec} | rest:${Number(x.restSeconds)||15}`;}).join("\n");
  openModal(`<div class="modal-head"><div><span class="badge">${t?"EDIT":"NEW"} TASK</span><h3>${t?"Edit task":"Create task"}</h3></div><button class="icon-btn" data-close-modal>×</button></div><form id="taskForm" class="modal-form task-form">
    <label>Task<input name="title" value="${esc(t?.title||"")}" placeholder="Example: Push-up" maxlength="120" required></label>
    <div class="form-grid-2"><label>Priority<select name="priority">${Object.entries(priorityLabel).map(([p,l])=>`<option value="${p}" ${(t?.priority||"medium")===p?"selected":""}>${l}</option>`).join("")}</select></label><label>Estimated time<input name="estimate" type="number" min="5" step="5" value="${Number(t?.estimate)||25}"></label></div>
    <div class="form-grid-2"><label>Date<input name="dueDate" type="date" value="${esc(base)}"></label><label>Time<input name="dueTime" type="time" value="${esc(t?.dueTime||"")}"></label></div>
    <div class="repeat-box"><label>Repeat<select id="taskRepeat" name="repeat"><option value="none" ${rep==="none"?"selected":""}>No repeat</option><option value="daily" ${rep==="daily"?"selected":""}>Daily</option><option value="weekly" ${rep==="weekly"?"selected":""}>Weekly</option></select></label><label id="startDateWrap" class="${rep==="none"?"hidden":""}">Repeat starts<input name="startDate" type="date" value="${esc(t?.repeat?.startDate||base)}"></label></div>
    <div id="weekdayWrap" class="weekdays-picker ${rep==="weekly"?"":"hidden"}"><span>Weekdays</span>${[1,2,3,4,5,6,0].map(d=>`<label><input type="checkbox" name="weekday" value="${d}" ${(days.length?days:[wd]).includes(d)?"checked":""}><span>${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]}</span></label>`).join("")}</div>
    <label class="reminder-row"><input name="reminder" type="checkbox" ${t?.reminderEnabled?"checked":""}> Remind me when due</label>
    <label>Checklist<textarea name="checklist" rows="4" placeholder="One step per line…">${esc((t?.checklist||[]).map(x=>x.text||"").join("\n"))}</textarea></label>
    <textarea name="notes" rows="3" placeholder="Notes…">${esc(t?.notes||"")}</textarea>
    <section class="workout-editor-box"><div class="workout-editor-head"><div><span class="section-kicker">GYM TIMER</span><h3>Workout timer settings</h3><p>Optional. This task stays a normal Task and earns normal Task XP once completed.</p></div><label class="switch-row"><span>Enable Gym Timer</span><input id="workoutEnabled" type="checkbox" ${wc.enabled?"checked":""}></label></div>
      <div id="workoutConfigFields" class="workout-config-fields ${wc.enabled?"":"hidden"}"><div class="form-grid-2"><label>Timer type<select id="workoutMode"><option value="reps" ${mode==="reps"?"selected":""}>Reps / Sets</option><option value="time" ${mode==="time"?"selected":""}>Timed set / Sets</option><option value="max" ${mode==="max"?"selected":""}>MAX timer / Sets</option><option value="circuit" ${mode==="circuit"?"selected":""}>Circuit</option></select></label><label>Default rest (seconds)<input id="workoutRest" type="number" min="0" max="600" step="5" value="${Number(wc.restSeconds)||60}"></label></div>
        <div id="workoutSetFields" class="form-grid-3"><label>Sets<input id="workoutSets" type="number" min="1" max="30" value="${Number(wc.sets)||2}"></label><label id="workoutRepMinWrap">Min reps<input id="workoutRepsMin" type="number" min="0" max="999" value="${Number(wc.repsMin)||8}"></label><label id="workoutRepMaxWrap">Max reps<input id="workoutRepsMax" type="number" min="0" max="999" value="${Number(wc.repsMax)||12}"></label></div>
        <div id="workoutTimeFields" class="form-grid-2 ${mode==="time"?"":"hidden"}"><label>Duration (seconds)<input id="workoutDuration" type="number" min="1" max="7200" value="${Number(wc.durationSeconds)||30}"></label><label>Step sound<select id="workoutSound"><option value="1" ${wc.sound!==false?"selected":""}>On</option><option value="0" ${wc.sound===false?"selected":""}>Off</option></select></label></div>
        <div id="workoutMaxFields" class="form-grid-2 ${mode==="max"?"":"hidden"}"><div><label>MAX timer info</label><p class="muted workout-inline-help">Set the number of MAX sets above. Start and finish each set manually.</p></div><label>Step sound<select id="workoutMaxSound"><option value="1" ${wc.sound!==false?"selected":""}>On</option><option value="0" ${wc.sound===false?"selected":""}>Off</option></select></label></div>
        <div id="workoutCircuitFields" class="${mode==="circuit"?"":"hidden"}"><div class="form-grid-2"><label>Rounds<input id="workoutRounds" type="number" min="1" max="30" value="${Number(wc.circuitRounds)||2}"></label><label>Rest between rounds (seconds)<input id="workoutRoundRest" type="number" min="0" max="600" step="5" value="${Number(wc.restBetweenRoundsSeconds)||60}"></label></div><label>Circuit steps<textarea id="workoutCircuitSteps" rows="7" placeholder="Jumping Jacks | time:30 | rest:15\nMasai Jump | time:30 | rest:15\nBurpee | reps:5-8 | rest:15">${esc(circuitLines)}</textarea></label><small class="muted">One line per step: Name | time:30 | rest:15, Name | reps:5-8 | rest:15, or Name | max | rest:15.</small></div>
        <label class="switch-row"><span>Auto-start rest after a completed set / interval</span><input id="workoutAutoRest" type="checkbox" ${wc.autoRest!==false?"checked":""}></label><label class="switch-row"><span>Countdown cue</span><input id="workoutCountdown" type="checkbox" ${wc.countdown!==false?"checked":""}></label>
      </div>
    </section>
    <button class="primary">${t?"Save changes":"Create task"}</button>
  </form>`);
  const updRepeat=()=>{const r=$("#taskRepeat")?.value||"none";$("#weekdayWrap")?.classList.toggle("hidden",r!=="weekly");$("#startDateWrap")?.classList.toggle("hidden",r==="none")};
  const updWorkout=()=>{const on=$("#workoutEnabled")?.checked===true,m=$("#workoutMode")?.value||"reps";$("#workoutConfigFields")?.classList.toggle("hidden",!on);$("#workoutSetFields")?.classList.toggle("hidden",!on||m==="circuit");$("#workoutRepMinWrap")?.classList.toggle("hidden",!on||m!=="reps");$("#workoutRepMaxWrap")?.classList.toggle("hidden",!on||m!=="reps");$("#workoutTimeFields")?.classList.toggle("hidden",!on||m!=="time");$("#workoutMaxFields")?.classList.toggle("hidden",!on||m!=="max");$("#workoutCircuitFields")?.classList.toggle("hidden",!on||m!=="circuit")};
  $("#taskRepeat")?.addEventListener("change",updRepeat);$("#workoutEnabled")?.addEventListener("change",updWorkout);$("#workoutMode")?.addEventListener("change",updWorkout);
  $("#taskForm")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget),rt=String(f.get("repeat")||"none"),days2=f.getAll("weekday").map(Number);if(rt==="weekly"&&!days2.length){toast("Select at least one weekday","error");return}const dueDateRaw=String(f.get("dueDate")||""),startDate=rt==="none"?"":String(f.get("startDate")||dueDateRaw||today()),dueDate=rt==="none"?dueDateRaw:startDate,dueTime=String(f.get("dueTime")||"");let reminderAt=null;if(f.get("reminder")&&rt==="none"&&dueDate&&dueTime)reminderAt=new Date(`${dueDate}T${dueTime}`).getTime();const oldCheck=t?.checklist||[],lines=String(f.get("checklist")||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((text,i)=>({id:oldCheck[i]?.id||`sub_${Date.now().toString(36)}_${i}`,text,done:oldCheck[i]?.text===text?!!oldCheck[i].done:false}));
    const enabled=$("#workoutEnabled")?.checked===true,wm=$("#workoutMode")?.value||"reps";let workoutConfig={enabled,mode:wm,sets:Math.min(30,Math.max(1,Math.floor(Number($("#workoutSets")?.value)||2))),repsMin:Math.max(0,Math.floor(Number($("#workoutRepsMin")?.value)||8)),repsMax:Math.max(0,Math.floor(Number($("#workoutRepsMax")?.value)||12)),durationSeconds:Math.min(7200,Math.max(1,Math.floor(Number($("#workoutDuration")?.value)||30))),restSeconds:Math.min(600,Math.max(0,Math.floor(Number($("#workoutRest")?.value)||60))),restBetweenRoundsSeconds:Math.min(600,Math.max(0,Math.floor(Number($("#workoutRoundRest")?.value)||60))),circuitRounds:Math.min(30,Math.max(1,Math.floor(Number($("#workoutRounds")?.value)||2))),circuit:[],autoRest:$("#workoutAutoRest")?.checked!==false,countdown:$("#workoutCountdown")?.checked!==false,sound:wm==="time"?$("#workoutSound")?.value!=="0":wm==="max"?$("#workoutMaxSound")?.value!=="0":true};if(wm==="circuit"){workoutConfig.circuit=parseWorkoutCircuitText(String($("#workoutCircuitSteps")?.value||""));if(!workoutConfig.circuit.length){toast("Add at least one circuit step","error");return;}}if(workoutConfig.repsMax<workoutConfig.repsMin)workoutConfig.repsMax=workoutConfig.repsMin;if(!enabled)workoutConfig={enabled:false};
    const item={id:t?.id,title:String(f.get("title")||"").trim(),listId:t?.listId||"inbox",priority:String(f.get("priority")||"medium"),estimate:Number(f.get("estimate"))||25,dueDate,dueTime,repeat:{type:rt,weekdays:days2,startDate},reminderAt,reminderEnabled:!!f.get("reminder"),notes:String(f.get("notes")||"").trim(),checklist:lines,workoutConfig};const r=await action(t?"updateTask":"addTask",{item});if(r){closeModal();if(rt!=="none"){taskMode="all";selectedList="all";}renderShell();toast(t?"Task updated":"Task created","success")}});updRepeat();updWorkout();
}
function parseWorkoutCircuitText(text){return String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,i)=>{const parts=line.split("|").map(x=>x.trim()),title=parts[0]||`Step ${i+1}`,spec=parts.find(x=>/^(time|reps|max)\s*:/i.test(x))||"time:30",restPart=parts.find(x=>/^rest\s*:/i.test(x))||"rest:15";let mode="time",durationSeconds=30,repsMin=0,repsMax=0;if(/^max/i.test(spec)){mode="max";}else if(/^reps\s*:/i.test(spec)){mode="reps";const n=spec.replace(/^reps\s*:/i,"").match(/(\d+)(?:\s*[-–]\s*(\d+))?/);repsMin=Number(n?.[1]||0);repsMax=Number(n?.[2]||repsMin);}else{const n=spec.replace(/^time\s*:/i,"").match(/\d+/);durationSeconds=Math.max(1,Number(n?.[0]||30));}const rest=Math.max(0,Number((restPart.match(/\d+/)||[])[0]||15));return {id:`cstep_${i}_${Math.random().toString(36).slice(2,7)}`,title,mode,durationSeconds,repsMin,repsMax,restSeconds:rest,sound:true}})}

function openModal(inner){closeModal();const w=document.createElement("div");w.id="modalRoot";w.className="modal-backdrop";w.innerHTML=`<aside class="modal" role="dialog" aria-modal="true">${inner}</aside>`;document.body.appendChild(w);w.addEventListener("click",e=>{if(e.target===w)closeModal()});localizeDOM(w);bindGlobal();setTimeout(()=>w.querySelector("input,select,textarea")?.focus(),30)}
function closeModal(){$("#modalRoot")?.remove()}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch')?.focus();$('#globalSearch')?.select();}
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='n'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();openTaskForm();}
  if(e.key==='Escape')closeModal();
});

window.addEventListener("hashchange",()=>{const raw=location.hash.replace(/^#/,''),h=raw==="habits"?"tasks":raw;if(viewTitles[h]){activeView=h;if(raw!==h)history.replaceState(null,"",`#${h}`);renderShell()}});
window.addEventListener("beforeunload",()=>{stopSound()});
window.aurestarDesktop?.onNavigate(view=>navigate(view));
window.aurestarDesktop?.onQuickAdd(()=>openTaskForm());
load().catch(e=>{console.error(e);const msg=esc(e?.message||e);document.body.innerHTML=`<div class="fatal-error"><div><span class="badge danger-badge">BOOT ERROR</span><h2>Aurestar failed to start</h2><p>${msg}</p><p class="muted">Restart Aurestar. Your existing local data has been left intact.</p></div></div>`});
