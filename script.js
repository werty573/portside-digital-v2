/* Portside Digital — ScrollCraft 3D
 * Hooks:
 *   [data-scrollcraft-canvas]        fixed WebGL canvas behind the page
 *   [data-scrollcraft-3d-target]     hero window; the workstation forms around its centre
 *   [data-scrollcraft-section]       sections that drive morph progress (data-scrollcraft-shape = 0..3)
 *   [data-track]                     headlines whose letter-spacing tightens as they reach screen centre
 *   [data-project-url]               roster slots; a non-empty URL turns the slot into a live link
 * All triangle morphing runs on the GPU (one draw call); JS only updates a few uniforms per frame.
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
    /* 0 · desktop workstation: monitor, screen inset, stand, base, desk, keyboard, mouse, tower, mug */
    [].concat(box(0,.5,0,2.0,1.2,.08), box(0,.5,.05,1.8,1.0,.01), box(0,-.25,-.05,.15,.5,.1), box(0,-.5,-.05,.7,.04,.4),
      box(0,-.56,.2,3.4,.03,1.5), box(0,-.5,.65,1.3,.05,.4), box(.95,-.5,.65,.15,.05,.24), box(-1.55,-.1,-.1,.4,1.3,.6), box(1.5,-.4,.1,.2,.3,.2)),
    /* 1 · cargo vessel: prismatic hull, container stacks, bridge, funnel, mast, waves */
    (() => {
      const hull = prism([[-1.3,.1],[1.1,.1],[1.55,.1],[1.15,-.35],[-1.2,-.35]], -.45, .45);
      const boxes = [];
      for (let i = 0; i < 5; i++) for (let l = 0; l < 2; l++) for (const z of [-.2, .2]) boxes.push(...box(-1.05 + i*.42, .21 + l*.22, z, .38, .2, .34));
      boxes.push(...box(1.0,.4,0,.42,.6,.7), ...box(.9,.85,0,.16,.3,.16), ...box(1.0,1.05,0,.03,.5,.03));
      const waves = [];
      for (let z = -.8; z <= .8; z += .4) for (let x = -1.6; x < 1.6; x += .4) waves.push([[x,-.45,z],[x+.2,-.38,z]], [[x+.2,-.38,z],[x+.4,-.45,z]]);
      return [].concat(hull, boxes, waves);
    })(),
    /* 2 · coordinate pillars on a floor axis grid */
    (() => {
      const e = [];
      for (let i = 0; i < 7; i++) { const h = 1 + (i % 4) * .5 + i * .12; e.push(...box(-2.4 + i*.8, -1 + h/2, ((i % 2) * 2 - 1) * .5, .22, h, .22)); }
      for (let z = -.9; z <= .9; z += .6) e.push([[-2.8,-1,z],[2.8,-1,z]]);
      for (let x = -2.8; x <= 2.8; x += .8) e.push([[x,-1,-.9],[x,-1,.9]]);
      return e;
    })(),
    /* 3 · exclamation block: tapered bar + cube dot */
    [].concat(box(0,.45,0,.5,1.6,.4), box(0,.45,0,.32,1.6,.24), box(0,-.75,0,.5,.5,.4))
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
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); return; }              // no WebGL: page stays a clean black canvas
  renderer.setClearColor(0x000000, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
  camera.position.z = 7;

  const MAIN = matchMedia('(max-width: 820px)').matches ? 1500 : 2800, AMB = 420, N = MAIN + AMB;
  const MAINC = [0x8052ff, 0xffb829, 0x15846e], AMBC = [0x8052ff, 0xffb829, 0x15846e, 0x3b2a8f, 0x2f4fd0, 0x5a2d91];
  const CORNER = [0,1,1,2,2,0].map(i => [Math.cos(Math.PI/2 + i*2.0944), Math.sin(Math.PI/2 + i*2.0944), 0]);

  const V = N * 6;
  const A = { c: new Float32Array(V*3), t: [0,1,2,3].map(() => new Float32Array(V*3)), col: new Float32Array(V*4), s: new Float32Array(V*2) };
  const samplers = SHAPES.map(edgeSampler);
  for (let p = 0; p < N; p++) {
    const amb = p >= MAIN, seed = Math.random();
    const hex = new THREE.Color((amb ? AMBC : MAINC)[(Math.random() * (amb ? AMBC : MAINC).length) | 0]);
    const pts = amb ? (() => { const q = [(Math.random()-.5)*26, (Math.random()-.5)*16, -6 - Math.random()*10]; return [q,q,q,q]; })() : samplers.map(s => s());
    const size = amb ? .06 + Math.random()*.08 : .03 + Math.random()*.05;
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
    uP: { value: 0 }, uTime: { value: 0 }, uSpin: { value: 0 }, uAlpha: { value: 1 },
    uOff: { value: [0,1,2,3].map(() => new THREE.Vector3()) }, uScl: { value: [1,1,1,1] }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec3 aCorner, tA, tB, tC, tD; attribute vec4 aColor; attribute vec2 aSeed;
      uniform float uP, uTime, uSpin, uAlpha, uScl[4]; uniform vec3 uOff[4];
      varying vec4 vC;
      vec3 tgt(int i){ if(i==0) return tA*uScl[0]+uOff[0]; if(i==1) return tB*uScl[1]+uOff[1]; if(i==2) return tC*uScl[2]+uOff[2]; return tD*uScl[3]+uOff[3]; }
      vec3 off(int i){ if(i==0) return uOff[0]; if(i==1) return uOff[1]; if(i==2) return uOff[2]; return uOff[3]; }
      mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
      mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
      void main(){
        float seed = aSeed.x; vec3 pos; float alpha = aColor.a;
        if(aSeed.y > .5){                       // ambient glyphs: deep, slow drift, never morph
          pos = tA + vec3(sin(uTime*.12+seed*6.28)*.6, cos(uTime*.1+seed*9.4)*.45, sin(uTime*.08+seed*3.1)*.5);
        } else {
          int i = int(floor(uP)); int j = int(min(float(i)+1., 3.));
          float t = clamp(uP - floor(uP), 0., 1.); t = t*t*(3.-2.*t);
          vec3 a = tgt(i), b = tgt(j);
          vec3 centre = mix(off(i), off(j), t);
          pos = mix(a, b, t);
          // break apart mid-morph: scatter outward in 3D, then re-cluster
          vec3 dir = vec3(sin(seed*12.9), cos(seed*78.2), sin(seed*37.7));
          pos += dir * sin(t*3.14159) * (1.2 + seed*1.6);
          // rotational depth around the shape centre (stage 4 adds continuous spin)
          float ang = sin(uTime*.3)*.35 + uP*.45 + uSpin*uTime*.9;
          pos = centre + rotY(ang) * (pos - centre);
          alpha *= uAlpha;
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
    const dpr = Math.min(devicePixelRatio || 1, W < 820 ? 1.5 : 2);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    worldH = 2 * Math.tan(THREE.MathUtils.degToRad(22.5)) * camera.position.z; worldW = worldH * camera.aspect;
    tops = secs.map(s => s.getBoundingClientRect().top + scrollY);
    const mobile = W < 820, base = mobile ? worldW * .3 : Math.min(worldH * .3, worldW * .17);
    U.uAlpha.value = mobile ? .55 : 1;
    const hero = target ? page(target) : { x: W * .72, y: H * .5 };
    const heroX = mobile ? 0 : (hero.x / W - .5) * worldW, heroY = mobile ? worldH * .12 : -(Math.min(hero.y, H*.6) / H - .5) * worldH;
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
    U.uSpin.value = REDUCE ? 0 : THREE.MathUtils.smoothstep(cur, 2.6, 3);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  addEventListener('load', layout);
  layout(); requestAnimationFrame(frame);

  /* ---------- 5. Scroll-driven headline tracking ---------- */
  const tracked = $$('[data-track]');
  const track = () => tracked.forEach(el => {
    const r = el.getBoundingClientRect(), d = Math.min(1, Math.abs(r.top + r.height/2 - innerHeight/2) / innerHeight);
    el.style.letterSpacing = (-.04 + .026 * d).toFixed(4) + 'em';
  });
  addEventListener('scroll', () => requestAnimationFrame(track), { passive: true }); track();

  /* ---------- 6. Portfolio roster, slot reservation, booking form ---------- */
  $$('[data-project-url]').forEach(a => {
    const url = a.getAttribute('data-project-url'); if (!url) return;
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.innerHTML = '<span class="label">' + (a.dataset.projectTitle || 'Visit live site') + '</span>';
  });

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
