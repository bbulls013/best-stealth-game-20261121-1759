'use strict';
/* Silent Ledger — a top-down stealth game.
   You are a night courier. Cross each floor unseen: guards patrol with
   vision cones, crates and shadow hide you, a thrown pebble pulls a
   guard's eyes away. Reach the exit (with the keycard, when required)
   before the alarm fills. Original game: code, names and sounds are
   written for this entry; audio is synthesized with WebAudio. */

var TILE = 32, COLS = 30, ROWS = 17, HUD = 56;
var W = COLS * TILE, H = HUD + ROWS * TILE;
var CONE_RANGE = 190, CONE_HALF = 0.62; /* radians */
var CONE_COLOR_CALM = 'rgba(255,214,90,0.20)';
var CONE_COLOR_ALERT = 'rgba(255,90,80,0.30)';

function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return level.map[ty].charAt(tx);
}
function solidAt(level, tx, ty) {
  var c = tileAt(level, tx, ty);
  return c === '#' || c === 'C';
}
/* Line of sight between two pixel points. Walls always block; crates
   block only when the target is crouched (hiding behind cover). */
function losClear(level, x1, y1, x2, y2, targetCrouched) {
  var dx = x2 - x1, dy = y2 - y1;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var steps = Math.max(1, Math.ceil(dist / 6));
  for (var i = 1; i < steps; i++) {
    var t = i / steps;
    var px = x1 + dx * t, py = y1 + dy * t;
    var c = tileAt(level, Math.floor(px / TILE), Math.floor((py - HUD) / TILE));
    if (c === '#') return false;
    if (c === 'C' && targetCrouched) return false;
  }
  return true;
}
function angleDiff(a, b) {
  var d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
/* How visible the courier is to one guard right now: 0..1 (0 = unseen). */
function visibility(level, guard, player) {
  var dx = player.x - guard.x, dy = player.y - guard.y;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > CONE_RANGE) return 0;
  var ang = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(ang, guard.dir)) > CONE_HALF && dist > 26) return 0;
  if (!losClear(level, guard.x, guard.y, player.x, player.y, player.crouch)) return 0;
  var v = 1 - dist / CONE_RANGE;
  var tile = tileAt(level, Math.floor(player.x / TILE), Math.floor((player.y - HUD) / TILE));
  if (tile === ',') v *= 0.35;            /* shadow */
  if (player.crouch) v *= 0.55;           /* crouched: smaller profile */
  if (player.running && player.moving) v *= 1.25;
  return Math.max(0, Math.min(1, v));
}

function loadLevel(idx) {
  var def = LEVELS[idx];
  var st = {
    levelIdx: idx, def: def, time: 0, alarm: 0, caught: false,
    won: false, hasKey: !def.needKey, pebbles: 5, message: def.intro,
    msgT: 5, player: null, guards: [], exit: null, key: null, noises: [],
  };
  for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
    var c = def.map[y].charAt(x);
    var cx = x * TILE + TILE / 2, cy = HUD + y * TILE + TILE / 2;
    if (c === 'S') st.player = { x: cx, y: cy, r: 10, crouch: false, running: false, moving: false, face: 0 };
    if (c === 'X') st.exit = { x: cx, y: cy, tx: x, ty: y };
    if (c === 'K') st.key = { x: cx, y: cy, taken: false };
  }
  st.guards = def.guards.map(function (g) {
    var p0 = g.path[0];
    return {
      x: p0[0] * TILE + TILE / 2, y: HUD + p0[1] * TILE + TILE / 2,
      path: g.path, wp: 1 % g.path.length, pause: g.pause, pauseT: 0,
      speed: g.speed * 38, dir: 0, suspicion: 0, lookAt: null, lookT: 0,
    };
  });
  return st;
}

