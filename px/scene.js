// Pixel boulevard: Pissarro's Boulevard Montmartre at 640x400. The light theme is
// day; the dark theme is the same scene at night, lit physically: the day picture
// is the scene's albedo, and every pixel shows albedo x (ambient + gaslight), in
// linear light. Shopfronts, kerb lamps, lit windows and the carriages' own lamps
// are the light sources. Each page frames its own stretch of the scene in CSS
// (--px-zoom, --px-at on the canvas).
(function () {
  // images live next to this script, wherever the page that loads it sits
  var here = document.currentScript ? document.currentScript.src.replace(/[^/]*$/, '') : 'px/';
  var cv = document.getElementById('px');
  if (!cv) return;
  // if a stale stylesheet is still cached, fill the screen anyway
  if (getComputedStyle(cv).position !== 'fixed') {
    cv.style.cssText += ';position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;' +
      'object-fit:cover;image-rendering:pixelated';
  }
  var g = cv.getContext('2d');
  // the scene is laid out on a 320x200 grid and drawn at 640x400 by default; S
  // scales the layout to the resolution (data-res on the canvas, or ?pxres=320 to
  // compare). 480 has no images of its own yet.
  var RES = +(new URLSearchParams(location.search).get('pxres') || cv.getAttribute('data-res') || 640);
  if ([320, 640].indexOf(RES) < 0) RES = 640;
  var S = RES / 320, W = RES, H = 200 * S;
  function u(v) { return v * S; }
  cv.width = W; cv.height = H;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hex(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function key(r, gg, b) { return (r << 16) | (gg << 8) | b; }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  var SRGB = new Uint8Array(4096);           // linear [0,1] -> sRGB byte
  for (var n = 0; n < 4096; n++) { var l = n / 4095; SRGB[n] = Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055)); }
  function out(v) { return SRGB[v >= 1 ? 4095 : v <= 0 ? 0 : (v * 4095) | 0]; }

  // the scene's 16 colours; the sky ones carry their own dusk and night colours,
  // since the street does not light the sky
  var PAL = ['9fb8d8', 'd3dde6', 'f1eee8', 'c9c6c6', 'e2d6cb', 'c0ad9f', '8f7f77', 'b5a597',
             'd6c9bc', '7d6a5f', 'a88e7e', '3f3a3d', '5e5658', 'b8735e', '8a8c98', '6f7f6a'].map(hex);
  var SKYRAMP = [['9fb8d8', 'd9a39f', '1f2c5a'], ['d3dde6', 'eebfa6', '2a3a6c'],
                 ['f1eee8', 'f5cfb3', '374677'], ['c9c6c6', 'c79ba0', '28325f']].map(function (r) { return r.map(hex); });
  var ALB = PAL.map(function (c) { return [lin(c[0]), lin(c[1]), lin(c[2])]; });

  // light, in linear RGB
  var AMB_DAY = [1, 1, 1], AMB_DUSK = [0.95, 0.66, 0.6], AMB_NIGHT = [0.075, 0.095, 0.2];
  var GAS = [1.0, 0.56, 0.2];
  var EMIT = hex('f7dc9b'), EMIT2 = hex('e9b95f');
  // the full moon, in the open sky of the top-left margin, clear of the text panels
  var MOON = { x: u(24), y: u(11), r: u(4.6) }, MOONC = hex('f3efdf'), MARE = hex('d9d5c6');
  var HALO = hex('6f84b8'), LINING = hex('b9c4e0');
  var MARES = { '-1,-1': 1, '1,0': 1, '2,-2': 1, '-2,1': 1 };

  var VP = { x: u(93), y: u(100) }, LANES = [83, 101, 120, 141, 160, 177].map(u), SPLIT = u(130);
  var LEFT = u(75), RIGHT = u(187), WALKY = u(117);

  var img = new Image(), mask = new Image(), pending = 2;
  img.onload = mask.onload = function () { if (--pending === 0) start(); };
  var suffix = RES === 320 ? '' : '-' + RES;
  img.src = here + 'day' + suffix + '.png';
  mask.src = here + 'windows' + suffix + '.png';

  function start() {
    var rd = document.createElement('canvas'); rd.width = W; rd.height = H;
    var rg = rd.getContext('2d'); rg.drawImage(img, 0, 0);
    var B = rg.getImageData(0, 0, W, H).data;
    rg.clearRect(0, 0, W, H); rg.drawImage(mask, 0, 0);
    var WM = rg.getImageData(0, 0, W, H).data;

    var idxOf = {};
    PAL.forEach(function (c, i) { idxOf[key(c[0], c[1], c[2])] = i; });
    var IX = new Uint8Array(W * H);
    for (var p = 0; p < W * H; p++) { var v = idxOf[key(B[p * 4], B[p * 4 + 1], B[p * 4 + 2])]; IX[p] = v === undefined ? 11 : v; }

    // sky = sky-coloured pixels connected to the top edge
    var sky = new Uint8Array(W * H), st = [];
    // Pissarro's cream and grey clouds also fall on the stone and zinc colours; in the
    // open upper left, above every roofline there, those count as sky too
    function skyish(q) {
      var i = IX[q]; if (i <= 3) return true;
      if (i !== 4 && i !== 8 && i !== 14) return false;
      var x = q % W / S, y = q / W / S;
      return x < 150 && y < (x < 30 ? 21 : x < 60 ? 30 : 40);
    }
    for (var x = 0; x < W; x++) if (skyish(x)) { sky[x] = 1; st.push(x); }
    while (st.length) {
      p = st.pop(); var px = p % W, py = (p / W) | 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = px + d[0], ny = py + d[1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= u(96)) return;
        var q = ny * W + nx;
        if (!sky[q] && skyish(q)) { sky[q] = 1; st.push(q); }
      });
    }
    var top = [];
    for (x = 0; x < W; x++) { var y = 0; while (y < u(96) && sky[y * W + x]) y++; top.push(y); }

    // ---- light sources -------------------------------------------------------
    var emitters = [];       // {x, y, i (intensity), r (reach), down (stretch below)}
    // shopfronts: a row of emitters along the foot of each wall, stronger near
    [[[140, 101], [320, 142]], [[72, 103], [0, 150]]].forEach(function (sg) {
      var ax = u(sg[0][0]), ay = u(sg[0][1]), bx = u(sg[1][0]), by = u(sg[1][1]), len = Math.hypot(bx - ax, by - ay);
      for (var d = 0; d <= len; d += u(2.5)) {
        var fr = d / len, ex = ax + (bx - ax) * fr, ey = ay + (by - ay) * fr, near = clamp((ey - VP.y) / (H - VP.y), 0, 1);
        if (Math.random() < 0.25) continue;                     // not every shop is open
        var ei = (0.25 + 0.75 * near) * (0.7 + Math.random() * 0.6);
        emitters.push({ x: ex, y: ey, i: ei, r: u(2 + 9 * near), down: 2.2 });
        // the same shop washing up its own facade, fainter, a few floors high
        emitters.push({ x: ex, y: ey - u(2), i: ei * 0.32, r: u(3 + 12 * near), down: 0.5, up: 0.45 });
      }
    });
    // the two kerb lamps Pissarro painted
    var KERB = [[172, 150], [292, 145]].map(function (c) { return [Math.round(u(c[0])), Math.round(u(c[1]))]; });
    KERB.forEach(function (c) { emitters.push({ x: c[0], y: c[1], i: 1.6, r: u(6), down: 1.4 }); });
    // and a row of gas lamps down each kerb, spaced in perspective; each post is
    // drawn day and night, its head lights at dusk and pools light at its foot
    var POSTS = [];
    [193, 76].map(u).forEach(function (kerbX) {                // each kerb's x at the bottom edge
      [0.14, 0.2, 0.28, 0.38, 0.51, 0.67, 0.86].forEach(function (s) {
        var bx = VP.x + (kerbX - VP.x) * s, by = VP.y + (H - VP.y) * s;
        var post = { x: Math.round(bx), y: Math.round(by), h: Math.round(u(3 + 15 * s)), s: s };
        POSTS.push(post);
        emitters.push({ x: post.x, y: post.y, i: 0.55 + 0.9 * s, r: u(1.8 + 6 * s), down: 1.5 });
        emitters.push({ x: post.x, y: post.y - post.h, i: 0.25 + 0.4 * s, r: u(1 + 2 * s), down: 1 });
      });
    });

    // windows: found in the full-resolution scan (windows.png): dark marks
    // set in pale stone, inside the facade zones, one light per window
    var windows = [];
    for (p = 0; p < W * H; p++) {
      if (!WM[p * 4] || sky[p] || Math.random() > 0.85) continue;
      windows.push({ p: p, at: 0.55 + Math.random() * 0.4, hot: Math.random() < 0.25 });
    }

    // the static light field, one scalar per pixel (the gas colour is shared)
    var LM = new Float32Array(W * H);
    function splat(field, e, f) {
      var R = Math.ceil(e.r * 3), x0 = Math.max(0, Math.floor(e.x - R)), x1 = Math.min(W - 1, Math.ceil(e.x + R));
      var up = e.up || 1.6;                                    // how hard the light resists climbing
      var y0 = Math.max(0, Math.floor(e.y - R / up)), y1 = Math.min(H - 1, Math.ceil(e.y + R * e.down / 1.6));
      for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
        var dx = (xx - e.x) / e.r, dy = (yy - e.y) / e.r;
        dy = dy > 0 ? dy / e.down : dy * up;                   // pours onto the ground; only uplights climb
        field[yy * W + xx] += f * e.i / (1 + 3 * (dx * dx + dy * dy));
      }
    }
    emitters.forEach(function (e) { splat(LM, e, 1); });
    windows.forEach(function (w) { splat(LM, { x: w.p % W, y: (w.p / W) | 0, i: 0.32 / S, r: u(2), down: 1.4, up: 1 }, 1); });
    for (p = 0; p < W * H; p++) if (sky[p]) LM[p] = 0;

    // ---- vehicles, drawn as sprites -----------------------------------------
    // Seen from a high window, front toward the bottom (flipped for traffic going
    // away). r roof catching the sky, b body, k iron and wheels, f the coachman's
    // face, l a lamp, h horse, m its mane, p/q passengers on an omnibus deck,
    // x/y legs on alternate strides.
    var SPRITES = {
      cab: [
        ['.r.', 'bbb', 'lbl', '.h.', '.h.'],
        ['.rrr.', 'kbbbk', '.bbb.', 'kbbbk', '.lkl.', 'xhhhy', '.hmh.', 'yhmhx', '..h..'],
        ['.rrrrr.', 'rbbbbbr', 'kbbbbbk', '.bbbbb.', '.bbbbb.', 'kbbbbbk', '.lkkkl.', '..kfk..', '...k...',
         '.xhhhy.', '..hhh..', '..hmh..', '.yhmhx.', '...h...'],
        ['..rrrrrrr..', '.rrbbbbbrr.', 'kkbbbbbbbkk', '.kbbbbbbbk.', '..bbbbbbb..', '..bbbbbbb..', '..bbbbbbb..', 'kkbbbbbbbkk', '.kbbbbbbbk.', '..lbkkkbl..', '...kkkkk...', '....kfk....', '.....k.....', '..xhhhhhy..', '...hhhhh...', '...hhmhh...', '..yhhmhhx..', '...hhmhh...', '....hhh....', '.....h.....']
      ],
      bus: [
        ['.r.', 'bbb', 'lbl', '.h.', '.h.'],
        ['.rrrrr.', 'rpqpqpr', 'bbbbbbb', 'kbbbbbk', '.lkfkl.', 'xhh.hhy', '.hm.mh.', 'yhh.hhx'],
        ['.rrrrrrr.', 'rpqpqpqpr', 'rqpqpqpqr', 'bbbbbbbbb', 'kbbbbbbbk', 'bbbbbbbbb', 'kbbbbbbbk', '.lbkkkbl.',
         '...kfk...', '.xh...hy.', '.hhh.hhh.', '.hmh.hmh.', 'yhmh.hmhx', '..h...h..'],
        ['..rrrrrrrrr..', '.rpqpqpqpqpr.', '.rqpqpqpqpqr.', '.rpqpqpqpqpr.', 'bbbbbbbbbbbbb', 'kbbbbbbbbbbbk', 'bbbbbbbbbbbbb', 'bbbbbbbbbbbbb', 'kbbbbbbbbbbbk', '.lbbbkkkbbbl.', '.....kfk.....', '......k......', '.xhhhy.xhhhy.', '..hhh...hhh..', '..hmh...hmh..', '.yhmhx.yhmhx.', '..hmh...hmh..', '..hhh...hhh..', '...h.....h...']
      ]
    };
    var INK = { r: 14, k: 11, f: 6, l: 14, h: 9, m: 11, p: 6, q: 12, x: 9, y: 9 };   // a dark bay horse reads against the pale road

    // ---- moving parts --------------------------------------------------------
    var stacks = [];
    var d2s = Math.round(u(2));
    for (x = Math.round(u(187)); x < W - d2s; x++)
      if (top[x] < u(64) && top[x] < top[x - d2s] - S && top[x] <= top[x + d2s] && Math.random() < 0.7 / S) stacks.push({ x: x, y: top[x] });
    var cars = [];
    LANES.forEach(function (bx) {
      for (var n = 0; n < 4; n++) cars.push({ lane: bx, toward: bx < SPLIT, s: Math.random(), v: 0.035 + Math.random() * 0.02,
        bus: Math.random() < 0.2, body: Math.random() < 0.6 ? 11 : 12, ph: Math.random() * 2 });
    });
    function rightEdge(y) { return VP.x + (y - VP.y) * (RIGHT - VP.x) / (H - VP.y); }
    function leftEdge(y) { return VP.x - (y - VP.y) * (VP.x - LEFT) / (H - VP.y); }
    function walker() {
      var right = Math.random() < 0.6, y = WALKY + Math.random() * (H - WALKY);
      var span = (y - VP.y) * (right ? 1.4 : 0.7);
      var woman = Math.random() < 0.35;
      return { x: right ? rightEdge(y) + 2 + Math.random() * span : leftEdge(y) - 2 - Math.random() * span,
               y: y, dy: (Math.random() < 0.5 ? -1 : 1) * u(0.8 + Math.random()), walked: Math.random() * 4,
               woman: woman, hat: !woman && Math.random() < 0.45,
               coat: woman ? [5, 6, 13, 12][(Math.random() * 4) | 0] : [11, 11, 12, 9][(Math.random() * 4) | 0] };
    }
    var walkers = []; for (n = 0; n < 90; n++) walkers.push(walker());
    var puffs = [];
    var stars = [];
    for (p = 0; p < W * u(50); p++) if (sky[p] && Math.random() < 0.006 / (S * S)) stars.push({ p: p, at: 0.85 + Math.random() * 0.12, ph: Math.random() * 6 });

    // the sky is the same on every page: a fixed seed, and clouds placed by the real
    // clock, so they keep drifting from one page to the next instead of reshuffling
    var seed = 1897;
    function seeded() { seed = (seed + 0x6D2B79F5) | 0; var z = Math.imul(seed ^ (seed >>> 15), 1 | seed); z ^= z + Math.imul(z ^ (z >>> 7), 61 | z); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; }
    var NP = 64, perm = []; for (n = 0; n < NP * NP; n++) perm.push(seeded());
    function lat(ix, iy) { return perm[((iy % NP + NP) % NP) * NP + ((ix % NP + NP) % NP)]; }
    function sm(t) { return t * t * (3 - 2 * t); }
    function vn(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = sm(x - ix), fy = sm(y - iy);
      var a = lat(ix, iy), b = lat(ix + 1, iy), c = lat(ix, iy + 1), d = lat(ix + 1, iy + 1);
      return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    }
    function cloudI(x, y, t) {
      x /= S; y /= S;
      var cx = x * 0.034 + t * 0.03, cy = y * 0.085;
      var c = 0.62 * vn(cx, cy) + 0.28 * vn(cx * 2.1 + 5, cy * 2.1) + 0.1 * vn(cx * 4.3, cy * 4.3 + 9) + y / 95 * 0.22;
      return c < 0.47 ? 0 : c < 0.58 ? 1 : c < 0.64 ? 3 : 2;
    }

    // ---- time of day: k = 0 day, 0.5 dusk, 1 night -------------------------
    var k = document.documentElement.getAttribute('data-theme') === 'dark' ? 1 : 0, target = k;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DUR = 2600;
    function mix(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
    function ramp(r, k) { return k < 0.5 ? mix(r[0], r[1], k * 2) : mix(r[1], r[2], (k - 0.5) * 2); }

    var frame = g.createImageData(W, H), F = frame.data, scratch = new Uint8Array(W * H);
    var DYN = new Float32Array(W * H);
    var BAY4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    var STEPS = 5;
    var last = 0;

    function draw(now) {
      var t = (Date.now() % 1e8) / 1000, dt = Math.min(0.2, (now - (last || now)) / 1000);
      last = now;
      if (k !== target) {
        var step = dt * 1000 / DUR;
        k = target > k ? Math.min(target, k + step) : Math.max(target, k - step);
      }
      var amb = ramp([AMB_DAY, AMB_DUSK, AMB_NIGHT], k);
      var gas = clamp((k - 0.35) / 0.4, 0, 1);                 // gas comes up through dusk
      var skyCol = SKYRAMP.map(function (r) { return ramp(r, k); });
      var moonF = clamp((k - 0.62) / 0.28, 0, 1), moonY = MOON.y + u(5) * (1 - moonF);   // rises a little as it comes out

      for (var p = 0; p < W * H; p++) scratch[p] = sky[p] ? cloudI(p % W, (p / W) | 0, t) : IX[p];
      function dot(x, y, i) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) scratch[y * W + x] = i; }

      if (stacks.length && Math.random() < 0.6) { var s = stacks[(Math.random() * stacks.length) | 0]; puffs.push({ x: s.x, y: s.y - 1, age: 0, life: 2.5 + Math.random() * 2.5 }); }
      puffs = puffs.filter(function (q) { return q.age < q.life; });
      puffs.forEach(function (q) { q.age += dt; q.y -= dt * u(2.6); q.x += dt * u(1.5); if (Math.random() >= q.age / q.life) dot(q.x, q.y, (q.age * 3 | 0) % 2 ? 1 : 2); });

      walkers.forEach(function (w, n) {
        w.y += w.dy * dt;
        w.walked += Math.abs(w.dy) * dt / S;
        if (w.y < WALKY - u(2) || w.y > H + u(2)) walkers[n] = w = walker();
        figure(w);
      });

      // a person seen from a high window: head, coat or dress, legs that alternate
      function figure(w) {
        var sc = clamp((w.y - VP.y) / (H - VP.y), 0, 1);
        var h = Math.max(2, Math.round(u(1.6 + 2.6 * sc))), wd = Math.max(1, Math.round(h / 3.2));
        var x0 = Math.round(w.x), yb = Math.round(w.y), step = (w.walked * 1.4 | 0) & 1;
        if (h <= 2) { dot(x0, yb, w.coat); dot(x0, yb - 1, w.hat ? 11 : 6); return; }
        for (var yy = yb - h + 2; yy < yb; yy++) {
          var flare = w.woman && yy >= yb - 2 ? 1 : 0;              // a skirt widens at the hem
          for (var xx = -flare; xx < wd + flare; xx++) dot(x0 + xx, yy, w.coat);
        }
        var hx = x0 + (wd >> 1);
        dot(hx, yb - h + 1, 6);                                      // head
        if (w.hat) { dot(hx, yb - h, 11); if (h >= 6) dot(hx, yb - h - 1, 11); }
        if (wd >= 2) dot(x0 + (step ? 0 : wd - 1), yb, 11); else if (step) dot(x0, yb, 11);
      }

      // lamp posts: a dark iron post with a lantern on top
      POSTS.forEach(function (lp) {
        for (var yy = 1; yy <= lp.h; yy++) dot(lp.x, lp.y - yy, 11);
        for (var q = 0; q < S; q++) dot(lp.x, lp.y - lp.h - 1 - q, 14);
        if (lp.s > 0.45) { dot(lp.x - 1, lp.y - lp.h, 11); dot(lp.x + 1, lp.y - lp.h, 11); }   // the near ones get arms
      });

      // carriages; each one's lamp is a moving light on the road around it
      if (gas > 0) DYN.fill(0);
      var lampPix = [];
      cars.sort(function (a, b) { return a.s - b.s; });
      cars.forEach(function (car) {
        car.s += (car.toward ? 1 : -1) * car.v * (0.15 + car.s) * dt;
        if (car.s > 1.05) car.s = 0.02;
        if (car.s < 0.02) car.s = 1.05;
        var x = VP.x + (car.lane - VP.x) * car.s, y = VP.y + (H - VP.y) * car.s, sc = car.s;
        // pick the sprite size for how near it is, at this resolution
        var px = u(0.4 + 1.6 * sc), size = px >= 3.4 ? 3 : px >= 2.6 ? 2 : px >= 1.6 ? 1 : 0;
        var tpl = SPRITES[car.bus ? 'bus' : 'cab'][size], th = tpl.length, tw = tpl[0].length;
        var left = Math.round(x - tw / 2), top = Math.round(y - th), gait = ((t * 7 + car.ph) | 0) & 1;
        var fwd = car.toward ? 1 : -1, lampsAt = [];
        for (var row = 0; row < th; row++) {
          // traffic going away is the same sprite upside down: horse first
          var line = tpl[car.toward ? row : th - 1 - row];
          for (var col = 0; col < tw; col++) {
            var ch = line[col];
            if (ch === '.' || (ch === 'x' && gait) || (ch === 'y' && !gait)) continue;
            var ink = ch === 'b' ? (car.bus ? 9 : car.body) : INK[ch];
            dot(left + col, top + row, ink);
            if (ch === 'l') lampsAt.push((top + row) * W + left + col);
          }
        }
        lampsAt.forEach(function (lp) { lampPix.push(lp); });
        var lx = Math.round(x), ly = car.toward ? top + th - 1 : top;
        if (gas > 0) splat(DYN, { x: lx, y: ly + fwd * S, i: 0.5 + 0.6 * sc, r: u(1.5 + 4 * sc), down: car.toward ? 1.6 : 0.8 }, gas);
      });

      // shade: albedo x (ambient + gas), with the gas banded into dithered steps
      for (p = 0; p < W * H; p++) {
        var j = p * 4, i = scratch[p];
        if (sky[p] && i <= 3) {
          var c = skyCol[i], cr = c[0], cg = c[1], cb = c[2];
          if (moonF > 0) {
            var mdx = p % W - MOON.x, mdy = (p / W | 0) - moonY, d2 = mdx * mdx + mdy * mdy, rr = MOON.r * MOON.r;
            if (d2 <= rr) {
              // the disc shows through clear sky; a cloud in front glows with it
              var M = MARES[Math.round(mdx / S) + ',' + Math.round(mdy / S)] ? MARE : MOONC, f = (i <= 1 ? 1 : i === 3 ? 0.92 : 0.78) * moonF;   // a passing cloud dims it, never bites it
              cr += (M[0] - cr) * f; cg += (M[1] - cg) * f; cb += (M[2] - cb) * f;
            } else {
              // halo on the clear sky, a silver lining on nearby cloud, in dithered steps
              var reach = MOON.r * (i <= 1 ? 2.4 : 3.4), hv = Math.exp(-(d2 - rr) / (2 * reach * reach)) * moonF * (i <= 1 ? 0.45 : 0.6);
              hv = Math.floor(hv * 4 + BAY4[(p / W | 0) & 3][p & 3] / 16) / 4;
              if (hv > 0) { var Hc = i <= 1 ? HALO : LINING; cr += (Hc[0] - cr) * hv; cg += (Hc[1] - cg) * hv; cb += (Hc[2] - cb) * hv; }
            }
          }
          F[j] = cr; F[j + 1] = cg; F[j + 2] = cb; F[j + 3] = 255; continue;
        }
        var a = ALB[i], L = 0;
        if (gas > 0) {
          var raw = (LM[p] + DYN[p]) * gas;
          L = Math.floor(raw * STEPS + BAY4[(p / W | 0) & 3][p & 3] / 16) / STEPS;
          if (L > 1.6) L = 1.6;
        }
        F[j] = out(a[0] * (amb[0] + L * GAS[0]));
        F[j + 1] = out(a[1] * (amb[1] + L * GAS[1]));
        F[j + 2] = out(a[2] * (amb[2] + L * GAS[2]));
        F[j + 3] = 255;
      }

      // the light sources themselves glow: windows, kerb lamps, carriage lamps
      function emit(p, f, hot) {
        if (f <= 0 || p < 0 || p >= W * H) return;
        var j = p * 4, E = hot ? EMIT : EMIT2;
        F[j] += (E[0] - F[j]) * f; F[j + 1] += (E[1] - F[j + 1]) * f; F[j + 2] += (E[2] - F[j + 2]) * f;
      }
      windows.forEach(function (w) {
        var f = clamp((k - w.at) / 0.08, 0, 1);
        if (f > 0 && Math.random() < 0.02) f *= 0.6;            // gas flickers
        emit(w.p, f * 0.85, w.hot);
      });
      KERB.forEach(function (c) { emit(c[1] * W + c[0], gas, true); });
      POSTS.forEach(function (lp) { emit((lp.y - lp.h - 1) * W + lp.x, gas, true); });
      lampPix.forEach(function (lp) { if (Math.random() < 0.92) emit(lp, gas, true); });
      stars.forEach(function (s) {
        var f = clamp((k - s.at) / 0.05, 0, 1) * (0.55 + 0.45 * Math.sin(t * 1.7 + s.ph)) * 0.7;
        if (f > 0) { var j = s.p * 4, Lc = PAL[2]; F[j] += (Lc[0] - F[j]) * f; F[j + 1] += (Lc[1] - F[j + 1]) * f; F[j + 2] += (Lc[2] - F[j + 2]) * f; }
      });
      g.putImageData(frame, 0, 0);
    }

    function tick(now) {
      if (!reduce) requestAnimationFrame(tick);
      if (now - last < 80) return;    // about 12 frames a second
      draw(now);
    }

    new MutationObserver(function () {
      target = document.documentElement.getAttribute('data-theme') === 'dark' ? 1 : 0;
      if (reduce) { k = target; draw(performance.now()); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    draw(performance.now());
    requestAnimationFrame(tick);
  }

  // The camera moves between pages: each page leaves its framing of the scene
  // behind, and the next one starts there and glides to its own.
  var css0 = getComputedStyle(cv), mine = { t: css0.transform, o: css0.transformOrigin };
  addEventListener('pagehide', function () {
    try { sessionStorage.setItem('px-frame', JSON.stringify(mine)); } catch (e) {}
  });
  try {
    var prev = JSON.parse(sessionStorage.getItem('px-frame') || 'null');
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prev && !still && cv.animate && (prev.t !== mine.t || prev.o !== mine.o)) {
      cv.animate([{ transform: prev.t, transformOrigin: prev.o }, { transform: mine.t, transformOrigin: mine.o }],
                 { duration: 1100, easing: 'cubic-bezier(.3, 0, .2, 1)' });
    }
  } catch (e) {}
})();
