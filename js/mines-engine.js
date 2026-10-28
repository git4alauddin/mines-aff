// Pure local simulation. All currency arithmetic uses integer minor units.
export function multiplier(mines, revealed, returnRate = 0.97) {
  if (!Number.isInteger(mines) || mines < 1 || mines > 24) throw new RangeError('Invalid mine count.');
  if (!Number.isInteger(revealed) || revealed < 0 || revealed > 25 - mines) throw new RangeError('Invalid reveal count.');
  if (revealed === 0) return 1;
  let probability = 1;
  for (let i = 0; i < revealed; i++) probability *= (25 - mines - i) / (25 - i);
  const hundredths = returnRate / probability * 100;
  return Math.floor(hundredths + Number.EPSILON * 8 * Math.abs(hundredths)) / 100;
}

export function makeLayout(preset = {}, mineCount = 3, round = 0) {
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) throw new RangeError('Invalid mine count.');
  const valid = positions => [...new Set((Array.isArray(positions) ? positions : []).filter(n => Number.isInteger(n) && n >= 0 && n < 25))];
  const order = valid(preset.mines);
  // A repeatable permutation fills additional positions when mine count changes.
  for (let i = 0; i < 25; i++) {
    const position = ((i * 7 + round * 3) % 25 + 25) % 25;
    if (!order.includes(position)) order.push(position);
  }
  const mines = order.slice(0, mineCount);
  const safe = Array.from({length:25}, (_, i) => i).filter(i => !mines.includes(i));
  const picks = [...new Set([...valid(preset.picks).filter(i => !mines.includes(i)), ...safe])].slice(0, Math.min(5, safe.length));
  return {mines, picks};
}

export class MinesEngine {
  constructor(settings) {
    this.settings = settings;
    this.initialBalanceMinor = Math.round(settings.initialCredits * 100);
    this.balanceMinor = this.initialBalanceMinor;
    this.mineCount = settings.defaultMines;
    this.roundIndex = 0;
    this.history = [];
    this.phase = 'idle';
    this.opened = new Set();
    this.stakeMinor = 0;
    this.hit = null;
    this.refreshLayout();
  }
  refreshLayout() {
    const presets = this.settings.presets || [];
    this.layout = makeLayout(presets[this.roundIndex % (presets.length || 1)], this.mineCount, this.roundIndex);
  }
  get active() {return this.phase === 'active';}
  get safeCount() {return [...this.opened].filter(i => !this.layout.mines.includes(i)).length;}
  get currentMultiplier() {return multiplier(this.mineCount, this.safeCount, this.settings.returnRate);}
  get nextMultiplier() {return this.safeCount < 25 - this.mineCount ? multiplier(this.mineCount, this.safeCount + 1, this.settings.returnRate) : null;}
  get payoutMinor() {return Math.round(this.stakeMinor * Math.round(this.currentMultiplier * 100) / 100);}
  setMines(count) {
    if (this.active) return false;
    if (!Number.isInteger(count) || count < 1 || count > this.settings.maxMines) throw new RangeError('Invalid mine count.');
    this.mineCount = count;
    this.phase = 'idle'; this.opened.clear(); this.hit = null;
    this.refreshLayout();
    return true;
  }
  setPreset(index) {
    if (this.active) return false;
    if (!Number.isInteger(index) || index < 0) throw new RangeError('Invalid preset.');
    this.roundIndex = index; this.phase = 'idle'; this.opened.clear(); this.hit = null;
    this.refreshLayout();
    return true;
  }
  upcomingLayout() {
    const index = this.phase === 'won' || this.phase === 'lost' ? this.roundIndex + 1 : this.roundIndex;
    const presets = this.settings.presets || [];
    return {id:index + 1, mineCount:this.mineCount, ...makeLayout(presets[index % (presets.length || 1)], this.mineCount, index)};
  }
  start(stake) {
    if (this.active) return false;
    const minor = Math.round(Number(stake) * 100);
    const {minStake, maxStake} = this.settings.betting;
    if (!Number.isFinite(minor) || minor < Math.round(minStake * 100) || minor > Math.round(maxStake * 100)) throw new RangeError(`Bet must be between ${minStake} and ${maxStake}.`);
    if (minor > this.balanceMinor) throw new RangeError('Not enough virtual credits. Reduce the bet or reset your credits.');
    if (this.phase === 'won' || this.phase === 'lost') this.roundIndex++;
    this.refreshLayout(); this.opened.clear(); this.hit = null;
    this.stakeMinor = minor; this.balanceMinor -= minor; this.phase = 'active';
    return true;
  }
  reveal(index) {
    if (!this.active || !Number.isInteger(index) || index < 0 || index >= 25 || this.opened.has(index)) return null;
    this.opened.add(index);
    if (this.layout.mines.includes(index)) {this.hit = index; this.settle('lost'); return 'mine';}
    if (this.safeCount === 25 - this.mineCount) this.settle('won');
    return 'star';
  }
  cashOut() {
    if (!this.active || this.safeCount === 0) return false;
    this.settle('won'); return true;
  }
  settle(result) {
    if (!this.active) return;
    const payoutMinor = result === 'won' ? this.payoutMinor : 0;
    this.balanceMinor += payoutMinor;
    this.phase = result;
    this.history.unshift({id:this.roundIndex + 1, mines:this.mineCount, stars:this.safeCount, stakeMinor:this.stakeMinor, payoutMinor, multiplier:result === 'won' ? this.currentMultiplier : 0, result});
    this.history = this.history.slice(0, 50);
  }
  resetCredits() {
    if (this.active) return false;
    this.balanceMinor = this.initialBalanceMinor; this.history = []; this.roundIndex = 0;
    this.phase = 'idle'; this.opened.clear(); this.hit = null; this.refreshLayout(); return true;
  }
}
