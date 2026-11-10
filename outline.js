// Outline rail: a slim pixel-framed strip in the left margin, one pixel square per
// section, the current one lit. Hovering (or focusing) slides it open to show the
// section names. Built from the page's own headings; the first entry is the page
// itself, named by data-outline on its h1 ("About", "Overview"). Where the margin
// is too narrow it folds into a corner button instead.
(function () {
  var title = document.querySelector('main h1');
  var heads = [].slice.call(document.querySelectorAll('main .panel h2'));
  if (title && title.getAttribute('data-outline')) heads.unshift(title);
  if (heads.length < 3) return;

  // a heading's own words, without hints like "(*equal contribution)"
  function label(h) {
    if (h.getAttribute('data-outline')) return h.getAttribute('data-outline');
    var c = h.cloneNode(true); [].forEach.call(c.querySelectorAll('.hint'), function (x) { x.remove(); });
    return c.textContent.trim();
  }
  function slug(t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  heads.forEach(function (h) { if (!h.id) h.id = slug(label(h)); });

  var LIST = '<svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">' +
    [0, 6, 12].map(function (y) { return '<rect x="0" y="' + y + '" width="2" height="2"/><rect x="4" y="' + y + '" width="12" height="2"/>'; }).join('') + '</svg>';

  var nav = document.createElement('nav');
  nav.className = 'rail'; nav.setAttribute('aria-label', 'Outline');
  nav.innerHTML = '<ol>' + heads.map(function (h) {
    return '<li><a href="#' + h.id + '"><i class="tick" aria-hidden="true"></i><span>' + label(h) + '</span></a></li>';
  }).join('') + '</ol>';
  var btn = document.createElement('button');
  btn.className = 'rail-toggle'; btn.type = 'button';
  btn.setAttribute('aria-label', 'Outline'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = LIST;
  document.body.appendChild(nav); document.body.appendChild(btn);

  function open(on) {
    nav.classList.toggle('open', on);
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  btn.addEventListener('click', function () { open(!nav.classList.contains('open')); });
  // without hover, the first tap opens the rail and the next one picks a section
  var touch = window.matchMedia && matchMedia('(hover: none)').matches;
  document.addEventListener('click', function (e) { if (!nav.contains(e.target) && e.target !== btn && !btn.contains(e.target)) open(false); });

  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var links = [].slice.call(nav.querySelectorAll('a'));
  links.forEach(function (a, i) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      if (touch && !nav.classList.contains('open') && getComputedStyle(btn).display === 'none') { open(true); return; }
      var y = i === 0 && heads[0] === title ? 0 : heads[i].getBoundingClientRect().top + scrollY - 24;
      scrollTo({ top: y, behavior: still ? 'auto' : 'smooth' });
      history.replaceState(null, '', i === 0 && heads[0] === title ? location.pathname : '#' + heads[i].id);
      open(false); a.blur();
    });
  });

  // the section being read is the last heading that has passed a third of the way down
  function spy() {
    var line = innerHeight * 0.33, cur = 0;
    heads.forEach(function (h, i) { if (h.getBoundingClientRect().top < line) cur = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) cur = heads.length - 1;
    links.forEach(function (a, i) {
      a.classList.toggle('on', i === cur);
      if (i === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }
  addEventListener('scroll', spy, { passive: true });
  addEventListener('resize', spy);
  spy();
})();
