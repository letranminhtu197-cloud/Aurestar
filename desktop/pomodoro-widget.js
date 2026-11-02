let latestState=null,refreshTimer=null,busy=false;
const $=id=>document.getElementById(id);
const send=(type,payload={})=>chrome.runtime.sendMessage({type,...payload});
function formatSeconds(value){const n=Math.max(0,Math.ceil(Number(value)||0));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function render(response){
  if(!response?.ok||!response.result?.focus)return;
  latestState=response.state||latestState;
  const f=response.result.focus,s=latestState?.settings||{};
  const isBreak=f.phase==='break',active=Boolean(f.active),paused=Boolean(f.paused);
  const seconds=Math.max(0,Number(f.remaining)||0);
  const target=Math.max(1,Number(f.roundsTarget)||4),completed=Math.min(target,Math.max(0,Number(f.pomodorosCompleted)||0));
  $('time').textContent=formatSeconds(seconds);
  $('phase').textContent=(isBreak?(f.breakKind==='long'?'LONG BREAK':'SHORT BREAK'):'FOCUS')+' · '+(active?'RUNNING':paused?'PAUSED':'READY');
  $('detail').textContent='Round '+Math.max(1,Math.min(target,completed+(isBreak?0:1)))+' of '+target;
  $('toggle').textContent=active?'Pause':paused?'Resume':isBreak?'Resume break':'Start focus';
  $('reset').textContent=(active||paused)?'Stop':'Reset';
}
async function refresh(){
  if(busy)return;
  try{const response=await send('getFocusState');render(response);}
  catch(error){$('detail').textContent='Could not connect to focus service';console.error(error);}
}
async function act(type,payload={}){
  if(busy)return;busy=true;
  try{
    const response=await send(type,payload);
    if(!response?.ok){$('detail').textContent=response?.error||'Action failed';}
    else render(response);
  }catch(error){$('detail').textContent=String(error?.message||error);}
  finally{busy=false;await refresh();}
}
$('toggle').addEventListener('click',()=>{
  const f=latestState?.focusEngine||{};
  if(f.active){act('focusPause');return;}
  act('focusStart',{mode:latestState?.settings?.focusPreset||25,rounds:f.roundsTarget||4,taskId:f.taskId||''});
});
$('reset').addEventListener('click',()=>{
  const f=latestState?.focusEngine||{};
  act(f.active||f.paused?'focusStop':'focusReset',{mode:latestState?.settings?.focusPreset||25,rounds:f.roundsTarget||4});
});
$('close').addEventListener('click',()=>window.aurestarDesktop.closePomodoroWidget());
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.focusEngine)refresh();});
refresh();
refreshTimer=setInterval(refresh,1000);
window.addEventListener('beforeunload',()=>{if(refreshTimer)clearInterval(refreshTimer);});
