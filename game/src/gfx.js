'use strict';
/* Gfx: a tiny display-list renderer.
   The game never touches a canvas directly; it appends draw ops
   (rect, circle, poly, line, text) to a list. In the browser the list
   is replayed onto Canvas2D. The screenshot tool replays the very same
   list through a software rasterizer, so screenshots show the game's
   real rendering. */
function makeGfx() {
  var ops = [];
  return {
    ops: ops,
    clear: function (color) { ops.length = 0; ops.push({ t: 'clear', c: color }); },
    rect: function (x, y, w, h, c) { ops.push({ t: 'rect', x: x, y: y, w: w, h: h, c: c }); },
    circle: function (x, y, r, c) { ops.push({ t: 'circle', x: x, y: y, r: r, c: c }); },
    ring: function (x, y, r, c, w) { ops.push({ t: 'ring', x: x, y: y, r: r, c: c, w: w || 2 }); },
    poly: function (pts, c) { ops.push({ t: 'poly', p: pts, c: c }); },
    line: function (x1, y1, x2, y2, c, w) { ops.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, c: c, w: w || 1 }); },
    text: function (x, y, s, size, c, align) {
      ops.push({ t: 'text', x: x, y: y, s: String(s), size: size, c: c, align: align || 'left' });
    },
  };
}

function replayCanvas(ctx, ops, W, H) {
  for (var i = 0; i < ops.length; i++) {
    var o = ops[i];
    if (o.t === 'clear') { ctx.fillStyle = o.c; ctx.fillRect(0, 0, W, H); }
    else if (o.t === 'rect') { ctx.fillStyle = o.c; ctx.fillRect(o.x, o.y, o.w, o.h); }
    else if (o.t === 'circle') { ctx.fillStyle = o.c; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); }
    else if (o.t === 'ring') { ctx.strokeStyle = o.c; ctx.lineWidth = o.w; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.stroke(); }
    else if (o.t === 'poly') {
      if (!o.p.length) continue;
      ctx.fillStyle = o.c; ctx.beginPath(); ctx.moveTo(o.p[0][0], o.p[0][1]);
      for (var j = 1; j < o.p.length; j++) ctx.lineTo(o.p[j][0], o.p[j][1]);
      ctx.closePath(); ctx.fill();
    } else if (o.t === 'line') {
      ctx.strokeStyle = o.c; ctx.lineWidth = o.w; ctx.beginPath();
      ctx.moveTo(o.x1, o.y1); ctx.lineTo(o.x2, o.y2); ctx.stroke();
    } else if (o.t === 'text') {
      ctx.fillStyle = o.c; ctx.font = 'bold ' + o.size + 'px monospace';
      ctx.textAlign = o.align; ctx.textBaseline = 'middle';
      ctx.fillText(o.s, o.x, o.y);
    }
  }
}
