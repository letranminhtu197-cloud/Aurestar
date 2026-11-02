'use strict';

window.aurestarDesktop.onReminder(message=>{
  document.getElementById('message').textContent=String(message||'Your Aurestar reminder is ready.');
});
