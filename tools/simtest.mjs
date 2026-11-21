// Headless logic test: loads the game's own scripts in a vm (no DOM),
// then checks detection, line of sight, movement and win/lose paths.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ctx = vm.createContext({ console });
for (const f of ['game/src/gfx.js', 'game/src/levels.js', 'game/src/game.js']) {
  vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
}
const { loadLevel, update, visibility, losClear, LEVELS, TILE, HUD } = ctx;
let fails = 0;
function check(name, cond) { console.log((cond ? 'PASS' : 'FAIL') + ' ' + name); if (!cond) fails++; }

check('3 levels load', LEVELS.length === 3);
for (let i = 0; i < 3; i++) {
  const st = loadLevel(i);
  check('level ' + i + ' has player+exit+guards', !!st.player && !!st.exit && st.guards.length >= 2);
  check('level ' + i + ' map is 17 rows of 30', st.def.map.length === 17 && st.def.map.every(r => r.length === 30));
}

// LOS: wall blocks, open floor does not
const st0 = loadLevel(0);
check('LOS through open floor', losClear(st0.def, 48, HUD + 48, 48 + 4 * TILE, HUD + 48, false));
check('LOS blocked by wall column', !losClear(st0.def, 48, HUD + 48, 48 + 20 * TILE, HUD + 48, false));

// Visibility: guard facing player sees them; crouch+shadow reduces it
const st1 = loadLevel(0);
const g = st1.guards[0];
g.x = 10 * TILE + 16; g.y = HUD + 8 * TILE + 16; g.dir = 0;
st1.player.x = g.x + 80; st1.player.y = g.y; st1.player.crouch = false;
const vStand = visibility(st1.def, g, st1.player);
st1.player.crouch = true;
const vCrouch = visibility(st1.def, g, st1.player);
check('standing in cone is visible', vStand > 0.3);
check('crouch reduces visibility', vCrouch < vStand);
st1.player.x = g.x - 80; // behind the guard
check('behind guard is unseen', visibility(st1.def, g, st1.player) === 0);

// Simulation: walk right for 2s of game time, guards patrol, no crash
const st2 = loadLevel(0);
const input = { left: false, right: true, up: false, down: false, crouch: false, run: false, pebble: null };
const x0 = st2.player.x;
for (let i = 0; i < 120; i++) update(st2, input, 1 / 60);
check('player moved right', st2.player.x > x0 + 40);
check('guards patrolled (moved)', st2.guards.some(gg => gg.x !== gg.path[0][0] * TILE + 16));

// Pebble: guard looks toward noise
const st3 = loadLevel(0);
const gg3 = st3.guards[0];
input.right = false;
input.pebble = { x: gg3.x + 60, y: gg3.y };
update(st3, input, 1 / 60);
check('pebble consumed', st3.pebbles === 4);
check('guard reacts to pebble', gg3.lookT > 0);

// Win path: teleport to exit on level 0 (no key needed) -> won
const st4 = loadLevel(0);
st4.player.x = st4.exit.x; st4.player.y = st4.exit.y;
update(st4, input, 1 / 60);
check('reaching exit wins floor 1', st4.won === true);

// Lose path: stand in front of a guard until caught
const st5 = loadLevel(0);
const g5 = st5.guards[0];
g5.x = 10 * TILE + 16; g5.y = HUD + 8 * TILE + 16; g5.dir = 0; g5.pauseT = 99;
st5.player.x = g5.x + 50; st5.player.y = g5.y;
for (let i = 0; i < 600 && !st5.caught; i++) update(st5, input, 1 / 60);
check('standing in cone gets caught', st5.caught === true);

// Key gating on level 2: exit without key does not win
const st6 = loadLevel(1);
st6.player.x = st6.exit.x; st6.player.y = st6.exit.y;
update(st6, input, 1 / 60);
check('exit locked without keycard', st6.won === false);
st6.player.x = st6.key.x; st6.player.y = st6.key.y;
update(st6, input, 1 / 60);
check('keycard pickup', st6.hasKey === true);

console.log(fails === 0 ? 'ALL TESTS PASS' : fails + ' FAILURES');
process.exit(fails ? 1 : 0);
