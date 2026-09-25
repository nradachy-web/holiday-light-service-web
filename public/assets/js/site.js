/* Holiday Light Service site script. The page is complete without it; this file only adds
   interaction, motion and form delivery. Each feature is isolated so one failure cannot stop the rest. */
(function () {
  'use strict';
  var w = window;
  var d = document;
  var root = d.documentElement;
  w.__hls = true;
  root.classList.add('js');
  w.dataLayer = w.dataLayer || [];

  var reduce = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var motion = root.classList.contains('motion');
  var PHONE = '(248) 756-8915';
  var TEL = 'tel:+12487568915';
  var PROPERTY_SHORT = { 'Home': 'Home', 'HOA or subdivision': 'HOA or entrance', 'Business': 'Business', 'Downtown or municipality': 'Downtown' };
  var PROPERTY_FOR = { 'Home': 'For a home', 'HOA or subdivision': 'For an HOA or entrance', 'Business': 'For a business', 'Downtown or municipality': 'For a downtown' };
  // Ad final URLs can preset the card: ?property=hoa&lights=roofline,trees
  var URL_PROPERTY = { home: 'Home', hoa: 'HOA or subdivision', business: 'Business', downtown: 'Downtown or municipality' };
  var URL_LIGHTS = { roofline: 'Roofline', trees: 'Trees and shrubs', entrance: 'Entrance or sign', building: 'Building outline', poles: 'Poles and lampposts', bistro: 'Bistro lights', permanent: 'Permanent lighting', landscape: 'Landscape lighting', unsure: 'Not sure yet' };
  var RECAP_KEY = 'hls_request';

  function $$(sel, el) { return Array.prototype.slice.call((el || d).querySelectorAll(sel)); }
  function push(obj) { try { w.dataLayer.push(obj); } catch (e) { /* never break the page */ } }
  function safe(name, fn) { try { fn(); } catch (e) { if (w.console) console.warn('[hls] ' + name, e); } }
  function scrollToEl(el, block) {
    el.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: block || 'start' });
  }

  /* ---- Tracking hooks: every tel: link and estimate CTA ---- */
  safe('tracking', function () {
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-contact]');
      if (a) push({ event: 'contact_click', channel: a.getAttribute('data-contact'), placement: a.getAttribute('data-placement') || '' });
      var cta = e.target.closest && e.target.closest('a[data-cta="estimate"]');
      if (cta) push({ event: 'estimate_cta_click', placement: cta.getAttribute('data-placement') || '' });
    }, true);
  });

  /* ---- Header: solid on scroll, mobile menu ---- */
  safe('header', function () {
    var hdr = d.querySelector('[data-header]');
    if (!hdr) return;
    var onScroll = function () { hdr.classList.toggle('is-solid', w.scrollY > 24); };
    onScroll();
    w.addEventListener('scroll', onScroll, { passive: true });
    var btn = hdr.querySelector('[data-menu]');
    var panel = hdr.querySelector('[data-mnav]');
    if (!btn || !panel) return;
    var setOpen = function (open, focusBtn) {
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
      hdr.classList.toggle('menu-open', open);
      // The panel fills the screen below the header; the page behind it does not scroll.
      root.classList.toggle('menu-lock', open);
      if (!open && focusBtn) btn.focus();
    };
    btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false, true); });
    w.addEventListener('resize', function () { if (w.innerWidth >= 1200 && !panel.hidden) setOpen(false); });
  });

  /* ---- Background videos: attached after load and idle; never on reduced motion, Save-Data or 2g/3g ---- */
  safe('videos', function () {
    var videos = $$('video[data-bg-video]');
    if (!videos.length) return;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var lowData = function () { return !!(conn && (conn.saveData || /2g|3g/.test(conn.effectiveType || ''))); };
    var autoOK = function () { return !reduce.matches && !lowData(); };
    var gateOpen = false;
    var states = videos.map(function (v) {
      var btn = d.querySelector('[data-video-toggle][aria-controls="' + v.id + '"]');
      return { v: v, btn: btn, started: false, playing: false, userPaused: false, visible: false, auto: v.getAttribute('data-autostart') === 'true' };
    });
    function label(s) {
      if (!s.btn) return;
      s.btn.classList.toggle('is-playing', s.playing);
      var l = s.btn.querySelector('[data-video-label]');
      if (l) l.textContent = s.playing ? 'Pause video' : 'Play video';
    }
    function pick(v) {
      var portrait = v.getAttribute('data-src-portrait');
      if (portrait && w.matchMedia('(max-aspect-ratio: 4/5)').matches) return portrait;
      return w.innerWidth >= 1920 ? v.getAttribute('data-src-hd') : v.getAttribute('data-src-sd');
    }
    function play(s) {
      var v = s.v;
      if (!s.started) {
        s.started = true;
        v.muted = true;
        v.defaultMuted = true;
        v.addEventListener('playing', function () { v.classList.add('is-live'); s.playing = true; label(s); });
        v.addEventListener('pause', function () { s.playing = false; label(s); });
        v.src = pick(v);
      }
      var p = v.play();
      if (p && p.catch) p.catch(function () { s.playing = false; label(s); });
    }
    function pause(s) { if (s.started) s.v.pause(); }
    var interacted = false;
    function sync(s) {
      if (s.userPaused) return pause(s);
      var ready = s.userStarted || (autoOK() && (s.auto ? gateOpen : gateOpen && interacted));
      if (s.visible && ready) play(s);
      else if (!s.visible) pause(s);
    }
    states.forEach(function (s) {
      label(s);
      if (s.btn) {
        s.btn.addEventListener('click', function () {
          if (s.playing) { s.userPaused = true; pause(s); }
          else { s.userPaused = false; s.userStarted = true; gateOpen = true; play(s); }
        });
      }
    });
    if ('IntersectionObserver' in w) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var s = states.filter(function (x) { return x.v === en.target; })[0];
          if (!s) return;
          s.visible = en.isIntersecting;
          sync(s);
        });
      }, { rootMargin: '120px 0px' });
      states.forEach(function (s) { io.observe(s.v); });
    }
    d.addEventListener('visibilitychange', function () {
      states.forEach(function (s) { if (d.hidden) pause(s); else sync(s); });
    });
    function open() {
      gateOpen = true;
      states.forEach(sync);
    }
    function afterLoad() {
      var idle = w.requestIdleCallback || function (cb) { return setTimeout(cb, 200); };
      idle(function () { setTimeout(open, 1800); }, { timeout: 2500 });
      var early = function () {
        interacted = true;
        setTimeout(open, 250);
        ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (t) { w.removeEventListener(t, early); });
      };
      ['scroll', 'pointerdown', 'keydown', 'touchstart'].forEach(function (t) { w.addEventListener(t, early, { passive: true }); });
    }
    if (d.readyState === 'complete') afterLoad();
    else w.addEventListener('load', afterLoad, { once: true });
  });

  /* ---- What we light switcher ---- */
  safe('switcher', function () {
    $$('[data-switch]').forEach(function (sw) {
      var tabs = $$('[data-tab]', sw);
      var panels = $$('[data-panel]', sw);
      var toggle = sw.querySelector('[data-sw-toggle]');
      var label = sw.querySelector('[data-sw-label]');
      var idx = 0;
      var userPaused = reduce.matches;
      var hover = false;
      var inView = false;
      sw.style.setProperty('--loop', '6500ms');
      function looping() { return !userPaused && !hover && inView; }
      function update() {
        sw.classList.toggle('is-looping', looping());
        if (toggle) {
          toggle.classList.toggle('is-playing', !userPaused);
          if (label) label.textContent = userPaused ? 'Play slideshow' : 'Pause slideshow';
        }
      }
      function show(i, focus) {
        idx = (i + tabs.length) % tabs.length;
        tabs.forEach(function (t, k) {
          var on = k === idx;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
        });
        panels.forEach(function (p, k) {
          var on = k === idx;
          p.classList.toggle('is-active', on);
          p.inert = !on;
          if (on) p.removeAttribute('aria-hidden'); else p.setAttribute('aria-hidden', 'true');
        });
        if (focus) tabs[idx].focus();
        sw.classList.remove('is-looping');
        var prog = tabs[idx].querySelector('.pill-prog');
        if (prog) { prog.style.animation = 'none'; void prog.offsetWidth; prog.style.animation = ''; }
        update();
      }
      tabs.forEach(function (t, k) {
        t.addEventListener('click', function () { show(k); });
        t.addEventListener('keydown', function (e) {
          var n = null;
          if (e.key === 'ArrowRight') n = idx + 1;
          if (e.key === 'ArrowLeft') n = idx - 1;
          if (e.key === 'Home') n = 0;
          if (e.key === 'End') n = tabs.length - 1;
          if (n !== null) { e.preventDefault(); show(n, true); }
        });
        var prog = t.querySelector('.pill-prog');
        if (prog) prog.addEventListener('animationend', function () { if (looping()) show(idx + 1); });
      });
      var stage = sw.querySelector('.sw-stage');
      stage.addEventListener('mouseenter', function () { hover = true; update(); });
      stage.addEventListener('mouseleave', function () { hover = false; update(); });
      sw.addEventListener('focusin', function (e) { if (!e.target.matches('[data-tab]')) { hover = true; update(); } });
      sw.addEventListener('focusout', function () { hover = false; update(); });
      if (toggle) toggle.addEventListener('click', function () { userPaused = !userPaused; update(); });
      if ('IntersectionObserver' in w) {
        new IntersectionObserver(function (entries) { entries.forEach(function (en) { inView = en.isIntersecting; update(); }); }, { threshold: 0.35 }).observe(sw);
      }
      show(0);
    });
  });

  /* ---- Season string: bulbs lit up to today, "We are here" and "Now" on the current phases ---- */
  safe('season', function () {
    $$('[data-season]').forEach(function (el) {
      var now = new Date();
      var md = (now.getMonth() + 1) * 100 + now.getDate();
      var parse = function (s) { var p = s.split('-'); return parseInt(p[0], 10) * 100 + parseInt(p[1], 10); };
      var stations = $$('.station', el);
      var current = [];
      stations.forEach(function (st, i) {
        var f = parse(st.getAttribute('data-from'));
        var t = parse(st.getAttribute('data-to'));
        var on = f <= t ? md >= f && md <= t : md >= f || md <= t;
        if (on) current.push(i);
      });
      var planning = !current.length;
      if (planning) current = [0];
      var last = Math.max.apply(null, current);
      var names = [];
      stations.forEach(function (st, i) {
        var isNow = current.indexOf(i) >= 0;
        st.classList.toggle('is-now', isNow);
        st.classList.toggle('is-dark', i > last);
        var now = st.querySelector('.st-now');
        if (now) now.hidden = !isNow || planning;
        var here = st.querySelector('.st-here');
        if (here) here.hidden = i !== current[0];
        if (isNow) names.push(st.getAttribute('data-phase') || st.querySelector('h3').textContent.toLowerCase());
      });
      var summary = el.querySelector('[data-season-summary]');
      if (summary) {
        summary.innerHTML = planning
          ? 'The season has not started yet, which makes now the easiest time to <strong>plan a design</strong>.'
          : 'Where the season stands today: <strong>' + names.join(' and ') + '</strong>. Booking earlier gives you more date options.';
        summary.hidden = false;
      }
    });
  });

  /* ---- Statement: words light as the paragraph scrolls through (c2) ---- */
  safe('statement', function () {
    if (!motion || reduce.matches) return;
    $$('[data-lit]').forEach(function (p) {
      var words = $$('.lw', p);
      if (!words.length) return;
      var r0 = p.getBoundingClientRect();
      if (r0.bottom < 0) return;
      p.classList.add('lit-ready');
      var on = 0;
      var tick = false;
      function update() {
        tick = false;
        var r = p.getBoundingClientRect();
        var vh = w.innerHeight;
        var prog = Math.min(1, Math.max(0, (vh * 0.86 - r.top) / (r.height + vh * 0.28)));
        var n = Math.round(prog * words.length);
        for (var i = on; i < n; i++) words[i].classList.add('on');
        if (n > on) on = n;
        if (on >= words.length) w.removeEventListener('scroll', onScroll);
      }
      function onScroll() { if (!tick) { tick = true; requestAnimationFrame(update); } }
      w.addEventListener('scroll', onScroll, { passive: true });
      update();
    });
  });

  /* ---- Permanent lighting scenes: recolor the C9 string with a chase ---- */
  safe('scenes', function () {
    var SCENES = {
      warm: ['#ffcf85'],
      christmas: ['#ff5a4e', '#ffcf85', '#3fd37d'],
      game: ['#4d86ff', '#4d86ff', '#ffc933', '#ffc933'],
      july: ['#ff4f4f', '#fff3e0', '#5a86ff'],
      halloween: ['#ff7a1a', '#ff7a1a', '#a56cff']
    };
    $$('[data-scene]').forEach(function (scene) {
      var bulbs = $$('.on use', scene);
      var pills = $$('[data-scene-set]', scene);
      pills.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var pal = SCENES[btn.getAttribute('data-scene-set')] || SCENES.warm;
          bulbs.forEach(function (b, i) { b.style.color = pal[i % pal.length]; });
          pills.forEach(function (q) { q.setAttribute('aria-pressed', String(q === btn)); });
        });
      });
    });
  });

  /* ---- Quote form: stepper, presets, validation and delivery ---- */
  var forms = [];
  safe('forms', function () {
    $$('form[data-quote]').forEach(function (form) { forms.push(initForm(form)); });
  });

  function cityLabel(form) {
    var sel = form.querySelector('select[name="city"]');
    if (!sel || !sel.value || sel.value === 'other') return '';
    return sel.options[sel.selectedIndex].text;
  }
  function checkedValue(form, name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }
  function checkedValues(form, name) {
    return $$('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; });
  }
  function updateContext(form) {
    var ctx = form.querySelector('[data-context]');
    var prop = checkedValue(form, 'property_type');
    // "Planning for" pills show which property type the page's form is set to.
    if (form.closest('#estimate')) {
      $$('[data-plan-pill]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-preset-property') === prop)); });
    }
    if (!ctx) return;
    var p = prop ? PROPERTY_SHORT[prop] || prop : '';
    var city = cityLabel(form);
    // A map pin only when a place is known; otherwise the tag names the property type with a house icon.
    var text = p && city ? p + ' in ' + city : city ? 'Estimate for ' + city : prop ? PROPERTY_FOR[prop] || p : '';
    ctx.hidden = !text;
    if (city) ctx.setAttribute('data-has-city', ''); else ctx.removeAttribute('data-has-city');
    var t = ctx.querySelector('[data-context-text]');
    if (t) t.textContent = text;
  }
  // Presets from the page URL, applied to every quote form on the page.
  function urlPresets(form) {
    var q;
    try { q = new URLSearchParams(w.location.search); } catch (e) { return; }
    var prop = q.get('property');
    if (prop) {
      var v = URL_PROPERTY[prop.toLowerCase()] || prop;
      var r = form.querySelector('input[name="property_type"][value="' + v.replace(/"/g, '') + '"]');
      if (r) r.checked = true;
    }
    var lights = q.get('lights');
    if (lights) {
      lights.split(',').forEach(function (k) {
        k = k.trim();
        if (!k) return;
        var val = URL_LIGHTS[k.toLowerCase()] || k;
        var c = form.querySelector('input[name="what_to_light"][value="' + val.replace(/"/g, '') + '"]');
        if (c) c.checked = true;
      });
    }
  }
  function headerHeight() {
    var h = d.querySelector('[data-header] .hdr');
    return h ? h.getBoundingClientRect().height : 70;
  }

  function initForm(form) {
    form.noValidate = true;
    var placement = form.getAttribute('data-placement') || '';
    var steps = $$('[data-step]', form);
    var dots = $$('.q-dots li', form);
    var next = form.querySelector('[data-next]');
    var back = form.querySelector('[data-back]');
    var submit = form.querySelector('button[type="submit"]');
    var status = form.querySelector('[role="status"]');
    var announce = form.querySelector('[data-step-announce]');
    var summary = form.querySelector('[data-summary]');
    var live = form.getAttribute('data-mode') === 'live';
    var cur = 0;
    var started = false;
    var reached = {};
    if (submit && submit.hasAttribute('data-preview-lock')) submit.disabled = false;

    function start() {
      if (started) return;
      started = true;
      push({ event: 'estimate_start', placement: placement });
    }
    function writeSummary() {
      if (!summary) return;
      var bits = [];
      var lights = checkedValues(form, 'what_to_light');
      if (lights.length) bits.push(lights.join(', '));
      var prop = checkedValue(form, 'property_type');
      if (prop) bits.push(prop);
      var city = cityLabel(form);
      if (city) bits.push(city);
      summary.textContent = bits.length ? 'Your request: ' + bits.join(' · ') : '';
      summary.hidden = !bits.length;
    }
    function go(n, focus) {
      n = Math.max(0, Math.min(steps.length - 1, n));
      var moved = n !== cur;
      cur = n;
      steps.forEach(function (s, i) {
        if (i === n) s.setAttribute('data-step-active', ''); else s.removeAttribute('data-step-active');
      });
      dots.forEach(function (li, i) { li.classList.toggle('is-on', i <= n); });
      if (back) back.hidden = n === 0;
      var nextText = next && next.querySelector('[data-next-text]');
      var nextLabel = steps[n].getAttribute('data-next-label');
      if (nextText && nextLabel) nextText.textContent = nextLabel;
      if (n === steps.length - 1) form.setAttribute('data-at-last', ''); else form.removeAttribute('data-at-last');
      if (n === steps.length - 1) writeSummary();
      if (announce && moved) announce.textContent = 'Step ' + (n + 1) + ' of ' + steps.length + ': ' + steps[n].querySelector('legend').textContent;
      if (focus) {
        var first = steps[n].querySelector('input:not([type="hidden"]), select');
        if (first) first.focus({ preventScroll: true });
      }
      // A new step can open with its heading scrolled up under the fixed header (Next sits low in a
      // tall first step on phones). Bring the card head back into view.
      if (moved) {
        var head = form.querySelector('.q-head');
        var wrap = form.closest('.quote-wrap');
        if (head && wrap && head.getBoundingClientRect().top < headerHeight()) scrollToEl(wrap, 'start');
      }
      // One estimate_step per step reached, so Back and Next again do not inflate the funnel.
      if (moved && n > 0 && !reached[n]) {
        reached[n] = true;
        push({ event: 'estimate_step', step: n + 1, placement: placement });
      }
    }
    form.addEventListener('focusin', function (e) { if (e.target.matches('input, select, button')) start(); });
    form.addEventListener('change', function (e) {
      start();
      if (e.target.name === 'property_type' || e.target.name === 'city') updateContext(form);
      if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) fieldError(e.target, '');
    });
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) fieldError(e.target, '');
    });
    if (next) next.addEventListener('click', function () { start(); go(cur + 1, true); });
    if (back) back.addEventListener('click', function () { go(cur - 1, true); });

    function fieldStep(el) {
      for (var i = 0; i < steps.length; i++) if (steps[i].contains(el)) return i;
      return steps.length - 1;
    }
    // Inline messages sit under each field and are linked with aria-describedby only while invalid.
    function fieldError(f, msg) {
      var err = f && f.parentNode.querySelector('[data-err]');
      if (msg) {
        f.setAttribute('aria-invalid', 'true');
        if (err) { err.textContent = msg; err.hidden = false; f.setAttribute('aria-describedby', err.id); }
      } else if (f) {
        f.removeAttribute('aria-invalid');
        f.removeAttribute('aria-describedby');
        if (err) { err.textContent = ''; err.hidden = true; }
      }
    }
    function validate() {
      var name = form.querySelector('[name="name"]');
      var phone = form.querySelector('[name="phone"]');
      var email = form.querySelector('[name="email"]');
      var bad = [];
      [name, phone, email].forEach(function (f) { if (f) fieldError(f, ''); });
      if (name && !name.value.trim()) bad.push([name, 'your name', 'Please add your name.']);
      var digits = phone ? phone.value.replace(/\D/g, '').length : 10;
      if (phone && !digits) bad.push([phone, 'a phone number', 'Please add a phone number.']);
      else if (phone && digits < 10) bad.push([phone, 'a phone number with area code', 'Please add a phone number with area code.']);
      if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) bad.push([email, 'a valid email, or leave it blank', 'Please check the email, or leave it blank.']);
      bad.forEach(function (b) { fieldError(b[0], b[2]); });
      return bad;
    }
    function setStatus(html, isError) {
      if (!status) return;
      status.classList.toggle('is-error', !!isError);
      status.innerHTML = html;
    }
    function callButton(where) {
      return '<a class="btn btn-night" href="' + TEL + '" data-contact="phone" data-placement="' + placement + '_' + where + '">Call ' + PHONE + '</a>';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      start();
      // Enter in a field before the last step (implicit submission) moves on instead of validating
      // fields the visitor has not seen yet.
      if (cur < steps.length - 1) { go(cur + 1, true); return; }
      var hp = form.querySelector('[name="botcheck"]');
      if (hp && hp.checked) return;
      var bad = validate();
      if (bad.length) {
        var step = fieldStep(bad[0][0]);
        if (step !== cur) go(step, false);
        bad[0][0].focus();
        setStatus('Please add ' + bad.map(function (b) { return b[1]; }).join(' and ') + '.', true);
        return;
      }
      var lights = checkedValues(form, 'what_to_light');
      var prop = checkedValue(form, 'property_type');
      var citySel = form.querySelector('select[name="city"]');
      var citySlug = citySel ? citySel.value : '';
      var cityName = cityLabel(form) || (citySlug === 'other' ? 'Somewhere else in Michigan' : '');
      var val = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };

      if (!live) {
        setStatus('<strong>Preview build:</strong> this request was not sent. To get your free estimate now, call us.' + callButton('preview'), false);
        return;
      }

      if (submit.getAttribute('aria-busy') === 'true') return;
      var submitText = submit.querySelector('span');
      var submitLabel = submitText ? submitText.textContent : '';
      var busy = function (on) {
        if (on) submit.setAttribute('aria-busy', 'true'); else submit.removeAttribute('aria-busy');
        if (submitText) submitText.textContent = on ? 'Sending your request' : submitLabel;
      };
      busy(true);
      setStatus('Sending your request.', false);
      var payload = {
        access_key: val('access_key'),
        subject: 'Estimate request: ' + (prop || 'Property') + (cityName ? ' in ' + cityName : ''),
        from_name: 'Holiday Light Service website',
        page: w.location.pathname,
        placement: placement,
        what_to_light: lights.join(', '),
        property_type: prop,
        city: cityName,
        city_slug: citySlug,
        address: val('address'),
        name: val('name'),
        phone: val('phone'),
        email: val('email'),
        botcheck: false
      };
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, j: j }; }); })
        .then(function (r) {
          if (!r.ok || !r.j || r.j.success !== true) throw new Error('not accepted');
          try {
            if (w.apexAttribution && typeof w.apexAttribution.attach === 'function') {
              w.apexAttribution.attach({ name: payload.name, email: payload.email, phone: payload.phone, message: [payload.what_to_light, prop, cityName, payload.address].filter(Boolean).join(' | ') });
            }
          } catch (err) { /* attribution is additive only */ }
          // The thank-you page repeats the choices back (never name, phone or email).
          try { w.sessionStorage.setItem(RECAP_KEY, [payload.what_to_light, prop, cityName].filter(Boolean).join(' · ')); } catch (err) { /* optional */ }
          var thanks = d.body.getAttribute('data-thanks') || '/thank-you/';
          var left = false;
          var leave = function () { if (!left) { left = true; w.location.href = thanks; } };
          // A lead counts only after the form service confirms it. With Tag Manager on the page the
          // redirect waits for its tags (eventCallback, capped by eventTimeout) so the conversion is not
          // cut off by the navigation; without it there is nothing to wait for.
          var gtm = !!(w.google_tag_manager && Object.keys(w.google_tag_manager).some(function (k) { return /^GTM-/.test(k); }));
          push({ event: 'generate_lead', property_type: prop, city: citySlug, city_name: cityName, placement: placement, eventCallback: leave, eventTimeout: 1500 });
          setTimeout(leave, gtm ? 1700 : 150);
        })
        .catch(function () {
          busy(false);
          setStatus('That did not go through. Your details are still here, so try again, or call <a href="' + TEL + '" data-contact="phone" data-placement="' + placement + '_error">' + PHONE + '</a>.', true);
        });
    });

    urlPresets(form);
    go(0, false);
    updateContext(form);
    return { form: form, go: go, wrap: form.closest('.quote-wrap') };
  }

  /* ---- Presets: property cards, switcher buttons and band CTAs fill in the page's primary form ---- */
  safe('presets', function () {
    d.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-preset-property], [data-preset-light]');
      if (!t) return;
      var wrap = d.getElementById('estimate');
      var form = wrap && wrap.querySelector('form[data-quote]');
      if (!form) return;
      e.preventDefault();
      var api = forms.filter(function (f) { return f.form === form; })[0];
      var flash = null;
      var prop = t.getAttribute('data-preset-property');
      var light = t.getAttribute('data-preset-light');
      if (prop) {
        var r = form.querySelector('input[name="property_type"][value="' + prop + '"]');
        if (r) { r.checked = true; flash = r.closest('.chip'); }
      }
      if (light) {
        light.split(',').forEach(function (l) {
          var c = form.querySelector('input[name="what_to_light"][value="' + l.trim() + '"]');
          if (c) { c.checked = true; flash = flash || c.closest('.chip'); }
        });
      }
      updateContext(form);
      if (api) api.go(0, false);
      scrollToEl(wrap, w.innerWidth < 980 ? 'start' : 'center');
      var title = form.querySelector('.q-title');
      if (title) title.focus({ preventScroll: true });
      form.classList.remove('is-pinged');
      void form.offsetWidth;
      form.classList.add('is-pinged');
      if (flash) { flash.classList.remove('is-flash'); void flash.offsetWidth; flash.classList.add('is-flash'); }
    });
  });

  /* ---- Sticky mobile bar: steps aside while a form's controls (or a hero action row) are on screen.
     Only the step fieldsets and the action buttons count, not the whole card, so a sliver of the
     card's footer does not hide the bar and its phone number. ---- */
  safe('mobile-bar', function () {
    var bar = d.querySelector('[data-mobile-bar]');
    if (!bar) return;
    var targets = $$('form[data-quote] [data-step], form[data-quote] .q-actions, [data-bar-hide]');
    if (!('IntersectionObserver' in w) || !targets.length) { bar.classList.add('is-ready'); return; }
    var visible = new Set();
    var sync = function () { bar.classList.toggle('is-hidden', visible.size > 0); };
    // The bar starts hidden (.js .mobile-bar:not(.is-ready)) and only becomes ready once the
    // observer has reported, so it never flashes over a form on the first screen.
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
      sync();
      if (!bar.classList.contains('is-ready')) w.requestAnimationFrame(function () { bar.classList.add('is-ready'); });
    });
    targets.forEach(function (t) { io.observe(t); });
    // Start hidden when a target is already on the first screen, to avoid a flash.
    var vh = w.innerHeight;
    targets.forEach(function (t) { var r = t.getBoundingClientRect(); if (r.top < vh && r.bottom > 0) visible.add(t); });
    sync();
  });

  /* ---- Reveal blocks once as they enter (only those that start below the fold) ---- */
  safe('reveal', function () {
    if (!motion || reduce.matches || !('IntersectionObserver' in w)) return;
    var vh = w.innerHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });
    var pending = [];
    $$('[data-reveal]').forEach(function (el) {
      if (el.getBoundingClientRect().top > vh * 0.94) { el.classList.add('pre'); io.observe(el); pending.push(el); }
    });
    // Safety net: a block the visitor has already scrolled past is revealed even if the observer
    // missed it (a fast fling, a jump link or a busy main thread that skipped frames).
    var ticking = false;
    function sweep() {
      ticking = false;
      var h = w.innerHeight;
      pending = pending.filter(function (el) {
        if (el.classList.contains('in')) return false;
        if (el.getBoundingClientRect().top < h) { el.classList.add('in'); io.unobserve(el); return false; }
        return true;
      });
      if (!pending.length) w.removeEventListener('scroll', onScroll);
    }
    function onScroll() { if (!ticking) { ticking = true; setTimeout(sweep, 120); } }
    if (pending.length) w.addEventListener('scroll', onScroll, { passive: true });
  });
  /* ---- Thank-you page: repeat the request back from this session ---- */
  safe('recap', function () {
    var el = d.querySelector('[data-request-recap]');
    if (!el) return;
    var v = '';
    try { v = w.sessionStorage.getItem(RECAP_KEY) || ''; } catch (e) { return; }
    if (!v) return;
    el.textContent = 'Your request: ' + v;
    el.hidden = false;
  });
})();
