import {config} from './config.js';
import {mountRegistrationFlow} from './registration-flow.js';
import {mountActivityTicker} from './activity-ticker.js';
import {mountRegistrationAudio} from './registration-audio.js';
import {mountDraggableWidget} from './draggable-widget.js';
import {mountMinesPrediction} from './prediction.js';
import {makeLayout} from './mines-engine.js';
document.querySelector('link[rel="canonical"]').href = new URL('registration.html', config.siteUrl).href;
document.querySelectorAll('[data-creator-link]').forEach(link => {link.hidden = !config.creatorStudio.enabled; link.href = config.creatorStudio.url;});
let guidance = {destroy() {}};
// Register audio before the Claim handler consumes the click for iframe navigation.
if (config.guidance.enabled && config.guidance.src) {document.querySelector('[data-registration-audio]').src = config.guidance.src; guidance = mountRegistrationAudio(document);}
const flow = mountRegistrationFlow(document);
const ticker = mountActivityTicker(document.querySelector('[data-activity-ticker]'));
const settings = globalThis.MINES_CONFIG;
let presetIndex = -1;
const prediction = mountMinesPrediction(document.getElementById('predictLauncher'), settings.prediction, () => {
  const i = Math.max(0, presetIndex), preset = settings.presets[i % settings.presets.length];
  return {id:i + 1, mineCount:preset.mines.length, ...makeLayout(preset, preset.mines.length, i)};
}, {requiresCode:true, onPredict() {presetIndex++;}});
const draggables = ['[data-deposit-widget]', '#predictLauncher'].map(selector => mountDraggableWidget(document.querySelector(selector)));
window.addEventListener('pagehide', () => {flow.destroy(); ticker.destroy(); guidance.destroy(); prediction.destroy(); draggables.forEach(control => control.destroy());}, {once:true});
window.addEventListener('pageshow', event => {if (event.persisted) location.reload();});
