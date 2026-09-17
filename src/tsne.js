import { prepareData } from './pca.js';

// Exact t-SNE: symmetric Gaussian affinities, Student-t kernel (one degree
// of freedom), early exaggeration, momentum and adaptive per-coordinate gains.
// Reference: van der Maaten & Hinton, JMLR 9 (2008), Algorithm 1.
export function affinities(data, perplexity) {
  const n = data.length;
  if (!(perplexity >= 1 && perplexity < n)) throw new Error('Perplexity must be at least 1 and smaller than the row count.');
  const conditional = new Float64Array(n*n), distances = new Float64Array(n);
  for (let i=0;i<n;i++) {
    let minimum=Infinity;
    for(let j=0;j<n;j++) {
      distances[j]=data[i].reduce((s,x,k)=>s+(x-data[j][k])**2,0);
      if(i!==j)minimum=Math.min(minimum,distances[j]);
    }
    let beta=1, low=0, high=Infinity;
    for(let search=0;search<60;search++) {
      let sum=0, weighted=0;
      for(let j=0;j<n;j++) {
        const distance=distances[j]-minimum;
        const probability=i===j?0:Math.exp(-distance*beta);
        conditional[i*n+j]=probability;sum+=probability;weighted+=probability*distance;
      }
      const entropy=Math.log(sum)+beta*weighted/sum;
      for(let j=0;j<n;j++)conditional[i*n+j]/=sum;
      const difference=entropy-Math.log(perplexity);
      if(Math.abs(difference)<1e-7)break;
      if(difference>0){low=beta;beta=Number.isFinite(high)?(beta+high)/2:beta*2;}
      else {high=beta;beta=(beta+low)/2;}
    }
  }
  const p=new Float64Array(n*n);
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)p[i*n+j]=p[j*n+i]=(conditional[i*n+j]+conditional[j*n+i])/(2*n);
  return p;
}

export function objective(points, p, exaggeration=1) {
  const n=points.length, weights=new Float64Array(n*n), gradient=points.map(()=>[0,0,0]);
  let sum=0, kl=0;
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++) {
    const w=1/(1+points[i].reduce((s,x,k)=>s+(x-points[j][k])**2,0));
    weights[i*n+j]=weights[j*n+i]=w;sum+=2*w;
  }
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++) {
    const probability=p[i*n+j], q=weights[i*n+j]/sum;
    if(probability>0)kl+=2*probability*Math.log(probability/Math.max(q,1e-300));
    const multiplier=4*(exaggeration*probability-q)*weights[i*n+j];
    for(let k=0;k<3;k++){const g=multiplier*(points[i][k]-points[j][k]);gradient[i][k]+=g;gradient[j][k]-=g;}
  }
  return {gradient,kl};
}

export function tsne(data, {standardize=true,perplexity=30,iterations=500,seed=42}={}, onProgress=()=>{}) {
  if(data.length>500)throw new Error('t-SNE supports at most 500 rows per run.');
  if(!Number.isInteger(iterations)||iterations<1||iterations>2000)throw new Error('Invalid iteration count.');
  const centered=prepareData(data,standardize),n=centered.length;
  if(!centered.some(row=>row.some(x=>Math.abs(x)>1e-12)))throw new Error('These columns have no variation.');
  // Common scaling changes no affinities and improves bandwidth conditioning.
  const rms=Math.sqrt(centered.reduce((s,r)=>s+r.reduce((a,x)=>a+x*x,0),0)/n)||1;
  const p=affinities(centered.map(r=>r.map(x=>x/rms)),perplexity);
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return (seed+1)/4294967297;};
  const points=Array.from({length:n},()=>Array.from({length:3},()=>1e-4*Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random())));
  const velocity=points.map(()=>[0,0,0]),gains=points.map(()=>[1,1,1]);
  for(let step=0;step<iterations;step++) {
    const {gradient}=objective(points,p,step<100?4:1);
    const mean=[0,0,0];
    for(let i=0;i<n;i++)for(let k=0;k<3;k++) {
      gains[i][k]=Math.sign(gradient[i][k])!==Math.sign(velocity[i][k])?gains[i][k]+.2:Math.max(.01,gains[i][k]*.8);
      velocity[i][k]=(step<100?.5:.8)*velocity[i][k]-100*gains[i][k]*gradient[i][k];
      points[i][k]+=velocity[i][k];mean[k]+=points[i][k]/n;
    }
    for(const point of points)for(let k=0;k<3;k++)point[k]-=mean[k];
    if((step+1)%25===0)onProgress({iteration:step+1,iterations});
  }
  const {kl}=objective(points,p);
  if(!Number.isFinite(kl)||points.some(p=>p.some(x=>!Number.isFinite(x))))throw new Error('t-SNE could not find a finite embedding. Try a different perplexity.');
  return {points,kl,iterations,perplexity};
}
