/* ============================================================
   NorthStar Digital — starfield, shooting stars, interactions
   ============================================================ */
(() => {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = document.documentElement.classList.contains("is-touch");

  /* ---------- Starfield canvas ---------- */
  const canvas = document.getElementById("starfield");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1;
  let stars = [];
  let shooters = [];
  const mouse = { x: 0.5, y: 0.5 };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildStars();
  }

  function buildStars() {
    /* touch devices get roughly half the stars — GPU + battery friendly */
    const count = Math.min(Math.floor((W * H) / (isTouch ? 6000 : 3200)), isTouch ? 240 : 520);
    // real stellar tints: white, ice-blue, cyan, champagne, warm orange
    const TINTS = [
      { rgb: "226, 232, 248", w: 0.55 },
      { rgb: "168, 200, 255", w: 0.18 },
      { rgb: "140, 226, 235", w: 0.10 },
      { rgb: "232, 200, 126", w: 0.10 },
      { rgb: "255, 178, 128", w: 0.07 }
    ];
    const pickTint = () => {
      let r = Math.random(), acc = 0;
      for (const t of TINTS) { acc += t.w; if (r <= acc) return t.rgb; }
      return TINTS[0].rgb;
    };
    stars = Array.from({ length: count }, () => {
      const depth = Math.random(); // 0 far — 1 near
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.3 + depth * 1.25,
        depth,
        base: 0.25 + Math.random() * 0.65,
        tw: 0.5 + Math.random() * 2.2,      // twinkle speed
        ph: Math.random() * Math.PI * 2,    // twinkle phase
        rgb: pickTint()
      };
    });
  }

  // meteor tints: champagne (common), ice blue, cyan, ember, white
  const SHOOT_COLS = [
    "245, 223, 168", "245, 223, 168", "245, 223, 168",
    "168, 200, 255", "140, 226, 235", "255, 168, 110", "240, 240, 250"
  ];
  function spawnShooter(fromX, fromY) {
    const angle = Math.PI * (0.12 + Math.random() * 0.16); // shallow diagonal
    const speed = 9 + Math.random() * 7;
    shooters.push({
      x: fromX !== undefined ? fromX : Math.random() * W * 0.8,
      y: fromY !== undefined ? fromY : Math.random() * H * 0.4,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.012 + Math.random() * 0.008,
      col: SHOOT_COLS[(Math.random() * SHOOT_COLS.length) | 0],
      trail: [] // recent positions — tails follow the curved path
    });
  }

  let t = 0;
  function frame() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);

    // parallax offset from mouse
    const px = (mouse.x - 0.5), py = (mouse.y - 0.5);

    for (const s of stars) {
      const a = s.base * (0.6 + 0.4 * Math.sin(t * s.tw + s.ph));
      const ox = px * s.depth * 26;
      const oy = py * s.depth * 26;
      ctx.beginPath();
      ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.rgb}, ${a})`;
      ctx.fill();
    }

    // shooting stars — deflected by the black hole's gravity
    const bh = window.__blackHole;
    for (let i = shooters.length - 1; i >= 0; i--) {
      const sh = shooters[i];

      if (bh) {
        const dx = bh.x - sh.x, dy = bh.y - sh.y;
        const d2 = dx * dx + dy * dy;
        const d = Math.sqrt(d2);
        if (d < bh.r * 1.04) { shooters.splice(i, 1); continue; } // crossed the horizon
        // inverse-square pull, strength scales with the hole's apparent size
        const a = Math.min((bh.r * bh.r * 0.3) / d2, 2.4);
        sh.vx += (a * dx) / d;
        sh.vy += (a * dy) / d;
        const sp = Math.hypot(sh.vx, sh.vy);
        if (sp > 20) { sh.vx *= 20 / sp; sh.vy *= 20 / sp; } // relativistic-ish speed cap
      }

      sh.x += sh.vx;
      sh.y += sh.vy;
      sh.trail.push(sh.x, sh.y);
      if (sh.trail.length > 48) sh.trail.splice(0, 2);
      sh.life -= sh.decay;
      if (sh.life <= 0 || sh.x > W + 300 || sh.x < -300 || sh.y > H + 300 || sh.y < -300) {
        shooters.splice(i, 1);
        continue;
      }

      // tail traces the actual (possibly bent) trajectory
      const tr = sh.trail;
      const n = tr.length / 2;
      for (let k = 1; k < n; k++) {
        const f = k / n;
        ctx.strokeStyle = `rgba(${sh.col}, ${(f * f * 0.85 * sh.life).toFixed(3)})`;
        ctx.lineWidth = 0.4 + f * 1.4;
        ctx.beginPath();
        ctx.moveTo(tr[(k - 1) * 2], tr[(k - 1) * 2 + 1]);
        ctx.lineTo(tr[k * 2], tr[k * 2 + 1]);
        ctx.stroke();
      }
      // bright head
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${sh.col}, ${sh.life})`;
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);

  if (!prefersReduced) {
    requestAnimationFrame(frame);
    // ambient shooting stars — frequent, occasionally in pairs
    (function ambient() {
      spawnShooter();
      if (!isTouch && Math.random() < 0.35) {
        setTimeout(() => spawnShooter(), 250 + Math.random() * 500);
      }
      const base = isTouch ? 2600 : 1200;
      setTimeout(ambient, base + Math.random() * 2600);
    })();
  } else {
    // static star render for reduced motion
    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.rgb}, ${s.base})`;
      ctx.fill();
    }
  }

  // click anywhere on background → shooting star from that point
  document.addEventListener("click", (e) => {
    if (prefersReduced) return;
    if (e.target.closest("a, button, .service")) return;
    spawnShooter(e.clientX, e.clientY);
  });

  /* ---------- Cursor glow + mouse parallax ---------- */
  const glow = document.querySelector(".cursor-glow");
  document.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = e.clientY / window.innerHeight;
    if (glow && !prefersReduced) {
      glow.style.left = e.clientX + "px";
      glow.style.top = e.clientY + "px";
    }
  }, { passive: true });

  /* ---------- Mobile menu (hamburger) ---------- */
  const burger = document.getElementById("nav-burger");
  if (burger) {
    const setMenu = (open) => {
      document.body.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
    document.querySelectorAll(".nav__links a").forEach((a) =>
      a.addEventListener("click", () => setMenu(false))
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenu(false);
    });
  }

  /* ---------- Nav scroll state ---------- */
  const nav = document.getElementById("nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Nav scrollspy (tabs) ---------- */
  const spyLinks = document.querySelectorAll(".nav__links a[data-spy]");
  if (spyLinks.length) {
    const sections = [
      { id: "contact", el: document.getElementById("contact") },
      { id: "portfolio", el: document.getElementById("portfolio") },
      { id: "services", el: document.getElementById("services") }
    ].filter(s => s.el);
    const spy = () => {
      const mark = window.scrollY + window.innerHeight * 0.4;
      let active = "top";
      for (const s of sections) {
        if (mark >= s.el.offsetTop) { active = s.id; break; }
      }
      spyLinks.forEach(a => a.classList.toggle("is-active", a.dataset.spy === active));
    };
    window.addEventListener("scroll", spy, { passive: true });
    spy();
  }

  /* ---------- Scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("is-in");
        io.unobserve(en.target);
      }
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal, .path__step").forEach((el) => io.observe(el));

  /* ---------- Flight path progress line ---------- */
  const path = document.querySelector(".path");
  if (path) {
    const updatePath = () => {
      const rect = path.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = Math.min(Math.max((vh * 0.75 - rect.top) / rect.height, 0), 1);
      path.style.setProperty("--path-progress", (progress * 100).toFixed(1) + "%");
    };
    window.addEventListener("scroll", updatePath, { passive: true });
    updatePath();
  }

  /* ---------- Services accordion ---------- */
  document.querySelectorAll("[data-service]").forEach((service) => {
    service.querySelector(".service__row").addEventListener("click", () => {
      const open = service.classList.contains("is-open");
      document.querySelectorAll("[data-service].is-open").forEach((s) => s.classList.remove("is-open"));
      if (!open) service.classList.add("is-open");
    });
  });

  /* ---------- Inquiry form → pre-filled email ---------- */
  const form = document.getElementById("inquiry-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const d = new FormData(form);
      const subject = `Inquiry — ${d.get("service")} (${d.get("name")})`;
      const body = [
        `Name: ${d.get("name")}`,
        `Email: ${d.get("email")}`,
        `Phone: ${d.get("phone") || "—"}`,
        `Service: ${d.get("service")}`,
        "",
        `${d.get("message")}`
      ].join("\n");
      window.location.href =
        `mailto:northstardigitalinc@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const note = document.getElementById("inquiry-note");
      if (note) note.textContent = "Your email app should now be open — just hit send.";
    });
  }

  /* ---------- Calendly popup on CTA buttons ---------- */
  const CALENDLY_URL =
    "https://calendly.com/northstardigitalinc/30min?hide_gdpr_banner=1&background_color=0a0e1d&text_color=e9ecf5&primary_color=e8c87e";
  document.querySelectorAll("[data-calendly]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (window.Calendly) {
        e.preventDefault();
        window.Calendly.initPopupWidget({ url: CALENDLY_URL });
      }
      // if the Calendly script hasn't loaded, fall through to #booking anchor
    });
  });

  /* ---------- Magnetic buttons ---------- */
  if (!prefersReduced && matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = "";
      });
    });
  }
})();
