let state = null;
let focusMode = 25;
let timerSeconds = 25 * 60;
let timerHandle = null;
let timerRunning = false;
let selectedTaskId = sessionStorage.getItem('ascended-focus-task') || '';


function sideLocalize(){document.documentElement.lang="en";}

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const localKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => localKey(new Date());
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const send = (type, payload = {}) => new Promise((resolve, reject) => {
  try {
    chrome.runtime.sendMessage({ type, ...payload }, (r) => {
      const e = chrome.runtime.lastError;
      if (e) return reject(new Error(e.message));
      resolve(r ?? { ok: true });
    });
  } catch (e) { reject(e); }
});
const openWorkspace = async (hash = 'today') => {
  try { const r = await send('openApp', { hash }); return !!r?.ok || r === undefined; }
  catch (e) {
    try {
      const url = chrome.runtime.getURL(`app.html#${encodeURIComponent(hash)}`);
      const tab = await chrome.tabs.create({ url, active: true });
      return !!tab;
    } catch (e2) { showError(e2.message); return false; }
  }
};
function dueToday(t, k = today()) {
  if (t.archived) return false;
  const r = t.repeat?.type || 'none';
  if (r === 'daily') return !t.repeat.startDate || k >= t.repeat.startDate;
  if (r === 'weekly') return (!t.repeat.startDate || k >= t.repeat.startDate) && (t.repeat.weekdays || []).map(Number).includes(new Date(`${k}T00:00:00`).getDay());
  return t.dueDate === k;
}
const done = (t, k = today()) => (t.completedDates || []).includes(k);
const formatTimer = (s) => `${String(Math.max(0, Math.floor(s/60))).padStart(2,'0')}:${String(Math.max(0, s % 60)).padStart(2,'0')}`;
function setTimer(s) { timerSeconds=Math.max(0,Number(s)||0); const el=$('#sideTimerDisplay'); if(el) el.textContent=formatTimer(timerSeconds); }
function syncSideFocus(f){
  if(!f)return;
  timerRunning=Boolean(f.active);
  focusMode=Math.min(120,Math.max(1,Number(f.mode)||25));
  timerSeconds=Math.max(0,Number(f.remaining)||0);
  setTimer(timerSeconds);
  $('#sideTimerStatus').textContent=f.active?(f.phase==='break'?'Break running':'Running'):f.paused?'Paused':f.phase==='break'?'Break complete':'Ready';
  $('#sideTimerStart').textContent=f.paused?'RESUME':'▶ START';
  $('#sideTimerStart').disabled=Boolean(f.active);
  $('#sideWorkInterval').textContent=`${focusMode}m`;
  $('#sideShortBreak').textContent=`${Number(state?.settings?.focusShortBreak)||5}m`;
  $('#sideLongBreak').textContent=`${Number(state?.settings?.focusLongBreak)||15}m`;
  $('#sideLongEvery').textContent=String(Number(state?.settings?.focusLongBreakEvery)||4);
  $('#sideTimerPause').disabled=!f.active;
  $$('[data-focus-mode]').forEach(b=>b.classList.toggle('active',Number(b.dataset.focusMode)===focusMode));
}
async function refreshSideFocus(){try{const r=await send('getFocusState');if(r?.ok){state=r.state;syncSideFocus(r.result?.focus);render();}}catch{}}
async function setFocusMode(mode){if(timerRunning)return;focusMode=Math.min(120,Math.max(1,Number(mode)||25));const r=await send('focusReset',{mode:focusMode,taskId:selectedTaskId||''});if(r?.ok){syncSideFocus(r.result?.focus);render();}}
async function startTimer(){if(timerRunning)return;const r=await send('focusStart',{mode:focusMode,taskId:selectedTaskId||''});if(r?.ok){syncSideFocus(r.result?.focus);render();}}
async function pauseTimer(){const r=await send('focusPause');if(r?.ok){syncSideFocus(r.result?.focus);render();}}
function selectFocusTask(id) { selectedTaskId = String(id || ''); if (selectedTaskId) sessionStorage.setItem('ascended-focus-task', selectedTaskId); else sessionStorage.removeItem('ascended-focus-task'); renderTasks(); }
function renderTasks() {
  const tasks = (state.tasks || []).filter(t => dueToday(t)).sort((a,b) => (a.dueTime || '99:99').localeCompare(b.dueTime || '99:99'));
  const open = tasks.filter(t => !done(t));
  $('#sideSummary').textContent = `${open.length} remaining`;
  $('#sideTasks').innerHTML = tasks.slice(0, 10).map(t => {
    const isDone = done(t), isFocus = String(t.id) === selectedTaskId;
    return `<div class="asc-sp-task ${isDone ? 'done' : ''} ${isFocus ? 'selected' : ''}">
      <button type="button" class="asc-sp-check" data-task-toggle="${esc(t.id)}" aria-label="${isDone ? 'Mark incomplete' : 'Complete task'}">${isDone ? '✓' : ''}</button>
      <button type="button" class="asc-sp-task-main" data-focus-select="${esc(t.id)}">
        <span><b>${esc(t.title)}</b><small>${t.dueTime ? esc(t.dueTime) : 'No time set'} · +${Number(t.xp) || 0} XP</small></span>
        <i>${isFocus ? 'Focus' : 'Select'}</i>
      </button>
    </div>`;
  }).join('') || `<div class="asc-sp-empty"><b>✓</b><p>No tasks today</p><small>Ready to go beyond your limits.</small></div>`;
  $$('[data-task-toggle]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation();
    try { const r = await send('toggleTask', { id: b.dataset.taskToggle, date: today() }); if (!r?.ok) throw new Error(r?.error || 'Unable to update task'); state = r.state; render(); }
    catch (err) { showError(err.message); }
  });
  $$('[data-focus-select]').forEach(b => b.onclick = () => selectFocusTask(b.dataset.focusSelect));
  const selected = (state.tasks || []).find(t => String(t.id) === selectedTaskId);
  $('#sideFocusTaskLabel').textContent = selected ? selected.title : 'No focus task selected';
}
function render() { renderTasks(); sideLocalize(); }
function showError(m) { const el = $('#sideError'); el.textContent = m; el.hidden = false; }
async function refresh() { try { const r = await send('getState'); if (!r?.ok) throw new Error(r?.error || 'Unable to load data'); state = r.state; render(); } catch (e) { console.error(e); showError(e.message); } }

