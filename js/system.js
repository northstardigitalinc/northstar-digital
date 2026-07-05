/* ============================================================
   NorthStar Digital — service worlds
   Four real planets (Jupiter, Uranus, Mars, Earth) float on
   the stage, each labelled with its service and circled by
   moons at all times.  Click one → the service description
   slides in on the LEFT, the clicked planet shrinks and hovers
   beside it, and the other three line up on the RIGHT — still
   floating, still clickable.
   ============================================================ */
(() => {
  "use strict";

  const stage = document.getElementById("system-stage");
  if (!stage) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SERVICES = [
    {
      id: "ai", planet: "p-jupiter", label: "AI Automation",
      kicker: "S·01 — AI Automation",
      name: "Your brand, always on.",
      desc: "Intelligent automation that keeps your social presence active and growing — 24/7, without the manual overhead. AI-driven scheduling, automated engagement, and algorithmic audience growth.",
      tags: ["AI Scheduling", "Auto-Engagement", "Analytics", "Audience Growth"],
      idle:  { x: 15, y: 38, size: 168 },
      idleM: { x: 27, y: 16, size: 108 },
      twoMoons: true
    },
    {
      id: "social", planet: "p-uranus", label: "Social Ads",
      kicker: "S·02 — Social Media Ads",
      name: "Precision targeting. Maximum returns.",
      desc: "Data-driven campaigns across Instagram, Facebook, TikTok, and LinkedIn — creative that converts, built around your audience's psychology and your competitors' gaps.",
      tags: ["Instagram", "Facebook", "TikTok", "LinkedIn"],
      idle:  { x: 41, y: 68, size: 132 },
      idleM: { x: 75, y: 30, size: 92 }
    },
    {
      id: "google", planet: "p-mars", label: "Google",
      kicker: "S·03 — Google & Search",
      name: "Capture intent. Win the search.",
      desc: "Business Profile optimization paired with high-intent search and display advertising. Capture customers at the exact moment they're ready to buy.",
      tags: ["Business Profile", "Search Ads", "Display", "Shopping"],
      idle:  { x: 64, y: 28, size: 108 },
      idleM: { x: 26, y: 62, size: 84 }
    },
    {
      id: "web", planet: "p-earth", label: "Websites",
      kicker: "S·04 — Web Development",
      name: "Every pixel deliberate.",
      desc: "Bespoke websites built from the ground up — performance-optimized, conversion-focused. No templates. Every interaction guides visitors toward action.",
      tags: ["Custom Design", "Mobile-First", "SEO-Ready", "CMS"],
      idle:  { x: 87, y: 58, size: 128 },
      idleM: { x: 74, y: 74, size: 96 }
    }
  ];

  /* focused-state slots */
  const ACTIVE_D  = { x: 60, y: 50, size: 118 };            /* small, beside the description */
  const OTHERS_D  = [                                        /* right-side column */
    { x: 86, y: 18, size: 82 },
    { x: 86, y: 50, size: 82 },
    { x: 86, y: 80, size: 82 }
  ];
  const ACTIVE_M  = { x: 50, y: 7, size: 70 };
  const OTHERS_M  = [
    { x: 20, y: 93, size: 56 },
    { x: 50, y: 93, size: 56 },
    { x: 80, y: 93, size: 56 }
  ];

  const info = {
    wrap:   document.getElementById("system-info"),
    kicker: document.getElementById("sp-kicker"),
    name:   document.getElementById("sp-name"),
    desc:   document.getElementById("sp-desc"),
    tags:   document.getElementById("sp-tags"),
    cta:    document.getElementById("sp-cta"),
    back:   document.getElementById("system-back")
  };

  /* build planet buttons */
  SERVICES.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "s-planet";
    btn.setAttribute("aria-label", `${s.label} — click to learn more`);
    btn.innerHTML =
      `<span class="s-planet__float" style="--float-t:${(6.2 + i * 1.3).toFixed(1)}s;--float-d:${(-i * 1.8).toFixed(1)}s">` +
        `<span class="s-planet__orb ${s.planet}">` +
          `<span class="s-moonpath" style="--moon-t:${(7.5 + i * 2.2).toFixed(1)}s"></span>` +
          (s.twoMoons ? `<span class="s-moonpath s-moonpath--b" style="--moon-t2:${(12 + i * 2).toFixed(1)}s"></span>` : "") +
          `<span class="s-planet__hint">Click me<br>to learn more</span>` +
        `</span>` +
      `</span>` +
      `<span class="s-planet__label">${s.label}</span>`;
    btn.addEventListener("click", () => (activeIdx === i ? close() : open(i)));
    stage.appendChild(btn);
    s.el  = btn;
    s.orb = btn.querySelector(".s-planet__orb");
  });

  let activeIdx = -1;

  function narrow() { return window.innerWidth < 900; }

  function layout() {
    const m = narrow();
    let slot = 0;
    SERVICES.forEach((s, i) => {
      let p;
      if (activeIdx < 0)       p = m ? s.idleM : s.idle;
      else if (i === activeIdx) p = m ? ACTIVE_M : ACTIVE_D;
      else                      p = (m ? OTHERS_M : OTHERS_D)[slot++];
      s.el.style.left   = p.x + "%";
      s.el.style.top    = p.y + "%";
      s.orb.style.width  = p.size + "px";
      s.orb.style.height = p.size + "px";
      s.el.classList.toggle("is-active", i === activeIdx);
      s.el.style.zIndex = i === activeIdx ? "14" : "10";
    });
  }

  function setInfo(i) {
    const s = SERVICES[i];
    info.kicker.textContent   = s.kicker;
    info.name.textContent     = s.name;
    info.desc.textContent     = s.desc;
    info.tags.innerHTML       = s.tags.map(t => `<span class="pill">${t}</span>`).join("");
    info.wrap.dataset.svc = s.id;
  }

  function open(i) {
    const swapping = activeIdx >= 0;
    activeIdx = i;
    setInfo(i);
    if (swapping && !prefersReduced) {
      /* re-trigger the panel fade so the new text slides in */
      stage.classList.remove("is-open");
      void info.wrap.offsetWidth;
    }
    stage.classList.add("is-open");
    info.wrap.setAttribute("aria-hidden", "false");
    layout();
  }

  function close() {
    if (activeIdx < 0) return;
    const el = SERVICES[activeIdx].el;
    activeIdx = -1;
    stage.classList.remove("is-open");
    info.wrap.setAttribute("aria-hidden", "true");
    layout();
    el.focus({ preventScroll: true });
  }

  info.back.addEventListener("click", close);
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  /* "Full details" — opens the matching accordion in the services section */
  info.cta.addEventListener("click", () => {
    if (activeIdx < 0) return;
    const target = document.querySelectorAll("section.services .service")[activeIdx];
    if (!target) return;
    document.querySelectorAll("section.services .service.is-open").forEach(s => s.classList.remove("is-open"));
    target.classList.add("is-open");
  });

  window.addEventListener("resize", layout);
  layout();
})();
