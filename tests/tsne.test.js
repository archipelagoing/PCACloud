import {test} from 'node:test';
import assert from 'node:assert/strict';
import {affinities,objective,tsne} from '../src/tsne.js';
import {pca,prepareData} from '../src/pca.js';

test('PCA residual energy matches explicit reconstruction error',()=>{
  const rows=Array.from({length:30},(_,i)=>[Math.sin(i),Math.cos(i),i%5,i%7]);
  for(const standardize of [true,false]){
    const result=pca(rows,standardize),x=prepareData(rows,standardize);
    let residual=0,total=0;
    x.forEach((row,i)=>row.forEach((value,j)=>{
      const reconstructed=result.components.reduce((s,axis,k)=>s+result.points[i][k]*axis[j],0);
      residual+=(value-reconstructed)**2;total+=value**2;
    }));
    assert.ok(Math.abs(residual/total-result.reconstructionError)<1e-10);
  }
});
test('t-SNE affinities are symmetric normalized and exclude self probability',()=>{
  const p=affinities([[0],[0],[1],[2]],2);
  assert.ok(Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-10);
  for(let i=0;i<4;i++)for(let j=0;j<4;j++){
    assert.equal(p[i*4+j],p[j*4+i]);assert.ok(Number.isFinite(p[i*4+j]));if(i===j)assert.equal(p[i*4+j],0);
  }
});
test('t-SNE analytical gradient agrees with numerical KL derivative',()=>{
  const p=affinities([[0],[1],[3],[5]],2),points=[[.1,.2,.3],[1,.3,-.2],[.5,2,1],[-1,.2,.1]];
  const {gradient}=objective(points,p),epsilon=1e-5;
  for(let i=0;i<4;i++)for(let k=0;k<3;k++){
    points[i][k]+=epsilon;const plus=objective(points,p).kl;
    points[i][k]-=2*epsilon;const minus=objective(points,p).kl;
    points[i][k]+=epsilon;
    assert.ok(Math.abs((plus-minus)/(2*epsilon)-gradient[i][k])<1e-7);
  }
});
test('t-SNE lowers KL and returns reproducible centered finite 3D coordinates',()=>{
  const rows=Array.from({length:40},(_,i)=>[i<20?-5:5,Math.sin(i),Math.cos(i)]);
  const options={perplexity:8,iterations:400};
  const result=tsne(rows,options),repeat=tsne(rows,options);
  const p=affinities(prepareData(rows),8);
  assert.ok(result.kl<objective(rows.map(()=>[0,0,0]),p).kl);
  assert.deepEqual(result,repeat);assert.ok(result.kl<.5,`KL = ${result.kl}`);
  for(let k=0;k<3;k++)assert.ok(Math.abs(result.points.reduce((s,p)=>s+p[k],0))<1e-8);
  for(const p of result.points){assert.equal(p.length,3);assert.ok(p.every(Number.isFinite));}
});
test('t-SNE rejects invalid perplexity and constant input',()=>{
  assert.throws(()=>tsne([[0],[1]],{perplexity:2}),/Perplexity/);
  assert.throws(()=>tsne([[1,1],[1,1]],{perplexity:1}),/variation/);
  const result=tsne([[0],[1]],{perplexity:1,iterations:125});assert.ok(Number.isFinite(result.kl));
});