function moveActor(level, a, dx, dy) {
  var nx = a.x + dx, ny = a.y + dy;
  var r = a.r || 10;
  function blocked(px, py) {
    var pts = [[px - r, py - r], [px + r, py - r], [px - r, py + r], [px + r, py + r]];
    for (var i = 0; i < pts.length; i++) {
      if (solidAt(level, Math.floor(pts[i][0] / TILE), Math.floor((pts[i][1] - HUD) / TILE))) return true;
    }
    return false;
  }
  if (!blocked(nx, a.y)) a.x = nx;
  if (!blocked(a.x, ny)) a.y = ny;
}

function updateGuard(st, g, dt) {
  var p = st.player;
  var vis = visibility(st.def, g, p);
  if (vis > 0) {
    g.suspicion = Math.min(1, g.suspicion + dt * (0.35 + vis * 1.5));
    g.lookAt = { x: p.x, y: p.y }; g.lookT = 1.2;
    if (g.suspicion >= 1) st.caught = true;
  } else {
    g.suspicion = Math.max(0, g.suspicion - dt * 0.22);
  }
  /* hearing: a running courier is loud */
  if (p.running && p.moving) {
    var d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d < 120) { g.lookAt = { x: p.x, y: p.y }; g.lookT = 1.0; g.suspicion = Math.min(0.85, g.suspicion + dt * 0.5); }
  }
  for (var i = 0; i < st.noises.length; i++) {
    var n = st.noises[i];
    if (Math.hypot(n.x - g.x, n.y - g.y) < 220) { g.lookAt = { x: n.x, y: n.y }; g.lookT = 2.2; }
  }
  if (g.lookT > 0 && g.lookAt) {
    g.lookT -= dt;
    var want = Math.atan2(g.lookAt.y - g.y, g.lookAt.x - g.x);
    g.dir += Math.max(-3.2 * dt, Math.min(3.2 * dt, angleDiff(want, g.dir)));
    return;
  }
  if (g.pauseT > 0) { g.pauseT -= dt; return; }
  var wp = g.path[g.wp];
  var tx = wp[0] * TILE + TILE / 2, ty = HUD + wp[1] * TILE + TILE / 2;
  var dx = tx - g.x, dy = ty - g.y, dist = Math.hypot(dx, dy);
  if (dist < 4) { g.wp = (g.wp + 1) % g.path.length; g.pauseT = g.pause; return; }
  var step = Math.min(dist, g.speed * dt);
  var want2 = Math.atan2(dy, dx);
  g.dir += Math.max(-2.6 * dt, Math.min(2.6 * dt, angleDiff(want2, g.dir)));
  g.x += (dx / dist) * step; g.y += (dy / dist) * step;
}

function update(st, input, dt) {
  if (st.caught || st.won) return;
  st.time += dt;
  if (st.msgT > 0) st.msgT -= dt;
  var p = st.player;
  p.crouch = !!input.crouch;
  p.running = !!input.run && !p.crouch;
  var speed = p.crouch ? 62 : (p.running ? 210 : 132);
  var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  var my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  p.moving = (mx !== 0 || my !== 0);
  if (p.moving) {
    var len = Math.hypot(mx, my);
    moveActor(st.def, p, (mx / len) * speed * dt, (my / len) * speed * dt);
    p.face = Math.atan2(my, mx);
  }
  if (input.pebble && st.pebbles > 0) {
    st.pebbles--;
    st.noises.push({ x: input.pebble.x, y: input.pebble.y, t: 0.35 });
    input.pebble = null;
  }
  st.noises = st.noises.filter(function (n) { n.t -= dt; return n.t > 0; });
  var maxSusp = 0;
  for (var i = 0; i < st.guards.length; i++) {
    updateGuard(st, st.guards[i], dt);
    maxSusp = Math.max(maxSusp, st.guards[i].suspicion);
  }
  st.alarm = maxSusp;
  if (st.key && !st.key.taken && Math.hypot(p.x - st.key.x, p.y - st.key.y) < 20) {
    st.key.taken = true; st.hasKey = true;
    st.message = 'Keycard taken. The exit will open now.'; st.msgT = 4;
  }
  if (Math.hypot(p.x - st.exit.x, p.y - st.exit.y) < 20) {
    if (st.hasKey) st.won = true;
    else if (st.msgT <= 0) { st.message = 'Locked. You need the keycard first.'; st.msgT = 3; }
  }
}

