// Screenshot states: loads the game's own scripts, builds three
// representative states (start screen, mid-game, end screen) with the
// game's own draw() and writes the display-list ops as JSON.
// tools/raster.py replays those exact ops into PNGs — the same code
// path the browser uses (gfx.js replayCanvas), just a different backend.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ console });
for (const f of ['game/src/gfx.js', 'game/src/levels.js', 'game/src/game.js']) {
  vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
}
const { makeGfx, loadLevel, update, draw, TILE } = ctx;
const idle = { left: false, right: false, up: false, down: false, crouch: false, run: false, pebble: null };

function shot(name, build) {
  const gfx = makeGfx();
  build(gfx);
  writeFileSync('tools/' + name + '.ops.json', JSON.stringify(gfx.ops));
  console.log(name + ': ' + gfx.ops.length + ' ops');
}

shot('1-start', (gfx) => { draw(gfx, loadLevel(0), 'start'); });

shot('2-play', (gfx) => {
  const st = loadLevel(1);
  // let the patrols settle into natural mid-route positions
  for (let i = 0; i < 240; i++) update(st, idle, 1 / 60);
  // courier crouched behind the crate row, mid-floor
  st.player.x = 6 * TILE + 16; st.player.y = 56 + 7 * TILE + 16;
  st.player.crouch = true; st.player.face = -0.4;
  st.guards[0].suspicion = 0.55; st.alarm = 0.55;
  st.noises.push({ x: st.player.x + 96, y: st.player.y - 48, t: 0.3 });
  st.time = 23.4; st.msgT = 0;
  draw(gfx, st, 'play');
});

shot('3-end', (gfx) => { draw(gfx, loadLevel(0), 'end'); });
