// Keep the Side Panel locked until the same extension-session token used by the workspace is valid.
document.documentElement.style.visibility='hidden';
(async()=>{
  let unlocked=false;
  try{const r=await chrome.storage.session.get('itsukiUnlockedUntil');unlocked=Number(r?.itsukiUnlockedUntil)>Date.now();}catch{}
  document.documentElement.style.visibility='visible';
  if(!unlocked){
    document.body.innerHTML='<main style="font:14px system-ui;padding:24px;color:#34232a"><h2>★ Aurestar</h2><p>Unlock required. Click the Aurestar toolbar icon and enter your password, then reopen this panel.</p></main>';
    return;
  }
  const script=document.createElement('script');script.src=chrome.runtime.getURL('sidepanel.js');
  script.onerror=()=>{document.body.innerHTML='<main style="font:14px system-ui;padding:24px"><h2>Aurestar failed to start</h2><p>Reload the extension from chrome://extensions.</p></main>';};
  document.body.appendChild(script);
})();
