(()=>{
  if(window.top!==window.self) return;
  // Isolated-world sentinels prevent page scripts from spoofing the DOM marker
  // to suppress or duplicate the extension overlay. At document_start the HTML
  // root is not guaranteed to exist yet, so defer initialization until it does.
  if(window.__itsukiFocusWidgetLoaded===true||window.__itsukiFocusWidgetWaiting===true) return;
  const initialize=()=>{
    if(!document.documentElement||window.__itsukiFocusWidgetLoaded===true)return;
    window.__itsukiFocusWidgetLoaded=true;
    window.__itsukiFocusWidgetWaiting=false;
    // The manifest injects CSS before this script. Dynamic injection installs
    // CSS first, so both markers can be set here safely.
    window.__itsukiFocusWidgetCssLoaded=true;

    // Global visibility state is applied locally first, then fanned out by the
    // service worker. chrome.storage.onChanged remains the durable fallback.
    const applyOverlayHidden=hide=>{
      const hidden=hide===true;
      document.documentElement.classList.toggle('aurestar-distraction-hidden',hidden);
      document.documentElement.setAttribute('data-aurestar-overlays-hidden',hidden?'true':'false');
    };
    if(!window.__aurestarVisibilityHotkeysBound){
      window.__aurestarVisibilityHotkeysBound=true;
      const setHidden=hide=>{
        const hidden=hide===true;
        applyOverlayHidden(hidden); // instant on the tab receiving the keypress
        try{chrome.storage.local.set({aurestarOverlaysHidden:hidden}).catch(()=>{});}catch{}
        try{chrome.runtime.sendMessage({type:'aurestarSetOverlayVisibility',hidden}).catch(()=>{});}catch{}
      };
      try{
        chrome.storage.local.get('aurestarOverlaysHidden')
          .then(data=>applyOverlayHidden(data?.aurestarOverlaysHidden===true)).catch(()=>{});
        chrome.storage.onChanged.addListener((changes,area)=>{
          if(area==='local'&&Object.prototype.hasOwnProperty.call(changes,'aurestarOverlaysHidden')){
            applyOverlayHidden(changes.aurestarOverlaysHidden.newValue===true);
          }
        });
        chrome.runtime.onMessage.addListener(message=>{
          if(message?.type==='aurestarOverlayVisibility'&&typeof message.hidden==='boolean')applyOverlayHidden(message.hidden);
        });
      }catch{}
      const isEditable=target=>!!(target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName||'')));
      window.addEventListener('keydown',event=>{
        if(event.key!=='Alt'||event.repeat||event.metaKey||event.shiftKey||isEditable(event.target))return;
        event.preventDefault();event.stopImmediatePropagation();
        setHidden(!event.ctrlKey); // Alt hides; Ctrl+Alt shows
      },true);
    }
    try{chrome.storage.local.get('aurestarOverlaysHidden').then(data=>applyOverlayHidden(data?.aurestarOverlaysHidden===true)).catch(()=>{});}catch{}


  // The companion does not move autonomously; the user can drag her manually. Dialogue changes over time.
  // Its visibility is deliberately coupled to the Focus widget; disabling it hides both.
  const pet=document.createElement('aside');
  pet.id='itsuki-page-pet';
  pet.hidden=true;
  pet.setAttribute('aria-label','Desktop-style study companion');
  pet.innerHTML=`
    <button class="ipp-art" type="button" title="Drag to move companion" aria-label="Study companion">
      <img alt="Study companion" draggable="false">
      <span class="ipp-art-fallback" aria-hidden="true"><b>★</b><small>COMPANION</small></span>
    </button>
    <section class="ipp-bubble" hidden role="status" aria-live="polite">
      <button class="ipp-close" type="button" aria-label="Dismiss message">×</button>
      <b>Study Companion ★</b><span class="ipp-dialogue-text">Ơ, cậu đấy à? Có chuyện gì thì nói đi.</span>
      <div class="ipp-bubble-actions"><button class="ipp-open" type="button">Open Aurestar ↗</button><button class="ipp-snooze" type="button">Quiet today</button></div>
    </section>`;
  document.documentElement.appendChild(pet);
  for(const [prop,value] of Object.entries({position:'fixed',width:'max-content',maxWidth:'calc(100vw - 16px)',boxSizing:'border-box',fontFamily:'Inter, ui-sans-serif, system-ui, sans-serif',fontSize:'12px',lineHeight:'normal',transform:'none',margin:'0',zIndex:'2147483646',contain:'layout style'})) pet.style.setProperty(prop,value,'important');
  const petArt=pet.querySelector('.ipp-art');
  for(const [prop,value] of Object.entries({width:'154px',height:'218px',minWidth:'154px',minHeight:'218px',maxWidth:'154px',maxHeight:'218px',boxSizing:'border-box',flex:'0 0 154px'})) petArt.style.setProperty(prop,value,'important');
  const petBubble=pet.querySelector('.ipp-bubble');
  for(const [prop,value] of Object.entries({width:'270px',minWidth:'270px',maxWidth:'calc(100vw - 180px)',boxSizing:'border-box',flex:'0 1 270px'})) petBubble.style.setProperty(prop,value,'important');
  const bubble=pet.querySelector('.ipp-bubble');
  const petDialogue=pet.querySelector('.ipp-dialogue-text');
  const petImage=pet.querySelector('img');
  try{petImage.src=chrome.runtime.getURL('assets/itsuki/itsuki-pet.png');}catch{}
  let interactionHoldUntil=0, bubbleTimer=null, nudgeTimer=null, dialogueTimer=null, lastManualPetClickAt=0;
  let petEnabled=false, companionUserHidden=false, dialogueHiddenByUser=false, petMuteUntil=0, nudgeHistory=[];
  let lastExpressionRevision=0;
  const expressionEvents=new Set(['widget-open','click','tab-change','focus-start','focus-pause','focus-resume','focus-stop','break-start','break-end','focus-complete','focus-reminder','idle-reminder','distraction','water','return','periodic']);
  function applySharedExpression(record,shouldReveal=true){
    if(!record||typeof record!=='object'||!record.message)return;
    const revision=Number(record.revision)||Number(record.updatedAt)||0;
    if(revision<lastExpressionRevision)return;
    lastExpressionRevision=revision;
    pet.dataset.expression=String(record.expression||'cheerful');
    pet.dataset.expressionEvent=String(record.event||'');
    const src=String(record.imageSrc||'');
    if(src.startsWith('assets/itsuki/')){
      const full=chrome.runtime.getURL(src);
      if(petImage.dataset.imageId!==String(record.imageId||'')||petImage.src!==full){
        petImage.dataset.imageId=String(record.imageId||'');
        petImage.src=full;
      }
    }
    petDialogue.textContent=String(record.message);
    delete pet.dataset.artUnavailable;
    petImage.hidden=false;
    pet.classList.remove('ipp-art-unavailable');
    // Show newly paired dialogue on the foreground tab. Background tabs update
    // their cached art/text but never pop an overlay over the page being viewed.
    const event=String(record.event||'');
    const autoRevealEvents=new Set(['periodic','tab-change','widget-open','click','focus-start','focus-pause','focus-resume','focus-stop','break-start','break-end','focus-complete','focus-reminder','idle-reminder','distraction','water','return']);
    if(shouldReveal&&petEnabled&&!pet.hidden&&!dialogueHiddenByUser&&autoRevealEvents.has(event)&&document.visibilityState==='visible'&&Date.now()>=petMuteUntil&&!inCompanionQuietHours()){
      // Keep the latest dialogue visible. It must never disappear on a timer.
      bubble.hidden=false;
      clearTimeout(bubbleTimer);bubbleTimer=null;
    }
  }
  async function requestItsukiExpression(eventName){
    const event=expressionEvents.has(eventName)?eventName:'idle-reminder';
    try{
      const response=await chrome.runtime.sendMessage({type:'itsukiExpressionAction',event});
      if(response?.ok&&response.state)applySharedExpression(response.state);
    }catch{}
  }
  // One atomic record keeps image, expression and dialogue synchronized across tabs.
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    const record=changes.itsukiExpressionState?.newValue;
    if(record)applySharedExpression(record);
  });
  try{chrome.storage.local.get('itsukiExpressionState').then(data=>applySharedExpression(data?.itsukiExpressionState,false)).catch(()=>{});}catch{}
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function petDimensions(){
    // Reserve the full character + dialogue footprint even while the bubble is
    // temporarily hidden. That prevents a later bubble reveal from shoving the
    // pet sideways or outside the viewport.
    const small=innerWidth<=600;
    return {
      w:Math.min(Math.max(60,innerWidth-16),small?320:430),
      h:Math.min(Math.max(60,innerHeight-16),small?178:226)
    };
  }
  function dialogueKind(){
    if(focus?.phase==='break')return 'break';
    if(focus?.active&&focus?.phase==='focus')return 'focus';
    if(focus?.phase==='idle'&&focus?.lastCompletedAt)return 'done';
    return 'idle';
  }
  function scheduleDialogue(delay){
    // Kept as a compatibility shim for existing event handlers. Dialogue is
    // persistent and is never hidden by a timer; only an explicit user action hides it.
    clearTimeout(dialogueTimer);dialogueTimer=null;
  }

  function setPetXY(left,top){
    const {w,h}=petDimensions();
    const nextLeft=Math.round(clamp(Number(left)||0,0,Math.max(0,innerWidth-w)));
    const nextTop=Math.round(clamp(Number(top)||0,0,Math.max(0,innerHeight-h)));
    // Inline !important prevents a host page's CSS from freezing the pet's coordinates.
    pet.style.setProperty('position','fixed','important');
    pet.style.setProperty('left',`${nextLeft}px`,'important');
    pet.style.setProperty('top',`${nextTop}px`,'important');
    pet.style.setProperty('right','auto','important');
    pet.style.setProperty('bottom','auto','important');
    pet.style.setProperty('z-index','2147483646','important');
    pet.classList.toggle('ipp-right-side',nextLeft>Math.max(0,innerWidth-w)/2);
  }
  function currentPetXY(){
    const left=parseFloat(pet.style.left),top=parseFloat(pet.style.top);
    if(Number.isFinite(left)&&Number.isFinite(top))return {left,top};
    const r=pet.getBoundingClientRect();return {left:r.left,top:r.top};
  }
  async function loadPetPosition(){
    try{
      const stored=await chrome.storage.local.get(['itsukiPetPosition','itsukiPetMuteUntil','itsukiPetNudgeHistory','itsukiPetHidden','itsukiDialogueHiddenByUser']);
      companionUserHidden=stored.itsukiPetHidden===true;
      dialogueHiddenByUser=stored.itsukiDialogueHiddenByUser===true;
      bubble.hidden=dialogueHiddenByUser;
      petMuteUntil=Number(stored.itsukiPetMuteUntil)||0;
      nudgeHistory=Array.isArray(stored.itsukiPetNudgeHistory)?stored.itsukiPetNudgeHistory.filter(Number.isFinite):[];
      const pos=stored.itsukiPetPosition;
      if(pos&&Number.isFinite(Number(pos.left))&&Number.isFinite(Number(pos.top))) setPetXY(Number(pos.left),Number(pos.top));
      else setPetXY(14,Math.max(0,innerHeight-(innerWidth<=600?166:234)));
    }catch{setPetXY(14,Math.max(0,innerHeight-(innerWidth<=600?166:234)));}
  }
  async function savePetPosition(){
    const pos=currentPetXY();
    try{await chrome.storage.local.set({itsukiPetPosition:{left:Math.round(pos.left),top:Math.round(pos.top)}});}catch{}
  }
  function showDialogue(text='',autoHideMs=0,eventOverride=null){
    if(!petEnabled||pet.hidden||dialogueHiddenByUser)return;
    if(eventOverride&&expressionEvents.has(eventOverride))requestItsukiExpression(eventOverride).catch(()=>{});
    bubble.hidden=false;
    clearTimeout(bubbleTimer);bubbleTimer=null;
    // autoHideMs is intentionally ignored: dialogue persists until the user hides it.
    requestAnimationFrame(()=>{const p=currentPetXY();setPetXY(p.left,p.top);});
  }
  function hideDialogue(){bubble.hidden=true;clearTimeout(bubbleTimer);bubbleTimer=null;clearTimeout(dialogueTimer);dialogueTimer=null;}
  petImage.addEventListener('error',()=>{
    // Never fetch remote art or rotate through missing files. Preserve the shared
    // dialogue state and hide a broken image rather than showing a misleading face.
    pet.dataset.artUnavailable='true';
    petImage.hidden=true;
    pet.classList.add('ipp-art-unavailable');
  });
  petImage.addEventListener('load',()=>{
    petImage.hidden=false;
    delete pet.dataset.artUnavailable;
    pet.classList.remove('ipp-art-unavailable');
  });
  // User-controlled dragging only: The companion never walks autonomously. Position is
  // saved locally when the drag ends and synchronized to other open tabs.
  let petDrag=null, suppressPetClick=false;
  petArt.addEventListener('pointerdown',event=>{
    if(event.button!==0&&event.pointerType==='mouse')return;
    const pos=currentPetXY();
    petDrag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,left:pos.left,top:pos.top,moved:false};
    interactionHoldUntil=Date.now()+10000;
    try{petArt.setPointerCapture(event.pointerId);}catch{}
  });
  petArt.addEventListener('pointermove',event=>{
    if(!petDrag||petDrag.pointerId!==event.pointerId)return;
    const dx=event.clientX-petDrag.startX,dy=event.clientY-petDrag.startY;
    if(!petDrag.moved&&Math.hypot(dx,dy)<5)return;
    petDrag.moved=true;
    pet.classList.add('ipp-dragging');
    if(event.cancelable)event.preventDefault();
    setPetXY(petDrag.left+dx,petDrag.top+dy);
  });
  async function finishPetDrag(event){
    if(!petDrag||(event&&petDrag.pointerId!==event.pointerId))return;
    const ended=petDrag;petDrag=null;
    try{if(petArt.hasPointerCapture?.(ended.pointerId))petArt.releasePointerCapture(ended.pointerId);}catch{}
    if(ended.moved){
      suppressPetClick=true;
      pet.classList.remove('ipp-dragging');
      interactionHoldUntil=Date.now()+3500;
      await savePetPosition();
      // Pointer-generated click follows pointerup; suppress only that click.
      setTimeout(()=>{suppressPetClick=false;},0);
    }
  }
  petArt.addEventListener('pointerup',finishPetDrag);
  petArt.addEventListener('pointercancel',finishPetDrag);
  petArt.addEventListener('dragstart',event=>event.preventDefault());
  petArt.addEventListener('click',()=>{
    if(suppressPetClick){suppressPetClick=false;return;}
    const now=Date.now();
    // One short response per deliberate click; ignore rapid repeat-clicks so the bubble does not feel spammy.
    if(now-lastManualPetClickAt<2200)return;
    lastManualPetClickAt=now;
    interactionHoldUntil=now+3500;
    dialogueHiddenByUser=false;
    try{chrome.storage.local.set({itsukiDialogueHiddenByUser:false}).catch(()=>{});}catch{}
    showDialogue('',0,'click');
  });
  pet.querySelector('.ipp-close').addEventListener('click',()=>{
    dialogueHiddenByUser=true;hideDialogue();
    try{chrome.storage.local.set({itsukiDialogueHiddenByUser:true}).catch(()=>{});}catch{}
  });
  pet.querySelector('.ipp-open').addEventListener('click',()=>{
    interactionHoldUntil=Date.now()+1200+Math.random()*1800;
    try{chrome.runtime.sendMessage({type:'openApp',hash:'dashboard'});}catch{}
  });
  pet.querySelector('.ipp-snooze').addEventListener('click',async()=>{
    const now=new Date();const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1).getTime();
    petMuteUntil=next;
    try{await chrome.storage.local.set({itsukiPetMuteUntil:next});}catch{}
    hideDialogue();
  });
  // The companion remains stationary unless the user drags the character manually.
  function inCompanionQuietHours(){
    const configured=Array.isArray(settings?.motivationQuietHours)?settings.motivationQuietHours.filter(r=>r?.start&&r?.end):[];
    const ranges=configured;
    const now=new Date(),minute=now.getHours()*60+now.getMinutes();
    return ranges.some(r=>{
      const parse=v=>{const m=String(v).match(/^(\d{1,2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):-1;};
      const start=parse(r.start),end=parse(r.end);if(start<0||end<0||start===end)return false;
      return start<end?(minute>=start&&minute<end):(minute>=start||minute<end);
    });
  }
  async function maybeNudge(){
    if(!petEnabled||pet.hidden||document.visibilityState!=='visible'||!document.hasFocus()||!settings?.itsukiCompanionEnabled||Date.now()<petMuteUntil||Date.now()<interactionHoldUntil||inCompanionQuietHours())return;
    if(focus?.active&&focus.phase==='focus')return;
    const active=document.activeElement;
    if(active&&active!==document.body&&active!==document.documentElement&&active.matches?.('input,textarea,select,[contenteditable="true"]'))return;
    const now=Date.now();nudgeHistory=nudgeHistory.filter(t=>now-t<60*60*1000);
    if(nudgeHistory.length>=3||nudgeHistory.length&&now-Math.max(...nudgeHistory)<18*60*1000)return;
    nudgeHistory.push(now);
    try{await chrome.storage.local.set({itsukiPetNudgeHistory:nudgeHistory});}catch{}
    showDialogue('',0,'idle-reminder');
  }
  pet.addEventListener('pointerenter',()=>{interactionHoldUntil=Math.max(interactionHoldUntil,Date.now()+3000);});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'&&petEnabled){
      maybeNudge().catch(()=>{});
    }
  });
  window.addEventListener('resize',()=>{
    applyPos();
    if(petEnabled&&!pet.hidden){
      const p=currentPetXY();setPetXY(p.left,p.top);
    }
  });
  // Keep the same pet position and reminder mute/history across open tabs.
  try{chrome.storage.onChanged?.addListener((changes,areaName)=>{
    if(areaName!=='local'||!changes)return;
    if(changes.itsukiPetHidden){companionUserHidden=changes.itsukiPetHidden.newValue===true;setWidgetVisibility(state.enabled);}
    if(Object.prototype.hasOwnProperty.call(changes,'itsukiDialogueHiddenByUser')){
      dialogueHiddenByUser=changes.itsukiDialogueHiddenByUser.newValue===true;
      if(dialogueHiddenByUser)hideDialogue();
      else if(petEnabled&&!pet.hidden&&!inCompanionQuietHours()&&Date.now()>=petMuteUntil)showDialogue('',0,'widget-open');
    }
    const pos=changes.itsukiPetPosition?.newValue;
    if(pos&&Number.isFinite(Number(pos.left))&&Number.isFinite(Number(pos.top)))setPetXY(Number(pos.left),Number(pos.top));
    if(changes.itsukiPetMuteUntil){petMuteUntil=Number(changes.itsukiPetMuteUntil.newValue)||0;if(Date.now()<petMuteUntil)hideDialogue();}
    if(changes.itsukiPetNudgeHistory)nudgeHistory=Array.isArray(changes.itsukiPetNudgeHistory.newValue)?changes.itsukiPetNudgeHistory.newValue.filter(Number.isFinite):[];
  });}catch{}
  loadPetPosition();
  nudgeTimer=setInterval(()=>{maybeNudge().catch(()=>{});},60*1000);

  const send=(type,payload={})=>new Promise((resolve,reject)=>{
    try{chrome.runtime.sendMessage({type,...payload},r=>{const e=chrome.runtime.lastError;if(e)return reject(e);resolve(r||{});});}catch(e){reject(e);}
  });
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let state={enabled:true,top:18,right:18}, focus=null, tasks=[], settings={}, timer=null, drag=null;
  const root=document.createElement('div'); root.id='ascended-focus-widget'; root.hidden=true;
  // Lock the outer geometry against site styles that otherwise make the widget vary by tab.
  for(const [prop,value] of Object.entries({position:'fixed',width:'260px',minWidth:'260px',maxWidth:'calc(100vw - 16px)',height:'auto',minHeight:'0',maxHeight:'none',boxSizing:'border-box',fontFamily:'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',fontSize:'12px',lineHeight:'normal',transform:'none',margin:'0',padding:'0',zIndex:'2147483647',contain:'layout style'})) root.style.setProperty(prop,value,'important');
  root.innerHTML=`
    <div class="afw-head">
      <div class="afw-brand"><span class="afw-dot"></span><span>FOCUS</span><small>TIMER</small></div>
      <div class="afw-actions"><button class="afw-icon afw-companion-toggle" data-afw="companion" title="Hide floating companion" aria-label="Hide floating companion">◌</button><button class="afw-icon" data-afw="min" title="Minimize" aria-label="Minimize Focus Widget">−</button><button class="afw-icon" data-afw="hide" title="Hide widget" aria-label="Hide Focus Widget">×</button></div>
    </div>
    <div class="afw-body">
      <div class="afw-phase" id="afw-phase" aria-live="polite">READY</div>
      <div class="afw-time" id="afw-time" role="timer" aria-live="off" aria-label="Focus timer">25:00</div>
      <label class="afw-task-label" for="afw-task-select">Focus task</label>
      <select class="afw-task-select" id="afw-task-select"><option value="">No task — general focus</option></select>
      <div class="afw-progress"><i id="afw-progress-bar"></i></div>
      <div class="afw-controls">
        <button class="afw-main" id="afw-start" type="button" aria-label="Start or resume focus">▶ START</button>
        <button class="afw-secondary" id="afw-pause" type="button" aria-label="Pause or resume focus">PAUSE</button><button class="afw-secondary afw-stop" id="afw-stop" type="button" aria-label="Stop focus">■ STOP</button>
      </div>
      <div class="afw-breaks">
        <span>BREAK</span>
        <button class="afw-break" id="afw-short-break">5m Short</button>
        <button class="afw-break" id="afw-long-break">15m Long</button>
        <button class="afw-break afw-skip">Skip</button>
      </div>
      <div class="afw-meta"><span id="afw-sessions">0 cycles</span><span id="afw-today">0m today</span></div>
    </div>
    <div class="afw-minimized"><span id="afw-mini-time">25:00</span><button id="afw-mini-toggle">▶</button></div>`;
  document.documentElement.appendChild(root);
  const body=root.querySelector('.afw-body'), minimized=root.querySelector('.afw-minimized');
  const $=id=>root.querySelector(id);
  function setWidgetVisibility(enabled){
    const wasPetEnabled=petEnabled;
    state.enabled=enabled!==false;
    const companionAllowed=settings?.privacyMode!==true&&settings?.itsukiCompanionEnabled!==false&&!companionUserHidden;
    petEnabled=state.enabled&&companionAllowed;
    root.hidden=!state.enabled;
    pet.hidden=!petEnabled;
    const brand=$('.afw-brand span:nth-child(2)'),tag=$('.afw-brand small'),companionToggle=$('[data-afw="companion"]');
    if(brand)brand.textContent='FOCUS';
    if(tag)tag.textContent='TIMER';
    if(companionToggle){companionToggle.title=companionUserHidden?'Show floating companion':'Hide floating companion';companionToggle.setAttribute('aria-label',companionToggle.title);companionToggle.classList.toggle('is-companion-hidden',companionUserHidden);}
    root.classList.toggle('afw-discreet',settings?.privacyMode===true);
    if(!petEnabled){
      clearTimeout(dialogueTimer);dialogueTimer=null;
      hideDialogue();
    }else{
      if(!wasPetEnabled){
        const left=parseFloat(pet.style.left),top=parseFloat(pet.style.top);
        requestAnimationFrame(()=>{
          setPetXY(Number.isFinite(left)?left:14,Number.isFinite(top)?top:Math.max(0,innerHeight-(innerWidth<=600?138:202)));
          if(!dialogueHiddenByUser&&Date.now()>=petMuteUntil&&!inCompanionQuietHours())showDialogue('',0,'widget-open');
        });
        scheduleDialogue(30000);
      }
      // Keep the companion anchored; dialogue rotation is scheduled separately.
    }
  }
  function fmt(s){s=Math.max(0,Math.floor(Number(s)||0));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  function applyPos(){
    const rect=root.getBoundingClientRect();
    const width=Math.min(260,Math.max(0,innerWidth-16)),height=Math.max(42,rect.height||236);
    const top=clamp((Number(state.top)||0)/100*innerHeight,0,Math.max(0,innerHeight-height));
    const right=clamp((Number(state.right)||0)/100*innerWidth,0,Math.max(0,innerWidth-width));
    root.style.top=`${Math.round(top)}px`;
    root.style.right=`${Math.round(right)}px`;
  }
  function render(){
    if(!focus)return;
    const active=!!focus.active, paused=!!focus.paused, phase=focus.phase||'idle';
    let sec=Number(focus.remaining)||0;
    if(active && focus.countdown && focus.endsAt) sec=Math.max(0,Math.ceil((Number(focus.endsAt)-Date.now())/1000));
    if(!focus.countdown && active) sec=Math.max(0,Number(focus.elapsed)||0);
    const display=fmt(sec);
    $('#afw-time').textContent=display; $('#afw-mini-time').textContent=display;
    $('#afw-phase').textContent=phase==='break'?(focus.breakKind==='long'?'LONG BREAK':'SHORT BREAK'):(active?'DEEP FOCUS':paused?'PAUSED':'READY');
    $('#afw-start').textContent=active&&phase==='break'?'BREAK RUNNING':paused?'▶ RESUME':phase==='break'?'▶ START BREAK':'▶ START'; $('#afw-start').disabled=active;
    $('#afw-pause').disabled=!active; $('#afw-stop').disabled=!(active||paused);
    $('#afw-short-break').disabled=active; $('#afw-long-break').disabled=active; $('.afw-skip').disabled=phase!=='break';
    const sel=$('#afw-task-select');
    if(sel){
      const current=String(focus.taskId||'');
      sel.innerHTML='<option value="">No task — general focus</option>'+tasks.filter(t=>!t.archived).map(t=>`<option value="${esc(t.id)}">${esc(t.title)}</option>`).join('');
      sel.value=current; sel.disabled=active;
    }
    $('#afw-sessions').textContent=`${Number(focus.pomodorosCompleted)||0} cycles`;
    $('#afw-today').textContent=`${Number(focus.todayFocusMinutes)||0}m today`;
    const total=phase==='break'?Math.max(1,(focus.breakKind==='long'?Number(settings.focusLongBreak)||15:Number(settings.focusShortBreak)||5))*60:Math.max(1,Number(focus.mode)||25)*60;
    const progress=Math.max(0,Math.min(100,(1-sec/total)*100));
    $('#afw-progress-bar').style.width=`${progress}%`;
  }
  function focusTransitionEvent(before,after){
    if(!before||!after)return null;
    const bPhase=String(before.phase||'idle'),aPhase=String(after.phase||'idle');
    if(bPhase==='break'&&aPhase!=='break')return 'break-end';
    if(aPhase==='break'&&bPhase!=='break')return 'break-start';
    if(aPhase==='idle'&&bPhase!=='idle'){
      return Number(after.lastCompletedAt)>Number(before.lastCompletedAt||0)?'focus-complete':'focus-stop';
    }
    if(aPhase==='focus'&&after.active&&bPhase!=='focus')return 'focus-start';
    if(aPhase==='focus'&&bPhase==='focus'){
      if(before.active&&!after.active&&after.paused)return 'focus-pause';
      if(!before.active&&before.paused&&after.active)return 'focus-resume';
      if(!before.active&&after.active&&!before.paused)return 'focus-resume';
    }
    return null;
  }
  async function refresh(){
    try{
      const [w,r,st]=await Promise.all([send('getFocusWidgetSettings'),send('getFocusState'),send('getState')]);
      const widget=r?.result?.widget||w?.result?.widget||w?.widget||{};
      state={enabled:widget.enabled!==false,top:Number.isFinite(Number(widget.position?.top))?Number(widget.position.top):18,right:Number.isFinite(Number(widget.position?.right))?Number(widget.position.right):18};
      const previousFocus=focus;
      focus=r?.result?.focus||r?.focus||null; tasks=st?.state?.tasks||st?.result?.tasks||[]; settings=st?.state?.settings||st?.result?.settings||{}; const sb=Number(settings.focusShortBreak)||5,lb=Number(settings.focusLongBreak)||15; $('#afw-short-break').textContent=`${sb}m Short`; $('#afw-long-break').textContent=`${lb}m Long`; setWidgetVisibility(state.enabled);applyPos();render();
      const transition=focusTransitionEvent(previousFocus,focus);
      if(transition&&Date.now()>=petMuteUntil&&!inCompanionQuietHours()){
        if(petEnabled)showDialogue('',0,transition);else requestItsukiExpression(transition).catch(()=>{});
      }
    }catch{}
  }
  async function act(type,payload={}){try{const r=await send(type,payload);if(r?.ok){focus=r.result?.focus||focus;render();}}catch(e){console.warn('Aurestar widget',e);}}
  $('#afw-start').onclick=()=>act('focusStart',{mode:Number(focus?.mode)||25,taskId:focus?.taskId||''});
  $('#afw-pause').onclick=()=>act('focusPause');
  $('#afw-stop').onclick=()=>act('focusStop');
  $('#afw-short-break').onclick=()=>act('focusStartBreak',{kind:'short'});
  $('#afw-long-break').onclick=()=>act('focusStartBreak',{kind:'long'});
  root.querySelector('.afw-skip').onclick=()=>act('focusSkipBreak');
  $('#afw-task-select').onchange=()=>act('focusSetTask',{taskId:$('#afw-task-select').value});
  root.querySelector('[data-afw="hide"]').onclick=async()=>{setWidgetVisibility(false);await send('setFocusWidgetEnabled',{enabled:false}).catch(()=>{});};
  root.querySelector('[data-afw="companion"]').onclick=async()=>{companionUserHidden=!companionUserHidden;try{await chrome.storage.local.set({itsukiPetHidden:companionUserHidden});}catch{}setWidgetVisibility(state.enabled);};
  root.querySelector('[data-afw="min"]').onclick=()=>{root.classList.toggle('is-min');applyPos();};
  $('#afw-mini-toggle').onclick=()=>{root.classList.toggle('is-min');applyPos();};
  root.addEventListener('pointerdown',e=>{
    if(e.target.closest('button,select,input,textarea,a,[contenteditable="true"],[role="slider"]'))return;
    if(e.button!==0&&e.pointerType==='mouse')return;
    const rect=root.getBoundingClientRect(); drag={pointerId:e.pointerId,x:e.clientX,y:e.clientY,top:rect.top,right:innerWidth-rect.right,width:rect.width,height:rect.height};
    try{root.setPointerCapture?.(e.pointerId);}catch{}
  });
  root.addEventListener('pointermove',e=>{
    if(!drag||drag.pointerId!==e.pointerId)return;
    const dy=e.clientY-drag.y,dx=e.clientX-drag.x;
    const top=clamp(drag.top+dy,0,Math.max(0,innerHeight-drag.height));
    const right=clamp(drag.right-dx,0,Math.max(0,innerWidth-drag.width));
    root.style.top=`${Math.round(top)}px`;root.style.right=`${Math.round(right)}px`;
  });
  async function finishWidgetDrag(e){
    if(!drag||(e&&drag.pointerId!==e.pointerId))return;
    const rect=root.getBoundingClientRect();drag=null;
    const top=clamp(rect.top/Math.max(1,innerHeight)*100,0,80);
    const right=clamp((innerWidth-rect.right)/Math.max(1,innerWidth)*100,0,80);
    state.top=top;state.right=right;
    await send('setFocusWidgetPosition',{top,right}).catch(()=>{});
  }
  root.addEventListener('pointerup',finishWidgetDrag);
  root.addEventListener('pointercancel',()=>{drag=null;applyPos();});
  window.addEventListener('resize',()=>applyPos());
  chrome.runtime.onMessage.addListener(m=>{
    if(m?.type==='focusStateChanged'){
      const before=focus;focus=m.focus||focus;render();
      const transition=focusTransitionEvent(before,focus);
      if(transition&&Date.now()>=petMuteUntil&&!inCompanionQuietHours()){
        if(petEnabled)showDialogue('',0,transition);else requestItsukiExpression(transition).catch(()=>{});
      }
    }
    if(m?.type==='focusWidgetVisibility'){
      if(Object.prototype.hasOwnProperty.call(m,'privacyMode'))settings.privacyMode=m.privacyMode===true;
      if(Object.prototype.hasOwnProperty.call(m,'itsukiCompanionEnabled'))settings.itsukiCompanionEnabled=m.itsukiCompanionEnabled!==false;
      if(Array.isArray(m.motivationQuietHours))settings.motivationQuietHours=m.motivationQuietHours;
      if(m.position&&Number.isFinite(Number(m.position.top))&&Number.isFinite(Number(m.position.right))){state.top=clamp(Number(m.position.top),0,80);state.right=clamp(Number(m.position.right),0,80);applyPos();}
      setWidgetVisibility(m.enabled!==false);
    }
  });
    refresh(); timer=setInterval(()=>{if(!root.hidden)render();},500);
  };
  if(document.documentElement) initialize();
  else{
    window.__itsukiFocusWidgetWaiting=true;
    const observer=new MutationObserver(()=>{
      if(document.documentElement){observer.disconnect();window.__itsukiFocusWidgetWaiting=false;initialize();}
    });
    observer.observe(document,{childList:true,subtree:true});
  }
})();
