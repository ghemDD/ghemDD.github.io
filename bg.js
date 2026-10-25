/* Ambient background: large, soft colour washes that drift on their own,
   shift with scroll and lean towards the pointer. Decorative only: it sits
   behind everything, takes no pointer events, holds still for visitors who
   ask for reduced motion, and pauses while the tab is hidden. */
(function () {
  var cv = document.getElementById('bg');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // hue, drift speed, parallax depth. Kept desaturated so text stays readable.
  var WASH = [
    { c: [104, 174, 158], x: 0.14, y: 0.10, r: 0.60, sx: 0.000061, sy: 0.000043, p: 0.05, b: 0.07 },
    { c: [122, 148, 204], x: 0.84, y: 0.04, r: 0.52, sx: -0.000048, sy: 0.000066, p: 0.11, b: 0.09 },
    { c: [208, 168, 138], x: 0.72, y: 0.46, r: 0.46, sx: 0.000037, sy: -0.000052, p: 0.04, b: 0.06 },
    { c: [168, 142, 196], x: 0.30, y: 0.74, r: 0.54, sx: -0.000029, sy: -0.000039, p: 0.08, b: 0.08 },
    { c: [138, 188, 176], x: 0.54, y: 1.02, r: 0.50, sx: 0.000044, sy: 0.000031, p: 0.14, b: 0.05 }
  ];

  var w = 0, h = 0, dpr = 1;
  var scrollY = 0, scrollTarget = 0;
  var px = 0, py = 0, pxT = 0, pyT = 0;

  function dark() { return document.documentElement.getAttribute('data-theme') === 'dark'; }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    var a = dark() ? 0.20 : 0.105;
    var big = Math.max(w, h);
    for (var i = 0; i < WASH.length; i++) {
      var b = WASH[i];
      var x = (b.x + Math.sin(t * b.sx + i * 1.7) * 0.07) * w + px * (20 + i * 9);
      var y = (b.y + Math.cos(t * b.sy + i * 2.3) * 0.06) * h
              + py * (16 + i * 7) - scrollY * b.p;
      var r = b.r * big * (1 + Math.sin(t * 0.000052 + i) * b.b);   // slow breathing
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + b.c.join(',') + ',' + a + ')');
      g.addColorStop(0.55, 'rgba(' + b.c.join(',') + ',' + (a * 0.45).toFixed(4) + ')');
      g.addColorStop(1, 'rgba(' + b.c.join(',') + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function frame(now) {
    if (!document.hidden) {
      scrollY += (scrollTarget - scrollY) * 0.07;
      px += (pxT - px) * 0.04;
      py += (pyT - py) * 0.04;
      draw(now);
    }
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', function () { resize(); if (still) draw(0); }, { passive: true });
  window.addEventListener('scroll', function () {
    scrollTarget = window.scrollY || window.pageYOffset || 0;
  }, { passive: true });
  window.addEventListener('pointermove', function (e) {
    pxT = (e.clientX / w) * 2 - 1;
    pyT = (e.clientY / h) * 2 - 1;
  }, { passive: true });

  if (still) draw(0); else requestAnimationFrame(frame);
  var tg = document.getElementById('theme-toggle');
  if (tg) tg.addEventListener('click', function () { if (still) setTimeout(function () { draw(0); }, 0); });
})();
