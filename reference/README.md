# Mines source references

## Existing project

- Source: https://github.com/git4alauddin/aviator-aff
- Downloaded into `reference/aviator-source/` on 2026-10-27.
- Source commit: `30bb72e1b759723f9238ae67fbd6a538087c768e`.
- Reused: access-sequence scheduling, registration/deposit flow, activity samples and avatars, optional audio controls, draggable-widget implementation, and static server/build pattern.
- Replaced: flight engine, Aviator visual assets, loading-page artwork, red theme, and multiplier-only preview. Mines has a separate local tile engine and new SVG artwork.
- The cloned repository is excluded from the public build and the local server.

## User-provided visual references

- `mines-idle.png`: blue field, 5×5 unopened tiles, Mines selector, yellow next multiplier, random/auto controls, green BET button.
- `mines-revealed.png`: cream stars, orange selected star, black mines, red hit tile, and cash-out state.
- Layout, colors, and controls were recreated with native HTML/CSS/SVG. The new star, mine, explosion, and favicon SVGs are locally authored reconstructions, not provider-downloaded originals.

## Provider investigation

Identified provider: SPRIBE.

- Official game page requested: https://spribe.co/games/mines
- Alternate official hostname requested: https://www.spribe.co/games/mines
- Official game catalog: https://spribe.co/games
- Official Turbo Games announcement including Mines: https://spribe.co/news/turbo-games-have-been-launched
- Official fairness explanation: https://spribe.co/provably-fair

The web fetcher returned no readable Mines page content. Direct network requests to the game page failed. Browser inspection timed out waiting for app approval. The supplied `spribe-mines-page.html` was checked on 2026-10-28 and is zero bytes. It is retained unchanged as the supplied file.

Consequently, provider assets, demo files, provider-specific payout tables, and game-server behavior could not be retrieved or verified. Visual implementation uses the supplied screenshots. The demo uses explicitly local presets and its own probability-based multiplier calculation. It is not an official SPRIBE integration or live predictor.
