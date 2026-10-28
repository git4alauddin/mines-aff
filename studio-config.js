// Creator Studio only. Tile positions are zero-based, left-to-right, top-to-bottom.
globalThis.MINES_CONFIG = {
  currency: 'INR',
  locale: 'en-IN',
  initialCredits: 29999,
  defaultMines: 3,
  maxMines: 20,
  returnRate: 0.97, // Local demo mathematics, not a verified provider payout table.
  betting: {defaultStake: 10, minStake: 10, maxStake: 100000, step: 10, presets: [10, 100, 500, 1000]},
  presets: [
    {mines: [1, 8, 13], picks: [0, 6, 7, 12, 18]},
    {mines: [4, 11, 20], picks: [2, 7, 12, 17, 22]},
    {mines: [3, 10, 24], picks: [0, 5, 6, 16, 21]},
    {mines: [6, 17, 23], picks: [1, 8, 12, 18, 22]}
  ],
  studio: {accessCode: '@creator'},
  disclaimer: {enabled: true, text: 'CREATOR STUDIO · SIMULATION · VIRTUAL CREDITS'},
  prediction: {enabled: true, brand: 'DM FIRST', revealDurationMs: 900},
  autoplay: {defaultRounds: 5, maxRounds: 100, revealDelayMs: 450, roundDelayMs: 1200}
};
