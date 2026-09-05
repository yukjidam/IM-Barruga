/* "Blueprint → As-Built" toggle (Blueprint / night mode is the default) */
(function () {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const root = document.documentElement;
  const labelTop = document.getElementById('hero-bp-label-top-text');
  const labelBottom = document.getElementById('hero-bp-label-bottom');

  const COPY = {
    blueprint: {
      top: 'DWG-A-FP01 · Ground Floor Plan · Scale 1:100',
      bottom: 'ALL DIMENSIONS IN MILLIMETERS'
    },
    built: {
      top: 'AS-BUILT-A-ISO01 · Isometric View · As Constructed',
      bottom: 'SAME PROJECT · FINAL PHASE'
    }
  };

  function setState() {
    const isBuilt = root.classList.contains('day-mode');
    const label = isBuilt ? 'Switch to Blueprint (dark) mode' : 'Switch to As-Built (light) mode';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
    btn.setAttribute('aria-checked', String(isBuilt));

    const copy = isBuilt ? COPY.built : COPY.blueprint;
    if (labelTop) labelTop.textContent = copy.top;
    if (labelBottom) labelBottom.textContent = copy.bottom;
  }

  btn.addEventListener('click', function () {
    const isBuilt = root.classList.toggle('day-mode');
    try { localStorage.setItem('theme', isBuilt ? 'day' : 'night'); } catch (e) {}
    setState();
  });

  setState();
})();

/* Mobile nav toggle */
(function () {
  const toggle = document.getElementById('nav-toggle');
  const links  = document.getElementById('nav-links');
  if (!toggle || !links) return;

  function closeMenu() {
    links.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  function toggleMenu() {
    const isOpen = links.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  }

  toggle.addEventListener('click', toggleMenu);
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 768) closeMenu(); });
})();

/* Cursor glow */
const glow = document.getElementById('glow');
document.addEventListener('mousemove', e => {
  glow.style.left = e.clientX + 'px';
  glow.style.top  = e.clientY + 'px';
});

/* Scroll reveal */
const revealEls = document.querySelectorAll('.reveal, .timeline-item');
const io = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), i * 60);
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
revealEls.forEach(el => io.observe(el));

/* Animate skill bars when visible */
const bars = document.querySelectorAll('.skill-bar-fill');
const barObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('animated');
      barObs.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
bars.forEach(b => barObs.observe(b));

/* ══════════════════════════════════════════════════
   PROJECT PDF VIEWER
   Click a project card → load its PDF and page through it.
   ══════════════════════════════════════════════════ */
(function () {
  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const modal          = document.getElementById('pdf-modal');
  const titleEl        = document.getElementById('pdf-modal-title');
  const canvas          = document.getElementById('pdf-canvas');
  const loadingEl       = document.getElementById('pdf-loading');
  const pageIndicator  = document.getElementById('pdf-page-indicator');
  const zoomLevelEl    = document.getElementById('pdf-zoom-level');
  const downloadLink    = document.getElementById('pdf-download-link');
  const prevBtn          = document.querySelector('.pdf-nav-prev');
  const nextBtn          = document.querySelector('.pdf-nav-next');

  let pdfDoc      = null;
  let currentPage = 1;
  let totalPages  = 1;
  let rendering   = false;
  let fitScale    = 1;     // scale that fits the whole page in the box
  let zoomFactor  = 1;     // user-controlled multiplier on top of fitScale

  window.openPdfViewer = function (cardEl) {
    const url   = cardEl.getAttribute('data-pdf');
    const title = cardEl.getAttribute('data-title') || 'Project Drawing';
    if (!url) return;

    titleEl.textContent = title;
    downloadLink.href = url;
    downloadLink.setAttribute('download', url.split('/').pop());
    modal.classList.add('open');
    document.body.style.overflowY = 'hidden';

    loadingEl.style.display = 'block';
    canvas.style.display = 'none';
    pageIndicator.textContent = 'Loading…';
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    zoomFactor = 1;
    updateZoomLabel();

    if (typeof pdfjsLib === 'undefined') {
      loadingEl.textContent = 'PDF viewer library failed to load (check your internet connection / ad blocker).';
      return;
    }

    if (location.protocol === 'file:') {
      loadingEl.textContent = 'Open this site via a local server (not by double-clicking the file) for PDFs to load, see console for details.';
      console.warn(
        'PDF Viewer: page is running under file:// protocol. Browsers block PDF.js from ' +
        'fetching local files this way. Serve the folder with a local server instead, e.g.:\n' +
        '  python3 -m http.server 8000\n' +
        'then open http://localhost:8000/'
      );
      return;
    }

    pdfjsLib.getDocument(url).promise.then(doc => {
      pdfDoc = doc;
      totalPages = doc.numPages;
      currentPage = 1;
      canvas.style.display = 'block';
      renderPage(currentPage);
    }).catch(err => {
      console.error('PDF load error for', url, ':', err);
      loadingEl.textContent = `Could not load "${url}". Check the file exists at that path. (${err.message || err})`;
    });
  };

  window.closePdfViewer = function () {
    modal.classList.remove('open');
    document.body.style.overflowY = 'auto';
    pdfDoc = null;
  };

  window.pdfNextPage = function () {
    if (!pdfDoc || currentPage >= totalPages) return;
    currentPage++;
    zoomFactor = 1;
    updateZoomLabel();
    renderPage(currentPage);
  };

  window.pdfPrevPage = function () {
    if (!pdfDoc || currentPage <= 1) return;
    currentPage--;
    zoomFactor = 1;
    updateZoomLabel();
    renderPage(currentPage);
  };

  window.pdfZoomIn = function () {
    if (!pdfDoc) return;
    zoomFactor = Math.min(zoomFactor + 0.25, 3);
    updateZoomLabel();
    renderPage(currentPage, true);
  };

  window.pdfZoomOut = function () {
    if (!pdfDoc) return;
    zoomFactor = Math.max(zoomFactor - 0.25, 0.5);
    updateZoomLabel();
    renderPage(currentPage, true);
  };

  window.pdfZoomReset = function () {
    if (!pdfDoc) return;
    zoomFactor = 1;
    updateZoomLabel();
    renderPage(currentPage, true);
  };

  function updateZoomLabel() {
    zoomLevelEl.textContent = Math.round(zoomFactor * 100) + '%';
  }

  function renderPage(num, keepScroll) {
    if (!pdfDoc || rendering) return;
    rendering = true;
    loadingEl.style.display = 'block';
    loadingEl.textContent = 'Loading page…';

    const wrap = canvas.parentElement;
    const prevScrollLeft = wrap.scrollLeft;
    const prevScrollTop  = wrap.scrollTop;

    pdfDoc.getPage(num).then(page => {
      const availW = wrap.clientWidth  - 4;
      const availH = wrap.clientHeight - 4;
      const baseViewport = page.getViewport({ scale: 1 });
      // fitScale: the zoom level at which the whole page fits in the box
      fitScale = Math.min(availW / baseViewport.width, availH / baseViewport.height, 2.5);
      const effectiveScale = Math.max(fitScale * zoomFactor, 0.2);
      const viewport = page.getViewport({ scale: effectiveScale });

      // Render at devicePixelRatio so text/lines stay crisp on high-DPI phone screens
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.floor(viewport.width  * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width  = viewport.width  + 'px';
      canvas.style.height = viewport.height + 'px';

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const renderTask = page.render({ canvasContext: ctx, viewport });
      return renderTask.promise;
    }).then(() => {
      rendering = false;
      loadingEl.style.display = 'none';
      pageIndicator.textContent = `Page ${num} of ${totalPages}`;
      prevBtn.disabled = num <= 1;
      nextBtn.disabled = num >= totalPages;
      if (keepScroll) {
        wrap.scrollLeft = prevScrollLeft;
        wrap.scrollTop  = prevScrollTop;
      }
    }).catch(err => {
      rendering = false;
      console.error('Page render error:', err);
      loadingEl.textContent = 'Could not render this page.';
    });
  }

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') closePdfViewer();
    if (e.key === 'ArrowRight') pdfNextPage();
    if (e.key === 'ArrowLeft') pdfPrevPage();
    if (e.key === '+' || e.key === '=') pdfZoomIn();
    if (e.key === '-' || e.key === '_') pdfZoomOut();
  });

  // Ctrl/Cmd + scroll wheel to zoom, plain scroll to pan (native, since wrap has overflow:auto)
  const canvasWrapEl = document.querySelector('.pdf-canvas-wrap');
  if (canvasWrapEl) {
    canvasWrapEl.addEventListener('wheel', e => {
      if (!pdfDoc) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) pdfZoomIn(); else pdfZoomOut();
      }
    }, { passive: false });

    // Pinch-to-zoom (touch)
    let pinchStartDist = null;
    let pinchStartZoom = 1;
    let pinchLiveRatio = 1;

    function touchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    canvasWrapEl.addEventListener('touchstart', e => {
      if (!pdfDoc) return;
      if (e.touches.length === 2) {
        pinchStartDist = touchDist(e.touches);
        pinchStartZoom = zoomFactor;
        pinchLiveRatio = 1;
      }
    }, { passive: true });

    canvasWrapEl.addEventListener('touchmove', e => {
      if (!pdfDoc || !pinchStartDist || e.touches.length !== 2) return;
      e.preventDefault();
      pinchLiveRatio = touchDist(e.touches) / pinchStartDist;
      // Cheap live preview via CSS transform; committed with a real re-render on touchend
      canvas.style.transform = `scale(${pinchLiveRatio})`;
    }, { passive: false });

    canvasWrapEl.addEventListener('touchend', e => {
      if (!pinchStartDist || e.touches.length >= 2) return;
      canvas.style.transform = '';
      zoomFactor = Math.min(Math.max(pinchStartZoom * pinchLiveRatio, 0.5), 3);
      pinchStartDist = null;
      pinchLiveRatio = 1;
      updateZoomLabel();
      renderPage(currentPage, true);
    });
  }
})();

