/* ============================================================
   NorthStar Digital — service system (interactive orbit map)
   Four planets, one per service, orbiting a gold north star.
   Click a planet → it zooms to the LEFT side of the map and
   fills it; service info appears ON the planet.  The rest of
   the solar system shifts right and keeps orbiting, fully
   interactive — click any right-side planet to swap focus.
   ============================================================ */
(() => {
  "use strict";

  const map = document.getElementById("system-map");
  if (!map) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PLANETS = [
    {
      id: "ai", label: "AI Automation", skin: "s-orb--ai", size: 62,
      r: 0.34, phase: 0.6,
      kicker: "S·01 — AI Automation",
      name: "Your brand, always on.",
      desc: "Intelligent automation that keeps your social presence active and growing — 24/7, without the manual overhead. AI-driven scheduling, automated engagement, and algorithmic audience growth.",
      tags: ["AI Scheduling", "Auto-Engagement", "Analytics", "Audience Growth"]
    },
    {
      id: "social", label: "Social Ads", skin: "s-orb--social", size: 54,
      r: 0.52, phase: 2.4,
      kicker: "S·02 — Social Media Ads",
      name: "Precision targeting. Maximum returns.",
      desc: "Data-driven campaigns across Instagram, Facebook, TikTok, and LinkedIn — creative that converts, built around your audience's psychology and your competitors' gaps.",
      tags: ["Instagram", "Facebook", "TikTok", "LinkedIn"]
    },
    {
      id: "google", label: "Google", skin: "s-orb--gbp", size: 50,
      r: 0.70, phase: 4.1,
      kicker: "S·03 — Google & Search",
      name: "Capture intent. Win the search.",
      desc: "Business Profile optimization paired with high-intent search and display advertising. Capture customers at the exact moment they're ready to buy.",
      tags: ["Business Profile", "Search Ads", "Display", "Shopping"]
    },
    {
      id: "web", label: "Websites", skin: "s-orb--web", size: 58,
      r: 0.90, phase: 1.3,
      kicker: "S·04 — Web Development",
      name: "Every pixel deliberate.",
      desc: "Bespoke websites built from the ground up — performance-optimized, conversion-focused. No templates. Every interaction guides visitors toward action.",
      tags: ["Custom Design", "Mobile-First", "SEO-Ready", "CMS"]
    }
  ];

  const TILT   = 0.42;
  const ZOOM_MS = 760;

  const star      = map.querySelector(".system__star");
  const focusWrap = document.getElementById("system-focus");
  const focusOrb  = document.getElementById("system-focus-orb");
  const backBtn   = document.getElementById("system-back");
  const ctaMoon   = document.getElementById("cta-moon");
  const ctaOrb    = ctaMoon.querySelector(".s-ctamoon__orb");
  let ctaAngle = 2.2;
  const panel = {
    kicker: document.getElementById("sp-kicker"),
    name:   document.getElementById("sp-name"),
    desc:   document.getElementById("sp-desc"),
    tags:   document.getElementById("sp-tags"),
    cta:    document.getElementById("sp-cta")
  };

  /* build rings + planet buttons */
  const rings = [];
  PLANETS.forEach((pl, i) => {
    const ring = document.createElement("div");
    ring.className = "system__ring";
    map.appendChild(ring);
    rings.push(ring);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "s-planet";
    btn.setAttribute("aria-label", `${pl.label} — zoom in on this service`);
    btn.innerHTML =
      `<span class="s-planet__orb ${pl.skin}" style="width:${pl.size}px;height:${pl.size}px">` +
      `<span class="s-moon" style="--moon-r:${Math.round(pl.size * 0.95)}px;--moon-t:${(4.5 + i * 1.7).toFixed(1)}s"></span>` +
      `</span>` +
      `<span class="s-planet__label">${pl.label}</span>`;
    btn.addEventListener("click", () => zoomIn(i));
    map.appendChild(btn);
    pl.el    = btn;
    pl.angle = pl.phase;
    pl.speed = 0.00022 / Math.pow(pl.r, 1.5);
    pl.cur   = { x: 0, y: 0, s: 1 };
  });

  /* ---- geometry ---- */
  let W = 0, H = 0, cx = 0, cy = 0, base = 0, focusSize = 0, narrow = false;
  /* orbitX / orbitBase track the live orbit-centre position + scale
     (lerped right during zoom-in so the solar system shifts right
      while the focused planet flies left) */
  let orbitX = 0, orbitBase = 0;

  function updateRingsAndStar(ox, ob) {
    const pctX = (ox / W * 100).toFixed(2) + "%";
    star.style.left = pctX;
    rings.forEach((ring, i) => {
      const R = ob * PLANETS[i].r;
      ring.style.width  = R * 2 + "px";
      ring.style.height = R * 2 * TILT + "px";
      ring.style.left   = pctX;
    });
  }

  function layout() {
    W      = map.clientWidth;
    H      = map.clientHeight;
    cx     = W / 2;
    cy     = H / 2;
    narrow = window.innerWidth < 900;
    base   = Math.min(W / 2 - 44, (H / 2) / TILT - 44);
    focusSize = narrow
      ? Math.min(W * 0.72, H * 0.60)
      : Math.min(W * 0.40, H * 0.82);

    const ctaSize = Math.max(26, Math.round(focusSize * 0.15));
    ctaOrb.style.width  = ctaSize + "px";
    ctaOrb.style.height = ctaSize + "px";

    orbitX    = cx;
    orbitBase = base;
    updateRingsAndStar(cx, base);
    /* if focused, applyFocus() re-syncs orbitX/orbitBase on the very next frame */
  }
  layout();
  window.addEventListener("resize", layout);

  const lerp       = (a, b, t) => a + (b - a) * t;
  const easeInOut  = (t) => t * t * (3 - 2 * t);

  function focusTarget() {
    /* On desktop: planet anchors to left quarter of map
       On mobile:  planet anchors near the vertical centre */
    return narrow
      ? { x: cx, y: H * 0.38 }
      : { x: focusSize / 2 + W * 0.04, y: cy };
  }

  function orbitPos(pl) {
    const R = orbitBase * pl.r;
    const x = orbitX + Math.cos(pl.angle) * R;
    const y = cy     + Math.sin(pl.angle) * R * TILT;
    const depth = (Math.sin(pl.angle) + 1) / 2;
    return { x, y, s: 0.78 + depth * 0.34, depth };
  }

  function render(pl, x, y, s, z) {
    pl.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${s})`;
    pl.el.style.zIndex    = String(z);
    pl.cur.x = x; pl.cur.y = y; pl.cur.s = s;
  }

  /* ---- focus / zoom state machine ---- */
  /* mode: "orbit" | "in" | "focused" | "out"
     ft:   0 (orbit) → 1 (fully focused)          */
  let mode     = "orbit";
  let ft       = 0;
  let focusIdx = -1;
  let from     = { x: 0, y: 0, s: 0.1 };
  let hopping  = false;

  function setPanel(i) {
    const pl = PLANETS[i];
    panel.kicker.textContent  = pl.kicker;
    panel.name.textContent    = pl.name;
    panel.desc.textContent    = pl.desc;
    panel.tags.innerHTML      = pl.tags.map(t => `<span class="pill">${t}</span>`).join("");
  }

  function retriggerText() {
    focusWrap.classList.remove("is-open");
    void focusWrap.offsetWidth;            // force reflow to restart transition
    focusWrap.classList.add("is-open");
  }

  function zoomIn(i) {
    if (mode === "in" || mode === "out") return;

    if (mode === "focused") {
      if (i === focusIdx) return;
      /* hop — new planet flies from its orbit position to the left */
      from = {
        x: PLANETS[i].cur.x,
        y: PLANETS[i].cur.y,
        s: (PLANETS[i].size * PLANETS[i].cur.s) / focusSize
      };
      const tgt = focusTarget();
      PLANETS.forEach((p, k) => {
        p.hopFrom = k === focusIdx
          ? { x: tgt.x,    y: tgt.y,    s: 1,       depth: 0.5 }
          : { x: p.cur.x,  y: p.cur.y,  s: p.cur.s, depth: 0.5 };
      });
      hopping  = true;
      focusIdx = i;
      setPanel(i);
      focusOrb.className = "system__focus-orb " + PLANETS[i].skin;
      retriggerText();
      ft   = 0;
      mode = prefersReduced ? "focused" : "in";
      if (prefersReduced) { ft = 1; applyFocus(); }
      return;
    }

    /* fresh zoom-in from orbit */
    focusIdx = i;
    const pl = PLANETS[i];
    const p  = orbitPos(pl);
    from = { x: p.x, y: p.y, s: (pl.size * p.s) / focusSize };

    setPanel(i);
    focusOrb.className      = "system__focus-orb " + pl.skin;
    focusOrb.style.width    = focusSize + "px";
    focusOrb.style.height   = focusSize + "px";
    focusOrb.style.display  = "block";
    focusOrb.style.zIndex   = "24";
    ctaMoon.style.display   = "flex";
    map.classList.add("is-focused");
    focusWrap.classList.add("is-open");
    focusWrap.setAttribute("aria-hidden", "false");

    mode = prefersReduced ? "focused" : "in";
    if (prefersReduced) { ft = 1; applyFocus(); }
    backBtn.focus({ preventScroll: true });
  }

  function zoomOut() {
    if (mode !== "focused") return;
    hopping = false;
    focusWrap.classList.remove("is-open");
    focusWrap.setAttribute("aria-hidden", "true");
    mode = prefersReduced ? "orbit" : "out";
    if (prefersReduced) {
      ft = 0; applyFocus();
      focusOrb.style.display = "none";
      ctaMoon.style.display  = "none";
      map.classList.remove("is-focused");
    }
    if (focusIdx >= 0) PLANETS[focusIdx].el.focus({ preventScroll: true });
  }
  backBtn.addEventListener("click", zoomOut);
  document.addEventListener("keydown", e => { if (e.key === "Escape") zoomOut(); });

  function applyFocus() {
    const e   = easeInOut(ft);
    const to  = focusTarget();

    /* shift orbit centre right + shrink orbit scale — but NOT during hops
       (orbit is already fully shifted when a hop begins)               */
    if (!hopping) {
      const targetOrbitX = narrow ? cx : cx * 1.48; /* ≈ 74 % of width — shifts system right */
      orbitX    = lerp(cx,   targetOrbitX, e);
      orbitBase = lerp(base, base * 0.56,  e); /* 56 % of base — bigger right orbit, less crowding */
      updateRingsAndStar(orbitX, orbitBase);
    }

    /* focused orb: fly from orbit position → left target */
    const x   = lerp(from.x, to.x, e);
    const y   = lerp(from.y, to.y, e);
    const s   = lerp(from.s, 1,    e);
    const bob = ft >= 1 ? Math.sin(performance.now() * 0.0011) * 6 : 0;
    focusOrb.style.transform =
      `translate(-50%,-50%) translate(${x}px,${y + bob}px) scale(${s})`;

    /* position the text overlay centred over the orb */
    focusWrap.style.left  = x + "px";
    focusWrap.style.top   = (y + bob) + "px";
    focusWrap.style.width = Math.round(focusSize * 0.70) + "px";

    /* CTA moon orbits the focused left-side planet */
    const cR     = focusSize * 0.62;
    const mx     = to.x + Math.cos(ctaAngle) * cR;
    const my     = to.y + bob + Math.sin(ctaAngle) * cR * TILT;
    const mDepth = (Math.sin(ctaAngle) + 1) / 2;
    ctaMoon.style.transform =
      `translate(-50%,-50%) translate(${mx}px,${my}px) scale(${(0.8 + mDepth * 0.3) * (0.5 + e * 0.5)})`;
    ctaMoon.style.opacity       = e.toFixed(3);
    ctaMoon.style.zIndex        = mDepth > 0.5 ? "28" : "21";
    ctaMoon.style.pointerEvents = e > 0.8 ? "auto" : "none";

    /* star + rings: no extra dimming — they stay bright as the right-side system */
    star.style.opacity = "1";
    rings.forEach(r => (r.style.opacity = "1"));

    /* other planets: stay in their right-side orbits (NOT moons of focused planet) */
    PLANETS.forEach((p, k) => {
      if (k === focusIdx) {
        /* fade out the original planet button — the focusOrb replaces it */
        p.el.style.opacity       = Math.max(0, 1 - ft * 6).toFixed(3);
        p.el.style.pointerEvents = "none";
        return;
      }
      const curOrbit = orbitPos(p);
      if (hopping && p.hopFrom) {
        /* hop: animate from frozen position to current orbit */
        const px = lerp(p.hopFrom.x, curOrbit.x, e);
        const py = lerp(p.hopFrom.y, curOrbit.y, e);
        const ps = lerp(p.hopFrom.s, curOrbit.s, e);
        render(p, px, py, ps, 2 + Math.round(curOrbit.depth * 8));
      } else {
        render(p, curOrbit.x, curOrbit.y, curOrbit.s, 2 + Math.round(curOrbit.depth * 8));
      }
      p.el.style.opacity       = "1";
      p.el.style.pointerEvents = "auto";
    });
  }

  panel.cta.addEventListener("click", () => {
    const services = document.querySelectorAll("[data-service]");
    const target   = services[focusIdx];
    if (!target) return;
    document.querySelectorAll("[data-service].is-open").forEach(s => s.classList.remove("is-open"));
    target.classList.add("is-open");
  });

  if (prefersReduced) {
    orbitX = cx; orbitBase = base;
    PLANETS.forEach(pl => {
      const p = orbitPos(pl);
      render(pl, p.x, p.y, p.s, 2 + Math.round(p.depth * 8));
    });
    return;
  }

  /* ---- main loop ---- */
  let speedK = 1, targetK = 1, lastT = 0;
  map.addEventListener("mouseenter", () => (targetK = 0.12));
  map.addEventListener("mouseleave", () => (targetK = 1));

  function frame(now) {
    const dt = lastT ? Math.min(now - lastT, 50) : 16;
    lastT = now;

    const rect   = map.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < window.innerHeight;
    if (inView) {
      speedK += (targetK - speedK) * 0.06;
      for (const pl of PLANETS) pl.angle += pl.speed * dt * speedK;
      ctaAngle += dt * 0.00055 * speedK;

      if (mode === "in") {
        ft = Math.min(1, ft + dt / ZOOM_MS);
        if (ft >= 1) { mode = "focused"; hopping = false; }
        applyFocus();

      } else if (mode === "out") {
        ft = Math.max(0, ft - dt / ZOOM_MS);
        applyFocus();
        if (ft <= 0) {
          mode      = "orbit";
          orbitX    = cx;
          orbitBase = base;
          updateRingsAndStar(cx, base);
          focusOrb.style.display = "none";
          ctaMoon.style.display  = "none";
          map.classList.remove("is-focused");
          focusWrap.style.left  = "";
          focusWrap.style.top   = "";
          focusWrap.style.width = "";
        }

      } else if (mode === "focused") {
        applyFocus();

      } else {
        /* orbit mode */
        orbitX    = cx;
        orbitBase = base;
        for (const pl of PLANETS) {
          const p = orbitPos(pl);
          render(pl, p.x, p.y, p.s, 2 + Math.round(p.depth * 8));
          pl.el.style.opacity       = "1";
          pl.el.style.pointerEvents = "auto";
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
