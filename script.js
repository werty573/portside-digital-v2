/* Portside Digital — ScrollCraft 3D (wireframe pyramids with spatial depth mapping)
 * Hooks:
 *   [data-scrollcraft-canvas]        fixed WebGL canvas behind the page
 *   [data-scrollcraft-3d-target]     hero window; the workstation forms around its centre
 *   [data-scrollcraft-section]       sections that drive morph progress (data-scrollcraft-shape = 0..3)
 *   [data-track]                     headlines whose letter-spacing tightens as they reach screen centre
 *   [data-project-url]               roster slots; a non-empty URL turns the slot into a live link
 * One THREE.InstancedMesh of 4-sided pyramids (ConeGeometry) drawn with material.wireframe = true.
 * Depth mapping: every target point carries an "edge level" (0 = interior crevice, 1 = outer silhouette).
 * The vertex shader combines it with simplex noise into an occlusion factor: crevice pyramids shrink 50-70% and fade to 10-20%
 * opacity (negative space), silhouette pyramids stay at 90-100%. Colour bands follow shape-local height (teal / violet / amber).
 */
(() => {
  'use strict';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 1. Volumetric target shapes ----------
     edges: [a, b, level]   quads: [centre, halfU, halfV, level]   (level: 0 interior/crevice ... 1 outer silhouette) */
  const box = (cx, cy, cz, w, h, d) => {
    const x = w/2, y = h/2, z = d/2;
    const v = [[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]].map(p => [p[0]+cx, p[1]+cy, p[2]+cz]);
    return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].map(e => [v[e[0]], v[e[1]]]);
  };
  const shape = k => ({ e: [], q: [], k, cur: .5, qlv: .3 });        // k = surface density; cur = level applied to following edges
  const L = (s, v) => { s.cur = v; return s; };
  const addBox = (s, ...a) => box(...a).forEach(e => s.e.push([e[0], e[1], s.cur]));
  const line = (s, a, b) => s.e.push([a, b, s.cur]);
  const addSolid = (s, cx, cy, cz, w, h, d) => {
    addBox(s, cx, cy, cz, w, h, d); const x = w/2, y = h/2, z = d/2, l = s.qlv;
    s.q.push([[cx,cy,cz+z],[x,0,0],[0,y,0],l], [[cx,cy,cz-z],[x,0,0],[0,y,0],l], [[cx+x,cy,cz],[0,y,0],[0,0,z],l],
             [[cx-x,cy,cz],[0,y,0],[0,0,z],l], [[cx,cy+y,cz],[x,0,0],[0,0,z],l], [[cx,cy-y,cz],[x,0,0],[0,0,z],l]);
  };

  /* 0 · desktop workstation: outer bezel + desk outline are silhouette; screen fill, keys, hump are interior detail */
  const SH0 = (() => {
    const s = shape(5), R = 3.2, cy = .55, n = 18;
    const P = (hw, i) => { const th = Math.asin(hw / R), a = -th + 2*th*i/n; return [R*Math.sin(a), R*(1 - Math.cos(a)) - .15]; };
    const arc = (hw, hh, fill, lv) => { L(s, lv); for (let i = 0; i < n; i++) { const a = P(hw, i), b = P(hw, i+1);
      line(s, [a[0],cy+hh,a[1]], [b[0],cy+hh,b[1]]); line(s, [a[0],cy-hh,a[1]], [b[0],cy-hh,b[1]]);
      if (fill) s.q.push([[(a[0]+b[0])/2, cy, (a[1]+b[1])/2], [(b[0]-a[0])/2, 0, (b[1]-a[1])/2], [0, hh, 0], .3]); }
      [0, n].forEach(i => { const a = P(hw, i); line(s, [a[0],cy-hh,a[1]], [a[0],cy+hh,a[1]]); }); };
    arc(1.6, .62, false, 1); arc(1.52, .54, true, .55);
    L(s, .35); for (const yy of [.3, .5, .7]) for (let i = 2; i < 9; i++) { const a = P(1.4, i), b = P(1.4, i+1); line(s, [a[0],yy,a[1]], [b[0],yy,b[1]]); }
    L(s, .25); addBox(s, 0,.55,-.35,1.3,.7,.3);                                     // rear hump: hidden, so deep shadow
    L(s, .8); addBox(s, 0,-.2,-.3,.16,.55,.08); addBox(s, 0,-.5,-.15,.9,.04,.5);
    L(s, .85); addBox(s, 0,-.56,.2,3.4,.03,1.5); L(s, .5); [[-1.6,-.4],[1.6,-.4],[-1.6,.8],[1.6,.8]].forEach(p => addBox(s, p[0],-.9,p[1],.06,.7,.06));
    L(s, .8); addBox(s, 0,-.5,.68,1.4,.05,.44); L(s, .7); addBox(s, 1.05,-.5,.68,.15,.05,.24);
    L(s, .3); for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) addBox(s, -.6 + c*.109, -.46, .55 + r*.1, .09, .02, .08);
    L(s, .85); addBox(s, -1.65,-.1,-.1,.4,1.3,.6); L(s, .4); addBox(s, -1.65,.35,.21,.3,.06,.02); addBox(s, -1.65,.2,.21,.3,.06,.02);
    L(s, .7); addBox(s, -1.2,-.3,-.15,.22,.5,.24); addBox(s, 1.2,-.3,-.15,.22,.5,.24); L(s, .75); addBox(s, 1.6,-.4,.15,.2,.3,.2);
    return s;
  })();

  /* 1 · cargo ship: deck rails, masts, rigging, bridge and top stacks are silhouette; lower hull, ribs and container gaps are crevices */
  const SH1 = (() => {
    const s = shape(0), hw = x => .45 * Math.min(1, Math.max(0, (1.6 - x) / .55));
    const ring = (x, y0, y1) => { const w = hw(x), k = w*.65; return [[x,y1,-w],[x,y1,w],[x,y0,k],[x,y0,-k]]; };
    const xs = []; for (let x = -1.35; x <= 1.58; x += .1) xs.push(x);
    const edgeLv = [.55, .3, .08, .3];                                            // ring top / right / keel / left
    xs.forEach((x, i) => { const r = ring(x, -.35, .1), end = (i === 0 || i === xs.length - 1);
      r.forEach((p, k) => { L(s, end ? Math.max(.85, edgeLv[k]) : edgeLv[k]); line(s, p, r[(k+1)%4]); });
      if (i) { const q = ring(xs[i-1], -.35, .1); r.forEach((p, k) => { L(s, k < 2 ? 1 : .12); line(s, q[k], p); }); } });   // deck rails = 1, keel lines = .12
    for (let lv = 0; lv <= 4; lv++) { const y = .1 - lv*.09, f = 1 - lv*.09; L(s, .85 - lv*.18);                          // waterlines fade toward the keel
      for (const sd of [-1, 1]) for (let i = 1; i < xs.length; i++) line(s, [xs[i-1], y, sd*hw(xs[i-1])*f], [xs[i], y, sd*hw(xs[i])*f]); }
    for (let i = 0; i < 6; i++) for (let l = 0; l < 3; l++) for (const z of [-.26, -.09, .09, .26]) {                   // container stacks
      L(s, Math.min(.95, .2 + l*.28 + (Math.abs(z) > .2 ? .22 : 0))); addBox(s, -1.1 + i*.34, .2 + l*.19, z, .3, .17, .16); }
    L(s, .85); for (let l = 0; l < 4; l++) addBox(s, 1.0, .22 + l*.17, 0, .46 - l*.02, .15, .72 - l*.03);
    L(s, .95); addBox(s, 1.0,.95,0,.52,.05,.78); addBox(s, .9,1.15,0,.16,.32,.16); addBox(s, 1.1,1.15,0,.12,.28,.12);
    L(s, 1); line(s, [1.0,1.3,0], [1.0,1.75,0]); line(s, [.9,1.3,0], [.9,1.55,0]); line(s, [.85,1.55,0], [.95,1.55,0]);
    for (const mx of [-.5, .3]) {
      L(s, 1); line(s, [mx,.1,0], [mx,1.3,0]); line(s, [mx,1.05,-.22], [mx,1.05,.22]); line(s, [mx,1.3,-.1], [mx,1.3,.1]);
      for (const z of [-.05, 0, .05]) { line(s, [mx,1.3,z], [-1.4,.12,z*4]); line(s, [mx,1.3,z], [mx>0?1.45:.9,.12,z*4]); }
      L(s, .8); for (const z of [-.42, .42]) line(s, [mx,1.3,0], [mx,.1,z]);
    }
    return s;
  })();

  /* 2 · ocean grid: border and near rows are bright, distant rows fall off (depth cue); noise carves gaps */
  const SH2 = (() => {
    const s = shape(0), X0 = -3.4, X1 = 3.4, Z0 = -5.5, Z1 = 1.2, dep = z => .3 + .5*(z - Z0)/(Z1 - Z0);
    const Y = (x, z) => -1 + .28*Math.sin(x*1.1 + z*.6)*Math.cos(z*.8) + .12*Math.sin(x*2.3 - z*1.5);
    for (let x = X0; x <= X1 + .01; x += .28) for (let z = Z0; z < Z1; z += .15) { L(s, (x < X0 + .01 || x > X1 - .3) ? .95 : dep(z)); line(s, [x, Y(x,z), z], [x, Y(x,z+.15), z+.15]); }
    for (let z = Z0; z <= Z1 + .01; z += .3) for (let x = X0; x < X1; x += .15) { L(s, (z > Z1 - .3 || z < Z0 + .01) ? .95 : dep(z)); line(s, [x, Y(x,z), z], [x+.15, Y(x+.15,z), z]); }
    return s;
  })();

  /* 3 · exclamation matrix: slab outlines are silhouette, fills and inner cube are interior */
  const SH3 = (() => {
    const s = shape(9); s.qlv = .35; L(s, 1);
    for (let i = 0; i < 8; i++) addSolid(s, 0, 1.15 - i*.2, 0, .6 - .04*i, .2, .46 - .03*i);
    addSolid(s, 0,-.75,0,.5,.5,.4); L(s, .4); addBox(s, 0,-.75,0,.3,.3,.24);
    return s;
  })();
  const SHAPES = [SH0, SH1, SH2, SH3];
  const BANDS = [[-.75, 1.2], [-.35, 1.25], [-1.35, -.6], [-1.05, 1.3]];        // shape-local height range mapped to the teal -> violet -> amber bands

  const sampler = s => {                                            // point on edges (length x silhouette weight) or quads (area x density)
    const items = []; let tot = 0;
    s.e.forEach(e => { const len = Math.hypot(e[1][0]-e[0][0], e[1][1]-e[0][1], e[1][2]-e[0][2]) || .001;
      tot += len * (e[2] > .75 ? 3.5 : e[2] > .45 ? 1.6 : 1); items.push([tot, 0, e]); });   // silhouette edges pack tighter
    s.q.forEach(q => { const u = q[1], v = q[2], cx = u[1]*v[2]-u[2]*v[1], cy = u[2]*v[0]-u[0]*v[2], cz = u[0]*v[1]-u[1]*v[0];
      tot += 4*Math.hypot(cx, cy, cz) * s.k; items.push([tot, 1, q]); });
    return () => {
      const r = Math.random() * tot; let lo = 0, hi = items.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; items[m][0] < r ? lo = m + 1 : hi = m; }
      const it = items[lo], g = it[2], j = .01; let p;
      if (it[1] === 0) { const t = Math.random(); p = [0,1,2].map(k => g[0][k] + (g[1][k]-g[0][k]) * t); p.push(g[2]); }
      else { const a = Math.random()*2-1, b = Math.random()*2-1; p = [0,1,2].map(k => g[0][k] + g[1][k]*a + g[2][k]*b); p.push(g[3]); }
      return [p[0] + (Math.random()-.5)*j, p[1] + (Math.random()-.5)*j, p[2] + (Math.random()-.5)*j, p[3]];
    };
  };

  /* ---------- 2. Scene: one InstancedMesh of wireframe pyramids ---------- */
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

  const MAIN = MOBILE ? 1500 : 8000, AMB = MOBILE ? 250 : 600, N = MAIN + AMB;
  /* Base pyramid 35% smaller than before (radius 1 -> .65, height 1.6 -> 1.04): fine, razor-thin wireframe cells. Open base = 8 clean seams. */
  const geo = new THREE.ConeGeometry(.65, 1.04, 4, 1, true);
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');

  const T = [0,1,2,3].map(() => new Float32Array(N*3)), SD = new Float32Array(N*4), LV = new Float32Array(N*4);   // SD = seed, isAmbient, size, palette; LV = edge level per shape
  const samplers = SHAPES.map(sampler), ambPal = [0,1,2,3,4,5];
  for (let p = 0; p < N; p++) {
    const amb = p >= MAIN, seed = Math.random();
    const pts = amb ? (() => { const q = [(Math.random()-.5)*28, (Math.random()-.5)*17, -6 - Math.random()*11, .5]; return [q,q,q,q]; })() : samplers.map(f => f());
    for (let s = 0; s < 4; s++) { T[s].set(pts[s].slice(0, 3), p*3); LV[p*4 + s] = pts[s][3]; }
    const size = (amb ? .07 + Math.random()*.09 : .03 + Math.random()*.035) * (MOBILE ? 1.5 : 1);
    SD.set([seed, amb ? 1 : 0, size, amb ? ambPal[(Math.random() * ambPal.length) | 0] : 0], p*4);
  }
  ['tA','tB','tC','tD'].forEach((n, i) => geo.setAttribute(n, new THREE.InstancedBufferAttribute(T[i], 3)));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(SD, 4));
  geo.setAttribute('aLvl', new THREE.InstancedBufferAttribute(LV, 4));

  const OPACITY = .85;
  const U = {
    uP: { value: 0 }, uTime: { value: 0 }, uSpinAngle: { value: 0 }, uVib: { value: 0 }, uAlpha: { value: 1 },
    uAspect: { value: 1 }, uTan: { value: Math.tan(THREE.MathUtils.degToRad(22.5)) }, uCamZ: { value: 7 }, uRad: { value: MOBILE ? 1.2 : 1 },
    uOpacity: { value: OPACITY },
    uBand: { value: BANDS.map(b => new THREE.Vector2(b[0], b[1])) },
    uMouse: { value: new THREE.Vector2() }, uStr: { value: 0 },
    uOff: { value: [0,1,2,3].map(() => new THREE.Vector3()) }, uScl: { value: [1,1,1,1] }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `
      attribute vec3 tA, tB, tC, tD; attribute vec4 aSeed, aLvl;
      uniform float uP, uTime, uSpinAngle, uVib, uAlpha, uAspect, uTan, uCamZ, uRad, uStr, uOpacity, uScl[4];
      uniform vec3 uOff[4]; uniform vec2 uMouse, uBand[4];
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

      vec3 raw(int k){ if(k==0) return tA; if(k==1) return tB; if(k==2) return tC; return tD; }
      vec3 tgt(int i){ if(i==0) return tA*uScl[0]+uOff[0]; if(i==1) return tB*uScl[1]+uOff[1]; if(i==2) return tC*uScl[2]+uOff[2]; return tD*uScl[3]+uOff[3]; }
      vec3 off(int i){ if(i==0) return uOff[0]; if(i==1) return uOff[1]; if(i==2) return uOff[2]; return uOff[3]; }
      float lvOf(int k){ if(k==0) return aLvl.x; if(k==1) return aLvl.y; if(k==2) return aLvl.z; return aLvl.w; }
      vec2 bandR(int k){ if(k==0) return uBand[0]; if(k==1) return uBand[1]; if(k==2) return uBand[2]; return uBand[3]; }

      /* simulated ambient occlusion: interior/low-level points + multi-octave noise => crevice factor 0..1 (silhouette points stay near 0) */
      float crevOf(int k){
        vec3 p = raw(k);
        float n = (snoise(p*2.4)*.65 + snoise(p*7. + 13.)*.35) * .5 + .5;
        return smoothstep(.35, .75, (1. - lvOf(k))*.8 + n*.45);
      }
      /* coordinate colour band from shape-local height (+ slight x/z lean and noise so seams are organic) */
      float bandOf(int k){
        vec3 p = raw(k); vec2 r = bandR(k);
        return clamp((p.y - r.x)/(r.y - r.x) + p.x*.03 + p.z*.05 + snoise(p*1.3 + 9.)*.05, 0., 1.);
      }
      vec3 bandCol(float b){
        vec3 teal = vec3(.082,.518,.431)*.75, iris = vec3(.502,.322,1.), amber = vec3(1.,.722,.161)*1.1;
        return mix(mix(teal, iris, smoothstep(.12, .22, b)), amber, smoothstep(.46, .56, b));
      }
      vec3 pal(float k){
        if(k<.5) return vec3(.502,.322,1.); if(k<1.5) return vec3(1.,.722,.161); if(k<2.5) return vec3(.082,.518,.431);
        if(k<3.5) return vec3(.23,.16,.56); if(k<4.5) return vec3(.18,.31,.82); return vec3(.35,.18,.57);
      }
      mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
      mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }

      void main(){
        float seed = aSeed.x, amb = aSeed.y, size = aSeed.z;
        vec3 pos, col = pal(aSeed.w); float glow = 0., mag = 1.;
        float a = uOpacity;                                // base line opacity 0.85
        if(amb > .5){                                   // ambient pyramids: deep, dim, noise-driven drift
          pos = tA + flow(tA*.12 + uTime*.04) * 1.4; col *= .3; a *= .5;
        } else {
          int i = int(floor(uP)); int j = int(min(float(i)+1., 3.));
          float t = clamp(uP - floor(uP), 0., 1.); t = t*t*(3.-2.*t);
          vec3 centre = mix(off(i), off(j), t);
          pos = mix(tgt(i), tgt(j), t);
          float crev = mix(crevOf(i), crevOf(j), t);                    // occlusion factor for this pyramid
          float lv = mix(lvOf(i), lvOf(j), t);                          // silhouette level
          col = bandCol(mix(bandOf(i), bandOf(j), t));                  // spatial colour band: teal hull, violet body, amber top
          float mist = step(.9, seed);                 // ~10% loose mist halo
          vec3 dir = vec3(sin(seed*12.9), cos(seed*78.2), sin(seed*37.7));
          pos += dir * sin(t*3.14159) * (1.2 + seed*1.6);              // break apart mid-morph
          float ang = sin(uTime*.3)*.35 + uP*.45 + uSpinAngle;
          pos = centre + rotX(.2) * (rotY(ang) * (pos - centre));
          float wv = 1. - clamp(abs(uP - 2.), 0., 1.); wv = wv*wv*(3. - 2.*wv);
          pos.y += wv * (sin(pos.x*1.3 + uTime*1.1)*.17 + sin(pos.z*1.6 - uTime*.8)*.13 + sin((pos.x+pos.z)*.7 + uTime*.6)*.1);
          float amp = mix(.03, .14, sin(t*3.14159)) * mix(1., 5., mist);   // gentler mist so the structure stays crisp
          pos += flow(pos*.85 + vec3(0., 0., uTime*.25)) * amp;
          if(uVib > .001) pos += flow(pos*7. + uTime*9.) * .028 * uVib;
          // magnetic hover
          vec2 mw = uMouse * vec2(uAspect, 1.) * uTan * (uCamZ - pos.z);
          vec2 d = mw - pos.xy; float r = length(d);
          glow = exp(-r*r/(uRad*uRad)) * uStr;
          float hv = smoothstep(.06, .55, glow);
          pos.xy += d * glow * .3; pos.z += glow * .6; mag = 1. + glow*2.2;
          crev *= 1. - hv*.85;                                          // hovering reveals the shadowed structure
          // occlusion: crevice pyramids shrink 50-70% and fade to 10-20% opacity; silhouette pyramids sit at 90-100%
          size *= mix(1., .3 + .2*fract(seed*3.7), crev);
          a = mix(a, .1 + .1*fract(seed*5.3), crev);
          float edgeB = smoothstep(.65, .95, lv) * (1. - crev) * (1. - mist);
          a = mix(a, .9 + .1*fract(seed*9.1), edgeB);
          a *= mix(1., .7, mist);
          col *= mix(1., .6, crev) * (1. + edgeB*.25) * mix(1., .55, mist) * uAlpha;
          col = mix(col, vec3(1.), hv) * (1. + glow*.5);                // hover: wireframe flashes bone-white
          a = mix(a, 1., hv);                                           // ...and opacity eases to 1.0
        }
        mat3 R = rotY(uTime*(.3 + seed*.5) + seed*6.28) * rotX(uTime*(.25 + seed*.4) + seed*3.);
        vC = col * 1.15; vA = a;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + R * (position * size * mag), 1.);
      }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ gl_FragColor = vec4(vC, vA); }`,
    wireframe: true,                       // rasterise only the hollow edge lattice
    transparent: true,
    opacity: OPACITY,                      // ShaderMaterial ignores this by itself, so the same value feeds uOpacity
    depthWrite: false                      // overlapping translucent lines never clip each other
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);               // instanceMatrix stays identity; all motion is shader-driven
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
    U.uAlpha.value = mobile ? .5 : 1;
    const hero = target ? page(target) : { x: W * .72, y: H * .5 };
    const heroX = mobile ? 0 : (hero.x / W - .5) * worldW;
    // stacked mobile layout: the shape sits in the target window beneath the text, clamped on-screen
    const heroY = -(Math.min(Math.max(hero.y, H * .3), H * (mobile ? .8 : .6)) / H - .5) * worldH;
    U.uOff.value[0].set(heroX, heroY, 0);
    U.uOff.value[1].set(mobile ? 0 : worldW * .2, 0, 0);
    U.uOff.value[2].set(0, -worldH * (mobile ? .05 : .12), -.5);
    U.uOff.value[3].set(mobile ? 0 : -worldW * .02, mobile ? worldH * .3 : 0, 0);
    U.uScl.value = [base * .72, base * 1.0, base * (mobile ? .62 : 1.3), base * (mobile ? .8 : .95)];
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