/* ══════════════════════════════════════════════════
   CONTACT FORM - sent via EmailJS (no backend needed)

   SETUP (one-time, takes ~5 min):
   1. Create a free account at https://www.emailjs.com
   2. Add an Email Service (e.g. connect your Gmail) →
      copy its Service ID.
   3. Create an Email Template with variables:
      {{from_name}} {{from_email}} {{purpose}} {{message}}
      → copy its Template ID.
   4. Account → General → copy your Public Key.
   5. Paste all three values into EMAILJS_CONFIG below.
   ══════════════════════════════════════════════════ */
(function () {
  const EMAILJS_CONFIG = {
    publicKey:  'xpWr6-IEB1kJ-fdWb',   // Account → General
    serviceId:  'service_87osgp4',   // Email Services
    templateId: 'template_tbl4phf'   // Email Templates
  };

  const form      = document.getElementById('contact-form');
  if (!form) return;

  const nameEl    = document.getElementById('cf-name');
  const emailEl   = document.getElementById('cf-email');
  const purposeEl = document.getElementById('cf-purpose');
  const messageEl = document.getElementById('cf-message');
  const statusEl  = document.getElementById('cf-status');
  const submitBtn = document.getElementById('cf-submit');
  const stampEl   = document.getElementById('stamp-overlay');

  let stampHideTimer = null;

  function showApprovedStamp() {
    if (!stampEl) return;
    clearTimeout(stampHideTimer);
    stampEl.classList.remove('hide');
    // force reflow so the animation restarts if triggered again
    void stampEl.offsetWidth;
    stampEl.classList.add('show');
    form.classList.remove('stamp-hit');
    void form.offsetWidth;
    form.classList.add('stamp-hit');
    stampHideTimer = setTimeout(() => {
      stampEl.classList.remove('show');
      stampEl.classList.add('hide');
    }, 2600);
  }

  function hideApprovedStamp() {
    if (!stampEl) return;
    clearTimeout(stampHideTimer);
    stampEl.classList.remove('show');
    stampEl.classList.add('hide');
  }

  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
  }

  function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.classList.remove('status-error', 'status-ok');
    if (type) statusEl.classList.add(type);
  }

  function markField(el, isValid) {
    el.classList.toggle('field-error', !isValid);
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (typeof emailjs === 'undefined') {
      setStatus('Email service failed to load, check your internet connection.', 'status-error');
      return;
    }
    if (EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
      setStatus('Contact form is not configured yet. See script.js EMAILJS_CONFIG.', 'status-error');
      console.warn('EmailJS: fill in EMAILJS_CONFIG in script.js with your Public Key, Service ID, and Template ID from https://www.emailjs.com');
      return;
    }

    const name    = nameEl.value.trim();
    const email   = emailEl.value.trim();
    const purpose = purposeEl.value.trim();
    const message = messageEl.value.trim();

    const nameOk    = name.length > 0;
    const emailOk   = isValidEmail(email);
    const messageOk = message.length > 0;

    markField(nameEl, nameOk);
    markField(emailEl, emailOk);
    markField(messageEl, messageOk);

    if (!nameOk || !emailOk || !messageOk) {
      setStatus('Please fill in your name, a valid email, and a message.', 'status-error');
      return;
    }

    submitBtn.disabled = true;
    setStatus('Sending…', 'status-ok');

    emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
      from_name:  name,
      from_email: email,
      purpose:    purpose || '(not specified)',
      message:    message
    }).then(() => {
      setStatus('Message sent! I\'ll get back to you within a day.', 'status-ok');
      form.reset();
      submitBtn.disabled = false;
      showApprovedStamp();
    }).catch(err => {
      console.error('EmailJS send error:', err);
      console.error('EmailJS error status:', err && err.status);
      console.error('EmailJS error text:', err && err.text);
      setStatus('Something went wrong sending your message. Please try again or email me directly.', 'status-error');
      submitBtn.disabled = false;
    });
  });

  // Clear the error state as soon as the visitor starts fixing a field
  [nameEl, emailEl, messageEl].forEach(el => {
    el.addEventListener('input', () => markField(el, true));
  });

  // Dismiss the approval stamp once they start composing a new message
  [nameEl, emailEl, purposeEl, messageEl].forEach(el => {
    el.addEventListener('input', hideApprovedStamp);
  });
})();

/* ══════════════════════════════════════════════════
   INTRO: Smooth flowing lines from all four edges.
   After fade-out the hero runs its own animation.
   No DOM swap, zero jerk.
   ══════════════════════════════════════════════════ */