/* ---------- drawing (display list, see gfx.js) ---------- */
function conePolygon(level, g) {
  var pts = [[g.x, g.y]];
  var rays = 14;
  for (var i = 0; i <= rays; i++) {
    var a = g.dir - CONE_HALF + (2 * CONE_HALF * i) / rays;
    var dx = Math.cos(a), dy = Math.sin(a), d = 0;
    while (d < CONE_RANGE) {
      d += 6;
      var px = g.x + dx * d, py = g.y + dy * d;
      if (tileAt(level, Math.floor(px / TILE), Math.floor((py - HUD) / TILE)) === '#') break;
    }
    pts.push([g.x + dx * d, g.y + dy * d]);
  }
  return pts;
}

function draw(gfx, st, screen) {
  gfx.clear('#101623');
  if (screen === 'start') {
    gfx.rect(0, 0, W, H, '#0b0e14');
    gfx.text(W / 2, 150, 'SILENT LEDGER', 54, '#ffd65a', 'center');
    gfx.text(W / 2, 205, 'a top-down stealth game', 18, '#9fb2d8', 'center');
    gfx.text(W / 2, 280, 'Cross each floor unseen. Guards patrol with vision cones —', 15, '#d7deee', 'center');
    gfx.text(W / 2, 305, 'hide behind crates, stay in shadow, throw pebbles to mislead.', 15, '#d7deee', 'center');
    gfx.text(W / 2, 360, 'WASD / arrows: move    Shift: run (loud)    C: crouch', 15, '#8fe3a8', 'center');
    gfx.text(W / 2, 388, 'Mouse click: throw pebble    P: pause    R: restart', 15, '#8fe3a8', 'center');
    gfx.text(W / 2, 460, 'Press ENTER or click to start', 20, '#ffd65a', 'center');
    gfx.text(W / 2, 540, '3 floors · keycards · one alarm meter', 13, '#7d8aa5', 'center');
    return;
  }
  if (screen === 'end') {
    gfx.rect(0, 0, W, H, '#0b0e14');
    gfx.text(W / 2, 180, 'LEDGER DELIVERED', 44, '#8fe3a8', 'center');
    gfx.text(W / 2, 240, 'Every floor crossed unseen. The night stays quiet.', 17, '#d7deee', 'center');
    gfx.text(W / 2, 320, 'Press ENTER to play again', 18, '#ffd65a', 'center');
    return;
  }
  var def = st.def;
  /* floor + walls */
  for (var y = 0; y < ROWS; y++) for (var x = 0; x < COLS; x++) {
    var c = def.map[y].charAt(x);
    var px = x * TILE, py = HUD + y * TILE;
    if (c === '#') { gfx.rect(px, py, TILE, TILE, '#2b3a55'); gfx.rect(px, py, TILE, 4, '#3d527a'); }
    else if (c === ',') gfx.rect(px, py, TILE, TILE, '#141b2c');
    else gfx.rect(px, py, TILE, TILE, ((x + y) % 2) ? '#1a2338' : '#182136');
    if (c === 'C') { gfx.rect(px + 3, py + 3, TILE - 6, TILE - 6, '#8a6a3b'); gfx.line(px + 3, py + 3, px + TILE - 3, py + TILE - 3, '#6e5329', 2); gfx.line(px + TILE - 3, py + 3, px + 3, py + TILE - 3, '#6e5329', 2); }
  }
  /* vision cones under actors */
  for (var i = 0; i < st.guards.length; i++) {
    var g = st.guards[i];
    gfx.poly(conePolygon(def, g), g.suspicion > 0.45 ? CONE_COLOR_ALERT : CONE_COLOR_CALM);
  }
  /* exit + key */
  gfx.rect(st.exit.x - 13, st.exit.y - 13, 26, 26, st.hasKey ? '#2fbf71' : '#5a6b8c');
  gfx.text(st.exit.x, st.exit.y, 'EXIT', 9, '#0b0e14', 'center');
  if (st.key && !st.key.taken) {
    gfx.rect(st.key.x - 8, st.key.y - 5, 16, 10, '#ffd65a');
    gfx.circle(st.key.x - 4, st.key.y, 2, '#0b0e14');
  }
  /* noises (pebble pings): expanding rings */
  for (var n = 0; n < st.noises.length; n++) {
    var ping = 26 - st.noises[n].t * 50;
    gfx.ring(st.noises[n].x, st.noises[n].y, Math.max(4, ping), '#ffffff', 2);
    gfx.circle(st.noises[n].x, st.noises[n].y, 3, '#ffffff');
  }
  /* guards */
  for (var j = 0; j < st.guards.length; j++) {
    var gg = st.guards[j];
    gfx.circle(gg.x, gg.y, 11, '#c0392b');
    gfx.circle(gg.x + Math.cos(gg.dir) * 8, gg.y + Math.sin(gg.dir) * 8, 4, '#f5c6c0');
    if (gg.suspicion > 0.08) {
      gfx.rect(gg.x - 14, gg.y - 24, 28, 5, '#0b0e14');
      gfx.rect(gg.x - 13, gg.y - 23, 26 * gg.suspicion, 3, gg.suspicion > 0.6 ? '#ff5a50' : '#ffd65a');
      gfx.text(gg.x, gg.y - 32, gg.suspicion > 0.6 ? '!' : '?', 14, '#ffd65a', 'center');
    }
  }
  /* player */
  var p = st.player;
  gfx.circle(p.x, p.y, p.crouch ? 8 : 10, '#2fbf71');
  gfx.circle(p.x + Math.cos(p.face) * 7, p.y + Math.sin(p.face) * 7, 3, '#0b0e14');
  if (p.crouch) gfx.text(p.x, p.y - 18, 'crouch', 9, '#8fe3a8', 'center');
  /* HUD */
  gfx.rect(0, 0, W, HUD, '#0b0e14');
  gfx.text(14, 18, 'Floor ' + (st.levelIdx + 1) + '/' + LEVELS.length + ' · ' + def.name, 15, '#d7deee', 'left');
  gfx.text(14, 40, 'Pebbles: ' + st.pebbles + '   Key: ' + (st.hasKey ? 'yes' : 'no') + '   Time: ' + st.time.toFixed(1) + 's', 12, '#9fb2d8', 'left');
  gfx.text(W - 230, 18, 'ALARM', 13, '#d7deee', 'left');
  gfx.rect(W - 230, 28, 210, 12, '#2b3a55');
  gfx.rect(W - 228, 30, 206 * st.alarm, 8, st.alarm > 0.6 ? '#ff5a50' : '#ffd65a');
  if (st.msgT > 0) gfx.text(W / 2, HUD + 18, st.message, 14, '#ffd65a', 'center');
  if (st.caught) {
    gfx.rect(0, HUD, W, H - HUD, 'rgba(60,10,10,0.72)');
    gfx.text(W / 2, H / 2 - 20, 'SPOTTED', 44, '#ff5a50', 'center');
    gfx.text(W / 2, H / 2 + 24, 'Press R to try this floor again', 16, '#d7deee', 'center');
  }
  if (st.won) {
    gfx.rect(0, HUD, W, H - HUD, 'rgba(10,50,30,0.72)');
    gfx.text(W / 2, H / 2 - 44, 'FLOOR CLEAR', 40, '#8fe3a8', 'center');
    var ghost = st.pebbles === 5 && st.alarm < 0.2;
    gfx.text(W / 2, H / 2 + 2, 'Time ' + st.time.toFixed(1) + 's · Pebbles left ' + st.pebbles + (ghost ? ' · GHOST: never suspected' : ''), 15, '#d7deee', 'center');
    gfx.text(W / 2, H / 2 + 34, 'Press ENTER for the next floor', 16, '#ffd65a', 'center');
  }
}

