// Public visitor settings. This is a local preset demonstration, not live prediction.
globalThis.MINES_CONFIG = {
  presets: [
    {mines: [1, 8, 13], picks: [0, 6, 7, 12, 18]},
    {mines: [4, 11, 20], picks: [2, 7, 12, 17, 22]},
    {mines: [3, 10, 24], picks: [0, 5, 6, 16, 21]},
    {mines: [6, 17, 23], picks: [1, 8, 12, 18, 22]}
  ],
  prediction: {
    enabled: true,
    accessCode: 'minesfirst', // A public browser-side UI gate, not secure authentication.
    brand: 'DM FIRST',
    revealDurationMs: 900,
    adminContact: '@mr_kalam0'
  }
};
