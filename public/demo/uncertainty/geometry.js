// Canonical pipeline from arXiv:2509.13813:
//   embed (L2-normalized) -> PCA to 15-D -> archetypal analysis with K=16
//   -> Geometric Volume  = volume of the archetype simplex in 15-D
//   -> Geometric Suspicion = rank-sum of local density, distance from
//      consensus, and archetype-usage rarity.
// The 3-D view is the first three PCA coordinates of the same geometry.
// Displayed volume is |det|^(1/15): the geometric-mean semantic spread per
// dimension — a small positive number, linear, no logs.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- PCA via the Gram matrix (works for any embedding dimension) ------------

function jacobiEigen(S) {
  const n = S.length;
  const A = S.map(r => r.slice());
  const V = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++)
      for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const pairs = Array.from({ length: n }, (_, i) => ({
    value: A[i][i],
    vector: V.map(row => row[i]),
  }));
  pairs.sort((a, b) => b.value - a.value);
  return pairs;
}

export function pca(E, dims) {
  const n = E.length, d = E[0].length;
  const m = Math.min(dims, n - 1);
  const mean = new Array(d).fill(0);
  for (const row of E) for (let j = 0; j < d; j++) mean[j] += row[j] / n;
  const X = E.map(row => row.map((v, j) => v - mean[j]));
  const G = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0;
      for (let k = 0; k < d; k++) s += X[i][k] * X[j][k];
      return s;
    }));
  const eig = jacobiEigen(G).slice(0, m);
  const P = Array.from({ length: n }, () => new Array(dims).fill(0));
  for (let a = 0; a < m; a++) {
    const s = Math.sqrt(Math.max(eig[a].value, 0));
    let maxAbs = 0, maxVal = 1;
    for (let i = 0; i < n; i++) {
      const v = eig[a].vector[i] * s;
      P[i][a] = v;
      if (Math.abs(v) > maxAbs) { maxAbs = Math.abs(v); maxVal = v; }
    }
    if (maxVal < 0) for (let i = 0; i < n; i++) P[i][a] *= -1;
  }
  return P;
}

// --- archetypal analysis ------------------------------------------------------

function projSimplexRow(row) {
  const K = row.length;
  const u = row.slice().sort((a, b) => b - a);
  let css = 0, theta = 0, found = false;
  for (let k = 0; k < K; k++) {
    css += u[k];
    if (u[k] - (css - 1) / (k + 1) > 0) { theta = (css - 1) / (k + 1); found = true; }
    else css -= u[k];
  }
  if (!found) theta = (row.reduce((a, b) => a + b, 0) - 1) / K;
  return row.map(v => Math.max(v - theta, 0));
}

const matmul = (A, B) => A.map(row =>
  B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
const transpose = A => A[0].map((_, j) => A.map(row => row[j]));
const frob2 = A => A.reduce((s, row) => s + row.reduce((t, v) => t + v * v, 0), 0);

export function archetypes(P, K = 16, iters = 1200, restarts = 3, seed = 1) {
  const n = P.length;
  let best = { loss: Infinity, A: null, Z: null };
  const rand = mulberry32(seed);
  const loss_of = (A, B) => frob2(matmul(A, matmul(B, P)).map((row, i) => row.map((v, j) => v - P[i][j])));
  for (let r = 0; r < restarts; r++) {
    let A = Array.from({ length: n }, () => projSimplexRow(
      Array.from({ length: K }, () => rand())));
    let B = Array.from({ length: K }, () => projSimplexRow(
      Array.from({ length: n }, () => rand())));
    let prev = Infinity;
    for (let it = 0; it < iters; it++) {
      const Z = matmul(B, P);
      let L = frob2(Z) + 1e-9;
      const GA = matmul(matmul(A, Z).map((row, i) => row.map((v, j) => v - P[i][j])), transpose(Z));
      A = A.map((row, i) => projSimplexRow(row.map((v, j) => v - GA[i][j] / L)));
      const R = matmul(A, matmul(B, P)).map((row, i) => row.map((v, j) => v - P[i][j]));
      L = frob2(A) * frob2(P) + 1e-9;
      const GB = matmul(transpose(A), matmul(R, transpose(P)));
      B = B.map((row, i) => projSimplexRow(row.map((v, j) => v - GB[i][j] / L)));
      if (it % 50 === 49) {
        const cur = loss_of(A, B);
        if (prev - cur < 1e-8 * Math.max(prev, 1e-12)) break;
        prev = cur;
      }
    }
    const Z = matmul(B, P);
    const loss = loss_of(A, B);
    if (loss < best.loss) best = { loss, A, Z };
  }
  return best;
}

// --- Geometric Volume -----------------------------------------------------------

function det(Msrc) {
  const n = Msrc.length;
  const M = Msrc.map(r => r.slice());
  let d = 1;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++)
      if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-300) return 0;
    if (piv !== c) { [M[piv], M[c]] = [M[c], M[piv]]; d = -d; }
    d *= M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return d;
}

// K archetypes in (K-1)-D span a simplex; displayed volume is |det|^(1/(K-1)),
// the geometric-mean spread per semantic dimension (linear, no logs).
export function geometricVolume(Z) {
  const K = Z.length, d = Z[0].length;
  const M = [];
  for (let i = 1; i < K; i++) M.push(Z[i].map((v, j) => v - Z[0][j]));
  let detAbs;
  if (M.length === d) {
    detAbs = Math.abs(det(M));
  } else {
    const G = matmul(M, transpose(M));
    detAbs = Math.sqrt(Math.abs(det(G)));
  }
  const m = M.length;
  return { spread: Math.pow(detAbs, 1 / m), detAbs };
}

// --- Geometric Suspicion ----------------------------------------------------------

export function rankAvg(v) {
  const idx = v.map((val, i) => [val, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(v.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg;
    i = j + 1;
  }
  return ranks;
}

const dist = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) * (a[i] - b[i]);
  return Math.sqrt(s);
};

export function suspicion(P, A) {
  const n = P.length;
  const k = Math.min(5, n - 1);
  const dens = P.map((p, i) => {
    const ds = [];
    for (let j = 0; j < n; j++) if (j !== i) ds.push(dist(p, P[j]));
    ds.sort((a, b) => a - b);
    return ds.slice(0, k).reduce((s, v) => s + v, 0) / k;
  });
  const c = P[0].map((_, a) => P.reduce((s, p) => s + p[a], 0) / n);
  const cons = P.map(p => dist(p, c));
  const K = A[0].length;
  const usage = Array.from({ length: K }, (_, j) =>
    A.reduce((s, row) => s + row[j], 0) / n);
  const rare = A.map(row =>
    row.reduce((s, v, j) => s + v * -Math.log(usage[j] + 1e-9), 0));
  const r1 = rankAvg(dens), r2 = rankAvg(cons), r3 = rankAvg(rare);
  return dens.map((_, i) => r1[i] + r2[i] + r3[i]);
}

// --- full pipeline -------------------------------------------------------------------

export function analyze(embeddings, { dims = 15, K = 16 } = {}) {
  const P = pca(embeddings, dims);
  const { A, Z } = archetypes(P, K);
  const S = suspicion(P, A);
  const { spread } = geometricVolume(Z);
  const P3 = P.map(p => p.slice(0, 3));
  const Z3 = Z.map(z => z.slice(0, 3));
  return { P3, Z3, S, volume: spread };
}
