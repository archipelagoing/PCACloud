import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pca, parseCSV, sampleData } from './pca.js';

test('perfectly correlated data lies on one principal component', () => {
  const result = pca([[1,2,3],[2,4,6],[3,6,9],[4,8,12]]);
  assert.ok(Math.abs(result.variance[0]-1)<1e-10);
  for(const point of result.points) assert.ok(Math.abs(point[1])+Math.abs(point[2])<1e-10);
});
test('known diagonal covariance returns correct ordered variance', () => {
  const result=pca([[3,0],[ -3,0],[0,1],[0,-1]],false);
  assert.ok(Math.abs(result.variance[0]-.9)<1e-10);
  assert.ok(Math.abs(result.variance[1]-.1)<1e-10);
  assert.equal(result.variance[2],0);
});
test('standardization is invariant to measurement units',()=>{
  const data=sampleData().data.slice(0,100);
  const a=pca(data),b=pca(data.map(r=>r.map((v,j)=>v*10**j)));
  a.variance.forEach((v,i)=>assert.ok(Math.abs(v-b.variance[i])<1e-10));
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(a.components[i].reduce((s,v,k)=>s+v*a.components[j][k],0)-(i===j?1:0))<1e-10);
});
test('CSV handles quoted commas, CRLF, missing rows, and text labels',()=>{
  const result=parseCSV('name,x,y\r\n"a,b",1,2\r\nc,3,4\r\nd,,5\r\n');
  assert.deepEqual(result.data,[[1,2],[3,4]]);assert.equal(result.skipped,1);assert.deepEqual(result.columns,['x','y']);
});
test('invalid and constant inputs fail with actionable errors',()=>{
  assert.throws(()=>parseCSV('a,b\n"unfinished'),/quoted/);
  assert.throws(()=>pca([[1,1],[1,1]]),/variation/);
  assert.throws(()=>pca([[1,Infinity],[2,3]]),/finite/);
});
test('large inputs are sampled deterministically',()=>{
  const result=parseCSV('x,y\n'+Array.from({length:3000},(_,i)=>`${i},${i*2}`).join('\n'));
  assert.equal(result.data.length,2500);assert.equal(result.sampled,true);assert.equal(result.sourceRows,3000);
});
