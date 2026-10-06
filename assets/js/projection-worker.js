import { tsne } from './tsne.js';
self.onmessage=({data})=>{
  try {
    const result=tsne(data.rows,data.options,progress=>self.postMessage({type:'progress',...progress}));
    self.postMessage({type:'result',result});
  }catch(error){self.postMessage({type:'error',message:error.message});}
};
