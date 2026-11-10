// Video player bar: replaces the browser's controls on video.hero with a pixel-framed
// bar in the site's style. Play / pause, seek, time, volume, 0.5-2x speed and full screen.
// It rises over the bottom of the video when the pointer moves on it, fades after 2 s without
// movement, and stays while the video is paused; a thin progress line along the bottom edge
// stands in for it. A click on the video toggles pause. Before the first play a large pixel
// play button sits on the poster. Without JS the video keeps its native controls.
(function () {
  var RATES = [0.5, 1, 1.5, 2];
  function svg(w, h, rects) {
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">' +
      rects.map(function (r) { return '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '"/>'; }).join('') + '</svg>';
  }
  // a stepped triangle, two pixels per step
  var PLAY = svg(12, 14, [[0, 0, 2, 14], [2, 1, 2, 12], [4, 3, 2, 8], [6, 4, 2, 6], [8, 5, 2, 4], [10, 6, 2, 2]]);
  var PAUSE = svg(12, 14, [[1, 0, 4, 14], [7, 0, 4, 14]]);
  var SOUND = svg(16, 14, [[0, 4, 4, 6], [4, 2, 2, 10], [6, 0, 2, 14], [10, 4, 2, 6], [13, 2, 2, 10]]);
  var MUTED = svg(16, 14, [[0, 4, 4, 6], [4, 2, 2, 10], [6, 0, 2, 14], [10, 4, 2, 2], [14, 4, 2, 2], [12, 6, 2, 2], [10, 8, 2, 2], [14, 8, 2, 2]]);
  var FULL = svg(14, 14, [[0, 0, 5, 2], [0, 0, 2, 5], [9, 0, 5, 2], [12, 0, 2, 5], [0, 12, 5, 2], [0, 9, 2, 5], [9, 12, 5, 2], [12, 9, 2, 5]]);
  var BIG = svg(24, 28, [[0, 0, 4, 28], [4, 2, 4, 24], [8, 6, 4, 16], [12, 8, 4, 12], [16, 10, 4, 8], [20, 12, 4, 4]]);
  function clock(t) { t = t || 0; return Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2); }

  [].forEach.call(document.querySelectorAll('video.hero'), function (v) {
    var f = document.createElement('div');
    f.className = 'vframe is-fresh is-paused';
    v.parentNode.insertBefore(f, v); f.appendChild(v);
    v.controls = false; v.removeAttribute('controls');

    var big = document.createElement('button');
    big.type = 'button'; big.className = 'vc-big'; big.setAttribute('aria-label', 'Play'); big.innerHTML = BIG;
    var bar = document.createElement('div');
    bar.className = 'vctl';
    bar.innerHTML =
      '<button type="button" class="vc-btn vc-play" aria-label="Play">' + PLAY + '</button>' +
      '<input class="vc-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Seek">' +
      '<span class="vc-time">0:00 / 0:00</span>' +
      '<span class="vc-vol"><button type="button" class="vc-btn vc-mute" aria-label="Mute">' + SOUND + '</button>' +
      '<input class="vc-volume" type="range" min="0" max="100" step="1" aria-label="Volume"></span>' +
      '<span class="vc-rates" role="group" aria-label="Playback speed">' + RATES.map(function (r) {
        return '<button type="button" class="vc-rate' + (r === 1 ? ' on' : '') + '" data-r="' + r + '">' + r + '×</button>';
      }).join('') + '</span>' +
      '<button type="button" class="vc-btn vc-full" aria-label="Full screen">' + FULL + '</button>';
    f.appendChild(big); f.appendChild(bar);

    var q = function (s) { return bar.querySelector(s); };
    var play = q('.vc-play'), seek = q('.vc-seek'), time = q('.vc-time'), mute = q('.vc-mute'), vol = q('.vc-volume');
    var chips = [].slice.call(bar.querySelectorAll('.vc-rate'));
    function fill(input, p) { input.style.setProperty('--p', (p * 100).toFixed(2) + '%'); }

    function toggle() { if (v.paused || v.ended) v.play().catch(function () {}); else v.pause(); }
    v.addEventListener('click', toggle); play.addEventListener('click', toggle); big.addEventListener('click', toggle);
    function state() {
      play.innerHTML = v.paused ? PLAY : PAUSE;
      play.setAttribute('aria-label', v.paused ? 'Play' : 'Pause');
      f.classList.toggle('is-paused', v.paused);
      if (!v.paused) f.classList.remove('is-fresh');
    }
    v.addEventListener('play', state); v.addEventListener('pause', state); v.addEventListener('ended', state);

    var drag = false;
    function tick() {
      if (drag || !v.duration) return;
      seek.value = Math.round(v.currentTime / v.duration * 1000); fill(seek, v.currentTime / v.duration); fill(f, v.currentTime / v.duration);
      time.textContent = clock(v.currentTime) + ' / ' + clock(v.duration);
    }
    v.addEventListener('timeupdate', tick); v.addEventListener('loadedmetadata', tick);
    seek.addEventListener('input', function () {
      drag = true; fill(seek, seek.value / 1000); fill(f, seek.value / 1000);
      if (!v.duration) return;
      v.currentTime = seek.value / 1000 * v.duration;
      time.textContent = clock(v.currentTime) + ' / ' + clock(v.duration);
    });
    seek.addEventListener('change', function () { drag = false; });

    function sound() {
      var level = v.muted ? 0 : v.volume;
      vol.value = Math.round(level * 100); fill(vol, level);
      mute.innerHTML = level ? SOUND : MUTED;
      mute.setAttribute('aria-label', level ? 'Mute' : 'Unmute');
    }
    v.addEventListener('volumechange', sound);
    mute.addEventListener('click', function () { if (v.muted || !v.volume) { v.muted = false; if (!v.volume) v.volume = 0.4; } else v.muted = true; });
    vol.addEventListener('input', function () { v.volume = vol.value / 100; v.muted = !+vol.value; });
    sound();

    chips.forEach(function (b, i) {
      b.addEventListener('click', function () {
        // in a narrow frame only the current speed shows, and clicking it steps to the next
        var folded = chips.every(function (x) { return x === b || !x.offsetParent; });
        var pick = folded && b.classList.contains('on') ? chips[(i + 1) % chips.length] : b;
        v.defaultPlaybackRate = v.playbackRate = +pick.dataset.r;
        chips.forEach(function (x) { x.classList.toggle('on', x === pick); });
      });
    });

    var full = q('.vc-full');
    if (!f.requestFullscreen) full.hidden = true;
    full.addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen(); else f.requestFullscreen().catch(function () {});
    });

    // keys while the player has focus: space / k pause, arrows seek 5 s, m mute, f full screen
    f.tabIndex = -1;
    f.addEventListener('keydown', function (e) {
      if (e.target.type === 'range' && /Arrow/.test(e.key)) return;
      var k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') { if (e.target.tagName === 'BUTTON' && k === ' ') return; toggle(); }
      else if (k === 'arrowleft' || k === 'arrowright') v.currentTime = Math.max(0, v.currentTime + (k === 'arrowleft' ? -5 : 5));
      else if (k === 'm') mute.click();
      else if (k === 'f') full.click();
      else return;
      e.preventDefault();
    });

    // the bar shows while the pointer moves, and stays while it rests on the bar itself
    var idle;
    function wake() {
      f.classList.add('is-active'); clearTimeout(idle);
      idle = setTimeout(function () { if (!bar.matches(':hover')) f.classList.remove('is-active'); }, 2000);
    }
    f.addEventListener('pointermove', function (e) { if (e.pointerType !== 'touch') wake(); });
    f.addEventListener('pointerleave', function () { clearTimeout(idle); f.classList.remove('is-active'); });

    new ResizeObserver(function (es) {
      var w = es[0].contentRect.width;
      bar.classList.toggle('narrow', w <= 520); bar.classList.toggle('tiny', w <= 340);
    }).observe(f);
  });
})();