/* ---------- browser glue (skipped under Node) ---------- */
if (typeof document !== 'undefined') {
  (function () {
    var cv = document.getElementById('cv');
    var ctx = cv.getContext('2d');
    var gfx = makeGfx();
    var screen = 'start';
    var st = loadLevel(0);
    var input = { left: false, right: false, up: false, down: false, crouch: false, run: false, pebble: null };
    var paused = false;
    var audio = null;
    function beep(freq, dur, type) {
      try {
        if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
        var o = audio.createOscillator(), g = audio.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.08, audio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + dur);
        o.connect(g); g.connect(audio.destination);
        o.start(); o.stop(audio.currentTime + dur);
      } catch (e) { /* audio is optional */ }
    }
    var q = new URLSearchParams(location.search);
    var shot = q.get('shot');
    if (shot === 'start') { screen = 'start'; }
    else if (shot === 'play') {
      screen = 'play'; st = loadLevel(1);
      st.player.x += TILE * 3; st.player.crouch = true;
      st.guards[0].suspicion = 0.55; st.alarm = 0.55;
      st.noises.push({ x: st.player.x + 90, y: st.player.y - 40, t: 0.3 });
      st.msgT = 3;
    } else if (shot === 'end') { screen = 'end'; }
    function nextFloor() {
      if (st.levelIdx + 1 >= LEVELS.length) { screen = 'end'; beep(880, 0.3); }
      else { st = loadLevel(st.levelIdx + 1); beep(660, 0.15); }
    }
    document.addEventListener('keydown', function (e) {
      var k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.left = true;
      if (k === 'arrowright' || k === 'd') input.right = true;
      if (k === 'arrowup' || k === 'w') input.up = true;
      if (k === 'arrowdown' || k === 's') input.down = true;
      if (k === 'c' || k === 'control') input.crouch = true;
      if (k === 'shift') input.run = true;
      if (k === 'p') paused = !paused;
      if (k === 'r' && screen === 'play') st = loadLevel(st.levelIdx);
      if (k === 'enter') {
        if (screen === 'start') { screen = 'play'; st = loadLevel(0); }
        else if (screen === 'end') { screen = 'play'; st = loadLevel(0); }
        else if (st.won) nextFloor();
      }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].indexOf(k) >= 0) e.preventDefault();
    });
    document.addEventListener('keyup', function (e) {
      var k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.left = false;
      if (k === 'arrowright' || k === 'd') input.right = false;
      if (k === 'arrowup' || k === 'w') input.up = false;
      if (k === 'arrowdown' || k === 's') input.down = false;
      if (k === 'c' || k === 'control') input.crouch = false;
      if (k === 'shift') input.run = false;
    });
    cv.addEventListener('mousedown', function (e) {
      if (screen === 'start') { screen = 'play'; st = loadLevel(0); return; }
      if (screen !== 'play' || paused) return;
      var r = cv.getBoundingClientRect();
      var x = (e.clientX - r.left) * (W / r.width);
      var y = (e.clientY - r.top) * (H / r.height);
      if (y > HUD) { input.pebble = { x: x, y: y }; beep(1200, 0.06, 'square'); }
    });
    var last = performance.now(), wasCaught = false, wasWon = false;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (screen === 'play' && !paused && !shot) update(st, input, dt);
      if (st.caught && !wasCaught) beep(160, 0.35, 'sawtooth');
      if (st.won && !wasWon) beep(880, 0.2);
      wasCaught = st.caught; wasWon = st.won;
      draw(gfx, st, screen);
      replayCanvas(ctx, gfx.ops, W, H);
      if (paused && screen === 'play') {
        ctx.fillStyle = 'rgba(11,14,20,0.7)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffd65a'; ctx.font = 'bold 36px monospace'; ctx.textAlign = 'center';
        ctx.fillText('PAUSED', W / 2, H / 2);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();
}
