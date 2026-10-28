import test from 'node:test';
import assert from 'node:assert/strict';
import {MinesEngine, makeLayout, multiplier} from '../js/mines-engine.js';
const settings = {
  initialCredits:29999, defaultMines:3, maxMines:20, returnRate:.97,
  betting:{minStake:10, maxStake:100000},
  presets:[{mines:[1,8,13], picks:[0,6,7,12,18]}, {mines:[4,11,20], picks:[2,7,12,17,22]}]
};
test('demo payout follows conditional survival odds and floors displayed multipliers', () => {
  assert.equal(multiplier(3, 0), 1);
  assert.equal(multiplier(3, 1), 1.10);
  assert.equal(multiplier(3, 2), 1.25);
  assert.equal(multiplier(20, 1), 4.85);
  assert.equal(multiplier(1, 24), 24.25);
  assert.throws(() => multiplier(3, 23), RangeError);
  assert.throws(() => multiplier(25, 1), RangeError);
});
test('cash-out settles exactly once and repeated clicks cannot change the balance', () => {
  const engine = new MinesEngine(settings);
  assert.equal(engine.start(10), true);
  assert.equal(engine.balanceMinor, 2998900);
  assert.equal(engine.cashOut(), false);
  assert.equal(engine.start(100), false);
  assert.equal(engine.reveal(0), 'star');
  assert.equal(engine.reveal(0), null);
  assert.equal(engine.currentMultiplier, 1.10);
  assert.equal(engine.payoutMinor, 1100);
  assert.equal(engine.cashOut(), true);
  assert.equal(engine.balanceMinor, 3000000);
  assert.equal(engine.cashOut(), false);
  assert.equal(engine.reveal(1), null);
  assert.equal(engine.history.length, 1);
  assert.equal(engine.history[0].payoutMinor, 1100);
});
test('a mine loses only the stake and the next preview matches the next round', () => {
  const engine = new MinesEngine(settings);
  engine.start(10); engine.reveal(1);
  assert.equal(engine.phase, 'lost');
  assert.equal(engine.balanceMinor, 2998900);
  assert.equal(engine.history[0].payoutMinor, 0);
  assert.equal(engine.cashOut(), false);
  const upcoming = engine.upcomingLayout();
  assert.equal(upcoming.id, 2);
  engine.start(20);
  assert.deepEqual(engine.layout.mines, upcoming.mines);
  assert.equal(engine.roundIndex, 1);
});
test('bet validation leaves state untouched and accounts for paise', () => {
  const engine = new MinesEngine({...settings, initialCredits:15.25});
  for (const bad of [NaN, Infinity, -10, 0, 9.99, 100001, 15.26]) {
    assert.throws(() => engine.start(bad), RangeError);
    assert.equal(engine.balanceMinor, 1525);
    assert.equal(engine.phase, 'idle');
  }
  engine.start(10.15); engine.reveal(0); engine.cashOut();
  assert.equal(engine.payoutMinor, 1117);
  assert.equal(engine.balanceMinor, 1627);
});
test('all safe tiles automatically cash out and active field settings cannot change', () => {
  const engine = new MinesEngine({...settings, defaultMines:20});
  engine.start(10);
  assert.equal(engine.setMines(3), false);
  assert.equal(engine.setPreset(8), false);
  assert.equal(engine.resetCredits(), false);
  const safe = Array.from({length:25}, (_, i) => i).filter(i => !engine.layout.mines.includes(i));
  safe.forEach(i => engine.reveal(i));
  assert.equal(engine.phase, 'won');
  assert.equal(engine.history.length, 1);
  assert.equal(engine.history[0].stars, 5);
  assert.equal(engine.resetCredits(), true);
  assert.equal(engine.balanceMinor, 2999900);
  assert.equal(engine.history.length, 0);
});
test('layouts remain valid for every mine count and exclude mines from preview picks', () => {
  for (let round = 0; round < 10; round++) for (let count = 1; count <= 20; count++) {
    const preset = round % 2 ? {mines:[1,1,-1,30,4.5], picks:[1,0,0,24]} : settings.presets[0];
    const layout = makeLayout(preset, count, round);
    assert.equal(new Set(layout.mines).size, count);
    assert.equal(layout.picks.length, Math.min(5, 25 - count));
    assert.ok(layout.picks.every(i => !layout.mines.includes(i)));
    assert.deepEqual(layout, makeLayout(preset, count, round));
  }
});
