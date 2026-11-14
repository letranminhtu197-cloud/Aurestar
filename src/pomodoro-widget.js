let latestState=null,refreshTimer=null,busy=false,refreshInFlight=false,refreshQueued=false,completionUntil=0;
const $=id=>document.getElementById(id);
const send=(type,payload={})=>chrome.runtime.sendMessage({type,...payload});
const MODES={focus:{label:'FOCUS',kind:'focus'},short:{label:'SHORT',kind:'break'},long:{label:'LONG',kind:'break'}};
function formatSeconds(value){const n=Math.max(0,Math.ceil(Number(value)||0));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function modeFor(f){return f?.phase==='break'?(f.breakKind==='long'?'long':'short'):'focus';}
function modeMinutes(mode,settings={}){return mode==='short'?Math.max(1,Number(settings.focusShortBreak)||5):mode==='long'?Math.max(1,Number(settings.focusLongBreak)||15):Math.max(1,Number(settings.focusPreset)||25);}
function render(response){
  if(!response?.ok||!response.result?.focus)return;
  latestState=response.state||latestState;
  const f=response.result.focus,s=latestState?.settings||{},mode=modeFor(f),active=Boolean(f.active),paused=Boolean(f.paused);
  if(response.result.finished?.finished)completionUntil=Date.now()+2400;
  const seconds=Math.max(0,Number(f.remaining)||0),total=Math.max(1,modeMinutes(mode,s)*60),progress=Math.min(1,Math.max(0,(total-seconds)/total));
  $('time').textContent=formatSeconds(seconds);
  $('ringProgress').style.strokeDashoffset=String(62.83*(1-progress));
  const done=Date.now()<completionUntil;
  $('phase').textContent=done?'DONE':MODES[mode].label;
  $('panel').classList.toggle('running',active);$('panel').classList.toggle('paused',paused);$('panel').classList.toggle('done',done);$('panel').classList.toggle('idle',!active&&!paused&&!done);
  $('detail').textContent=done?'Focus session complete':`${mode==='focus'?'Focus':mode==='short'?'Short break':'Long break'} · ${active?'Running':paused?'Paused':'Ready'}`;
  const target=Math.max(1,Number(f.roundsTarget)||4),completed=Math.min(target,Math.max(0,Number(f.pomodorosCompleted)||0));
  $('detail').textContent+=` · round ${Math.max(1,Math.min(target,completed+(mode==='focus'?1:0)))} of ${target}`;
  for(const [key,element] of [['focus',$('modeFocus')],['short',$('modeShort')],['long',$('modeLong')]])element.setAttribute('aria-pressed',String(key===mode));
  const toggle=$('toggle');toggle.textContent=active?'Ⅱ':'▶';toggle.setAttribute('aria-label',active?'Pause timer':paused?'Resume timer':mode==='focus'?'Start focus':'Start break');toggle.title=active?'Pause':paused?'Resume':'Start';
  $('reset').disabled=busy||(!active&&!paused&&f.phase!=='break');
  document.title=`${formatSeconds(seconds)} · Aurestar`;
}
async function refresh(){
  if(refreshInFlight){refreshQueued=true;return;}
  refreshInFlight=true;
  try{render(await send('getFocusState'));}
  catch(error){$('detail').textContent='Focus is temporarily unavailable';console.error(error);}
  finally{refreshInFlight=false;if(refreshQueued){refreshQueued=false;refresh();}}
}
async function act(type,payload={}){
  if(busy)return null;busy=true;
  document.querySelectorAll('button').forEach(button=>button.disabled=true);
  try{
    const response=await send(type,payload);
    if(!response?.ok){$('detail').textContent=response?.error||'Action failed';return null;}
    render(response);return response;
  }catch(error){$('detail').textContent=String(error?.message||'Action failed');return null;}
  finally{busy=false;document.querySelectorAll('button').forEach(button=>button.disabled=false);await refresh();}
}
async function selectMode(mode){
  const f=latestState?.focusEngine||{},active=Boolean(f.active||f.paused),current=modeFor(f);
  if(current===mode)return;
  if(active&&!window.confirm('Switching modes will end the current timer without recording it. Continue?'))return;
  const response=await act('focusSelectMode',{mode});if(response)completionUntil=0;
}
async function resetMode(){
  const f=latestState?.focusEngine||{},active=Boolean(f.active||f.paused);
  if(!active&&f.phase!=='break')return;
  if(active&&!window.confirm('Reset the current timer?'))return;
  const response=await act('focusSelectMode',{mode:modeFor(f)});if(response)completionUntil=0;
}
$('toggle').addEventListener('click',()=>{
  const f=latestState?.focusEngine||{},settings=latestState?.settings||{};
  if(f.active){act('focusPause');return;}
  act('focusStart',{mode:Number(f.mode)||Number(settings.focusPreset)||25,rounds:f.roundsTarget||4,taskId:f.taskId||''});
});
$('reset').addEventListener('click',resetMode);
$('modeFocus').addEventListener('click',()=>selectMode('focus'));
$('modeShort').addEventListener('click',()=>selectMode('short'));
$('modeLong').addEventListener('click',()=>selectMode('long'));
$('close').addEventListener('click',()=>window.aurestarDesktop.closePomodoroWidget());
const handleStorageChanged=(changes,area)=>{if(area==='local'&&(changes.focusEngine||changes.settings))refresh();};
chrome.storage.onChanged.addListener(handleStorageChanged);
refresh();
refreshTimer=setInterval(refresh,1000);
window.addEventListener('beforeunload',()=>{if(refreshTimer)clearInterval(refreshTimer);chrome.storage.onChanged.removeListener(handleStorageChanged);},{once:true});
