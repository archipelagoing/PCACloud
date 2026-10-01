const $ = id => document.getElementById(id);
const percent = value => `${(value * 100).toFixed(2)}%`;
const format = value => Math.abs(value) < 1e-9 ? '0' : value.toFixed(3);
const basePoints = [[1, 3], [3, 1], [5, 3], [7, 5]];

export function fourPointAnalysis(multiplier = 1, standardize = false) {
  const data = basePoints.map(([x, y]) => [x, y * multiplier]);
  const mean = [4, 3 * multiplier];
  const scales = standardize ? [Math.sqrt(5), Math.sqrt(2) * multiplier] : [1, 1];
  const centered = data.map(row => row.map((value, j) => (value - mean[j]) / scales[j]));
  const covariance = [0, 1].map(j => [0, 1].map(k => centered.reduce((sum, row) => sum + row[j] * row[k], 0) / 4));
  const [[a, b], [, d]] = covariance;
  const gap = Math.hypot(a - d, 2 * b);
  const eigenvalues = [(a + d + gap) / 2, (a + d - gap) / 2];
  const angle = Math.atan2(2 * b, a - d) / 2;
  const direction = [Math.cos(angle), Math.sin(angle)];
  const scores = centered.map(row => row[0] * direction[0] + row[1] * direction[1]);
  const reconstructed = scores.map(score => direction.map(value => value * score));
  return { data, mean, scales, centered, covariance, eigenvalues, direction, scores, reconstructed,
    variance: eigenvalues.map(value => value / (a + d)) };
}

export function componentsForVariance(spectrum, threshold) {
  let cumulative = 0;
  const index = spectrum.findIndex(value => (cumulative += value) >= threshold - 1e-12);
  return index < 0 ? spectrum.length : index + 1;
}

// SVG charts have fixed view boxes and responsive CSS dimensions. Dataset names
// and feature labels are inserted as text nodes, never parsed as markup.
function svgChart(title, width, height) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);
  return svg;
}
function element(svg, type, attributes, label) {
  const node = document.createElementNS(svg.namespaceURI, type);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (label !== undefined) node.textContent = label;
  svg.append(node);
  return node;
}
function scree(spectrum) {
  const svg = svgChart('Explained variance per component and cumulative explained variance', 620, 245);
  const left = 42, top = 18, width = 550, height = 178;
  const y = value => top + (1 - value) * height;
  for (const value of [0, .5, .9, .95, 1]) {
    element(svg, 'line', { x1: left, x2: left + width, y1: y(value), y2: y(value), class: value === .9 || value === .95 ? 'chart-reference' : 'chart-grid' });
    element(svg, 'text', { x: left - 7, y: y(value) + 3, 'text-anchor': 'end' }, `${value * 100}%`);
  }
  let sum = 0;
  const line = [];
  spectrum.forEach((value, i) => {
    const step = width / spectrum.length, x = left + (i + .5) * step;
    const bar = element(svg, 'rect', { x: left + i * step + 1, y: y(value), width: Math.max(.5, step - 2), height: value * height, class: i < 3 ? 'chart-bar retained' : 'chart-bar' });
    element(bar, 'title', {}, `PC${i + 1}: ${percent(value)}`);
    line.push(`${x},${y(sum += value)}`);
    if (spectrum.length <= 15 || i === 0 || i === spectrum.length - 1 || (i + 1) % 10 === 0)
      element(svg, 'text', { x, y: 213, 'text-anchor': 'middle' }, String(i + 1));
  });
  element(svg, 'polyline', { points: line.join(' '), class: 'chart-cumulative' });
  if (spectrum.length === 1) element(svg, 'circle', { cx: left + width / 2, cy: y(sum), r: 3, class: 'chart-point' });
  element(svg, 'text', { x: left + width / 2, y: 238, 'text-anchor': 'middle' }, 'Principal component');
  $('scree-chart').replaceChildren(svg);
  const retained = spectrum.slice(0, 3).reduce((sum, value) => sum + value, 0);
  $('scree-summary').textContent = `This view retains ${percent(retained)} of the variance and loses ${percent(Math.max(0, 1 - retained))}. ${componentsForVariance(spectrum, .9)} components reach 90%; ${componentsForVariance(spectrum, .95)} reach 95%.`;
}

function loadings(result, columns, index) {
  const weights = result.components[index];
  const top = weights.map((value, i) => ({ value, i })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 3).map(item => item.i);
  const table = document.createElement('table');
  table.className = 'loading-table';
  const caption = table.createCaption();
  caption.textContent = `PC${index + 1} feature weights · ${percent(result.variance[index])} of variance`;
  const header = table.createTHead().insertRow();
  for (const label of ['Feature', 'Direction and weight']) {
    const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; header.append(cell);
  }
  const body = table.createTBody();
  weights.forEach((value, i) => {
    const row = body.insertRow();
    if (top.includes(i)) row.className = 'top-loading';
    row.insertCell().textContent = columns[i];
    const cell = row.insertCell(), track = document.createElement('span'), bar = document.createElement('i'), number = document.createElement('span');
    track.className = 'loading-track'; track.setAttribute('aria-hidden', 'true');
    bar.style.width = `${Math.abs(value) * 50}%`; bar.style.left = `${value < 0 ? 50 - Math.abs(value) * 50 : 50}%`;
    track.append(bar); number.textContent = `${value > 0 ? '+' : ''}${format(value)}`; cell.append(track, number);
  });
  $('loading-chart').replaceChildren(table);
}

