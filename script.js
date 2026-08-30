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

})();