(function () {
  const overlay         = document.getElementById('intro-overlay');
  const stageText       = document.getElementById('stage-text');
  const progBar         = document.getElementById('intro-progress');
  const introName       = document.getElementById('intro-name');
  const fpSvg           = document.getElementById('fp-svg');       // intro copy
  const heroFpSvg       = document.getElementById('hero-fp-svg'); // hero copy

  let cancelled = false;
  const timers = [];
  function T(fn, ms) { if (!cancelled) timers.push(setTimeout(fn, ms)); }
  function setLabel(txt) {
    stageText.style.opacity = '0';
    setTimeout(() => { stageText.textContent = txt; stageText.style.opacity = '1'; }, 150);
  }
  function setProgress(p) { progBar.style.width = p + '%'; }

  const VW = 800, VH = 580;
  const ALL_LAYERS = [
    '.fp-frame','.fp-annotations','.fp-outer-wall','.fp-columns',
    '.fp-walls-main','.fp-walls-secondary','.fp-doors','.fp-windows',
    '.fp-stairs','.fp-fixtures','.fp-dims','.fp-labels'
  ];
  const ELEMENTS = 'line,rect,polyline,polygon,path,circle,ellipse';

  function elCentre(el) {
    try { const b = el.getBBox(); return { x: b.x + b.width/2, y: b.y + b.height/2 }; }
    catch(_) { return { x: VW/2, y: VH/2 }; }
  }
  function edgeDist(x, y) {
    return Math.min(Math.min(x, VW-x)/(VW/2), Math.min(y, VH-y)/(VH/2));
  }
  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  /* ── Core animator: run flowing-lines draw on a given SVG ── */
  function animateFlowingSvg(svgEl, opts, onDone) {
    const {
      flowDuration  = 1800,
      strokeDur     = 600,
      onProgress    = null,
    } = opts || {};

    ALL_LAYERS.forEach(sel => {
      const g = svgEl.querySelector(sel);
      if (g) g.style.opacity = '1';
    });

    const allEls = Array.from(svgEl.querySelectorAll(
      ALL_LAYERS.map(s => s + ' > ' + ELEMENTS).join(',')
    ));
    if (!allEls.length) { setTimeout(onDone, 100); return; }

    allEls.forEach(el => {
      const c = elCentre(el);
      const dist = edgeDist(c.x, c.y);
      let pathLen = 1200;
      try { if (typeof el.getTotalLength === 'function') { const r = el.getTotalLength(); if (r > 0) pathLen = r; } } catch(_) {}

      const startDelay = easeInOut(dist) * flowDuration;
      const dur = strokeDur + dist * 200;

      el.style.strokeDasharray  = pathLen + 'px';
      el.style.strokeDashoffset = pathLen + 'px';

      setTimeout(() => {
        el.style.transition = `stroke-dashoffset ${(dur/1000).toFixed(3)}s cubic-bezier(0.4,0,0.2,1)`;
        el.style.strokeDashoffset = '0';
      }, startDelay);
    });

    if (onProgress) {
      for (let i = 1; i <= 40; i++) {
        setTimeout(() => onProgress(Math.round((i/40)*90)), i * (flowDuration/40));
      }
    }
    setTimeout(onDone, flowDuration + strokeDur + 100);
  }

  /* ── Reset an SVG's elements so they can re-animate ── */
  function resetSvgElements(svgEl) {
    svgEl.querySelectorAll(ELEMENTS).forEach(el => {
      el.style.transition       = 'none';
      el.style.strokeDasharray  = '';
      el.style.strokeDashoffset = '';
    });
    ALL_LAYERS.forEach(sel => {
      const g = svgEl.querySelector(sel);
      if (g) g.style.opacity = '0';
    });
  }

  /* ── Populate the hero SVG by deep-cloning the intro SVG's content ── */
  function populateHeroSvg() {
    if (!heroFpSvg || !fpSvg) return;
    // Copy all child nodes from intro SVG into hero SVG
    heroFpSvg.innerHTML = fpSvg.innerHTML;
    // Carry over defs (patterns etc)
    const introDefs = fpSvg.querySelector('defs');
    if (introDefs) {
      const heroDefs = heroFpSvg.querySelector('defs') || document.createElementNS('http://www.w3.org/2000/svg','defs');
      heroDefs.innerHTML = introDefs.innerHTML;
      if (!heroFpSvg.querySelector('defs')) heroFpSvg.prepend(heroDefs);
    }
    resetSvgElements(heroFpSvg);
  }

  /* ── Phase 1: intro animation ── */
  function startIntro() {
    animateFlowingSvg(fpSvg, {
      flowDuration: 1800,
      strokeDur: 600,
      onProgress: p => setProgress(p),
    }, onIntroDrawDone);
  }

  function onIntroDrawDone() {
    if (cancelled) return;
    setProgress(95);
    setLabel('Complete.');
    T(() => { introName && introName.classList.add('show'); }, 200);
    T(() => {
      setProgress(100);
      // Pre-populate hero SVG while overlay still covers it
      populateHeroSvg();
      // Fade out overlay
      overlay.classList.add('fade-out');
      document.body.style.overflowY = 'auto';
    }, 2200);
    T(() => {
      overlay.classList.add('done');
      // Small delay then run hero animation
      setTimeout(startHeroAnimation, 200);
    }, 2750);
  }

  /* ── Phase 2: hero animation (slides in from right, then draws) ── */
  function startHeroAnimation() {
    if (!heroFpSvg) return;

    // Slide in from the right
    heroFpSvg.style.transition = 'none';
    heroFpSvg.style.transform  = 'translateX(48px)';
    heroFpSvg.style.opacity    = '0';

    requestAnimationFrame(() => requestAnimationFrame(() => {
      heroFpSvg.style.transition = 'opacity 0.55s ease, transform 0.65s cubic-bezier(0.22,1,0.36,1)';
      heroFpSvg.style.opacity    = '1';
      heroFpSvg.style.transform  = 'translateX(0)';
    }));

    // Once it has slid in, run the flowing-lines draw
    setTimeout(() => {
      heroFpSvg.style.transition = '';
      heroFpSvg.style.transform  = '';
      animateFlowingSvg(heroFpSvg, { flowDuration: 1400, strokeDur: 500 }, () => {
        // Clean up dash props so the SVG renders cleanly at rest
        heroFpSvg.querySelectorAll(ELEMENTS).forEach(el => {
          el.style.strokeDasharray  = '';
          el.style.strokeDashoffset = '';
          el.style.transition       = '';
        });
      });
    }, 450);
  }

  /* ── Skip ── */
  window.skipIntro = function () {
    cancelled = true;
    timers.forEach(clearTimeout);
    ALL_LAYERS.forEach(sel => {
      const g = fpSvg && fpSvg.querySelector(sel);
      if (g) {
        g.style.opacity = '1';
        g.querySelectorAll(ELEMENTS).forEach(el => {
          el.style.strokeDasharray = '';
          el.style.strokeDashoffset = '';
          el.style.transition = '';
        });
      }
    });
    populateHeroSvg();
    if (overlay) overlay.classList.add('done');
    document.body.style.overflowY = 'auto';
    setTimeout(startHeroAnimation, 100);
  };

  /* ── Boot ── */
  document.body.style.overflowY = 'hidden';
  setLabel('Drawing floor plan…');
  stageText.style.transition = 'opacity 0.3s';
  T(startIntro, 300);

})();/* ── Hero massing model: live-rotatable isometric of the finished house ──
   Night mode shows the raw blueprint. Day mode swaps in this isometric
   massing, rendered by rotating real 3D geometry around the vertical axis
   and re-projecting it with the same isometric math used to draft the
   blueprint (see the build notes for the derivation) - so it stays the
   same flat ink-line aesthetic, but the user can drag to spin it and see
   every side, not just one fixed camera angle. */
