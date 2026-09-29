/* Portside Digital — ScrollCraft 3D
 * Hooks:
 *   [data-scrollcraft-canvas]        fixed WebGL canvas behind the page
 *   [data-scrollcraft-3d-target]     hero window; the workstation forms around its centre
 *   [data-scrollcraft-section]       sections that drive morph progress (data-scrollcraft-shape = 0..3)
 *   [data-track]                     headlines whose letter-spacing tightens as they reach screen centre
 *   [data-project-url]               roster slots; a non-empty URL turns the slot into a live link
 * All morphing, simplex-noise mist and mouse repulsion run in the vertex shader (one draw call); JS only updates a few uniforms per frame.
 * Mouse/touch: [pointermove] + [touchstart] feed an 8-slot ring of impulses (uM); each impulse pushes and swirls nearby particles, then decays so they drift back.
 */
(() => {
  'use strict';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 1. Shape data: true 3D edge lists (x, y, z) ---------- */
  const box = (cx, cy, cz, w, h, d) => {
    const x = w / 2, y = h / 2, z = d / 2;
    const v = [[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]].map(p => [p[0]+cx, p[1]+cy, p[2]+cz]);
    return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].map(e => [v[e[0]], v[e[1]]]);
  };
  const prism = (prof, z0, z1) => {           // extrude an x/y profile between two z depths
    const out = [];
    prof.forEach((p, i) => {
      const q = prof[(i + 1) % prof.length];
      out.push([[p[0],p[1],z0],[q[0],q[1],z0]], [[p[0],p[1],z1],[q[0],q[1],z1]], [[p[0],p[1],z0],[p[0],p[1],z1]]);
    });
    return out;
  };

  const SHAPES = [
    /* 0 · desktop workstation: bezel layers, on-screen windows, rear hump, neck, base, desk + legs, keycap grid, mouse, tower with drive bays, speakers, mug */
    (() => {
      const e = [].concat(
        box(0,.5,0,2.0,1.2,.08), box(0,.5,.05,1.84,1.04,.02), box(0,.5,.07,1.7,.92,.005), box(0,-.05,.06,.14,.03,.01),
        box(-.35,.62,.08,.7,.5,.005), box(.5,.5,.08,.55,.36,.005), box(-.35,.2,.08,.7,.14,.005),
        box(0,.5,-.12,.9,.6,.16), box(0,-.2,-.08,.16,.55,.08), box(0,-.5,-.02,.8,.04,.45),
        box(0,-.56,.2,3.4,.03,1.5), box(-1.6,-.9,-.4,.06,.7,.06), box(1.6,-.9,-.4,.06,.7,.06), box(-1.6,-.9,.8,.06,.7,.06), box(1.6,-.9,.8,.06,.7,.06),
        box(0,-.5,.68,1.4,.05,.44), box(1.05,-.5,.68,.15,.05,.24),
        box(-1.55,-.1,-.1,.4,1.3,.6), box(-1.55,.35,.21,.3,.06,.02), box(-1.55,.2,.21,.3,.06,.02), box(-1.55,-.35,.21,.06,.06,.02),
        box(-1.15,-.3,-.15,.22,.5,.24), box(1.15,-.3,-.15,.22,.5,.24), box(1.6,-.4,.15,.2,.3,.2), box(1.74,-.4,.15,.08,.16,.02));
      for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) e.push(...box(-.6 + c*.109, -.46, .55 + r*.1, .09, .02, .08));
      return e;
    })(),
    /* 1 · cargo vessel: hull ribs + keel + tapering bow (volumetric), deck, container stacks, bridge, funnel, mast, wake */
    (() => {
      const e = [], hw = x => .45 * Math.min(1, Math.max(0, (1.6 - x) / .55));       // half-beam tapers toward the bow
      const ring = x => { const w = hw(x), k = w * .65; return [[x,.1,-w],[x,.1,w],[x,-.35,k],[x,-.35,-k]]; };
      const xs = []; for (let x = -1.3; x <= 1.58; x += .12) xs.push(x);
      xs.forEach((x, i) => {
        const r = ring(x); r.forEach((p, k) => e.push([p, r[(k+1)%4]]));
        if (i) { const q = ring(xs[i-1]); r.forEach((p, k) => e.push([q[k], p])); }
      });
      for (let x = -1.2; x <= 1.2; x += .3) e.push([[x,.1,-hw(x)],[x,.1,hw(x)]]);
      for (let i = 0; i < 6; i++) for (let l = 0; l < 3; l++) for (const z of [-.24, 0, .24]) e.push(...box(-1.1 + i*.34, .2 + l*.2, z, .3, .18, .21));
      e.push(...box(1.0,.42,0,.44,.64,.7), ...box(1.0,.8,0,.5,.06,.76), ...box(.92,1.0,0,.18,.32,.18), ...box(1.05,1.3,0,.03,.5,.03), ...box(1.05,1.5,0,.24,.02,.02), ...box(1.35,.16,0,.14,.06,.3));
      for (let z = -.9; z <= .9; z += .3) for (let x = -1.7; x < 1.7; x += .34) e.push([[x,-.45,z],[x+.17,-.38,z]], [[x+.17,-.38,z],[x+.34,-.45,z]]);
      return e;
    })(),
    /* 2 · coordinate pillars with caps on a floor axis grid + axis arrows */
    (() => {
      const e = [];
      for (let i = 0; i < 7; i++) { const h = 1 + (i % 4) * .5 + i * .12, x = -2.4 + i*.8, z = ((i % 2) * 2 - 1) * .5;
        e.push(...box(x, -1 + h/2, z, .22, h, .22), ...box(x, -1 + h + .03, z, .34, .05, .34), ...box(x, -1 + h/2, z, .1, h, .1)); }
      for (let z = -.9; z <= .9; z += .3) e.push([[-2.8,-1,z],[2.8,-1,z]]);
      for (let x = -2.8; x <= 2.8; x += .4) e.push([[x,-1,-.9],[x,-1,.9]]);
      e.push([[-2.8,-1,-.9],[-2.8,1.6,-.9]], [[2.8,-1,-.9],[2.8,1.6,-.9]]);
      return e;
    })(),
    /* 3 · exclamation block: stacked tapering slabs + double-walled cube dot (vibrates in the shader) */
    (() => {
      const e = [];
      for (let i = 0; i < 8; i++) e.push(...box(0, 1.15 - i*.2, 0, .6 - .04*i, .2, .46 - .03*i));
      e.push(...box(0,-.75,0,.5,.5,.4), ...box(0,-.75,0,.34,.34,.26));
      return e;
    })()
  ];

  const edgeSampler = edges => {
    const cum = []; let tot = 0;
    edges.forEach(e => { tot += Math.hypot(e[1][0]-e[0][0], e[1][1]-e[0][1], e[1][2]-e[0][2]); cum.push(tot); });
    return () => {
      const r = Math.random() * tot; let lo = 0, hi = cum.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; cum[m] < r ? lo = m + 1 : hi = m; }
      const e = edges[lo], t = Math.random(), j = .02;
      return [0,1,2].map(k => e[0][k] + (e[1][k]-e[0][k]) * t + (Math.random()-.5) * j);
    };
  };

  /* ---------- 2. Scene ---------- */
  const canvas = $('[data-scrollcraft-canvas]');
  if (!canvas || !window.THREE) return;
  /* Device detection at init: scales particle counts, pixel ratio and glyph size */
  const MOBILE = window.innerWidth < 768;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); return; }              // no WebGL: page stays a clean black canvas
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
  camera.position.z = 7;

  const MAIN = MOBILE ? 1500 : 8000, AMB = MOBILE ? 250 : 600, N = MAIN + AMB;
  const MAINC = [0x8052ff, 0xffb829, 0x15846e], AMBC = [0x8052ff, 0xffb829, 0x15846e, 0x3b2a8f, 0x2f4fd0, 0x5a2d91];
  const CORNER = [0,1,1,2,2,0].map(i => [Math.cos(Math.PI/2 + i*2.0944), Math.sin(Math.PI/2 + i*2.0944), 0]);

  const V = N * 6;
  const A = { c: new Float32Array(V*3), t: [0,1,2,3].map(() => new Float32Array(V*3)), col: new Float32Array(V*4), s: new Float32Array(V*2) };
  const samplers = SHAPES.map(edgeSampler);
  for (let p = 0; p < N; p++) {
    const amb = p >= MAIN, seed = Math.random();
    const hex = new THREE.Color((amb ? AMBC : MAINC)[(Math.random() * (amb ? AMBC : MAINC).length) | 0]);
    const pts = amb ? (() => { const q = [(Math.random()-.5)*26, (Math.random()-.5)*16, -6 - Math.random()*10]; return [q,q,q,q]; })() : samplers.map(s => s());
    const size = (amb ? .06 + Math.random()*.08 : .022 + Math.random()*.04) * (MOBILE ? 1.5 : 1);   // finer glyphs for the dense desktop cloud
    for (let k = 0; k < 6; k++) {
      const v = p*6 + k;
      A.c.set(CORNER[k].map(c => c*size), v*3);
      for (let s = 0; s < 4; s++) A.t[s].set(pts[s], v*3);
      A.col.set([hex.r, hex.g, hex.b, amb ? .28 : .95], v*4);
      A.s.set([seed, amb ? 1 : 0], v*2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V*3), 3));   // required placeholder
  geo.setAttribute('aCorner', new THREE.BufferAttribute(A.c, 3));
  ['tA','tB','tC','tD'].forEach((n, i) => geo.setAttribute(n, new THREE.BufferAttribute(A.t[i], 3)));
  geo.setAttribute('aColor', new THREE.BufferAttribute(A.col, 4));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(A.s, 2));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

  const U = {
    uP: { value: 0 }, uTime: { value: 0 }, uSpinAngle: { value: 0 }, uVib: { value: 0 }, uAlpha: { value: 1 },
    uAspect: { value: 1 }, uTan: { value: Math.tan(THREE.MathUtils.degToRad(22.5)) }, uCamZ: { value: 7 }, uRad: { value: MOBILE ? 1.1 : .9 },
    uM: { value: Array.from({ length: 8 }, () => new THREE.Vector3(0, 0, -100)) },      // x,y = pointer in NDC; z = birth time
    uOff: { value: [0,1,2,3].map(() => new THREE.Vector3()) }, uScl: { value: [1,1,1,1] }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec3 aCorner, tA, tB, tC, tD; attribute vec4 aColor; attribute vec2 aSeed;
      uniform float uP, uTime, uSpinAngle, uVib, uAlpha, uAspect, uTan, uCamZ, uRad, uScl[4];
      uniform vec3 uOff[4], uM[8];
      varying vec4 vC;

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
      vec3 off(int i){ if(i==0) return uOff[0]; if(i==1) return uOff[1]; if(i==2) return uOff[2]; return uOff[3]; }
      mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
      mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }

      void main(){
        float seed = aSeed.x; vec3 pos; float alpha = aColor.a;
        if(aSeed.y > .5){                               // ambient glyphs: deep, noise-driven drift, never morph
          vec3 q = tA*.12 + uTime*.04;
          pos = tA + flow(q) * 1.4;
        } else {
          int i = int(floor(uP)); int j = int(min(float(i)+1., 3.));
          float t = clamp(uP - floor(uP), 0., 1.); t = t*t*(3.-2.*t);
          vec3 centre = mix(off(i), off(j), t);
          pos = mix(tgt(i), tgt(j), t);
          float mist = step(.82, seed);                 // ~18% of particles form the loose halo around each shape
          // break apart mid-morph: scatter outward in 3D, then re-cluster
          vec3 dir = vec3(sin(seed*12.9), cos(seed*78.2), sin(seed*37.7));
          pos += dir * sin(t*3.14159) * (1.2 + seed*1.6);
          // rotational depth around the shape centre
          float ang = sin(uTime*.3)*.35 + uP*.45 + uSpinAngle;
          pos = centre + rotY(ang) * (pos - centre);
          // continuous fluid mist: organic waving displacement, stronger mid-morph and on halo particles
          float amp = mix(.045, .2, sin(t*3.14159)) * mix(1., 5., mist);
          pos += flow(pos*.85 + vec3(0., 0., uTime*.25)) * amp;
          // stage 4: dense vibration
          if(uVib > .001) pos += flow(pos*7. + uTime*9.) * .028 * uVib;
          // pointer impulses: repel + swirl, then elastic drift back as each impulse ages out
          for(int k=0; k<8; k++){
            vec3 m = uM[k]; float age = uTime - m.z;
            float st = exp(-age*1.5) * step(0., age) * step(age, 4.);
            vec2 mw = m.xy * vec2(uAspect, 1.) * uTan * (uCamZ - pos.z);      // pointer ray at this particle's depth
            vec2 d = pos.xy - mw; float r = length(d);
            float f = exp(-r*r/(uRad*uRad)) * st * (1. + .35*sin(age*9. + seed*6.28));
            vec2 dn = d / (r + 1e-3);
            pos.xy += dn*f*1.1 + vec2(-dn.y, dn.x)*f*.7;
            pos.z += f*.7*(seed - .5);
          }
          alpha *= uAlpha * mix(1., .45, mist);
        }
        vec3 c = rotY(uTime*(.4+seed) + seed*6.28) * (rotX(uTime*(.3+seed*.6) + seed*3.) * aCorner);   // tumbling triangle
        vC = vec4(aColor.rgb, alpha);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + c, 1.);
      }`,
    fragmentShader: `varying vec4 vC; void main(){ gl_FragColor = vC; }`
  });
  scene.add(new THREE.LineSegments(geo, mat));

  /* ---------- 3. Layout: map DOM positions into world units ---------- */
  const secs = $$('[data-scrollcraft-section]'), target = $('[data-scrollcraft-3d-target]');
  let tops = [], W = 0, H = 0, worldW = 0, worldH = 0;
  const page = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width/2, y: r.top + scrollY + r.height/2 }; };
  function layout() {
    W = innerWidth; H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    U.uAspect.value = camera.aspect;
    worldH = 2 * Math.tan(THREE.MathUtils.degToRad(22.5)) * camera.position.z; worldW = worldH * camera.aspect;
    tops = secs.map(s => s.getBoundingClientRect().top + scrollY);
    const mobile = W < 768, base = mobile ? worldW * .3 : Math.min(worldH * .3, worldW * .17);
    U.uAlpha.value = mobile ? .5 : 1;
    const hero = target ? page(target) : { x: W * .72, y: H * .5 };
    const heroX = mobile ? 0 : (hero.x / W - .5) * worldW;
    // stacked mobile layout: the shape sits in the target window beneath the text, clamped on-screen
    const heroY = -(Math.min(Math.max(hero.y, H * .3), H * (mobile ? .8 : .6)) / H - .5) * worldH;
    U.uOff.value[0].set(heroX, heroY, 0);
    U.uOff.value[1].set(mobile ? 0 : worldW * .2, 0, 0);
    U.uOff.value[2].set(0, mobile ? worldH * .1 : 0, -1.5);
    U.uOff.value[3].set(mobile ? 0 : -worldW * .02, mobile ? worldH * .3 : 0, 0);
    U.uScl.value = [base, base * 1.05, mobile ? base * .8 : base * 1.5, base * (mobile ? .8 : .95)];
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
  let cur = 0, last = performance.now(), running = true;
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
    renderer.render(scene, camera);
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

  /* ---------- 5b. Pointer + touch impulses (window-level, passive; canvas itself ignores pointer events) ---------- */
  let slot = 0, lastPush = 0;
  const push = (x, y) => {
    const now = U.uTime.value; if (now - lastPush < .04) return; lastPush = now;
    U.uM.value[slot].set((x / innerWidth) * 2 - 1, -((y / innerHeight) * 2 - 1), now); slot = (slot + 1) & 7;
  };
  if (!REDUCE) {
    addEventListener('pointermove', e => push(e.clientX, e.clientY), { passive: true });
    addEventListener('touchstart', e => { const t = e.touches[0]; if (t) push(t.clientX, t.clientY); }, { passive: true });
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
