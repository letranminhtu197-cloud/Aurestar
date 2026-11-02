(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const toast = (message) => {
    let el = $('.toast');
    if (!el) { el=document.createElement('div'); el.className='toast'; document.body.append(el); }
    el.textContent=message; el.classList.add('show');
    clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.classList.remove('show'),1900);
  };
  $$('[data-check]').forEach(button=>button.addEventListener('click',()=>{
    button.classList.toggle('checked'); button.textContent=button.classList.contains('checked')?'✓':'';
    button.closest('.task-row')?.classList.toggle('done',button.classList.contains('checked'));
    const label=button.dataset.check||'Item'; toast((button.classList.contains('checked')?'Completed: ':'Reopened: ')+label);
  }));
  $('#quickAdd')?.addEventListener('submit',e=>{
    e.preventDefault(); const input=$('input[name="task"]',e.currentTarget); const title=input?.value.trim(); if(!title)return;
    const list=$('#taskList'); if(!list)return;
    const row=document.createElement('div'); row.className='task-row';
    row.innerHTML='<button class="check" type="button" data-check="'+title.replace(/[&<>"]/g,'')+'"></button><div class="task-copy"><b></b><div class="task-meta">Today · Medium priority</div></div><span class="priority medium">Medium</span>';
    $('.task-copy b',row).textContent=title; list.prepend(row);
    $('[data-check]',row).addEventListener('click',ev=>{ev.currentTarget.classList.toggle('checked');ev.currentTarget.textContent=ev.currentTarget.classList.contains('checked')?'✓':'';row.classList.toggle('done',ev.currentTarget.classList.contains('checked'));});
    input.value=''; toast('Task added to preview');
  });
  $$('[data-tab]').forEach(button=>button.addEventListener('click',()=>{
    const group=button.closest('[data-tab-group]')||document;
    $$('[data-tab]',group).forEach(b=>b.classList.toggle('active',b===button));
    const id=button.dataset.tab;
    $$('[data-tab-panel]',group).forEach(panel=>panel.hidden=panel.dataset.tabPanel!==id);
  }));
  // Preview-only focus timer.
  let focusLeft=25*60, focusRunning=false, focusInterval=null;
  const focusTime=$('#focusTime'), focusDial=$('#focusDial'), focusToggle=$('#focusToggle');
  const drawFocus=()=>{
    if(!focusTime)return;
    focusTime.textContent=String(Math.floor(focusLeft/60)).padStart(2,'0')+':'+String(focusLeft%60).padStart(2,'0');
    const progress=1-focusLeft/(25*60); if(focusDial)focusDial.style.background='conic-gradient(#ce8799 '+(progress*360)+'deg,#633d49 '+(progress*360)+'deg)';
    if(focusToggle)focusToggle.textContent=focusRunning?'Pause':'Start focus';
  };
  focusToggle?.addEventListener('click',()=>{
    focusRunning=!focusRunning; clearInterval(focusInterval);
    if(focusRunning)focusInterval=setInterval(()=>{focusLeft=Math.max(0,focusLeft-1);drawFocus();if(!focusLeft){clearInterval(focusInterval);focusRunning=false;toast('Focus preview complete');drawFocus();}},1000);
    drawFocus();
  });
  $('#focusReset')?.addEventListener('click',()=>{focusRunning=false;clearInterval(focusInterval);focusLeft=25*60;drawFocus();});
  $$('.preset').forEach(button=>button.addEventListener('click',()=>{
    $$('.preset').forEach(b=>b.classList.toggle('active',b===button));
    focusRunning=false;clearInterval(focusInterval);focusLeft=(Number(button.dataset.minutes)||25)*60;
    const max=focusLeft; if(focusDial)focusDial.dataset.max=String(max); drawFocus();
  }));
  // Calendar navigation for a static preview.
  const monthTitle=$('#monthTitle'), calendarGrid=$('#calendarGrid');
  if(monthTitle&&calendarGrid){
    let date=new Date(2026,10,1);
    const renderCalendar=()=>{
      monthTitle.textContent=date.toLocaleDateString('en-US',{month:'long',year:'numeric'});
      const first=new Date(date.getFullYear(),date.getMonth(),1), offset=(first.getDay()+6)%7;
      const days=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
      const prev=new Date(date.getFullYear(),date.getMonth(),0).getDate();
      const labels=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      calendarGrid.innerHTML=labels.map(x=>'<div class="calendar-weekday">'+x+'</div>').join('');
      for(let i=0;i<42;i++){
        let n=i-offset+1,other=false,day=n;
        if(n<1){day=prev+n;other=true;}else if(n>days){day=n-days;other=true;}
        const cell=document.createElement('button');cell.type='button';cell.className='calendar-cell'+(other?' other':'')+(day===3&&!other&&date.getMonth()===10?' selected':'');
        cell.innerHTML='<b>'+day+'</b>'+(!other&&[3,5,9,14,19,23].includes(day)?'<i class="event-dot"></i>':'');
        cell.addEventListener('click',()=>{$$('.calendar-cell').forEach(x=>x.classList.remove('selected'));cell.classList.add('selected');toast('Selected '+date.toLocaleDateString('en-US',{month:'long'})+' '+day);});
        calendarGrid.append(cell);
      }
    };
    $('#monthPrev')?.addEventListener('click',()=>{date.setMonth(date.getMonth()-1);renderCalendar();});
    $('#monthNext')?.addEventListener('click',()=>{date.setMonth(date.getMonth()+1);renderCalendar();});
    renderCalendar();
  }
  // Training check-ins are visual preview controls only.
  $$('[data-set-done]').forEach(button=>button.addEventListener('click',()=>{
    button.classList.toggle('checked');button.textContent=button.classList.contains('checked')?'✓':'';
    const done=$$('[data-set-done]').filter(x=>x.classList.contains('checked')).length;
    const total=$$('[data-set-done]').length; const bar=$('#trainingProgress');
    if(bar)bar.style.width=(total?done/total*100:0)+'%';
    toast(done+' of '+total+' steps checked');
  }));
  // Widget timer: independent preview, no Electron service connection.
  let widgetLeft=25*60,widgetRunning=false,widgetTimer=null,widgetMinutes=25;
  const widgetDraw=()=>{
    const t=$('#widgetTime'),dial=$('#widgetDial'),toggle=$('#widgetToggle');
    if(t)t.textContent=String(Math.floor(widgetLeft/60)).padStart(2,'0')+':'+String(widgetLeft%60).padStart(2,'0');
    if(dial)dial.style.background='conic-gradient(#ce8799 '+((1-widgetLeft/(widgetMinutes*60))*360)+'deg,#633d49 0deg)';
    if(toggle)toggle.textContent=widgetRunning?'Pause':'Start';
  };
  $('#widgetToggle')?.addEventListener('click',()=>{
    widgetRunning=!widgetRunning;clearInterval(widgetTimer);
    if(widgetRunning)widgetTimer=setInterval(()=>{widgetLeft=Math.max(0,widgetLeft-1);widgetDraw();if(!widgetLeft){clearInterval(widgetTimer);widgetRunning=false;toast('Pomodoro preview finished');widgetDraw();}},1000);
    widgetDraw();
  });
  $('#widgetReset')?.addEventListener('click',()=>{widgetRunning=false;clearInterval(widgetTimer);widgetLeft=widgetMinutes*60;widgetDraw();});
  $('#widgetClose')?.addEventListener('click',()=>toast('Close control is preview-only'));
  $('#itsukiOpen')?.addEventListener('click',()=>toast('Workspace link is preview-only'));
  $('#itsukiHide')?.addEventListener('click',()=>{const box=$('.itsuki-layout');if(box)box.style.opacity='.25';toast('Itsuki hide preview');});
  drawFocus();widgetDraw();
})();