// Shared visitor/Studio preview. No access to or communication with game iframes.
export function mountMinesPrediction(launcher, settings, getRound, {requiresCode = false, onPredict = () => {}} = {}) {
  launcher.hidden = !settings.enabled;
  const dialog = document.createElement('dialog');
  dialog.id = 'predictionDialog';
  dialog.className = 'prediction-dialog';
  dialog.setAttribute('aria-labelledby', 'predictionTitle');
  dialog.innerHTML = `
    <header class="dialog-header"><span><b data-preview-brand></b> / PRESET PREVIEW</span><button class="dialog-close" type="button" aria-label="Close preset preview">×</button></header>
    <div class="dialog-body">
      <p class="eyebrow">MINES / LOCAL SIMULATION</p><h2 id="predictionTitle" tabindex="-1">Mines preview</h2>
      <section id="previewAccess"><p>Enter your access code to open the Mines preset panel.</p>
        <form id="previewCodeForm" novalidate><label for="previewCode">Access code</label><input id="previewCode" type="password" required maxlength="128" autocomplete="off" spellcheck="false" aria-describedby="previewCodeError"><p class="error" id="previewCodeError" role="alert" hidden></p><button class="primary" type="submit">Unlock preview <span>↗</span></button></form>
        <p class="preview-contact">Contact Admin <b data-preview-contact></b></p>
      </section>
      <section id="previewResult" hidden>
        <div class="preview-round"><span id="previewRound">Preset 01</span><b id="previewMineCount">3 mines</b></div>
        <div class="preview-board-wrap" id="previewBoardWrap" aria-busy="false"><div class="preview-board" id="previewBoard" aria-label="Preset tile layout"></div><div class="preview-scan" aria-hidden="true"></div></div>
        <div class="preview-legend"><span><i class="legend-star"></i>Preset star</span><span><i class="legend-mine"></i>Mine</span></div>
        <button class="primary" id="previewRun" type="button">Reveal preset <span>↗</span></button>
        <p id="previewStatus" class="preview-status" role="status">Reveal the selected demonstration layout.</p>
      </section>
    </div><footer class="dialog-footer"><span>PREDETERMINED LAYOUT</span><span>NO LIVE GAME DATA</span></footer>`;
  document.body.append(dialog);
  const select = selector => dialog.querySelector(selector);
  select('[data-preview-brand]').textContent = settings.brand || 'DM FIRST';
  select('[data-preview-contact]').textContent = settings.adminContact || '';
  const board = select('#previewBoard');
  const cells = Array.from({length:25}, (_, i) => {
    const cell = document.createElement('span'); cell.className = 'preview-cell'; cell.setAttribute('role', 'img'); cell.setAttribute('aria-label', `Tile ${i + 1}: hidden`); board.append(cell); return cell;
  });
  let unlocked = !requiresCode, timer, roundKey = '', generation = 0;
  function key(round) {return JSON.stringify([round.id, round.mineCount, round.mines, round.picks]);}
  function reset() {
    clearTimeout(timer); generation++;
    select('#previewBoardWrap').classList.remove('scanning');
    select('#previewBoardWrap').setAttribute('aria-busy', 'false');
    select('#previewRun').disabled = false;
    select('#previewRun').innerHTML = 'Reveal preset <span>↗</span>';
    cells.forEach((cell, i) => {cell.className = 'preview-cell'; cell.replaceChildren(); cell.setAttribute('aria-label', `Tile ${i + 1}: hidden`);});
    const round = getRound(); roundKey = key(round);
    select('#previewRound').textContent = `Preset ${String(round.id).padStart(2, '0')}`;
    select('#previewMineCount').textContent = `${round.mineCount} mines`;
    select('#previewStatus').textContent = 'Reveal the selected demonstration layout.';
  }
  function open() {
    reset();
    select('#previewAccess').hidden = unlocked;
    select('#previewResult').hidden = !unlocked;
    select('#previewCodeError').hidden = true;
    dialog.showModal(); launcher.setAttribute('aria-expanded', 'true');
    (unlocked ? select('#predictionTitle') : select('#previewCode')).focus();
  }
  function close() {dialog.close();}
  function onClose() {reset(); select('#previewCode').value = ''; launcher.setAttribute('aria-expanded', 'false'); launcher.focus();}
  function unlock(event) {
    event.preventDefault();
    const input = select('#previewCode');
    if (!settings.accessCode || input.value.trim() !== settings.accessCode) {
      select('#previewCodeError').textContent = 'Incorrect access code. Please try again.';
      select('#previewCodeError').hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return;
    }
    unlocked = true; input.value = ''; input.removeAttribute('aria-invalid');
    select('#previewAccess').hidden = true; select('#previewResult').hidden = false; select('#predictionTitle').focus();
  }
  function run() {
    onPredict(); reset();
    const round = getRound(), currentGeneration = generation;
    select('#previewRun').disabled = true;
    select('#previewBoardWrap').classList.add('scanning'); select('#previewBoardWrap').setAttribute('aria-busy', 'true');
    select('#previewStatus').textContent = 'Revealing local preset…';
    const show = () => {
      if (!dialog.open || currentGeneration !== generation || key(getRound()) !== key(round)) return;
      select('#previewBoardWrap').classList.remove('scanning'); select('#previewBoardWrap').setAttribute('aria-busy', 'false');
      cells.forEach((cell, i) => {
        const mine = round.mines.includes(i), pick = round.picks.includes(i);
        cell.className = `preview-cell${mine ? ' is-mine' : pick ? ' is-pick' : ''}`;
        if (mine || pick) {const icon = document.createElement('img'); icon.src = `./assets/images/${mine ? 'mine' : 'star'}.svg`; icon.alt = ''; cell.append(icon);}
        cell.setAttribute('aria-label', `Tile ${i + 1}: ${mine ? 'mine' : pick ? 'preset star' : 'unselected'}`);
      });
      select('#previewRun').disabled = false; select('#previewRun').innerHTML = 'Reveal again <span>↻</span>';
      select('#previewStatus').textContent = 'Preset ready. This layout does not predict a live game.';
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) show();
    else timer = setTimeout(show, Math.max(0, settings.revealDurationMs || 900));
  }
  const backdrop = event => {if (event.target === dialog) {const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) close();}};
  launcher.addEventListener('click', open); select('.dialog-close').addEventListener('click', close);
  dialog.addEventListener('close', onClose); dialog.addEventListener('click', backdrop);
  select('#previewCodeForm').addEventListener('submit', unlock); select('#previewRun').addEventListener('click', run);
  return {
    sync() {if (dialog.open && key(getRound()) !== roundKey) {reset(); select('#previewStatus').textContent = 'Round changed. Reveal the new preset.';}},
    destroy() {clearTimeout(timer); generation++; launcher.removeEventListener('click', open); dialog.remove();}
  };
}
