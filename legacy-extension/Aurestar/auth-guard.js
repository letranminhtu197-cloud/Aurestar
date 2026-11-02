// Gate app.js behind the extension-session unlock token so the workspace never boots while locked.
document.documentElement.style.visibility = 'hidden';
(async () => {
  let unlocked = false;
  try {
    const result = await chrome.storage.session.get('itsukiUnlockedUntil');
    unlocked = Number(result?.itsukiUnlockedUntil) > Date.now();
  } catch (error) {
    console.warn('Session check failed', error);
  }

  document.documentElement.style.visibility = 'visible';
  if (!unlocked) {
    document.documentElement.innerHTML = `
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Open Aurestar</title>
        <link rel="stylesheet" href="unlock.css">
      </head>
      <body>
        <main class="unlock-shell">
          <div class="star">★</div>
          <p class="eyebrow">PRIVATE STUDY SPACE</p>
          <h1>Unlock required</h1>
          <p class="sub">Click the Aurestar extension icon and enter your password to continue.</p>
          <p class="foot">Your study data has not been changed.</p>
        </main>
      </body>`;
    return;
  }

  const app = document.createElement('script');
  app.src = chrome.runtime.getURL('app.js');
  app.onerror = () => {
    document.body.innerHTML = '<main class="fatal-error"><div><h2>Aurestar failed to start</h2><p>Could not load app.js. Open chrome://extensions, reload the extension, and try again.</p></div></main>';
  };
  document.body.appendChild(app);
})();