function initSidepanel() {
  document.querySelectorAll('.itsuki-panel-art').forEach(img=>img.addEventListener('error',()=>{if(!img.dataset.fallback){img.dataset.fallback='1';img.src='https://static.zerochan.net/Nakano.Itsuki.1024.3270842.webp';}},{once:true}));
  $('#sideQuickAdd').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = String(new FormData(e.currentTarget).get('title') || '').trim();
    if (!title) return;
    try {
      const r = await send('addTask', { item: { title, listId:'inbox', priority:'medium', estimate:25, dueDate:today(), dueTime:'', repeat:{type:'none',weekdays:[],startDate:''}, notes:'', reminderAt:null, reminderEnabled:false, checklist:[] } });
      if (!r?.ok) throw new Error(r?.error || 'Unable to add task');
      e.currentTarget.reset(); state = r.state; render();
    } catch (err) { showError(err.message); }
  });
  $('#sideTimerStart').onclick = startTimer;
  $('#sideTimerPause').onclick = pauseTimer;
  $$('[data-focus-mode]').forEach(b => b.onclick = () => setFocusMode(b.dataset.focusMode));
  $('#sideOpenApp').onclick = () => openWorkspace('today');
  $('#sideTimerPause').disabled = true;
  setTimer(focusMode * 60);
  refresh();
  refreshSideFocus();
  setInterval(refreshSideFocus, 1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSidepanel,{once:true});else initSidepanel();
