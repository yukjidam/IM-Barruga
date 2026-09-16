/* ── SITE CONFIG ──────────────────────────────────
   Change GITHUB_USERNAME here whenever the GitHub
   handle changes — every link/label that references
   it (currently just the footer credits) updates
   automatically. */
const SITE_CONFIG = {
  GITHUB_USERNAME: 'yukjidam'
};

(function () {
  const link = document.getElementById('footer-github-link');
  if (!link) return;
  const user = SITE_CONFIG.GITHUB_USERNAME;
  link.href = `https://github.com/${user}`;
  link.textContent = `github.com/${user}`;
})();

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

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function applyTheme() {
    const isBuilt = root.classList.toggle('day-mode');
    try { localStorage.setItem('theme', isBuilt ? 'day' : 'night'); } catch (e) {}
    setState();
  }

  btn.addEventListener('click', function () {
    // No View Transitions support (or motion is reduced) → just flip the mode.
    if (!document.startViewTransition || reduceMotion) {
      applyTheme();
      return;
    }

    // The plotter head rakes across in the direction the project is
    // moving: left→right into As-Built, right→left back to Blueprint.
    // Everything else about the pass is CSS.
    const goingToBuilt = !root.classList.contains('day-mode');
    root.setAttribute('data-ce-dir', goingToBuilt ? 'ltr' : 'rtl');

    document.startViewTransition(applyTheme);
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
   EMAIL OBFUSCATION - keeps the plain address out of
   the raw HTML/JS source so basic scrapers can't
   regex-match it. The address only ever exists as a
   real mailto: link after this script runs.
   ══════════════════════════════════════════════════ */
(function () {
  const link = document.getElementById('contact-email-link');
  if (!link) return;

  const encoded = link.getAttribute('data-email');
  if (!encoded) return;

  let address;
  try {
    address = atob(encoded);
  } catch (e) {
    return;
  }

  link.textContent = address;
  link.setAttribute('href', 'mailto:' + address);
  link.removeAttribute('data-email');
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
  const websiteEl = document.getElementById('cf-website'); // honeypot
  const statusEl  = document.getElementById('cf-status');
  const submitBtn = document.getElementById('cf-submit');
  const stampEl   = document.getElementById('stamp-overlay');

  // Anti-spam: form must have been on the page a few seconds before a
  // real human could plausibly fill and submit it. Bots that submit
  // instantly on page load get silently blocked.
  const formLoadedAt = Date.now();
  const MIN_FILL_TIME_MS = 3000;

  // Anti-spam: cap real submissions to 3 per rolling 24 hours per
  // browser. Stored in localStorage (not a JS variable or
  // sessionStorage) so it survives page refreshes and new tabs —
  // only clearing site data or switching browsers resets it.
  const DAILY_LIMIT = 3;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const SUBMIT_LOG_KEY = 'cf_submit_log';

  function getSubmitLog() {
    try {
      const raw = JSON.parse(localStorage.getItem(SUBMIT_LOG_KEY) || '[]');
      const cutoff = Date.now() - DAY_MS;
      return Array.isArray(raw) ? raw.filter(ts => typeof ts === 'number' && ts > cutoff) : [];
    } catch (e) {
      return [];
    }
  }

  function getRemainingSends() {
    return Math.max(0, DAILY_LIMIT - getSubmitLog().length);
  }

  function msUntilNextSlotFrees() {
    const log = getSubmitLog().sort((a, b) => a - b);
    if (log.length === 0) return 0;
    return Math.max(0, (log[0] + DAY_MS) - Date.now());
  }

  function markSubmitted() {
    try {
      const log = getSubmitLog();
      log.push(Date.now());
      localStorage.setItem(SUBMIT_LOG_KEY, JSON.stringify(log));
    } catch (e) { /* ignore */ }
  }

  function formatWait(ms) {
    const hrs = Math.ceil(ms / (60 * 60 * 1000));
    if (hrs <= 1) return 'about an hour';
    if (hrs < 24) return `about ${hrs} hours`;
    return 'about a day';
  }

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

  // If the limit's already used up on page load, disable the form
  // up front instead of letting someone fill it out only to be
  // blocked at submit time.
  function applyDailyLimitState() {
    if (getRemainingSends() > 0) return;
    submitBtn.disabled = true;
    setStatus(`You've reached the limit of ${DAILY_LIMIT} messages per day. Please try again in ${formatWait(msUntilNextSlotFrees())}, or email me directly.`, 'status-error');
  }
  applyDailyLimitState();

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Honeypot tripped -> silently bail like a normal send, no error
    // shown, so bots don't learn they were caught.
    if (websiteEl && websiteEl.value.trim() !== '') {
      form.reset();
      setStatus('Message sent! I\'ll get back to you within a day.', 'status-ok');
      showApprovedStamp();
      return;
    }

    // Submitted too fast to be a human filling out the form
    if (Date.now() - formLoadedAt < MIN_FILL_TIME_MS) {
      setStatus('Please try again.', 'status-error');
      return;
    }

    if (getRemainingSends() <= 0) {
      setStatus(`You've reached the limit of ${DAILY_LIMIT} messages per day. Please try again in ${formatWait(msUntilNextSlotFrees())}, or email me directly.`, 'status-error');
      return;
    }

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
      markSubmitted();
      submitBtn.disabled = getRemainingSends() <= 0; // lock the form if that was the 3rd send
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

  const BUILDINGS = [{"name":"Terrace Tower","geom":{"faces":[{"pts":[[0,288.8,0],[361,288.8,0],[361,288.8,108.3],[0,288.8,108.3]],"style":"glass","n":[0,1,0]},{"pts":[[361,288.8,0],[361,0,0],[361,0,108.3],[361,288.8,108.3]],"style":"glass","n":[1,0,0]},{"pts":[[361,0,0],[0,0,0],[0,0,108.3],[361,0,108.3]],"style":"glass","n":[0,-1,0]},{"pts":[[0,0,0],[0,288.8,0],[0,288.8,108.3],[0,0,108.3]],"style":"glass","n":[-1,0,0]},{"pts":[[155.2,288.8,0],[223.8,288.8,0],[223.8,288.8,86.6],[155.2,288.8,86.6]],"style":"door","n":[0,1,0]},{"pts":[[-10.8,299.6,108.3],[371.8,299.6,108.3],[371.8,299.6,119.1],[-10.8,299.6,119.1]],"style":"para","n":[0,1,0]},{"pts":[[371.8,299.6,108.3],[371.8,-10.8,108.3],[371.8,-10.8,119.1],[371.8,299.6,119.1]],"style":"para","n":[1,0,0]},{"pts":[[371.8,-10.8,108.3],[-10.8,-10.8,108.3],[-10.8,-10.8,119.1],[371.8,-10.8,119.1]],"style":"para","n":[0,-1,0]},{"pts":[[-10.8,-10.8,108.3],[-10.8,299.6,108.3],[-10.8,299.6,119.1],[-10.8,-10.8,119.1]],"style":"para","n":[-1,0,0]},{"pts":[[-10.8,299.6,119.1],[371.8,299.6,119.1],[371.8,258.1,119.1],[-10.8,258.1,119.1]],"style":"terrace","n":[0,0,1]},{"pts":[[-10.8,30.7,119.1],[371.8,30.7,119.1],[371.8,-10.8,119.1],[-10.8,-10.8,119.1]],"style":"terrace","n":[0,0,1]},{"pts":[[-10.8,258.1,119.1],[30.7,258.1,119.1],[30.7,30.7,119.1],[-10.8,30.7,119.1]],"style":"terrace","n":[0,0,1]},{"pts":[[330.3,258.1,119.1],[371.8,258.1,119.1],[371.8,30.7,119.1],[330.3,30.7,119.1]],"style":"terrace","n":[0,0,1]},{"pts":[[30.7,258.1,119.1],[330.3,258.1,119.1],[330.3,258.1,310.4],[30.7,258.1,310.4]],"style":"glass","n":[0,1,0]},{"pts":[[330.3,258.1,119.1],[330.3,30.7,119.1],[330.3,30.7,310.4],[330.3,258.1,310.4]],"style":"glass","n":[1,0,0]},{"pts":[[330.3,30.7,119.1],[30.7,30.7,119.1],[30.7,30.7,310.4],[330.3,30.7,310.4]],"style":"glass","n":[0,-1,0]},{"pts":[[30.7,30.7,119.1],[30.7,258.1,119.1],[30.7,258.1,310.4],[30.7,30.7,310.4]],"style":"glass","n":[-1,0,0]},{"pts":[[330.3,79.4,119.1],[330.3,209.4,119.1],[330.3,209.4,310.4],[330.3,79.4,310.4]],"style":"core","n":[1,0,0]},{"pts":[[30.7,258.1,310.4],[330.3,258.1,310.4],[330.3,223.8,310.4],[30.7,223.8,310.4]],"style":"green","n":[0,0,1]},{"pts":[[30.7,65,310.4],[330.3,65,310.4],[330.3,30.7,310.4],[30.7,30.7,310.4]],"style":"green","n":[0,0,1]},{"pts":[[30.7,223.8,310.4],[65,223.8,310.4],[65,65,310.4],[30.7,65,310.4]],"style":"green","n":[0,0,1]},{"pts":[[296,223.8,310.4],[330.3,223.8,310.4],[330.3,65,310.4],[296,65,310.4]],"style":"green","n":[0,0,1]},{"pts":[[65,223.8,310.4],[296,223.8,310.4],[296,223.8,427.8],[65,223.8,427.8]],"style":"glass","n":[0,1,0]},{"pts":[[296,223.8,310.4],[296,65,310.4],[296,65,427.8],[296,223.8,427.8]],"style":"glass","n":[1,0,0]},{"pts":[[296,65,310.4],[65,65,310.4],[65,65,427.8],[296,65,427.8]],"style":"glass","n":[0,-1,0]},{"pts":[[65,65,310.4],[65,223.8,310.4],[65,223.8,427.8],[65,65,427.8]],"style":"glass","n":[-1,0,0]},{"pts":[[65,223.8,344.7],[296,223.8,344.7],[296,223.8,398.9],[65,223.8,398.9]],"style":"louver","n":[0,1,0]},{"pts":[[57.8,231,427.8],[303.2,231,427.8],[303.2,231,440.4],[57.8,231,440.4]],"style":"para","n":[0,1,0]},{"pts":[[303.2,231,427.8],[303.2,57.8,427.8],[303.2,57.8,440.4],[303.2,231,440.4]],"style":"para","n":[1,0,0]},{"pts":[[303.2,57.8,427.8],[57.8,57.8,427.8],[57.8,57.8,440.4],[303.2,57.8,440.4]],"style":"para","n":[0,-1,0]},{"pts":[[57.8,57.8,427.8],[57.8,231,427.8],[57.8,231,440.4],[57.8,57.8,440.4]],"style":"para","n":[-1,0,0]},{"pts":[[57.8,231,440.4],[303.2,231,440.4],[303.2,57.8,440.4],[57.8,57.8,440.4]],"style":"roof-top","n":[0,0,1]},{"pts":[[133.6,176.9,440.4],[222,176.9,440.4],[222,176.9,480.1],[133.6,176.9,480.1]],"style":"sky-side","n":[0,1,0]},{"pts":[[222,176.9,440.4],[222,106.5,440.4],[222,106.5,480.1],[222,176.9,480.1]],"style":"sky-side","n":[1,0,0]},{"pts":[[222,106.5,440.4],[133.6,106.5,440.4],[133.6,106.5,480.1],[222,106.5,480.1]],"style":"sky-side","n":[0,-1,0]},{"pts":[[133.6,106.5,440.4],[133.6,176.9,440.4],[133.6,176.9,480.1],[133.6,106.5,480.1]],"style":"sky-side","n":[-1,0,0]},{"pts":[[133.6,176.9,480.1],[222,176.9,480.1],[222,106.5,480.1],[133.6,106.5,480.1]],"style":"sky-top","n":[0,0,1]},{"pts":[[140.8,176.9,447.6],[214.8,176.9,447.6],[214.8,176.9,474.7],[140.8,176.9,474.7]],"style":"sky-glass","n":[0,1,0]}],"lines":[{"a":[36.1,288.8,0],"b":[36.1,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[36.1,0,0],"b":[36.1,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[72.2,288.8,0],"b":[72.2,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[72.2,0,0],"b":[72.2,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[108.3,288.8,0],"b":[108.3,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[108.3,0,0],"b":[108.3,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[144.4,288.8,0],"b":[144.4,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[144.4,0,0],"b":[144.4,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[180.5,288.8,0],"b":[180.5,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[180.5,0,0],"b":[180.5,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[216.6,288.8,0],"b":[216.6,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[216.6,0,0],"b":[216.6,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[252.7,288.8,0],"b":[252.7,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[252.7,0,0],"b":[252.7,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[288.8,288.8,0],"b":[288.8,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[288.8,0,0],"b":[288.8,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[324.9,288.8,0],"b":[324.9,288.8,108.3],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[324.9,0,0],"b":[324.9,0,108.3],"style":"mullion","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[361,36.1,0],"b":[361,36.1,108.3],"style":"mullion","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[0,36.1,0],"b":[0,36.1,108.3],"style":"mullion","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[361,72.2,0],"b":[361,72.2,108.3],"style":"mullion","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[0,72.2,0],"b":[0,72.2,108.3],"style":"mullion","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[361,108.3,0],"b":[361,108.3,108.3],"style":"mullion","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[0,108.3,0],"b":[0,108.3,108.3],"style":"mullion","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[361,144.4,0],"b":[361,144.4,108.3],"style":"mullion","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[0,144.4,0],"b":[0,144.4,108.3],"style":"mullion","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[361,180.5,0],"b":[361,180.5,108.3],"style":"mullion","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[0,180.5,0],"b":[0,180.5,108.3],"style":"mullion","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[361,216.6,0],"b":[361,216.6,108.3],"style":"mullion","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[0,216.6,0],"b":[0,216.6,108.3],"style":"mullion","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[361,252.7,0],"b":[361,252.7,108.3],"style":"mullion","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[0,252.7,0],"b":[0,252.7,108.3],"style":"mullion","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[0,288.8,56],"b":[361,288.8,56],"style":"floorline","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[361,288.8,56],"b":[361,0,56],"style":"floorline","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[361,0,56],"b":[0,0,56],"style":"floorline","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[0,0,56],"b":[0,288.8,56],"style":"floorline","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[189.5,288.8,0],"b":[189.5,288.8,86.6],"style":"mullion","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[0,288.8,108.3],"b":[361,288.8,108.3],"style":"slab","n":[0,1,0],"ref":[180.5,288.8,54.1]},{"a":[361,288.8,108.3],"b":[361,0,108.3],"style":"slab","n":[1,0,0],"ref":[361,144.4,54.1]},{"a":[361,0,108.3],"b":[0,0,108.3],"style":"slab","n":[0,-1,0],"ref":[180.5,0,54.1]},{"a":[0,0,108.3],"b":[0,288.8,108.3],"style":"slab","n":[-1,0,0],"ref":[0,144.4,54.1]},{"a":[68.1,258.1,119.1],"b":[68.1,258.1,310.4],"style":"mullion","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[68.1,30.7,119.1],"b":[68.1,30.7,310.4],"style":"mullion","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[105.6,258.1,119.1],"b":[105.6,258.1,310.4],"style":"mullion","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[105.6,30.7,119.1],"b":[105.6,30.7,310.4],"style":"mullion","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[143,258.1,119.1],"b":[143,258.1,310.4],"style":"mullion","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[143,30.7,119.1],"b":[143,30.7,310.4],"style":"mullion","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[180.5,258.1,119.1],"b":[180.5,258.1,310.4],"style":"mullion","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[180.5,30.7,119.1],"b":[180.5,30.7,310.4],"style":"mullion","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[217.9,258.1,119.1],"b":[217.9,258.1,310.4],"style":"mullion","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[217.9,30.7,119.1],"b":[217.9,30.7,310.4],"style":"mullion","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[255.4,258.1,119.1],"b":[255.4,258.1,310.4],"style":"mullion","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[255.4,30.7,119.1],"b":[255.4,30.7,310.4],"style":"mullion","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[292.8,258.1,119.1],"b":[292.8,258.1,310.4],"style":"mullion","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[292.8,30.7,119.1],"b":[292.8,30.7,310.4],"style":"mullion","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[330.3,68.6,119.1],"b":[330.3,68.6,310.4],"style":"mullion","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[30.7,68.6,119.1],"b":[30.7,68.6,310.4],"style":"mullion","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[330.3,106.5,119.1],"b":[330.3,106.5,310.4],"style":"mullion","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[30.7,106.5,119.1],"b":[30.7,106.5,310.4],"style":"mullion","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[330.3,144.4,119.1],"b":[330.3,144.4,310.4],"style":"mullion","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[30.7,144.4,119.1],"b":[30.7,144.4,310.4],"style":"mullion","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[330.3,182.3,119.1],"b":[330.3,182.3,310.4],"style":"mullion","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[30.7,182.3,119.1],"b":[30.7,182.3,310.4],"style":"mullion","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[330.3,220.2,119.1],"b":[330.3,220.2,310.4],"style":"mullion","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[30.7,220.2,119.1],"b":[30.7,220.2,310.4],"style":"mullion","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[30.7,258.1,167],"b":[330.3,258.1,167],"style":"floorline","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[330.3,258.1,167],"b":[330.3,30.7,167],"style":"floorline","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[330.3,30.7,167],"b":[30.7,30.7,167],"style":"floorline","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[30.7,30.7,167],"b":[30.7,258.1,167],"style":"floorline","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[30.7,258.1,214.8],"b":[330.3,258.1,214.8],"style":"floorline","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[330.3,258.1,214.8],"b":[330.3,30.7,214.8],"style":"floorline","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[330.3,30.7,214.8],"b":[30.7,30.7,214.8],"style":"floorline","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[30.7,30.7,214.8],"b":[30.7,258.1,214.8],"style":"floorline","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[30.7,258.1,262.6],"b":[330.3,258.1,262.6],"style":"floorline","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[330.3,258.1,262.6],"b":[330.3,30.7,262.6],"style":"floorline","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[330.3,30.7,262.6],"b":[30.7,30.7,262.6],"style":"floorline","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[30.7,30.7,262.6],"b":[30.7,258.1,262.6],"style":"floorline","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[30.7,258.1,310.4],"b":[330.3,258.1,310.4],"style":"slab","n":[0,1,0],"ref":[180.5,258.1,214.8]},{"a":[330.3,258.1,310.4],"b":[330.3,30.7,310.4],"style":"slab","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[330.3,30.7,310.4],"b":[30.7,30.7,310.4],"style":"slab","n":[0,-1,0],"ref":[180.5,30.7,214.8]},{"a":[30.7,30.7,310.4],"b":[30.7,258.1,310.4],"style":"slab","n":[-1,0,0],"ref":[30.7,144.4,214.8]},{"a":[330.3,111.9,119.1],"b":[330.3,111.9,310.4],"style":"mullion","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[330.3,144.4,119.1],"b":[330.3,144.4,310.4],"style":"mullion","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[330.3,176.9,119.1],"b":[330.3,176.9,310.4],"style":"mullion","n":[1,0,0],"ref":[330.3,144.4,214.8]},{"a":[103.5,223.8,310.4],"b":[103.5,223.8,427.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,369.1]},{"a":[103.5,65,310.4],"b":[103.5,65,427.8],"style":"mullion","n":[0,-1,0],"ref":[180.5,65,369.1]},{"a":[142,223.8,310.4],"b":[142,223.8,427.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,369.1]},{"a":[142,65,310.4],"b":[142,65,427.8],"style":"mullion","n":[0,-1,0],"ref":[180.5,65,369.1]},{"a":[180.5,223.8,310.4],"b":[180.5,223.8,427.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,369.1]},{"a":[180.5,65,310.4],"b":[180.5,65,427.8],"style":"mullion","n":[0,-1,0],"ref":[180.5,65,369.1]},{"a":[219,223.8,310.4],"b":[219,223.8,427.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,369.1]},{"a":[219,65,310.4],"b":[219,65,427.8],"style":"mullion","n":[0,-1,0],"ref":[180.5,65,369.1]},{"a":[257.5,223.8,310.4],"b":[257.5,223.8,427.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,369.1]},{"a":[257.5,65,310.4],"b":[257.5,65,427.8],"style":"mullion","n":[0,-1,0],"ref":[180.5,65,369.1]},{"a":[296,104.7,310.4],"b":[296,104.7,427.8],"style":"mullion","n":[1,0,0],"ref":[296,144.4,369.1]},{"a":[65,104.7,310.4],"b":[65,104.7,427.8],"style":"mullion","n":[-1,0,0],"ref":[65,144.4,369.1]},{"a":[296,144.4,310.4],"b":[296,144.4,427.8],"style":"mullion","n":[1,0,0],"ref":[296,144.4,369.1]},{"a":[65,144.4,310.4],"b":[65,144.4,427.8],"style":"mullion","n":[-1,0,0],"ref":[65,144.4,369.1]},{"a":[296,184.1,310.4],"b":[296,184.1,427.8],"style":"mullion","n":[1,0,0],"ref":[296,144.4,369.1]},{"a":[65,184.1,310.4],"b":[65,184.1,427.8],"style":"mullion","n":[-1,0,0],"ref":[65,144.4,369.1]},{"a":[65,223.8,349.6],"b":[296,223.8,349.6],"style":"floorline","n":[0,1,0],"ref":[180.5,223.8,369.1]},{"a":[296,223.8,349.6],"b":[296,65,349.6],"style":"floorline","n":[1,0,0],"ref":[296,144.4,369.1]},{"a":[296,65,349.6],"b":[65,65,349.6],"style":"floorline","n":[0,-1,0],"ref":[180.5,65,369.1]},{"a":[65,65,349.6],"b":[65,223.8,349.6],"style":"floorline","n":[-1,0,0],"ref":[65,144.4,369.1]},{"a":[65,223.8,388.7],"b":[296,223.8,388.7],"style":"floorline","n":[0,1,0],"ref":[180.5,223.8,369.1]},{"a":[296,223.8,388.7],"b":[296,65,388.7],"style":"floorline","n":[1,0,0],"ref":[296,144.4,369.1]},{"a":[296,65,388.7],"b":[65,65,388.7],"style":"floorline","n":[0,-1,0],"ref":[180.5,65,369.1]},{"a":[65,65,388.7],"b":[65,223.8,388.7],"style":"floorline","n":[-1,0,0],"ref":[65,144.4,369.1]},{"a":[65,223.8,353.8],"b":[296,223.8,353.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,371.8]},{"a":[65,223.8,362.8],"b":[296,223.8,362.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,371.8]},{"a":[65,223.8,371.8],"b":[296,223.8,371.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,371.8]},{"a":[65,223.8,380.8],"b":[296,223.8,380.8],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,371.8]},{"a":[65,223.8,389.9],"b":[296,223.8,389.9],"style":"mullion","n":[0,1,0],"ref":[180.5,223.8,371.8]},{"a":[57.8,115.5,440.4],"b":[303.2,115.5,440.4],"style":"seam","n":[0,0,1]},{"a":[57.8,173.3,440.4],"b":[303.2,173.3,440.4],"style":"seam","n":[0,0,1]},{"a":[177.8,141.7,480.1],"b":[177.8,141.7,536.1],"style":"post","n":[0,0,1]},{"a":[169.7,141.7,526],"b":[185.9,141.7,526],"style":"rail","n":[0,0,1]},{"a":[169.7,141.7,515.9],"b":[185.9,141.7,515.9],"style":"rail","n":[0,0,1]}],"center":[180.5,144.4]},"view":{"vbw":470,"vbh":560,"offx":213.338,"offy":300.179,"shadow":{"cx":235.0,"cy":518.0,"rx":168.7,"ry":22.8}}},{"name":"Twin Towers","geom":{"faces":[{"pts":[[0,218.5,0],[400.7,218.5,0],[400.7,218.5,87.4],[0,218.5,87.4]],"style":"glass","n":[0,1,0]},{"pts":[[400.7,218.5,0],[400.7,0,0],[400.7,0,87.4],[400.7,218.5,87.4]],"style":"glass","n":[1,0,0]},{"pts":[[400.7,0,0],[0,0,0],[0,0,87.4],[400.7,0,87.4]],"style":"glass","n":[0,-1,0]},{"pts":[[0,0,0],[0,218.5,0],[0,218.5,87.4],[0,0,87.4]],"style":"glass","n":[-1,0,0]},{"pts":[[171.2,218.5,0],[247.7,218.5,0],[247.7,218.5,69.2],[171.2,218.5,69.2]],"style":"door","n":[0,1,0]},{"pts":[[-9.1,227.6,87.4],[409.8,227.6,87.4],[409.8,227.6,98.3],[-9.1,227.6,98.3]],"style":"para","n":[0,1,0]},{"pts":[[409.8,227.6,87.4],[409.8,-9.1,87.4],[409.8,-9.1,98.3],[409.8,227.6,98.3]],"style":"para","n":[1,0,0]},{"pts":[[409.8,-9.1,87.4],[-9.1,-9.1,87.4],[-9.1,-9.1,98.3],[409.8,-9.1,98.3]],"style":"para","n":[0,-1,0]},{"pts":[[-9.1,-9.1,87.4],[-9.1,227.6,87.4],[-9.1,227.6,98.3],[-9.1,-9.1,98.3]],"style":"para","n":[-1,0,0]},{"pts":[[-9.1,10.9,98.3],[409.8,10.9,98.3],[409.8,-9.1,98.3],[-9.1,-9.1,98.3]],"style":"terrace","n":[0,0,1]},{"pts":[[-9.1,227.6,98.3],[409.8,227.6,98.3],[409.8,207.6,98.3],[-9.1,207.6,98.3]],"style":"terrace","n":[0,0,1]},{"pts":[[-9.1,207.6,98.3],[21.9,207.6,98.3],[21.9,10.9,98.3],[-9.1,10.9,98.3]],"style":"terrace","n":[0,0,1]},{"pts":[[378.8,207.6,98.3],[409.8,207.6,98.3],[409.8,10.9,98.3],[378.8,10.9,98.3]],"style":"terrace","n":[0,0,1]},{"pts":[[21.9,207.6,98.3],[167.5,207.6,98.3],[167.5,163.9,98.3],[21.9,163.9,98.3]],"style":"terrace","n":[0,0,1]},{"pts":[[233.1,54.6,98.3],[378.8,54.6,98.3],[378.8,10.9,98.3],[233.1,10.9,98.3]],"style":"terrace","n":[0,0,1]},{"pts":[[167.5,207.6,98.3],[233.1,207.6,98.3],[233.1,10.9,98.3],[167.5,10.9,98.3]],"style":"green","n":[0,0,1]},{"pts":[[21.9,163.9,98.3],[167.5,163.9,98.3],[167.5,163.9,411.6],[21.9,163.9,411.6]],"style":"glass","n":[0,1,0]},{"pts":[[167.5,163.9,98.3],[167.5,10.9,98.3],[167.5,10.9,411.6],[167.5,163.9,411.6]],"style":"glass","n":[1,0,0]},{"pts":[[167.5,10.9,98.3],[21.9,10.9,98.3],[21.9,10.9,411.6],[167.5,10.9,411.6]],"style":"glass","n":[0,-1,0]},{"pts":[[21.9,10.9,98.3],[21.9,163.9,98.3],[21.9,163.9,411.6],[21.9,10.9,411.6]],"style":"glass","n":[-1,0,0]},{"pts":[[16.4,169.4,411.6],[173,169.4,411.6],[173,169.4,422.5],[16.4,169.4,422.5]],"style":"para","n":[0,1,0]},{"pts":[[173,169.4,411.6],[173,5.5,411.6],[173,5.5,422.5],[173,169.4,422.5]],"style":"para","n":[1,0,0]},{"pts":[[173,5.5,411.6],[16.4,5.5,411.6],[16.4,5.5,422.5],[173,5.5,422.5]],"style":"para","n":[0,-1,0]},{"pts":[[16.4,5.5,411.6],[16.4,169.4,411.6],[16.4,169.4,422.5],[16.4,5.5,422.5]],"style":"para","n":[-1,0,0]},{"pts":[[16.4,169.4,422.5],[173,169.4,422.5],[173,5.5,422.5],[16.4,5.5,422.5]],"style":"roof-top","n":[0,0,1]},{"pts":[[233.1,207.6,98.3],[378.8,207.6,98.3],[378.8,207.6,360.6],[233.1,207.6,360.6]],"style":"glass","n":[0,1,0]},{"pts":[[378.8,207.6,98.3],[378.8,54.6,98.3],[378.8,54.6,360.6],[378.8,207.6,360.6]],"style":"glass","n":[1,0,0]},{"pts":[[378.8,54.6,98.3],[233.1,54.6,98.3],[233.1,54.6,360.6],[378.8,54.6,360.6]],"style":"glass","n":[0,-1,0]},{"pts":[[233.1,54.6,98.3],[233.1,207.6,98.3],[233.1,207.6,360.6],[233.1,54.6,360.6]],"style":"glass","n":[-1,0,0]},{"pts":[[227.6,213.1,360.6],[384.3,213.1,360.6],[384.3,213.1,371.5],[227.6,213.1,371.5]],"style":"para","n":[0,1,0]},{"pts":[[384.3,213.1,360.6],[384.3,49.2,360.6],[384.3,49.2,371.5],[384.3,213.1,371.5]],"style":"para","n":[1,0,0]},{"pts":[[384.3,49.2,360.6],[227.6,49.2,360.6],[227.6,49.2,371.5],[384.3,49.2,371.5]],"style":"para","n":[0,-1,0]},{"pts":[[227.6,49.2,360.6],[227.6,213.1,360.6],[227.6,213.1,371.5],[227.6,49.2,371.5]],"style":"para","n":[-1,0,0]},{"pts":[[227.6,213.1,371.5],[384.3,213.1,371.5],[384.3,49.2,371.5],[227.6,49.2,371.5]],"style":"roof-top","n":[0,0,1]},{"pts":[[167.5,142,269.5],[233.1,142,269.5],[233.1,142,324.2],[167.5,142,324.2]],"style":"glass","n":[0,1,0]},{"pts":[[233.1,142,269.5],[233.1,87.4,269.5],[233.1,87.4,324.2],[233.1,142,324.2]],"style":"glass","n":[1,0,0]},{"pts":[[233.1,87.4,269.5],[167.5,87.4,269.5],[167.5,87.4,324.2],[233.1,87.4,324.2]],"style":"glass","n":[0,-1,0]},{"pts":[[167.5,87.4,269.5],[167.5,142,269.5],[167.5,142,324.2],[167.5,87.4,324.2]],"style":"glass","n":[-1,0,0]},{"pts":[[167.5,142,324.2],[233.1,142,324.2],[233.1,87.4,324.2],[167.5,87.4,324.2]],"style":"roof-top","n":[0,0,1]},{"pts":[[256.8,171.2,371.5],[355.1,171.2,371.5],[355.1,171.2,409.8],[256.8,171.2,409.8]],"style":"sky-side","n":[0,1,0]},{"pts":[[355.1,171.2,371.5],[355.1,91.1,371.5],[355.1,91.1,409.8],[355.1,171.2,409.8]],"style":"sky-side","n":[1,0,0]},{"pts":[[355.1,91.1,371.5],[256.8,91.1,371.5],[256.8,91.1,409.8],[355.1,91.1,409.8]],"style":"sky-side","n":[0,-1,0]},{"pts":[[256.8,91.1,371.5],[256.8,171.2,371.5],[256.8,171.2,409.8],[256.8,91.1,409.8]],"style":"sky-side","n":[-1,0,0]},{"pts":[[256.8,171.2,409.8],[355.1,171.2,409.8],[355.1,91.1,409.8],[256.8,91.1,409.8]],"style":"sky-top","n":[0,0,1]},{"pts":[[264.1,171.2,378.8],[347.8,171.2,378.8],[347.8,171.2,404.3],[264.1,171.2,404.3]],"style":"sky-glass","n":[0,1,0]}],"lines":[{"a":[36.4,218.5,0],"b":[36.4,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[36.4,0,0],"b":[36.4,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[72.8,218.5,0],"b":[72.8,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[72.8,0,0],"b":[72.8,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[109.3,218.5,0],"b":[109.3,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[109.3,0,0],"b":[109.3,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[145.7,218.5,0],"b":[145.7,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[145.7,0,0],"b":[145.7,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[182.1,218.5,0],"b":[182.1,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[182.1,0,0],"b":[182.1,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[218.5,218.5,0],"b":[218.5,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[218.5,0,0],"b":[218.5,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[255,218.5,0],"b":[255,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[255,0,0],"b":[255,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[291.4,218.5,0],"b":[291.4,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[291.4,0,0],"b":[291.4,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[327.8,218.5,0],"b":[327.8,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[327.8,0,0],"b":[327.8,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[364.2,218.5,0],"b":[364.2,218.5,87.4],"style":"mullion","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[364.2,0,0],"b":[364.2,0,87.4],"style":"mullion","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[400.7,36.4,0],"b":[400.7,36.4,87.4],"style":"mullion","n":[1,0,0],"ref":[400.7,109.3,43.7]},{"a":[0,36.4,0],"b":[0,36.4,87.4],"style":"mullion","n":[-1,0,0],"ref":[0,109.3,43.7]},{"a":[400.7,72.8,0],"b":[400.7,72.8,87.4],"style":"mullion","n":[1,0,0],"ref":[400.7,109.3,43.7]},{"a":[0,72.8,0],"b":[0,72.8,87.4],"style":"mullion","n":[-1,0,0],"ref":[0,109.3,43.7]},{"a":[400.7,109.3,0],"b":[400.7,109.3,87.4],"style":"mullion","n":[1,0,0],"ref":[400.7,109.3,43.7]},{"a":[0,109.3,0],"b":[0,109.3,87.4],"style":"mullion","n":[-1,0,0],"ref":[0,109.3,43.7]},{"a":[400.7,145.7,0],"b":[400.7,145.7,87.4],"style":"mullion","n":[1,0,0],"ref":[400.7,109.3,43.7]},{"a":[0,145.7,0],"b":[0,145.7,87.4],"style":"mullion","n":[-1,0,0],"ref":[0,109.3,43.7]},{"a":[400.7,182.1,0],"b":[400.7,182.1,87.4],"style":"mullion","n":[1,0,0],"ref":[400.7,109.3,43.7]},{"a":[0,182.1,0],"b":[0,182.1,87.4],"style":"mullion","n":[-1,0,0],"ref":[0,109.3,43.7]},{"a":[0,218.5,87.4],"b":[400.7,218.5,87.4],"style":"slab","n":[0,1,0],"ref":[200.3,218.5,43.7]},{"a":[400.7,218.5,87.4],"b":[400.7,0,87.4],"style":"slab","n":[1,0,0],"ref":[400.7,109.3,43.7]},{"a":[400.7,0,87.4],"b":[0,0,87.4],"style":"slab","n":[0,-1,0],"ref":[200.3,0,43.7]},{"a":[0,0,87.4],"b":[0,218.5,87.4],"style":"slab","n":[-1,0,0],"ref":[0,109.3,43.7]},{"a":[58.3,163.9,98.3],"b":[58.3,163.9,411.6],"style":"mullion","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[58.3,10.9,98.3],"b":[58.3,10.9,411.6],"style":"mullion","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[94.7,163.9,98.3],"b":[94.7,163.9,411.6],"style":"mullion","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[94.7,10.9,98.3],"b":[94.7,10.9,411.6],"style":"mullion","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[131.1,163.9,98.3],"b":[131.1,163.9,411.6],"style":"mullion","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[131.1,10.9,98.3],"b":[131.1,10.9,411.6],"style":"mullion","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[167.5,41.5,98.3],"b":[167.5,41.5,411.6],"style":"mullion","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[21.9,41.5,98.3],"b":[21.9,41.5,411.6],"style":"mullion","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[167.5,72.1,98.3],"b":[167.5,72.1,411.6],"style":"mullion","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[21.9,72.1,98.3],"b":[21.9,72.1,411.6],"style":"mullion","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[167.5,102.7,98.3],"b":[167.5,102.7,411.6],"style":"mullion","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[21.9,102.7,98.3],"b":[21.9,102.7,411.6],"style":"mullion","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[167.5,133.3,98.3],"b":[167.5,133.3,411.6],"style":"mullion","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[21.9,133.3,98.3],"b":[21.9,133.3,411.6],"style":"mullion","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[21.9,163.9,150.5],"b":[167.5,163.9,150.5],"style":"floorline","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[167.5,163.9,150.5],"b":[167.5,10.9,150.5],"style":"floorline","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[167.5,10.9,150.5],"b":[21.9,10.9,150.5],"style":"floorline","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,150.5],"b":[21.9,163.9,150.5],"style":"floorline","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[21.9,163.9,202.8],"b":[167.5,163.9,202.8],"style":"floorline","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[167.5,163.9,202.8],"b":[167.5,10.9,202.8],"style":"floorline","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[167.5,10.9,202.8],"b":[21.9,10.9,202.8],"style":"floorline","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,202.8],"b":[21.9,163.9,202.8],"style":"floorline","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[21.9,163.9,255],"b":[167.5,163.9,255],"style":"floorline","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[167.5,163.9,255],"b":[167.5,10.9,255],"style":"floorline","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[167.5,10.9,255],"b":[21.9,10.9,255],"style":"floorline","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,255],"b":[21.9,163.9,255],"style":"floorline","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[21.9,163.9,307.2],"b":[167.5,163.9,307.2],"style":"floorline","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[167.5,163.9,307.2],"b":[167.5,10.9,307.2],"style":"floorline","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[167.5,10.9,307.2],"b":[21.9,10.9,307.2],"style":"floorline","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,307.2],"b":[21.9,163.9,307.2],"style":"floorline","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[21.9,163.9,359.4],"b":[167.5,163.9,359.4],"style":"floorline","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[167.5,163.9,359.4],"b":[167.5,10.9,359.4],"style":"floorline","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[167.5,10.9,359.4],"b":[21.9,10.9,359.4],"style":"floorline","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,359.4],"b":[21.9,163.9,359.4],"style":"floorline","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[21.9,163.9,411.6],"b":[167.5,163.9,411.6],"style":"slab","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[167.5,163.9,411.6],"b":[167.5,10.9,411.6],"style":"slab","n":[1,0,0],"ref":[167.5,87.4,255]},{"a":[167.5,10.9,411.6],"b":[21.9,10.9,411.6],"style":"slab","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,411.6],"b":[21.9,163.9,411.6],"style":"slab","n":[-1,0,0],"ref":[21.9,87.4,255]},{"a":[21.9,163.9,98.3],"b":[167.5,163.9,176.7],"style":"brace","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[21.9,163.9,176.7],"b":[167.5,163.9,98.3],"style":"brace","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[21.9,163.9,176.7],"b":[167.5,163.9,255],"style":"brace","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[21.9,163.9,255],"b":[167.5,163.9,176.7],"style":"brace","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[21.9,163.9,255],"b":[167.5,163.9,333.3],"style":"brace","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[21.9,163.9,333.3],"b":[167.5,163.9,255],"style":"brace","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[21.9,163.9,333.3],"b":[167.5,163.9,411.6],"style":"brace","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[21.9,163.9,411.6],"b":[167.5,163.9,333.3],"style":"brace","n":[0,1,0],"ref":[94.7,163.9,255]},{"a":[21.9,10.9,98.3],"b":[167.5,10.9,176.7],"style":"brace","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,176.7],"b":[167.5,10.9,98.3],"style":"brace","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,176.7],"b":[167.5,10.9,255],"style":"brace","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,255],"b":[167.5,10.9,176.7],"style":"brace","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,255],"b":[167.5,10.9,333.3],"style":"brace","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,333.3],"b":[167.5,10.9,255],"style":"brace","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,333.3],"b":[167.5,10.9,411.6],"style":"brace","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[21.9,10.9,411.6],"b":[167.5,10.9,333.3],"style":"brace","n":[0,-1,0],"ref":[94.7,10.9,255]},{"a":[269.5,207.6,98.3],"b":[269.5,207.6,360.6],"style":"mullion","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[269.5,54.6,98.3],"b":[269.5,54.6,360.6],"style":"mullion","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[306,207.6,98.3],"b":[306,207.6,360.6],"style":"mullion","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[306,54.6,98.3],"b":[306,54.6,360.6],"style":"mullion","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[342.4,207.6,98.3],"b":[342.4,207.6,360.6],"style":"mullion","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[342.4,54.6,98.3],"b":[342.4,54.6,360.6],"style":"mullion","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[378.8,85.2,98.3],"b":[378.8,85.2,360.6],"style":"mullion","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[233.1,85.2,98.3],"b":[233.1,85.2,360.6],"style":"mullion","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[378.8,115.8,98.3],"b":[378.8,115.8,360.6],"style":"mullion","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[233.1,115.8,98.3],"b":[233.1,115.8,360.6],"style":"mullion","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[378.8,146.4,98.3],"b":[378.8,146.4,360.6],"style":"mullion","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[233.1,146.4,98.3],"b":[233.1,146.4,360.6],"style":"mullion","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[378.8,177,98.3],"b":[378.8,177,360.6],"style":"mullion","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[233.1,177,98.3],"b":[233.1,177,360.6],"style":"mullion","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[233.1,207.6,142],"b":[378.8,207.6,142],"style":"floorline","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[378.8,207.6,142],"b":[378.8,54.6,142],"style":"floorline","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[378.8,54.6,142],"b":[233.1,54.6,142],"style":"floorline","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,142],"b":[233.1,207.6,142],"style":"floorline","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[233.1,207.6,185.8],"b":[378.8,207.6,185.8],"style":"floorline","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[378.8,207.6,185.8],"b":[378.8,54.6,185.8],"style":"floorline","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[378.8,54.6,185.8],"b":[233.1,54.6,185.8],"style":"floorline","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,185.8],"b":[233.1,207.6,185.8],"style":"floorline","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[233.1,207.6,229.5],"b":[378.8,207.6,229.5],"style":"floorline","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[378.8,207.6,229.5],"b":[378.8,54.6,229.5],"style":"floorline","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[378.8,54.6,229.5],"b":[233.1,54.6,229.5],"style":"floorline","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,229.5],"b":[233.1,207.6,229.5],"style":"floorline","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[233.1,207.6,273.2],"b":[378.8,207.6,273.2],"style":"floorline","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[378.8,207.6,273.2],"b":[378.8,54.6,273.2],"style":"floorline","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[378.8,54.6,273.2],"b":[233.1,54.6,273.2],"style":"floorline","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,273.2],"b":[233.1,207.6,273.2],"style":"floorline","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[233.1,207.6,316.9],"b":[378.8,207.6,316.9],"style":"floorline","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[378.8,207.6,316.9],"b":[378.8,54.6,316.9],"style":"floorline","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[378.8,54.6,316.9],"b":[233.1,54.6,316.9],"style":"floorline","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,316.9],"b":[233.1,207.6,316.9],"style":"floorline","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[233.1,207.6,360.6],"b":[378.8,207.6,360.6],"style":"slab","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[378.8,207.6,360.6],"b":[378.8,54.6,360.6],"style":"slab","n":[1,0,0],"ref":[378.8,131.1,229.5]},{"a":[378.8,54.6,360.6],"b":[233.1,54.6,360.6],"style":"slab","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,360.6],"b":[233.1,207.6,360.6],"style":"slab","n":[-1,0,0],"ref":[233.1,131.1,229.5]},{"a":[233.1,207.6,98.3],"b":[378.8,207.6,163.9],"style":"brace","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[233.1,207.6,163.9],"b":[378.8,207.6,98.3],"style":"brace","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[233.1,207.6,163.9],"b":[378.8,207.6,229.5],"style":"brace","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[233.1,207.6,229.5],"b":[378.8,207.6,163.9],"style":"brace","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[233.1,207.6,229.5],"b":[378.8,207.6,295],"style":"brace","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[233.1,207.6,295],"b":[378.8,207.6,229.5],"style":"brace","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[233.1,207.6,295],"b":[378.8,207.6,360.6],"style":"brace","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[233.1,207.6,360.6],"b":[378.8,207.6,295],"style":"brace","n":[0,1,0],"ref":[306,207.6,229.5]},{"a":[233.1,54.6,98.3],"b":[378.8,54.6,163.9],"style":"brace","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,163.9],"b":[378.8,54.6,98.3],"style":"brace","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,163.9],"b":[378.8,54.6,229.5],"style":"brace","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,229.5],"b":[378.8,54.6,163.9],"style":"brace","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,229.5],"b":[378.8,54.6,295],"style":"brace","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,295],"b":[378.8,54.6,229.5],"style":"brace","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,295],"b":[378.8,54.6,360.6],"style":"brace","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[233.1,54.6,360.6],"b":[378.8,54.6,295],"style":"brace","n":[0,-1,0],"ref":[306,54.6,229.5]},{"a":[189.4,142,269.5],"b":[189.4,142,324.2],"style":"mullion","n":[0,1,0],"ref":[200.3,142,296.8]},{"a":[189.4,87.4,269.5],"b":[189.4,87.4,324.2],"style":"mullion","n":[0,-1,0],"ref":[200.3,87.4,296.8]},{"a":[211.3,142,269.5],"b":[211.3,142,324.2],"style":"mullion","n":[0,1,0],"ref":[200.3,142,296.8]},{"a":[211.3,87.4,269.5],"b":[211.3,87.4,324.2],"style":"mullion","n":[0,-1,0],"ref":[200.3,87.4,296.8]},{"a":[167.5,142,269.5],"b":[233.1,142,269.5],"style":"slab","n":[0,1,0],"ref":[200.3,142,296.8]},{"a":[233.1,142,269.5],"b":[233.1,87.4,269.5],"style":"slab","n":[1,0,0],"ref":[233.1,114.7,296.8]},{"a":[233.1,87.4,269.5],"b":[167.5,87.4,269.5],"style":"slab","n":[0,-1,0],"ref":[200.3,87.4,296.8]},{"a":[167.5,87.4,269.5],"b":[167.5,142,269.5],"style":"slab","n":[-1,0,0],"ref":[167.5,114.7,296.8]},{"a":[167.5,142,269.5],"b":[233.1,142,296.8],"style":"truss","n":[0,1,0],"ref":[200.3,142,296.8]},{"a":[167.5,142,296.8],"b":[233.1,142,269.5],"style":"truss","n":[0,1,0],"ref":[200.3,142,296.8]},{"a":[167.5,142,296.8],"b":[233.1,142,324.2],"style":"truss","n":[0,1,0],"ref":[200.3,142,296.8]},{"a":[167.5,142,324.2],"b":[233.1,142,296.8],"style":"truss","n":[0,1,0],"ref":[200.3,142,296.8]},{"a":[167.5,87.4,269.5],"b":[233.1,87.4,296.8],"style":"truss","n":[0,-1,0],"ref":[200.3,87.4,296.8]},{"a":[167.5,87.4,296.8],"b":[233.1,87.4,269.5],"style":"truss","n":[0,-1,0],"ref":[200.3,87.4,296.8]},{"a":[167.5,87.4,296.8],"b":[233.1,87.4,324.2],"style":"truss","n":[0,-1,0],"ref":[200.3,87.4,296.8]},{"a":[167.5,87.4,324.2],"b":[233.1,87.4,296.8],"style":"truss","n":[0,-1,0],"ref":[200.3,87.4,296.8]},{"a":[94.7,87.4,422.5],"b":[94.7,87.4,484.4],"style":"post","n":[0,0,1]},{"a":[86.5,87.4,473.3],"b":[102.9,87.4,473.3],"style":"rail","n":[0,0,1]},{"a":[86.5,87.4,462.1],"b":[102.9,87.4,462.1],"style":"rail","n":[0,0,1]}],"center":[200.3,109.3]},"view":{"vbw":470,"vbh":560,"offx":180.394,"offy":314.94,"shadow":{"cx":235.0,"cy":526.1,"rx":166.5,"ry":22.5}}},{"name":"Cantilever Gallery","geom":{"faces":[{"pts":[[60.2,250.9,0],[341.2,250.9,0],[341.2,250.9,18.1],[60.2,250.9,18.1]],"style":"pier","n":[0,1,0]},{"pts":[[341.2,250.9,0],[341.2,10,0],[341.2,10,18.1],[341.2,250.9,18.1]],"style":"pier","n":[1,0,0]},{"pts":[[341.2,10,0],[60.2,10,0],[60.2,10,18.1],[341.2,10,18.1]],"style":"pier","n":[0,-1,0]},{"pts":[[60.2,10,0],[60.2,250.9,0],[60.2,250.9,18.1],[60.2,10,18.1]],"style":"pier","n":[-1,0,0]},{"pts":[[60.2,250.9,18.1],[341.2,250.9,18.1],[341.2,190.7,18.1],[60.2,190.7,18.1]],"style":"terrace","n":[0,0,1]},{"pts":[[60.2,70.2,18.1],[341.2,70.2,18.1],[341.2,10,18.1],[60.2,10,18.1]],"style":"terrace","n":[0,0,1]},{"pts":[[60.2,190.7,18.1],[150.5,190.7,18.1],[150.5,70.2,18.1],[60.2,70.2,18.1]],"style":"terrace","n":[0,0,1]},{"pts":[[250.9,190.7,18.1],[341.2,190.7,18.1],[341.2,70.2,18.1],[250.9,70.2,18.1]],"style":"terrace","n":[0,0,1]},{"pts":[[150.5,190.7,18.1],[250.9,190.7,18.1],[250.9,190.7,297],[150.5,190.7,297]],"style":"glass","n":[0,1,0]},{"pts":[[250.9,190.7,18.1],[250.9,70.2,18.1],[250.9,70.2,297],[250.9,190.7,297]],"style":"glass","n":[1,0,0]},{"pts":[[250.9,70.2,18.1],[150.5,70.2,18.1],[150.5,70.2,297],[250.9,70.2,297]],"style":"glass","n":[0,-1,0]},{"pts":[[150.5,70.2,18.1],[150.5,190.7,18.1],[150.5,190.7,297],[150.5,70.2,297]],"style":"glass","n":[-1,0,0]},{"pts":[[176.6,190.7,18.1],[224.8,190.7,18.1],[224.8,190.7,92.3],[176.6,190.7,92.3]],"style":"door","n":[0,1,0]},{"pts":[[250.9,98.3,18.1],[250.9,162.6,18.1],[250.9,162.6,297],[250.9,98.3,297]],"style":"core","n":[1,0,0]},{"pts":[[124.4,84.3,18.1],[146.5,84.3,18.1],[68.2,84.3,297],[46.2,84.3,297]],"style":"pier","n":[0,1,0]},{"pts":[[146.5,84.3,18.1],[146.5,60.2,18.1],[68.2,60.2,297],[68.2,84.3,297]],"style":"pier","n":[1,0,0]},{"pts":[[146.5,60.2,18.1],[124.4,60.2,18.1],[46.2,60.2,297],[68.2,60.2,297]],"style":"pier","n":[0,-1,0]},{"pts":[[124.4,60.2,18.1],[124.4,84.3,18.1],[46.2,84.3,297],[46.2,60.2,297]],"style":"pier","n":[-1,0,0]},{"pts":[[254.9,84.3,18.1],[277,84.3,18.1],[355.2,84.3,297],[333.2,84.3,297]],"style":"pier","n":[0,1,0]},{"pts":[[277,84.3,18.1],[277,60.2,18.1],[355.2,60.2,297],[355.2,84.3,297]],"style":"pier","n":[1,0,0]},{"pts":[[277,60.2,18.1],[254.9,60.2,18.1],[333.2,60.2,297],[355.2,60.2,297]],"style":"pier","n":[0,-1,0]},{"pts":[[254.9,60.2,18.1],[254.9,84.3,18.1],[333.2,84.3,297],[333.2,60.2,297]],"style":"pier","n":[-1,0,0]},{"pts":[[124.4,200.7,18.1],[146.5,200.7,18.1],[68.2,200.7,297],[46.2,200.7,297]],"style":"pier","n":[0,1,0]},{"pts":[[146.5,200.7,18.1],[146.5,176.6,18.1],[68.2,176.6,297],[68.2,200.7,297]],"style":"pier","n":[1,0,0]},{"pts":[[146.5,176.6,18.1],[124.4,176.6,18.1],[46.2,176.6,297],[68.2,176.6,297]],"style":"pier","n":[0,-1,0]},{"pts":[[124.4,176.6,18.1],[124.4,200.7,18.1],[46.2,200.7,297],[46.2,176.6,297]],"style":"pier","n":[-1,0,0]},{"pts":[[254.9,200.7,18.1],[277,200.7,18.1],[355.2,200.7,297],[333.2,200.7,297]],"style":"pier","n":[0,1,0]},{"pts":[[277,200.7,18.1],[277,176.6,18.1],[355.2,176.6,297],[355.2,200.7,297]],"style":"pier","n":[1,0,0]},{"pts":[[277,176.6,18.1],[254.9,176.6,18.1],[333.2,176.6,297],[355.2,176.6,297]],"style":"pier","n":[0,-1,0]},{"pts":[[254.9,176.6,18.1],[254.9,200.7,18.1],[333.2,200.7,297],[333.2,176.6,297]],"style":"pier","n":[-1,0,0]},{"pts":[[16.1,234.8,297],[385.3,234.8,297],[385.3,234.8,421.5],[16.1,234.8,421.5]],"style":"glass","n":[0,1,0]},{"pts":[[385.3,234.8,297],[385.3,6,297],[385.3,6,421.5],[385.3,234.8,421.5]],"style":"glass","n":[1,0,0]},{"pts":[[385.3,6,297],[16.1,6,297],[16.1,6,421.5],[385.3,6,421.5]],"style":"glass","n":[0,-1,0]},{"pts":[[16.1,6,297],[16.1,234.8,297],[16.1,234.8,421.5],[16.1,6,421.5]],"style":"glass","n":[-1,0,0]},{"pts":[[16.1,234.8,381.3],[385.3,234.8,381.3],[385.3,234.8,413.4],[16.1,234.8,413.4]],"style":"louver","n":[0,1,0]},{"pts":[[11,239.8,421.5],[390.4,239.8,421.5],[390.4,239.8,433.5],[11,239.8,433.5]],"style":"para","n":[0,1,0]},{"pts":[[390.4,239.8,421.5],[390.4,1,421.5],[390.4,1,433.5],[390.4,239.8,433.5]],"style":"para","n":[1,0,0]},{"pts":[[390.4,1,421.5],[11,1,421.5],[11,1,433.5],[390.4,1,433.5]],"style":"para","n":[0,-1,0]},{"pts":[[11,1,421.5],[11,239.8,421.5],[11,239.8,433.5],[11,1,433.5]],"style":"para","n":[-1,0,0]},{"pts":[[11,239.8,433.5],[390.4,239.8,433.5],[390.4,1,433.5],[11,1,433.5]],"style":"roof-top","n":[0,0,1]},{"pts":[[146.5,228.8,433.5],[224.8,228.8,433.5],[224.8,228.8,473.7],[146.5,228.8,473.7]],"style":"sky-side","n":[0,1,0]},{"pts":[[224.8,228.8,433.5],[224.8,160.6,433.5],[224.8,160.6,473.7],[224.8,228.8,473.7]],"style":"sky-side","n":[1,0,0]},{"pts":[[224.8,160.6,433.5],[146.5,160.6,433.5],[146.5,160.6,473.7],[224.8,160.6,473.7]],"style":"sky-side","n":[0,-1,0]},{"pts":[[146.5,160.6,433.5],[146.5,228.8,433.5],[146.5,228.8,473.7],[146.5,160.6,473.7]],"style":"sky-side","n":[-1,0,0]},{"pts":[[146.5,228.8,473.7],[224.8,228.8,473.7],[224.8,160.6,473.7],[146.5,160.6,473.7]],"style":"sky-top","n":[0,0,1]},{"pts":[[154.5,228.8,441.5],[216.8,228.8,441.5],[216.8,228.8,467.6],[154.5,228.8,467.6]],"style":"sky-glass","n":[0,1,0]}],"lines":[{"a":[175.6,190.7,18.1],"b":[175.6,190.7,297],"style":"mullion","n":[0,1,0],"ref":[200.7,190.7,157.5]},{"a":[175.6,70.2,18.1],"b":[175.6,70.2,297],"style":"mullion","n":[0,-1,0],"ref":[200.7,70.2,157.5]},{"a":[200.7,190.7,18.1],"b":[200.7,190.7,297],"style":"mullion","n":[0,1,0],"ref":[200.7,190.7,157.5]},{"a":[200.7,70.2,18.1],"b":[200.7,70.2,297],"style":"mullion","n":[0,-1,0],"ref":[200.7,70.2,157.5]},{"a":[225.8,190.7,18.1],"b":[225.8,190.7,297],"style":"mullion","n":[0,1,0],"ref":[200.7,190.7,157.5]},{"a":[225.8,70.2,18.1],"b":[225.8,70.2,297],"style":"mullion","n":[0,-1,0],"ref":[200.7,70.2,157.5]},{"a":[250.9,100.4,18.1],"b":[250.9,100.4,297],"style":"mullion","n":[1,0,0],"ref":[250.9,130.5,157.5]},{"a":[150.5,100.4,18.1],"b":[150.5,100.4,297],"style":"mullion","n":[-1,0,0],"ref":[150.5,130.5,157.5]},{"a":[250.9,130.5,18.1],"b":[250.9,130.5,297],"style":"mullion","n":[1,0,0],"ref":[250.9,130.5,157.5]},{"a":[150.5,130.5,18.1],"b":[150.5,130.5,297],"style":"mullion","n":[-1,0,0],"ref":[150.5,130.5,157.5]},{"a":[250.9,160.6,18.1],"b":[250.9,160.6,297],"style":"mullion","n":[1,0,0],"ref":[250.9,130.5,157.5]},{"a":[150.5,160.6,18.1],"b":[150.5,160.6,297],"style":"mullion","n":[-1,0,0],"ref":[150.5,130.5,157.5]},{"a":[150.5,190.7,73.9],"b":[250.9,190.7,73.9],"style":"floorline","n":[0,1,0],"ref":[200.7,190.7,157.5]},{"a":[250.9,190.7,73.9],"b":[250.9,70.2,73.9],"style":"floorline","n":[1,0,0],"ref":[250.9,130.5,157.5]},{"a":[250.9,70.2,73.9],"b":[150.5,70.2,73.9],"style":"floorline","n":[0,-1,0],"ref":[200.7,70.2,157.5]},{"a":[150.5,70.2,73.9],"b":[150.5,190.7,73.9],"style":"floorline","n":[-1,0,0],"ref":[150.5,130.5,157.5]},{"a":[150.5,190.7,129.7],"b":[250.9,190.7,129.7],"style":"floorline","n":[0,1,0],"ref":[200.7,190.7,157.5]},{"a":[250.9,190.7,129.7],"b":[250.9,70.2,129.7],"style":"floorline","n":[1,0,0],"ref":[250.9,130.5,157.5]},{"a":[250.9,70.2,129.7],"b":[150.5,70.2,129.7],"style":"floorline","n":[0,-1,0],"ref":[200.7,70.2,157.5]},{"a":[150.5,70.2,129.7],"b":[150.5,190.7,129.7],"style":"floorline","n":[-1,0,0],"ref":[150.5,130.5,157.5]},{"a":[150.5,190.7,185.4],"b":[250.9,190.7,185.4],"style":"floorline","n":[0,1,0],"ref":[200.7,190.7,157.5]},{"a":[250.9,190.7,185.4],"b":[250.9,70.2,185.4],"style":"floorline","n":[1,0,0],"ref":[250.9,130.5,157.5]},{"a":[250.9,70.2,185.4],"b":[150.5,70.2,185.4],"style":"floorline","n":[0,-1,0],"ref":[200.7,70.2,157.5]},{"a":[150.5,70.2,185.4],"b":[150.5,190.7,185.4],"style":"floorline","n":[-1,0,0],"ref":[150.5,130.5,157.5]},{"a":[150.5,190.7,241.2],"b":[250.9,190.7,241.2],"style":"floorline","n":[0,1,0],"ref":[200.7,190.7,157.5]},{"a":[250.9,190.7,241.2],"b":[250.9,70.2,241.2],"style":"floorline","n":[1,0,0],"ref":[250.9,130.5,157.5]},{"a":[250.9,70.2,241.2],"b":[150.5,70.2,241.2],"style":"floorline","n":[0,-1,0],"ref":[200.7,70.2,157.5]},{"a":[150.5,70.2,241.2],"b":[150.5,190.7,241.2],"style":"floorline","n":[-1,0,0],"ref":[150.5,130.5,157.5]},{"a":[150.5,190.7,297],"b":[250.9,190.7,297],"style":"slab","n":[0,1,0],"ref":[200.7,190.7,157.5]},{"a":[250.9,190.7,297],"b":[250.9,70.2,297],"style":"slab","n":[1,0,0],"ref":[250.9,130.5,157.5]},{"a":[250.9,70.2,297],"b":[150.5,70.2,297],"style":"slab","n":[0,-1,0],"ref":[200.7,70.2,157.5]},{"a":[150.5,70.2,297],"b":[150.5,190.7,297],"style":"slab","n":[-1,0,0],"ref":[150.5,130.5,157.5]},{"a":[46.8,234.8,297],"b":[46.8,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[46.8,6,297],"b":[46.8,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[77.6,234.8,297],"b":[77.6,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[77.6,6,297],"b":[77.6,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[108.4,234.8,297],"b":[108.4,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[108.4,6,297],"b":[108.4,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[139.2,234.8,297],"b":[139.2,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[139.2,6,297],"b":[139.2,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[169.9,234.8,297],"b":[169.9,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[169.9,6,297],"b":[169.9,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[200.7,234.8,297],"b":[200.7,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[200.7,6,297],"b":[200.7,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[231.5,234.8,297],"b":[231.5,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[231.5,6,297],"b":[231.5,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[262.2,234.8,297],"b":[262.2,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[262.2,6,297],"b":[262.2,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[293,234.8,297],"b":[293,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[293,6,297],"b":[293,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[323.8,234.8,297],"b":[323.8,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[323.8,6,297],"b":[323.8,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[354.6,234.8,297],"b":[354.6,234.8,421.5],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[354.6,6,297],"b":[354.6,6,421.5],"style":"mullion","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[385.3,63.2,297],"b":[385.3,63.2,421.5],"style":"mullion","n":[1,0,0],"ref":[385.3,120.4,359.3]},{"a":[16.1,63.2,297],"b":[16.1,63.2,421.5],"style":"mullion","n":[-1,0,0],"ref":[16.1,120.4,359.3]},{"a":[385.3,120.4,297],"b":[385.3,120.4,421.5],"style":"mullion","n":[1,0,0],"ref":[385.3,120.4,359.3]},{"a":[16.1,120.4,297],"b":[16.1,120.4,421.5],"style":"mullion","n":[-1,0,0],"ref":[16.1,120.4,359.3]},{"a":[385.3,177.6,297],"b":[385.3,177.6,421.5],"style":"mullion","n":[1,0,0],"ref":[385.3,120.4,359.3]},{"a":[16.1,177.6,297],"b":[16.1,177.6,421.5],"style":"mullion","n":[-1,0,0],"ref":[16.1,120.4,359.3]},{"a":[16.1,234.8,297],"b":[385.3,234.8,297],"style":"slab","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[385.3,234.8,297],"b":[385.3,6,297],"style":"slab","n":[1,0,0],"ref":[385.3,120.4,359.3]},{"a":[385.3,6,297],"b":[16.1,6,297],"style":"slab","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[16.1,6,297],"b":[16.1,234.8,297],"style":"slab","n":[-1,0,0],"ref":[16.1,120.4,359.3]},{"a":[16.1,234.8,357.2],"b":[385.3,234.8,357.2],"style":"floorline","n":[0,1,0],"ref":[200.7,234.8,359.3]},{"a":[385.3,234.8,357.2],"b":[385.3,6,357.2],"style":"floorline","n":[1,0,0],"ref":[385.3,120.4,359.3]},{"a":[385.3,6,357.2],"b":[16.1,6,357.2],"style":"floorline","n":[0,-1,0],"ref":[200.7,6,359.3]},{"a":[16.1,6,357.2],"b":[16.1,234.8,357.2],"style":"floorline","n":[-1,0,0],"ref":[16.1,120.4,359.3]},{"a":[16.1,234.8,389.4],"b":[385.3,234.8,389.4],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,397.4]},{"a":[16.1,234.8,397.4],"b":[385.3,234.8,397.4],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,397.4]},{"a":[16.1,234.8,405.4],"b":[385.3,234.8,405.4],"style":"mullion","n":[0,1,0],"ref":[200.7,234.8,397.4]},{"a":[11,60.7,433.5],"b":[390.4,60.7,433.5],"style":"seam","n":[0,0,1]},{"a":[11,120.4,433.5],"b":[390.4,120.4,433.5],"style":"seam","n":[0,0,1]},{"a":[11,180.1,433.5],"b":[390.4,180.1,433.5],"style":"seam","n":[0,0,1]},{"a":[331.2,44.2,433.5],"b":[331.2,44.2,491.7],"style":"post","n":[0,0,1]},{"a":[322.1,44.2,481.2],"b":[340.2,44.2,481.2],"style":"rail","n":[0,0,1]},{"a":[322.1,44.2,470.8],"b":[340.2,44.2,470.8],"style":"rail","n":[0,0,1]}],"center":[200.7,130.5]},"view":{"vbw":470,"vbh":560,"offx":192.875,"offy":328.591,"shadow":{"cx":235.0,"cy":527.5,"rx":134.9,"ry":18.2}}},{"name":"Cable-Stayed Crossing","geom":{"faces":[{"pts":[[-22.1,83.8,0],[0,83.8,0],[0,83.8,96.5],[-22.1,83.8,96.5]],"style":"pier","n":[0,1,0]},{"pts":[[0,83.8,0],[0,11.1,0],[0,11.1,96.5],[0,83.8,96.5]],"style":"pier","n":[1,0,0]},{"pts":[[0,11.1,0],[-22.1,11.1,0],[-22.1,11.1,96.5],[0,11.1,96.5]],"style":"pier","n":[0,-1,0]},{"pts":[[-22.1,11.1,0],[-22.1,83.8,0],[-22.1,83.8,96.5],[-22.1,11.1,96.5]],"style":"pier","n":[-1,0,0]},{"pts":[[-22.1,83.8,96.5],[0,83.8,96.5],[0,11.1,96.5],[-22.1,11.1,96.5]],"style":"roof-top","n":[0,0,1]},{"pts":[[442.9,83.8,0],[465.1,83.8,0],[465.1,83.8,96.5],[442.9,83.8,96.5]],"style":"pier","n":[0,1,0]},{"pts":[[465.1,83.8,0],[465.1,11.1,0],[465.1,11.1,96.5],[465.1,83.8,96.5]],"style":"pier","n":[1,0,0]},{"pts":[[465.1,11.1,0],[442.9,11.1,0],[442.9,11.1,96.5],[465.1,11.1,96.5]],"style":"pier","n":[0,-1,0]},{"pts":[[442.9,11.1,0],[442.9,83.8,0],[442.9,83.8,96.5],[442.9,11.1,96.5]],"style":"pier","n":[-1,0,0]},{"pts":[[442.9,83.8,96.5],[465.1,83.8,96.5],[465.1,11.1,96.5],[442.9,11.1,96.5]],"style":"roof-top","n":[0,0,1]},{"pts":[[110.7,-1.6,0],[158.2,-1.6,0],[158.2,-1.6,12.7],[110.7,-1.6,12.7]],"style":"pier","n":[0,1,0]},{"pts":[[158.2,-1.6,0],[158.2,-33.2,0],[158.2,-33.2,12.7],[158.2,-1.6,12.7]],"style":"pier","n":[1,0,0]},{"pts":[[158.2,-33.2,0],[110.7,-33.2,0],[110.7,-33.2,12.7],[158.2,-33.2,12.7]],"style":"pier","n":[0,-1,0]},{"pts":[[110.7,-33.2,0],[110.7,-1.6,0],[110.7,-1.6,12.7],[110.7,-33.2,12.7]],"style":"pier","n":[-1,0,0]},{"pts":[[110.7,-1.6,12.7],[158.2,-1.6,12.7],[158.2,-33.2,12.7],[110.7,-33.2,12.7]],"style":"roof-top","n":[0,0,1]},{"pts":[[110.7,128.1,0],[158.2,128.1,0],[158.2,128.1,12.7],[110.7,128.1,12.7]],"style":"pier","n":[0,1,0]},{"pts":[[158.2,128.1,0],[158.2,96.5,0],[158.2,96.5,12.7],[158.2,128.1,12.7]],"style":"pier","n":[1,0,0]},{"pts":[[158.2,96.5,0],[110.7,96.5,0],[110.7,96.5,12.7],[158.2,96.5,12.7]],"style":"pier","n":[0,-1,0]},{"pts":[[110.7,96.5,0],[110.7,128.1,0],[110.7,128.1,12.7],[110.7,96.5,12.7]],"style":"pier","n":[-1,0,0]},{"pts":[[110.7,128.1,12.7],[158.2,128.1,12.7],[158.2,96.5,12.7],[110.7,96.5,12.7]],"style":"roof-top","n":[0,0,1]},{"pts":[[284.7,-1.6,0],[332.2,-1.6,0],[332.2,-1.6,12.7],[284.7,-1.6,12.7]],"style":"pier","n":[0,1,0]},{"pts":[[332.2,-1.6,0],[332.2,-33.2,0],[332.2,-33.2,12.7],[332.2,-1.6,12.7]],"style":"pier","n":[1,0,0]},{"pts":[[332.2,-33.2,0],[284.7,-33.2,0],[284.7,-33.2,12.7],[332.2,-33.2,12.7]],"style":"pier","n":[0,-1,0]},{"pts":[[284.7,-33.2,0],[284.7,-1.6,0],[284.7,-1.6,12.7],[284.7,-33.2,12.7]],"style":"pier","n":[-1,0,0]},{"pts":[[284.7,-1.6,12.7],[332.2,-1.6,12.7],[332.2,-33.2,12.7],[284.7,-33.2,12.7]],"style":"roof-top","n":[0,0,1]},{"pts":[[284.7,128.1,0],[332.2,128.1,0],[332.2,128.1,12.7],[284.7,128.1,12.7]],"style":"pier","n":[0,1,0]},{"pts":[[332.2,128.1,0],[332.2,96.5,0],[332.2,96.5,12.7],[332.2,128.1,12.7]],"style":"pier","n":[1,0,0]},{"pts":[[332.2,96.5,0],[284.7,96.5,0],[284.7,96.5,12.7],[332.2,96.5,12.7]],"style":"pier","n":[0,-1,0]},{"pts":[[284.7,96.5,0],[284.7,128.1,0],[284.7,128.1,12.7],[284.7,96.5,12.7]],"style":"pier","n":[-1,0,0]},{"pts":[[284.7,128.1,12.7],[332.2,128.1,12.7],[332.2,96.5,12.7],[284.7,96.5,12.7]],"style":"roof-top","n":[0,0,1]},{"pts":[[0,83.8,82.3],[442.9,83.8,82.3],[442.9,83.8,96.5],[0,83.8,96.5]],"style":"deck","n":[0,1,0]},{"pts":[[442.9,83.8,82.3],[442.9,11.1,82.3],[442.9,11.1,96.5],[442.9,83.8,96.5]],"style":"deck","n":[1,0,0]},{"pts":[[442.9,11.1,82.3],[0,11.1,82.3],[0,11.1,96.5],[442.9,11.1,96.5]],"style":"deck","n":[0,-1,0]},{"pts":[[0,11.1,82.3],[0,83.8,82.3],[0,83.8,96.5],[0,11.1,96.5]],"style":"deck","n":[-1,0,0]},{"pts":[[0,83.8,96.5],[442.9,83.8,96.5],[442.9,11.1,96.5],[0,11.1,96.5]],"style":"deck","n":[0,0,1]},{"pts":[[118.6,-4.7,7.9],[150.3,-4.7,7.9],[150.3,45.9,284.7],[118.6,45.9,284.7]],"style":"core","n":[0,1,0]},{"pts":[[150.3,-4.7,7.9],[150.3,-26.9,7.9],[150.3,23.7,284.7],[150.3,45.9,284.7]],"style":"core","n":[1,0,0]},{"pts":[[150.3,-26.9,7.9],[118.6,-26.9,7.9],[118.6,23.7,284.7],[150.3,23.7,284.7]],"style":"core","n":[0,-1,0]},{"pts":[[118.6,-26.9,7.9],[118.6,-4.7,7.9],[118.6,45.9,284.7],[118.6,23.7,284.7]],"style":"core","n":[-1,0,0]},{"pts":[[118.6,121.8,7.9],[150.3,121.8,7.9],[150.3,71.2,284.7],[118.6,71.2,284.7]],"style":"core","n":[0,1,0]},{"pts":[[150.3,121.8,7.9],[150.3,99.7,7.9],[150.3,49,284.7],[150.3,71.2,284.7]],"style":"core","n":[1,0,0]},{"pts":[[150.3,99.7,7.9],[118.6,99.7,7.9],[118.6,49,284.7],[150.3,49,284.7]],"style":"core","n":[0,-1,0]},{"pts":[[118.6,99.7,7.9],[118.6,121.8,7.9],[118.6,71.2,284.7],[118.6,49,284.7]],"style":"core","n":[-1,0,0]},{"pts":[[117.1,74.4,284.7],[151.9,74.4,284.7],[151.9,74.4,319.5],[117.1,74.4,319.5]],"style":"core","n":[0,1,0]},{"pts":[[151.9,74.4,284.7],[151.9,20.6,284.7],[151.9,20.6,319.5],[151.9,74.4,319.5]],"style":"core","n":[1,0,0]},{"pts":[[151.9,20.6,284.7],[117.1,20.6,284.7],[117.1,20.6,319.5],[151.9,20.6,319.5]],"style":"core","n":[0,-1,0]},{"pts":[[117.1,20.6,284.7],[117.1,74.4,284.7],[117.1,74.4,319.5],[117.1,20.6,319.5]],"style":"core","n":[-1,0,0]},{"pts":[[117.1,74.4,319.5],[151.9,74.4,319.5],[151.9,20.6,319.5],[117.1,20.6,319.5]],"style":"roof-top","n":[0,0,1]},{"pts":[[123.4,79.1,175.6],[145.5,79.1,175.6],[145.5,79.1,191.4],[123.4,79.1,191.4]],"style":"para","n":[0,1,0]},{"pts":[[145.5,79.1,175.6],[145.5,15.8,175.6],[145.5,15.8,191.4],[145.5,79.1,191.4]],"style":"para","n":[1,0,0]},{"pts":[[145.5,15.8,175.6],[123.4,15.8,175.6],[123.4,15.8,191.4],[145.5,15.8,191.4]],"style":"para","n":[0,-1,0]},{"pts":[[123.4,15.8,175.6],[123.4,79.1,175.6],[123.4,79.1,191.4],[123.4,15.8,191.4]],"style":"para","n":[-1,0,0]},{"pts":[[123.4,79.1,191.4],[145.5,79.1,191.4],[145.5,15.8,191.4],[123.4,15.8,191.4]],"style":"roof-top","n":[0,0,1]},{"pts":[[292.7,-4.7,7.9],[324.3,-4.7,7.9],[324.3,45.9,284.7],[292.7,45.9,284.7]],"style":"core","n":[0,1,0]},{"pts":[[324.3,-4.7,7.9],[324.3,-26.9,7.9],[324.3,23.7,284.7],[324.3,45.9,284.7]],"style":"core","n":[1,0,0]},{"pts":[[324.3,-26.9,7.9],[292.7,-26.9,7.9],[292.7,23.7,284.7],[324.3,23.7,284.7]],"style":"core","n":[0,-1,0]},{"pts":[[292.7,-26.9,7.9],[292.7,-4.7,7.9],[292.7,45.9,284.7],[292.7,23.7,284.7]],"style":"core","n":[-1,0,0]},{"pts":[[292.7,121.8,7.9],[324.3,121.8,7.9],[324.3,71.2,284.7],[292.7,71.2,284.7]],"style":"core","n":[0,1,0]},{"pts":[[324.3,121.8,7.9],[324.3,99.7,7.9],[324.3,49,284.7],[324.3,71.2,284.7]],"style":"core","n":[1,0,0]},{"pts":[[324.3,99.7,7.9],[292.7,99.7,7.9],[292.7,49,284.7],[324.3,49,284.7]],"style":"core","n":[0,-1,0]},{"pts":[[292.7,99.7,7.9],[292.7,121.8,7.9],[292.7,71.2,284.7],[292.7,49,284.7]],"style":"core","n":[-1,0,0]},{"pts":[[291.1,74.4,284.7],[325.9,74.4,284.7],[325.9,74.4,319.5],[291.1,74.4,319.5]],"style":"core","n":[0,1,0]},{"pts":[[325.9,74.4,284.7],[325.9,20.6,284.7],[325.9,20.6,319.5],[325.9,74.4,319.5]],"style":"core","n":[1,0,0]},{"pts":[[325.9,20.6,284.7],[291.1,20.6,284.7],[291.1,20.6,319.5],[325.9,20.6,319.5]],"style":"core","n":[0,-1,0]},{"pts":[[291.1,20.6,284.7],[291.1,74.4,284.7],[291.1,74.4,319.5],[291.1,20.6,319.5]],"style":"core","n":[-1,0,0]},{"pts":[[291.1,74.4,319.5],[325.9,74.4,319.5],[325.9,20.6,319.5],[291.1,20.6,319.5]],"style":"roof-top","n":[0,0,1]},{"pts":[[297.4,79.1,175.6],[319.5,79.1,175.6],[319.5,79.1,191.4],[297.4,79.1,191.4]],"style":"para","n":[0,1,0]},{"pts":[[319.5,79.1,175.6],[319.5,15.8,175.6],[319.5,15.8,191.4],[319.5,79.1,191.4]],"style":"para","n":[1,0,0]},{"pts":[[319.5,15.8,175.6],[297.4,15.8,175.6],[297.4,15.8,191.4],[319.5,15.8,191.4]],"style":"para","n":[0,-1,0]},{"pts":[[297.4,15.8,175.6],[297.4,79.1,175.6],[297.4,79.1,191.4],[297.4,15.8,191.4]],"style":"para","n":[-1,0,0]},{"pts":[[297.4,79.1,191.4],[319.5,79.1,191.4],[319.5,15.8,191.4],[297.4,15.8,191.4]],"style":"roof-top","n":[0,0,1]}],"lines":[{"a":[22.1,11.1,82.3],"b":[22.1,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[22.1,83.8,82.3],"b":[22.1,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[44.3,11.1,82.3],"b":[44.3,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[44.3,83.8,82.3],"b":[44.3,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[66.4,11.1,82.3],"b":[66.4,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[66.4,83.8,82.3],"b":[66.4,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[88.6,11.1,82.3],"b":[88.6,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[88.6,83.8,82.3],"b":[88.6,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[110.7,11.1,82.3],"b":[110.7,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[110.7,83.8,82.3],"b":[110.7,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[132.9,11.1,82.3],"b":[132.9,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[132.9,83.8,82.3],"b":[132.9,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[155,11.1,82.3],"b":[155,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[155,83.8,82.3],"b":[155,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[177.2,11.1,82.3],"b":[177.2,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[177.2,83.8,82.3],"b":[177.2,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[199.3,11.1,82.3],"b":[199.3,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[199.3,83.8,82.3],"b":[199.3,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[221.5,11.1,82.3],"b":[221.5,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[221.5,83.8,82.3],"b":[221.5,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[243.6,11.1,82.3],"b":[243.6,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[243.6,83.8,82.3],"b":[243.6,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[265.8,11.1,82.3],"b":[265.8,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[265.8,83.8,82.3],"b":[265.8,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[287.9,11.1,82.3],"b":[287.9,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[287.9,83.8,82.3],"b":[287.9,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[310.1,11.1,82.3],"b":[310.1,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[310.1,83.8,82.3],"b":[310.1,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[332.2,11.1,82.3],"b":[332.2,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[332.2,83.8,82.3],"b":[332.2,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[354.3,11.1,82.3],"b":[354.3,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[354.3,83.8,82.3],"b":[354.3,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[376.5,11.1,82.3],"b":[376.5,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[376.5,83.8,82.3],"b":[376.5,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[398.6,11.1,82.3],"b":[398.6,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[398.6,83.8,82.3],"b":[398.6,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[420.8,11.1,82.3],"b":[420.8,11.1,96.5],"style":"mullion","n":[0,-1,0],"ref":[221.5,11.1,89.4]},{"a":[420.8,83.8,82.3],"b":[420.8,83.8,96.5],"style":"mullion","n":[0,1,0],"ref":[221.5,83.8,89.4]},{"a":[6.3,29.3,96.5],"b":[436.6,29.3,96.5],"style":"floorline","n":[0,0,1]},{"a":[6.3,65.6,96.5],"b":[436.6,65.6,96.5],"style":"floorline","n":[0,0,1]},{"a":[6.3,47.5,96.5],"b":[436.6,47.5,96.5],"style":"seam","n":[0,0,1]},{"a":[0,12.7,108.4],"b":[442.9,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[0,12.7,96.5],"b":[0,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[15.8,12.7,96.5],"b":[15.8,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[31.6,12.7,96.5],"b":[31.6,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[47.5,12.7,96.5],"b":[47.5,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[63.3,12.7,96.5],"b":[63.3,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[79.1,12.7,96.5],"b":[79.1,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[94.9,12.7,96.5],"b":[94.9,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[110.7,12.7,96.5],"b":[110.7,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[126.6,12.7,96.5],"b":[126.6,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[142.4,12.7,96.5],"b":[142.4,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[158.2,12.7,96.5],"b":[158.2,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[174,12.7,96.5],"b":[174,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[189.8,12.7,96.5],"b":[189.8,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[205.6,12.7,96.5],"b":[205.6,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[221.5,12.7,96.5],"b":[221.5,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[237.3,12.7,96.5],"b":[237.3,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[253.1,12.7,96.5],"b":[253.1,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[268.9,12.7,96.5],"b":[268.9,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[284.7,12.7,96.5],"b":[284.7,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[300.6,12.7,96.5],"b":[300.6,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[316.4,12.7,96.5],"b":[316.4,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[332.2,12.7,96.5],"b":[332.2,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[348,12.7,96.5],"b":[348,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[363.8,12.7,96.5],"b":[363.8,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[379.7,12.7,96.5],"b":[379.7,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[395.5,12.7,96.5],"b":[395.5,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[411.3,12.7,96.5],"b":[411.3,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[427.1,12.7,96.5],"b":[427.1,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[442.9,12.7,96.5],"b":[442.9,12.7,108.4],"style":"rail","n":[0,0,1]},{"a":[0,82.3,108.4],"b":[442.9,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[0,82.3,96.5],"b":[0,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[15.8,82.3,96.5],"b":[15.8,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[31.6,82.3,96.5],"b":[31.6,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[47.5,82.3,96.5],"b":[47.5,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[63.3,82.3,96.5],"b":[63.3,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[79.1,82.3,96.5],"b":[79.1,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[94.9,82.3,96.5],"b":[94.9,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[110.7,82.3,96.5],"b":[110.7,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[126.6,82.3,96.5],"b":[126.6,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[142.4,82.3,96.5],"b":[142.4,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[158.2,82.3,96.5],"b":[158.2,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[174,82.3,96.5],"b":[174,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[189.8,82.3,96.5],"b":[189.8,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[205.6,82.3,96.5],"b":[205.6,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[221.5,82.3,96.5],"b":[221.5,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[237.3,82.3,96.5],"b":[237.3,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[253.1,82.3,96.5],"b":[253.1,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[268.9,82.3,96.5],"b":[268.9,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[284.7,82.3,96.5],"b":[284.7,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[300.6,82.3,96.5],"b":[300.6,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[316.4,82.3,96.5],"b":[316.4,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[332.2,82.3,96.5],"b":[332.2,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[348,82.3,96.5],"b":[348,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[363.8,82.3,96.5],"b":[363.8,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[379.7,82.3,96.5],"b":[379.7,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[395.5,82.3,96.5],"b":[395.5,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[411.3,82.3,96.5],"b":[411.3,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[427.1,82.3,96.5],"b":[427.1,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[442.9,82.3,96.5],"b":[442.9,82.3,108.4],"style":"rail","n":[0,0,1]},{"a":[118.6,-14.2,77.1],"b":[150.3,-14.2,77.1],"style":"truss","n":[0,-1,0],"ref":[134.5,0,146.3]},{"a":[118.6,109.2,77.1],"b":[150.3,109.2,77.1],"style":"truss","n":[0,1,0],"ref":[134.5,94.9,146.3]},{"a":[118.6,-1.6,146.3],"b":[150.3,-1.6,146.3],"style":"truss","n":[0,-1,0],"ref":[134.5,0,146.3]},{"a":[118.6,96.5,146.3],"b":[150.3,96.5,146.3],"style":"truss","n":[0,1,0],"ref":[134.5,94.9,146.3]},{"a":[118.6,11.1,215.5],"b":[150.3,11.1,215.5],"style":"truss","n":[0,-1,0],"ref":[134.5,0,146.3]},{"a":[118.6,83.8,215.5],"b":[150.3,83.8,215.5],"style":"truss","n":[0,1,0],"ref":[134.5,94.9,146.3]},{"a":[134.5,47.5,319.5],"b":[134.5,47.5,355.9],"style":"post","n":[0,0,1]},{"a":[127.3,47.5,349.4],"b":[141.6,47.5,349.4],"style":"rail","n":[0,0,1]},{"a":[292.7,-14.2,77.1],"b":[324.3,-14.2,77.1],"style":"truss","n":[0,-1,0],"ref":[308.5,0,146.3]},{"a":[292.7,109.2,77.1],"b":[324.3,109.2,77.1],"style":"truss","n":[0,1,0],"ref":[308.5,94.9,146.3]},{"a":[292.7,-1.6,146.3],"b":[324.3,-1.6,146.3],"style":"truss","n":[0,-1,0],"ref":[308.5,0,146.3]},{"a":[292.7,96.5,146.3],"b":[324.3,96.5,146.3],"style":"truss","n":[0,1,0],"ref":[308.5,94.9,146.3]},{"a":[292.7,11.1,215.5],"b":[324.3,11.1,215.5],"style":"truss","n":[0,-1,0],"ref":[308.5,0,146.3]},{"a":[292.7,83.8,215.5],"b":[324.3,83.8,215.5],"style":"truss","n":[0,1,0],"ref":[308.5,94.9,146.3]},{"a":[308.5,47.5,319.5],"b":[308.5,47.5,355.9],"style":"post","n":[0,0,1]},{"a":[301.4,47.5,349.4],"b":[315.6,47.5,349.4],"style":"rail","n":[0,0,1]},{"a":[134.5,28.5,313.2],"b":[87,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,66.4,313.2],"b":[87,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,28.5,313.2],"b":[181.9,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,66.4,313.2],"b":[181.9,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,28.5,308.5],"b":[42.7,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,66.4,308.5],"b":[42.7,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,28.5,308.5],"b":[226.2,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,66.4,308.5],"b":[226.2,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,28.5,303.7],"b":[270.5,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,66.4,303.7],"b":[270.5,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,28.5,299],"b":[314.8,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,66.4,299],"b":[314.8,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,28.5,294.2],"b":[359.1,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[134.5,66.4,294.2],"b":[359.1,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,28.5,313.2],"b":[261,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,66.4,313.2],"b":[261,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,28.5,313.2],"b":[355.9,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,66.4,313.2],"b":[355.9,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,28.5,308.5],"b":[216.7,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,66.4,308.5],"b":[216.7,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,28.5,308.5],"b":[400.2,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,66.4,308.5],"b":[400.2,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,28.5,303.7],"b":[172.4,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,66.4,303.7],"b":[172.4,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,28.5,299],"b":[128.1,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,66.4,299],"b":[128.1,82.3,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,28.5,294.2],"b":[83.8,12.7,106.8],"style":"cable","n":[0,0,1]},{"a":[308.5,66.4,294.2],"b":[83.8,82.3,106.8],"style":"cable","n":[0,0,1]}],"center":[221.5,47.5]},"view":{"vbw":470,"vbh":560,"offx":130.588,"offy":271.09,"shadow":{"cx":235.0,"cy":476.5,"rx":179.7,"ry":24.3}}},{"name":"Civic Hall","geom":{"faces":[{"pts":[[-10.4,271.6,0],[393.5,271.6,0],[393.5,271.6,8.7],[-10.4,271.6,8.7]],"style":"pier","n":[0,1,0]},{"pts":[[393.5,271.6,0],[393.5,-10.4,0],[393.5,-10.4,8.7],[393.5,271.6,8.7]],"style":"pier","n":[1,0,0]},{"pts":[[393.5,-10.4,0],[-10.4,-10.4,0],[-10.4,-10.4,8.7],[393.5,-10.4,8.7]],"style":"pier","n":[0,-1,0]},{"pts":[[-10.4,-10.4,0],[-10.4,271.6,0],[-10.4,271.6,8.7],[-10.4,-10.4,8.7]],"style":"pier","n":[-1,0,0]},{"pts":[[0,261.2,8.7],[383,261.2,8.7],[383,261.2,19.2],[0,261.2,19.2]],"style":"pier","n":[0,1,0]},{"pts":[[383,261.2,8.7],[383,0,8.7],[383,0,19.2],[383,261.2,19.2]],"style":"pier","n":[1,0,0]},{"pts":[[383,0,8.7],[0,0,8.7],[0,0,19.2],[383,0,19.2]],"style":"pier","n":[0,-1,0]},{"pts":[[0,0,8.7],[0,261.2,8.7],[0,261.2,19.2],[0,0,19.2]],"style":"pier","n":[-1,0,0]},{"pts":[[0,261.2,19.2],[383,261.2,19.2],[383,226.3,19.2],[0,226.3,19.2]],"style":"terrace","n":[0,0,1]},{"pts":[[0,34.8,19.2],[383,34.8,19.2],[383,0,19.2],[0,0,19.2]],"style":"terrace","n":[0,0,1]},{"pts":[[0,226.3,19.2],[34.8,226.3,19.2],[34.8,34.8,19.2],[0,34.8,19.2]],"style":"terrace","n":[0,0,1]},{"pts":[[348.2,226.3,19.2],[383,226.3,19.2],[383,34.8,19.2],[348.2,34.8,19.2]],"style":"terrace","n":[0,0,1]},{"pts":[[34.8,226.3,19.2],[348.2,226.3,19.2],[348.2,226.3,184.6],[34.8,226.3,184.6]],"style":"glass","n":[0,1,0]},{"pts":[[348.2,226.3,19.2],[348.2,34.8,19.2],[348.2,34.8,184.6],[348.2,226.3,184.6]],"style":"glass","n":[1,0,0]},{"pts":[[348.2,34.8,19.2],[34.8,34.8,19.2],[34.8,34.8,184.6],[348.2,34.8,184.6]],"style":"glass","n":[0,-1,0]},{"pts":[[34.8,34.8,19.2],[34.8,226.3,19.2],[34.8,226.3,184.6],[34.8,34.8,184.6]],"style":"glass","n":[-1,0,0]},{"pts":[[160.2,226.3,19.2],[222.9,226.3,19.2],[222.9,226.3,111.4],[160.2,226.3,111.4]],"style":"door","n":[0,1,0]},{"pts":[[348.2,80.1,19.2],[348.2,181.1,19.2],[348.2,181.1,184.6],[348.2,80.1,184.6]],"style":"core","n":[1,0,0]},{"pts":[[8.7,26.1,19.2],[26.1,26.1,19.2],[26.1,26.1,184.6],[8.7,26.1,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[26.1,26.1,19.2],[26.1,8.7,19.2],[26.1,8.7,184.6],[26.1,26.1,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[26.1,8.7,19.2],[8.7,8.7,19.2],[8.7,8.7,184.6],[26.1,8.7,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[8.7,8.7,19.2],[8.7,26.1,19.2],[8.7,26.1,184.6],[8.7,8.7,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[8.7,101.6,19.2],[26.1,101.6,19.2],[26.1,101.6,184.6],[8.7,101.6,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[26.1,101.6,19.2],[26.1,84.2,19.2],[26.1,84.2,184.6],[26.1,101.6,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[26.1,84.2,19.2],[8.7,84.2,19.2],[8.7,84.2,184.6],[26.1,84.2,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[8.7,84.2,19.2],[8.7,101.6,19.2],[8.7,101.6,184.6],[8.7,84.2,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[8.7,177,19.2],[26.1,177,19.2],[26.1,177,184.6],[8.7,177,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[26.1,177,19.2],[26.1,159.6,19.2],[26.1,159.6,184.6],[26.1,177,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[26.1,159.6,19.2],[8.7,159.6,19.2],[8.7,159.6,184.6],[26.1,159.6,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[8.7,159.6,19.2],[8.7,177,19.2],[8.7,177,184.6],[8.7,159.6,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[8.7,252.5,19.2],[26.1,252.5,19.2],[26.1,252.5,184.6],[8.7,252.5,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[26.1,252.5,19.2],[26.1,235,19.2],[26.1,235,184.6],[26.1,252.5,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[26.1,235,19.2],[8.7,235,19.2],[8.7,235,184.6],[26.1,235,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[8.7,235,19.2],[8.7,252.5,19.2],[8.7,252.5,184.6],[8.7,235,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[78.3,26.1,19.2],[95.8,26.1,19.2],[95.8,26.1,184.6],[78.3,26.1,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[95.8,26.1,19.2],[95.8,8.7,19.2],[95.8,8.7,184.6],[95.8,26.1,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[95.8,8.7,19.2],[78.3,8.7,19.2],[78.3,8.7,184.6],[95.8,8.7,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[78.3,8.7,19.2],[78.3,26.1,19.2],[78.3,26.1,184.6],[78.3,8.7,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[78.3,252.5,19.2],[95.8,252.5,19.2],[95.8,252.5,184.6],[78.3,252.5,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[95.8,252.5,19.2],[95.8,235,19.2],[95.8,235,184.6],[95.8,252.5,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[95.8,235,19.2],[78.3,235,19.2],[78.3,235,184.6],[95.8,235,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[78.3,235,19.2],[78.3,252.5,19.2],[78.3,252.5,184.6],[78.3,235,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[148,26.1,19.2],[165.4,26.1,19.2],[165.4,26.1,184.6],[148,26.1,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[165.4,26.1,19.2],[165.4,8.7,19.2],[165.4,8.7,184.6],[165.4,26.1,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[165.4,8.7,19.2],[148,8.7,19.2],[148,8.7,184.6],[165.4,8.7,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[148,8.7,19.2],[148,26.1,19.2],[148,26.1,184.6],[148,8.7,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[148,252.5,19.2],[165.4,252.5,19.2],[165.4,252.5,184.6],[148,252.5,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[165.4,252.5,19.2],[165.4,235,19.2],[165.4,235,184.6],[165.4,252.5,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[165.4,235,19.2],[148,235,19.2],[148,235,184.6],[165.4,235,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[148,235,19.2],[148,252.5,19.2],[148,252.5,184.6],[148,235,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[217.6,26.1,19.2],[235,26.1,19.2],[235,26.1,184.6],[217.6,26.1,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[235,26.1,19.2],[235,8.7,19.2],[235,8.7,184.6],[235,26.1,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[235,8.7,19.2],[217.6,8.7,19.2],[217.6,8.7,184.6],[235,8.7,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[217.6,8.7,19.2],[217.6,26.1,19.2],[217.6,26.1,184.6],[217.6,8.7,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[217.6,252.5,19.2],[235,252.5,19.2],[235,252.5,184.6],[217.6,252.5,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[235,252.5,19.2],[235,235,19.2],[235,235,184.6],[235,252.5,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[235,235,19.2],[217.6,235,19.2],[217.6,235,184.6],[235,235,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[217.6,235,19.2],[217.6,252.5,19.2],[217.6,252.5,184.6],[217.6,235,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[287.3,26.1,19.2],[304.7,26.1,19.2],[304.7,26.1,184.6],[287.3,26.1,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[304.7,26.1,19.2],[304.7,8.7,19.2],[304.7,8.7,184.6],[304.7,26.1,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[304.7,8.7,19.2],[287.3,8.7,19.2],[287.3,8.7,184.6],[304.7,8.7,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[287.3,8.7,19.2],[287.3,26.1,19.2],[287.3,26.1,184.6],[287.3,8.7,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[287.3,252.5,19.2],[304.7,252.5,19.2],[304.7,252.5,184.6],[287.3,252.5,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[304.7,252.5,19.2],[304.7,235,19.2],[304.7,235,184.6],[304.7,252.5,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[304.7,235,19.2],[287.3,235,19.2],[287.3,235,184.6],[304.7,235,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[287.3,235,19.2],[287.3,252.5,19.2],[287.3,252.5,184.6],[287.3,235,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[356.9,26.1,19.2],[374.3,26.1,19.2],[374.3,26.1,184.6],[356.9,26.1,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[374.3,26.1,19.2],[374.3,8.7,19.2],[374.3,8.7,184.6],[374.3,26.1,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[374.3,8.7,19.2],[356.9,8.7,19.2],[356.9,8.7,184.6],[374.3,8.7,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[356.9,8.7,19.2],[356.9,26.1,19.2],[356.9,26.1,184.6],[356.9,8.7,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[356.9,101.6,19.2],[374.3,101.6,19.2],[374.3,101.6,184.6],[356.9,101.6,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[374.3,101.6,19.2],[374.3,84.2,19.2],[374.3,84.2,184.6],[374.3,101.6,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[374.3,84.2,19.2],[356.9,84.2,19.2],[356.9,84.2,184.6],[374.3,84.2,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[356.9,84.2,19.2],[356.9,101.6,19.2],[356.9,101.6,184.6],[356.9,84.2,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[356.9,177,19.2],[374.3,177,19.2],[374.3,177,184.6],[356.9,177,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[374.3,177,19.2],[374.3,159.6,19.2],[374.3,159.6,184.6],[374.3,177,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[374.3,159.6,19.2],[356.9,159.6,19.2],[356.9,159.6,184.6],[374.3,159.6,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[356.9,159.6,19.2],[356.9,177,19.2],[356.9,177,184.6],[356.9,159.6,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[356.9,252.5,19.2],[374.3,252.5,19.2],[374.3,252.5,184.6],[356.9,252.5,184.6]],"style":"pier","n":[0,1,0]},{"pts":[[374.3,252.5,19.2],[374.3,235,19.2],[374.3,235,184.6],[374.3,252.5,184.6]],"style":"pier","n":[1,0,0]},{"pts":[[374.3,235,19.2],[356.9,235,19.2],[356.9,235,184.6],[374.3,235,184.6]],"style":"pier","n":[0,-1,0]},{"pts":[[356.9,235,19.2],[356.9,252.5,19.2],[356.9,252.5,184.6],[356.9,235,184.6]],"style":"pier","n":[-1,0,0]},{"pts":[[-5.2,266.4,184.6],[388.3,266.4,184.6],[388.3,266.4,205.4],[-5.2,266.4,205.4]],"style":"para","n":[0,1,0]},{"pts":[[388.3,266.4,184.6],[388.3,-5.2,184.6],[388.3,-5.2,205.4],[388.3,266.4,205.4]],"style":"para","n":[1,0,0]},{"pts":[[388.3,-5.2,184.6],[-5.2,-5.2,184.6],[-5.2,-5.2,205.4],[388.3,-5.2,205.4]],"style":"para","n":[0,-1,0]},{"pts":[[-5.2,-5.2,184.6],[-5.2,266.4,184.6],[-5.2,266.4,205.4],[-5.2,-5.2,205.4]],"style":"para","n":[-1,0,0]},{"pts":[[-5.2,266.4,205.4],[388.3,266.4,205.4],[388.3,250.7,205.4],[-5.2,250.7,205.4]],"style":"roof-top","n":[0,0,1]},{"pts":[[-5.2,10.4,205.4],[388.3,10.4,205.4],[388.3,-5.2,205.4],[-5.2,-5.2,205.4]],"style":"roof-top","n":[0,0,1]},{"pts":[[-5.2,250.7,205.4],[10.4,250.7,205.4],[10.4,10.4,205.4],[-5.2,10.4,205.4]],"style":"roof-top","n":[0,0,1]},{"pts":[[372.6,250.7,205.4],[388.3,250.7,205.4],[388.3,10.4,205.4],[372.6,10.4,205.4]],"style":"roof-top","n":[0,0,1]},{"pts":[[10.4,250.7,205.4],[372.6,250.7,205.4],[372.6,130.6,276.8],[10.4,130.6,276.8]],"style":"roof-top","n":[0,0.47,0.88]},{"pts":[[372.6,10.4,205.4],[10.4,10.4,205.4],[10.4,130.6,276.8],[372.6,130.6,276.8]],"style":"roof-top","n":[0,-0.47,0.88]},{"pts":[[10.4,250.7,205.4],[10.4,10.4,205.4],[10.4,130.6,276.8]],"style":"para","n":[-1,0,0]},{"pts":[[372.6,10.4,205.4],[372.6,250.7,205.4],[372.6,130.6,276.8]],"style":"para","n":[1,0,0]},{"pts":[[160.2,146.3,275.1],[224.6,146.3,275.1],[224.6,146.3,299.5],[160.2,146.3,299.5]],"style":"glass","n":[0,1,0]},{"pts":[[224.6,146.3,275.1],[224.6,114.9,275.1],[224.6,114.9,299.5],[224.6,146.3,299.5]],"style":"glass","n":[1,0,0]},{"pts":[[224.6,114.9,275.1],[160.2,114.9,275.1],[160.2,114.9,299.5],[224.6,114.9,299.5]],"style":"glass","n":[0,-1,0]},{"pts":[[160.2,114.9,275.1],[160.2,146.3,275.1],[160.2,146.3,299.5],[160.2,114.9,299.5]],"style":"glass","n":[-1,0,0]},{"pts":[[160.2,146.3,299.5],[224.6,146.3,299.5],[224.6,114.9,299.5],[160.2,114.9,299.5]],"style":"sky-glass","n":[0,0,1]}],"lines":[{"a":[69.6,226.3,19.2],"b":[69.6,226.3,184.6],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[69.6,34.8,19.2],"b":[69.6,34.8,184.6],"style":"mullion","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[104.5,226.3,19.2],"b":[104.5,226.3,184.6],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[104.5,34.8,19.2],"b":[104.5,34.8,184.6],"style":"mullion","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[139.3,226.3,19.2],"b":[139.3,226.3,184.6],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[139.3,34.8,19.2],"b":[139.3,34.8,184.6],"style":"mullion","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[174.1,226.3,19.2],"b":[174.1,226.3,184.6],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[174.1,34.8,19.2],"b":[174.1,34.8,184.6],"style":"mullion","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[208.9,226.3,19.2],"b":[208.9,226.3,184.6],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[208.9,34.8,19.2],"b":[208.9,34.8,184.6],"style":"mullion","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[243.8,226.3,19.2],"b":[243.8,226.3,184.6],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[243.8,34.8,19.2],"b":[243.8,34.8,184.6],"style":"mullion","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[278.6,226.3,19.2],"b":[278.6,226.3,184.6],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[278.6,34.8,19.2],"b":[278.6,34.8,184.6],"style":"mullion","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[313.4,226.3,19.2],"b":[313.4,226.3,184.6],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[313.4,34.8,19.2],"b":[313.4,34.8,184.6],"style":"mullion","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[348.2,66.7,19.2],"b":[348.2,66.7,184.6],"style":"mullion","n":[1,0,0],"ref":[348.2,130.6,101.9]},{"a":[34.8,66.7,19.2],"b":[34.8,66.7,184.6],"style":"mullion","n":[-1,0,0],"ref":[34.8,130.6,101.9]},{"a":[348.2,98.7,19.2],"b":[348.2,98.7,184.6],"style":"mullion","n":[1,0,0],"ref":[348.2,130.6,101.9]},{"a":[34.8,98.7,19.2],"b":[34.8,98.7,184.6],"style":"mullion","n":[-1,0,0],"ref":[34.8,130.6,101.9]},{"a":[348.2,130.6,19.2],"b":[348.2,130.6,184.6],"style":"mullion","n":[1,0,0],"ref":[348.2,130.6,101.9]},{"a":[34.8,130.6,19.2],"b":[34.8,130.6,184.6],"style":"mullion","n":[-1,0,0],"ref":[34.8,130.6,101.9]},{"a":[348.2,162.5,19.2],"b":[348.2,162.5,184.6],"style":"mullion","n":[1,0,0],"ref":[348.2,130.6,101.9]},{"a":[34.8,162.5,19.2],"b":[34.8,162.5,184.6],"style":"mullion","n":[-1,0,0],"ref":[34.8,130.6,101.9]},{"a":[348.2,194.4,19.2],"b":[348.2,194.4,184.6],"style":"mullion","n":[1,0,0],"ref":[348.2,130.6,101.9]},{"a":[34.8,194.4,19.2],"b":[34.8,194.4,184.6],"style":"mullion","n":[-1,0,0],"ref":[34.8,130.6,101.9]},{"a":[34.8,226.3,74.3],"b":[348.2,226.3,74.3],"style":"floorline","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[348.2,226.3,74.3],"b":[348.2,34.8,74.3],"style":"floorline","n":[1,0,0],"ref":[348.2,130.6,101.9]},{"a":[348.2,34.8,74.3],"b":[34.8,34.8,74.3],"style":"floorline","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[34.8,34.8,74.3],"b":[34.8,226.3,74.3],"style":"floorline","n":[-1,0,0],"ref":[34.8,130.6,101.9]},{"a":[34.8,226.3,129.4],"b":[348.2,226.3,129.4],"style":"floorline","n":[0,1,0],"ref":[191.5,226.3,101.9]},{"a":[348.2,226.3,129.4],"b":[348.2,34.8,129.4],"style":"floorline","n":[1,0,0],"ref":[348.2,130.6,101.9]},{"a":[348.2,34.8,129.4],"b":[34.8,34.8,129.4],"style":"floorline","n":[0,-1,0],"ref":[191.5,34.8,101.9]},{"a":[34.8,34.8,129.4],"b":[34.8,226.3,129.4],"style":"floorline","n":[-1,0,0],"ref":[34.8,130.6,101.9]},{"a":[191.5,226.3,19.2],"b":[191.5,226.3,111.4],"style":"mullion","n":[0,1,0],"ref":[191.5,226.3,65.3]},{"a":[10.4,250.7,205.4],"b":[10.4,10.4,205.4],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,130.6,205.4],"b":[10.4,130.6,276.8],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,40.5,205.4],"b":[10.4,40.5,223.3],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,10.4,205.4],"b":[10.4,40.5,223.3],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,70.5,205.4],"b":[10.4,70.5,241.1],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,40.5,205.4],"b":[10.4,70.5,241.1],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,100.5,205.4],"b":[10.4,100.5,259],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,70.5,205.4],"b":[10.4,100.5,259],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,100.5,205.4],"b":[10.4,130.6,276.8],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,220.7,205.4],"b":[10.4,220.7,223.3],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,250.7,205.4],"b":[10.4,220.7,223.3],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,190.6,205.4],"b":[10.4,190.6,241.1],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,220.7,205.4],"b":[10.4,190.6,241.1],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,160.6,205.4],"b":[10.4,160.6,259],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,190.6,205.4],"b":[10.4,160.6,259],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[10.4,160.6,205.4],"b":[10.4,130.6,276.8],"style":"truss","n":[-1,0,0],"ref":[10.4,130.6,234]},{"a":[372.6,250.7,205.4],"b":[372.6,10.4,205.4],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,130.6,205.4],"b":[372.6,130.6,276.8],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,40.5,205.4],"b":[372.6,40.5,223.3],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,10.4,205.4],"b":[372.6,40.5,223.3],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,70.5,205.4],"b":[372.6,70.5,241.1],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,40.5,205.4],"b":[372.6,70.5,241.1],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,100.5,205.4],"b":[372.6,100.5,259],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,70.5,205.4],"b":[372.6,100.5,259],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,100.5,205.4],"b":[372.6,130.6,276.8],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,220.7,205.4],"b":[372.6,220.7,223.3],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,250.7,205.4],"b":[372.6,220.7,223.3],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,190.6,205.4],"b":[372.6,190.6,241.1],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,220.7,205.4],"b":[372.6,190.6,241.1],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,160.6,205.4],"b":[372.6,160.6,259],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,190.6,205.4],"b":[372.6,160.6,259],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[372.6,160.6,205.4],"b":[372.6,130.6,276.8],"style":"truss","n":[1,0,0],"ref":[372.6,130.6,234]},{"a":[10.4,220.7,223.3],"b":[372.6,220.7,223.3],"style":"mullion","n":[0,0.47,0.88],"ref":[191.5,190.6,241.1]},{"a":[10.4,40.5,223.3],"b":[372.6,40.5,223.3],"style":"mullion","n":[0,-0.47,0.88],"ref":[191.5,70.5,241.1]},{"a":[10.4,190.6,241.1],"b":[372.6,190.6,241.1],"style":"mullion","n":[0,0.47,0.88],"ref":[191.5,190.6,241.1]},{"a":[10.4,70.5,241.1],"b":[372.6,70.5,241.1],"style":"mullion","n":[0,-0.47,0.88],"ref":[191.5,70.5,241.1]},{"a":[10.4,160.6,259],"b":[372.6,160.6,259],"style":"mullion","n":[0,0.47,0.88],"ref":[191.5,190.6,241.1]},{"a":[10.4,100.5,259],"b":[372.6,100.5,259],"style":"mullion","n":[0,-0.47,0.88],"ref":[191.5,70.5,241.1]},{"a":[181.7,146.3,275.1],"b":[181.7,146.3,299.5],"style":"mullion","n":[0,1,0],"ref":[192.4,146.3,287.3]},{"a":[181.7,114.9,275.1],"b":[181.7,114.9,299.5],"style":"mullion","n":[0,-1,0],"ref":[192.4,114.9,287.3]},{"a":[203.1,146.3,275.1],"b":[203.1,146.3,299.5],"style":"mullion","n":[0,1,0],"ref":[192.4,146.3,287.3]},{"a":[203.1,114.9,275.1],"b":[203.1,114.9,299.5],"style":"mullion","n":[0,-1,0],"ref":[192.4,114.9,287.3]},{"a":[224.6,130.6,275.1],"b":[224.6,130.6,299.5],"style":"mullion","n":[1,0,0],"ref":[224.6,130.6,287.3]},{"a":[160.2,130.6,275.1],"b":[160.2,130.6,299.5],"style":"mullion","n":[-1,0,0],"ref":[160.2,130.6,287.3]}],"center":[191.5,130.6]},"view":{"vbw":470,"vbh":560,"offx":198.456,"offy":248.335,"shadow":{"cx":235.0,"cy":472.0,"rx":179.6,"ry":24.2}}}];

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
    // planted roof / sky garden
    if (style === 'green') return { fill: `rgba(18,112,127,${(0.09 + 0.12 * t).toFixed(3)})`, stroke: TEAL, sw: 1 };
    // brise-soleil fins
    if (style === 'louver') return { fill: `rgba(169,122,40,${(0.10 + 0.16 * t).toFixed(3)})`, stroke: GOLD, sw: 0.9 };
    // solid concrete - service cores, pylon legs
    if (style === 'core') return { fill: `rgba(46,51,46,${(0.07 + 0.15 * t).toFixed(3)})`, stroke: CHAR, sw: 1.3 };
    // bridge deck / carriageway
    if (style === 'deck') return { fill: `rgba(46,51,46,${(0.06 + 0.13 * t).toFixed(3)})`, stroke: CHAR, sw: 1.2 };
    // piers, plinths, colonnade columns
    if (style === 'pier') return { fill: `rgba(46,51,46,${(0.05 + 0.15 * t).toFixed(3)})`, stroke: CHAR, sw: 1.4 };
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
      // Painter's algorithm keyed on the face centroid rather than its nearest
      // corner. That difference is what lets a horizontal plate sitting behind a
      // mass sort behind it, so terraces and podium decks can be modelled all the
      // way round the building instead of only on the two sides that happen to
      // face the default camera (which is why rotating past ~180 deg used to open
      // holes where the missing strips should have been).
      const depth = rpts.reduce((s, p) => s + dot(p, VIEW), 0) / rpts.length;
      const shade = Math.max(0, dot(rn, LIGHT));
      const st = styleFor(f.style, shade);
      const d = spts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const buildZ = f.pts.reduce((s, p) => s + p[2], 0) / f.pts.length; // any polygon, not just quads
      items.push({ depth, buildZ, svg: `<polygon points="${d}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.sw}"` });
    });

    GEOM.lines.forEach(l => {
      const rn = rotYVec(l.n, theta);
      const vis = dot(rn, VIEW);
      if (vis <= 0.001) return;
      const ra = rotY(l.a, theta), rb = rotY(l.b, theta);
      const pa = project(ra), pb = project(rb);
      // A detail line inherits the depth of the surface it belongs to (l.ref is
      // its parent face centroid) so a mullion always paints on top of its own
      // wall instead of sinking behind it. Free-standing members - stay cables,
      // masts, railings - have no parent surface and use their own midpoint.
      const depth = (l.ref ? dot(rotY(l.ref, theta), VIEW)
                           : (dot(ra, VIEW) + dot(rb, VIEW)) / 2) + 0.5;
      const isPost = l.style === 'post';
      const isFloorline = l.style === 'floorline';
      const isSeam = l.style === 'seam';
      const isSlab = l.style === 'slab';
      const isBrace = l.style === 'brace';   // facade X bracing
      const isTruss = l.style === 'truss';   // exposed steel web members
      const isCable = l.style === 'cable';   // bridge stays
      const isRail = l.style === 'rail';     // parapet railings, mast ties
      const stroke = isFloorline ? 'rgba(18,112,127,0.35)'
        : isSeam ? 'rgba(169,122,40,0.4)'
        : isSlab ? 'rgba(169,122,40,0.55)'
        : isBrace ? 'rgba(18,112,127,0.55)'
        : isTruss ? 'rgba(46,51,46,0.45)'
        : isCable ? 'rgba(169,122,40,0.62)'
        : isRail ? 'rgba(18,112,127,0.45)'
        : TEAL;
      const sw = isPost ? 3
        : isFloorline ? 0.8 : isSeam ? 0.6 : isSlab ? 1.1
        : isBrace ? 1.4 : isTruss ? 1 : isCable ? 0.8 : isRail ? 0.9 : 0.8;
      const cap = isPost ? ' stroke-linecap="round"' : '';
      const dash = isFloorline ? ' stroke-dasharray="2 3"' : '';
      const buildZ = (l.a[2] + l.b[2]) / 2;
      items.push({ depth, buildZ, svg: `<line x1="${pa[0].toFixed(1)}" y1="${pa[1].toFixed(1)}" x2="${pb[0].toFixed(1)}" y2="${pb[1].toFixed(1)}" stroke="${stroke}" stroke-width="${sw}"${cap}${dash}` });
    });

    if (assemble) {
      const totalDuration = 1.15; // seconds for the whole model to finish assembling
      const order = items.map((_, i) => i).sort((a, b) => items[a].buildZ - items[b].buildZ);
      const stagger = items.length ? totalDuration / items.length : 0;
      order.forEach((itemIdx, rank) => { items[itemIdx].delay = rank * stagger; });
    }

    items.sort((a, b) => a.depth - b.depth);
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

/* ══════════════════════════════════════════════════
   LIVE CAD CURSOR
   A theodolite-style reticle that eases toward the real
   pointer position, shows a running coordinate readout,
   and morphs over links/buttons (snap point) and text
   fields (caret bar). Skipped entirely on touch devices.
   ══════════════════════════════════════════════════ */
(function () {
  function init() {
    const cursor = document.getElementById('ce-cursor');
    if (!cursor) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    // Backstop for preview/testing environments that report a fine
    // pointer even at phone widths — the fancy cursor only makes
    // sense once the nav has room to be a full desktop bar.
    if (window.innerWidth <= 768) return;

    const coordsEl = document.getElementById('ce-cursor-coords');
    const root = document.documentElement;

    const INTERACTIVE = 'a, button, [role="button"], .project-card, .ce-toggle, .nav-toggle, [onclick]';
    const TEXT_FIELD  = 'input[type="text"], input[type="email"], textarea';

    let targetX = window.innerWidth / 2, targetY = window.innerHeight / 2;
    let curX = targetX, curY = targetY;
    let activated = false;

    function activate() {
      if (activated) return;
      activated = true;
      root.classList.add('ce-cursor-active');
      requestAnimationFrame(tick);
    }

    window.addEventListener('mousemove', function (e) {
      targetX = e.clientX;
      targetY = e.clientY;
      activate();
      if (coordsEl) {
        const x = Math.round(e.clientX * 2.4);
        const y = Math.round(e.clientY * 2.4);
        coordsEl.textContent = 'X ' + x + ' \u00B7 Y ' + y;
      }
      const overText = e.target.closest && e.target.closest(TEXT_FIELD);
      const overClick = e.target.closest && e.target.closest(INTERACTIVE);
      cursor.classList.toggle('is-text', !!overText);
      cursor.classList.toggle('is-active', !!overClick && !overText);
    }, { passive: true });

    window.addEventListener('mousedown', () => cursor.classList.add('is-click'));
    window.addEventListener('mouseup', () => cursor.classList.remove('is-click'));
    window.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
    window.addEventListener('mouseenter', () => { cursor.style.opacity = ''; });

    function tick() {
      curX += (targetX - curX) * 0.22;
      curY += (targetY - curY) * 0.22;
      cursor.style.transform = 'translate(' + curX + 'px, ' + curY + 'px)';
      requestAnimationFrame(tick);
    }
  }

  // The cursor markup is appended near the end of <body>, after this
  // script tag, so it may not exist in the DOM yet at parse time —
  // wait for it if needed instead of silently no-oping.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
/* ══════════════════════════════════════════════════
   INTERACTIVE PARTICLE NETWORK BACKGROUND
   A field of drifting nodes, invisible themselves, revealed only by
   the faint lines linking each one to its nearest few neighbors —
   a loose constellation rather than a dense mesh. Reworked in the
   site's own teal/gold palette, with two civil-engineering-flavored
   touches layered on:
     • Nodes wander the full viewport at a slow, constant drift and
       bounce softly off the edges. Speed never compounds — there is
       exactly one animation loop, so the field can't creep faster
       the longer the tab stays open.
     • Each node links to its nearest neighbor in each of several
       compass directions around it (rather than just its nearest
       few by distance), so links spread out and close into
       triangles — the same triangulation that makes a structural
       truss rigid — instead of drifting into thin parallel chains.
     • Each node carries its own slow, silent "depth" oscillation
       (a sine wave on a long, randomized cycle) standing in for a
       faint 3D rotation. A link's brightness follows the average
       depth of its two endpoints: lines whose nodes are "facing the
       viewer" ease up to full color, lines whose nodes are "rotating
       away" ease down to a faint trace — a smooth glide, never a
       sudden pop.
     • Every few seconds, a small bright pulse travels along one
       currently-strong link from one end to the other — a load
       finding its way through a truss member — then fades.
     • The cursor acts as a magnet: nearby nodes draw a live gold
       link back to the pointer, at full brightness regardless of
       depth, so the interactive affordance always reads clearly.
   Fixed to the viewport so it reads as one continuous layer while
   the page scrolls, and re-reads the teal/gold theme colors whenever
   Blueprint ⇄ As-Built mode is toggled.
   ══════════════════════════════════════════════════ */
(function () {
  const canvas = document.getElementById('bg-particles');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const root = document.documentElement;

  let W = 0, H = 0, DPR = 1;
  let particles = [];

  const MAX_PARTICLES      = 90;    // hard cap regardless of screen size
  const AREA_PER_NODE      = 17000; // px² per node — density target
  const LINK_SEARCH_DIST   = 210;   // px, radius searched for possible neighbors
  const LINK_SECTORS       = 4;     // compass directions searched per node — spreads links so they triangulate
  const MOUSE_DIST         = 170;   // px, cursor "pull" radius
  const DRIFT_SPEED        = 0.11;  // px/frame, constant — never accelerates
  const DEPTH_PERIOD_MS    = 9000;  // ms for one full "facing → away → facing" cycle
  const LINK_FADE_RATE     = 0.045; // how quickly a link eases toward its on/off target each frame
  const PULSE_MIN_STRENGTH = 0.55;  // a link must be at least this solid to be picked for a pulse
  const PULSE_DURATION_MS  = 1200;  // how long one pulse takes to travel its link
  const PULSE_GAP_MS       = [2200, 4200]; // random pause range before the next pulse starts

  // Persistent "how strong is this link right now" state, keyed by
  // "i-j" particle-index pair. This is what makes a link crossfade in
  // and out over ~a third of a second as neighbors change, instead of
  // snapping instantly to full or zero the moment the nearest-neighbor
  // set is recomputed.
  let linkState = new Map();

  // The single traveling "load" pulse, or null when none is active.
  let pulse = null;
  let nextPulseAt = 0;

  const prefersReducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function particleCount() {
    const target = Math.round((W * H) / AREA_PER_NODE);
    return Math.min(MAX_PARTICLES, Math.max(36, target));
  }

  function buildParticles() {
    const n = particleCount();
    particles = [];
    linkState = new Map();
    pulse = null;
    nextPulseAt = 0;
    for (let i = 0; i < n; i++) {
      const speed = prefersReducedMotion ? 0 : DRIFT_SPEED;
      const angle = Math.random() * Math.PI * 2;
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(angle) * speed * (0.4 + Math.random() * 0.8),
        vy: Math.sin(angle) * speed * (0.4 + Math.random() * 0.8),
        // each node's own phase + slightly varied cycle length, so
        // the "rotation" never looks synchronized or mechanical
        depthPhase: Math.random() * Math.PI * 2,
        depthSpeed: (2 * Math.PI / DEPTH_PERIOD_MS) * (0.75 + Math.random() * 0.5)
      });
    }
  }

  let lastW = 0, lastH = 0;

  function resize() {
    const newW = window.innerWidth;
    const newH = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(newW * DPR);
    canvas.height = Math.round(newH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Mobile browsers fire 'resize' when the URL bar collapses or
    // reappears during scrolling — that only changes innerHeight by
    // ~50-100px, not the width. Rebuilding the whole particle field
    // on every one of those made the network visibly "reset" while
    // scrolling. Only a genuine width change (resize/orientation) or
    // a large height change earns a full rebuild; anything smaller
    // just resizes the canvas and clamps existing particles into the
    // new bounds, so the field keeps drifting undisturbed.
    const widthChanged = Math.abs(newW - lastW) > 1;
    const heightChangedALot = Math.abs(newH - lastH) > 150;

    W = newW; H = newH;

    if (!particles.length || widthChanged || heightChangedALot) {
      buildParticles();
    } else {
      for (const p of particles) {
        p.x = Math.min(p.x, W);
        p.y = Math.min(p.y, H);
      }
    }

    lastW = newW; lastH = newH;
  }

  let teal = { r: 74, g: 184, b: 200 };
  let gold = { r: 232, g: 180, b: 74 };
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
  }
  function readColors() {
    const cs = getComputedStyle(root);
    teal = hexToRgb(cs.getPropertyValue('--teal')) || teal;
    gold = hexToRgb(cs.getPropertyValue('--gold')) || gold;
  }

  let mouseX = -9999, mouseY = -9999, hasMouse = false;
  function onMove(x, y) { mouseX = x; mouseY = y; hasMouse = true; }
  window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('mouseleave', () => { hasMouse = false; });
  window.addEventListener('touchend', () => { hasMouse = false; });

  // Exactly one persistent loop, started once at the bottom of this
  // IIFE. `running` only gates the work done inside each tick — it
  // never stops or restarts the requestAnimationFrame chain itself,
  // so repeated tab-hide/show cycles can never stack extra loops on
  // top of each other (which is what was making the drift speed
  // creep upward the longer the page stayed open).
  let running = true;

  function frame(now) {
    if (running) {
      ctx.clearRect(0, 0, W, H);

      // drift + bounce off edges
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x <= 0 || p.x >= W) { p.vx *= -1; p.x = Math.max(0, Math.min(W, p.x)); }
        if (p.y <= 0 || p.y >= H) { p.vy *= -1; p.y = Math.max(0, Math.min(H, p.y)); }
        // smooth 0..1 "facing the viewer" value, drifting on its own clock
        p.depth = (Math.sin(now * p.depthSpeed + p.depthPhase) + 1) / 2;
      }

      // each node links to its nearest neighbor in each of several
      // compass sectors around it, rather than just its nearest few
      // by distance overall — this is what makes triangles close up
      // between neighboring nodes instead of the network drifting
      // into thin parallel chains, echoing how a real truss triangulates
      ctx.lineWidth = 1.5;
      const targetPairs = new Map(); // "i-j" (i<j) -> current distance, this frame's desired links
      const sectorSize = (Math.PI * 2) / LINK_SECTORS;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const bestBySector = new Array(LINK_SECTORS).fill(null); // [j, dist] nearest candidate per sector
        for (let j = 0; j < particles.length; j++) {
          if (j === i) continue;
          const b = particles[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= LINK_SEARCH_DIST) continue;
          const angle = Math.atan2(dy, dx) + Math.PI; // 0..2π
          const sector = Math.min(LINK_SECTORS - 1, Math.floor(angle / sectorSize));
          const current = bestBySector[sector];
          if (!current || dist < current[1]) bestBySector[sector] = [j, dist];
        }
        for (const cand of bestBySector) {
          if (!cand) continue;
          const [j, dist] = cand;
          const key = i < j ? i + '-' + j : j + '-' + i;
          if (!targetPairs.has(key)) targetPairs.set(key, dist);
        }
      }

      // union of pairs currently fading in, holding steady, or fading
      // out — ease each one's strength toward 1 (wants to be linked)
      // or 0 (no longer a neighbor) rather than snapping
      const allKeys = new Set([...linkState.keys(), ...targetPairs.keys()]);
      for (const key of allKeys) {
        const cur = linkState.get(key) || 0;
        const target = targetPairs.has(key) ? 1 : 0;
        const next = cur + (target - cur) * LINK_FADE_RATE;
        if (next < 0.01 && target === 0) {
          linkState.delete(key); // fully faded out — stop tracking it
        } else {
          linkState.set(key, next);
        }
      }

      for (const [key, strength] of linkState) {
        const [i, j] = key.split('-').map(Number);
        const a = particles[i], b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximity = Math.max(0, 1 - dist / LINK_SEARCH_DIST);
        const facing = (a.depth + b.depth) / 2;
        const eased = facing * facing * (3 - 2 * facing); // smoothstep
        const alpha = strength * proximity * (0.16 + eased * 0.5);
        if (alpha < 0.003) continue;
        ctx.strokeStyle = `rgba(${teal.r},${teal.g},${teal.b},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // load pulse — a small bright dot traveling one currently-solid
      // link end to end, like a force finding its path through a truss
      if (!pulse && now >= nextPulseAt) {
        const strong = [];
        for (const [key, strength] of linkState) {
          if (strength >= PULSE_MIN_STRENGTH) strong.push(key);
        }
        if (strong.length) {
          const key = strong[Math.floor(Math.random() * strong.length)];
          const [i, j] = key.split('-').map(Number);
          const [from, to] = Math.random() < 0.5 ? [i, j] : [j, i];
          pulse = { from, to, start: now };
        } else {
          nextPulseAt = now + 400; // nothing solid enough yet — check again shortly
        }
      }
      if (pulse) {
        const a = particles[pulse.from], b = particles[pulse.to];
        const t = (now - pulse.start) / PULSE_DURATION_MS;
        if (!a || !b || t >= 1) {
          pulse = null;
          const [gapMin, gapMax] = PULSE_GAP_MS;
          nextPulseAt = now + gapMin + Math.random() * (gapMax - gapMin);
        } else {
          const eased = t * t * (3 - 2 * t); // smoothstep along the travel
          const px = a.x + (b.x - a.x) * eased;
          const py = a.y + (b.y - a.y) * eased;
          const fade = Math.sin(Math.PI * t); // eases in, peaks mid-travel, eases out
          ctx.beginPath();
          ctx.fillStyle = `rgba(${gold.r},${gold.g},${gold.b},${0.85 * fade})`;
          ctx.arc(px, py, 2 + fade * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // cursor "pull" — live gold links from nearby nodes back to the
      // pointer, always at full brightness so the interaction stays clear
      if (hasMouse) {
        for (const p of particles) {
          const dx = p.x - mouseX, dy = p.y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= MOUSE_DIST) continue;
          const k = 1 - dist / MOUSE_DIST;
          ctx.strokeStyle = `rgba(${gold.r},${gold.g},${gold.b},${k * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouseX, mouseY);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(frame);
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
  });

  // Re-read teal/gold whenever Blueprint ⇄ As-Built mode is toggled,
  // since those custom properties change value on <html class>.
  new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ['class'] });

  readColors();
  resize();
  requestAnimationFrame(frame);
})();