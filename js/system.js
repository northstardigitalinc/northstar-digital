/* ============================================================
   NorthStar Digital — service system (interactive orbit map)
   Five planets, one per service, orbiting a gold north star.
   Click a planet → the camera zooms in on it (same eased feel
   as the black hole hero) and the briefing rises in beside it.
   The other four planets become moons of the focused planet —
   still orbiting, still clickable — so you can hop between
   services without leaving focus. Back / Esc reverses.
   ============================================================ */
(() => {
  "use strict";

  const map = document.getElementById("system-map");
  if (!map) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PLANETS = [
    {
      id: "ai", label: "AI Automation", skin: "s-orb--ai", size: 38,
      r: 0.34, phase: 0.6,
      kicker: "S·01 — AI Automation for Social Media",
      name: "Your brand, always on.",
      desc: "Intelligent automation that keeps your social presence active, engaging, and growing — 24/7, without the manual overhead. AI-driven content scheduling, automated engagement, and algorithmic audience growth.",
      tags: ["AI Scheduling", "Auto-Engagement", "Analytics", "Audience Growth"]
    },
    {
      id: "social", label: "Social Ads", skin: "s-orb--social", size: 32,
      r: 0.52, phase: 2.4,
      kicker: "S·02 — Social Media Promotions & Ads",
      name: "Precision targeting. Maximum returns.",
      desc: "Data-driven advertising campaigns across Instagram, Facebook, TikTok, LinkedIn, and beyond. We architect creative that converts — built around your audience's psychology and your competitors' gaps.",
      tags: ["Instagram", "Facebook", "TikTok", "LinkedIn"]
    },
    {
      id: "google", label: "Google", skin: "s-orb--gbp", size: 30,
      r: 0.70, phase: 4.1,
      kicker: "S·03 — Google Page Setup & Google Ads",
      name: "Capture intent. Win the search.",
      desc: "Complete Google Business Profile optimization paired with high-intent search and display advertising. Capture customers at the exact moment they're ready to buy.",
      tags: ["Business Profile", "Search Ads", "Display", "Shopping"]
    },
    {
      id: "web", label: "Websites", skin: "s-orb--web", size: 34,
      r: 0.90, phase: 1.3,
      kicker: "S·04 — Website Development",
      name: "Every pixel deliberate.",
      desc: "Bespoke websites designed and developed from the ground up — built for performance, conversion, and brand authority. No templates, no compromises. Every interaction guides visitors toward action.",
      tags: ["Custom Design", "Mobile-First", "SEO-Ready", "CMS"]
    }
  ];

  const TILT = 0.42;
  const ZOOM_MS = 760;
  const star = map.querySelector(".system__star");
  const focusWrap = document.getElementById("system-focus");
  const focusOrb = document.getElementById("system-focus-orb");
  const backBtn = document.getElementById("system-back");
  const ctaMoon = document.getElementById("cta-moon");
  const ctaOrb = ctaMoon.querySelector(".s-ctamoon__orb");
  let ctaAngle = 2.2;
  const panel = {
    kicker: document.getElementById("sp-kicker"),
    name: document.getElementById("sp-name"),
    desc: document.getElementById("sp-desc"),
    tags: document.getElementById("sp-tags"),
    cta: document.getElementById("sp-cta")
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
    pl.el = btn;
    pl.angle = pl.phase;
    pl.speed = 0.00022 / Math.pow(pl.r, 1.5); // Keplerian: inner = faster
    pl.cur = { x: 0, y: 0, s: 1 };            // last rendered position
  });

  /* geometry */
  let W = 0, H = 0, cx = 0, cy = 0, base = 0, focusSize = 0, narrow = false;
  function layout() {
    W = map.clientWidth;
    H = map.clientHeight;
    cx = W / 2;
    cy = H / 2;
    narrow = window.innerWidth < 900;
    base = Math.min(W / 2 - 44, (H / 2) / TILT - 44);
    focusSize = narrow ? Math.min(W * 0.62, H * 0.42) : Math.min(H * 0.68, W * 0.34);
    const ctaSize = Math.max(26, Math.round(focusSize * 0.15));
    ctaOrb.style.width = ctaSize + "px";
    ctaOrb.style.height = ctaSize + "px";
    rings.forEach((ring, i) => {
      const R = base * PLANETS[i].r;
      ring.style.width = R * 2 + "px";
      ring.style.height = R * 2 * TILT + "px";
    });
  }
  layout();
  window.addEventListener("resize", layout);

  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => t * t * (3 - 2 * t);

  function focusTarget() {
    return narrow
      ? { x: cx, y: H * 0.3 }
      : { x: W * 0.72, y: H * 0.5 };
  }

  function orbitPos(pl) {
    const R = base * pl.r;
    const x = cx + Math.cos(pl.angle) * R;
    const y = cy + Math.sin(pl.angle) * R * TILT;
    const depth = (Math.sin(pl.angle) + 1) / 2;
    return { x, y, s: 0.78 + depth * 0.34, depth };
  }

  // moon position around the focused planet
  function moonPos(pl, idxAmong) {
    const t = focusTarget();
    const R = focusSize * (0.66 + idxAmong * 0.13);
    const x = t.x + Math.cos(pl.angle) * R;
    const y = t.y + Math.sin(pl.angle) * R * TILT;
    const depth = (Math.sin(pl.angle) + 1) / 2;
    return { x, y, s: 0.7 + depth * 0.25, depth };
  }

  function render(pl, x, y, s, z) {
    pl.el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${s})`;
    pl.el.style.zIndex = String(z);
    pl.cur.x = x; pl.cur.y = y; pl.cur.s = s;
  }

  /* ---------- focus / zoom state machine ---------- */
  // mode: orbit | in | focused | out ; ft: 0 (orbit) → 1 (focused)
  let mode = "orbit";
  let ft = 0;
  let focusIdx = -1;
  let from = { x: 0, y: 0, s: 0.1 };
  let hopping = false; // true while morphing between two focused planets

  function setPanel(i) {
    const pl = PLANETS[i];
    panel.kicker.textContent = pl.kicker;
    panel.name.textContent = pl.name;
    panel.desc.textContent = pl.desc;
    panel.tags.innerHTML = pl.tags.map((t) => `<span class="pill">${t}</span>`).join("");
  }

  function retriggerText() {
    focusWrap.classList.remove("is-open");
    void focusWrap.offsetWidth; // restart the rise transition
    focusWrap.classList.add("is-open");
  }

  function zoomIn(i) {
    if (mode === "in" || mode === "out") return;
    if (mode === "focused") {
      if (i === focusIdx) return;
      // hop from one planet to another: launch from its moon position
      from = { x: PLANETS[i].cur.x, y: PLANETS[i].cur.y, s: (PLANETS[i].size * PLANETS[i].cur.s) / focusSize };
      const t = focusTarget();
      PLANETS.forEach((p, k) => {
        // moons re-shuffle from where they are now; the old focus planet
        // emerges out of the departing big sphere
        p.hopFrom = k === focusIdx
          ? { x: t.x, y: t.y, s: 1, depth: 0.5 }
          : { x: p.cur.x, y: p.cur.y, s: p.cur.s, depth: 0.5 };
      });
      hopping = true;
      focusIdx = i;
      setPanel(i);
      focusOrb.className = "system__focus-orb " + PLANETS[i].skin;
      retriggerText();
      ft = 0;
      mode = prefersReduced ? "focused" : "in";
      if (prefersReduced) { ft = 1; applyFocus(); }
      return;
    }
    focusIdx = i;
    const pl = PLANETS[i];
    const p = orbitPos(pl);
    from = { x: p.x, y: p.y, s: (pl.size * p.s) / focusSize };
    setPanel(i);
    focusOrb.className = "system__focus-orb " + pl.skin;
    focusOrb.style.width = focusSize + "px";
    focusOrb.style.height = focusSize + "px";
    focusOrb.style.display = "block";
    ctaMoon.style.display = "flex";
    map.classList.add("is-focused");
    focusWrap.classList.add("is-open");
    focusWrap.setAttribute("aria-hidden", "false");
    mode = prefersReduced ? "focused" : "in";
    if (prefersReduced) { ft = 1; applyFocus(); }
    backBtn.focus({ preventScroll: true });
  }

  function zoomOut() {
    if (mode !== "focused") return;
    hopping = false; // moons return to their true star orbits
    focusWrap.classList.remove("is-open");
    focusWrap.setAttribute("aria-hidden", "true");
    mode = prefersReduced ? "orbit" : "out";
    if (prefersReduced) { ft = 0; applyFocus(); focusOrb.style.display = "none"; ctaMoon.style.display = "none"; map.classList.remove("is-focused"); }
    if (focusIdx >= 0) PLANETS[focusIdx].el.focus({ preventScroll: true });
  }
  backBtn.addEventListener("click", zoomOut);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") zoomOut();
  });

  function applyFocus() {
    const e = easeInOut(ft);
    const to = focusTarget();
    const x = lerp(from.x, to.x, e);
    const y = lerp(from.y, to.y, e);
    const s = lerp(from.s, 1, e);
    const bob = ft >= 1 ? Math.sin(performance.now() * 0.0011) * 6 : 0;
    focusOrb.style.transform =
      `translate(-50%, -50%) translate(${x}px, ${y + bob}px) scale(${s})`;

    // "Get Service Now" moon hugs the focused planet on a close orbit
    const cR = focusSize * 0.58;
    const mx = to.x + Math.cos(ctaAngle) * cR;
    const my = to.y + bob + Math.sin(ctaAngle) * cR * TILT;
    const mDepth = (Math.sin(ctaAngle) + 1) / 2;
    ctaMoon.style.transform =
      `translate(-50%, -50%) translate(${mx}px, ${my}px) scale(${(0.8 + mDepth * 0.3) * (0.5 + e * 0.5)})`;
    ctaMoon.style.opacity = e.toFixed(3);
    ctaMoon.style.zIndex = mDepth > 0.5 ? "28" : "21";
    ctaMoon.style.pointerEvents = e > 0.8 ? "auto" : "none";

    // star + rings fall away; other planets become moons and stay live
    const dim = 1 - Math.min(1, e * 1.3);
    star.style.opacity = dim.toFixed(3);
    rings.forEach((r) => (r.style.opacity = dim.toFixed(3)));

    let idxAmong = 0;
    PLANETS.forEach((p, k) => {
      if (k === focusIdx) {
        p.el.style.opacity = Math.max(0, 1 - ft * 6).toFixed(3);
        p.el.style.pointerEvents = "none";
        return;
      }
      const o = hopping && p.hopFrom ? p.hopFrom : orbitPos(p);
      const m = moonPos(p, idxAmong++);
      const px = lerp(o.x, m.x, e);
      const py = lerp(o.y, m.y, e);
      const ps = lerp(o.s, m.s, e);
      const depth = lerp(o.depth, m.depth, e);
      // in front of the big planet on the near side, behind it on the far side
      const z = e > 0.5 ? (depth > 0.5 ? 27 : 20) : 2 + Math.round(depth * 8);
      render(p, px, py, ps, z);
      p.el.style.opacity = "1";
      p.el.style.pointerEvents = "auto";
    });
  }

  panel.cta.addEventListener("click", () => {
    const services = document.querySelectorAll("[data-service]");
    const target = services[focusIdx];
    if (!target) return;
    document.querySelectorAll("[data-service].is-open").forEach((s) => s.classList.remove("is-open"));
    target.classList.add("is-open");
  });

  if (prefersReduced) {
    PLANETS.forEach((pl) => { const p = orbitPos(pl); render(pl, p.x, p.y, p.s, 2 + Math.round(p.depth * 8)); });
    return;
  }

  /* main loop — orbits + zoom scrub, slow-motion on hover */
  let speedK = 1, targetK = 1, lastT = 0;
  map.addEventListener("mouseenter", () => (targetK = 0.12));
  map.addEventListener("mouseleave", () => (targetK = 1));

  function frame(now) {
    const dt = lastT ? Math.min(now - lastT, 50) : 16;
    lastT = now;

    const rect = map.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < window.innerHeight;
    if (inView) {
      speedK += (targetK - speedK) * 0.06;
      // angles keep advancing in every mode; moons run a little livelier
      for (const pl of PLANETS) {
        const moonBoost = mode !== "orbit" ? 2.1 : 1;
        pl.angle += pl.speed * dt * speedK * moonBoost;
      }
      ctaAngle += dt * 0.00055 * speedK;

      if (mode === "in") {
        ft = Math.min(1, ft + dt / ZOOM_MS);
        if (ft >= 1) mode = "focused";
        applyFocus();
      } else if (mode === "out") {
        ft = Math.max(0, ft - dt / ZOOM_MS);
        applyFocus();
        if (ft <= 0) {
          mode = "orbit";
          focusOrb.style.display = "none";
          ctaMoon.style.display = "none";
          map.classList.remove("is-focused");
        }
      } else if (mode === "focused") {
        applyFocus();
      } else {
        for (const pl of PLANETS) {
          const p = orbitPos(pl);
          render(pl, p.x, p.y, p.s, 2 + Math.round(p.depth * 8));
          pl.el.style.opacity = "1";
          pl.el.style.pointerEvents = "auto";
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
