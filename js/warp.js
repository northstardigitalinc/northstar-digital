/* ============================================================
   NorthStar Digital — space warp page transition
   Exit (→ portfolio): stars rush from centre outward at
   warp speed, gold flash, then navigate.
   Enter (portfolio load): dropping out of warp — stars
   decelerate from light-speed to stillness, overlay fades.
   ============================================================ */
(() => {
  "use strict";

  const overlay = document.getElementById("warp-overlay");
  if (!overlay) return;
  const canvas = document.getElementById("warp-canvas");
  const ctx = canvas.getContext("2d");

  let W, H, cx, cy;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
  }
  window.addEventListener("resize", resize);
  resize();

  const N = 320;

  function makeStar(dOverride) {
    return {
      angle: Math.random() * Math.PI * 2,
      d: dOverride ?? (Math.random() * 0.12),
      speed: 0.0014 + Math.random() * 0.003,
      w: 0.35 + Math.random() * 1.5,
      bright: 0.45 + Math.random() * 0.55
    };
  }

  let stars = Array.from({ length: N }, () => makeStar());
  let raf = 0;
  let phase = "idle"; // "exit" | "enter" | "idle"
  let t = 0;
  let dest = null;

  function mR() { return Math.hypot(cx, cy) * 1.18; }

  function frame() {
    raf = requestAnimationFrame(frame);
    const R = mR();

    if (phase === "exit")  t += 0.025;
    if (phase === "enter") t += 0.055; // ~0.3 s — short decel reveal

    // speed multiplier
    const sp =
      phase === "exit"  ? 1 + t * 32 :
      phase === "enter" ? Math.max(0.8, 22 * Math.pow(1 - t, 1.6)) :
      1;

    ctx.fillStyle = `rgba(4,6,15,${phase === "idle" ? 0.0 : 0.20})`;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      s.d += s.speed * sp;
      if (s.d > 1.1) {
        Object.assign(s, makeStar(0.02 + Math.random() * 0.06));
        continue;
      }
      const r  = s.d * R;
      const pr = Math.max(0, s.d - s.speed * sp * 8) * R;
      const x1 = cx + Math.cos(s.angle) * pr;
      const y1 = cy + Math.sin(s.angle) * pr;
      const x2 = cx + Math.cos(s.angle) * r;
      const y2 = cy + Math.sin(s.angle) * r;
      const alpha = Math.min(1, s.d * 1.9) * s.bright;
      ctx.strokeStyle = `rgba(225,215,200,${alpha})`;
      ctx.lineWidth = s.w * Math.min(3, sp * 0.09 + 0.92);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    if (phase === "exit" && t >= 1) {
      cancelAnimationFrame(raf);
      raf = 0;
      window.location.href = dest;
      return;
    }

    if (phase === "enter" && t >= 1) {
      overlay.style.transition = "opacity 0.65s ease";
      overlay.style.opacity   = "0";
      overlay.style.pointerEvents = "none";
      cancelAnimationFrame(raf);
      raf   = 0;
      phase = "idle";
    }
  }

  const warp = {
    exit(href) {
      if (phase !== "idle") return;
      dest  = href;
      phase = "exit";
      t     = 0;
      stars = Array.from({ length: N }, () => makeStar());
      ctx.clearRect(0, 0, W, H);
      overlay.style.transition    = "none";
      overlay.style.opacity       = "1";
      overlay.style.pointerEvents = "all";
      raf = requestAnimationFrame(frame);
    },
    enter() {
      phase = "enter";
      t     = 0;
      // stars start at random distances across the field — already at warp
      stars = Array.from({ length: N }, () => makeStar(0.04 + Math.random() * 0.88));
      overlay.style.transition    = "none";
      overlay.style.opacity       = "1";
      overlay.style.pointerEvents = "all";
      ctx.fillStyle = "#04060f";
      ctx.fillRect(0, 0, W, H);
      raf = requestAnimationFrame(frame);
    }
  };

  // Intercept any link with data-warp-to attribute
  document.querySelectorAll("[data-warp-to]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      warp.exit(a.dataset.warpTo || a.getAttribute("href"));
    });
  });

  // Auto-enter animation on portfolio page
  if (document.body.dataset.page === "portfolio") {
    warp.enter();
  }
})();
