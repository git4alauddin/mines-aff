import {config} from './config.js';
import {playAccessSequence} from './animations.js';
const root = document.documentElement;
const preview = new URLSearchParams(location.search).get('preview') === '1';
const board = document.getElementById('sceneBoard');
for (let i = 0; i < 25; i++) {
  const cell = document.createElement('span');
  cell.className = 'scene-cell';
  cell.innerHTML = '<img src="./assets/images/star.svg" alt="">';
  board.append(cell);
}
const cells = [...board.children];
const route = document.getElementById('continueLink');
route.href = config.registrationPage;
document.querySelector('link[rel="canonical"]').href = new URL('/', config.siteUrl).href;
document.querySelector('[data-year]').textContent = new Date().getFullYear();
document.getElementById('previewNotice').hidden = !preview;
document.querySelectorAll('[data-creator-link]').forEach(link => {link.href = config.creatorStudio.url; link.hidden = !config.creatorStudio.enabled;});
const clock = document.querySelector('[data-clock]');
function updateClock() {const now = new Date(); clock.textContent = now.toLocaleTimeString('en-GB', {hour12:false}); clock.dateTime = now.toISOString();}
updateClock();
const timer = setInterval(updateClock, 1000);
const thresholds = [0, 20, 42, 70, 100];
const highlights = [0, 6, 12, 18, 24, 8, 16];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastProgress = -1;
const stop = playAccessSequence({
  timing: config.sequence,
  onUpdate({progress, stage}) {
    root.style.setProperty('--progress', `${progress}%`);
    root.dataset.stage = stage;
    if (progress === lastProgress) return;
    lastProgress = progress;
    document.querySelector('[data-progress-value]').textContent = progress;
    document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', progress);
    cells.forEach((cell, i) => cell.classList.toggle('revealed', highlights.includes(i) && (reduced || highlights.indexOf(i) < Math.ceil(progress / 15))));
    document.querySelector('[data-diagnostic]').textContent = `0x${(progress * 731).toString(16).padStart(4, '0').toUpperCase()} // MINES.UI`;
    document.querySelectorAll('[data-console-step]').forEach((step, i) => {
      const start = thresholds[i], end = thresholds[i + 1] ?? 100;
      const done = progress >= end, current = progress >= start && !done;
      step.classList.toggle('is-done', done);
      step.classList.toggle('is-current', current);
      const copy = step.querySelector('[data-console-copy]');
      const text = copy.dataset.line;
      const fraction = Math.min(1, Math.max(0, (progress - start) / Math.max(1, end - start)));
      copy.textContent = reduced || done || !current ? text : text.slice(0, Math.max(1, Math.ceil(fraction * text.length)));
    });
    document.querySelectorAll('[data-status-tile]').forEach((tile, i) => {const ready = progress >= [15, 42, 70, 100][i]; tile.classList.toggle('ready', ready); tile.querySelector('[data-tile-label]').textContent = ready ? ['LOADED', 'ATTACHED', 'READY', 'OPEN'][i] : ['LOADING', 'STANDBY', 'STANDBY', 'LOCKED'][i];});
    if (progress === 100) {
      document.querySelector('[data-terminal-title]').textContent = 'Your access is ready';
      document.querySelector('[data-progress-label]').textContent = 'FIELD READY';
      document.querySelector('[data-session-status]').textContent = 'COMPLETE';
      document.querySelector('[data-access-status]').textContent = 'ACCESS READY';
      document.getElementById('boardStatus').textContent = 'FIELD INITIALIZED';
      document.querySelector('[data-portal-status]').textContent = 'ACCESS READY';
    }
  },
  onComplete() {
    route.hidden = false;
    document.querySelector('[data-redirect-status]').textContent = preview ? 'Ready. Continue whenever you like.' : 'Opening registration…';
    document.getElementById('sequence-announcement').textContent = 'Access ready.';
    if (!preview) location.assign(config.registrationPage);
  }
});
window.addEventListener('pagehide', () => {stop(); clearInterval(timer);}, {once:true});
window.addEventListener('pageshow', event => {if (event.persisted) location.reload();});
