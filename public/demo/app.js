import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';

const DATA = window.SCENARIO_DATA;
const API = new URLSearchParams(location.search).get('api')
  || 'https://geometric-uncertainty.nathandelisle.workers.dev';

const COL = { correct: 0x2F7A4D, wrong: 0xB3432B, neutral: 0x5B6B7A, hull: 0x6B7C8F };

// ---------- formatting -------------------------------------------------------

function fmtVol(v) {
  if (!isFinite(v) || v <= 0) return '0';
  if (v >= 0.01) return v.toFixed(2);
  const dec = Math.min(Math.ceil(-Math.log10(v)) + 1, 10);
  const [i, f] = v.toFixed(dec).split('.');
  return i + '.' + f.replace(/(\d{3})(?=\d)/g, '$1 ');
}

const suspWord = p => (p < 1 / 3 ? 'low' : p < 2 / 3 ? 'moderate' : 'high');

// ---------- three setup ------------------------------------------------------

const wrap = document.getElementById('canvasWrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(2.0, 1.3, 2.35);

scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d4c8, 1.35));
const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(3, 5, 4);
scene.add(sun);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;
controls.minDistance = 1.2;
controls.maxDistance = 9;
controls.addEventListener('start', () => { controls.autoRotate = false; });

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

const sphereGeo = new THREE.SphereGeometry(1, 28, 20);
const ringGeo = new THREE.RingGeometry(1.32, 1.46, 48);

function groupPoints(points) {
  const map = new Map();
  for (const pt of points) {
    const key = pt.text.toLowerCase().replace(/[\s.]+$/, '');
    if (!map.has(key)) map.set(key, { texts: new Map(), pos: [0, 0, 0], count: 0, s: 0, correct: pt.correct, greedy: false });
    const g = map.get(key);
    g.texts.set(pt.text, (g.texts.get(pt.text) || 0) + 1);
    for (let a = 0; a < 3; a++) g.pos[a] += pt.p[a];
    g.count += 1;
    g.s += pt.s;
    g.greedy = g.greedy || pt.greedy;
  }
  const groups = [...map.values()];
  for (const g of groups) {
    for (let a = 0; a < 3; a++) g.pos[a] /= g.count;
    g.s /= g.count;
    g.text = [...g.texts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return groups;
}

let hovered = null;
let currentMeshes = [];

function renderScenario(sc, live = false) {
  scene.remove(cloud);
  cloud = new THREE.Group();
  rings.length = 0;
  currentMeshes = [];

  const groups = groupPoints(sc.points);
  const n = sc.points.length;

  // normalize the view: center on the centroid, scale to unit radius
  const c = [0, 1, 2].map(a => sc.points.reduce((s, p) => s + p.p[a], 0) / n);
  let maxR = 0;
  for (const p of sc.points)
    maxR = Math.max(maxR, Math.hypot(p.p[0] - c[0], p.p[1] - c[1], p.p[2] - c[2]));
  const k = maxR > 1e-6 ? 1 / maxR : 1;

  const sMin = Math.min(...sc.points.map(p => p.s));
  const sMax = Math.max(...sc.points.map(p => p.s));

  for (const g of groups) {
    const color = live ? COL.neutral : (g.correct ? COL.correct : COL.wrong);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });
    const m = new THREE.Mesh(sphereGeo, mat);
    const r = 0.045 + 0.055 * Math.cbrt(g.count);
    m.scale.setScalar(r);
    m.position.set((g.pos[0] - c[0]) * k, (g.pos[1] - c[1]) * k, (g.pos[2] - c[2]) * k);
    m.userData = {
      ...g,
      live,
      truth: sc.truth,
      pct: sMax > sMin ? (g.s - sMin) / (sMax - sMin) : 0,
      baseScale: r,
    };
    cloud.add(m);
    currentMeshes.push(m);
    if (g.greedy) {
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0x1C1A15, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
      }));
      ring.scale.setScalar(r);
      ring.position.copy(m.position);
      ring.raycast = () => {};
      rings.push(ring);
      cloud.add(ring);
    }
  }

  // archetype hull — only when there is volume to show
  if (sc.volume > 1e-3 && sc.archetypes) {
    try {
      const pts = sc.archetypes.map(z =>
        new THREE.Vector3((z[0] - c[0]) * k, (z[1] - c[1]) * k, (z[2] - c[2]) * k));
      const hull = new ConvexHull().setFromPoints(pts);
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
        color: COL.hull, transparent: true, opacity: 0.09,
        side: THREE.DoubleSide, depthWrite: false,
      }));
      mesh.raycast = () => {};
      cloud.add(mesh);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 8),
        new THREE.LineBasicMaterial({ color: COL.hull, transparent: true, opacity: 0.3 }));
      edges.raycast = () => {};
      cloud.add(edges);
    } catch { /* degenerate hull: draw nothing */ }
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
      m.scale.setScalar(d.baseScale * 1.18);
      const total = d.live ? 31 : 31;
      let verdict = '';
      if (!d.live) {
        verdict = d.correct
          ? '<div class="v ok">✓ correct</div>'
          : `<div class="v no">✗ wrong — it was ${d.truth}</div>`;
      }
      tip.innerHTML = `
        <div class="a">${escapeHtml(d.text)}</div>
        <div class="m">${d.count} of ${total} answers · suspicion ${suspWord(d.pct)}${d.greedy ? ' · the temperature-0 answer' : ''}</div>
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
      <div class="caption">${sc.caption}</div>`;
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
