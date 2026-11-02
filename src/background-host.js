'use strict';

(async()=>{
  const url=await window.aurestarDesktop.getBackgroundScriptUrl();
  const script=document.createElement('script');
  script.src=url;
  script.onload=()=>window.aurestarDesktop.announceBackgroundReady();
  script.onerror=()=>console.error('Could not load Aurestar local background service:',url);
  document.body.appendChild(script);
})().catch(error=>console.error('Could not start the Aurestar background service:',error));
