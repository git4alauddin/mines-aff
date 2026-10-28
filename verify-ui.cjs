// Isolated headless-browser integration checks. Node 20+, no dependencies.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  if (!executable) throw new Error('Chrome or Edge is required for UI verification.');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mines-ui-'));
  const browser = spawn(executable, ['--headless=new', '--mute-audio', '--disable-gpu', '--in-process-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank'], {windowsHide:true, stdio:['ignore', 'ignore', 'pipe']});
  let diagnostics = '', socket, site;
  browser.stderr.on('data', chunk => diagnostics += chunk);
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100);
    if (!fs.existsSync(portFile)) throw new Error('Browser failed to start: ' + diagnostics.slice(-1200));
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl.replace('localhost', '127.0.0.1'));
    await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
    let sequence = 0;
    const pending = new Map(), errors = [];
    socket.onmessage = ({data}) => {
      const message = JSON.parse(data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.id) {const callback = pending.get(message.id); if (!callback) return; pending.delete(message.id); clearTimeout(callback.timeout); if (message.error) callback.reject(new Error(message.error.message)); else callback.resolve(message.result);}
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence, timeout = setTimeout(() => {pending.delete(id); reject(new Error(`Timeout: ${method}`));}, 10000);
      pending.set(id, {resolve, reject, timeout}); socket.send(JSON.stringify({id, method, params}));
    });
    const evaluate = async expression => {const response = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true}); if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text); return response.result.value;};
    const until = async (expression, message) => {for (let i = 0; i < 120; i++) {if (await evaluate(expression)) return; await delay(50);} throw new Error(message || `Not ready: ${expression}`);};
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const change = (selector, value) => evaluate(`(() => {const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const setValue = (selector, value) => evaluate(`document.querySelector(${JSON.stringify(selector)}).value = ${JSON.stringify(value)}`);
    const submit = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
    const viewport = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', {width, height, mobile, deviceScaleFactor:1});
    const screenshot = async name => {
      await delay(70);
      const result = await send('Page.captureScreenshot', {format:'png', captureBeyondViewport:false});
      fs.mkdirSync(path.join(__dirname, 'preview'), {recursive:true});
      fs.writeFileSync(path.join(__dirname, 'preview', name), Buffer.from(result.data, 'base64'));
    };
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setBlockedURLs', {urls:['*dmfirst0.com*']});
    const {startServer} = await import('./tools/serve.mjs'); site = await startServer(0);
    const url = `http://127.0.0.1:${site.address().port}`;
    const open = async (route, ready) => {await send('Page.navigate', {url:url + route}); await until(ready, `Page did not mount: ${route}`);};
    if (process.argv.includes('--audio-only')) {
      const trustedClick = async selector => {
        const point = await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
        await send('Input.dispatchMouseEvent', {type:'mousePressed', ...point, button:'left', clickCount:1});
        await send('Input.dispatchMouseEvent', {type:'mouseReleased', ...point, button:'left', clickCount:1});
      };
      await viewport(390, 844, true);
      await open('/registration.html', "document.getElementById('deposit-dialog')?.open && !document.querySelector('[data-guidance-toolbar]').hidden");
      const recording = await evaluate(`(async () => {
        const audio=document.querySelector('[data-registration-audio]');
        const response=await fetch(audio.src);
        if (!response.ok) throw new Error('Recording HTTP '+response.status);
        const bytes=await response.arrayBuffer(), byteCount=bytes.byteLength, context=new AudioContext();
        try {const decoded=await context.decodeAudioData(bytes);return {status:response.status,type:response.headers.get('content-type'),bytes:byteCount,duration:decoded.duration,channels:decoded.numberOfChannels,paused:audio.paused,time:audio.currentTime};}
        finally {await context.close();}
      })()`);
      assert.equal(recording.status, 200); assert.equal(recording.type, 'audio/mpeg');
      assert.ok(recording.bytes > 0 && recording.duration > 0 && recording.channels > 0);
      assert.equal(recording.paused, true); assert.equal(recording.time, 0);
      console.log('PASS recording loads and decodes: '+JSON.stringify(recording));
      await trustedClick('[data-dismiss-deposit]');
      await until("document.querySelector('[data-guidance-toolbar]').dataset.state==='playing' && document.querySelector('[data-registration-audio]').currentTime>0", 'Close did not start audio.');
      await trustedClick('[data-guidance-toggle]');
      assert.equal(await evaluate("document.querySelector('[data-registration-audio]').paused"), true);
      for (const width of [390,320,1440]) {
        await viewport(width,844,width<650);
        const layout=await evaluate(`(() => {
          const header=document.querySelector('.registration-header').getBoundingClientRect();
          const guidance=document.querySelector('[data-guidance-toolbar]').getBoundingClientRect();
          const frame=document.getElementById('dmfirst-frame').getBoundingClientRect();
          const activity=document.querySelector('[data-activity-ticker]').getBoundingClientRect();
          return {headerBottom:header.bottom,guidanceTop:guidance.top,guidanceBottom:guidance.bottom,guidanceLeft:guidance.left,guidanceRight:guidance.right,frameTop:frame.top,frameBottom:frame.bottom,activityTop:activity.top,width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth};
        })()`);
        assert.ok(Math.abs(layout.headerBottom-layout.guidanceTop)<1,'Guidance must sit directly below the header.');
        assert.ok(Math.abs(layout.frameTop-layout.guidanceBottom)<1,'The iframe must start below guidance.');
        assert.ok(Math.abs(layout.frameBottom-layout.height)<1,'The iframe must fill the remaining viewport.');
        assert.equal(layout.guidanceLeft,0);assert.equal(layout.guidanceRight,width);assert.equal(layout.scrollWidth,width);
        if(width<650)assert.ok(layout.activityTop>=layout.guidanceBottom,'Activity must not cover voice controls.');
        if(width!==320)await screenshot(`registration-guidance-${width<650?'mobile':'desktop'}.png`);
      }
      await evaluate("document.querySelector('[data-guidance-toolbar]').hidden=true");
      assert.ok(await evaluate("Math.abs(document.getElementById('dmfirst-frame').getBoundingClientRect().top-document.querySelector('.registration-header').getBoundingClientRect().bottom)<1"),'Hidden guidance must leave no empty row.');
      await evaluate("document.querySelector('[data-guidance-toolbar]').hidden=false");
      await viewport(390,844,true);
      await trustedClick('[data-guidance-toggle]');
      await until("document.querySelector('[data-guidance-toolbar]').dataset.state==='playing'");
      await open('/registration.html', "document.getElementById('deposit-dialog')?.open && !document.querySelector('[data-guidance-toolbar]').hidden");
      await trustedClick('[data-deposit-claim]');
      await until("document.querySelector('[data-guidance-toolbar]').dataset.state==='playing' && document.querySelector('[data-registration-audio]').currentTime>0", 'Claim did not start audio.');
      assert.ok((await evaluate("document.getElementById('dmfirst-frame').src")).endsWith('/#/wallet/Recharge'));
      await trustedClick('[data-guidance-toggle]');
      assert.equal(await evaluate("document.querySelector('[data-registration-audio]').paused"), true);
      assert.deepEqual(errors, []);
      console.log('PASS Close and Claim start audio; stop/replay controls work.');
      await send('Browser.close'); socket=null; return;
    }
    await viewport(1440, 1000);
    await open('/?preview=1', "document.documentElement.dataset.stage === 'unlocked'");
    assert.equal(await evaluate("document.querySelectorAll('.scene-cell').length"), 25);
    assert.equal(await evaluate("document.querySelectorAll('.status-grid .ready').length"), 4);
    assert.equal(await evaluate("document.querySelector('[role=progressbar]').getAttribute('aria-valuenow')"), '100');
    assert.equal(await evaluate("document.getElementById('continueLink').hidden"), false);
    await screenshot('landing-desktop.png');
    for (const width of [390, 320]) {
      await viewport(width, 844, true);
      assert.equal(await evaluate('document.documentElement.scrollWidth'), width, `Landing overflow at ${width}`);
      assert.ok(await evaluate("document.querySelector('.progress-track').getBoundingClientRect().bottom < innerHeight"));
      if (width === 390) await screenshot('landing-mobile.png');
    }
    console.log('PASS landing progress, preview mode, desktop and mobile layouts');

    await viewport(1040, 800);
    await open('/creator-studio.html', "!!document.getElementById('studioGateForm')");
    assert.equal(await evaluate("document.querySelectorAll('.game-tile').length"), 0);
    await setValue('#studioPassword', 'incorrect'); await submit('#studioGateForm');
    assert.equal(await evaluate("document.getElementById('studioGateError').hidden"), false);
    await screenshot('studio-access.png');
    await setValue('#studioPassword', '@creator'); await submit('#studioGateForm');
    await until("document.querySelectorAll('.game-tile').length === 25");
    assert.equal(await evaluate("document.getElementById('studioGate').hidden"), true);
    assert.equal(await evaluate("document.getElementById('balance').textContent"), '29,999.00');
    assert.equal(await evaluate("document.getElementById('nextMultiplier').textContent"), 'Next: 1.10x');
    await screenshot('studio-desktop.png');
    await click('#betButton');
    assert.equal(await evaluate("document.getElementById('betButton').disabled"), true);
    await click('[data-index="0"]');
    assert.equal(await evaluate("document.getElementById('actionAmount').textContent"), '₹11.00');
    assert.equal(await evaluate("document.getElementById('nextMultiplier').textContent"), 'Next: 1.25x');
    await click('#betButton');
    assert.equal(await evaluate("document.getElementById('balance').textContent"), '30,000.00');
    await screenshot('studio-cashout.png');
    await click('#betButton'); await click('[data-index="4"]');
    assert.equal(await evaluate("document.querySelector('[data-index=\"4\"]').dataset.state"), 'hit');
    assert.equal(await evaluate("document.getElementById('balance').textContent"), '29,990.00');
    await screenshot('studio-mine.png');
    await click('#historyButton');
    assert.equal(await evaluate("document.querySelectorAll('.history-table tbody tr').length"), 2);
    await click('#historyDialog [data-close]'); await click('#resetCredits');
    await setValue('#stake', '100000'); await click('#betButton');
    assert.ok((await evaluate("document.getElementById('gameStatus').textContent")).includes('Not enough'));
    assert.equal(await evaluate("document.getElementById('balance').textContent"), '29,999.00');
    await setValue('#stake', '10');
    console.log('PASS Studio gate, bet validation, star reveal, cash-out, loss, history, reset');

    await click('#predictLauncher'); await click('#previewRun');
    await until("!document.getElementById('previewRun').disabled");
    assert.equal(await evaluate("document.querySelectorAll('.preview-cell.is-mine').length"), 3);
    assert.equal(await evaluate("document.querySelectorAll('.preview-cell.is-pick').length"), 5);
    await screenshot('studio-preview.png');
    await click('#predictionDialog .dialog-close');
    await change('#mineCount', '20');
    assert.equal(await evaluate("document.getElementById('nextMultiplier').textContent"), 'Next: 4.85x');
    await click('#predictLauncher'); await click('#previewRun'); await until("!document.getElementById('previewRun').disabled");
    assert.equal(await evaluate("document.querySelectorAll('.preview-cell.is-mine').length"), 20);
    await click('#predictionDialog .dialog-close'); await change('#mineCount', '3');
    await click('#autoToggle'); await click('[data-index="0"]');
    await click('#autoSettings'); await setValue('#autoRounds', '2'); await submit('#autoForm');
    await click('#betButton');
    await until("document.getElementById('actionLabel').textContent === 'BET'", 'Auto game did not stop after two rounds.');
    assert.equal(await evaluate("document.getElementById('balance').textContent"), '30,001.00');
    await click('#autoToggle'); await click('#resetCredits');
    console.log('PASS preset preview, mine-count changes, bounded auto game');

    for (const width of [390, 320, 768]) {
      await viewport(width, 844, width < 650);
      assert.equal(await evaluate('document.documentElement.scrollWidth'), width, `Studio overflow at ${width}`);
      assert.ok(await evaluate("document.getElementById('betButton').getBoundingClientRect().right <= innerWidth"));
      if (width === 390) {await screenshot('studio-mobile.png'); await click('#predictLauncher'); await click('#previewRun'); await until("!document.getElementById('previewRun').disabled"); await screenshot('preview-mobile.png'); await click('#predictionDialog .dialog-close');}
    }
    // Real touch dragging must reposition the launcher without opening its dialog.
    await viewport(390, 844, true); await send('Emulation.setTouchEmulationEnabled', {enabled:true});
    const rect = await evaluate("(() => {const b=document.getElementById('predictLauncher').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2};})()");
    await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:rect.x,y:rect.y}]});
    await send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:rect.x-70,y:rect.y+70}]});
    await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    assert.ok(await evaluate("parseFloat(document.getElementById('predictLauncher').style.left) >= 0"));
    assert.equal(await evaluate("document.getElementById('predictionDialog').open"), false);
    await send('Emulation.setTouchEmulationEnabled', {enabled:false});
    console.log('PASS responsive Studio and touch dragging');

    await viewport(1440, 1000);
    await open('/', "!!document.getElementById('sceneBoard')");
    await until("location.pathname === '/registration.html' && !!document.getElementById('predictionDialog')", 'Landing did not hand off to registration.');
    await until("document.getElementById('deposit-dialog').open");
    assert.equal(await evaluate("document.querySelector('[data-deposit-amount]').textContent"), '₹1,000');
    assert.equal(await evaluate("!!document.querySelector('[data-register-external],.frame-fallback')"), false);
    assert.equal(await evaluate("getComputedStyle(document.getElementById('deposit-title')).outlineStyle"), 'none');
    assert.equal(await evaluate("document.activeElement.id"), 'deposit-title');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.wallet-art>span')).animationName"), 'wallet-coin-drop');
    await screenshot('registration-deposit-desktop.png');
    await viewport(390, 844, true); await screenshot('registration-deposit-mobile.png');
    assert.equal(await evaluate('document.documentElement.scrollWidth'), 390);
    await click('[data-deposit-claim]');
    await until("!!document.querySelector('.deposit-minimize-ghost')", 'Claim minimize animation did not start.');
    assert.ok((await evaluate("document.getElementById('dmfirst-frame').src")).endsWith('/#/wallet/Recharge'));
    await click('[data-deposit-widget]');
    assert.equal(await evaluate("document.querySelector('[data-copy-code-section]').hidden"), false);
    await click('[data-copy-code-demo]');
    await until("document.querySelector('[data-copy-code-label]').textContent === 'Complete'");
    await click('[data-dismiss-deposit]');
    await until("!document.querySelector('.deposit-minimize-ghost')");
    await evaluate("document.querySelector('[data-deposit-widget]').blur()");
    await until("document.querySelector('[data-deposit-widget]').getAnimations().some(a=>a.animationName==='deposit-widget-nudge')", 'Claim bounce did not start after focus returned to the page.');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-deposit-widget]')).animationName"), 'deposit-widget-nudge');
    assert.ok(await evaluate("(() => {const widget=document.querySelector('[data-deposit-widget]');const bounce=widget.getAnimations().find(a=>a.animationName==='deposit-widget-nudge');bounce.pause();bounce.currentTime=2050;return new DOMMatrix(getComputedStyle(widget).transform).m42 < -10;})()"), 'Claim button must visibly bounce upward.');
    await evaluate("document.querySelector('[data-deposit-widget]').getAnimations().forEach(a=>{a.pause();a.currentTime=0;})");
    assert.deepEqual(await evaluate("[...document.querySelectorAll('.registration-page>.floating-control')].map(el=>{const r=el.getBoundingClientRect();return [r.width,r.height,Math.round(innerHeight-r.bottom)];})"), [[56,56,18],[56,56,18]]);
    assert.equal(await evaluate("Math.round(innerWidth-document.querySelector('[data-deposit-widget]').getBoundingClientRect().right)"), 18);
    assert.equal(await evaluate("Math.round(document.getElementById('predictLauncher').getBoundingClientRect().left)"), 18);
    await screenshot('registration-widgets-mobile.png');
    await viewport(1440, 1000);
    assert.equal(await evaluate("Math.round(innerWidth-document.querySelector('[data-deposit-widget]').getBoundingClientRect().right)"), 24);
    assert.equal(await evaluate("Math.round(document.getElementById('predictLauncher').getBoundingClientRect().left)"), 24);
    await screenshot('registration-widgets-desktop.png');
    await viewport(390, 844, true);
    await click('#predictLauncher'); await setValue('#previewCode', 'incorrect'); await submit('#previewCodeForm');
    assert.equal(await evaluate("document.getElementById('previewCodeError').hidden"), false);
    await setValue('#previewCode', 'minesfirst'); await submit('#previewCodeForm');
    await click('#previewRun'); await until("!document.getElementById('previewRun').disabled");
    assert.equal(await evaluate("document.querySelectorAll('.preview-cell.is-pick').length"), 5);
    await screenshot('visitor-preview-mobile.png');
    await click('#predictionDialog .dialog-close');
    await send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.wallet-art>span')).animationName"), 'none');
    assert.equal(await evaluate("getComputedStyle(document.querySelector('[data-deposit-widget]')).animationName"), 'none');
    await click('#predictLauncher'); await click('#previewRun');
    assert.equal(await evaluate("document.getElementById('previewBoardWrap').getAttribute('aria-busy')"), 'false');
    await click('#predictionDialog .dialog-close');
    await send('Emulation.setEmulatedMedia', {features:[]});
    for (const route of ['/reference/spribe-mines-page.html', '/reference/aviator-source/config.js', '/tests/mines-engine.test.js', '/tools/build.mjs', '/.git/config']) {
      assert.equal((await fetch(url + route)).status, 404, route + ' must not be public');
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
    console.log('PASS registration handoff, deposit and Claim, visitor preview, reduced motion, private-file blocking');
    console.log('All browser checks passed. Screenshots: preview/');
    await send('Browser.close'); socket = null;
  } finally {
    socket?.close(); browser.kill();
    if (site) await new Promise(resolve => site.close(resolve));
    const safePrefix = path.resolve(os.tmpdir()) + path.sep + 'mines-ui-';
    if (path.resolve(profile).startsWith(safePrefix)) {
      for (let attempt = 0; attempt < 5; attempt++) {try {fs.rmSync(profile, {recursive:true, force:true}); break;} catch {await delay(200);}}
    }
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
