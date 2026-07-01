import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';

const DATA = window.SCENARIO_DATA;
const API = new URLSearchParams(location.search).get('api')
  || 'https://geometric-uncertainty.ndelisle.workers.dev';

const COL = {
  correct: 0x2F7A4D, wrong: 0xB3432B, neutral: 0x5B6B7A,
  hull: 0x51677D, frame: 0xCFCABB, label: 0xA19B8B,
};

// ---------- formatting -------------------------------------------------------

function fmtVol(v) {
  if (!isFinite(v) || v <= 0) return '0';
  if (v >= 0.01) return v.toFixed(2);
  const dec = Math.min(Math.ceil(-Math.log10(v)) + 1, 10);
  const [i, f] = v.toFixed(dec).split('.');
  return i + '.' + f.replace(/(\d{3})(?=\d)/g, '$1 ');
}

const suspWord = p => (p < 1 / 3 ? 'low' : p < 2 / 3 ? 'moderate' : 'high');

// ---------- three setup ------------------------------------------------------

const wrap = document.getElementById('canvasWrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(2.15, 1.35, 2.5);

scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4c8, 1.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(3, 5, 4);
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.minDistance = 1.2;
controls.maxDistance = 9;
controls.addEventListener('start', () => { controls.autoRotate = false; });

// ---------- fixed reference frame: floor grid + axis triad --------------------

function textSprite(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 48;
  const g = c.getContext('2d');
  g.font = '500 26px "IBM Plex Mono", monospace';
  g.fillStyle = '#A19B8B';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 24);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false,
  }));
  sp.scale.set(0.30, 0.1125, 1);
  return sp;
}

function buildFrame() {
  const f = new THREE.Group();
  const Y = -1.3, S = 1.55;

  const grid = new THREE.GridHelper(2 * S, 8, 0xE3E0D4, 0xEAE7DC);
  grid.position.y = Y;
  f.add(grid);

  const mat = new THREE.LineBasicMaterial({ color: COL.frame });
  const axis = (a, b) => {
    const g = new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    f.add(new THREE.Line(g, mat));
  };
  axis([-S, Y, -S], [S, Y, -S]);        // pc1
  axis([-S, Y, -S], [-S, Y, S]);        // pc2
  axis([-S, Y, -S], [-S, Y + 2.0, -S]); // pc3

  const l1 = textSprite('pc1'); l1.position.set(S + 0.16, Y, -S); f.add(l1);
  const l2 = textSprite('pc2'); l2.position.set(-S, Y, S + 0.18); f.add(l2);
  const l3 = textSprite('pc3'); l3.position.set(-S, Y + 2.14, -S); f.add(l3);

  for (const o of f.children) o.raycast = () => {};
  return f;
}
scene.add(buildFrame());

let cloud = new THREE.Group();
scene.add(cloud);
const rings = [];

function fit() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(fit).observe(wrap);
fit();

renderer.setAnimationLoop(() => {
  controls.update();
  for (const r of rings) r.quaternion.copy(camera.quaternion);
  renderer.render(scene, camera);
});

// ---------- scenario rendering ----------------------------------------------

const DOT_R = 0.052;
const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
const ringGeo = new THREE.RingGeometry(1.5, 1.72, 48);
const archGeo = new THREE.OctahedronGeometry(0.022);

// Coincident answers (identical strings embed identically) are packed into a
// tight ball of individual dots so every answer stays visible and hoverable.
function spreadDuplicates(pts) {
  const keyOf = p => p.map(v => Math.round(v / 0.014)).join(',');
  const groups = new Map();
  pts.forEach((p, i) => {
    const k = keyOf(p);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  });
  const out = pts.map(p => p.slice());
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (const idxs of groups.values()) {
    const m = idxs.length;
    if (m < 2) continue;
    idxs.forEach((pi, j) => {
      const t = (j + 0.5) / m;
      const r = DOT_R * 1.35 * Math.cbrt(m) * Math.cbrt(t);
      const y = 1 - 2 * t;
      const rad = Math.sqrt(Math.max(1 - y * y, 0));
      const th = golden * j;
      out[pi][0] += r * rad * Math.cos(th);
      out[pi][1] += r * y;
      out[pi][2] += r * rad * Math.sin(th);
    });
  }
  return out;
}

let hovered = null;
let currentMeshes = [];

