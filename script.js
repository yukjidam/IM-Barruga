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

/* ══════════════════════════════════════════════════
   BEAM LAB
   A real linear-elastic beam solver running in the page,
   drawn as a drafting sheet: elevation, shear force
   diagram, bending moment diagram, deflected shape.

   Nothing here is a canned illustration. Every frame:
     1. reactions are resolved for the chosen end
        conditions - statically for the simply supported
        and cantilever cases, from the standard fixed-end
        moment expressions (superposed for P and w) for
        the doubly built-in case;
     2. V(x) and M(x) are evaluated station by station
        with an extra pair of stations either side of the
        point load so the shear jump renders as a clean
        vertical step rather than a slope;
     3. the elastic curve is obtained by integrating
        M/EI twice with the trapezoidal rule, then fitting
        the integration constants to the end conditions
        (theta0 solved from y(L)=0 when simply supported,
        both constants zero when built in at the left).

   Integrating numerically rather than pasting in a
   closed-form deflection formula is what lets one code
   path serve every combination of span, load position,
   UDL and end condition without special cases.

   Colours all come from the shared --teal / --gold /
   --text tokens via CSS classes, so the whole sheet
   follows Blueprint ⇄ As-Built without any JS.
   ══════════════════════════════════════════════════ */
(function () {
  const svg = document.getElementById('bl-svg');
  if (!svg) return;
  const plot = document.getElementById('bl-plot');
  const dwgEl = document.getElementById('bl-dwg');
  const hint = document.getElementById('bl-hint');
  const $ = id => document.getElementById(id);

  // 300 x 500 rectangular RC section, f'c = 21 MPa.
  // E = 4700*sqrt(f'c) MPa (NSCP / ACI), converted to kN/m².
  const E = 4700 * Math.sqrt(21) * 1000;
  const Iner = 0.30 * Math.pow(0.50, 3) / 12;
  const EI = E * Iner;                      // ≈ 67 306 kN·m²

  // sheet geometry (viewBox units)
  const X0 = 110, X1 = 812;
  const BY = 150;                           // beam baseline
  const SZ = 316, MZ = 458, AMP = 56;       // diagram zero lines + half heights

  const SUP_NAME = { ss: 'Simply Supported', cant: 'Cantilever', ff: 'Fixed \u2013 Fixed' };

  let sup = 'ss';
  let L = 6, P = 30, w = 12, aFrac = 0.5;

  const fmt = (v, d) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(d);
  const sx = xm => X0 + (xm / L) * (X1 - X0);

  // ---------------------------------------------------------------- solver
  function solve() {
    const a = aFrac * L, b = L - a;
    let RA = 0, RB = 0, MA = 0;

    if (sup === 'ss') {
      RB = (P * a + w * L * L / 2) / L;
      RA = P + w * L - RB;
    } else if (sup === 'cant') {
      RA = P + w * L;
      MA = -(P * a + w * L * L / 2);
    } else {
      RA = (L ? P * b * b * (L + 2 * a) / (L * L * L) : 0) + w * L / 2;
      RB = (L ? P * a * a * (L + 2 * b) / (L * L * L) : 0) + w * L / 2;
      MA = -(L ? P * a * b * b / (L * L) : 0) - w * L * L / 12;
    }

    // stations, doubled either side of the point load
    const N = 260, xs = [];
    for (let i = 0; i <= N; i++) xs.push(i * L / N);
    if (a > 1e-6 && a < L - 1e-6) xs.push(a - 1e-7, a + 1e-7);
    xs.sort((p, q) => p - q);

    const V = [], M = [];
    for (const x of xs) {
      V.push(RA - w * x - (x > a ? P : 0));
      M.push(MA + RA * x - w * x * x / 2 - (x > a ? P * (x - a) : 0));
    }

    // elastic curve: EI y'' = M, integrated twice
    const n = xs.length - 1;
    const th = [0], y = [0];
    for (let i = 1; i <= n; i++) {
      const h = xs[i] - xs[i - 1];
      th.push(th[i - 1] + (M[i] + M[i - 1]) / (2 * EI) * h);
    }
    for (let i = 1; i <= n; i++) {
      const h = xs[i] - xs[i - 1];
      y.push(y[i - 1] + (th[i] + th[i - 1]) / 2 * h);
    }
    if (sup === 'ss' && L > 0) {
      const c = -y[n] / L;                  // rotation at A that closes y(L) = 0
      for (let i = 0; i <= n; i++) y[i] += c * xs[i];
    }

    let vMax = 0, mMax = 0, dMax = 0, dAt = 0;
    for (let i = 0; i <= n; i++) {
      if (Math.abs(V[i]) > Math.abs(vMax)) vMax = V[i];
      if (Math.abs(M[i]) > Math.abs(mMax)) mMax = M[i];
      if (Math.abs(y[i]) > Math.abs(dMax)) { dMax = y[i]; dAt = xs[i]; }
    }
    return { a, RA, RB, MA, xs, V, M, y, n, vMax, mMax, dMax, dAt };
  }

  // ---------------------------------------------------------------- drawing
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const txt = (x, y, s, cls, anchor) =>
    `<text x="${x}" y="${y}" class="${cls || 'bl-lab'}" text-anchor="${anchor || 'start'}">${esc(s)}</text>`;
  // same, but the caller supplies markup (used for true subscripts - no Unicode
  // subscript exists for 'b', and the ones that do are missing from most webfonts)
  const txtRaw = (x, y, s, cls, anchor) =>
    `<text x="${x}" y="${y}" class="${cls || 'bl-lab'}" text-anchor="${anchor || 'start'}">${s}</text>`;
  const sub = (base, s) => base + `<tspan dy="3" font-size="8">${s}</tspan><tspan dy="-3">\u2009</tspan>`;
  const line = (x1, y1, x2, y2, cls) =>
    `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}"/>`;
  const headDown = (x, y, cls) =>
    `<polygon points="${x.toFixed(1)},${y} ${(x - 4.5).toFixed(1)},${y - 11} ${(x + 4.5).toFixed(1)},${y - 11}" class="${cls}"/>`;
  const headUp = (x, y, cls) =>
    `<polygon points="${x.toFixed(1)},${y} ${(x - 4.5).toFixed(1)},${y + 11} ${(x + 4.5).toFixed(1)},${y + 11}" class="${cls}"/>`;

  function ground(x, yTop, halfWidth) {
    let s = line(x - halfWidth, yTop, x + halfWidth, yTop, 'bl-grnd');
    for (let t = -halfWidth; t < halfWidth; t += 7) {
      s += line(x + t, yTop + 7, x + t + 6, yTop, 'bl-grnd');
    }
    return s;
  }

  function pinSupport(x) {
    return `<polygon points="${x},${BY} ${x - 13},${BY + 20} ${x + 13},${BY + 20}" class="bl-sup"/>`
      + ground(x, BY + 20, 22);
  }
  function rollerSupport(x) {
    let s = `<polygon points="${x},${BY} ${x - 13},${BY + 14} ${x + 13},${BY + 14}" class="bl-sup"/>`;
    for (const d of [-8, 0, 8]) s += `<circle cx="${x + d}" cy="${BY + 17.5}" r="3.4" class="bl-sup"/>`;
    return s + ground(x, BY + 21, 22);
  }
  function fixedSupport(x, dir) {
    let s = line(x, BY - 26, x, BY + 26, 'bl-sup');
    for (let t = -26; t < 26; t += 7) s += line(x, BY + t + 6, x + dir * 7, BY + t, 'bl-grnd');
    return s;
  }

  function diagram(xs, vals, zero, cls, unit, label) {
    let peak = 0;
    for (const v of vals) peak = Math.max(peak, Math.abs(v));
    const k = peak > 1e-9 ? AMP / peak : 0;
    let d = `M ${sx(xs[0]).toFixed(1)} ${zero}`;
    for (let i = 0; i < xs.length; i++) {
      d += ` L ${sx(xs[i]).toFixed(1)} ${(zero - vals[i] * k).toFixed(1)}`;
    }
    d += ` L ${sx(xs[xs.length - 1]).toFixed(1)} ${zero} Z`;

    // peak annotation
    let pi = 0;
    for (let i = 0; i < vals.length; i++) if (Math.abs(vals[i]) > Math.abs(vals[pi])) pi = i;
    const px = sx(xs[pi]), py = zero - vals[pi] * k;
    const above = vals[pi] >= 0;

    return `<path d="${d}" class="${cls}"/>`
      + line(X0 - 10, zero, X1 + 10, zero, 'bl-axis')
      + txt(X0, zero - AMP - 22, label, 'bl-lab')
      + (peak > 1e-9
        ? line(px, py, px, zero, 'bl-tick')
          + txt(px, above ? py - 8 : py + 15,
                fmt(vals[pi], Math.abs(vals[pi]) < 100 ? 2 : 1) + ' ' + unit, 'bl-val', 'middle')
        : '');
  }

  function render() {
    const r = solve();
    const aX = sx(r.a);
    let s = '';

    /* ── span dimension ───────────────────────────── */
    s += line(sx(0), 20, sx(0), 34, 'bl-tick')
      + line(sx(L), 20, sx(L), 34, 'bl-tick')
      + line(sx(0), 27, sx(L), 27, 'bl-axis')
      + txt((sx(0) + sx(L)) / 2, 17, 'L = ' + fmt(L, 2) + ' m', 'bl-lab', 'middle');

    /* ── distributed load ─────────────────────────── */
    if (w > 0.01) {
      s += line(sx(0), BY - 46, sx(L), BY - 46, 'bl-udl');
      const steps = Math.max(4, Math.round((sx(L) - sx(0)) / 52));
      for (let i = 0; i <= steps; i++) {
        const x = sx(0) + (sx(L) - sx(0)) * i / steps;
        s += line(x, BY - 46, x, BY - 9, 'bl-udl') + headDown(x, BY - 7, 'bl-udl');
      }
      s += txt(sx(L), BY - 54, 'w = ' + fmt(w, 1) + ' kN/m', 'bl-lab', 'end');
    }

    /* ── beam + end conditions ────────────────────── */
    s += line(sx(0), BY, sx(L), BY, 'bl-beam');
    if (sup === 'ss') s += pinSupport(sx(0)) + rollerSupport(sx(L));
    else if (sup === 'cant') s += fixedSupport(sx(0), -1);
    else s += fixedSupport(sx(0), -1) + fixedSupport(sx(L), 1);

    /* ── deflected shape ──────────────────────────── */
    let dPeak = 0;
    for (const v of r.y) dPeak = Math.max(dPeak, Math.abs(v));
    const dk = dPeak > 1e-12 ? 30 / dPeak : 0;
    let dPath = '';
    for (let i = 0; i <= r.n; i++) {
      dPath += (i ? ' L ' : 'M ') + sx(r.xs[i]).toFixed(1) + ' ' + (BY - r.y[i] * dk).toFixed(1);
    }
    s += `<path d="${dPath}" class="bl-defl"/>`;
    if (dPeak > 1e-12) {
      // how many times larger than true scale the elastic curve is drawn
      const exagg = Math.max(1, Math.round(dk / ((X1 - X0) / L)));
      s += txt(X1, 17, 'DEFLECTION \u00d7' + exagg, 'bl-lab', 'end');
    }

    /* ── point load (draggable) ───────────────────── */
    if (P > 0.01) {
      s += line(aX, BY - 92, aX, BY - 9, 'bl-load') + headDown(aX, BY - 6, 'bl-load')
        + txt(aX, BY - 100, 'P = ' + fmt(P, 1) + ' kN', 'bl-val', 'middle');
    }
    s += `<circle cx="${aX.toFixed(1)}" cy="${BY - 92}" r="18" class="bl-handle-hit" id="bl-hit"/>`
      + `<circle cx="${aX.toFixed(1)}" cy="${BY - 92}" r="6.5" class="bl-handle" id="bl-handle"`
      + ` tabindex="0" role="slider" aria-label="Load position along the span"`
      + ` aria-valuemin="0" aria-valuemax="${fmt(L, 2)}" aria-valuenow="${fmt(r.a, 2)}"`
      + ` aria-valuetext="${fmt(r.a, 2)} metres from the left support"/>`;

    /* ── reactions ────────────────────────────────── */
    const rxn = (x, val, tag) => line(x, BY + 56, x, BY + 32, 'bl-rxn') + headUp(x, BY + 30, 'bl-rxn')
      + txtRaw(x, BY + 70, sub('R', tag) + '= ' + fmt(Math.abs(val), 1) + ' kN', 'bl-lab', 'middle');
    s += rxn(sx(0), r.RA, 'A');
    if (sup !== 'cant') s += rxn(sx(L), r.RB, 'B');

    /* ── diagrams ─────────────────────────────────── */
    s += diagram(r.xs, r.V, SZ, 'bl-shear', 'kN', 'SHEAR FORCE  V(x)');
    s += diagram(r.xs, r.M, MZ, 'bl-moment', 'kN\u00b7m', 'BENDING MOMENT  M(x)');

    plot.innerHTML = s;
    bindHandle();
    readout(r);
  }

  // ---------------------------------------------------------------- readout
  function readout(r) {
    dwgEl.textContent = 'DWG-S-BM01 \u00b7 ' + SUP_NAME[sup];
    if (sup === 'cant') {
      $('bl-r1-lab').innerHTML = 'R<sub>A</sub>';
      $('bl-r2-lab').innerHTML = 'M<sub>A</sub> (fixed end)';
      $('bl-r1').textContent = fmt(r.RA, 2) + ' kN';
      $('bl-r2').textContent = fmt(r.MA, 2) + ' kN\u00b7m';
    } else {
      $('bl-r1-lab').innerHTML = 'R<sub>A</sub>';
      $('bl-r2-lab').innerHTML = 'R<sub>B</sub>';
      $('bl-r1').textContent = fmt(r.RA, 2) + ' kN';
      $('bl-r2').textContent = fmt(r.RB, 2) + ' kN';
    }
    $('bl-v').textContent = fmt(Math.abs(r.vMax), 2) + ' kN';
    $('bl-m').textContent = fmt(Math.abs(r.mMax), 2) + ' kN\u00b7m';

    const dmm = Math.abs(r.dMax) * 1000;
    const lim = L * 1000 / 360;
    $('bl-d').textContent = fmt(dmm, 2) + ' mm @ ' + fmt(r.dAt, 2) + ' m';
    $('bl-lim').textContent = fmt(lim, 2) + ' mm';

    const chk = $('bl-check');
    const pass = dmm <= lim;
    chk.textContent = pass
      ? 'SERVICEABILITY OK \u00b7 \u03b4 = L/' + (dmm > 1e-6 ? Math.round(L * 1000 / dmm) : '\u221e')
      : 'EXCEEDS L/360 \u00b7 \u03b4 = L/' + Math.round(L * 1000 / dmm);
    chk.classList.toggle('is-pass', pass);
    chk.classList.toggle('is-fail', !pass);
  }

  // ---------------------------------------------------------------- input
  function setA(frac) {
    aFrac = Math.max(0, Math.min(1, frac));
    $('bl-a').value = aFrac;
    $('bl-a-out').textContent = fmt(aFrac * L, 2) + ' m';
    render();
  }

  function fracFromClientX(clientX) {
    const box = svg.getBoundingClientRect();
    if (!box.width) return aFrac;
    const vx = (clientX - box.left) / box.width * 900;   // client px -> viewBox units
    return (vx - X0) / (X1 - X0);
  }

  let dragging = false;
  function bindHandle() {
    const hit = $('bl-hit'), knob = $('bl-handle');
    const down = e => {
      dragging = true;
      if (hint) hint.classList.add('is-hidden');
      if (e.cancelable) e.preventDefault();
      setA(fracFromClientX(e.touches ? e.touches[0].clientX : e.clientX));
    };
    hit.addEventListener('mousedown', down);
    knob.addEventListener('mousedown', down);
    hit.addEventListener('touchstart', down, { passive: false });
    knob.addEventListener('touchstart', down, { passive: false });
    knob.addEventListener('keydown', e => {
      const step = (e.shiftKey ? 10 : 1) / 100;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setA(aFrac - step); e.preventDefault(); $('bl-handle').focus(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setA(aFrac + step); e.preventDefault(); $('bl-handle').focus(); }
      else if (e.key === 'Home') { setA(0); e.preventDefault(); $('bl-handle').focus(); }
      else if (e.key === 'End') { setA(1); e.preventDefault(); $('bl-handle').focus(); }
    });
  }

  window.addEventListener('mousemove', e => { if (dragging) setA(fracFromClientX(e.clientX)); });
  window.addEventListener('touchmove', e => {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    setA(fracFromClientX(e.touches[0].clientX));
  }, { passive: false });
  const up = () => { dragging = false; };
  window.addEventListener('mouseup', up);
  window.addEventListener('touchend', up);
  window.addEventListener('touchcancel', up);

  document.querySelectorAll('.bl-seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sup = btn.dataset.sup;
      document.querySelectorAll('.bl-seg-btn').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      render();
    });
  });

  $('bl-L').addEventListener('input', e => {
    L = parseFloat(e.target.value);
    $('bl-L-out').textContent = fmt(L, 2) + ' m';
    $('bl-a-out').textContent = fmt(aFrac * L, 2) + ' m';
    render();
  });
  $('bl-P').addEventListener('input', e => {
    P = parseFloat(e.target.value);
    $('bl-P-out').textContent = fmt(P, 1) + ' kN';
    render();
  });
  $('bl-w').addEventListener('input', e => {
    w = parseFloat(e.target.value);
    $('bl-w-out').textContent = fmt(w, 1) + ' kN/m';
    render();
  });
  $('bl-a').addEventListener('input', e => {
    if (hint) hint.classList.add('is-hidden');
    setA(parseFloat(e.target.value));
  });

  render();
})();