function lesson() {
  const multiplier = Number($('lesson-scale').value), standardized = $('lesson-standardize').checked;
  const result = fourPointAnalysis(multiplier, standardized);
  $('lesson-scale-value').value = `×${multiplier}`;
  const svg = svgChart('Four centered points, their PC1 reconstructions, and discarded distances', 620, 285);
  const extent = Math.max(...result.centered.flat().map(Math.abs)) * 1.25;
  const scale = 110 / extent, x = value => 310 + value * scale, y = value => 135 - value * scale;
  element(svg, 'line', { x1: 25, x2: 595, y1: 135, y2: 135, class: 'chart-grid' });
  element(svg, 'line', { x1: 310, x2: 310, y1: 15, y2: 250, class: 'chart-grid' });
  const [vx, vy] = result.direction;
  element(svg, 'line', { x1: x(-extent * vx), y1: y(-extent * vy), x2: x(extent * vx), y2: y(extent * vy), class: 'lesson-axis' });
  element(svg, 'text', { x: x(extent * vx) + 8, y: y(extent * vy) }, 'PC1');
  result.centered.forEach(([a, b], i) => {
    const [ra, rb] = result.reconstructed[i];
    element(svg, 'line', { x1: x(a), y1: y(b), x2: x(ra), y2: y(rb), class: 'chart-reference' });
    element(svg, 'circle', { cx: x(ra), cy: y(rb), r: 4, class: 'lesson-reconstructed' });
    element(svg, 'circle', { cx: x(a), cy: y(b), r: 5, class: 'chart-point' });
    element(svg, 'text', { x: x(a) + 8, y: y(b) - 7 }, `${'ABCD'[i]} (${format(a)}, ${format(b)})`);
  });
  element(svg, 'text', { x: 590, y: 150, 'text-anchor': 'end' }, standardized ? 'Standardized x₁' : 'Centered x₁');
  element(svg, 'text', { x: 318, y: 14 }, standardized ? 'Standardized x₂' : 'Centered x₂');
  element(svg, 'text', { x: 310, y: 277, 'text-anchor': 'middle' }, 'Both axes use the same scale; dashed lines show loss from keeping only PC1.');
  $('lesson-chart').replaceChildren(svg);
  const [[a, b], [, d]] = result.covariance;
  const lines = [
    `1. Center: mean = (${format(result.mean[0])}, ${format(result.mean[1])}).${standardized ? ` Divide by population standard deviations (${format(result.scales[0])}, ${format(result.scales[1])}).` : ''}`,
    `2. Covariance: Σ = X̃ᵀX̃ / 4 = [[${format(a)}, ${format(b)}], [${format(b)}, ${format(d)}]].`,
    `3. Eigenvalues: λ₁ = ${format(result.eigenvalues[0])}; λ₂ = ${format(result.eigenvalues[1])}. Unit PC1 = (${format(vx)}, ${format(vy)}).`,
    `4. Retained variance: PC1 = ${percent(result.variance[0])}; PC2 = ${percent(result.variance[1])}.`,
    `5. Project D: (${format(result.centered[3][0])}, ${format(result.centered[3][1])}) · (${format(vx)}, ${format(vy)}) = ${format(result.scores[3])}.`,
    `6. Reconstruct D from PC1: (${result.reconstructed[3].map(format).join(', ')}). Relative squared error over all four points: ${percent(result.variance[1])}.`
  ];
  $('lesson-calculation').replaceChildren(...lines.map(line => { const p = document.createElement('p'); p.textContent = line; return p; }));
}

export function setupLearning(onExample) {
  $('learn').onclick = () => { $('learn-dialog').showModal(); };
  $('close-learn').onclick = () => $('learn-dialog').close();
  $('lesson-scale').oninput = lesson;
  $('lesson-standardize').onchange = lesson;
  $('lesson-cloud').onclick = () => {
    const result = fourPointAnalysis(Number($('lesson-scale').value), $('lesson-standardize').checked);
    onExample({ data: result.data, columns: ['x₁', 'x₂'], skipped: 0, sampled: false }, $('lesson-standardize').checked);
    $('learn-dialog').close();
  };
  lesson();
}

export function updateLearning(result, dataset, standardized) {
  $('learn-dataset').textContent = `${$('dataset-name').textContent} · ${dataset.data.length.toLocaleString()} analyzed rows · ${dataset.columns.length} features · ${standardized ? 'standardized' : 'centered, without standardization'}`;
  scree(result.spectrum);
  const selector = $('loading-component');
  const index = Math.min(Number(selector.value) || 0, result.components.length - 1);
  selector.replaceChildren(...result.components.map((_, i) => new Option(`PC${i + 1}`, i)));
  selector.value = index;
  selector.onchange = () => loadings(result, dataset.columns, Number(selector.value));
  loadings(result, dataset.columns, index);
}