function renderScenario(sc, live = false) {
  scene.remove(cloud);
  cloud = new THREE.Group();
  rings.length = 0;
  currentMeshes = [];

  const n = sc.points.length;

  // normalize the view: center on the centroid, scale to unit radius
  const c = [0, 1, 2].map(a => sc.points.reduce((s, p) => s + p.p[a], 0) / n);
  let maxR = 0;
  for (const p of sc.points)
    maxR = Math.max(maxR, Math.hypot(p.p[0] - c[0], p.p[1] - c[1], p.p[2] - c[2]));
  const k = maxR > 1e-6 ? 1 / maxR : 1;
  const norm = p => [(p[0] - c[0]) * k, (p[1] - c[1]) * k, (p[2] - c[2]) * k];

  const sMin = Math.min(...sc.points.map(p => p.s));
  const sMax = Math.max(...sc.points.map(p => p.s));

  // how many times each exact answer occurs (for the tooltip)
  const counts = new Map();
  for (const p of sc.points) {
    const key = p.text.toLowerCase().replace(/[\s.]+$/, '');
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const positions = spreadDuplicates(sc.points.map(p => norm(p.p)));

  sc.points.forEach((pt, i) => {
    const color = live ? COL.neutral : (pt.correct ? COL.correct : COL.wrong);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });
    const m = new THREE.Mesh(sphereGeo, mat);
    m.scale.setScalar(DOT_R);
    m.position.set(...positions[i]);
    m.userData = {
      text: pt.text,
      correct: pt.correct,
      greedy: pt.greedy,
      live,
      truth: sc.truth,
      count: counts.get(pt.text.toLowerCase().replace(/[\s.]+$/, '')),
      pct: sMax > sMin ? (pt.s - sMin) / (sMax - sMin) : 0,
      baseScale: DOT_R,
    };
    cloud.add(m);
    currentMeshes.push(m);
    if (pt.greedy) {
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0x1C1A15, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
        depthTest: false,
      }));
      ring.scale.setScalar(DOT_R);
      ring.position.copy(m.position);
      ring.renderOrder = 10;
      ring.raycast = () => {};
      rings.push(ring);
      cloud.add(ring);
    }
  });

  // the volume the archetypes enclose — always drawn, but its visual weight
  // is keyed to the true 15-D volume: a collapsed batch's hull is a flat,
  // near-invisible film even though its 3-D shadow has extent
  const maxV = Math.max(...DATA.scenarios.map(s => s.volume), sc.volume, 1e-12);
  const share = Math.sqrt(Math.max(sc.volume, 0) / maxV);
  if (sc.archetypes) {
    const arch = sc.archetypes.map(norm);
    for (const z of arch) {
      const marker = new THREE.Mesh(archGeo, new THREE.MeshBasicMaterial({
        color: COL.hull, transparent: true, opacity: 0.65,
      }));
      marker.position.set(...z);
      marker.raycast = () => {};
      cloud.add(marker);
    }
    try {
      // minuscule jitter so a fully collapsed archetype set still yields a
      // drawable (tiny) hull instead of a qhull failure
      const jit = mulberryJitter(arch, 0.004);
      const hull = new ConvexHull().setFromPoints(jit.map(z => new THREE.Vector3(...z)));
      const pos = [];
      for (const face of hull.faces) {
        let e = face.edge;
        const a = e.head().point; e = e.next;
        const b = e.head().point; e = e.next;
        const d = e.head().point;
        pos.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: COL.hull, transparent: true, opacity: 0.02 + 0.11 * share,
        side: THREE.DoubleSide, depthWrite: false,
      }));
      mesh.raycast = () => {};
      cloud.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 5),
        new THREE.LineBasicMaterial({ color: COL.hull, transparent: true, opacity: 0.08 + 0.32 * share }));
      edges.raycast = () => {};
      cloud.add(edges);
    } catch { /* nothing to enclose */ }
  }

  scene.add(cloud);

  document.getElementById('qline').textContent = sc.question;
  const tline = document.getElementById('tline');
  if (live) {
    tline.innerHTML = 'live sample — correctness not graded, geometry only';
  } else {
    tline.innerHTML = `correct answer: <span class="truth">${sc.truth}</span>`;
  }
}

function mulberryJitter(pts, s) {
  let seed = 12345;
  const rnd = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) - 0.5;
  };
  return pts.map(p => p.map(v => v + s * rnd()));
}

// ---------- tooltip -----------------------------------------------------------