/* ══════════════════════════════════════════════════
   BLUEPRINT LAB
   A drag-and-drop plan sandbox. Walls are drawn with
   grid / endpoint / midpoint snapping and an ortho lock;
   doors and windows snap into the nearest wall and cut
   an opening; columns, stairs, fixtures and furniture
   drop anywhere. A quantity take-off updates live.

   The sheet's own CSS lives in this file (CSS below) so
   the PNG export can resolve the same rules against the
   current theme. All colours are the shared tokens, so
   Blueprint ⇄ As-Built works with no extra JS.
   ═══════════════════════════════════════ */
(function () {
  const svg = document.getElementById('cd-svg');
  if (!svg) return;
  const $ = id => document.getElementById(id);
  const canvas = $('cd-canvas'), sheet = $('cd-sheet'), ghost = $('cd-ghost');
  const KEY = 'bplab:v1';

  /* ── drawing styles (tokens resolved at export) ── */
  const CSS = `
.cd-gm{stroke:var(--border);stroke-width:1;fill:none}
.cd-gM{stroke:var(--muted);stroke-width:1;opacity:.28;fill:none}
.cd-wall{fill:var(--text)}
.cd-cut{fill:var(--bg)}
.cd-ln,.cd-tl,.cd-fx,.cd-col,.cd-sel,.cd-room,.cd-rub,.cd-pv{vector-effect:non-scaling-stroke}
.cd-ln{fill:none;stroke:var(--text);stroke-width:1.2}
.cd-tl{fill:none;stroke:var(--teal);stroke-width:1.2}
.cd-fx{fill:var(--surface2);stroke:var(--text);stroke-width:1.2}
.cd-col{fill:var(--gold);stroke:var(--gold);stroke-width:1}
.cd-room{fill:var(--teal-dim);stroke:var(--teal);stroke-width:1;stroke-dasharray:6 4}
.cd-room.on{stroke:var(--gold);stroke-width:1.6}
.cd-sel{fill:none;stroke:var(--gold);stroke-width:1.6}
.cd-hit{fill:transparent}
.cd-t{font:10px var(--f-mono);fill:var(--muted)}
.cd-tv{fill:var(--gold)}
.cd-rub{fill:none;stroke:var(--gold);stroke-width:1.4;stroke-dasharray:6 4}
.cd-pv{fill:var(--gold-dim);stroke:var(--gold);stroke-width:1.4;stroke-dasharray:4 3}
.cd-snap{fill:none;stroke:var(--teal);stroke-width:1.6}
.cd-cross{stroke:var(--teal);stroke-width:1;opacity:.35}
.cd-grip{fill:var(--bg);stroke:var(--gold);stroke-width:1.6;cursor:move}
.cd-bad{fill:#d9645c;font:10px var(--f-mono)}`;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  /* ── model ── */
  let S = { objs: [], id: 1, title: 'Untitled plan' };
  let view = { z: 0.09, x: 40, y: 40 };
  let sel = new Set(), tool = 'select', armed = null, chain = null, drag = null, dragP = null;
  let needFit = false;
  let hist = [], hi = -1, ortho = true, gridSnap = true, wallTh = 150, space = false, shift = false;
  let cur = { raw: [0, 0], p: [0, 0], snap: null, px: [-9, -9], on: false };

  const byId = id => S.objs.find(o => o.id === id);
  const wl = w => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (v, d) => v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const S2W = (x, y) => [(x - view.x) / view.z, (y - view.y) / view.z];

  /* ── symbols (local mm, centred on origin) ── */
  const R = (x, y, w, h, c) => `<rect class="${c || 'cd-fx'}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  const E = (cx, cy, rx, ry) => `<ellipse class="cd-fx" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
  const RR = (x, y, w, h, r, c) => `<rect class="${c || 'cd-fx'}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  const CI = (cx, cy, r, c) => `<circle class="${c || 'cd-fx'}" cx="${cx}" cy="${cy}" r="${r}"/>`;
  const PT = (d, c) => `<path class="${c || 'cd-ln'}" d="${d}"/>`;
  const SY = {
    column: { n: 'Column', w: 300, d: 300, f: () => R(-150, -150, 300, 300, 'cd-col') },
    stairs: { n: 'Stairs', w: 1000, d: 2800, f: () => {
      let s = R(-500, -1400, 1000, 2800);
      for (let i = 1; i < 10; i++) s += `<path class="cd-ln" d="M-500 ${-1400 + i * 280}H500"/>`;
      return s + `<path class="cd-tl" d="M0 1200V-1100M-160 -950L0 -1150L160 -950"/>`;
    } },
    wc: { n: 'Water closet', w: 420, d: 700, f: () => R(-210, -350, 420, 160) + E(0, 50, 190, 260) + E(0, 50, 135, 195) },
    lav: { n: 'Lavatory', w: 500, d: 420, f: () => R(-250, -210, 500, 420) + E(0, 25, 175, 125) + `<circle class="cd-tl" cx="0" cy="-150" r="20"/>` },
    bed: { n: 'Bed', w: 1500, d: 1900, f: () => R(-750, -950, 1500, 1900) + R(-750, -950, 1500, 90) + R(-650, -820, 570, 340) + R(80, -820, 570, 340) + `<path class="cd-ln" d="M-750 -150H750"/>` },
    table: { n: 'Dining table', w: 1500, d: 1500, f: () => R(-750, -400, 1500, 800) + R(-600, -750, 450, 400) + R(150, -750, 450, 400) + R(-600, 350, 450, 400) + R(150, 350, 450, 400) },
    sofa: { n: 'Sofa', w: 2000, d: 900, f: () => R(-1000, -450, 2000, 900) + R(-1000, -450, 2000, 150) + R(-1000, -300, 150, 750) + R(850, -300, 150, 750) + `<path class="cd-ln" d="M-333 -300V450M333 -300V450"/>` },
    colround: { n: 'Round column', w: 300, d: 300, f: () => CI(0, 0, 150, 'cd-col') },
    footing: { n: 'Footing', w: 1200, d: 1200, f: () => R(-600, -600, 1200, 1200) + R(-150, -150, 300, 300, 'cd-col') },
    elev: { n: 'Elevator', w: 1800, d: 1800, f: () => R(-900, -900, 1800, 1800) + R(-700, -700, 1400, 1400) + PT('M-700 -700L700 700M700 -700L-700 700') },
    spiral: { n: 'Spiral stairs', w: 1800, d: 1800, f: () => {
      let s = CI(0, 0, 900) + CI(0, 0, 120);
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, c = Math.cos(a), n = Math.sin(a); s += PT(`M${(120 * c).toFixed(1)} ${(120 * n).toFixed(1)}L${(900 * c).toFixed(1)} ${(900 * n).toFixed(1)}`); }
      return s;
    } },
    shower: { n: 'Shower', w: 900, d: 900, f: () => R(-450, -450, 900, 900) + PT('M-450 -450L450 450', 'cd-tl') + CI(0, 0, 40) },
    tub: { n: 'Bathtub', w: 1700, d: 750, f: () => R(-850, -375, 1700, 750) + RR(-780, -305, 1560, 610, 220) + CI(-660, 0, 28, 'cd-tl') },
    sink: { n: 'Kitchen sink', w: 1200, d: 600, f: () => R(-600, -300, 1200, 600) + RR(-540, -220, 480, 400, 30) + RR(60, -220, 480, 400, 30) + CI(0, -255, 20, 'cd-tl') },
    stove: { n: 'Range / stove', w: 600, d: 600, f: () => R(-300, -300, 600, 600) + CI(-150, -150, 80) + CI(150, -150, 80) + CI(-150, 150, 80) + CI(150, 150, 80) },
    fridge: { n: 'Refrigerator', w: 700, d: 700, f: () => R(-350, -350, 700, 700) + PT('M-350 -120H350') + PT('M250 -250V-190M250 -80V-20', 'cd-tl') },
    counter: { n: 'Counter', w: 2400, d: 600, f: () => R(-1200, -300, 2400, 600) + PT('M-1200 -230H1200', 'cd-tl') },
    washer: { n: 'Washer', w: 600, d: 600, f: () => R(-300, -300, 600, 600) + CI(0, 40, 200) + CI(0, 40, 130, 'cd-tl') + CI(-190, -220, 22, 'cd-tl') },
    bedS: { n: 'Single bed', w: 900, d: 1900, f: () => R(-450, -950, 900, 1900) + R(-450, -950, 900, 90) + R(-360, -820, 720, 340) + PT('M-450 -150H450') },
    wardrobe: { n: 'Wardrobe', w: 1200, d: 600, f: () => R(-600, -300, 1200, 600) + PT('M-600 -220H600M0 -220V300') + PT('M-600 300L-300 -220L0 300M0 300L300 -220L600 300', 'cd-tl') },
    nightstand: { n: 'Nightstand', w: 450, d: 450, f: () => R(-225, -225, 450, 450) + CI(0, 0, 110, 'cd-tl') },
    desk: { n: 'Desk + chair', w: 1400, d: 1200, f: () => R(-700, -600, 1400, 700) + PT('M-700 -520H700', 'cd-tl') + RR(-225, 180, 450, 420, 60) },
    chair: { n: 'Chair', w: 450, d: 450, f: () => R(-225, -225, 450, 450) + R(-225, -225, 450, 90) },
    armchair: { n: 'Armchair', w: 900, d: 900, f: () => R(-450, -450, 900, 900) + R(-450, -450, 900, 160) + R(-450, -290, 140, 740) + R(310, -290, 140, 740) },
    coffee: { n: 'Coffee table', w: 1100, d: 600, f: () => RR(-550, -300, 1100, 600, 40) + RR(-480, -230, 960, 460, 20, 'cd-tl') },
    tv: { n: 'TV stand', w: 1500, d: 450, f: () => R(-750, -225, 1500, 450) + R(-450, -140, 900, 60, 'cd-col') },
    rtable: { n: 'Round table', w: 1800, d: 1800, f: () => CI(0, 0, 500) + CI(0, -700, 200) + CI(700, 0, 200) + CI(0, 700, 200) + CI(-700, 0, 200) },
    car: { n: 'Car', w: 1800, d: 4500, f: () => RR(-900, -2250, 1800, 4500, 320) + PT('M-720 -1250H720L800 -650H-800Z') + PT('M-720 1450H720L800 850H-800Z') + PT('M-800 -650V850M800 -650V850') },
    plant: { n: 'Plant', w: 500, d: 500, f: () => CI(0, 0, 250) + PT('M0 -250V250M-250 0H250M-177 -177L177 177M177 -177L-177 177', 'cd-tl') },
    ac: { n: 'Split A/C', w: 1000, d: 300, f: () => R(-500, -150, 1000, 300) + PT('M-500 60H500') + PT('M-420 105H420', 'cd-tl') }
  };
  /* wall openings: default width (mm), height for the take-off (m), door? */
  const OP = {
    door: { n: 'Door', w: 900, h: 2.1, min: 600, dr: 1 },
    ddoor: { n: 'Double door', w: 1500, h: 2.1, min: 1200, dr: 1 },
    sdoor: { n: 'Sliding door', w: 1800, h: 2.1, min: 1200, dr: 1 },
    window: { n: 'Window', w: 1200, h: 1.2, min: 600 },
    fwin: { n: 'Fixed window', w: 1800, h: 1.2, min: 600 }
  };
  const PAL = [...Object.keys(OP), 'column', 'colround', 'footing', 'stairs', 'spiral', 'elev', 'wc', 'lav', 'shower', 'tub', 'sink', 'stove', 'fridge', 'counter', 'washer',
    'bed', 'bedS', 'nightstand', 'wardrobe', 'desk', 'chair', 'table', 'rtable', 'sofa', 'armchair', 'coffee', 'tv', 'ac', 'plant', 'car'];
  const NAME = Object.assign(Object.fromEntries(Object.entries(OP).map(([k, v]) => [k, v.n])), Object.fromEntries(Object.entries(SY).map(([k, v]) => [k, v.n])));

  function openSVG(o, th) {
    const W = o.w, h = th / 2, hs = o.hs || 1, sd = o.side || 1;
    let s = `<rect class="cd-cut" x="${-W / 2}" y="${-h - 2}" width="${W}" height="${th + 4}"/>`;
    const jamb = `<path class="cd-ln" d="M${-W / 2} ${-h}V${h}M${W / 2} ${-h}V${h}"/>`;
    const leaf = (x0, dir, r) => `<path class="cd-ln" d="M${x0} 0V${sd * r}"/><path class="cd-tl" d="M${x0} ${sd * r}A${r} ${r} 0 0 ${sd * dir < 0 ? 1 : 0} ${x0 + dir * r} 0"/>`;
    if (o.k === 'door') s += jamb + leaf(-hs * W / 2, hs, W);
    else if (o.k === 'ddoor') s += jamb + leaf(-W / 2, 1, W / 2) + leaf(W / 2, -1, W / 2);
    else if (o.k === 'sdoor') {
      const t = th / 3, pw = W / 2 + W / 16, y1 = hs > 0 ? -1.5 * t : 0.5 * t, y2 = hs > 0 ? 0.5 * t : -1.5 * t;
      s += jamb + `<rect class="cd-tl" x="${-W / 2}" y="${y1}" width="${pw}" height="${t}"/><rect class="cd-tl" x="${W / 2 - pw}" y="${y2}" width="${pw}" height="${t}"/>`;
    } else if (o.k === 'fwin') {
      s += `<rect class="cd-tl" x="${-W / 2}" y="${-h}" width="${W}" height="${th}"/><path class="cd-tl" d="M${-W / 2} 0H${W / 2}"/>`;
    } else {
      s += `<rect class="cd-tl" x="${-W / 2}" y="${-h}" width="${W}" height="${th}"/>`
        + `<path class="cd-tl" d="M${-W / 2} ${-th / 6}H${W / 2}M${-W / 2} ${th / 6}H${W / 2}"/>`;
    }
    return s;
  }

  /* palette thumbnails reuse the real drawing code */
  function icon(k) {
    if (OP[k]) {
      const o = { k, w: Math.min(OP[k].w, 1500), side: 1, hs: 1 };
      return `<svg viewBox="-800 -250 1600 1250" aria-hidden="true">${R(-800, -75, 1600, 150, 'cd-wall')}${openSVG(o, 150)}</svg>`;
    }
    const s = SY[k], p = 60;
    return `<svg viewBox="${-s.w / 2 - p} ${-s.d / 2 - p} ${s.w + 2 * p} ${s.d + 2 * p}" aria-hidden="true">${s.f()}</svg>`;
  }
  $('cd-pal').innerHTML = PAL.map(k => `<button type="button" class="cd-pal-item" data-k="${k}" aria-label="${NAME[k]}">${icon(k)}<span>${NAME[k]}</span></button>`).join('');

  /* ── geometry helpers ── */
  function oPos(o) {
    const w = byId(o.wall);
    if (!w) return null;
    const L = wl(w) || 1, ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, h = o.w / 2 / L;
    const s = h >= 0.5 ? 0.5 : Math.min(1 - h, Math.max(h, o.s));
    return { x: w.a[0] + ux * L * s, y: w.a[1] + uy * L * s, ang: Math.atan2(uy, ux) * 180 / Math.PI, th: w.th };
  }
  function hostAt(p, maxPx) {
    let best = null;
    for (const w of S.objs) {
      if (w.t !== 'wall') continue;
      const L = wl(w);
      if (L < 1) continue;
      const ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, rx = p[0] - w.a[0], ry = p[1] - w.a[1];
      const t = Math.max(0, Math.min(L, rx * ux + ry * uy));
      const d = Math.hypot(rx - ux * t, ry - uy * t) * view.z;
      if (d < maxPx && (!best || d < best.d)) best = { w, d, s: Math.round(t / 50) * 50 / L, side: (rx * -uy + ry * ux) >= 0 ? 1 : -1 };
    }
    return best;
  }
  function wallPoly(w, pad) {
    const L = wl(w) || 1, ux = (w.b[0] - w.a[0]) / L, uy = (w.b[1] - w.a[1]) / L, e = w.th / 2 + pad;
    const nx = -uy * e, ny = ux * e, ex = ux * e, ey = uy * e;
    return [[w.a[0] - ex + nx, w.a[1] - ey + ny], [w.b[0] + ex + nx, w.b[1] + ey + ny], [w.b[0] + ex - nx, w.b[1] + ey - ny], [w.a[0] - ex - nx, w.a[1] - ey - ny]]
      .map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  }
  function bounds() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const add = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const o of S.objs) {
      if (o.t === 'wall') { add(o.a[0], o.a[1], o.th); add(o.b[0], o.b[1], o.th); }
      else if (o.t === 'room') { add(o.x, o.y, 0); add(o.x + o.w, o.y + o.h, 0); }
      else if (o.t === 'sym') add(o.x, o.y, Math.max(SY[o.k].w, SY[o.k].d) / 2);
    }
    return x0 > x1 ? null : { x0, y0, x1, y1 };
  }

  /* ── snapping ── */
  function snapPt(raw) {
    const tol = 12 / view.z;
    let best = null, bd = tol;
    for (const o of S.objs) {
      if (o.t !== 'wall') continue;
      const mid = [(o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2];
      for (const [pt, kind] of [[o.a, 'end'], [o.b, 'end'], [mid, 'mid']]) {
        const d = Math.hypot(pt[0] - raw[0], pt[1] - raw[1]);
        if (d < bd) { bd = d; best = { p: pt.slice(), kind }; }
      }
    }
    if (best) return best;
    let p = gridSnap ? [Math.round(raw[0] / 100) * 100, Math.round(raw[1] / 100) * 100] : raw.slice();
    if (chain && (ortho !== shift)) {
      if (Math.abs(p[0] - chain.a[0]) >= Math.abs(p[1] - chain.a[1])) p[1] = chain.a[1]; else p[0] = chain.a[0];
    }
    return { p, kind: null };
  }

  /* ── scene (shared by the live view and the PNG export) ── */
  function scene(v, ex) {
    const z = v.z, T = (x, y) => [x * z + v.x, y * z + v.y];
    let rooms = '', walls = '', ops = '', syms = '', txt = '';
    for (const o of S.objs) {
      const on = !ex && sel.has(o.id);
      if (o.t === 'room') {
        rooms += `<g data-id="${o.id}"><rect class="cd-room${on ? ' on' : ''}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" pointer-events="stroke"/></g>`;
        const c = T(o.x + o.w / 2, o.y + o.h / 2);
        txt += `<text class="cd-t" data-id="${o.id}" x="${c[0]}" y="${c[1]}" text-anchor="middle">${esc(o.name)}</text>`
          + `<text class="cd-t cd-tv" data-id="${o.id}" x="${c[0]}" y="${c[1] + 13}" text-anchor="middle">${fmt(o.w * o.h / 1e6, 2)} m²</text>`;
      } else if (o.t === 'wall') {
        walls += `<g data-id="${o.id}"><polygon class="cd-hit" points="${wallPoly(o, 8 / z)}"/><polygon class="cd-wall" points="${wallPoly(o, 0)}"/>${on ? `<polygon class="cd-sel" points="${wallPoly(o, 0)}"/>` : ''}</g>`;
        if (on) {
          const m = T((o.a[0] + o.b[0]) / 2, (o.a[1] + o.b[1]) / 2);
          txt += `<text class="cd-t cd-tv" x="${m[0]}" y="${m[1] - 12}" text-anchor="middle">${fmt(wl(o), 0)}</text>`;
        }
      } else if (o.t === 'open') {
        const p = oPos(o);
        if (!p) continue;
        ops += `<g data-id="${o.id}" transform="translate(${p.x} ${p.y}) rotate(${p.ang})">${openSVG(o, p.th)}<rect class="cd-hit" x="${-o.w / 2}" y="${-p.th / 2 - 120}" width="${o.w}" height="${p.th + 240}"/>${on ? `<rect class="cd-sel" x="${-o.w / 2}" y="${-p.th / 2 - 40}" width="${o.w}" height="${p.th + 80}"/>` : ''}</g>`;
      } else if (o.t === 'sym') {
        const s = SY[o.k];
        syms += `<g data-id="${o.id}" transform="translate(${o.x} ${o.y}) rotate(${o.rot || 0})${o.fl ? ' scale(-1 1)' : ''}">${s.f()}<rect class="cd-hit" x="${-s.w / 2}" y="${-s.d / 2}" width="${s.w}" height="${s.d}"/>${on ? `<rect class="cd-sel" x="${-s.w / 2 - 40}" y="${-s.d / 2 - 40}" width="${s.w + 80}" height="${s.d + 80}"/>` : ''}</g>`;
      }
    }
    return `<g transform="translate(${v.x} ${v.y}) scale(${z})">${rooms}${walls}${ops}${syms}</g>${txt}`;
  }

  function paint() {
    const r = canvas.getBoundingClientRect(), w = r.width, h = r.height, z = view.z;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const stp = [100, 500, 1000, 5000].find(s => s * z >= 9) || 5000;
    let mi = '', ma = '';
    for (let x = Math.ceil(-view.x / z / stp) * stp; x * z + view.x <= w; x += stp) { const q = `M${(x * z + view.x).toFixed(1)} 0V${h}`; if (x % 1000) mi += q; else ma += q; }
    for (let y = Math.ceil(-view.y / z / stp) * stp; y * z + view.y <= h; y += stp) { const q = `M0 ${(y * z + view.y).toFixed(1)}H${w}`; if (y % 1000) mi += q; else ma += q; }
    let o = `<path class="cd-gm" d="${mi}"/><path class="cd-gM" d="${ma}"/>` + scene(view);
    const T = p => [p[0] * z + view.x, p[1] * z + view.y];
    let ov = '';

    if (chain) {
      const a = T(chain.a), b = T(cur.p), L = Math.hypot(cur.p[0] - chain.a[0], cur.p[1] - chain.a[1]);
      ov += `<line class="cd-rub" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`
        + `<text class="cd-t cd-tv" x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2 - 10}" text-anchor="middle">${fmt(L, 0)} mm</text>`;
    }
    if (drag && drag.t === 'room') {
      const a = T(drag.a), b = T(drag.b);
      ov += `<rect class="cd-rub" x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(a[0] - b[0])}" height="${Math.abs(a[1] - b[1])}"/>`
        + `<text class="cd-t cd-tv" x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2}" text-anchor="middle">${fmt(Math.abs(drag.a[0] - drag.b[0]) / 1000, 2)} × ${fmt(Math.abs(drag.a[1] - drag.b[1]) / 1000, 2)} m</text>`;
    }
    if (armed && cur.on) {
      const isO = !!OP[armed.k];
      if (isO) {
        const hs = hostAt(cur.raw, 40);
        if (hs) {
          const o2 = { k: armed.k, w: OP[armed.k].w, side: hs.side, hs: 1, wall: hs.w.id, s: hs.s }, p = oPos(o2);
          ov += `<g transform="translate(${view.x} ${view.y}) scale(${z})"><g opacity=".75" transform="translate(${p.x} ${p.y}) rotate(${p.ang})">${openSVG(o2, p.th)}<rect class="cd-pv" x="${-o2.w / 2}" y="${-p.th / 2 - 40}" width="${o2.w}" height="${p.th + 80}"/></g></g>`;
        } else {
          const c = cur.px;
          ov += `<text class="cd-bad" x="${c[0] + 14}" y="${c[1] - 10}">Drop on a wall</text>`;
        }
      } else {
        ov += `<g transform="translate(${view.x} ${view.y}) scale(${z})"><g opacity=".6" transform="translate(${cur.p[0]} ${cur.p[1]})">${SY[armed.k].f()}</g></g>`;
      }
    }
    if (cur.on && !armed && tool !== 'pan') {
      ov += `<line class="cd-cross" x1="${cur.px[0]}" y1="0" x2="${cur.px[0]}" y2="${h}"/><line class="cd-cross" x1="0" y1="${cur.px[1]}" x2="${w}" y2="${cur.px[1]}"/>`;
      const c = T(cur.p);
      if (cur.snap) ov += cur.snap === 'end'
        ? `<rect class="cd-snap" x="${c[0] - 6}" y="${c[1] - 6}" width="12" height="12"/>`
        : `<path class="cd-snap" d="M${c[0] - 7} ${c[1] + 5}H${c[0] + 7}L${c[0]} ${c[1] - 7}Z"/>`;
    }
    o += `<g pointer-events="none">${ov}</g>`;

    if (tool === 'select' && sel.size === 1) {
      const o1 = byId([...sel][0]);
      let gr = [];
      if (o1 && o1.t === 'wall') gr = [['a', o1.a], ['b', o1.b]];
      if (o1 && o1.t === 'room') gr = [[0, [o1.x, o1.y]], [1, [o1.x + o1.w, o1.y]], [2, [o1.x + o1.w, o1.y + o1.h]], [3, [o1.x, o1.y + o1.h]]];
      for (const [id, p] of gr) { const c = T(p); o += `<rect class="cd-grip" data-grip="${id}" data-id="${o1.id}" x="${c[0] - 5}" y="${c[1] - 5}" width="10" height="10"/>`; }
    }
    svg.innerHTML = o;
    $('cd-xy').textContent = cur.on ? `X ${fmt(cur.p[0], 0)}  Y ${fmt(cur.p[1], 0)} mm` : 'X —  Y —';
    $('cd-zoom').textContent = Math.round(z / 0.09 * 100) + '%';
  }
  let raf = 0;
  const draw = () => { raf || (raf = requestAnimationFrame(() => { raf = 0; paint(); })); };

  /* ── history, persistence, take-off ── */
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  function commit() {
    hist = hist.slice(0, hi + 1);
    hist.push(JSON.stringify(S));
    if (hist.length > 80) hist.shift();
    hi = hist.length - 1;
    save(); refresh();
  }
  function jump(d) {
    const n = hi + d;
    if (n < 0 || n >= hist.length) return;
    hi = n; S = JSON.parse(hist[hi]); sel.clear(); save(); refresh();
  }
  function takeoff() {
    let len = 0, area = 0, floor = 0, d = 0, wi = 0, c = 0;
    for (const o of S.objs) {
      if (o.t === 'wall') len += wl(o) / 1000;
      else if (o.t === 'room') floor += o.w * o.h / 1e6;
      else if (o.t === 'open' && byId(o.wall)) { const q = OP[o.k] || OP.window; if (q.dr) d++; else wi++; area -= o.w / 1000 * q.h; }
      else if (o.t === 'sym' && o.k === 'column') c++;
    }
    area += len * 3;
    $('cd-q-len').textContent = fmt(len, 2) + ' m';
    $('cd-q-wall').textContent = fmt(Math.max(0, area), 2) + ' m²';
    $('cd-q-floor').textContent = fmt(floor, 2) + ' m²';
    $('cd-q-door').textContent = d;
    $('cd-q-win').textContent = wi;
    $('cd-q-col').textContent = c + ' · ' + fmt(c * 0.09 * 3, 2) + ' m³';
  }
  function refresh() {
    takeoff(); props(); draw();
    $('cd-dwg').textContent = 'DWG-A-BP01 · ' + S.title;
    $('cd-undo').disabled = hi <= 0; $('cd-redo').disabled = hi >= hist.length - 1;
  }

  /* ── properties panel ── */
  function props() {
    const box = $('cd-props'), ids = [...sel], o = ids.length === 1 ? byId(ids[0]) : null;
    ['cd-rot', 'cd-fh', 'cd-fv'].forEach(id => { $(id).disabled = !ids.length; });
    if (!ids.length) { box.innerHTML = '<p class="bl-note" style="margin:0">Nothing selected. Click an object to edit it, or pick a tool.</p>'; return; }
    if (!o) { box.innerHTML = `<p class="bl-note" style="margin:0">${ids.length} objects selected. Drag to move, Rotate / Flip as a group, Delete to remove.</p>`; return; }
    const slider = (id, lab, min, max, step, val, unit) => `<label class="bl-ctl"><span class="bl-ctl-lab">${lab}<b id="${id}-o">${val} ${unit}</b></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
    let h = '';
    if (o.t === 'wall') h = `<div class="bl-ctl-lab" style="margin-bottom:8px">Wall length<b>${fmt(wl(o), 0)} mm</b></div>` + slider('cd-p-th', 'Thickness', 100, 300, 50, o.th, 'mm');
    else if (o.t === 'open') h = slider('cd-p-w', NAME[o.k] + ' width', (OP[o.k] || OP.window).min, 3000, 100, o.w, 'mm') + '<p class="bl-note" style="margin:0">Flip (F) swaps the hinge side. Rotate (R) swaps the swing side.</p>';
    else if (o.t === 'room') h = `<label class="bl-ctl"><span class="bl-ctl-lab">Room name</span><input type="text" class="cd-text" id="cd-p-name" maxlength="28" value="${esc(o.name)}"></label><div class="bl-ctl-lab">Area<b>${fmt(o.w * o.h / 1e6, 2)} m²</b></div>`;
    else h = `<div class="bl-ctl-lab" style="margin-bottom:8px">${NAME[o.k]}<b>${o.w} × ${o.d || SY[o.k].d} mm</b></div><p class="bl-note" style="margin:0">Rotate (R) turns it 90°. Flip (F) mirrors it.</p>`;
    box.innerHTML = h;
    const bind = (id, fn, out) => { const el = $(id); if (!el) return; el.addEventListener('input', () => { fn(el.value); if (out) $(id + '-o').textContent = el.value + ' mm'; draw(); takeoff(); }); el.addEventListener('change', commit); };
    bind('cd-p-th', v => { o.th = +v; }, 1); bind('cd-p-w', v => { o.w = +v; }, 1); bind('cd-p-name', v => { o.name = v; });
  }

  /* ── actions ── */
  const msg = t => { $('cd-msg').textContent = t; };
  const HINT = { select: 'Click to select · Ctrl+click to add more · drag to move · drag a grip to reshape', wall: 'Click to start a wall, click again to continue · double-click or Esc to finish', room: 'Drag a rectangle to mark a room', pan: 'Drag to pan the sheet' };
  function setTool(t) {
    tool = t; armed = null; chain = null; drag = null;
    document.querySelectorAll('[data-tool]').forEach(b => { const on = b.dataset.tool === t; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    document.querySelectorAll('.cd-pal-item').forEach(b => b.classList.remove('is-on'));
    canvas.dataset.tool = t; msg(HINT[t]); draw();
  }
  function arm(k, sticky) {
    armed = { k, sticky }; chain = null;
    document.querySelectorAll('.cd-pal-item').forEach(b => b.classList.toggle('is-on', sticky && b.dataset.k === k));
    msg(OP[k] ? NAME[k] + ': click a wall to place · Esc to stop' : NAME[k] + ': click to place · Esc to stop');
    draw();
  }
  function disarm() { armed = null; document.querySelectorAll('.cd-pal-item').forEach(b => b.classList.remove('is-on')); msg(HINT[tool]); draw(); }
  function placeArmed() {
    const k = armed.k;
    if (OP[k]) {
      const h = hostAt(cur.raw, 40);
      if (!h) { msg('Doors and windows snap into walls. Drop it on one.'); return false; }
      const o = { t: 'open', id: S.id++, k, wall: h.w.id, s: h.s, w: OP[k].w, side: h.side, hs: 1 };
      S.objs.push(o); sel = new Set([o.id]);
    } else {
      const o = { t: 'sym', id: S.id++, k, x: cur.p[0], y: cur.p[1], rot: 0, w: SY[k].w, d: SY[k].d };
      S.objs.push(o); sel = new Set([o.id]);
    }
    commit(); return true;
  }
  /* Rotate 90° / flip the selection about its own centre. Several objects turn as one group. */
  function xform(op) {
    const objs = [...sel].map(byId).filter(Boolean);
    if (!objs.length) { msg('Select something first, then rotate or flip it.'); return; }
    const body = objs.filter(o => o.t !== 'open');
    if (!body.length) {                       // only doors / windows: change hinge or swing side
      for (const o of objs) { if (op === 'fh') o.hs = -(o.hs || 1); else o.side = -(o.side || 1); }
      commit(); return;
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const ext = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const o of body) {
      if (o.t === 'wall') { ext(o.a[0], o.a[1], 0); ext(o.b[0], o.b[1], 0); }
      else if (o.t === 'room') { ext(o.x, o.y, 0); ext(o.x + o.w, o.y + o.h, 0); }
      else ext(o.x, o.y, Math.max(o.w, o.d) / 2);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, mirror = op !== 'rot';
    const M = p => (op === 'rot' ? [cx - (p[1] - cy), cy + (p[0] - cx)] : op === 'fh' ? [2 * cx - p[0], p[1]] : [p[0], 2 * cy - p[1]]).map(Math.round);
    const walls = new Set();
    for (const o of body) {
      if (o.t === 'wall') { o.a = M(o.a); o.b = M(o.b); walls.add(o.id); }
      else if (o.t === 'room') {
        const p = M([o.x, o.y]), q = M([o.x + o.w, o.y + o.h]);
        o.x = Math.min(p[0], q[0]); o.y = Math.min(p[1], q[1]); o.w = Math.abs(p[0] - q[0]); o.h = Math.abs(p[1] - q[1]);
      } else {
        [o.x, o.y] = M([o.x, o.y]);
        const r = o.rot || 0;
        if (op === 'rot') o.rot = (r + 90) % 360;
        else { o.rot = (((op === 'fh' ? 0 : 180) - r) % 360 + 360) % 360; o.fl = !o.fl; }
      }
    }
    if (mirror) for (const o of S.objs) if (o.t === 'open' && walls.has(o.wall)) o.side = -(o.side || 1);
    commit();
  }
  function removeSel() {
    if (!sel.size) return;
    const ids = new Set(sel);
    S.objs = S.objs.filter(o => !ids.has(o.id) && !(o.t === 'open' && ids.has(o.wall)));
    sel.clear(); commit();
  }
  function fit() {
    const b = bounds(), r = canvas.getBoundingClientRect();
    if (r.width < 10) { needFit = true; return; }
    needFit = false;
    if (!b) { view = { z: 0.09, x: 40, y: 40 }; draw(); return; }
    const pad = 56, z = Math.min(0.5, (r.width - pad * 2) / (b.x1 - b.x0), (r.height - pad * 2) / (b.y1 - b.y0));
    view = { z, x: (r.width - (b.x1 - b.x0) * z) / 2 - b.x0 * z, y: (r.height - (b.y1 - b.y0) * z) / 2 - b.y0 * z };
    draw();
  }
  function zoomAt(f, cx, cy) {
    const z = Math.min(0.6, Math.max(0.02, view.z * f)), k = z / view.z;
    view.x = cx - (cx - view.x) * k; view.y = cy - (cy - view.y) * k; view.z = z; draw();
  }
  /* ── sample drawings ── */
  function build(title, fn) {
    let n = 1;
    const objs = [];
    const W = (x1, y1, x2, y2, th) => { objs.push({ t: 'wall', id: n, a: [x1, y1], b: [x2, y2], th: th || 150 }); return n++; };
    // a closed rectangle drawn clockwise: returns the ids of [top, right, bottom, left]
    const box = (x, y, w, h, th) => [W(x, y, x + w, y, th), W(x + w, y, x + w, y + h, th), W(x + w, y + h, x, y + h, th), W(x, y + h, x, y, th)];
    // dist = distance of the opening's centre from the wall's start point; side 1 / -1 picks the swing side
    const op = (k, wid, dist, w, side, hs) => {
      const wall = objs.find(o => o.id === wid);
      objs.push({ t: 'open', id: n++, k, wall: wid, s: dist / wl(wall), w: w || OP[k].w, side: side || 1, hs: hs || 1 });
    };
    const sy = (k, x, y, rot, fl) => { const o = { t: 'sym', id: n++, k, x, y, rot: rot || 0, w: SY[k].w, d: SY[k].d }; if (fl) o.fl = true; objs.push(o); };
    const rm = (x, y, w, h, name) => objs.push({ t: 'room', id: n++, x, y, w, h, name });
    fn({ W, box, op, sy, rm });
    S = { id: n, title, objs };
    sel.clear();
  }

  const SAMPLES = {
    studio: ['Sample studio unit', ({ W, box, op, sy, rm }) => {
      const [top, right, bottom, left] = box(0, 0, 6000, 7000);
      const hz = W(0, 3200, 6000, 3200, 100);
      W(3600, 0, 3600, 3200, 100);
      op('door', bottom, 4500, 1000, 1);
      op('sdoor', bottom, 1700, 1800, 1);
      op('door', hz, 2400, 900, -1);
      op('door', hz, 4300, 800, -1);
      op('window', top, 1800, 1500); op('window', top, 4800, 600);
      op('window', left, 5200, 1200); op('window', left, 800, 1000);
      op('window', right, 1600, 600); op('window', right, 5200, 1200);
      [[0, 0], [6000, 0], [6000, 7000], [0, 7000]].forEach(p => sy('column', p[0], p[1]));
      // bedroom
      sy('bed', 1500, 1100); sy('nightstand', 500, 330); sy('nightstand', 2500, 330);
      sy('wardrobe', 375, 1500, 90); sy('desk', 2925, 1500, 90); sy('plant', 3200, 2850);
      // toilet & bath
      sy('wc', 4300, 430); sy('lav', 5350, 290); sy('shower', 5475, 2675);
      // living / kitchen
      sy('fridge', 5575, 3625, 90); sy('stove', 5625, 4300, 90); sy('sink', 5625, 5200, 90); sy('washer', 5625, 6600);
      sy('tv', 300, 4700, 270); sy('coffee', 1250, 4700, 90); sy('sofa', 2300, 4700, 90);
      sy('armchair', 1300, 3750); sy('plant', 450, 3550); sy('ac', 3300, 3425);
      sy('rtable', 3800, 5200); sy('plant', 4800, 6500);
      rm(75, 75, 3450, 3050, 'Bedroom'); rm(3675, 75, 2250, 3050, 'T&B'); rm(75, 3275, 5850, 3650, 'Living / Kitchen');
    }],

    house: ['Sample two-bedroom house', ({ W, box, op, sy, rm }) => {
      const [top, right, bottom, left] = box(0, 0, 10000, 8000);
      const p1 = W(5400, 0, 5400, 8000, 100), p2 = W(6600, 0, 6600, 8000, 100);
      W(6600, 3400, 10000, 3400, 100); W(6600, 5200, 10000, 5200, 100);
      op('ddoor', bottom, 7300, 1500, 1);
      op('window', bottom, 5600, 1200);
      op('window', left, 1100, 1200); op('window', left, 6500, 1200);
      op('window', top, 1800, 1500); op('window', top, 4000, 1800); op('window', top, 8300, 1800);
      op('window', right, 1700, 1500); op('window', right, 4300, 600); op('window', right, 6600, 1500);
      op('door', p1, 1800, 900, -1); op('door', p1, 6500, 900, -1);
      op('door', p2, 2600, 900, -1); op('door', p2, 4500, 800, -1); op('door', p2, 6400, 900, -1);
      [[0, 0], [10000, 0], [10000, 8000], [0, 8000], [5400, 0], [5400, 8000]].forEach(p => sy('column', p[0], p[1]));
      // kitchen & dining
      sy('fridge', 425, 425); sy('sink', 1800, 375); sy('stove', 2800, 375); sy('counter', 2000, 1700);
      sy('rtable', 4200, 2400); sy('plant', 5050, 500);
      // living
      sy('tv', 300, 5400, 270); sy('coffee', 1600, 5400, 90); sy('sofa', 2800, 5400, 90);
      sy('armchair', 1300, 4300); sy('armchair', 1300, 6500, 180); sy('plant', 500, 4300); sy('plant', 4900, 7500);
      sy('ac', 5175, 4400, 90); sy('plant', 1500, 8350); sy('plant', 3900, 8350);
      // master bedroom
      sy('bed', 8300, 1050); sy('nightstand', 7300, 300); sy('nightstand', 9300, 300); sy('wardrobe', 9000, 3050, 180);
      // bath
      sy('tub', 9075, 3850); sy('wc', 8000, 4800, 180); sy('lav', 8900, 4940, 180); sy('washer', 7100, 3800);
      // bedroom 2
      sy('bedS', 8700, 6225); sy('nightstand', 9500, 5500); sy('desk', 7700, 7325, 180); sy('wardrobe', 9000, 7625, 180);
      sy('plant', 5950, 7600);
      rm(75, 75, 5250, 3650, 'Kitchen / Dining'); rm(75, 3875, 5250, 4050, 'Living'); rm(5475, 75, 1050, 7850, 'Hall');
      rm(6675, 75, 3250, 3275, 'Master BR'); rm(6675, 3475, 3250, 1675, 'Bath'); rm(6675, 5275, 3250, 2650, 'Bedroom 2');
    }],

    office: ['Sample small office', ({ W, box, op, sy, rm }) => {
      const [top, right, bottom, left] = box(0, 0, 12000, 8000);
      const east = W(8000, 0, 8000, 8000, 100);
      W(8000, 3200, 12000, 3200, 100); W(8000, 5400, 12000, 5400, 100); W(8000, 6700, 12000, 6700, 100);
      const pantry = W(0, 2000, 3000, 2000, 100);
      W(3000, 0, 3000, 2000, 100);
      op('ddoor', bottom, 7500, 1500, 1);
      op('window', bottom, 5100, 1800);
      op('window', top, 1500, 1200); op('window', top, 4500, 1800); op('window', top, 6800, 1800);
      op('window', right, 1600, 1800); op('window', right, 4300, 1500); op('window', right, 6050, 600); op('window', right, 7350, 600);
      op('door', pantry, 1500, 900, -1);
      op('ddoor', east, 1600, 1400, -1); op('door', east, 4300, 900, -1); op('door', east, 6050, 800, -1); op('door', east, 7350, 800, -1);
      [[0, 0], [12000, 0], [12000, 8000], [0, 8000], [8000, 0], [8000, 8000]].forEach(p => sy('column', p[0], p[1]));
      // pantry
      sy('stove', 500, 400); sy('sink', 1500, 375); sy('fridge', 2550, 425);
      // core & reception
      sy('stairs', 900, 4700); sy('elev', 1100, 7000);
      sy('counter', 5000, 6500); sy('sofa', 6900, 7475, 180); sy('coffee', 7100, 6700);
      // open office: two rows of desks
      [3300, 4900, 6500].forEach(x => { sy('desk', x, 3300); sy('desk', x, 5100, 180); });
      sy('plant', 3400, 2750); sy('plant', 7500, 3350); sy('plant', 500, 7550); sy('ac', 7800, 2400, 90);
      sy('rtable', 4500, 1100); sy('rtable', 6600, 1100);
      // meeting room
      sy('tv', 10000, 300); sy('rtable', 10000, 1700); sy('plant', 11600, 2900);
      // manager
      sy('desk', 10300, 4500); sy('wardrobe', 11300, 5050, 180); sy('plant', 8450, 5150);
      // restrooms
      [9300, 10300, 11300].forEach(x => { sy('wc', x, 5800); sy('wc', x, 7100); });
      [9400, 10400].forEach(x => { sy('lav', x, 6440, 180); sy('lav', x, 7715, 180); });
      rm(75, 75, 2875, 1875, 'Pantry'); rm(3075, 75, 4875, 1925, 'Collab area'); rm(75, 2075, 7875, 5850, 'Open office');
      rm(8075, 75, 3850, 3075, 'Meeting'); rm(8075, 3275, 3850, 2075, 'Manager');
      rm(8075, 5475, 3850, 1175, 'Men'); rm(8075, 6775, 3850, 1150, 'Women');
    }],

    footing: ['Sample footing plan', ({ W, sy, rm }) => {
      const xs = [0, 5000, 10000, 15000], ys = [0, 4500, 9000];
      ys.forEach(y => { for (let i = 0; i < 3; i++) W(xs[i], y, xs[i + 1], y, 250); });
      xs.forEach(x => { for (let k = 0; k < 2; k++) W(x, ys[k], x, ys[k + 1], 250); });
      xs.forEach(x => ys.forEach(y => sy('footing', x, y)));
      sy('elev', 7500, 6750); sy('stairs', 12500, 6750);
      [[0, 0], [1, 0], [2, 0], [0, 1]].forEach(([i, k]) => rm(xs[i] + 625, ys[k] + 625, 3750, 3250, 'Bay ' + 'ABC'[i] + (k + 1)));
    }]
  };
  function sample(key) { const s = SAMPLES[key] || SAMPLES.studio; build(s[0], s[1]); }

  /* ── pointer interaction on the sheet ── */
  function setCursor(e) {
    const r = svg.getBoundingClientRect();
    cur.px = [e.clientX - r.left, e.clientY - r.top];
    cur.raw = S2W(cur.px[0], cur.px[1]);
    const s = snapPt(cur.raw);
    cur.p = s.p; cur.snap = s.kind; cur.on = true;
  }
  svg.addEventListener('pointerdown', e => {
    sheet.focus({ preventScroll: true });
    setCursor(e);
    svg.setPointerCapture(e.pointerId);
    if (e.button === 2 || e.button === 1 || tool === 'pan' || space) { drag = { t: 'pan', rmb: e.button === 2, moved: false, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; return; }
    if (armed) { if (placeArmed() && !armed.sticky) disarm(); return; }
    if (tool === 'wall') {
      if (!chain) { chain = { a: cur.p.slice() }; drag = { t: 'wall', px: cur.px.slice() }; }
      else { addWall(cur.p); drag = { t: 'wall', px: null }; }
      draw(); return;
    }
    if (tool === 'room') { drag = { t: 'room', a: cur.p.slice(), b: cur.p.slice() }; return; }
    const g = e.target.closest('[data-grip]');
    if (g) { drag = { t: 'grip', id: +g.dataset.id, g: g.dataset.grip }; return; }
    const h = e.target.closest('[data-id]'), multi = e.ctrlKey || e.metaKey || e.shiftKey;
    if (h) {
      const id = +h.dataset.id;
      if (multi) {
        if (sel.has(id)) { sel.delete(id); props(); draw(); return; }
        sel.add(id);
      } else if (!sel.has(id)) sel = new Set([id]);
      drag = { t: 'move', start: cur.raw.slice(), orig: JSON.parse(JSON.stringify(S.objs.filter(o => sel.has(o.id)))), moved: false };
    } else if (!multi) sel.clear();
    props(); draw();
  });
  svg.addEventListener('pointermove', e => {
    setCursor(e);
    if (drag) {
      if (drag.t === 'pan') { view.x = drag.vx + e.clientX - drag.x; view.y = drag.vy + e.clientY - drag.y; if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4) drag.moved = true; }
      else if (drag.t === 'room') drag.b = cur.p.slice();
      else if (drag.t === 'grip') {
        const o = byId(drag.id);
        if (o.t === 'wall') o[drag.g] = cur.p.slice();
        else if (o.t === 'room') {
          const c = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]], opp = c[(+drag.g + 2) % 4];
          o.x = Math.min(opp[0], cur.p[0]); o.y = Math.min(opp[1], cur.p[1]);
          o.w = Math.abs(opp[0] - cur.p[0]); o.h = Math.abs(opp[1] - cur.p[1]);
        }
        drag.moved = true;
      } else if (drag.t === 'move') {
        const dx = cur.raw[0] - drag.start[0], dy = cur.raw[1] - drag.start[1];
        if (!drag.moved && Math.hypot(dx, dy) * view.z < 4) { draw(); return; }
        drag.moved = true;
        const sx = gridSnap ? Math.round(dx / 100) * 100 : dx, sy = gridSnap ? Math.round(dy / 100) * 100 : dy;
        for (const orig of drag.orig) {
          const o = byId(orig.id);
          if (o.t === 'wall') { o.a = [orig.a[0] + sx, orig.a[1] + sy]; o.b = [orig.b[0] + sx, orig.b[1] + sy]; }
          else if (o.t === 'open') { if (drag.orig.length === 1) { const h = hostAt(cur.raw, 48); if (h) { o.wall = h.w.id; o.s = h.s; o.side = h.side; } } }
          else { o.x = orig.x + sx; o.y = orig.y + sy; }
        }
      }
    }
    draw();
  });
  svg.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.t === 'pan') { if (d.rmb && !d.moved) { chain = null; if (armed) disarm(); } }
    else if (d.t === 'wall' && d.px && Math.hypot(cur.px[0] - d.px[0], cur.px[1] - d.px[1]) > 10) { addWall(cur.p); chain = null; }
    else if (d.t === 'room') {
      const w = Math.abs(d.a[0] - d.b[0]), h = Math.abs(d.a[1] - d.b[1]);
      if (w >= 500 && h >= 500) {
        const o = { t: 'room', id: S.id++, x: Math.min(d.a[0], d.b[0]), y: Math.min(d.a[1], d.b[1]), w, h, name: 'Room ' + (S.objs.filter(q => q.t === 'room').length + 1) };
        S.objs.push(o); sel = new Set([o.id]); commit();
      }
    } else if ((d.t === 'grip' || d.t === 'move') && d.moved) commit();
    draw();
  });
  svg.addEventListener('pointercancel', () => { drag = null; draw(); });
  svg.addEventListener('pointerleave', () => { cur.on = false; draw(); });
  svg.addEventListener('dblclick', () => { chain = null; draw(); });
  svg.addEventListener('contextmenu', e => e.preventDefault());
  svg.addEventListener('wheel', e => {
    if (document.activeElement !== sheet && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    zoomAt(Math.pow(1.0018, -e.deltaY), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  function addWall(p) {
    if (!chain) return;
    if (Math.hypot(p[0] - chain.a[0], p[1] - chain.a[1]) >= 50) {
      S.objs.push({ t: 'wall', id: S.id++, a: chain.a.slice(), b: p.slice(), th: wallTh });
      commit(); chain.a = p.slice();
    }
  }

  /* ── palette: pointer-based drag and drop (mouse, pen and touch) ── */
  const inCanvas = e => { const r = canvas.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
  $('cd-pal').addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-k]');
    if (!b) return;
    dragP = { k: b.dataset.k, x: e.clientX, y: e.clientY, go: false };
  });
  window.addEventListener('pointermove', e => {
    if (!dragP) return;
    if (!dragP.go && Math.hypot(e.clientX - dragP.x, e.clientY - dragP.y) > 6) {
      dragP.go = true; arm(dragP.k, false);
      ghost.innerHTML = icon(dragP.k); ghost.hidden = false;
    }
    if (!dragP.go) return;
    ghost.style.transform = `translate(${e.clientX + 14}px,${e.clientY + 14}px)`;
    ghost.classList.toggle('is-over', inCanvas(e));
    if (inCanvas(e)) setCursor(e); else cur.on = false;
    draw();
  });
  const endPal = e => {
    if (!dragP) return;
    const d = dragP; dragP = null; ghost.hidden = true;
    if (d.go) { if (e.type === 'pointerup' && inCanvas(e)) { setCursor(e); placeArmed(); } disarm(); }
    else { setTool('select'); arm(d.k, true); }
  };
  window.addEventListener('pointerup', endPal);
  window.addEventListener('pointercancel', endPal);

  /* ── keyboard (only while the sheet has focus) ── */
  sheet.addEventListener('keydown', e => {
    if (e.target.matches('input[type="text"]')) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (e.key === 'Shift') { shift = true; draw(); }
    if (e.code === 'Space') { space = true; e.preventDefault(); }
    else if (mod && k === 'z') { e.preventDefault(); jump(e.shiftKey ? 1 : -1); }
    else if (mod && k === 'y') { e.preventDefault(); jump(1); }
    else if (mod && k === 's') { e.preventDefault(); openSave(); }
    else if (mod && k === 'a') { e.preventDefault(); sel = new Set(S.objs.map(o => o.id)); props(); draw(); }
    else if (e.key === 'Escape') { if (!chain && !armed && tool === 'select' && wrap.classList.contains('is-fs') && !fsEl()) setFS(false); chain = null; drag = null; armed ? disarm() : (tool !== 'select' && setTool('select')); draw(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); }
    else if (e.key === 'Enter') { chain = null; draw(); }
    else if (!mod && { v: 'select', w: 'wall', a: 'room', h: 'pan' }[k]) setTool({ v: 'select', w: 'wall', a: 'room', h: 'pan' }[k]);
    else if (!mod && (k === 'r' || k === 'f')) xform(k === 'r' ? 'rot' : e.shiftKey ? 'fv' : 'fh');
  });
  sheet.addEventListener('keyup', e => { if (e.code === 'Space') space = false; if (e.key === 'Shift') { shift = false; draw(); } });

  /* ── toolbar, toggles and export ── */
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('cd-undo').addEventListener('click', () => jump(-1));
  $('cd-redo').addEventListener('click', () => jump(1));
  $('cd-fit').addEventListener('click', fit);
  [['cd-rot', 'rot'], ['cd-fh', 'fh'], ['cd-fv', 'fv']].forEach(([id, op]) => $(id).addEventListener('click', () => { xform(op); sheet.focus({ preventScroll: true }); }));
  $('cd-zin').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); });
  $('cd-zout').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); });
  const flag = (id, get, set) => { const b = $(id); b.addEventListener('click', () => { set(!get()); b.classList.toggle('is-on', get()); b.setAttribute('aria-pressed', get()); draw(); }); };
  flag('cd-ortho', () => ortho, v => { ortho = v; });
  flag('cd-snap', () => gridSnap, v => { gridSnap = v; });
  document.querySelectorAll('[data-wth]').forEach(b => b.addEventListener('click', () => {
    wallTh = +b.dataset.wth;
    document.querySelectorAll('[data-wth]').forEach(x => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on); });
  }));
  $('cd-title').addEventListener('input', e => { S.title = e.target.value.slice(0, 40) || 'Untitled plan'; $('cd-dwg').textContent = 'DWG-A-BP01 · ' + S.title; });
  $('cd-title').addEventListener('change', commit);
  document.querySelectorAll('[data-sample]').forEach(b => b.addEventListener('click', () => {
    sample(b.dataset.sample); $('cd-title').value = S.title; commit(); fit();
    msg('Loaded “' + S.title + '”. Ctrl+Z brings your drawing back.');
  }));
  $('cd-clear').addEventListener('click', () => { if (!S.objs.length) return; S = { objs: [], id: 1, title: S.title }; sel.clear(); commit(); msg('Sheet cleared. Ctrl+Z brings it back.'); });
  /* ── export: PNG, PDF (hand-built, no library) ── */
  const fname = (ext, base) => (base || (S.title || 'blueprint').replace(/[^\w-]+/g, '-')) + '.' + ext;
  function saveFile(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function sheetCanvas(done) {
    const b = bounds();
    if (!b) { msg('Draw something first, then export.'); return; }
    const pad = 900, mw = b.x1 - b.x0 + pad * 2, mh = b.y1 - b.y0 + pad * 2, z = Math.min(1500 / mw, 1000 / mh, 0.4);
    const W = Math.round(mw * z), H = Math.round(mh * z) + 54, v = { z, x: (pad - b.x0) * z, y: (pad - b.y0) * z };
    const cs = getComputedStyle(document.documentElement);
    const css = CSS.replace(/var\(--([\w-]+)\)/g, (m, n) => cs.getPropertyValue('--' + n).trim() || m);
    const bg = cs.getPropertyValue('--bg').trim(), ink = cs.getPropertyValue('--text').trim(), gold = cs.getPropertyValue('--gold').trim(), mut = cs.getPropertyValue('--muted').trim();
    const mono = "'Space Mono',monospace";
    const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>${css}</style>`
      + `<rect width="${W}" height="${H}" fill="${bg}"/>${scene(v, true)}`
      + `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="${ink}" stroke-width="1.5"/><line x1="1" y1="${H - 54}" x2="${W - 1}" y2="${H - 54}" stroke="${ink}"/>`
      + `<text x="16" y="${H - 28}" font-family="${mono}" font-size="14" fill="${gold}">DWG-A-BP01 · ${esc(S.title)}</text>`
      + `<text x="16" y="${H - 11}" font-family="${mono}" font-size="10" fill="${mut}">ALL DIMENSIONS IN MILLIMETERS · ${new Date().toISOString().slice(0, 10)} · BLUEPRINT LAB</text></svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W * 2; c.height = H * 2;
      const g = c.getContext('2d'); g.scale(2, 2); g.drawImage(img, 0, 0);
      done(c, W, H);
    };
    img.onerror = () => msg('Export failed in this browser.');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out);
  }
  function exportPNG(name) {
    sheetCanvas(c => c.toBlob(bl => { saveFile(bl, fname('png', name)); msg('Exported PNG.'); }));
  }
  async function pdfBlob(c, W, H) {
    // One page, sheet scaled to fit A3 (landscape or portrait). Lossless Flate image when
    // CompressionStream exists, otherwise a high-quality JPEG.
    const land = W >= H, PW = land ? 1191 : 842, PH = land ? 842 : 1191, M = 28;
    const k = Math.min((PW - 2 * M) / W, (PH - 2 * M) / H), w = W * k, h = H * k, x = (PW - w) / 2, y = (PH - h) / 2;
    let data, filter;
    try {
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, rgb = new Uint8Array(c.width * c.height * 3);
      for (let i = 0, j = 0; i < px.length; i += 4) { rgb[j++] = px[i]; rgb[j++] = px[i + 1]; rgb[j++] = px[i + 2]; }
      data = new Uint8Array(await new Response(new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
      filter = '/FlateDecode';
    } catch (e) {
      data = Uint8Array.from(atob(c.toDataURL('image/jpeg', 0.95).split(',')[1]), ch => ch.charCodeAt(0));
      filter = '/DCTDecode';
    }
    const enc = new TextEncoder(), parts = [], offs = [];
    let len = 0;
    const push = u => { parts.push(u); len += u.length; };
    const str = s => push(enc.encode(s));
    const obj = (n, body) => { offs[n] = len; str(`${n} 0 obj\n${body}\nendobj\n`); };
    const draw = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    str('%PDF-1.4\n');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
    obj(4, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    offs[5] = len;
    str(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${data.length} >>\nstream\n`);
    push(data);
    str('\nendstream\nendobj\n');
    const xref = len;
    str('xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')
      + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  function exportPDF(name) {
    sheetCanvas(async (c, W, H) => {
      try { saveFile(await pdfBlob(c, W, H), fname('pdf', name)); msg('Saved PDF.'); }
      catch (e) { msg('PDF export failed in this browser.'); }
    });
  }
  $('cd-png').addEventListener('click', () => exportPNG());
  $('cd-pdf').addEventListener('click', () => exportPDF());

  /* ── Ctrl+S dialog ── */
  const modal = $('cd-modal'), nameIn = $('cd-modal-fname');
  let saveFmt = 'png';
  const cleanName = s => String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\.(png|pdf)$/i, '').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').slice(0, 60);
  function setFmt(f) {
    saveFmt = f;
    modal.querySelectorAll('[data-save]').forEach(b => { const on = b.dataset.save === f; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    $('cd-modal-ext').textContent = '.' + f;
  }
  function openSave() {
    if (!bounds()) { msg('Draw something first, then save.'); return; }
    nameIn.value = cleanName(S.title) || 'blueprint';
    setFmt(saveFmt);
    modal.hidden = false;
    nameIn.focus(); nameIn.select();
  }
  function closeSave() { modal.hidden = true; sheet.focus({ preventScroll: true }); }
  function doSave() {
    const n = cleanName(nameIn.value) || cleanName(S.title) || 'blueprint', f = saveFmt;
    closeSave(); f === 'pdf' ? exportPDF(n) : exportPNG(n);
  }
  modal.addEventListener('click', e => {
    const b = e.target.closest('[data-save]');
    if (b) setFmt(b.dataset.save);
    else if (e.target.closest('#cd-modal-ok')) doSave();
    else if (e.target === modal || e.target.closest('#cd-modal-x')) closeSave();
  });
  modal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeSave(); }
    else if (e.key === 'Enter' && e.target === nameIn) { e.preventDefault(); doSave(); }
    else if (e.key === 'Tab') {
      const f = Array.from(modal.querySelectorAll('input, button')), i = f.indexOf(document.activeElement);
      e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  /* ── full screen (falls back to filling the window where the API is missing) ── */
  const wrap = document.querySelector('.cd-wrap'), fsBtn = $('cd-fs');
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function setFS(on) {
    wrap.classList.toggle('is-fs', on);
    fsBtn.classList.toggle('is-on', on);
    fsBtn.setAttribute('aria-pressed', on);
    fsBtn.textContent = on ? 'Exit full screen' : 'Full screen';
    document.documentElement.classList.toggle('cd-fs-lock', on && !fsEl());
    draw();
  }
  async function toggleFS() {
    if (wrap.classList.contains('is-fs')) {
      if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else setFS(false);
      return;
    }
    const req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    if (req) { try { await req.call(wrap); return; } catch (e) { /* fall through */ } }
    setFS(true);
  }
  fsBtn.addEventListener('click', toggleFS);
  document.addEventListener('fullscreenchange', () => setFS(!!fsEl()));
  document.addEventListener('webkitfullscreenchange', () => setFS(!!fsEl()));

  /* ── resizable asset panel (drag the handle, arrow keys, double-click to reset) ── */
  (function () {
    const main = document.querySelector('.cd-main'), grip = $('cd-resizer');
    if (!main || !grip) return;
    const MIN = 96, MAX = 360, DEF = 112, PK = 'bplab:palw';
    let w = DEF;
    const limit = v => Math.round(Math.max(MIN, Math.min(Math.min(MAX, main.clientWidth - 260), v)));
    function setW(v, keep) {
      w = limit(v);
      main.style.setProperty('--cd-pal-w', w + 'px');
      grip.setAttribute('aria-valuenow', w);
      if (!keep) { try { localStorage.setItem(PK, w); } catch (e) { /* storage unavailable */ } }
    }
    try { const s = +localStorage.getItem(PK); if (s) w = s; } catch (e) { /* ignore */ }
    setW(w, true);
    let d = null;
    grip.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      d = { x: e.clientX, w };
      grip.setPointerCapture(e.pointerId);
      grip.classList.add('is-drag'); document.documentElement.classList.add('cd-resizing');
      e.preventDefault();
    });
    grip.addEventListener('pointermove', e => { if (d) setW(d.w + e.clientX - d.x, true); });
    const end = () => { if (!d) return; d = null; grip.classList.remove('is-drag'); document.documentElement.classList.remove('cd-resizing'); setW(w); };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('dblclick', () => setW(DEF));
    grip.addEventListener('keydown', e => {
      const n = { ArrowLeft: w - 16, ArrowRight: w + 16, Home: MIN, End: MAX }[e.key];
      if (n === undefined) return;
      e.preventDefault(); e.stopPropagation(); setW(n);
    });
    window.addEventListener('resize', () => setW(w, true));
  })();

  if ('ResizeObserver' in window) new ResizeObserver(() => { needFit && canvas.clientWidth > 10 ? fit() : draw(); }).observe(canvas);

  /* ── boot ── */
  try { const raw = localStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw); if (p && Array.isArray(p.objs) && p.objs.length) S = p; } } catch (e) { /* ignore */ }
  if (!S.objs.length) sample('studio');
  $('cd-title').value = S.title;
  hist = [JSON.stringify(S)]; hi = 0;
  setTool('select'); refresh();
  requestAnimationFrame(fit);
})();

/* ══════════════════════════════════════════════════
   SANDBOX TABS — switches between Beam Lab and
   Blueprint Lab. Arrow keys / Home / End move between tabs.
   ═══════════════════════════════════════ */
(function () {
  const tabs = Array.from(document.querySelectorAll('.sb-tab'));
  if (!tabs.length) return;
  function show(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    window.dispatchEvent(new Event('resize'));
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', e => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      show(tabs[(n + tabs.length) % tabs.length], true);
    });
  });
})();