/* Cursor glow */
const glow = document.getElementById('glow');
document.addEventListener('mousemove', e => {
  glow.style.left = e.clientX + 'px';
  glow.style.top  = e.clientY + 'px';
});

/* Plan tabs */
function switchPlan(id, btn) {
  document.querySelectorAll('.plan-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.plan-view').forEach(v => v.classList.remove('active'));
  document.getElementById('plan-' + id).classList.add('active');
  btn.classList.add('active');
}

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
   INTRO: Smooth flowing lines from all four edges.
   After fade-out the hero runs its own animation.
   No DOM swap — zero jerk.
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