const tip = document.getElementById('tip');
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('pointermove', ev => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(currentMeshes, false)[0];
  if (hovered && (!hit || hit.object !== hovered)) {
    hovered.scale.setScalar(hovered.userData.baseScale);
    hovered = null;
    tip.style.display = 'none';
    renderer.domElement.style.cursor = '';
  }
  if (hit) {
    const m = hit.object, d = m.userData;
    if (hovered !== m) {
      hovered = m;
      m.scale.setScalar(d.baseScale * 1.25);
      let verdict = '';
      if (!d.live) {
        verdict = d.correct
          ? '<div class="v ok">✓ correct</div>'
          : `<div class="v no">✗ wrong — it was ${d.truth}</div>`;
      }
      const times = d.count > 1 ? `given ${d.count} of 31 times` : 'given once';
      tip.innerHTML = `
        <div class="a">${escapeHtml(d.text)}</div>
        <div class="m">${times} · suspicion ${suspWord(d.pct)}${d.greedy ? ' · the temperature-0 answer' : ''}</div>
        ${verdict}`;
      renderer.domElement.style.cursor = 'pointer';
    }
    tip.style.display = 'block';
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = Math.min(ev.clientX + 16, window.innerWidth - tw - 12) + 'px';
    tip.style.top = Math.min(ev.clientY + 14, window.innerHeight - th - 12) + 'px';
  }
});

renderer.domElement.addEventListener('pointerleave', () => {
  if (hovered) hovered.scale.setScalar(hovered.userData.baseScale);
  hovered = null;
  tip.style.display = 'none';
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

// ---------- rail + volume bars -------------------------------------------------

const scenariosEl = document.getElementById('scenarios');
const vrowsEl = document.getElementById('vrows');
let liveResult = null;
let activeId = 's1';

function buildRail() {
  scenariosEl.innerHTML = '';
  DATA.scenarios.forEach((sc, i) => {
    const b = document.createElement('button');
    b.className = 'scenario';
    b.id = 'btn-' + sc.id;
    b.innerHTML = `
      <span class="num">${i + 1}</span><span class="label">${sc.label}</span>
      <div class="q">${sc.question}</div>
      ${sc.caption ? `<div class="caption">${sc.caption}</div>` : ''}`;
    b.addEventListener('click', () => select(sc.id));
    scenariosEl.appendChild(b);
  });
}

function renderVolumes() {
  const rows = DATA.scenarios.map((sc, i) => ({ id: sc.id, num: String(i + 1), v: sc.volume }));
  if (liveResult) rows.push({ id: 'live', num: '4', v: liveResult.volume });
  const maxV = Math.max(...rows.map(r => r.v), 1e-12);
  vrowsEl.innerHTML = rows.map(r => `
    <div class="vrow ${r.id === activeId ? 'active' : ''}">
      <span class="vnum">${r.num}</span>
      <span class="vbar"><i style="width:${Math.max(100 * r.v / maxV, 0.8)}%"></i></span>
      <span class="vval">${fmtVol(r.v)}</span>
    </div>`).join('');
}

function select(id) {
  activeId = id;
  document.querySelectorAll('.scenario').forEach(el =>
    el.classList.toggle('active', el.id === 'btn-' + id));
  document.getElementById('ask').classList.toggle('active', id === 'live');
  if (id === 'live' && liveResult) renderScenario(liveResult, true);
  else {
    const sc = DATA.scenarios.find(s => s.id === id);
    if (sc) renderScenario(sc);
  }
  renderVolumes();
  controls.autoRotate = true;
}

// ---------- live questions ------------------------------------------------------

const worker = new Worker('./analysis_worker.js', { type: 'module' });
const statusEl = document.getElementById('status');
const input = document.getElementById('q');
let busy = false;

function setStatus(msg, err = false) {
  statusEl.textContent = msg;
  statusEl.className = err ? 'err' : '';
}

input.addEventListener('keydown', async ev => {
  if (ev.key !== 'Enter' || busy) return;
  const question = input.value.trim();
  if (question.length < 4) return;
  busy = true;
  try {
    setStatus('sampling the model 30 times…');
    const res = await fetch(API + '/sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error('sampling failed (' + res.status + ')');
    const { samples, greedy } = await res.json();
    const texts = [...samples, greedy].map(t => t.replace(/\s+/g, ' ').trim());

    const result = await new Promise((resolve, reject) => {
      worker.onmessage = ev2 => {
        const d = ev2.data;
        if (d.stage === 'embedding') setStatus('embedding 31 answers (first run downloads the encoder)…');
        else if (d.stage === 'analyzing') setStatus('fitting archetypes…');
        else if (d.error) reject(new Error(d.error));
        else if (d.result) resolve(d.result);
      };
      worker.postMessage({ texts });
    });

    liveResult = {
      question,
      truth: null,
      volume: result.volume,
      archetypes: result.Z3,
      points: texts.map((text, i) => ({
        text, correct: false, greedy: i === texts.length - 1,
        p: result.P3[i], s: result.S[i],
      })),
    };
    setStatus('');
    select('live');
  } catch (e) {
    setStatus(e.message || 'something went wrong', true);
  } finally {
    busy = false;
  }
});

// ---------- go -------------------------------------------------------------------

buildRail();
select('s1');
