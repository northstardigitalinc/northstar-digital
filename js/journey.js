/* ============================================================
   NorthStar Digital — black hole journey (WebGL ray tracer)
   Real gravitational lensing: rays are integrated through a
   Schwarzschild-style field, so the photon ring and the bent
   far-side disk arcs emerge from the physics. Rendered per
   pixel at native resolution — crisp at every zoom.
   Scroll drives camera framing (center / radius uniforms).
   ============================================================ */
(() => {
  "use strict";

  const journey = document.querySelector(".journey");
  if (!journey) return;

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("planet");
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false
  });

  if (prefersReduced || !gl) {
    journey.classList.add("journey--static");
    return;
  }

  const space = document.getElementById("journey-space");
  const stageHero = journey.querySelector(".j-stage--hero");
  const stageSplit = journey.querySelector(".j-stage--split");
  const stageSurface = journey.querySelector(".j-stage--surface");
  const neighbors = journey.querySelectorAll(".j-neighbor");
  const scrollcue = document.getElementById("scrollcue");

  /* ---------- Shaders ---------- */
  const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  const FRAG = `
precision highp float;

uniform vec2  u_res;      // canvas size (px)
uniform vec2  u_center;   // hole center (px, bottom-left origin)
uniform float u_radius;   // shadow radius (px)
uniform float u_time;     // disk swirl time
uniform float u_fade;     // 0..1 fade to page background

const vec3  BG      = vec3(0.0157, 0.0235, 0.0588); // #04060f
const float DISK_IN  = 1.45;   // disk inner edge (world units, rs = 1)
const float DISK_OUT = 6.2;    // disk outer edge
const float SHADOW   = 2.6;    // apparent shadow radius for rs = 1

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// emission where a ray crosses the equatorial disk
vec3 diskEmit(vec3 hit, vec3 rd) {
  float hr = length(hit.xz);
  float edge = smoothstep(DISK_IN, DISK_IN + 0.22, hr) *
               (1.0 - smoothstep(DISK_OUT - 1.6, DISK_OUT, hr));
  if (edge <= 0.001) return vec3(0.0);

  // differential rotation + trailing log-spiral shear -> plasma streaks
  float om = 1.15 / pow(hr, 1.5);
  vec2 rp = rot(om * u_time * 6.0 + 3.1 * log(hr)) * hit.xz;
  float streak = fbm(vec3(rp * vec2(1.15, 1.15), 2.7));
  streak = pow(streak, 1.9) * 2.6 + 0.14;

  // radial brightness: white-hot inner edge, falls off outward
  float radial = pow(DISK_IN / hr, 2.3) * 3.6;

  // doppler beaming: material orbits ccw; approaching side flares
  float beta = 0.42 / sqrt(hr);
  vec3 tang = normalize(vec3(-hit.z, 0.0, hit.x));
  float dop = pow(1.0 + beta * dot(tang, -rd), 3.0);

  // temperature ramp
  float tq = clamp((hr - DISK_IN) / (DISK_OUT - DISK_IN), 0.0, 1.0);
  vec3 cIn  = vec3(1.18, 0.9, 0.6);
  vec3 cMid = vec3(1.12, 0.42, 0.1);
  vec3 cOut = vec3(0.5, 0.1, 0.03);
  vec3 col = mix(cIn, cMid, smoothstep(0.02, 0.34, tq));
  col = mix(col, cOut, smoothstep(0.32, 1.0, tq));
  // approaching side runs hotter
  col = mix(col, vec3(1.15, 0.78, 0.45), clamp((dop - 1.0) * 0.25, 0.0, 0.3));

  return col * streak * radial * dop * edge;
}

void main() {
  // pixel -> angular offset in units of the shadow radius
  vec2 q = (gl_FragCoord.xy - u_center) / u_radius;

  // camera: slightly above the disk plane, tilted like the reference
  vec3 ro = vec3(0.0, 1.9, -16.0);
  vec3 ta = vec3(0.0, 0.0, 0.0);
  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  float roll = -0.14;
  vec3 rt2 = rt * cos(roll) + up * sin(roll);
  vec3 up2 = -rt * sin(roll) + up * cos(roll);

  // angular scale so |q| = 1 lands on the shadow edge
  float ang = SHADOW / length(ro);
  vec3 rd = normalize(fw + q.x * ang * rt2 + q.y * ang * up2);

  vec3 p = ro;
  vec3 v = rd;
  vec3 col = vec3(0.0);
  float captured = 0.0;

  vec3 hvec = cross(p, v);
  float h2 = dot(hvec, hvec);

  for (int i = 0; i < 72; i++) {
    float r2 = dot(p, p);
    float r = sqrt(r2);
    if (r < 1.0) { captured = 1.0; break; }
    if (r > 34.0 && dot(p, v) > 0.0) break;

    float dt = clamp(r * 0.14, 0.045, 0.6);
    // null-geodesic bending (Paczynski-style approximation)
    vec3 a = -1.5 * h2 * p / (r2 * r2 * r);
    vec3 pn = p + v * dt + 0.5 * a * dt * dt;
    vec3 vn = normalize(v + a * dt);

    // disk plane crossing
    if (p.y * pn.y < 0.0) {
      float f = p.y / (p.y - pn.y);
      vec3 hit = mix(p, pn, f);
      col += diskEmit(hit, vn);
    }
    p = pn;
    v = vn;
  }

  // hue-preserving compression — highlights stay molten orange
  col *= vec3(1.06, 0.97, 0.9);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col *= 2.6 / (1.0 + l);
  col = 1.0 - exp(-col * 1.2);
  // saturation push — keep the plasma molten, not pastel
  float l2 = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = clamp(mix(vec3(l2), col, 1.35), 0.0, 1.0);
  // warm haze hugging the shadow (photon-sphere bloom)
  float qr = length(q);
  col += vec3(1.0, 0.5, 0.2) * 0.05 / (abs(qr - 1.02) * 5.0 + 0.14)
         * (1.0 - captured) * smoothstep(3.0, 1.0, qr);

  float lum = max(col.r, max(col.g, col.b));
  float alpha = max(captured, clamp(lum * 1.35, 0.0, 1.0));
  alpha = mix(alpha, 1.0, u_fade);
  vec3 outCol = mix(col + BG * captured, BG, u_fade);

  // premultiplied alpha output
  gl_FragColor = vec4(outCol * alpha, alpha);
}
`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { journey.classList.add("journey--static"); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const locPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(locPos);
  gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 0, 0);

  const U = {
    res: gl.getUniformLocation(prog, "u_res"),
    center: gl.getUniformLocation(prog, "u_center"),
    radius: gl.getUniformLocation(prog, "u_radius"),
    time: gl.getUniformLocation(prog, "u_time"),
    fade: gl.getUniformLocation(prog, "u_fade")
  };

  /* ---------- Layout ---------- */
  let vw = 0, vh = 0, dpr = 1;
  function layout() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + "px";
    canvas.style.height = vh + "px";
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  layout();
  window.addEventListener("resize", layout);

  /* ---------- Scrub ---------- */
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const easeInOut = (t) => t * t * (3 - 2 * t);
  const easeIn = (t) => t * t;
  const seg = (p, a, b) => clamp01((p - a) / (b - a));

  function setStage(el, opacity, rise) {
    el.style.opacity = opacity.toFixed(3);
    el.style.pointerEvents = opacity > 0.55 ? "auto" : "none";
    if (rise !== undefined) el.style.transform = `translateY(${rise}px)`;
  }

  let diskTime = 0;
  let lastT = 0;

  function frame(now) {
    const dt = lastT ? Math.min(now - lastT, 50) : 16;
    lastT = now;

    const rect = space.getBoundingClientRect();
    const total = rect.height - vh;
    const p = clamp01(-rect.top / total);
    const inView = rect.bottom > 0 && rect.top < vh;

    if (inView) {
      diskTime += dt * 0.000135;

      const M = Math.max(vw, vh);
      /* Shadow-radius keyframes (px):
         hero:  crest rising past the bottom edge
         split: full system at ~55% vw on the right
         dive:  shadow swallows the viewport               */
      const r0 = M * 0.34;
      // split-phase size: dominate on wide screens, clear the text column on narrow
      const r1 = vw * (vw >= 1100 ? 0.15 : 0.12);
      const cx1 = vw * (vw >= 1100 ? 0.76 : 0.72);
      const r2 = Math.hypot(vw, vh) * 0.62;

      const t1 = easeInOut(seg(p, 0.0, 0.34));
      const t2 = easeIn(seg(p, 0.5, 0.88));

      let cx = lerp(vw * 0.5, cx1, t1);
      let cy = lerp(vh + r0 * 0.3, vh * 0.5, t1);
      let cr = lerp(r0, r1, t1);
      if (t2 > 0) {
        cx = lerp(cx1, vw * 0.5, t2);
        cy = lerp(vh * 0.5, vh * 0.47, t2);
        cr = lerp(r1, r2, t2);
      }

      const fade = easeIn(seg(p, 0.84, 0.95)); // fully black by p=.95 → quiet dwell before unpin

      // publish the hole's live screen position for the starfield physics
      window.__blackHole = fade < 1 ? { x: cx, y: cy, r: cr } : null;

      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.center, cx * dpr, (vh - cy) * dpr);
      gl.uniform1f(U.radius, cr * dpr);
      gl.uniform1f(U.time, diskTime + p * 1.6);
      gl.uniform1f(U.fade, fade);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      /* Text stages */
      const heroOut = seg(p, 0.0, 0.13);
      setStage(stageHero, 1 - heroOut, -heroOut * 60);

      const splitIn = seg(p, 0.2, 0.34);
      const splitOut = seg(p, 0.5, 0.62);
      setStage(stageSplit, Math.min(splitIn, 1 - splitOut), (1 - splitIn) * 40 - splitOut * 50);

      const surfIn = seg(p, 0.64, 0.78);
      const surfOut = seg(p, 0.9, 0.985);
      setStage(stageSurface, Math.min(surfIn, 1 - surfOut), (1 - surfIn) * 40);

      const nOp = 1 - seg(p, 0, 0.16);
      neighbors.forEach((n) => (n.style.opacity = nOp.toFixed(3)));
      scrollcue.style.opacity = (1 - seg(p, 0, 0.08)).toFixed(3);
      scrollcue.style.pointerEvents = p > 0.06 ? "none" : "auto";
    } else {
      window.__blackHole = null;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  scrollcue.addEventListener("click", () => {
    const total = space.getBoundingClientRect().height - vh;
    window.scrollTo({ top: window.scrollY + total * 0.34, behavior: "smooth" });
  });
})();
