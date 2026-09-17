import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datasetRef, listCSVFiles, downloadCSV, MAX_BYTES } from '../src/kaggle.js';

test('dataset references accept Kaggle links and reject other hosts or paths',()=>{
  for(const value of ['uciml/iris','https://www.kaggle.com/datasets/uciml/iris?select=Iris.csv','kaggle.com/datasets/uciml/iris/']) assert.equal(datasetRef(value),'uciml/iris');
  for(const value of ['https://evil.example/datasets/uciml/iris','https://kaggle.com.evil.example/datasets/uciml/iris','https://www.kaggle.com/competitions/iris','../iris','uciml/iris/file']) assert.throws(()=>datasetRef(value));
});
test('CSV listing filters large files, follows pages, and excludes non-CSV files',async()=>{
  let calls=0;
  const files=await listCSVFiles('uciml/iris',async(url,options)=>{
    assert.equal(options.credentials,'omit');
    calls++;
    if(calls===1)return Response.json({datasetFiles:[{name:'Iris.csv',totalBytes:100},{name:'database.sqlite',totalBytes:100},{name:'big.csv',totalBytes:MAX_BYTES+1}],nextPageToken:'next page'});
    assert.ok(url.endsWith('?pageToken=next%20page'));
    return Response.json({datasetFiles:[{name:'second.csv',totalBytes:200}]});
  });
  assert.deepEqual(files,['Iris.csv','second.csv']);
});
test('downloads encode filenames and omit credentials',async()=>{
  const text=await downloadCSV('uciml/iris','folder/a b.csv',async(url,options)=>{
    assert.ok(url.endsWith('/uciml/iris/folder/a%20b.csv'));assert.equal(options.credentials,'omit');return new Response('x,y\n1,2');
  });
  assert.equal(text,'x,y\n1,2');
  await assert.rejects(()=>downloadCSV('uciml/iris','../secret.csv'),/Choose/);
});
test('oversized responses, archives, sign-in pages and HTTP errors are handled',async()=>{
  for(const [response,pattern] of [[new Response('small',{headers:{'content-length':String(MAX_BYTES+1)}}),/too large/],[new Response(new Uint8Array(MAX_BYTES+1)),/too large/],[new Response('PK archive'),/ZIP/],[new Response('<html>Sign in</html>'),/sign-in/],[new Response('',{status:403}),/403/]]) {
    await assert.rejects(()=>downloadCSV('uciml/iris','Iris.csv',async()=>response),pattern);
  }
  await assert.rejects(()=>downloadCSV('uciml/iris','Iris.csv',async()=>{throw new TypeError('Failed to fetch');}),/could not be reached/);
});
