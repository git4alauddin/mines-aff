# Mines × DM FIRST

Mines version of [aviator-aff](https://github.com/git4alauddin/aviator-aff), with a blue-and-orange 5×5 game interface based on the supplied screenshots. Static HTML, CSS, and JavaScript; Node 20+ for the local server and build. No dependencies to install.

## Run

```powershell
npm start
```

- `http://127.0.0.1:4173/` — animated access terminal, then registration.
- `http://127.0.0.1:4173/?preview=1` — hold the landing page for review.
- `http://127.0.0.1:4173/registration.html` — referral wrapper, deposit details, and visitor preset preview.
- `http://127.0.0.1:4173/creator-studio.html` — playable Creator Studio.

Creator Studio password: `@creator`. Visitor preview code: `minesfirst`. These are public browser-side UI gates, not secure authentication.

## What is included

- Mines access terminal with a glowing cyan frame, scanlines, falling diagnostic text, a hooded silhouette behind the tile visualizer, typed console steps, segmented loading, and automatic registration handoff. Reduced motion disables the decorative animation.
- Original DM FIRST referral and wallet destinations, ₹1,000 minimum-deposit prompt, Claim flow, and draggable widgets.
- Fictional activity samples, visibly labeled Sample. Copy Code retains the original visual simulation and does not copy an access code.
- Responsive Creator Studio with INR virtual credits, 1–20 mines, configurable bet amounts, star and mine reveals, random tile selection, cash-out, quick bets, round history, optional sound effects, and credit reset.
- Auto Game: switch it on, select tiles, configure 1–100 rounds, then press BET. Stop ends further automatic play; a round without a revealed star remains available to finish manually. Hiding the tab stops autoplay.
- A draggable PREDICT control opens the local preset layout. Studio previews follow the current/next simulated round; visitor previews cycle through their own presets.
- Reduced-motion support, accessible dialogs, keyboard controls, desktop and mobile layouts.

## Configuration

| File | Settings |
| --- | --- |
| `js/config.js` | Referral and wallet URLs, site URL, minimum deposit, popup/landing timing, activity interval, optional voice recording |
| `config.js` | Visitor access code and preset layouts |
| `studio-config.js` | Studio password, initial credits, INR/display locale, mine count, bet limits, presets, autoplay timing, preview timing, simulation bar |

Tile indexes are **0–24**, left-to-right and top-to-bottom. For example:

```js
{mines: [1, 8, 13], picks: [0, 6, 7, 12, 18]}
```

`mines` fixes the demonstration layout. `picks` chooses highlighted safe tiles in the preview. Changing the mine count deterministically fills or truncates the mine list and removes unsafe preview picks. Reload after editing config files. Configurations are public assets and must not contain secrets.

The local multiplier uses `0.97 / probability of surviving the selected number of tiles`, floored to two decimal places. It is demo mathematics, not a provider-certified payout table. All balances use integer minor units. Neither the game nor PREDICT reads the external iframe or connects to a live game.

The Mines voice recording is at `assets/audio/mines_guide.mp3` and guidance is enabled in `js/config.js`. Guidance starts on the first Close or Claim click in the deposit popup, with stop/replay controls available afterward. To replace it, use the same filename or update `guidance.src`, then refresh. Rebuild after changing audio for a hosted build. Set `guidance.enabled` to `false` to disable voice guidance.

## Check and build

```powershell
npm run check
npm test
npm run test:ui
npm run build
```

The browser checks require installed Chrome or Edge. They use an isolated headless profile, block the external registration host, verify game and portal flows, and save screenshots under `preview/`. Real registration, external iframe availability, and wallet actions are not verified.

`dist/` contains only public pages, assets, scripts, and styles. Reference materials, cloned source, tests, IDE files, and development tools are excluded. The local server uses the same public allowlist. `wrangler.jsonc` is prepared for static hosting; no deployment or DNS change has been performed. The site URL defaults to `https://mines.kalam.trade` and is configurable.

## References

The supplied reference screenshots are saved in `reference/mines-idle.png` and `reference/mines-revealed.png`. See [reference/README.md](reference/README.md) for provenance and the provider-fetch limitation.
