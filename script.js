/* Portside Digital — ScrollCraft 3D (Dala-style particle volumes)
 * Hooks:
 *   [data-scrollcraft-canvas]        fixed WebGL canvas behind the page
 *   [data-scrollcraft-3d-target]     hero window; the workstation forms around its centre
 *   [data-scrollcraft-section]       sections that drive morph progress (data-scrollcraft-shape = 0..3)
 *   [data-track]                     headlines whose letter-spacing tightens as they reach screen centre
 *   [data-project-url]               roster slots; a non-empty URL turns the slot into a live link
 * Each shape is a solid surface (triangle soup) sampled by area, so the particles form a dense shell instead of a line sketch.
 * Every particle is a flat, outlined triangle that mostly faces the camera. Colour is mixed per particle
 * (lavender-white, iris, amber, teal); the silhouette glows amber via a fresnel term on the sampled surface normal.
 */
(() => {
  'use strict';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 1. Solid target shapes as triangle soups ----------
     tint: 0 = mixed palette, 1 = amber, 2 = iris, 3 = teal.  k = particle density per unit area */
  const TAU = Math.PI * 2;
  /* every triangle carries an "inside" point; the sampler flips its normal to face away from it, so normals point outward */
  const shape = () => ({ t: [] });
  const tri = (s, a, b, c, k, tint, ins) => s.t.push([a, b, c, k, tint, ins]);
  const add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
  const quad = (s, p, u, v, k = 1, tint = 0, ins = [p[0], p[1], p[2] - 1]) => {   // default: faces the viewer (+z)
    const a = sub(sub(p, u), v), b = sub(add(p, u), v), c = add(add(p, u), v), d = add(sub(p, u), v);
    tri(s, a, b, c, k, tint, ins); tri(s, a, c, d, k, tint, ins);
  };
  const box = (s, c, sz, k = 1, tint = 0) => {
    const [x, y, z] = [sz[0]/2, sz[1]/2, sz[2]/2];
    quad(s, add(c, [0,0, z]), [x,0,0], [0,y,0], k, tint, c); quad(s, add(c, [0,0,-z]), [x,0,0], [0,y,0], k, tint, c);
    quad(s, add(c, [ x,0,0]), [0,0,z], [0,y,0], k, tint, c); quad(s, add(c, [-x,0,0]), [0,0,z], [0,y,0], k, tint, c);
    quad(s, add(c, [0, y,0]), [x,0,0], [0,0,z], k, tint, c); quad(s, add(c, [0,-y,0]), [x,0,0], [0,0,z], k, tint, c);
  };
  const surf = (s, f, nu, nv, k = 1, tint = 0, ins = [0,0,0]) => {  // parametric surface f(u,v), u,v in 0..1; ins = point or fn(p)
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = f(i/nu, j/nv), b = f((i+1)/nu, j/nv), c = f((i+1)/nu, (j+1)/nv), d = f(i/nu, (j+1)/nv);
      tri(s, a, b, c, k, tint, ins); tri(s, a, c, d, k, tint, ins);
    }
  };
  const sphere = (s, c, r, k = 1, tint = 0) => surf(s, (u, v) => {
    const th = u*TAU, ph = (v - .5)*Math.PI;
    return [c[0] + r*Math.cos(ph)*Math.cos(th), c[1] + r*Math.sin(ph), c[2] + r*Math.cos(ph)*Math.sin(th)];
  }, 24, 14, k, tint, c);

  /* --- detail helpers: surfaces of revolution, tubes along a path, lumpy rocks --- */
  const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const mul = (a, k) => [a[0]*k, a[1]*k, a[2]*k];
  const nrmz = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
  /* lathe: profile [[r, h], ...] spun around axis `ax` through `o`; flat < 1 squashes it into a blade (used for anchor flukes) */
  const lathe = (s, prof, o = [0,0,0], ax = [0,1,0], segs = 36, k = 1, tint = 0, flat = 1) => {
    ax = nrmz(ax);
    const e1 = nrmz(cross(ax, Math.abs(ax[2]) < .9 ? [0,0,1] : [1,0,0])), e2 = cross(ax, e1);
    const P = (r, h, th) => add(add(o, mul(ax, h)), add(mul(e1, Math.cos(th)*r), mul(e2, Math.sin(th)*r*flat)));
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < segs; j++) {
      const [r0, h0] = prof[i], [r1, h1] = prof[i+1], t0 = j/segs*TAU, t1 = (j+1)/segs*TAU, ins = add(o, mul(ax, (h0 + h1)/2));
      const a = P(r0, h0, t0), b = P(r0, h0, t1), c = P(r1, h1, t1), d = P(r1, h1, t0);
      tri(s, a, b, c, k, tint, ins); tri(s, a, c, d, k, tint, ins);
    }
  };
  /* tube: circle of radius rad(t) swept along path(t), t in 0..1 */
  const tube = (s, path, rad, nu = 40, nv = 8, k = 1, tint = 0) => {
    const ring = t => {
      const p = path(t), T = nrmz(sub(path(Math.min(1, t + .002)), path(Math.max(0, t - .002))));
      const N = nrmz(cross(T, Math.abs(T[1]) < .95 ? [0,1,0] : [1,0,0])), B = cross(T, N), r = typeof rad === 'function' ? rad(t) : rad;
      return [p, [...Array(nv)].map((_, j) => { const th = j/nv*TAU; return add(p, add(mul(N, Math.cos(th)*r), mul(B, Math.sin(th)*r))); })];
    };
    let prev = ring(0);
    for (let i = 1; i <= nu; i++) {
      const cur = ring(i/nu), ins = path((i - .5)/nu);
      for (let j = 0; j < nv; j++) { const jn = (j + 1) % nv;
        tri(s, prev[1][j], prev[1][jn], cur[1][jn], k, tint, ins); tri(s, prev[1][j], cur[1][jn], cur[1][j], k, tint, ins); }
      prev = cur;
    }
  };
  const line = (a, b) => t => add(a, mul(sub(b, a), t));
  const circle = (c, r, ax = 'y') => t => { const th = t*TAU, u = Math.cos(th)*r, v = Math.sin(th)*r;
    return ax === 'y' ? [c[0] + u, c[1], c[2] + v] : ax === 'z' ? [c[0] + u, c[1] + v, c[2]] : [c[0], c[1] + u, c[2] + v]; };
  const spline = pts => t => {                                      // Catmull-Rom through pts
    const n = pts.length - 1, f = Math.min(n - 1e-6, t*n), i = Math.floor(f), u = f - i;
    const p0 = pts[Math.max(0, i-1)], p1 = pts[i], p2 = pts[i+1], p3 = pts[Math.min(n, i+2)];
    return [0,1,2].map(k => .5*((2*p1[k]) + (-p0[k] + p2[k])*u + (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k])*u*u + (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k])*u*u*u));
  };
  const rock = (s, c, r, sy, sd, k = 1, tint = 0) => surf(s, (u, v) => {
    const th = u*TAU, ph = (v - .5)*Math.PI;
    const w = 1 + .16*Math.sin(th*3 + sd*1.7)*Math.cos(ph*2 + sd) + .08*Math.sin(th*7 + ph*5 + sd*3);
    return [c[0] + r*w*Math.cos(ph)*Math.cos(th), c[1] + r*sy*w*Math.sin(ph), c[2] + r*w*Math.cos(ph)*Math.sin(th)];
  }, 28, 14, k, tint, c);

  /* 0 · lighthouse: rocks and keeper's cottage, striped tower with windows, railed gallery, glazed lantern, lamp, dome, sweeping beam */
  const SH0 = (() => {
    const s = shape();
    [[0,-1.62,0,.82,.34],[-.72,-1.66,.28,.5,.32],[.68,-1.68,-.12,.52,.3],[.28,-1.72,.58,.4,.24],[-.32,-1.7,-.52,.46,.26],[.95,-1.75,.4,.3,.25]]
      .forEach(([x,y,z,r,sy], i) => rock(s, [x,y,z], r, sy, i, .8, 0));
    lathe(s, [[.64,-1.32],[.64,-1.14],[.52,-1.1],[.5,-1.0]], [0,0,0], [0,1,0], 44, 1.1);              // plinth
    const R = y => .44 - .075*(y + 1);
    for (let b = 0; b < 5; b++) { const y0 = -1 + b*.4, y1 = y0 + .4;                                      // striped tower
      lathe(s, [[R(y0), y0], [R(y1), y1]], [0,0,0], [0,1,0], 44, 1, b % 2 ? 2 : 0); }
    for (const yy of [-.6, -.2, .2, .6]) tube(s, circle([0,yy,0], R(yy) + .006), .008, 44, 4, 10);       // band seams
    quad(s, [0,-.86,R(-.86) + .012], [.085,0,0], [0,.14,0], 9, 1, [0,-.86,0]);                            // door
    tube(s, t => [Math.cos(Math.PI*t)*.1, -.72 + Math.sin(Math.PI*t)*.05, R(-.72) + .014], .01, 16, 4, 12, 1);   // door arch
    for (let i = 0; i < 5; i++) { const y = -.45 + i*.34, th = .5 + i*1.25, ry = R(y) + .01;              // windows spiralling up
      const p = [Math.sin(th)*ry, y, Math.cos(th)*ry], u = [Math.cos(th)*.045, 0, -Math.sin(th)*.045];
      quad(s, p, u, [0,.075,0], 12, 1, [0,y,0]); }
    lathe(s, [[R(.9), .9], [.5, .99], [.58, 1.0], [.58, 1.05], [0, 1.05]], [0,0,0], [0,1,0], 48, 1.4);   // corbelled gallery deck
    tube(s, circle([0,1.3,0], .56), .014, 64, 5, 12);                                                    // top rail
    tube(s, circle([0,1.18,0], .56), .009, 64, 4, 10);                                                   // mid rail
    for (let i = 0; i < 28; i++) { const th = i/28*TAU;                                                  // balusters
      tube(s, line([Math.cos(th)*.56, 1.05, Math.sin(th)*.56], [Math.cos(th)*.56, 1.3, Math.sin(th)*.56]), .008, 4, 4, 14); }
    lathe(s, [[.31,1.05],[.31,1.15],[.28,1.16]], [0,0,0], [0,1,0], 40, 2, 2);                            // lantern base
    lathe(s, [[.28,1.16],[.28,1.5]], [0,0,0], [0,1,0], 40, .3);                                          // glazing (sparse, see-through)
    for (let i = 0; i < 10; i++) { const th = i/10*TAU;                                                  // astragals
      tube(s, line([Math.cos(th)*.28, 1.16, Math.sin(th)*.28], [Math.cos(th)*.28, 1.5, Math.sin(th)*.28]), .009, 4, 4, 14); }
    sphere(s, [0,1.33,0], .11, 7, 1);                                                                    // lamp
    for (const yy of [1.24, 1.33, 1.42]) tube(s, circle([0,yy,0], .15), .007, 30, 4, 14, 1);             // Fresnel lens rings
    lathe(s, [[.36,1.5],[.32,1.56],[.22,1.66],[.1,1.73],[0,1.76]], [0,0,0], [0,1,0], 40, 1.6, 2);        // dome
    sphere(s, [0,1.8,0], .05, 9, 1);                                                                     // vent ball
    tube(s, line([0,1.84,0], [0,2.06,0]), .006, 6, 4, 20);                                               // lightning rod
    lathe(s, [[.05,.12],[.42,2.3]], [0,1.33,0], [1,-.06,.12], 36, .16, 1);                               // light beam
    box(s, [-1.0,-1.06,.12], [.62,.38,.46], 1);                                                          // keeper's cottage
    quad(s, [-1.0,-.79,.24], [.33,0,0], [0,.07,-.13], 1.8, 2, [-1.0,-1.06,.12]);                         // roof, front pitch
    quad(s, [-1.0,-.79,0], [.33,0,0], [0,.07,.13], 1.8, 2, [-1.0,-1.06,.12]);                            // roof, back pitch
    for (const sx of [-1, 1]) tri(s, [-1.0 + sx*.31,-.87,.37], [-1.0 + sx*.31,-.87,-.13], [-1.0 + sx*.31,-.72,.12], 1.8, 0, [-1.0,-.9,.12]);   // gables
    quad(s, [-1.12,-1.02,.352], [.06,0,0], [0,.06,0], 12, 1, [-1.12,-1.02,0]);                           // window
    quad(s, [-.86,-1.12,.352], [.05,0,0], [0,.1,0], 10, 3, [-.86,-1.12,0]);                              // door
    box(s, [-1.16,-.7,.02], [.08,.2,.08], 3);                                                            // chimney
    return s;
  })();

  /* 1 · anchor: shank, ring, stock with ball ends, curved arms with flat flukes, braided rope wound round and hanging from the ring */
  const SH1 = (() => {
    const s = shape();
    lathe(s, [[0,1.32],[.07,1.28],[.08,.6],[.1,-1.1],[.12,-1.2]], [0,0,0], [0,1,0], 28, 1.6);           // shank
    box(s, [0,1.3,0], [.2,.12,.1], 2);                                                                   // eye
    tube(s, circle([0,1.6,0], .25, 'z'), .05, 56, 8, 3.5);                                               // ring
    tube(s, line([-.8,1.02,0], [.8,1.02,0]), t => .042 + .022*(1 - Math.abs(2*t - 1)), 40, 10, 3);       // stock
    for (const sx of [-1, 1]) sphere(s, [sx*.84,1.02,0], .08, 4, 1);                                     // stock ball ends
    tube(s, circle([0,1.02,0], .11), .026, 30, 6, 6, 2);                                                 // collar
    sphere(s, [0,-1.3,0], .15, 2);                                                                        // crown
    for (const sd of [-1, 1]) {
      const arm = t => { const ph = sd*t*1.05; return [Math.sin(ph)*1.02, -.3 - Math.cos(ph)*1.02, 0]; };
      tube(s, arm, t => .1 - .035*t, 44, 10, 2.2);                                                       // arm
      const ph = sd*1.05, tip = arm(1), T = [Math.cos(ph)*sd, Math.sin(ph)*sd, 0];
      lathe(s, [[0,-.06],[.2,.06],[.17,.22],[.08,.36],[0,.46]], sub(tip, mul(T, .02)), T, 28, 2, 2, .22);  // fluke (flattened blade)
    }
    tube(s, t => { const th = t*TAU*4.5; return [Math.cos(th)*.15, 1.18 - t*1.85, Math.sin(th)*.15]; },
      t => .03 + .006*Math.sin(t*520), 260, 8, 2.6, 1);                                                  // rope wound round the shank (braided)
    tube(s, spline([[.24,1.66,.02],[.5,1.4,.14],[.62,.75,.2],[.5,.15,.2],[.22,-.45,.16]]),
      t => .03 + .006*Math.sin(t*300), 120, 8, 2.6, 1);                                                  // rope loop hanging from the ring
    return s;
  })();

  /* 2 · ocean: a wide surface (the shader animates the swell) */
  const SH2 = (() => {
    const s = shape();
    surf(s, (u, v) => { const x = -4 + u*8, z = -4.2 + v*5.6;
      return [x, .22*Math.sin(x*1.1 + z*.6)*Math.cos(z*.8) + .1*Math.sin(x*2.3 - z*1.5), z]; }, 40, 28, 1, 0, p => [p[0], p[1] - 1, p[2]]);
    return s;
  })();

  /* 3 · exclamation mark: tapered rounded bar plus an amber dot */
  const SH3 = (() => {
    const s = shape(), axis = p => [0, p[1], 0];
    surf(s, (u, v) => { const y = -.25 + v*1.75, r = .17 + .18*v; return [r*Math.cos(u*TAU), y, r*Math.sin(u*TAU)]; }, 28, 14, 1, 0, axis);
    surf(s, (u, v) => { const ph = v*Math.PI/2; return [.35*Math.cos(ph)*Math.cos(u*TAU), 1.5 + .35*Math.sin(ph), .35*Math.cos(ph)*Math.sin(u*TAU)]; }, 28, 8, 1, 0, [0,1.5,0]);
    surf(s, (u, v) => { const ph = v*Math.PI/2; return [.17*Math.cos(ph)*Math.cos(u*TAU), -.25 - .17*Math.sin(ph), .17*Math.cos(ph)*Math.sin(u*TAU)]; }, 20, 5, 1, 0, [0,-.25,0]);
    sphere(s, [0,-.9,0], .3, 1.2, 1);
    return s;
  })();
  const SHAPES = [SH0, SH1, SH2, SH3];

  const sampler = s => {                                            // area x density weighted point on the surface, with its outward normal
    const items = []; let tot = 0;
    s.t.forEach(t => {
      const e1 = sub(t[1], t[0]), e2 = sub(t[2], t[0]);
      const n = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
      const len = Math.hypot(n[0], n[1], n[2]); if (len < 1e-9) return;
      tot += len/2 * t[3]; items.push([tot, t, e1, e2, [n[0]/len, n[1]/len, n[2]/len]]);
    });
    return () => {
      const r = Math.random() * tot; let lo = 0, hi = items.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; items[m][0] < r ? lo = m + 1 : hi = m; }
      const [, t, e1, e2, n0] = items[lo]; let a = Math.random(), b = Math.random();
      if (a + b > 1) { a = 1 - a; b = 1 - b; }
      const p = [t[0][0] + e1[0]*a + e2[0]*b, t[0][1] + e1[1]*a + e2[1]*b, t[0][2] + e1[2]*a + e2[2]*b];
      const ins = typeof t[5] === 'function' ? t[5](p) : t[5], o = sub(p, ins);
      const sg = (n0[0]*o[0] + n0[1]*o[1] + n0[2]*o[2]) < 0 ? -1 : 1;
      return [p[0], p[1], p[2], n0[0]*sg, n0[1]*sg, n0[2]*sg, t[4]];
    };
  };

  /* ---------- 2. Scene: instanced flat triangles, outlined ---------- */
  const canvas = $('[data-scrollcraft-canvas]');
  if (!canvas || !window.THREE) return;
  const MOBILE = window.innerWidth < 768;                          // device tier chosen at init
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); return; }                           // no WebGL: page stays a clean black canvas
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
  camera.position.z = 7;

  const MAIN = MOBILE ? 7000 : 22000, AMB = MOBILE ? 220 : 650, N = MAIN + AMB;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0,1,0, -.866,-.5,0, .866,-.5,0], 3));   // unit equilateral triangle
  geo.instanceCount = N;

  const T = [0,1,2,3].map(() => new Float32Array(N*3)), NR = [0,1,2,3].map(() => new Float32Array(N*3));
  const SD = new Float32Array(N*4), TN = new Float32Array(N*4);    // SD = seed, isAmbient, size, spare; TN = tint per shape
  const samplers = SHAPES.map(sampler);
  for (let p = 0; p < N; p++) {
    const amb = p >= MAIN, seed = Math.random();
    const pts = amb ? (() => { const q = [(Math.random()-.5)*26, (Math.random()-.5)*16, -3 - Math.random()*12, 0, 0, 1, 0]; return [q,q,q,q]; })() : samplers.map(f => f());
    for (let s = 0; s < 4; s++) { T[s].set(pts[s].slice(0, 3), p*3); NR[s].set(pts[s].slice(3, 6), p*3); TN[p*4 + s] = pts[s][6]; }
    const size = (amb ? .07 + Math.random()*.1 : .026 + Math.random()*.022) * (MOBILE ? 1.35 : 1);
    SD.set([seed, amb ? 1 : 0, size, Math.random()], p*4);
  }
  ['tA','tB','tC','tD'].forEach((n, i) => geo.setAttribute(n, new THREE.InstancedBufferAttribute(T[i], 3)));
  ['nA','nB','nC','nD'].forEach((n, i) => geo.setAttribute(n, new THREE.InstancedBufferAttribute(NR[i], 3)));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(SD, 4));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(TN, 4));

  const U = {
    uP: { value: 0 }, uTime: { value: 0 }, uSpinAngle: { value: 0 }, uVib: { value: 0 }, uAlpha: { value: 1 },
    uAspect: { value: 1 }, uTan: { value: Math.tan(THREE.MathUtils.degToRad(22.5)) }, uCamZ: { value: 7 }, uRad: { value: MOBILE ? 1.2 : 1 },
    uMouse: { value: new THREE.Vector2() }, uStr: { value: 0 },
    uOff: { value: [0,1,2,3].map(() => new THREE.Vector3()) }, uScl: { value: [1,1,1,1] }, uSA: { value: [1,1,1,1] }, uYaw: { value: [0,0,0,0] }, uCarve: { value: [1,1,1,1] }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `
      attribute vec3 tA, tB, tC, tD, nA, nB, nC, nD; attribute vec4 aSeed, aTint;
      uniform float uP, uTime, uSpinAngle, uVib, uAlpha, uAspect, uTan, uCamZ, uRad, uStr, uScl[4], uSA[4], uYaw[4], uCarve[4];
      uniform vec3 uOff[4]; uniform vec2 uMouse;
      varying vec3 vC; varying float vA;

      /* --- 3D simplex noise (Ashima / McEwan) --- */
      vec3 mod289(vec3 x){ return x - floor(x*(1./289.))*289.; }
      vec4 mod289(vec4 x){ return x - floor(x*(1./289.))*289.; }
      vec4 permute(vec4 x){ return mod289(((x*34.)+1.)*x); }
      vec4 tis(vec4 r){ return 1.79284291400159 - .85373472095314*r; }
      float snoise(vec3 v){
        const vec2 C = vec2(1./6., 1./3.); const vec4 D = vec4(0., .5, 1., 2.);
        vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
        vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1. - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
        vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
        i = mod289(i);
        vec4 p = permute(permute(permute(i.z + vec4(0., i1.z, i2.z, 1.)) + i.y + vec4(0., i1.y, i2.y, 1.)) + i.x + vec4(0., i1.x, i2.x, 1.));
        vec3 ns = .142857142857 * D.wyz - D.xzx;
        vec4 j = p - 49. * floor(p*ns.z*ns.z); vec4 x_ = floor(j*ns.z); vec4 y_ = floor(j - 7.*x_);
        vec4 x = x_*ns.x + ns.yyyy; vec4 y = y_*ns.x + ns.yyyy; vec4 h = 1. - abs(x) - abs(y);
        vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
        vec4 s0 = floor(b0)*2. + 1.; vec4 s1 = floor(b1)*2. + 1.; vec4 sh = -step(h, vec4(0.));
        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
        vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
        vec4 nr = tis(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= nr.x; p1 *= nr.y; p2 *= nr.z; p3 *= nr.w;
        vec4 m = max(.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.); m = m*m;
        return 42. * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }
      vec3 flow(vec3 q){ return vec3(snoise(q), snoise(q + 31.4), snoise(q + 71.7)); }

      vec3 tgt(int i){ if(i==0) return tA*uScl[0]+uOff[0]; if(i==1) return tB*uScl[1]+uOff[1]; if(i==2) return tC*uScl[2]+uOff[2]; return tD*uScl[3]+uOff[3]; }
      float yawOf(int i){ if(i==0) return uYaw[0]; if(i==1) return uYaw[1]; if(i==2) return uYaw[2]; return uYaw[3]; }
      float carveOf(int i){ if(i==0) return uCarve[0]; if(i==1) return uCarve[1]; if(i==2) return uCarve[2]; return uCarve[3]; }
      vec3 raw(int i){ if(i==0) return tA; if(i==1) return tB; if(i==2) return tC; return tD; }
      float sclOf(int i){ if(i==0) return uScl[0]; if(i==1) return uScl[1]; if(i==2) return uScl[2]; return uScl[3]; }
      vec3 nrm(int i){ if(i==0) return nA; if(i==1) return nB; if(i==2) return nC; return nD; }
      vec3 off(int i){ if(i==0) return uOff[0]; if(i==1) return uOff[1]; if(i==2) return uOff[2]; return uOff[3]; }
      float tintOf(int k){ if(k==0) return aTint.x; if(k==1) return aTint.y; if(k==2) return aTint.z; return aTint.w; }
      float saOf(int k){ if(k==0) return uSA[0]; if(k==1) return uSA[1]; if(k==2) return uSA[2]; return uSA[3]; }

      const vec3 LILAC = vec3(.93,.9,1.), IRIS = vec3(.56,.38,1.), AMBER = vec3(1.,.74,.18), TEAL = vec3(.1,.66,.54);
      vec3 mixed(float r){ return r < .48 ? LILAC : r < .7 ? IRIS : r < .9 ? AMBER : TEAL; }
      vec3 tintCol(float k){ return k < 1.5 ? AMBER : k < 2.5 ? IRIS : TEAL; }
      mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
      mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
      mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }

      void main(){
        float seed = aSeed.x, amb = aSeed.y, size = aSeed.z, r2 = aSeed.w;
        vec3 pos, col; float a, mag = 1.;
        if(amb > .5){                                   // ambient triangles: sparse, larger, slow drift
          pos = tA + flow(tA*.12 + uTime*.04) * 1.4;
          col = mixed(r2) * .6; a = .3;
        } else {
          int i = int(floor(uP)); int j = int(min(float(i)+1., 3.));
          float t = clamp((uP - floor(uP) - seed*.35) / .65, 0., 1.); t = t*t*(3.-2.*t);   // staggered so the morph flows
          vec3 centre = mix(off(i), off(j), t);
          pos = mix(tgt(i), tgt(j), t);
          vec3 n = normalize(mix(nrm(i), nrm(j), t) + vec3(1e-4));
          float tint = t < .5 ? tintOf(i) : tintOf(j);
          vec3 dir = normalize(vec3(sin(seed*12.9), cos(seed*78.2), sin(seed*37.7)) + vec3(1e-4));
          pos += dir * sin(t*3.14159) * (.35 + seed*.9);               // loosen in flight, then settle
          float ang = sin(uTime*.25)*.22 + uP*.45 + uSpinAngle + mix(yawOf(i), yawOf(j), t);   // per-shape yaw keeps each one in its most readable pose
          mat3 R = rotX(.18) * rotY(ang);
          pos = centre + R * (pos - centre); n = R * n;
          float wv = 1. - clamp(abs(uP - 2.), 0., 1.); wv = wv*wv*(3. - 2.*wv);
          pos.y += wv * (sin(pos.x*1.3 + uTime*1.1)*.17 + sin(pos.z*1.6 - uTime*.8)*.13 + sin((pos.x+pos.z)*.7 + uTime*.6)*.1);
          pos += flow(pos*.8 + vec3(0., 0., uTime*.2)) * mix(.018, .12, sin(t*3.14159));
          if(uVib > .001) pos += flow(pos*7. + uTime*9.) * .02 * uVib;

          /* 3D read: light from the upper left, back-facing points fall away, depth fog, and noise-carved gaps (negative space) */
          float sc = mix(sclOf(i), sclOf(j), t);
          vec3 rl = mix(raw(i), raw(j), t);
          vec3 Ld = normalize(vec3(-.45, .6, .65));
          float diff = max(dot(n, Ld), 0.);
          float fr = pow(1. - abs(n.z), 2.);                           // silhouette factor
          float back = smoothstep(.05, -.3, n.z);                        // 1 = faces away from the camera
          float depth = smoothstep(-1.1, .5, (pos.z - centre.z) / sc);   // 0 = far side, 1 = near side
          float g = snoise(rl*2.3 + 5.)*.6 + snoise(rl*5.1 + 17.)*.4;
          float carve = smoothstep(.08, .42, g) * (1. - sin(t*3.14159)) * mix(carveOf(i), carveOf(j), t);  // dark crevices, released mid-flight
          col = tint < .5 ? mixed(r2) : (r2 < .8 ? tintCol(tint) : mixed(r2));
          col *= .32 + .95*diff + .3*fr;
          col = mix(col, AMBER, smoothstep(.5, 1., fr) * .55 * (1. - back));
          a = clamp(.2 + .72*diff + .4*fr, 0., .95);
          a *= mix(1., .08, back) * mix(.3, 1., depth) * (1. - .9*carve);
          size *= (1. - .55*carve) * mix(.65, 1., depth);

          // magnetic hover
          vec2 mw = uMouse * vec2(uAspect, 1.) * uTan * (uCamZ - pos.z);
          vec2 d = mw - pos.xy; float r = length(d);
          float glow = exp(-r*r/(uRad*uRad)) * uStr;
          float hv = smoothstep(.06, .55, glow);
          pos.xy += d * glow * .25; pos.z += glow * .5; mag = 1. + glow*1.6;
          col = mix(col, vec3(1.), hv*.7); a = mix(a, 1., hv);
          a *= mix(saOf(i), saOf(j), t) * uAlpha;
        }
        // flat triangle facing the camera: spin in-plane, slight flutter out of plane
        float spin = seed*6.283 + uTime*(.15 + seed*.35)*(r2 > .5 ? 1. : -1.);
        mat3 L = rotX(sin(uTime*.6 + seed*20.)*.5) * rotZ(spin);
        vC = col; vA = a;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + L * (position * size * mag), 1.);
      }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC, vA); }`,
    wireframe: true,                       // outlined triangles
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, str: 0, on: false };

  /* ---------- 3. Layout: map DOM positions into world units ---------- */
  const secs = $$('[data-scrollcraft-section]'), target = $('[data-scrollcraft-3d-target]');
  let tops = [], W = 0, H = 0, worldW = 0, worldH = 0;
  const page = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + scrollY + r.height/2 }; };
  function layout() {
    W = innerWidth; H = innerHeight;
    const dpr = MOBILE ? 1 : Math.min(devicePixelRatio || 1, 1.25);   // low pixel ratio keeps 1-device-pixel lines bold instead of hairline
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    U.uAspect.value = camera.aspect;
    worldH = 2 * Math.tan(THREE.MathUtils.degToRad(22.5)) * camera.position.z; worldW = worldH * camera.aspect;
    tops = secs.map(s => s.getBoundingClientRect().top + scrollY);
    const mobile = W < 768, base = mobile ? worldW * .3 : Math.min(worldH * .3, worldW * .17);
    U.uAlpha.value = mobile ? .55 : 1;
    const hero = target ? page(target) : { x: W * .72, y: H * .5 };
    const heroX = mobile ? 0 : (hero.x / W - .5) * worldW + worldW * .04;      // nudged right so it bleeds off the edge, like Dala's brain
    // stacked mobile layout: the shape sits in the target window beneath the text, clamped on-screen
    const heroY = -(Math.min(Math.max(hero.y, H * .3), H * (mobile ? .8 : .6)) / H - .5) * worldH;
    U.uOff.value[0].set(heroX, heroY - base * .3, 0);
    U.uOff.value[1].set(mobile ? 0 : worldW * .26, mobile ? -worldH * .05 : 0, 0);
    U.uOff.value[2].set(0, -worldH * (mobile ? .36 : .44), -.5);                // ocean floor sits low, under the pricing tiers
    U.uOff.value[3].set(mobile ? 0 : -worldW * .02, mobile ? worldH * .3 : 0, 0);
    U.uScl.value = [base * (mobile ? .62 : .9), base * (mobile ? .7 : .78), base * (mobile ? .7 : 1.25), base * (mobile ? .7 : .85)];
    U.uSA.value = [1, .95, .7, .9];
    U.uYaw.value = [0, -.45, 0, 0];                                             // ship sits almost side-on, bow slightly toward the viewer
    U.uCarve.value = [.25, .12, .6, 1];                                         // boxy shapes keep their outline; round ones get crevices                                              // shapes behind content-heavy sections stay softer
  }

  /* progress: index of the active section plus a 0-1 morph phase that runs through the last 40% of the section */
  const progress = () => {
    const y = scrollY + H * .5; let i = 0;
    while (i < tops.length - 1 && y >= tops[i + 1]) i++;
    if (i >= tops.length - 1) return tops.length - 1;
    const t = (y - tops[i]) / (tops[i + 1] - tops[i]);
    return i + Math.min(1, Math.max(0, (t - .6) / .4));
  };

  /* ---------- 4. Render loop ---------- */
  let cur = 0, last = performance.now(), running = true, checked = false;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const goal = progress();
    cur = REDUCE ? goal : cur + (goal - cur) * (1 - Math.pow(.001, dt));     // frame-rate independent easing
    U.uP.value = cur;
    U.uTime.value += REDUCE ? 0 : dt;
    const S = THREE.MathUtils.smoothstep;
    if (!REDUCE) U.uSpinAngle.value += dt * .9 * S(cur, 1.6, 2.0);        // pillars + exclamation block rotate; angle accumulates so it never jumps
    U.uVib.value = REDUCE ? 0 : S(cur, 2.6, 3.0);
    const km = 1 - Math.pow(.0005, dt);                                    // pointer easing: field follows with a soft lag, then releases smoothly
    mouse.sx += (mouse.x - mouse.sx) * km; mouse.sy += (mouse.y - mouse.sy) * km;
    mouse.str += ((mouse.on ? 1 : 0) - mouse.str) * (1 - Math.pow(.02, dt));
    U.uMouse.value.set(mouse.sx, mouse.sy); U.uStr.value = mouse.str;
    renderer.render(scene, camera);
    if (!checked) { checked = true; ((renderer.info && renderer.info.programs) || []).forEach(p => { const d = p.diagnostics; if (d && !d.runnable) console.error('[ScrollCraft] shader failed to compile:', d.programLog, d.vertexShader && d.vertexShader.log, d.fragmentShader && d.fragmentShader.log); }); }
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });
  /* Ignore height-only resizes under 150px (mobile address bar collapsing mid-scroll) so touch scrolling never triggers a relayout */
  let rt, lastW = innerWidth, lastH = innerHeight;
  addEventListener('resize', () => {
    if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 150) return;
    lastW = innerWidth; lastH = innerHeight; clearTimeout(rt); rt = setTimeout(layout, 120);
  }, { passive: true });
  addEventListener('load', layout);
  layout(); requestAnimationFrame(frame);

  /* ---------- 5. Scroll-driven headline tracking ---------- */
  const tracked = $$('[data-track]');
  const track = () => tracked.forEach(el => {
    const r = el.getBoundingClientRect(), d = Math.min(1, Math.abs(r.top + r.height/2 - innerHeight/2) / innerHeight);
    el.style.letterSpacing = (-.04 + .026 * d).toFixed(4) + 'em';
  });
  let ticking = false;
  const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { track(); ticking = false; }); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('touchmove', onScroll, { passive: true });     // finger-drag updates without blocking the compositor
  track();

  /* ---------- 5b. Pointer + touch (window-level, passive; the canvas itself ignores pointer events) ---------- */
  const setPointer = (x, y) => { mouse.x = (x / innerWidth) * 2 - 1; mouse.y = -((y / innerHeight) * 2 - 1); if (!mouse.on) { mouse.sx = mouse.x; mouse.sy = mouse.y; } mouse.on = true; };
  if (!REDUCE) {
    addEventListener('pointermove', e => setPointer(e.clientX, e.clientY), { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { mouse.on = false; }, { passive: true });
    addEventListener('blur', () => { mouse.on = false; });
    ['touchstart', 'touchmove'].forEach(ev => addEventListener(ev, e => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true }));
    ['touchend', 'touchcancel'].forEach(ev => addEventListener(ev, () => { mouse.on = false; }, { passive: true }));
  }

  /* ---------- 6. Portfolio roster, slot reservation, booking form ---------- */
  $$('[data-project-url]').forEach(a => {
    const url = a.getAttribute('data-project-url'); if (!url) return;
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = '<span class="label">' + (a.dataset.projectTitle || 'Visit live site') + '</span>';
  });

  /* ---------- Mobile menu overlay ---------- */
  const menuBtn = $('#menu-btn'), menu = $('#menu');
  const setMenu = open => { menu.hidden = !open; menuBtn.setAttribute('aria-expanded', open); menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); document.body.classList.toggle('menu-open', open); };
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  addEventListener('resize', () => { if (innerWidth >= 768 && !menu.hidden) setMenu(false); }, { passive: true });

  const form = $('#book'), msg = $('#form-msg'), mail = $('#mail-link');
  const bookingText = f => `Hi Sergio, I'd like to book a vessel.\nName: ${f.name.value}\nBusiness: ${f.biz.value}\nPhone: ${f.phone.value}\nPackage: ${f.pkg.value}\nProject: ${f.spec.value}`;
  $('#reserve-slot').addEventListener('click', e => {
    const slot = e.currentTarget.closest('.slot'); slot.classList.add('reserved');
    $('#slot-title').textContent = 'Berth held — finish booking below';
    form.spec.value = form.spec.value || 'I would like to reserve the PD-002 slot.';
    $('#book').scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth' }); setTimeout(() => form.name.focus({ preventScroll: true }), 600);
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.name.value.trim() || !form.phone.value.trim()) { msg.style.color = '#ffb829'; msg.textContent = 'Add your name and phone / WhatsApp number to book.'; return; }
    msg.style.color = ''; msg.textContent = 'Opening WhatsApp with your booking details…';
    window.open('https://wa.me/18683195929?text=' + encodeURIComponent(bookingText(form)), '_blank', 'noopener');
  });
  mail.addEventListener('click', () => { mail.href = 'mailto:sztimothy2036@gmail.com?subject=' + encodeURIComponent('Portside Digital booking') + '&body=' + encodeURIComponent(bookingText(form)); });
})();
