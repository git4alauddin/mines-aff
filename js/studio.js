import {MinesEngine, multiplier} from './mines-engine.js';
import {mountMinesPrediction} from './prediction.js';
import {mountDraggableWidget} from './draggable-widget.js';
const settings = globalThis.MINES_CONFIG;
const $ = selector => document.querySelector(selector);
const gate = $('#studioGate'), app = $('#studioApp'), gateInput = $('#studioPassword');
let mounted = false;
$('#studioGateForm').addEventListener('submit', event => {
  event.preventDefault();
  if (mounted) return;
  if (!settings.studio?.accessCode || gateInput.value.trim() !== settings.studio.accessCode) {
    $('#studioGateError').textContent = 'Incorrect creator password. Please try again.';
    $('#studioGateError').hidden = false; gateInput.setAttribute('aria-invalid', 'true'); gateInput.focus(); return;
  }
  gateInput.value = ''; mounted = true; gate.hidden = true; app.hidden = false; app.inert = false;
  mountStudio(); $('#menuButton').focus();
});
gateInput.addEventListener('input', () => {$('#studioGateError').hidden = true; gateInput.removeAttribute('aria-invalid');});

function mountStudio() {
  const model = new MinesEngine(settings);
  const money = new Intl.NumberFormat(settings.locale, {style:'currency', currency:settings.currency, minimumFractionDigits:2, maximumFractionDigits:2});
  const amount = minor => money.format(minor / 100);
  const balanceFormatter = new Intl.NumberFormat(settings.locale, {minimumFractionDigits:2, maximumFractionDigits:2});
  const stake = $('#stake'), mineSelect = $('#mineCount');
  let preview, autoTimer, toastTimer, autoRunning = false, roundsLeft = 0, soundContext;
  let autoRounds = settings.autoplay.defaultRounds;
  const selected = new Set();
  const tiles = Array.from({length:25}, (_, i) => {
    const tile = document.createElement('button'); tile.type = 'button'; tile.className = 'game-tile'; tile.dataset.index = i;
    tile.innerHTML = '<span class="tile-dot"></span><img alt="" hidden>';
    tile.addEventListener('click', () => tileClicked(i));
    tile.addEventListener('keydown', event => {
      const offset = {ArrowRight:1, ArrowLeft:-1, ArrowDown:5, ArrowUp:-5}[event.key];
      if (offset !== undefined) {event.preventDefault(); const target = tiles[Math.max(0, Math.min(24, i + offset))]; if (!target.disabled) target.focus();}
    });
    $('#minesGrid').append(tile); return tile;
  });
  for (let count = 1; count <= settings.maxMines; count++) {const option = document.createElement('option'); option.value = count; option.textContent = `Mines: ${count}`; mineSelect.append(option);}
  mineSelect.value = model.mineCount;
  Object.assign(stake, {value:settings.betting.defaultStake, min:settings.betting.minStake, max:settings.betting.maxStake, step:settings.betting.step});
  $('#currency').textContent = settings.currency;
  document.querySelectorAll('[data-currency-label]').forEach(el => el.textContent = settings.currency);
  $('#studioDisclaimer').hidden = !settings.disclaimer.enabled;
  $('#studioDisclaimer').textContent = settings.disclaimer.text;
  $('#autoRounds').value = autoRounds; $('#autoRounds').max = settings.autoplay.maxRounds;

  function status(text, error = false) {$('#gameStatus').textContent = text; $('#gameStatus').classList.toggle('is-error', error);}
  function hideToast() {clearTimeout(toastTimer); $('#roundToast').hidden = true;}
  function sound(kind) {
    if (!$('#soundToggle').checked || !soundContext) return;
    void soundContext.resume().catch(() => {});
    const oscillator = soundContext.createOscillator(), volume = soundContext.createGain(), now = soundContext.currentTime;
    oscillator.type = kind === 'mine' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(kind === 'mine' ? 140 : kind === 'win' ? 740 : 520, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'mine' ? 45 : kind === 'win' ? 1100 : 820, now + .12);
    volume.gain.setValueAtTime(.045, now); volume.gain.exponentialRampToValueAtTime(.001, now + .18);
    oscillator.connect(volume); volume.connect(soundContext.destination); oscillator.start(); oscillator.stop(now + .2);
  }
  function render() {
    const ended = model.phase === 'won' || model.phase === 'lost';
    tiles.forEach((tile, i) => {
      const opened = model.opened.has(i), mine = model.layout.mines.includes(i);
      const state = ended ? mine ? i === model.hit ? 'hit' : 'mine' : opened ? 'star' : 'revealed'
        : opened ? 'star' : !model.active && $('#autoToggle').checked && selected.has(i) ? 'selected' : 'hidden';
      const changed = tile.dataset.state !== state;
      tile.dataset.state = state;
      const icon = tile.querySelector('img');
      icon.hidden = !['star', 'revealed', 'mine', 'hit'].includes(state);
      tile.querySelector('.tile-dot').hidden = !icon.hidden;
      if (!icon.hidden) icon.src = `./assets/images/${state === 'hit' ? 'burst' : state === 'mine' ? 'mine' : 'star'}.svg`;
      tile.disabled = autoRunning || (model.active ? opened : !$('#autoToggle').checked);
      tile.setAttribute('aria-pressed', String(!model.active && $('#autoToggle').checked && selected.has(i)));
      tile.setAttribute('aria-label', `Row ${Math.floor(i / 5) + 1}, column ${i % 5 + 1}: ${state === 'hidden' ? 'unopened' : state === 'revealed' ? 'star' : state === 'hit' ? 'mine hit' : state}`);
      if (changed) {tile.classList.remove('pop'); if (opened && state === 'star') {void tile.offsetWidth; tile.classList.add('pop');}}
    });
    $('#balance').textContent = balanceFormatter.format(model.balanceMinor / 100);
    const next = ended ? model.upcomingLayout() : null;
    $('#nextMultiplier').textContent = `Next: ${(ended ? initialMultiplier() : model.nextMultiplier)?.toFixed(2) ?? 'MAX'}x`;
    $('#roundProgress').style.width = `${ended ? 0 : model.safeCount / (25 - model.mineCount) * 100}%`;
    const locked = model.active || autoRunning;
    [stake, $('#betMinus'), $('#betPlus'), $('#quickBetButton'), mineSelect, $('#autoToggle'), $('#nextPreset'), $('#resetCredits')].forEach(el => el.disabled = locked);
    $('#autoSettings').disabled = locked;
    $('#randomButton').disabled = autoRunning || (!model.active && !$('#autoToggle').checked);
    $('#betButton').disabled = !autoRunning && model.active && model.safeCount === 0;
    $('#betButton').classList.toggle('is-cashout', model.active && !autoRunning);
    $('#betButton').classList.toggle('is-stop', autoRunning);
    $('#actionLabel').textContent = autoRunning ? 'STOP AUTO GAME' : model.active ? 'CASH OUT' : 'BET';
    $('#actionAmount').hidden = !model.active || autoRunning;
    $('#actionAmount').textContent = amount(model.payoutMinor);
    $('#roundLabel').textContent = `PRESET ${String(next?.id ?? model.roundIndex + 1).padStart(2, '0')} / ${model.mineCount} MINES${autoRunning ? ` / ${roundsLeft} LEFT` : ''}`;
    preview?.sync();
  }
  function initialMultiplier() {
    // Calculate with the same demo return rate, independent of the completed round.
    return multiplier(model.mineCount, 1, settings.returnRate);
  }
  function completed() {
    if (model.phase === 'won') {
      $('#toastLabel').textContent = model.safeCount === 25 - model.mineCount ? 'FIELD CLEARED' : 'YOU CASHED OUT';
      $('#toastMultiplier').textContent = `${model.currentMultiplier.toFixed(2)}x`;
      $('#toastAmount').textContent = amount(model.payoutMinor); $('#roundToast').hidden = false;
      toastTimer = setTimeout(hideToast, 2100);
      status(`Cashed out ${amount(model.payoutMinor)} at ${model.currentMultiplier.toFixed(2)}x. Start another round when ready.`); sound('win');
    } else {status('Mine hit. Round over — choose BET to start a new field.'); sound('mine');}
  }
  function reveal(index) {
    const result = model.reveal(index);
    if (!result) return;
    if (!model.active) completed();
    else {sound('star'); status(`${model.safeCount} ${model.safeCount === 1 ? 'star' : 'stars'} found · ${model.currentMultiplier.toFixed(2)}x. Cash out or choose another tile.`);}
    render();
  }
  function tileClicked(index) {
    if (autoRunning) return;
    hideToast();
    if (model.active) reveal(index);
    else if ($('#autoToggle').checked) {
      if (model.phase !== 'idle') model.setPreset(model.upcomingLayout().id - 1);
      if (selected.has(index)) selected.delete(index); else selected.add(index);
      status(`${selected.size} ${selected.size === 1 ? 'tile' : 'tiles'} selected. Auto game will open these tiles each round.`); render();
    }
  }
  function startRound() {
    try {if (!model.start(stake.value)) return false;}
    catch (error) {status(error.message, true); return false;}
    hideToast(); status('Choose a tile to find a star.'); render(); return true;
  }
  function cashOut() {if (model.cashOut()) {completed(); render();}}
  function stopAuto(message = 'Auto game stopped.') {
    clearTimeout(autoTimer); autoRunning = false; roundsLeft = 0;
    if (model.active && model.safeCount > 0) cashOut();
    status(model.active ? `${message} Finish this round manually.` : message); render();
  }
  function scheduleAutoRound() {
    if (!autoRunning) return;
    if (roundsLeft <= 0) {stopAuto('Auto game complete.'); return;}
    if (!startRound()) {const message = $('#gameStatus').textContent; stopAuto(message); $('#gameStatus').classList.add('is-error'); return;}
    roundsLeft--;
    const picks = [...selected]; let index = 0;
    const step = () => {
      if (!autoRunning) return;
      if (model.active && index < picks.length) reveal(picks[index++]);
      if (!model.active || index === picks.length) {
        if (model.active) cashOut();
        render(); autoTimer = setTimeout(scheduleAutoRound, settings.autoplay.roundDelayMs);
      } else autoTimer = setTimeout(step, settings.autoplay.revealDelayMs);
    };
    render(); autoTimer = setTimeout(step, settings.autoplay.revealDelayMs);
  }
  $('#betButton').addEventListener('click', () => {
    if (autoRunning) {stopAuto(); return;}
    if (model.active) {cashOut(); return;}
    if ($('#autoToggle').checked) {
      if (!selected.size) {status('Select at least one tile for auto game.', true); return;}
      autoRunning = true; roundsLeft = autoRounds; scheduleAutoRound();
    } else startRound();
  });
  mineSelect.addEventListener('change', () => {model.setMines(Number(mineSelect.value)); hideToast(); status('Field updated. Choose BET when ready.'); render();});
  $('#randomButton').addEventListener('click', () => {
    const candidates = Array.from({length:25}, (_, i) => i).filter(i => model.active ? !model.opened.has(i) : !selected.has(i));
    if (!candidates.length) {status('Every tile is selected.'); return;}
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    tileClicked(candidates[Math.floor(random * candidates.length)]);
  });
  $('#autoToggle').addEventListener('change', () => {
    hideToast();
    if (model.phase !== 'idle') model.setPreset(model.upcomingLayout().id - 1);
    status($('#autoToggle').checked ? 'Select tiles on the field, then press BET to start auto game.' : 'Auto game off. Choose BET to play manually.'); render();
  });
  function changeStake(delta) {
    const current = Number(stake.value);
    stake.value = Math.max(settings.betting.minStake, Math.min(settings.betting.maxStake, (Number.isFinite(current) ? current : settings.betting.defaultStake) + delta));
  }
  $('#betMinus').addEventListener('click', () => changeStake(-settings.betting.step));
  $('#betPlus').addEventListener('click', () => changeStake(settings.betting.step));
  const open = id => $(id).showModal();
  ['#gameInfo', '#helpButton'].forEach(id => $(id).addEventListener('click', () => open('#helpDialog')));
  $('#menuButton').addEventListener('click', () => open('#settingsDialog'));
  $('#settingsHelp').addEventListener('click', () => {$('#settingsDialog').close(); open('#helpDialog');});
  $('#quickBetButton').addEventListener('click', () => open('#quickBetDialog'));
  settings.betting.presets.forEach(value => {const button = document.createElement('button'); button.type = 'button'; button.textContent = amount(value * 100); button.addEventListener('click', () => {if (!model.active && !autoRunning) stake.value = value; $('#quickBetDialog').close();}); $('#quickBets').append(button);});
  $('#autoSettings').addEventListener('click', () => open('#autoDialog'));
  $('#autoForm').addEventListener('submit', event => {
    event.preventDefault(); const count = Number($('#autoRounds').value);
    if (!Number.isInteger(count) || count < 1 || count > settings.autoplay.maxRounds) {$('#autoRounds').reportValidity(); return;}
    autoRounds = count; $('#autoDialog').close(); status(`Auto game set to ${count} rounds. Select tiles to play.`);
  });
  $('#soundToggle').addEventListener('change', () => {
    if ($('#soundToggle').checked && !soundContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) soundContext = new AudioContextClass();
      else {$('#soundToggle').checked = false; status('Sound is unavailable in this browser.');}
    }
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {if (event.target === dialog) {const b = dialog.getBoundingClientRect(); if (event.clientX < b.left || event.clientX > b.right || event.clientY < b.top || event.clientY > b.bottom) dialog.close();}});
  });
  $('#historyButton').addEventListener('click', () => {
    const content = $('#historyContent'); content.replaceChildren();
    if (!model.history.length) {const note = document.createElement('p'); note.textContent = 'No completed rounds yet.'; content.append(note);}
    else {
      const table = document.createElement('table'); table.className = 'history-table';
      table.innerHTML = '<thead><tr><th scope="col">ROUND</th><th scope="col">STARS</th><th scope="col">BET</th><th scope="col">RETURN</th></tr></thead><tbody></tbody>';
      model.history.forEach(round => {const row = document.createElement('tr'); [String(round.id).padStart(2, '0'), `${round.stars} / ${25 - round.mines}`, amount(round.stakeMinor), round.result === 'won' ? `${amount(round.payoutMinor)} (${round.multiplier.toFixed(2)}x)` : 'Mine hit'].forEach((text, i) => {const cell = document.createElement('td'); cell.textContent = text; if (i === 3) cell.className = round.result === 'won' ? 'win' : 'loss'; row.append(cell);}); table.querySelector('tbody').append(row);}); content.append(table);
    }
    open('#historyDialog');
  });
  $('#nextPreset').addEventListener('click', () => {if (model.setPreset(model.roundIndex + 1)) {hideToast(); status('Next preset loaded.'); render();}});
  $('#resetCredits').addEventListener('click', () => {if (model.resetCredits()) {hideToast(); status('Virtual credits reset.'); render();}});
  preview = mountMinesPrediction($('#predictLauncher'), settings.prediction, () => model.active ? {id:model.roundIndex + 1, mineCount:model.mineCount, ...model.layout} : model.upcomingLayout());
  const draggable = mountDraggableWidget($('#predictLauncher'), {boundsElement:$('#gameSurface')});
  render();
  document.addEventListener('visibilitychange', () => {if (document.hidden && autoRunning) stopAuto('Auto game paused because the tab was hidden.');});
  window.addEventListener('pagehide', () => {clearTimeout(autoTimer); clearTimeout(toastTimer); preview.destroy(); draggable.destroy(); if (soundContext) void soundContext.close();}, {once:true});
}
window.addEventListener('pageshow', event => {if (event.persisted) location.reload();});
