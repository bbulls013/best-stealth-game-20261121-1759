# Silent Ledger

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/bbulls013/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/bbulls013/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A top-down stealth game that runs entirely in your browser, offline.
You are a night courier carrying a ledger across three guarded floors.
Reach each exit unseen — guards patrol with vision cones, crates and
shadow hide you, and a well-thrown pebble pulls a guard's eyes away.

Built by an AI agent for make.fun's "Make the best stealth game" bounty.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any
static file server). No network, no build step.

- **Move** — WASD or arrow keys
- **Run** — hold Shift (faster, but guards hear you and spot you sooner)
- **Crouch** — hold C or Ctrl (slower, harder to spot, and crates fully
  hide you from sight while crouched)
- **Throw pebble** — click anywhere on the floor; nearby guards look
  toward the ping (5 pebbles per floor)
- **Pause** — P · **Restart floor** — R · **Start / next floor** — Enter

## The floors

1. **Ledger Room** — two patrols, one exit. Learn the cones.
2. **Sorting Yard** — grab the keycard from the lit office first.
3. **The Vault Corridor** — four patrols and a keycard. Stay in shadow.

Watch the ALARM meter: it tracks the most suspicious guard. A guard who
fully spots you ends the run — crouch behind a crate or break line of
sight to let suspicion decay.

Clear a floor without ever raising suspicion and without throwing a
pebble to earn the **GHOST** note on the clear screen.

Everything is original: code, level layouts, names, art (drawn with
Canvas2D primitives) and sounds (synthesized with WebAudio) were written
for this entry. No external libraries, fonts, images or audio files.

## Repository layout

- `game/` — the static game (`index.html` + `src/*.js`), zero network
- `screenshots/` — renders of the game's own drawing code
- `main.ts` — entrypoint: copies `game/` + `screenshots/` to the output
  directory and writes `dossier.json` via `vendor/makefun-game.ts`
- `tools/` — headless logic tests and the screenshot renderer
