import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pca, prepareData } from '../src/pca.js';
import { fourPointAnalysis, componentsForVariance, lessonGeometry } from '../src/learn.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} ≠ ${b}`);

test('four-point walkthrough reproduces the assignment population calculation', () => {
  const result = fourPointAnalysis();
  assert.deepEqual(result.mean, [4, 3]);
  assert.deepEqual(result.covariance, [[5, 2], [2, 2]]);
  assert.deepEqual(result.eigenvalues, [6, 1]);
  close(result.direction[0], 2 / Math.sqrt(5));
  close(result.direction[1], 1 / Math.sqrt(5));
  close(result.scores[3], 8 / Math.sqrt(5));
  close(result.variance[0], 6 / 7);
  const error = result.centered.reduce((sum, row, i) => sum + row.reduce((s, v, j) => s + (v - result.reconstructed[i][j]) ** 2, 0), 0);
  close(error / result.centered.flat().reduce((s, v) => s + v * v, 0), 1 / 7);
});

test('changing units changes raw PCA but preserves the standardized lesson', () => {
  const raw = fourPointAnalysis(10);
  assert.deepEqual(raw.covariance, [[5, 20], [20, 200]]);
  close(raw.variance[0], (205 + Math.sqrt(39625)) / 410);
  const a = fourPointAnalysis(1, true), b = fourPointAnalysis(10, true);
  a.variance.forEach((v, i) => close(v, b.variance[i]));
  a.scores.forEach((v, i) => close(v, b.scores[i]));
  close(a.eigenvalues[0], 1 + 2 / Math.sqrt(10));
  // The cloud uses sample standard deviations, so scores differ by this factor.
  const prepared = prepareData(b.data, true);
  prepared.forEach((row, i) => row.forEach((v, j) => close(v, b.centered[i][j] * Math.sqrt(3 / 4))));
});

test('full scree spectrum includes omitted components and exact threshold counts', () => {
  const data = [[4,0,0,0],[-4,0,0,0],[0,3,0,0],[0,-3,0,0],[0,0,2,0],[0,0,-2,0],[0,0,0,1],[0,0,0,-1]];
  const result = pca(data, false);
  assert.equal(result.spectrum.length, 4);
  [16/30, 9/30, 4/30, 1/30].forEach((v, i) => close(v, result.spectrum[i]));
  close(result.spectrum.reduce((s, v) => s + v, 0), 1);
  close(result.reconstructionError, result.spectrum[3]);
  close(result.eigenvalues.reduce((s, v) => s + v, 0), 2 * 30 / (16 * 7));
  assert.equal(componentsForVariance(result.spectrum, .9), 3);
  assert.equal(componentsForVariance(result.spectrum, .95), 3);
  assert.equal(componentsForVariance([.9, .05, .05], .9), 1);
  assert.equal(componentsForVariance([.9, .05, .05], .95), 2);
});

test('walkthrough scene preserves centering and perpendicular reconstruction loss', () => {
  for (const multiplier of [1, 10]) for (const standardized of [false, true]) {
    const result = fourPointAnalysis(multiplier, standardized);
    const centering = lessonGeometry(result, 0), reconstruction = lessonGeometry(result, 5);
    centering.original.forEach((point, i) => point.forEach((value, j) => close(value - centering.mean[j], centering.points[i][j])));
    reconstruction.points.forEach((point, i) => {
      const recovered = reconstruction.reconstructed[i];
      close(recovered[0] * result.direction[1] - recovered[1] * result.direction[0], 0);
      close((point[0] - recovered[0]) * result.direction[0] + (point[1] - recovered[1]) * result.direction[1], 0);
      assert.ok(Math.hypot(...point) <= 1 + 1e-12);
    });
  }
});