(function () {
  const svg = document.getElementById('hero-mass-svg');
  const g = document.getElementById('mass-render');
  const hint = document.getElementById('mass-hint');
  const shadowEl = document.getElementById('mass-shadow');
  const prevBtn = document.getElementById('mass-prev');
  const nextBtn = document.getElementById('mass-next');
  const navCount = document.getElementById('mass-nav-count');
  const labelTop = document.getElementById('hero-bp-label-top-text');
  const root = document.documentElement;
  if (!svg || !g) return;

  const BUILDINGS = [{"name":"Setback Tower","geom":{"faces":[{"pts":[[0,300,0],[380,300,0],[380,300,150],[0,300,150]],"style":"glass","n":[0,1,0]},{"pts":[[380,300,0],[380,0,0],[380,0,150],[380,300,150]],"style":"glass","n":[1,0,0]},{"pts":[[380,0,0],[0,0,0],[0,0,150],[380,0,150]],"style":"glass","n":[0,-1,0]},{"pts":[[0,0,0],[0,300,0],[0,300,150],[0,0,150]],"style":"glass","n":[-1,0,0]},{"pts":[[158,300,0],[222,300,0],[222,300,140],[158,300,140]],"style":"door","n":[0,1,0]},{"pts":[[0,300,150],[380,300,150],[380,265,150],[0,265,150]],"style":"terrace","n":[0,0,1]},{"pts":[[340,300,150],[380,300,150],[380,0,150],[340,0,150]],"style":"terrace","n":[0,0,1]},{"pts":[[40,265,150],[340,265,150],[340,265,330],[40,265,330]],"style":"glass","n":[0,1,0]},{"pts":[[340,265,150],[340,35,150],[340,35,330],[340,265,330]],"style":"glass","n":[1,0,0]},{"pts":[[340,35,150],[40,35,150],[40,35,330],[340,35,330]],"style":"glass","n":[0,-1,0]},{"pts":[[40,35,150],[40,265,150],[40,265,330],[40,35,330]],"style":"glass","n":[-1,0,0]},{"pts":[[40,265,330],[340,265,330],[340,235,330],[40,235,330]],"style":"terrace","n":[0,0,1]},{"pts":[[300,265,330],[340,265,330],[340,35,330],[300,35,330]],"style":"terrace","n":[0,0,1]},{"pts":[[80,235,330],[300,235,330],[300,235,430],[80,235,430]],"style":"glass","n":[0,1,0]},{"pts":[[300,235,330],[300,65,330],[300,65,430],[300,235,430]],"style":"glass","n":[1,0,0]},{"pts":[[300,65,330],[80,65,330],[80,65,430],[300,65,430]],"style":"glass","n":[0,-1,0]},{"pts":[[80,65,330],[80,235,330],[80,235,430],[80,65,430]],"style":"glass","n":[-1,0,0]},{"pts":[[64,251,442],[316,251,442],[316,49,442],[64,49,442]],"style":"roof-top","n":[0,0,1]},{"pts":[[64,251,430],[316,251,430],[316,251,442],[64,251,442]],"style":"para","n":[0,1,0]},{"pts":[[316,251,430],[316,49,430],[316,49,442],[316,251,442]],"style":"para","n":[1,0,0]},{"pts":[[316,49,430],[64,49,430],[64,49,442],[316,49,442]],"style":"para","n":[0,-1,0]},{"pts":[[64,49,430],[64,251,430],[64,251,442],[64,49,442]],"style":"para","n":[-1,0,0]},{"pts":[[94,211,488],[158,211,488],[158,157,488],[94,157,488]],"style":"sky-top","n":[0,0,1]},{"pts":[[94,211,442],[158,211,442],[158,211,488],[94,211,488]],"style":"sky-side","n":[0,1,0]},{"pts":[[158,211,442],[158,157,442],[158,157,488],[158,211,488]],"style":"sky-side","n":[1,0,0]},{"pts":[[94,157,442],[94,211,442],[94,211,488],[94,157,488]],"style":"sky-side","n":[-1,0,0]},{"pts":[[158,157,442],[94,157,442],[94,157,488],[158,157,488]],"style":"sky-side","n":[0,-1,0]},{"pts":[[102,211,450],[150,211,450],[150,211,482],[102,211,482]],"style":"sky-glass","n":[0,1,0]}],"lines":[{"a":[38,300,0],"b":[38,300,150],"style":"mullion","n":[0,1,0]},{"a":[38,0,0],"b":[38,0,150],"style":"mullion","n":[0,-1,0]},{"a":[76,300,0],"b":[76,300,150],"style":"mullion","n":[0,1,0]},{"a":[76,0,0],"b":[76,0,150],"style":"mullion","n":[0,-1,0]},{"a":[114,300,0],"b":[114,300,150],"style":"mullion","n":[0,1,0]},{"a":[114,0,0],"b":[114,0,150],"style":"mullion","n":[0,-1,0]},{"a":[152,300,0],"b":[152,300,150],"style":"mullion","n":[0,1,0]},{"a":[152,0,0],"b":[152,0,150],"style":"mullion","n":[0,-1,0]},{"a":[190,300,0],"b":[190,300,150],"style":"mullion","n":[0,1,0]},{"a":[190,0,0],"b":[190,0,150],"style":"mullion","n":[0,-1,0]},{"a":[228,300,0],"b":[228,300,150],"style":"mullion","n":[0,1,0]},{"a":[228,0,0],"b":[228,0,150],"style":"mullion","n":[0,-1,0]},{"a":[266,300,0],"b":[266,300,150],"style":"mullion","n":[0,1,0]},{"a":[266,0,0],"b":[266,0,150],"style":"mullion","n":[0,-1,0]},{"a":[304,300,0],"b":[304,300,150],"style":"mullion","n":[0,1,0]},{"a":[304,0,0],"b":[304,0,150],"style":"mullion","n":[0,-1,0]},{"a":[342,300,0],"b":[342,300,150],"style":"mullion","n":[0,1,0]},{"a":[342,0,0],"b":[342,0,150],"style":"mullion","n":[0,-1,0]},{"a":[380,38,0],"b":[380,38,150],"style":"mullion","n":[1,0,0]},{"a":[0,38,0],"b":[0,38,150],"style":"mullion","n":[-1,0,0]},{"a":[380,76,0],"b":[380,76,150],"style":"mullion","n":[1,0,0]},{"a":[0,76,0],"b":[0,76,150],"style":"mullion","n":[-1,0,0]},{"a":[380,114,0],"b":[380,114,150],"style":"mullion","n":[1,0,0]},{"a":[0,114,0],"b":[0,114,150],"style":"mullion","n":[-1,0,0]},{"a":[380,152,0],"b":[380,152,150],"style":"mullion","n":[1,0,0]},{"a":[0,152,0],"b":[0,152,150],"style":"mullion","n":[-1,0,0]},{"a":[380,190,0],"b":[380,190,150],"style":"mullion","n":[1,0,0]},{"a":[0,190,0],"b":[0,190,150],"style":"mullion","n":[-1,0,0]},{"a":[380,228,0],"b":[380,228,150],"style":"mullion","n":[1,0,0]},{"a":[0,228,0],"b":[0,228,150],"style":"mullion","n":[-1,0,0]},{"a":[380,266,0],"b":[380,266,150],"style":"mullion","n":[1,0,0]},{"a":[0,266,0],"b":[0,266,150],"style":"mullion","n":[-1,0,0]},{"a":[0,300,150],"b":[380,300,150],"style":"slab","n":[0,1,0]},{"a":[380,300,150],"b":[380,0,150],"style":"slab","n":[1,0,0]},{"a":[380,0,150],"b":[0,0,150],"style":"slab","n":[0,-1,0]},{"a":[0,0,150],"b":[0,300,150],"style":"slab","n":[-1,0,0]},{"a":[70,265,150],"b":[70,265,330],"style":"mullion","n":[0,1,0]},{"a":[70,35,150],"b":[70,35,330],"style":"mullion","n":[0,-1,0]},{"a":[100,265,150],"b":[100,265,330],"style":"mullion","n":[0,1,0]},{"a":[100,35,150],"b":[100,35,330],"style":"mullion","n":[0,-1,0]},{"a":[130,265,150],"b":[130,265,330],"style":"mullion","n":[0,1,0]},{"a":[130,35,150],"b":[130,35,330],"style":"mullion","n":[0,-1,0]},{"a":[160,265,150],"b":[160,265,330],"style":"mullion","n":[0,1,0]},{"a":[160,35,150],"b":[160,35,330],"style":"mullion","n":[0,-1,0]},{"a":[190,265,150],"b":[190,265,330],"style":"mullion","n":[0,1,0]},{"a":[190,35,150],"b":[190,35,330],"style":"mullion","n":[0,-1,0]},{"a":[220,265,150],"b":[220,265,330],"style":"mullion","n":[0,1,0]},{"a":[220,35,150],"b":[220,35,330],"style":"mullion","n":[0,-1,0]},{"a":[250,265,150],"b":[250,265,330],"style":"mullion","n":[0,1,0]},{"a":[250,35,150],"b":[250,35,330],"style":"mullion","n":[0,-1,0]},{"a":[280,265,150],"b":[280,265,330],"style":"mullion","n":[0,1,0]},{"a":[280,35,150],"b":[280,35,330],"style":"mullion","n":[0,-1,0]},{"a":[310,265,150],"b":[310,265,330],"style":"mullion","n":[0,1,0]},{"a":[310,35,150],"b":[310,35,330],"style":"mullion","n":[0,-1,0]},{"a":[340,65,150],"b":[340,65,330],"style":"mullion","n":[1,0,0]},{"a":[40,65,150],"b":[40,65,330],"style":"mullion","n":[-1,0,0]},{"a":[340,95,150],"b":[340,95,330],"style":"mullion","n":[1,0,0]},{"a":[40,95,150],"b":[40,95,330],"style":"mullion","n":[-1,0,0]},{"a":[340,125,150],"b":[340,125,330],"style":"mullion","n":[1,0,0]},{"a":[40,125,150],"b":[40,125,330],"style":"mullion","n":[-1,0,0]},{"a":[340,155,150],"b":[340,155,330],"style":"mullion","n":[1,0,0]},{"a":[40,155,150],"b":[40,155,330],"style":"mullion","n":[-1,0,0]},{"a":[340,185,150],"b":[340,185,330],"style":"mullion","n":[1,0,0]},{"a":[40,185,150],"b":[40,185,330],"style":"mullion","n":[-1,0,0]},{"a":[340,215,150],"b":[340,215,330],"style":"mullion","n":[1,0,0]},{"a":[40,215,150],"b":[40,215,330],"style":"mullion","n":[-1,0,0]},{"a":[340,245,150],"b":[340,245,330],"style":"mullion","n":[1,0,0]},{"a":[40,245,150],"b":[40,245,330],"style":"mullion","n":[-1,0,0]},{"a":[40,265,210],"b":[340,265,210],"style":"mullion","n":[0,1,0]},{"a":[340,265,210],"b":[340,35,210],"style":"mullion","n":[1,0,0]},{"a":[340,35,210],"b":[40,35,210],"style":"mullion","n":[0,-1,0]},{"a":[40,35,210],"b":[40,265,210],"style":"mullion","n":[-1,0,0]},{"a":[40,265,270],"b":[340,265,270],"style":"mullion","n":[0,1,0]},{"a":[340,265,270],"b":[340,35,270],"style":"mullion","n":[1,0,0]},{"a":[340,35,270],"b":[40,35,270],"style":"mullion","n":[0,-1,0]},{"a":[40,35,270],"b":[40,265,270],"style":"mullion","n":[-1,0,0]},{"a":[40,265,330],"b":[340,265,330],"style":"slab","n":[0,1,0]},{"a":[340,265,330],"b":[340,35,330],"style":"slab","n":[1,0,0]},{"a":[340,35,330],"b":[40,35,330],"style":"slab","n":[0,-1,0]},{"a":[40,35,330],"b":[40,265,330],"style":"slab","n":[-1,0,0]},{"a":[107,235,330],"b":[107,235,430],"style":"mullion","n":[0,1,0]},{"a":[107,65,330],"b":[107,65,430],"style":"mullion","n":[0,-1,0]},{"a":[134,235,330],"b":[134,235,430],"style":"mullion","n":[0,1,0]},{"a":[134,65,330],"b":[134,65,430],"style":"mullion","n":[0,-1,0]},{"a":[161,235,330],"b":[161,235,430],"style":"mullion","n":[0,1,0]},{"a":[161,65,330],"b":[161,65,430],"style":"mullion","n":[0,-1,0]},{"a":[188,235,330],"b":[188,235,430],"style":"mullion","n":[0,1,0]},{"a":[188,65,330],"b":[188,65,430],"style":"mullion","n":[0,-1,0]},{"a":[215,235,330],"b":[215,235,430],"style":"mullion","n":[0,1,0]},{"a":[215,65,330],"b":[215,65,430],"style":"mullion","n":[0,-1,0]},{"a":[242,235,330],"b":[242,235,430],"style":"mullion","n":[0,1,0]},{"a":[242,65,330],"b":[242,65,430],"style":"mullion","n":[0,-1,0]},{"a":[269,235,330],"b":[269,235,430],"style":"mullion","n":[0,1,0]},{"a":[269,65,330],"b":[269,65,430],"style":"mullion","n":[0,-1,0]},{"a":[296,235,330],"b":[296,235,430],"style":"mullion","n":[0,1,0]},{"a":[296,65,330],"b":[296,65,430],"style":"mullion","n":[0,-1,0]},{"a":[300,92,330],"b":[300,92,430],"style":"mullion","n":[1,0,0]},{"a":[80,92,330],"b":[80,92,430],"style":"mullion","n":[-1,0,0]},{"a":[300,119,330],"b":[300,119,430],"style":"mullion","n":[1,0,0]},{"a":[80,119,330],"b":[80,119,430],"style":"mullion","n":[-1,0,0]},{"a":[300,146,330],"b":[300,146,430],"style":"mullion","n":[1,0,0]},{"a":[80,146,330],"b":[80,146,430],"style":"mullion","n":[-1,0,0]},{"a":[300,173,330],"b":[300,173,430],"style":"mullion","n":[1,0,0]},{"a":[80,173,330],"b":[80,173,430],"style":"mullion","n":[-1,0,0]},{"a":[300,200,330],"b":[300,200,430],"style":"mullion","n":[1,0,0]},{"a":[80,200,330],"b":[80,200,430],"style":"mullion","n":[-1,0,0]},{"a":[300,227,330],"b":[300,227,430],"style":"mullion","n":[1,0,0]},{"a":[80,227,330],"b":[80,227,430],"style":"mullion","n":[-1,0,0]},{"a":[80,235,380],"b":[300,235,380],"style":"mullion","n":[0,1,0]},{"a":[300,235,380],"b":[300,65,380],"style":"mullion","n":[1,0,0]},{"a":[300,65,380],"b":[80,65,380],"style":"mullion","n":[0,-1,0]},{"a":[80,65,380],"b":[80,235,380],"style":"mullion","n":[-1,0,0]}],"center":[190,150]},"view":{"vbw":461,"vbh":555,"offx":206.02070068467125,"offy":293.11295,"shadow":{"cx":230,"cy":520.2,"rx":163.2,"ry":21.2}}},{"name":"Twin Towers","geom":{"faces":[{"pts":[[45,200,0],[155,200,0],[155,200,420],[45,200,420]],"style":"glass","n":[0,1,0]},{"pts":[[155,200,0],[155,0,0],[155,0,420],[155,200,420]],"style":"glass","n":[1,0,0]},{"pts":[[155,0,0],[45,0,0],[45,0,420],[155,0,420]],"style":"glass","n":[0,-1,0]},{"pts":[[45,0,0],[45,200,0],[45,200,420],[45,0,420]],"style":"glass","n":[-1,0,0]},{"pts":[[245,200,0],[355,200,0],[355,200,420],[245,200,420]],"style":"glass","n":[0,1,0]},{"pts":[[355,200,0],[355,0,0],[355,0,420],[355,200,420]],"style":"glass","n":[1,0,0]},{"pts":[[355,0,0],[245,0,0],[245,0,420],[355,0,420]],"style":"glass","n":[0,-1,0]},{"pts":[[245,0,0],[245,200,0],[245,200,420],[245,0,420]],"style":"glass","n":[-1,0,0]},{"pts":[[75,200,0],[125,200,0],[125,200,90],[75,200,90]],"style":"door","n":[0,1,0]},{"pts":[[31,214,430],[169,214,430],[169,-14,430],[31,-14,430]],"style":"roof-top","n":[0,0,1]},{"pts":[[31,214,420],[169,214,420],[169,214,430],[31,214,430]],"style":"para","n":[0,1,0]},{"pts":[[169,214,420],[169,-14,420],[169,-14,430],[169,214,430]],"style":"para","n":[1,0,0]},{"pts":[[169,-14,420],[31,-14,420],[31,-14,430],[169,-14,430]],"style":"para","n":[0,-1,0]},{"pts":[[31,-14,420],[31,214,420],[31,214,430],[31,-14,430]],"style":"para","n":[-1,0,0]},{"pts":[[231,214,430],[369,214,430],[369,-14,430],[231,-14,430]],"style":"roof-top","n":[0,0,1]},{"pts":[[231,214,420],[369,214,420],[369,214,430],[231,214,430]],"style":"para","n":[0,1,0]},{"pts":[[369,214,420],[369,-14,420],[369,-14,430],[369,214,430]],"style":"para","n":[1,0,0]},{"pts":[[369,-14,420],[231,-14,420],[231,-14,430],[369,-14,430]],"style":"para","n":[0,-1,0]},{"pts":[[231,-14,420],[231,214,420],[231,214,430],[231,-14,430]],"style":"para","n":[-1,0,0]},{"pts":[[259,180,470],[313,180,470],[313,134,470],[259,134,470]],"style":"sky-top","n":[0,0,1]},{"pts":[[259,180,430],[313,180,430],[313,180,470],[259,180,470]],"style":"sky-side","n":[0,1,0]},{"pts":[[313,180,430],[313,134,430],[313,134,470],[313,180,470]],"style":"sky-side","n":[1,0,0]},{"pts":[[259,134,430],[259,180,430],[259,180,470],[259,134,470]],"style":"sky-side","n":[-1,0,0]},{"pts":[[313,134,430],[259,134,430],[259,134,470],[313,134,470]],"style":"sky-side","n":[0,-1,0]},{"pts":[[267,180,438],[305,180,438],[305,180,464],[267,180,464]],"style":"sky-glass","n":[0,1,0]},{"pts":[[155,140,280],[245,140,280],[245,140,340],[155,140,340]],"style":"glass","n":[0,1,0]},{"pts":[[245,60,280],[155,60,280],[155,60,340],[245,60,340]],"style":"glass","n":[0,-1,0]},{"pts":[[155,140,280],[155,60,280],[155,60,340],[155,140,340]],"style":"wall-left","n":[-1,0,0]},{"pts":[[245,60,280],[245,140,280],[245,140,340],[245,60,340]],"style":"wall-right","n":[1,0,0]},{"pts":[[155,140,340],[245,140,340],[245,60,340],[155,60,340]],"style":"roof-top","n":[0,0,1]}],"lines":[{"a":[72,200,0],"b":[72,200,420],"style":"mullion","n":[0,1,0]},{"a":[72,0,0],"b":[72,0,420],"style":"mullion","n":[0,-1,0]},{"a":[99,200,0],"b":[99,200,420],"style":"mullion","n":[0,1,0]},{"a":[99,0,0],"b":[99,0,420],"style":"mullion","n":[0,-1,0]},{"a":[126,200,0],"b":[126,200,420],"style":"mullion","n":[0,1,0]},{"a":[126,0,0],"b":[126,0,420],"style":"mullion","n":[0,-1,0]},{"a":[153,200,0],"b":[153,200,420],"style":"mullion","n":[0,1,0]},{"a":[153,0,0],"b":[153,0,420],"style":"mullion","n":[0,-1,0]},{"a":[155,27,0],"b":[155,27,420],"style":"mullion","n":[1,0,0]},{"a":[45,27,0],"b":[45,27,420],"style":"mullion","n":[-1,0,0]},{"a":[155,54,0],"b":[155,54,420],"style":"mullion","n":[1,0,0]},{"a":[45,54,0],"b":[45,54,420],"style":"mullion","n":[-1,0,0]},{"a":[155,81,0],"b":[155,81,420],"style":"mullion","n":[1,0,0]},{"a":[45,81,0],"b":[45,81,420],"style":"mullion","n":[-1,0,0]},{"a":[155,108,0],"b":[155,108,420],"style":"mullion","n":[1,0,0]},{"a":[45,108,0],"b":[45,108,420],"style":"mullion","n":[-1,0,0]},{"a":[155,135,0],"b":[155,135,420],"style":"mullion","n":[1,0,0]},{"a":[45,135,0],"b":[45,135,420],"style":"mullion","n":[-1,0,0]},{"a":[155,162,0],"b":[155,162,420],"style":"mullion","n":[1,0,0]},{"a":[45,162,0],"b":[45,162,420],"style":"mullion","n":[-1,0,0]},{"a":[155,189,0],"b":[155,189,420],"style":"mullion","n":[1,0,0]},{"a":[45,189,0],"b":[45,189,420],"style":"mullion","n":[-1,0,0]},{"a":[45,200,84],"b":[155,200,84],"style":"mullion","n":[0,1,0]},{"a":[155,200,84],"b":[155,0,84],"style":"mullion","n":[1,0,0]},{"a":[155,0,84],"b":[45,0,84],"style":"mullion","n":[0,-1,0]},{"a":[45,0,84],"b":[45,200,84],"style":"mullion","n":[-1,0,0]},{"a":[45,200,168],"b":[155,200,168],"style":"mullion","n":[0,1,0]},{"a":[155,200,168],"b":[155,0,168],"style":"mullion","n":[1,0,0]},{"a":[155,0,168],"b":[45,0,168],"style":"mullion","n":[0,-1,0]},{"a":[45,0,168],"b":[45,200,168],"style":"mullion","n":[-1,0,0]},{"a":[45,200,252],"b":[155,200,252],"style":"mullion","n":[0,1,0]},{"a":[155,200,252],"b":[155,0,252],"style":"mullion","n":[1,0,0]},{"a":[155,0,252],"b":[45,0,252],"style":"mullion","n":[0,-1,0]},{"a":[45,0,252],"b":[45,200,252],"style":"mullion","n":[-1,0,0]},{"a":[45,200,336],"b":[155,200,336],"style":"mullion","n":[0,1,0]},{"a":[155,200,336],"b":[155,0,336],"style":"mullion","n":[1,0,0]},{"a":[155,0,336],"b":[45,0,336],"style":"mullion","n":[0,-1,0]},{"a":[45,0,336],"b":[45,200,336],"style":"mullion","n":[-1,0,0]},{"a":[272,200,0],"b":[272,200,420],"style":"mullion","n":[0,1,0]},{"a":[272,0,0],"b":[272,0,420],"style":"mullion","n":[0,-1,0]},{"a":[299,200,0],"b":[299,200,420],"style":"mullion","n":[0,1,0]},{"a":[299,0,0],"b":[299,0,420],"style":"mullion","n":[0,-1,0]},{"a":[326,200,0],"b":[326,200,420],"style":"mullion","n":[0,1,0]},{"a":[326,0,0],"b":[326,0,420],"style":"mullion","n":[0,-1,0]},{"a":[353,200,0],"b":[353,200,420],"style":"mullion","n":[0,1,0]},{"a":[353,0,0],"b":[353,0,420],"style":"mullion","n":[0,-1,0]},{"a":[355,27,0],"b":[355,27,420],"style":"mullion","n":[1,0,0]},{"a":[245,27,0],"b":[245,27,420],"style":"mullion","n":[-1,0,0]},{"a":[355,54,0],"b":[355,54,420],"style":"mullion","n":[1,0,0]},{"a":[245,54,0],"b":[245,54,420],"style":"mullion","n":[-1,0,0]},{"a":[355,81,0],"b":[355,81,420],"style":"mullion","n":[1,0,0]},{"a":[245,81,0],"b":[245,81,420],"style":"mullion","n":[-1,0,0]},{"a":[355,108,0],"b":[355,108,420],"style":"mullion","n":[1,0,0]},{"a":[245,108,0],"b":[245,108,420],"style":"mullion","n":[-1,0,0]},{"a":[355,135,0],"b":[355,135,420],"style":"mullion","n":[1,0,0]},{"a":[245,135,0],"b":[245,135,420],"style":"mullion","n":[-1,0,0]},{"a":[355,162,0],"b":[355,162,420],"style":"mullion","n":[1,0,0]},{"a":[245,162,0],"b":[245,162,420],"style":"mullion","n":[-1,0,0]},{"a":[355,189,0],"b":[355,189,420],"style":"mullion","n":[1,0,0]},{"a":[245,189,0],"b":[245,189,420],"style":"mullion","n":[-1,0,0]},{"a":[245,200,84],"b":[355,200,84],"style":"mullion","n":[0,1,0]},{"a":[355,200,84],"b":[355,0,84],"style":"mullion","n":[1,0,0]},{"a":[355,0,84],"b":[245,0,84],"style":"mullion","n":[0,-1,0]},{"a":[245,0,84],"b":[245,200,84],"style":"mullion","n":[-1,0,0]},{"a":[245,200,168],"b":[355,200,168],"style":"mullion","n":[0,1,0]},{"a":[355,200,168],"b":[355,0,168],"style":"mullion","n":[1,0,0]},{"a":[355,0,168],"b":[245,0,168],"style":"mullion","n":[0,-1,0]},{"a":[245,0,168],"b":[245,200,168],"style":"mullion","n":[-1,0,0]},{"a":[245,200,252],"b":[355,200,252],"style":"mullion","n":[0,1,0]},{"a":[355,200,252],"b":[355,0,252],"style":"mullion","n":[1,0,0]},{"a":[355,0,252],"b":[245,0,252],"style":"mullion","n":[0,-1,0]},{"a":[245,0,252],"b":[245,200,252],"style":"mullion","n":[-1,0,0]},{"a":[245,200,336],"b":[355,200,336],"style":"mullion","n":[0,1,0]},{"a":[355,200,336],"b":[355,0,336],"style":"mullion","n":[1,0,0]},{"a":[355,0,336],"b":[245,0,336],"style":"mullion","n":[0,-1,0]},{"a":[245,0,336],"b":[245,200,336],"style":"mullion","n":[-1,0,0]},{"a":[177,140,280],"b":[177,140,340],"style":"mullion","n":[0,1,0]},{"a":[177,60,280],"b":[177,60,340],"style":"mullion","n":[0,-1,0]},{"a":[199,140,280],"b":[199,140,340],"style":"mullion","n":[0,1,0]},{"a":[199,60,280],"b":[199,60,340],"style":"mullion","n":[0,-1,0]},{"a":[221,140,280],"b":[221,140,340],"style":"mullion","n":[0,1,0]},{"a":[221,60,280],"b":[221,60,340],"style":"mullion","n":[0,-1,0]},{"a":[243,140,280],"b":[243,140,340],"style":"mullion","n":[0,1,0]},{"a":[243,60,280],"b":[243,60,340],"style":"mullion","n":[0,-1,0]},{"a":[155,140,280],"b":[245,140,280],"style":"slab","n":[0,1,0]},{"a":[245,140,280],"b":[245,60,280],"style":"slab","n":[1,0,0]},{"a":[245,60,280],"b":[155,60,280],"style":"slab","n":[0,-1,0]},{"a":[155,60,280],"b":[155,140,280],"style":"slab","n":[-1,0,0]}],"center":[200,100]},"view":{"vbw":392,"vbh":537,"offx":135.81262741764948,"offy":318.05735,"shadow":{"cx":195.8,"cy":503.3,"rx":135.9,"ry":17.7}}},{"name":"Cantilever Gallery","geom":{"faces":[{"pts":[[140,260,0],[260,260,0],[260,260,300],[140,260,300]],"style":"glass","n":[0,1,0]},{"pts":[[260,260,0],[260,0,0],[260,0,300],[260,260,300]],"style":"glass","n":[1,0,0]},{"pts":[[260,0,0],[140,0,0],[140,0,300],[260,0,300]],"style":"glass","n":[0,-1,0]},{"pts":[[140,0,0],[140,260,0],[140,260,300],[140,0,300]],"style":"glass","n":[-1,0,0]},{"pts":[[172,260,0],[228,260,0],[228,260,90],[172,260,90]],"style":"door","n":[0,1,0]},{"pts":[[20,260,380],[380,260,380],[380,0,380],[20,0,380]],"style":"roof-top","n":[0,0,1]},{"pts":[[20,260,300],[380,260,300],[380,260,380],[20,260,380]],"style":"glass","n":[0,1,0]},{"pts":[[380,0,300],[20,0,300],[20,0,380],[380,0,380]],"style":"glass","n":[0,-1,0]},{"pts":[[380,260,300],[380,0,300],[380,0,380],[380,260,380]],"style":"para","n":[1,0,0]},{"pts":[[20,0,300],[20,260,300],[20,260,380],[20,0,380]],"style":"para","n":[-1,0,0]},{"pts":[[6,274,390],[394,274,390],[394,-14,390],[6,-14,390]],"style":"roof-top","n":[0,0,1]},{"pts":[[6,274,380],[394,274,380],[394,274,390],[6,274,390]],"style":"para","n":[0,1,0]},{"pts":[[394,274,380],[394,-14,380],[394,-14,390],[394,274,390]],"style":"para","n":[1,0,0]},{"pts":[[394,-14,380],[6,-14,380],[6,-14,390],[394,-14,390]],"style":"para","n":[0,-1,0]},{"pts":[[6,-14,380],[6,274,380],[6,274,390],[6,-14,390]],"style":"para","n":[-1,0,0]},{"pts":[[140,244,430],[194,244,430],[194,200,430],[140,200,430]],"style":"sky-top","n":[0,0,1]},{"pts":[[140,244,390],[194,244,390],[194,244,430],[140,244,430]],"style":"sky-side","n":[0,1,0]},{"pts":[[194,244,390],[194,200,390],[194,200,430],[194,244,430]],"style":"sky-side","n":[1,0,0]},{"pts":[[140,200,390],[140,244,390],[140,244,430],[140,200,430]],"style":"sky-side","n":[-1,0,0]},{"pts":[[194,200,390],[140,200,390],[140,200,430],[194,200,430]],"style":"sky-side","n":[0,-1,0]},{"pts":[[148,244,398],[186,244,398],[186,244,424],[148,244,424]],"style":"sky-glass","n":[0,1,0]}],"lines":[{"a":[170,260,0],"b":[170,260,300],"style":"mullion","n":[0,1,0]},{"a":[170,0,0],"b":[170,0,300],"style":"mullion","n":[0,-1,0]},{"a":[200,260,0],"b":[200,260,300],"style":"mullion","n":[0,1,0]},{"a":[200,0,0],"b":[200,0,300],"style":"mullion","n":[0,-1,0]},{"a":[230,260,0],"b":[230,260,300],"style":"mullion","n":[0,1,0]},{"a":[230,0,0],"b":[230,0,300],"style":"mullion","n":[0,-1,0]},{"a":[260,30,0],"b":[260,30,300],"style":"mullion","n":[1,0,0]},{"a":[140,30,0],"b":[140,30,300],"style":"mullion","n":[-1,0,0]},{"a":[260,60,0],"b":[260,60,300],"style":"mullion","n":[1,0,0]},{"a":[140,60,0],"b":[140,60,300],"style":"mullion","n":[-1,0,0]},{"a":[260,90,0],"b":[260,90,300],"style":"mullion","n":[1,0,0]},{"a":[140,90,0],"b":[140,90,300],"style":"mullion","n":[-1,0,0]},{"a":[260,120,0],"b":[260,120,300],"style":"mullion","n":[1,0,0]},{"a":[140,120,0],"b":[140,120,300],"style":"mullion","n":[-1,0,0]},{"a":[260,150,0],"b":[260,150,300],"style":"mullion","n":[1,0,0]},{"a":[140,150,0],"b":[140,150,300],"style":"mullion","n":[-1,0,0]},{"a":[260,180,0],"b":[260,180,300],"style":"mullion","n":[1,0,0]},{"a":[140,180,0],"b":[140,180,300],"style":"mullion","n":[-1,0,0]},{"a":[260,210,0],"b":[260,210,300],"style":"mullion","n":[1,0,0]},{"a":[140,210,0],"b":[140,210,300],"style":"mullion","n":[-1,0,0]},{"a":[260,240,0],"b":[260,240,300],"style":"mullion","n":[1,0,0]},{"a":[140,240,0],"b":[140,240,300],"style":"mullion","n":[-1,0,0]},{"a":[140,260,100],"b":[260,260,100],"style":"mullion","n":[0,1,0]},{"a":[260,260,100],"b":[260,0,100],"style":"mullion","n":[1,0,0]},{"a":[260,0,100],"b":[140,0,100],"style":"mullion","n":[0,-1,0]},{"a":[140,0,100],"b":[140,260,100],"style":"mullion","n":[-1,0,0]},{"a":[140,260,200],"b":[260,260,200],"style":"mullion","n":[0,1,0]},{"a":[260,260,200],"b":[260,0,200],"style":"mullion","n":[1,0,0]},{"a":[260,0,200],"b":[140,0,200],"style":"mullion","n":[0,-1,0]},{"a":[140,0,200],"b":[140,260,200],"style":"mullion","n":[-1,0,0]},{"a":[140,260,300],"b":[260,260,300],"style":"slab","n":[0,1,0]},{"a":[260,260,300],"b":[260,0,300],"style":"slab","n":[1,0,0]},{"a":[260,0,300],"b":[140,0,300],"style":"slab","n":[0,-1,0]},{"a":[140,0,300],"b":[140,260,300],"style":"slab","n":[-1,0,0]},{"a":[50,260,300],"b":[50,260,380],"style":"mullion","n":[0,1,0]},{"a":[50,0,300],"b":[50,0,380],"style":"mullion","n":[0,-1,0]},{"a":[80,260,300],"b":[80,260,380],"style":"mullion","n":[0,1,0]},{"a":[80,0,300],"b":[80,0,380],"style":"mullion","n":[0,-1,0]},{"a":[110,260,300],"b":[110,260,380],"style":"mullion","n":[0,1,0]},{"a":[110,0,300],"b":[110,0,380],"style":"mullion","n":[0,-1,0]},{"a":[140,260,300],"b":[140,260,380],"style":"mullion","n":[0,1,0]},{"a":[140,0,300],"b":[140,0,380],"style":"mullion","n":[0,-1,0]},{"a":[170,260,300],"b":[170,260,380],"style":"mullion","n":[0,1,0]},{"a":[170,0,300],"b":[170,0,380],"style":"mullion","n":[0,-1,0]},{"a":[200,260,300],"b":[200,260,380],"style":"mullion","n":[0,1,0]},{"a":[200,0,300],"b":[200,0,380],"style":"mullion","n":[0,-1,0]},{"a":[230,260,300],"b":[230,260,380],"style":"mullion","n":[0,1,0]},{"a":[230,0,300],"b":[230,0,380],"style":"mullion","n":[0,-1,0]},{"a":[260,260,300],"b":[260,260,380],"style":"mullion","n":[0,1,0]},{"a":[260,0,300],"b":[260,0,380],"style":"mullion","n":[0,-1,0]},{"a":[290,260,300],"b":[290,260,380],"style":"mullion","n":[0,1,0]},{"a":[290,0,300],"b":[290,0,380],"style":"mullion","n":[0,-1,0]},{"a":[320,260,300],"b":[320,260,380],"style":"mullion","n":[0,1,0]},{"a":[320,0,300],"b":[320,0,380],"style":"mullion","n":[0,-1,0]},{"a":[350,260,300],"b":[350,260,380],"style":"mullion","n":[0,1,0]},{"a":[350,0,300],"b":[350,0,380],"style":"mullion","n":[0,-1,0]},{"a":[20,260,300],"b":[380,260,300],"style":"slab","n":[0,1,0]},{"a":[380,260,300],"b":[380,0,300],"style":"slab","n":[1,0,0]},{"a":[380,0,300],"b":[20,0,300],"style":"slab","n":[0,-1,0]},{"a":[20,0,300],"b":[20,260,300],"style":"slab","n":[-1,0,0]}],"center":[200,130]},"view":{"vbw":458,"vbh":506,"offx":186.81849261163967,"offy":299.0026,"shadow":{"cx":228.8,"cy":470.7,"rx":162.3,"ry":21.1}}}];

  const COS30 = Math.cos(Math.PI / 6);
  const SIN30 = Math.sin(Math.PI / 6);
  const S = 0.6929;

  const TEAL = '#12707f';
  const GOLD = '#a97a28';
  const CHAR = '#2e332e';

  // Light direction for dynamic shading as the model turns (fixed, doesn't rotate with the building)
  const LIGHT = normalize([0.55, 0.75, 1]);
  // View/depth axis for this isometric projection (derived from the projection formula itself)
  const VIEW = normalize([1, 1, 1]);

  function normalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  let idx = 0;
  let GEOM = BUILDINGS[idx].geom;
  let CX = GEOM.center[0], CZ = GEOM.center[1];
  let OFFX = BUILDINGS[idx].view.offx, OFFY = BUILDINGS[idx].view.offy;

  function rotY(p, theta) {
    const dx = p[0] - CX, dz = p[1] - CZ;
    const c = Math.cos(theta), s = Math.sin(theta);
    return [CX + dx * c - dz * s, CZ + dx * s + dz * c, p[2]];
  }
  function rotYVec(v, theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
  }
  function project(p) {
    const sx = (p[0] - p[1]) * COS30 * S + OFFX;
    const sy = (p[0] + p[1]) * SIN30 * S - p[2] * S + OFFY;
    return [sx, sy];
  }

  function styleFor(style, shade) {
    const t = Math.max(0, Math.min(1, shade));
    if (style === 'glass') return { fill: `rgba(18,112,127,${(0.10 + 0.10 * t).toFixed(3)})`, stroke: TEAL, sw: 1 };
    if (style === 'door') return { fill: `rgba(169,122,40,${(0.10 + 0.10 * t).toFixed(3)})`, stroke: TEAL, sw: 1.2 };
    if (style === 'roof-top' || style === 'para') return { fill: `rgba(169,122,40,${(0.06 + 0.16 * t).toFixed(3)})`, stroke: GOLD, sw: 1.3 };
    if (style === 'sky-glass') return { fill: `rgba(18,112,127,${(0.10 + 0.10 * t).toFixed(3)})`, stroke: TEAL, sw: 1 };
    if (style === 'terrace') return { fill: `rgba(169,122,40,${(0.05 + 0.12 * t).toFixed(3)})`, stroke: GOLD, sw: 1 };
    if (style.indexOf('sky') === 0) return { fill: `rgba(46,51,46,${(0.10 + 0.22 * t).toFixed(3)})`, stroke: CHAR, sw: 1.3 };
    // walls
    return { fill: `rgba(18,112,127,${(0.03 + 0.15 * t).toFixed(3)})`, stroke: TEAL, sw: 1.5 };
  }

  let theta = 0;      // initial azimuth; 0 matches each building's natural front/right orientation
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let rafId = null;

  // assemble=true plays a one-shot piece-by-piece "construction" animation,
  // staggering each face/line by its own height (bottom-up) using a stable
  // CSS animation-delay. assemble=false (drag/momentum) renders instantly.
  function render(assemble) {
    const items = [];

    GEOM.faces.forEach(f => {
      const rn = rotYVec(f.n, theta);
      const vis = dot(rn, VIEW);
      if (vis <= 0.001) return;
      const rpts = f.pts.map(p => rotY(p, theta));
      const spts = rpts.map(project);
      const depth = Math.max(...rpts.map(p => dot(p, VIEW)));
      // Structural layer: roofs/terraces physically sit above the walls below
      // them, and rooftop pavilions sit above everything - depth-sorting alone
      // can't reliably resolve that, so these are simply painted in later passes.
      const layer = (f.style === 'roof-top' || f.style === 'para' || f.style === 'terrace') ? 1 : (f.style.indexOf('sky') === 0 ? 2 : 0);
      const shade = Math.max(0, dot(rn, LIGHT));
      const st = styleFor(f.style, shade);
      const d = spts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const buildZ = (f.pts[0][2] + f.pts[1][2] + f.pts[2][2] + f.pts[3][2]) / 4;
      items.push({ layer, depth, buildZ, svg: `<polygon points="${d}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.sw}"` });
    });

    GEOM.lines.forEach(l => {
      const rn = rotYVec(l.n, theta);
      const vis = dot(rn, VIEW);
      if (vis <= 0.001) return;
      const ra = rotY(l.a, theta), rb = rotY(l.b, theta);
      const pa = project(ra), pb = project(rb);
      const depth = Math.max(dot(ra, VIEW), dot(rb, VIEW)) + 0.5; // draw just above its parent face
      const isPost = l.style === 'post';
      const isFloorline = l.style === 'floorline';
      const isSeam = l.style === 'seam';
      const isSlab = l.style === 'slab';
      const stroke = isFloorline ? 'rgba(18,112,127,0.35)' : (isSeam ? 'rgba(169,122,40,0.4)' : (isSlab ? 'rgba(169,122,40,0.55)' : TEAL));
      const sw = isPost ? 3 : (isFloorline ? 0.8 : (isSeam ? 0.6 : (isSlab ? 1.1 : 0.8)));
      const cap = isPost ? ' stroke-linecap="round"' : '';
      const dash = isFloorline ? ' stroke-dasharray="2 3"' : '';
      const lineLayer = isSeam ? 1 : 0; // seams sit just above the roof plane, must paint after it
      const buildZ = (l.a[2] + l.b[2]) / 2;
      items.push({ layer: lineLayer, depth, buildZ, svg: `<line x1="${pa[0].toFixed(1)}" y1="${pa[1].toFixed(1)}" x2="${pb[0].toFixed(1)}" y2="${pb[1].toFixed(1)}" stroke="${stroke}" stroke-width="${sw}"${cap}${dash}` });
    });

    if (assemble) {
      const totalDuration = 1.15; // seconds for the whole model to finish assembling
      const order = items.map((_, i) => i).sort((a, b) => items[a].buildZ - items[b].buildZ);
      const stagger = items.length ? totalDuration / items.length : 0;
      order.forEach((itemIdx, rank) => { items[itemIdx].delay = rank * stagger; });
    }

    items.sort((a, b) => (a.layer - b.layer) || (a.depth - b.depth));
    g.innerHTML = items.map(it => assemble
      ? `${it.svg} class="piece" style="animation-delay:${it.delay.toFixed(3)}s"/>`
      : `${it.svg}/>`
    ).join('');
  }

  function normalizeTheta() {
    const TWO_PI = Math.PI * 2;
    theta = ((theta % TWO_PI) + TWO_PI) % TWO_PI;
  }

  function tick() {
    if (!dragging) {
      theta += velocity;
      velocity *= 0.94;
      if (Math.abs(velocity) < 0.0003) { velocity = 0; rafId = null; render(false); return; }
    }
    render(false);
    rafId = requestAnimationFrame(tick);
  }
  function ensureLoop() {
    if (rafId == null) rafId = requestAnimationFrame(tick);
  }
  function stopLoop() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    dragging = false;
    velocity = 0;
  }

  function onPointerDown(e) {
    dragging = true;
    velocity = 0;
    lastX = (e.touches ? e.touches[0].clientX : e.clientX);
    svg.classList.add('grabbing');
    if (hint) hint.classList.add('hint-hide');
    ensureLoop();
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    if (e.touches) e.preventDefault();
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const dx = x - lastX;
    lastX = x;
    const delta = dx * 0.012;
    theta += delta;
    velocity = delta;
    render(false);
  }
  function onPointerUp() {
    dragging = false;
    svg.classList.remove('grabbing');
    normalizeTheta();
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
    ensureLoop();
  }

  svg.addEventListener('mousedown', onPointerDown);
  svg.addEventListener('touchstart', onPointerDown, { passive: true });

  function updateLabel() {
    if (!labelTop) return;
    const n = String(idx + 1).padStart(2, '0');
    labelTop.textContent = `AS-BUILT-A-ISO${n} · ${BUILDINGS[idx].name} · As Constructed`;
  }

  // Applies the current building's geometry, camera framing (viewBox +
  // shadow, auto-fit per design so a short pavilion and a tall tower each
  // frame cleanly), and nav/label chrome.
  function applyBuildingView() {
    const b = BUILDINGS[idx];
    GEOM = b.geom;
    CX = GEOM.center[0]; CZ = GEOM.center[1];
    OFFX = b.view.offx; OFFY = b.view.offy;
    svg.setAttribute('viewBox', `0 0 ${b.view.vbw} ${b.view.vbh}`);
    if (shadowEl) {
      shadowEl.setAttribute('cx', b.view.shadow.cx);
      shadowEl.setAttribute('cy', b.view.shadow.cy);
      shadowEl.setAttribute('rx', b.view.shadow.rx);
      shadowEl.setAttribute('ry', b.view.shadow.ry);
    }
    if (navCount) navCount.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(BUILDINGS.length).padStart(2, '0')}`;
    if (root.classList.contains('day-mode')) updateLabel();
  }

  function switchBuilding(delta) {
    stopLoop();
    idx = ((idx + delta) % BUILDINGS.length + BUILDINGS.length) % BUILDINGS.length;
    applyBuildingView();
    theta = 0;
    render(true);
  }

  if (prevBtn) prevBtn.addEventListener('click', () => switchBuilding(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => switchBuilding(1));

  applyBuildingView();
  render(false);

  // Re-render (with the assembly animation) whenever day mode is switched
  // on, so the model "builds itself" each time it's revealed.
  let wasBuilt = false;
  const mo = new MutationObserver(() => {
    const isBuilt = root.classList.contains('day-mode');
    if (isBuilt && !wasBuilt) {
      stopLoop();
      updateLabel();
      render(true);
    }
    wasBuilt = isBuilt;
  });
  mo.observe(root, { attributes: true, attributeFilter: ['class'] });
})();