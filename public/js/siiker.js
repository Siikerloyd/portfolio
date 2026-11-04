/* SIIKER v2 — behaviour layer.
   Every module runs inside safe(): if one throws, the rest still work.
   Reveal runs first because it is the one that matters most. */
(function () {
  'use strict';
  var api = window.__siiker = {};

  var d = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var isMo = function () { return d.classList.contains('mo'); };
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };

  function safe(name, fn) {
    try { fn(); } catch (e) { if (window.console) console.warn('[siiker] ' + name, e); }
  }

  /* ---------- Motion mode (toggle in the header) ---------- */
  var motionBtn = $('[data-motion-toggle]');
  function applyMotion(mode, save) {
    d.setAttribute('data-motion', mode);
    d.classList.toggle('mo', mode === 'full');
    d.classList.remove('nojs');
    if (motionBtn) {
      motionBtn.setAttribute('aria-pressed', mode === 'full' ? 'true' : 'false');
      var t = $('.motion-t', motionBtn);
      if (t) t.textContent = mode === 'full' ? 'Motion on' : 'Motion off';
    }
    $$('svg').forEach(function (s) {
      if (s.pauseAnimations) { if (mode === 'full') s.unpauseAnimations(); else s.pauseAnimations(); }
    });
    if (save) { try { localStorage.setItem('siiker-motion', mode); } catch (e) {} }
    document.dispatchEvent(new CustomEvent('siiker:motion', { detail: mode }));
  }
  safe('motion', function () {
    applyMotion(d.getAttribute('data-motion') === 'calm' ? 'calm' : 'full', false);
    if (motionBtn) motionBtn.addEventListener('click', function () { applyMotion(isMo() ? 'calm' : 'full', true); });
  });

  /* ---------- Word splitting helper ---------- */
  function wrapWords(el, make) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            frag.appendChild(make(part, i++));
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { walk(n); }
      });
    })(el);
    return i;
  }

  /* split headings BEFORE the reveal observer starts watching them */
  safe('split', function () {
    $$('[data-split]').forEach(function (el) {
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
      wrapWords(el, function (word, i) {
        var w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
        var wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = word;
        wi.style.setProperty('--i', i);
        w.appendChild(wi);
        return w;
      });
      el.classList.add('sp');
    });
  });

  /* ---------- Scroll reveal (nothing it watches is ever clipped to zero) ---------- */
  safe('reveal', function () {
    var els = $$('[data-r],[data-split],.sec-head');
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
    els.forEach(function (e) { io.observe(e); });
    /* failsafe: anything already on screen after 1.5s gets revealed */
    setTimeout(function () {
      els.forEach(function (e) {
        var r = e.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) e.classList.add('in');
      });
    }, 1500);
  });

  /* ---------- Boot counter ---------- */
  safe('boot', function () {
    var n = $('.boot-n');
    if (!n || !isMo()) return;
    var t0 = performance.now();
    requestAnimationFrame(function f(t) {
      var p = clamp((t - t0) / 1900, 0, 1);
      var v = Math.round(100 * (1 - Math.pow(1 - p, 3)));
      n.textContent = ('00' + v).slice(-3);
      if (p < 1) requestAnimationFrame(f);
    });
  });

  /* ---------- Clock (Tunis) ---------- */
  safe('clock', function () {
    var clocks = $$('[data-clock]');
    if (!clocks.length) return;
    var hm, hms;
    try {
      hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', hour12: false });
      hms = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch (e) {}
    function tick() {
      var now = new Date();
      clocks.forEach(function (c) {
        var long = c.getAttribute('data-clock') === 'hms';
        var f = long ? hms : hm;
        c.textContent = f ? f.format(now) : now.toTimeString().slice(0, long ? 8 : 5);
      });
    }
    tick(); setInterval(tick, 1000);
  });

  /* ---------- Mobile menu ---------- */
  var menuOpen = false;
  var hd = $('.hd');
  safe('menu', function () {
    var btn = $('.menu-btn'), sheet = $('#sheet');
    if (!btn || !sheet) return;
    function set(o) {
      menuOpen = o;
      btn.setAttribute('aria-expanded', o ? 'true' : 'false');
      sheet.classList.toggle('open', o);
      sheet.setAttribute('aria-hidden', o ? 'false' : 'true');
      d.classList.toggle('lock', o);
      if (o && hd) hd.classList.remove('hide');
    }
    btn.addEventListener('click', function () { set(!menuOpen); });
    $$('a', sheet).forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) set(false); });
    addEventListener('resize', function () { if (menuOpen && innerWidth >= 900) set(false); });
  });

  /* ---------- Nav scroll-spy ---------- */
  safe('spy', function () {
    if (!('IntersectionObserver' in window)) return;
    var links = $$('[data-sec]');
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        var rl = $('.rail'); if (rl) rl.classList.toggle('inv', id === 'contact');
        links.forEach(function (a) {
          if (a.getAttribute('data-sec') === id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    ['hero', 'projects', 'experience', 'skills', 'about', 'contact'].forEach(function (id) {
      var s = document.getElementById(id); if (s) so.observe(s);
    });
  });

  /* ---------- Statement: words light up as you scroll ---------- */
  var scrubEl = $('[data-scrub]');
  var sws = [];
  safe('scrub', function () {
    if (!scrubEl) return;
    wrapWords(scrubEl, function (word) {
      var s = document.createElement('span'); s.className = 'sw'; s.textContent = word; return s;
    });
    sws = $$('.sw', scrubEl);
  });

  /* ---------- Counters ---------- */
  safe('counters', function () {
    var tools = $$('.chip').length;
    $$('[data-count]').forEach(function (b) {
      var raw = b.getAttribute('data-count');
      var target = raw === 'tools' ? tools : parseInt(raw, 10);
      b.textContent = pad2(target);
      var host = b.closest('.stat') || b;
      if (!('IntersectionObserver' in window)) return;
      var io = new IntersectionObserver(function (es) {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        if (!isMo()) return;
        var t0 = performance.now();
        requestAnimationFrame(function f(t) {
          var p = clamp((t - t0) / 1400, 0, 1);
          b.textContent = pad2(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(f);
        });
      });
      io.observe(host);
    });
  });

  /* ---------- Stack terminal ---------- */
  safe('stack', function () {
    var tabs = $$('.tab'), panes = $$('.pane');
    var cmd = $('.prompt [data-cmd]'), rd = $('#readtxt');
    var typers = {};   /* one timer per target, so the command line and the readout never cancel each other */
    var idle = 'Hover a tool to see where it was used.';
    function typeInto(el, txt, key) {
      if (!el) return;
      clearInterval(typers[key]);
      if (!isMo()) { el.textContent = txt; return; }
      var i = 0; el.textContent = '';
      typers[key] = setInterval(function () {
        i += 2; el.textContent = txt.slice(0, i);
        if (i >= txt.length) clearInterval(typers[key]);
      }, 16);
    }
    panes.forEach(function (p) { $$('.chip', p).forEach(function (c, i) { c.style.setProperty('--n', i); }); });
    /* keep each tab's count in sync with the chips in its pane */
    tabs.forEach(function (t, i) {
      var tc = $('.tab-c', t);
      if (tc && panes[i]) tc.textContent = pad2($$('.chip', panes[i]).length);
    });
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { var on = x === t; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        panes.forEach(function (p, j) { p.classList.toggle('on', j === i); });
        if (cmd) typeInto(cmd, t.getAttribute('data-cmd'), 'cmd');
        if (rd) { clearInterval(typers.rd); rd.textContent = idle; }
      });
    });
    $$('.chip').forEach(function (c) {
      var go = function () { typeInto(rd, c.getAttribute('data-n'), 'rd'); };
      c.addEventListener('click', go);
      c.addEventListener('focus', go);
      c.addEventListener('mouseenter', function () { if (matchMedia('(hover:hover)').matches) go(); });
    });
  });

  /* ---------- Copy email ---------- */
  safe('copy', function () {
    var cb = $('#copyBtn'), cm = $('#copyMsg'), mailT = $('.c-mail-t');
    if (!cb || !cm || !mailT) return;
    cb.addEventListener('click', function () {
      var txt = mailT.textContent.trim();
      function ok() { cm.textContent = 'Copied'; setTimeout(function () { cm.textContent = ''; }, 1800); }
      function fail() {
        var r = document.createRange(); r.selectNodeContents(mailT);
        var s = getSelection(); s.removeAllRanges(); s.addRange(r);
        cm.textContent = 'Press Ctrl/Cmd+C';
      }
      try { navigator.clipboard.writeText(txt).then(ok, fail); } catch (e) { fail(); }
    });
  });

  /* ---------- Hero canvas: drifting network that reacts to the cursor ---------- */
  safe('canvas', function () {
    var c = $('#fx'), hero = $('.hero');
    if (!c || !hero) return;
    var ctx = c.getContext('2d');
    if (!ctx) return;
    var w = 0, h = 0, dpr = 1, pts = [], visible = true;
    var mouse = { x: -9999, y: -9999 };

    function size() {
      var r = c.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = clamp(Math.round(w * h / 15000), 34, 110);
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28, r: Math.random() * 1.4 + .7 });
      }
      draw();
    }
    function step() {
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var dx = p.x - mouse.x, dy = p.y - mouse.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140 && dist > .1) { p.x += dx / dist * .7; p.y += dy / dist * .7; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;
      }
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      var i, j, a, b, dx, dy, dist, al;
      ctx.lineWidth = 1;
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        for (j = i + 1; j < pts.length; j++) {
          b = pts[j]; dx = a.x - b.x; dy = a.y - b.y; dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            al = (1 - dist / 130) * .2;
            ctx.strokeStyle = 'rgba(240,242,233,' + al.toFixed(3) + ')';
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        dx = a.x - mouse.x; dy = a.y - mouse.y; dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          al = (1 - dist / 180) * .75;
          ctx.strokeStyle = 'rgba(200,255,69,' + al.toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (i = 0; i < pts.length; i++) {
        a = pts[i]; dx = a.x - mouse.x; dy = a.y - mouse.y;
        var near = Math.sqrt(dx * dx + dy * dy) < 180;
        ctx.fillStyle = near ? '#C8FF45' : 'rgba(240,242,233,.5)';
        ctx.beginPath(); ctx.arc(a.x, a.y, near ? a.r + .8 : a.r, 0, 6.2832); ctx.fill();
      }
    }
    function loop() {
      if (isMo() && visible && !document.hidden) { step(); draw(); }
      requestAnimationFrame(loop);
    }

    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = c.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(hero);
    }
    var rz; addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(size, 150); });
    document.addEventListener('siiker:motion', draw);
    size(); loop();
  });

  /* ---------- Cursor ring, magnetic buttons, card tilt + spotlight ---------- */
  safe('pointer', function () {
    if (!fine) return;

    var ring = document.createElement('div');
    ring.className = 'cursor'; ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);
    var x = -100, y = -100, tx = -100, ty = -100, run = false;
    function follow() {
      x += (tx - x) * .22; y += (ty - y) * .22;
      ring.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      if (Math.abs(tx - x) > .1 || Math.abs(ty - y) > .1) requestAnimationFrame(follow); else run = false;
    }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY; ring.classList.add('on');
      if (!run) { run = true; requestAnimationFrame(follow); }
    }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      var t = e.target;
      ring.classList.toggle('big', !!(t.closest && t.closest('a,button,[data-mag]')));
    });
    d.addEventListener('mouseleave', function () { ring.classList.remove('on'); });

    $$('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        if (!isMo() || e.pointerType !== 'mouse') return;
        var r = b.getBoundingClientRect();
        b.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * .25).toFixed(1) + 'px');
        b.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * .25).toFixed(1) + 'px');
      });
      b.addEventListener('pointerleave', function () { b.style.setProperty('--mx', '0px'); b.style.setProperty('--my', '0px'); });
    });

    $$('.card').forEach(function (card) {
      var inner = $('.card-in', card), viz = $('.viz', card);
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = inner.getBoundingClientRect();
        inner.style.setProperty('--sx', (e.clientX - r.left) + 'px');
        inner.style.setProperty('--sy', (e.clientY - r.top) + 'px');
        if (viz && isMo()) {
          var v = viz.getBoundingClientRect();
          viz.style.setProperty('--ry', (((e.clientX - v.left) / v.width - .5) * 8).toFixed(2) + 'deg');
          viz.style.setProperty('--rx', (-((e.clientY - v.top) / v.height - .5) * 8).toFixed(2) + 'deg');
        }
      });
      card.addEventListener('pointerleave', function () {
        if (viz) { viz.style.setProperty('--rx', '0deg'); viz.style.setProperty('--ry', '0deg'); }
      });
    });
  });

  /* ---------- Skill map: tools <-> projects / placements ---------- */
  safe('graph', function () {
    var graph = $('.graph'); if (!graph) return;
    var tools = $$('.g-tool', graph), ents = $$('.g-ent', graph);
    var msg = $('.g-msg'), clearBtn = $('.g-clear'), NS = 'http://www.w3.org/2000/svg';
    var alias = { express: 'expressjs', firewall: 'firewalling', ldp: 'mpls' };
    function slug(s) { s = (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return alias[s] || s; }
    var tmap = {};
    tools.forEach(function (t) { t._s = slug(t.getAttribute('data-tool')); tmap[t._s] = t; });
    ents.forEach(function (e) {
      e._u = (e.getAttribute('data-uses') || '').split('|').filter(Boolean).map(slug);
      e._n = $('b', e).textContent;
    });
    var counter = $('[data-graph-count]');
    if (counter) counter.textContent = tools.length + ' tools / ' + ents.length + ' entries';

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'g-lines'); svg.setAttribute('aria-hidden', 'true');
    graph.insertBefore(svg, graph.firstChild);
    var lines = [];   // {p, t, e}
    var mq = matchMedia('(min-width:900px)');

    function layout() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      lines = [];
      if (!mq.matches) return;
      var g = graph.getBoundingClientRect();
      ents.forEach(function (e) {
        var er = e.getBoundingClientRect();
        var x2 = er.left - g.left, y2 = er.top - g.top + er.height / 2;
        e._u.forEach(function (u) {
          var t = tmap[u]; if (!t) return;
          var tr = t.getBoundingClientRect();
          var x1 = tr.right - g.left, y1 = tr.top - g.top + tr.height / 2;
          var dx = (x2 - x1) * .5;
          var p = document.createElementNS(NS, 'path');
          p.setAttribute('d', 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'C' + (x1 + dx).toFixed(1) + ' ' + y1.toFixed(1) + ' ' + (x2 - dx).toFixed(1) + ' ' + y2.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1));
          p.setAttribute('pathLength', '1');
          svg.appendChild(p);
          lines.push({ p: p, t: t, e: e });
        });
      });
      paint();
    }

    var locked = null, hover = null;
    function link(text, id) {
      var a = document.createElement('a');
      a.href = '#' + id.replace(/^#/, ''); a.textContent = text; return a;
    }
    function entLink(e, withName) {
      var id = e.getAttribute('data-proj') || e.getAttribute('data-exp');
      return id ? link(withName ? e._n : 'View', id) : document.createTextNode(e._n);
    }
    function paint() {
      var cur = hover || locked;
      graph.classList.toggle('has-sel', !!cur);
      var onT = {}, onE = [], litSlugs = [];
      if (cur) {
        if (cur.classList.contains('g-tool')) {
          litSlugs = [cur._s];
          ents.forEach(function (e) { if (e._u.indexOf(cur._s) > -1) onE.push(e); });
        } else {
          litSlugs = cur._u.slice();
          cur._u.forEach(function (u) { onT[u] = 1; });
        }
      }
      tools.forEach(function (t) {
        var isSel = cur === t, rel = !!(cur && cur !== t && (onT[t._s] || (cur.classList.contains('g-tool') ? false : false)));
        t.classList.toggle('sel', isSel);
        t.classList.toggle('rel', rel);
        t.classList.toggle('dim', !!cur && !isSel && !rel);
        t.setAttribute('aria-pressed', locked === t ? 'true' : 'false');
      });
      ents.forEach(function (e) {
        var isSel = cur === e, on = onE.indexOf(e) > -1;
        e.classList.toggle('sel', isSel);
        e.classList.toggle('on', on);
        e.classList.toggle('dim', !!cur && !isSel && !on);
        e.setAttribute('aria-pressed', locked === e ? 'true' : 'false');
      });
      lines.forEach(function (l) {
        var on = !!cur && (cur === l.t || cur === l.e);
        if (on !== l.p.classList.contains('on')) l.p.classList.toggle('on', on);
      });
      $$('.tech li').forEach(function (li) {
        var s = slug(li.textContent);
        li.classList.toggle('lit', litSlugs.indexOf(s) > -1);
      });
      // info line
      var shown = locked || hover;
      while (msg.firstChild) msg.removeChild(msg.firstChild);
      if (!shown) {
        msg.textContent = 'Pick a tool or an entry to see how they connect.';
      } else if (shown.classList.contains('g-tool')) {
        var b = document.createElement('b'); b.textContent = shown.getAttribute('data-tool');
        msg.appendChild(b);
        if (!onE.length) msg.appendChild(document.createTextNode(' — not tied to a listed project yet.'));
        else {
          msg.appendChild(document.createTextNode(' appears in: '));
          onE.forEach(function (e, i) {
            if (i) msg.appendChild(document.createTextNode(', '));
            msg.appendChild(entLink(e, true));
          });
        }
      } else {
        var b2 = document.createElement('b'); b2.textContent = shown._n; msg.appendChild(b2);
        msg.appendChild(document.createTextNode(' uses ' + shown._u.length + ' tools: ' +
          shown.getAttribute('data-uses').split('|').join(', ') + '. '));
        var pid = shown.getAttribute('data-proj'), xid = shown.getAttribute('data-exp');
        if (pid) { msg.appendChild(link('Project ↗', pid)); msg.appendChild(document.createTextNode(' ')); }
        if (xid) msg.appendChild(link('Experience ↗', xid));
      }
      if (clearBtn) clearBtn.hidden = !locked;
    }
    function lock(el) { locked = (locked === el) ? null : el; paint(); }

    tools.concat(ents).forEach(function (el) {
      el.addEventListener('click', function () { lock(el); });
      el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { hover = el; paint(); } });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && hover === el) { hover = null; paint(); } });
      el.addEventListener('focus', function () { if (el.matches(':focus-visible')) { hover = el; paint(); } });
      el.addEventListener('blur', function () { if (hover === el) { hover = null; paint(); } });
    });
    if (clearBtn) clearBtn.addEventListener('click', function () { locked = null; hover = null; paint(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && locked && !document.querySelector('.pal.open')) { locked = null; paint(); }
    });

    api.focusTool = function (name, scroll) {
      var t = tmap[slug(name)]; if (!t) return false;
      locked = t; hover = null; paint();
      if (scroll) graph.scrollIntoView({ behavior: isMo() ? 'smooth' : 'auto', block: 'center' });
      return true;
    };
    api.hasTool = function (name) { return !!tmap[slug(name)]; };

    layout();
    if ('ResizeObserver' in window) new ResizeObserver(function () { layout(); }).observe(graph);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    addEventListener('load', layout);
    if (mq.addEventListener) mq.addEventListener('change', layout);
  });

  /* ---------- Command palette (Ctrl/Cmd + K, or "/") ---------- */
  safe('palette', function () {
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    $$('.kbtn kbd').forEach(function (k) { k.textContent = mac ? '⌘ K' : 'Ctrl K'; });

    var pal = document.createElement('div');
    pal.className = 'pal';
    pal.setAttribute('role', 'dialog'); pal.setAttribute('aria-modal', 'true'); pal.setAttribute('aria-label', 'Command palette');
    pal.innerHTML =
      '<div class="pal-back"></div><div class="pal-box">' +
      '<div class="pal-top"><span class="pal-pr" aria-hidden="true">&gt;</span>' +
      '<input class="pal-in" type="text" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-autocomplete="list" placeholder="Search sections, projects, tools…" autocomplete="off" spellcheck="false">' +
      '<kbd>Esc</kbd></div>' +
      '<div class="pal-list" id="pal-list" role="listbox" aria-label="Results"></div>' +
      '<div class="pal-foot mono"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> go</span><span><kbd>Esc</kbd> close</span></div></div>';
    document.body.appendChild(pal);
    var toast = document.createElement('div');
    toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast);

    var input = $('.pal-in', pal), list = $('.pal-list', pal), back = $('.pal-back', pal);
    var items = [], shown = [], sel = 0, isOpen = false, lastFocus = null, tT = 0;

    function say(t) {
      toast.textContent = t; toast.classList.add('show');
      clearTimeout(tT); tT = setTimeout(function () { toast.classList.remove('show'); }, 2200);
    }
    function go(sel) {
      var el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el) return;
      el.scrollIntoView({ behavior: isMo() ? 'smooth' : 'auto', block: 'start' });
    }
    function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
    function copyMail() {
      var m = $('#mail'), addr = m ? m.getAttribute('href').replace('mailto:', '') : '';
      function ok() { say('Email copied'); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(ok, function () { say(addr); });
      else say(addr);
    }

    function collect() {
      var out = [];
      function add(g, label, hint, run) { out.push({ g: g, label: label, hint: hint, run: run }); }
      [['Hero', '#hero'], ['Projects', '#projects'], ['Experience', '#experience'], ['Skills', '#skills'], ['About', '#about'], ['Contact', '#contact']].forEach(function (s) {
        if (document.querySelector(s[1])) add('Go to', s[0], 'Section', function () { go(s[1]); });
      });
      add('Actions', 'Copy email address', 'Clipboard', copyMail);
      var mail = $('#mail'); if (mail) add('Actions', 'Send an email', 'Mail', function () { location.href = mail.getAttribute('href'); });
      var cv = $('a[download]'); if (cv) add('Actions', 'Download CV', 'PDF', function () { cv.click(); });
      var gh = $('a[href*="github.com"]'); if (gh) add('Actions', 'Open GitHub', 'Link', function () { window.open(gh.href, '_blank', 'noopener'); });
      var li = $('a[href*="linkedin.com"]'); if (li) add('Actions', 'Open LinkedIn', 'Link', function () { window.open(li.href, '_blank', 'noopener'); });
      if (motionBtn) add('Actions', 'Toggle motion', isMo() ? 'Now on' : 'Now off', function () { motionBtn.click(); });
      $$('.card').forEach(function (c) { add('Projects', txt($('.pt', c)), 'Project', function () { go(c); }); });
      $$('.mini').forEach(function (c) { add('Labs', txt($('h4,h3,.mini-t', c)) || txt(c).slice(0, 40), 'Lab', function () { go(c); }); });
      $$('.xp-row').forEach(function (r) { add('Experience', txt($('.xp-org', r)) + ' · ' + txt($('.xp-yr', r)), 'Placement', function () { go(r); }); });
      $$('.g-tool').forEach(function (t) {
        var n = t.getAttribute('data-tool');
        add('Tools', n, 'Show in skill map', function () { api.focusTool(n, true); });
        out[out.length - 1].onlyQuery = true;
      });
      return out;
    }

    function match(label, q) {
      var l = label.toLowerCase(), i = l.indexOf(q);
      if (i > -1) { var a = []; for (var k = 0; k < q.length; k++) a.push(i + k); return { s: i === 0 ? 0 : (i < 4 ? 1 : 2), idx: a }; }
      var idx = [], p = 0;
      for (var c = 0; c < l.length && p < q.length; c++) if (l[c] === q[p]) { idx.push(c); p++; }
      return p === q.length ? { s: 5, idx: idx } : null;
    }
    function render() {
      var q = input.value.trim().toLowerCase();
      shown = [];
      items.forEach(function (it) {
        if (!q) { if (!it.onlyQuery) shown.push({ it: it, s: 0, idx: [] }); return; }
        var m = match(it.label, q); if (m) shown.push({ it: it, s: m.s, idx: m.idx });
      });
      if (q) shown.sort(function (a, b) { return a.s - b.s; });
      sel = 0; list.innerHTML = '';
      if (!shown.length) {
        var e = document.createElement('div'); e.className = 'pal-empty'; e.textContent = 'Nothing matches “' + input.value.trim() + '”.'; list.appendChild(e);
        input.removeAttribute('aria-activedescendant'); return;
      }
      var lastG = '';
      shown.forEach(function (r, n) {
        if (!q && r.it.g !== lastG) { var h = document.createElement('div'); h.className = 'pal-g'; h.textContent = r.it.g; h.setAttribute('role', 'presentation'); list.appendChild(h); lastG = r.it.g; }
        var row = document.createElement('div');
        row.className = 'pal-i'; row.id = 'pal-o' + n; row.setAttribute('role', 'option');
        var l = document.createElement('span'); l.className = 'pal-l';
        var label = r.it.label, set = {}; r.idx.forEach(function (i) { set[i] = 1; });
        var buf = '', inM = false;
        function flush() { if (!buf) return; if (inM) { var mk = document.createElement('mark'); mk.textContent = buf; l.appendChild(mk); } else l.appendChild(document.createTextNode(buf)); buf = ''; }
        for (var i = 0; i < label.length; i++) { var f = !!set[i]; if (f !== inM) { flush(); inM = f; } buf += label[i]; }
        flush();
        var hnt = document.createElement('span'); hnt.className = 'pal-h'; hnt.textContent = q ? r.it.g + ' · ' + r.it.hint : r.it.hint;
        row.appendChild(l); row.appendChild(hnt);
        row.addEventListener('pointermove', function () { if (sel !== n) { sel = n; mark(false); } });
        row.addEventListener('click', function () { choose(n); });
        list.appendChild(row);
      });
      mark(false);
    }
    function mark(scroll) {
      var rows = $$('.pal-i', list);
      rows.forEach(function (r, i) { r.setAttribute('aria-selected', i === sel ? 'true' : 'false'); });
      if (rows[sel]) {
        input.setAttribute('aria-activedescendant', rows[sel].id);
        if (scroll) rows[sel].scrollIntoView({ block: 'nearest' });
      }
    }
    function choose(n) {
      var r = shown[n]; if (!r) return;
      close();
      setTimeout(function () { r.it.run(); }, 60);
    }

    var inertEls = [];
    function open() {
      if (isOpen) return;
      isOpen = true; lastFocus = document.activeElement;
      items = collect(); input.value = ''; render();
      inertEls = $$('.hd, main, .rail, #sheet');
      inertEls.forEach(function (el) { el.setAttribute('inert', ''); });
      d.classList.add('lock'); pal.classList.add('open');
      input.focus();
    }
    function close() {
      if (!isOpen) return;
      isOpen = false; pal.classList.remove('open'); d.classList.remove('lock');
      inertEls.forEach(function (el) { el.removeAttribute('inert'); });
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    api.openPalette = open; api.closePalette = close;

    input.addEventListener('input', render);
    back.addEventListener('click', close);
    pal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (shown.length) { sel = (sel + 1) % shown.length; mark(true); } }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (shown.length) { sel = (sel - 1 + shown.length) % shown.length; mark(true); } }
      else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
      else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    });
    document.addEventListener('keydown', function (e) {
      var k = (e.key || '').toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); isOpen ? close() : open(); return; }
      if (k === '/' && !isOpen && !/^(input|textarea|select)$/i.test((e.target.tagName || '')) && !e.target.isContentEditable) { e.preventDefault(); open(); }
    });
    $$('[data-pal-open]').forEach(function (b) { b.addEventListener('click', open); });
  });

  /* ---------- Scroll engine: one rAF-throttled handler drives everything ---------- */
  safe('scroll', function () {
    var prog = $('.progress'), hero = $('.hero'), wrap = $('.marq-wrap'), tl = $('.tl');
    var rail = $('.rail'), xps = $$('.xp-row'), pars = $$('[data-par]'), contact = $('.contact');
    var cards = $$('.card');
    var deck = $('.deck'), hud = null, hudN, hudT, hudS = [], hudCur = -1;
    if (deck && cards.length) {
      hud = document.createElement('div'); hud.className = 'deck-hud'; hud.setAttribute('aria-hidden', 'true');
      hudN = document.createElement('b'); hudT = document.createElement('span'); hudT.className = 'dh-t';
      var seg = document.createElement('span'); seg.className = 'dh-s';
      cards.forEach(function () { var i = document.createElement('i'); seg.appendChild(i); hudS.push(i); });
      hud.appendChild(hudN); hud.appendChild(hudT); hud.appendChild(seg); document.body.appendChild(hud);
    }
    var mqStack = matchMedia('(min-width:900px) and (min-height:640px)');
    var lastY = window.scrollY, ticking = false;
    var skew = 0, skewT = 0, skewRun = false, litN = -1, stacked = false;

    function skewLoop() {
      skew += (skewT - skew) * .12; skewT *= .86;
      if (wrap) wrap.style.setProperty('--skew', skew.toFixed(2) + 'deg');
      if (Math.abs(skew) > .02 || Math.abs(skewT) > .02) requestAnimationFrame(skewLoop);
      else { skewRun = false; if (wrap) wrap.style.setProperty('--skew', '0deg'); }
    }

    function update() {
      ticking = false;
      var y = window.scrollY, vh = window.innerHeight;
      var max = d.scrollHeight - vh;
      var mo = isMo();

      if (prog) prog.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : '0');

      if (hd) {
        hd.classList.toggle('scrolled', y > 40);
        if (mo && !menuOpen) {
          if (y > lastY + 4 && y > 160) hd.classList.add('hide');
          else if (y < lastY - 4 || y < 160) hd.classList.remove('hide');
        } else hd.classList.remove('hide');
      }

      if (hero) hero.style.setProperty('--hs', mo ? clamp(y / (hero.offsetHeight || 1), 0, 1).toFixed(3) : '0');

      if (mo && wrap) {
        skewT = clamp((y - lastY) * .12, -7, 7);
        if (!skewRun) { skewRun = true; requestAnimationFrame(skewLoop); }
      }

      var wantStack = mo && mqStack.matches, hdH = (hd ? hd.offsetHeight : 64);
      var act = -1;
      cards.forEach(function (c, i) {
        var inner = c.firstElementChild, nx = cards[i + 1], r = c.getBoundingClientRect(), p = 0, e = 1;
        if (mo) {
          if (wantStack) {
            if (nx) p = clamp(1 - (nx.getBoundingClientRect().top - r.top) / (vh * .55), 0, 1);
          } else {
            p = clamp(1 - (r.bottom - hdH) / (vh * .55), 0, 1);
          }
          e = clamp((vh - r.top) / (vh * .5), 0, 1);
          var viz = $('.card-viz', c);
          if (viz) viz.style.setProperty('--vy', (((r.top + r.height / 2) - vh / 2) * -.05).toFixed(1) + 'px');
        }
        inner.style.setProperty('--p', p.toFixed(3));
        inner.style.setProperty('--e', e.toFixed(3));
        if (r.top < vh * .55) act = i;
      });
      stacked = wantStack;
      if (hud) {
        var dr = deck.getBoundingClientRect();
        hud.classList.toggle('show', dr.top < vh * .45 && dr.bottom > vh * .6 && act > -1);
        if (act > -1 && act !== hudCur) {
          hudCur = act;
          hudN.textContent = pad2(act + 1) + ' / ' + pad2(cards.length);
          hudT.textContent = ($('.pt', cards[act]) || {}).textContent || '';
          hudS.forEach(function (i, k) { i.classList.toggle('on', k <= act); i.classList.toggle('cur', k === act); });
        }
      }

      if (scrubEl && sws.length) {
        var r = scrubEl.getBoundingClientRect();
        var n = Math.round(clamp((vh * .82 - r.top) / (r.height + vh * .25), 0, 1) * sws.length);
        if (n !== litN) { sws.forEach(function (s, i) { s.classList.toggle('lit', i < n); }); litN = n; }
      }

      if (tl) {
        var tr = tl.getBoundingClientRect();
        tl.style.setProperty('--tp', clamp((vh * .7 - tr.top) / tr.height, 0, 1).toFixed(3));
      }

      var sp = max > 0 ? clamp(y / max, 0, 1) : 0;
      if (rail) {
        rail.style.setProperty('--sp', sp.toFixed(4));
        rail.classList.toggle('show', y > vh * .55);
      }

      xps.forEach(function (row) {
        var rr = row.getBoundingClientRect();
        row.style.setProperty('--rp', clamp((vh * .62 - rr.top) / rr.height, 0, 1).toFixed(3));
        row.classList.toggle('lit', rr.top < vh * .62);
      });

      var par = mo && mqStack.matches;
      pars.forEach(function (el) {
        var pr = el.getBoundingClientRect(), f = parseFloat(el.getAttribute('data-par')) || 0;
        el.style.setProperty('--py', par ? (((pr.top + pr.height / 2) - vh / 2) * -f).toFixed(1) + 'px' : '0px');
      });

      if (contact) {
        var cr = contact.getBoundingClientRect();
        contact.style.setProperty('--cp', mo ? clamp((vh - cr.top) / (vh * .7), 0, 1).toFixed(3) : '1');
      }

      lastY = y;
    }
    function req() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', req, { passive: true });
    document.addEventListener('siiker:motion', req);
    update();
  });
})();
