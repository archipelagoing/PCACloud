import { pca, parseCSV, sampleData } from './pca.js';
import { datasetRef, listCSVFiles, downloadCSV } from './kaggle.js';
import { setupLearning, updateLearning, selectLessonPoint } from './learn.js';
const $ = id => document.getElementById(id);
const canvas = $('sky'), ctx = canvas.getContext('2d', { alpha: false });
let dataset = sampleData(), points = [], width = 0, height = 0, yaw = -.22, pitch = -.12, zoom = 1, mode = 'cloud';
let dragging = false, previous = null, lastTime = 0, density = .65, softness = .5;
let projectionWorker = null, projectionRun = 0, displayedMethod = 'pca';
let currentPCA = null;
let learningState = { open: false }, lessonHits = [], savedCamera = null, pointerStart = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
$('rotate').checked = !reducedMotion;

// Pre-render softly illuminated vapor particles; depth ordering produces volume.
function sprite(shade) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const color = shade ? '170,193,207' : '255,255,248';
  const gradient = g.createRadialGradient(57, 48, 4, 64, 64, 60);
  gradient.addColorStop(0, `rgba(${color},.64)`); gradient.addColorStop(.35, `rgba(${color},.48)`);
  gradient.addColorStop(.65, `rgba(${color},.19)`); gradient.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gradient; g.fillRect(0, 0, 128, 128); return c;
}
const lightSprite = sprite(false), shadowSprite = sprite(true);
function analyze(candidate = dataset) {
  const result = pca(candidate.data, $('standardize').checked);
  projectionWorker?.terminate();projectionWorker=null;const run=++projectionRun;
  dataset = candidate;
  currentPCA = result;
  updateLearning(result, dataset, $('standardize').checked);
  const isTSNE=$('projection-method').value==='tsne';
  $('pca-options').hidden=isTSNE;$('pca-metrics').hidden=isTSNE;
  $('tsne-options').hidden=!isTSNE;$('tsne-metrics').hidden=!isTSNE;
  $('projection-status').textContent='';
  $('reconstruction-value').textContent=`${(result.reconstructionError*100).toFixed(2)}%`;
  $('dataset-info').textContent = `${dataset.data.length.toLocaleString()} rows · ${dataset.columns.length} numeric features`;
  $('total-variance').textContent = `${(result.variance.reduce((s,v) => s+v,0)*100).toFixed(1)}%`;
  result.variance.forEach((v,i) => { $(`pc-${i}`).textContent = `${(v*100).toFixed(1)}%`; $(`bar-${i}`).style.width = `${v*100}%`; });
  const notes = [];
  if (dataset.skipped) notes.push(`${dataset.skipped} incomplete or malformed rows skipped.`);
  if (dataset.sampled) notes.push(`Evenly sampled ${dataset.sourceRows.toLocaleString()} rows to 2,500 for analysis.`);
  if (dataset.columns.length === 2 && !isTSNE) notes.push('Two numeric features: PC3 is zero.');
  message(notes.join(' '));
  if(!isTSNE){setProjection(result.points,'pca');return;}
  const count=Math.min(dataset.data.length,500);
  const rows=Array.from({length:count},(_,i)=>dataset.data[Math.floor(i*dataset.data.length/count)]);
  const perplexity=Math.max(1,Math.min(50,count-1,Number($('perplexity').value)||30));
  $('perplexity').max=Math.min(50,count-1);$('perplexity').value=perplexity;
  points=[];displayedMethod='tsne';document.querySelector('.coordinates').textContent='t-SNE 1 / 2 / 3';
  $('tsne-kl').textContent='—';
  const detail=`${count} of ${dataset.data.length} rows · perplexity ${perplexity}`;
  $('projection-status').textContent=`Computing t-SNE · ${detail}…`;
  const fail=error=>{
    if(run!==projectionRun)return;
    $('projection-method').value='pca';analyze();
    $('projection-status').textContent=`t-SNE failed: ${error}. Showing PCA.`;
  };
  try {
    projectionWorker=new Worker(new URL('./projection-worker.js',import.meta.url),{type:'module'});
    projectionWorker.onmessage=({data})=>{
      if(run!==projectionRun)return;
      if(data.type==='progress')$('projection-status').textContent=`t-SNE ${data.iteration}/${data.iterations} · ${detail}`;
      else if(data.type==='error')fail(data.message);
      else if(data.type==='result'){
        setProjection(data.result.points,'tsne');$('tsne-kl').textContent=data.result.kl.toFixed(4);
        $('projection-status').textContent=`Finished 500 iterations · ${detail}.`;
        projectionWorker.terminate();projectionWorker=null;
      }
    };
    projectionWorker.onerror=()=>fail('background worker unavailable');
    projectionWorker.postMessage({rows,options:{standardize:$('standardize').checked,perplexity}});
  }catch(error){fail(error.message);}
}
function setProjection(projected,method){
  const extent=Math.max(...projected.map(p=>Math.hypot(...p)))||1;
  points=projected.map((p,i)=>({x:p[0]/extent,y:p[1]/extent,z:p[2]/extent,size:.75+((i*137)%100)/200}));
  displayedMethod=method;document.querySelector('.coordinates').textContent=method==='pca'?'PC1 / PC2 / PC3':'t-SNE 1 / 2 / 3';
}
function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
function resize() {
  width = innerWidth; height = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width*ratio; canvas.height = height*ratio; ctx.setTransform(ratio,0,0,ratio,0,0);
}
function background() {
  const sky = ctx.createLinearGradient(0,0,width*.15,height);
  sky.addColorStop(0,'#4e83a8'); sky.addColorStop(.45,'#8ab4cf'); sky.addColorStop(1,'#d3e5eb');
  ctx.fillStyle = sky; ctx.fillRect(0,0,width,height);
  const sun = ctx.createRadialGradient(width*.12,height*.06,0,width*.12,height*.06,width*.8);
  sun.addColorStop(0,'#fff7d91c'); sun.addColorStop(1,'#ffffff00');ctx.fillStyle=sun;ctx.fillRect(0,0,width,height);
  // Distant cirrus, kept subordinate to the actual data cloud.
  ctx.globalAlpha=.07;
  for(let i=0;i<17;i++) { const x=((i*317)%1100)/1100*width,y=height*(.77+Math.sin(i*2)*.07); ctx.drawImage(lightSprite,x-160,y-18,320,36); }
  ctx.globalAlpha=1;
}
function render(time) {
  const dt = Math.min((time-lastTime)/1000 || 0,.05);lastTime=time;
  if ($('rotate').checked && !learningState.open && !dragging && !document.hidden) yaw += dt*.035;
  background();
  const mobile = width<=640;
  const drawerWidth = learningState.open ? Math.min(440, width * .48) + 42 : 340;
  const sceneWidth = width - drawerWidth;
  const centerX=mobile?width*.5:sceneWidth*.5, centerY=mobile?(learningState.open?height*.24:405):height*.57;
  const scale=(mobile?(learningState.open?Math.min(width*.42,height*.19):width*.54):Math.min(sceneWidth*.44,height*.42))*zoom;
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch);
  const toScreen = p => {
    const x=p.x*cy+p.z*sy,z=-p.x*sy+p.z*cy,y=p.y*cp-z*sp,depth=p.y*sp+z*cp;
    const perspective=3/(3-depth);
    return {...p,x:centerX+x*scale*perspective,y:centerY-y*scale*perspective,z:depth,size:(p.size || 1)*perspective,light:y};
  };
  const walkthrough = learningState.open && learningState.topic === 'walkthrough';
  const activePoints = walkthrough ? learningState.geometry.points.map(([x,y,z],index)=>({x,y,z,index,size:2})) : points;
  const projected=activePoints.map((p,index)=>toScreen({...p,index})).sort((a,b)=>a.z-b.z);
  lessonHits = walkthrough ? projected : [];
  if(mode==='cloud' && !learningState.open) {
    const radius=scale*(.07+softness*.15)*Math.pow(1600/Math.max(points.length,30),.16);
    for(const p of projected) {
      const r=radius*p.size;
      ctx.globalAlpha=(.08+density*.55)*Math.min(1.6,Math.sqrt(1600/points.length));
      ctx.drawImage(shadowSprite,p.x-r,p.y-r*.75,r*2,r*1.7);
      ctx.globalAlpha=(.06+density*.43)*(0.68+Math.max(-.4,Math.min(.7,p.light))*1.2);
      ctx.drawImage(lightSprite,p.x-r*1.05,p.y-r,r*2,r*1.8);
    }
  } else {
    for(const p of projected) {
      const selected = walkthrough && p.index === learningState.selected;
      ctx.globalAlpha=walkthrough?1:.65;
      ctx.fillStyle=selected?'#ffe4a0':'#f8fcff';
      ctx.beginPath();ctx.arc(p.x,p.y,selected?7:Math.max(2,2*p.size*zoom),0,Math.PI*2);ctx.fill();
      if(walkthrough){ctx.font='600 13px sans-serif';ctx.fillText('ABCD'[p.index],p.x+11,p.y-9);}
    }
    ctx.globalAlpha=.6;ctx.strokeStyle='#ffffff';ctx.lineWidth=1;ctx.font='9px sans-serif';
    if(!walkthrough) [[1,0,0,'PC1'],[0,1,0,'PC2'],[0,0,1,'PC3']].forEach(([a,b,c,label],index)=>{
      if(displayedMethod==='tsne')label=label.replace('PC','t-SNE ');
      const highlight=learningState.open && (learningState.topic==='variance'||index===learningState.component);
      ctx.globalAlpha=highlight?1:.45;ctx.strokeStyle=highlight?'#ffe4a0':'#fff';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=highlight?3:1;
      const end=toScreen({x:a*.9,y:b*.9,z:c*.9});
      ctx.beginPath();ctx.moveTo(centerX,centerY);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.fillText(label,end.x+5,end.y-5);
    });
  }
  if(walkthrough) {
    const {geometry,lesson,step,selected}=learningState;
    const screen = row => toScreen({x:row[0],y:row[1],z:row[2]||0});
    const line = (a,b,color,dashed=false,width=1.5) => {
      ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dashed?[5,5]:[]);
      const start=screen(a),end=screen(b);ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);
      return [start,end];
    };
    const outline = (row,label) => {
      const p=screen(row);ctx.strokeStyle='#ffe4a0';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.stroke();
      if(label){ctx.fillStyle='#fff';ctx.font='11px sans-serif';ctx.fillText(label,p.x+9,p.y+15);}
    };
    // These are feature-space axes, not the PCA score axes of the normal cloud.
    [[.9,0,0,'x₁'],[0,.9,0,'x₂']].forEach(([x,y,z,label])=>{
      const [,end]=line([0,0,0],[x,y,z],step<2?'#ffe4a0':'#ffffff60');
      ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(label,end.x+6,end.y-5);
    });
    if(step===0) {
      geometry.original.forEach((row,i)=>{
        const [start,end]=line(row,geometry.points[i],'#ffe4a0',true);
        const angle=Math.atan2(end.y-start.y,end.x-start.x);
        ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-8*Math.cos(angle-.4),end.y-8*Math.sin(angle-.4));ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-8*Math.cos(angle+.4),end.y-8*Math.sin(angle+.4));ctx.stroke();
        outline(row,`${'ABCD'[i]} original`);
      });
      outline(geometry.mean,'mean');outline([0,0,0],'zero');
    }
    if(step>=2) {
      const [vx,vy]=lesson.direction;
      [[vx,vy,'PC1'],[-vy,vx,'PC2']].forEach(([x,y,label],i)=>{
        const [,end]=line([-.85*x,-.85*y,0],[.85*x,.85*y,0],i===0?'#ffe4a0':'#ffffff70',false,i===0?3:1.5);
        ctx.fillStyle=i===0?'#ffe4a0':'#fff';ctx.font='600 13px sans-serif';ctx.fillText(label,end.x+8,end.y-5);
      });
    }
    if(step>=4) {
      const indices=step===5?[0,1,2,3]:[selected];
      indices.forEach(i=>{line(geometry.points[i],geometry.reconstructed[i],i===selected?'#ffe4a0':'#ffffffaa',true);outline(geometry.reconstructed[i],`${'ABCD'[i]} on PC1`);});
    }
    ctx.fillStyle='#f8fcff';ctx.font='12px sans-serif';ctx.globalAlpha=1;
    const caption=mobile?`${step + 1}. ${['Center','Covariance','Directions','Variance','Project','Reconstruct'][step]} · drag to orbit`:`${['Center the measurements','Measure covariance','Find component directions','Compare retained variance','Project onto PC1','Reconstruct from PC1'][step]} · drag to orbit`;
    ctx.fillText(caption,24,mobile?height*.5-62:height-76);
  }
  ctx.globalAlpha=1; requestAnimationFrame(render);
}
function setZoom(value) {zoom=Math.max(.4,Math.min(2.5,value));$('zoom-value').textContent=`${Math.round(zoom*100)}%`;}
canvas.addEventListener('pointerdown',e=>{dragging=true;previous=[e.clientX,e.clientY];pointerStart=previous;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;yaw+=(e.clientX-previous[0])*.006;pitch=Math.max(-1.3,Math.min(1.3,pitch+(e.clientY-previous[1])*.006));previous=[e.clientX,e.clientY];});
for(const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,()=>{dragging=false;});
canvas.addEventListener('pointerup',e=>{
  if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>6)return;
  const point=lessonHits.filter(p=>Math.hypot(e.clientX-p.x,e.clientY-p.y)<18).sort((a,b)=>Math.hypot(e.clientX-a.x,e.clientY-a.y)-Math.hypot(e.clientX-b.x,e.clientY-b.y))[0];
  if(point)selectLessonPoint(point.index);
});
canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.001));},{passive:false});
$('zoom-in').onclick=()=>setZoom(zoom+.1);$('zoom-out').onclick=()=>setZoom(zoom-.1);
$('reset').onclick=()=>{yaw=-.22;pitch=-.12;setZoom(1);};
for(const name of ['cloud','point']) $(name+'-mode').onclick=()=>{mode=name==='cloud'?'cloud':'points';for(const n of ['cloud','point']) {$(n+'-mode').classList.toggle('active',n===name);$(n+'-mode').setAttribute('aria-pressed',String(n===name));}};
for(const name of ['density','softness']) {
  const input=$(name);
  input.oninput=()=>{const v=Number(input.value);$(name+'-value').value=v+'%';input.style.background=`linear-gradient(to right,#809e9c ${(v-10)/90*100}%,#d9e2e3 ${(v-10)/90*100}%)`;if(name==='density')density=v/100;else softness=v/100;};input.oninput();
}
$('standardize').onchange=()=>{try {analyze();}catch(e){$('standardize').checked=!$('standardize').checked;message(e.message,true);}};
$('projection-method').onchange=()=>analyze();
$('pca-objective').onchange=()=>{
  const reconstruction=$('pca-objective').value==='reconstruction';
  $('reconstruction-metric').hidden=!reconstruction;
  $('pca-metrics').classList.toggle('emphasize-reconstruction',reconstruction);
};
$('perplexity').onchange=()=>analyze();$('rerun-tsne').onclick=()=>analyze();
async function importFile(file) {
  if(!file)return;
  if(file.size>5*1024*1024){message('Please choose a CSV smaller than 5 MB.',true);return;}
  try {const candidate=parseCSV(await file.text());analyze(candidate);$('dataset-name').textContent=file.name;}catch(e){message(e.message,true);}
  $('file').value='';
}
$('file').onchange=e=>importFile(e.target.files[0]);
$('dropzone').tabIndex=0;
$('dropzone').setAttribute('role','button');
$('dropzone').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}});
$('dropzone').addEventListener('dragover',e=>{e.preventDefault();$('dropzone').classList.add('dragover');});
$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('dragover'));
$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('dragover');importFile(e.dataTransfer.files[0]);});
$('sample').onclick=()=>{analyze(sampleData());$('dataset-name').textContent='Atmospheric observations';};
$('export').onclick=()=>{canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pca-cloud.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});};
$('about').onclick=()=>$('about-dialog').showModal();$('close-about').onclick=()=>$('about-dialog').close();
$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
let kaggleRef = '', kaggleRequest = 0, dataRequest = 0;
function kaggleStatus(text) { $('kaggle-status').textContent = text; }
function kaggleBusy(busy) { for (const id of ['kaggle-find','kaggle-demo','kaggle-load']) $(id).disabled = busy; }
$('kaggle-url').addEventListener('input',()=>{kaggleRequest++;kaggleRef='';$('kaggle-files').hidden=true;kaggleBusy(false);});
$('kaggle-form').onsubmit=async e=>{
  e.preventDefault();const request=++kaggleRequest;
  $('kaggle-files').hidden=true;kaggleBusy(true);kaggleStatus('Finding CSV files…');
  try {
    const ref=datasetRef($('kaggle-url').value),files=await listCSVFiles(ref);
    if(request!==kaggleRequest)return;
    if(!files.length)throw new Error('No CSV files under 5 MB found. Download a smaller CSV and upload it here.');
    kaggleRef=ref;$('kaggle-file').replaceChildren(...files.map(name=>new Option(name,name)));
    $('kaggle-files').hidden=false;kaggleStatus('Choose a CSV to turn into a cloud.');
  } catch(error) {if(request===kaggleRequest)kaggleStatus(error.message);}
  finally {if(request===kaggleRequest)kaggleBusy(false);}
};
async function loadKaggle(ref, filename) {
  const request=++kaggleRequest, selection=++dataRequest;kaggleBusy(true);kaggleStatus('Downloading from Kaggle…');
  try {
    const text=await downloadCSV(ref,filename);
    if(request!==kaggleRequest||selection!==dataRequest)return;
    analyze(parseCSV(text));$('dataset-name').textContent=filename;
    $('kaggle-source').href=`https://www.kaggle.com/datasets/${ref}`;$('kaggle-source').hidden=false;
    kaggleStatus('Loaded from Kaggle. PCA runs locally in your browser.');
  } catch(error) {if(request===kaggleRequest)kaggleStatus(error.message);}
  finally {if(request===kaggleRequest)kaggleBusy(false);}
}
$('kaggle-load').onclick=()=>loadKaggle(kaggleRef,$('kaggle-file').value);
$('kaggle-demo').onclick=()=>{$('kaggle-url').value='https://www.kaggle.com/datasets/uciml/iris';$('kaggle-files').hidden=true;loadKaggle('uciml/iris','Iris.csv');};
for(const id of ['sample','file','dropzone']) $(id).addEventListener(id==='file'?'change':id==='dropzone'?'drop':'click',()=>{dataRequest++;$('kaggle-source').hidden=true;},true);
setupLearning(state => {
  const wasWalkthrough=learningState.open&&learningState.topic==='walkthrough';
  const isWalkthrough=state.open&&state.topic==='walkthrough';
  if(isWalkthrough&&!wasWalkthrough){savedCamera={yaw,pitch,zoom};yaw=0;pitch=0;setZoom(1);}
  if(wasWalkthrough&&!isWalkthrough&&savedCamera){({yaw,pitch}=savedCamera);setZoom(savedCamera.zoom);savedCamera=null;}
  learningState=state;
  document.querySelector('.coordinates').textContent=isWalkthrough?'x₁ / x₂ · FOUR-POINT LESSON':displayedMethod==='pca'?'PC1 / PC2 / PC3':'t-SNE 1 / 2 / 3';
  canvas.setAttribute('aria-label',isWalkthrough?'Interactive four-point PCA walkthrough. Drag to rotate, scroll to zoom, or click a labeled point to inspect it.':`Interactive three-dimensional ${displayedMethod==='pca'?'PCA':'t-SNE'} cloud. Drag to rotate and scroll to zoom.`);
  if(state.open&&$('projection-method').value==='tsne'){$('projection-method').value='pca';analyze();}
});
$('learn').addEventListener('click', () => updateLearning(currentPCA, dataset, $('standardize').checked));
window.addEventListener('resize',resize);analyze();resize();requestAnimationFrame(render);
