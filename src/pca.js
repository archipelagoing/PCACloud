// All analysis stays in the browser. No dependencies or network requests.
export function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else cell += c;
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(cell.trim()); cell = '';
      if (c !== ',') { if (row.some(v => v !== '')) rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
    } else cell += c;
  }
  if (quoted) throw new Error('A quoted field is unfinished. Please check your CSV.');
  row.push(cell.trim()); if (row.some(v => v !== '')) rows.push(row);
  if (rows.length < 3) throw new Error('Include a header and at least two data rows.');
  const headers = rows.shift();
  if (headers.length > 100) throw new Error('Please use a CSV with 100 columns or fewer.');
  const numeric = v => v !== undefined && v !== '' && Number.isFinite(Number(v));
  const columns = headers.map((name, index) => ({ name: name || `Column ${index + 1}`, index }))
    .filter(col => rows.some(r => numeric(r[col.index])) && rows.every(r => r[col.index] === undefined || r[col.index] === '' || numeric(r[col.index])));
  if (columns.length < 2) throw new Error('PCA needs at least two numeric columns. Remove text values from measurement columns.');
  const valid = rows.filter(r => r.length === headers.length && columns.every(c => numeric(r[c.index])));
  if (valid.length < 2) throw new Error('At least two complete numeric rows are needed.');
  const count = Math.min(valid.length, 2500);
  const data = Array.from({ length: count }, (_, i) => columns.map(c => Number(valid[Math.floor(i * valid.length / count)][c.index])));
  return { data, columns: columns.map(c => c.name), skipped: rows.length - valid.length, sampled: valid.length > count, sourceRows: valid.length };
}

export function prepareData(data, standardize = true) {
  const n = data.length, d = data[0]?.length;
  if (n < 2 || !d || data.some(row => row.length !== d || row.some(v => !Number.isFinite(v)))) throw new Error('PCA requires a finite rectangular matrix with at least two rows.');
  // Scaling all values first avoids overflow for very large CSV measurements.
  const magnitudes = Array.from({ length: d }, (_, j) => Math.max(...data.map(r => Math.abs(r[j]))) || 1);
  const commonScale = Math.max(...magnitudes);
  const scaled = data.map(r => r.map((v, j) => v / (standardize ? magnitudes[j] : commonScale)));
  const mean = Array.from({ length: d }, (_, j) => scaled.reduce((s, r) => s + r[j], 0) / n);
  const scales = mean.map((m, j) => standardize ? Math.sqrt(scaled.reduce((s, r) => s + (r[j] - m) ** 2, 0) / (n - 1)) || 1 : 1);
  const centered = scaled.map(r => r.map((v, j) => (v - mean[j]) / scales[j]));
  return centered;
}

export function pca(data, standardize = true) {
  const centered = prepareData(data, standardize);
  const n = data.length, d = data[0].length;
  const a = Array.from({ length: d }, () => Array(d).fill(0));
  for (let j = 0; j < d; j++) for (let k = j; k < d; k++) a[j][k] = a[k][j] = centered.reduce((s, r) => s + r[j] * r[k], 0) / (n - 1);
  const total = a.reduce((s, r, j) => s + r[j], 0);
  if (total < 1e-25) throw new Error('These columns have no variation. Try data with changing measurements.');
  const vectors = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => +(i === j)));
  // Cyclic Jacobi eigendecomposition of the symmetric covariance matrix.
  for (let sweep = 0; sweep < 60; sweep++) {
    let largest = 0;
    for (let p = 0; p < d; p++) for (let q = p + 1; q < d; q++) {
      largest = Math.max(largest, Math.abs(a[p][q]));
      if (Math.abs(a[p][q]) < total * 1e-13) continue;
      const angle = .5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]);
      const c = Math.cos(angle), s = Math.sin(angle), pp = a[p][p], qq = a[q][q], pq = a[p][q];
      a[p][p] = c*c*pp - 2*s*c*pq + s*s*qq;
      a[q][q] = s*s*pp + 2*s*c*pq + c*c*qq; a[p][q] = a[q][p] = 0;
      for (let k = 0; k < d; k++) {
        if (k !== p && k !== q) { const kp = a[k][p], kq = a[k][q]; a[k][p] = a[p][k] = c*kp-s*kq; a[k][q] = a[q][k] = s*kp+c*kq; }
        const vp = vectors[k][p], vq = vectors[k][q]; vectors[k][p] = c*vp-s*vq; vectors[k][q] = s*vp+c*vq;
      }
    }
    if (largest < total * 1e-11) break;
  }
  const order = Array.from({ length: d }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]).slice(0, 3);
  const components = order.map(i => vectors.map(r => r[i]));
  const variance = order.map(i => Math.max(0, a[i][i]) / total);
  const points = centered.map(row => components.map(v => row.reduce((s, x, j) => s + x*v[j], 0)));
  while (variance.length < 3) { variance.push(0); points.forEach(p => p.push(0)); }
  const reconstructionError = Math.max(0, 1 - variance.reduce((s, v) => s + v, 0));
  return { points, variance, components, reconstructionError };
}

export function sampleData() {
  let seed = 42;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return (seed + 1) / 4294967297; };
  const normal = () => Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
  const data = Array.from({ length: 1600 }, () => {
    const cluster = random(), x = normal() * .7 + (cluster > .6 ? 1.7 : -1), y = normal() * .6 + (cluster > .6 ? .5 : 0), z = normal() * .4;
    return [18+4*x+y, 65+8*x-4*y+z, 1013+3*x+4*y, 12+2*x+3*z, 8+x-y+2*z, 30+4*x+2*y-z].map(v => v + normal() * .17);
  });
  return { data, columns: ['Temperature', 'Humidity', 'Pressure', 'Wind', 'Visibility', 'Dew point'], skipped: 0, sampled: false };
}
