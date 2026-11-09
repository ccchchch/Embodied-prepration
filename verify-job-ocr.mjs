import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createWorker} from 'tesseract.js';
import {prepareOCR} from './scripts/prepare-ocr.mjs';
import {recognizeImage,readScreenshot,validateScreenshot,ocrPaths} from './job-ocr.js';
import {extractRequirements} from './job-match-core.js';

const assets=await prepareOCR();
for(const file of assets)await access(new URL('./vendor/ocr/'+file,import.meta.url));
for(const name of ['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-relaxedsimd-lstm.wasm.js'])assert.ok(assets.includes('core/'+name));
const paths=ocrPaths(new URL('https://example.test/project/vendor/ocr/'));
for(const key of ['workerPath','corePath','langPath'])assert.ok(paths[key].startsWith('https://example.test/project/'),'All recognition assets must respect a deployed subdirectory and stay same-origin');
assert.throws(()=>validateScreenshot({type:'image/svg+xml',size:100}));
assert.throws(()=>validateScreenshot({type:'image/png',size:9*1024*1024}));
validateScreenshot({type:'image/webp',size:100});
const originalBitmap=globalThis.createImageBitmap;
globalThis.createImageBitmap=undefined;
await assert.rejects(readScreenshot({type:'image/png',size:100}),/当前浏览器无法读取/);
globalThis.createImageBitmap=async()=>{throw new Error('Invalid image data');};
await assert.rejects(readScreenshot({type:'image/png',size:100}),/图片无法读取/);
globalThis.createImageBitmap=originalBitmap;
const fixture=JSON.parse(await readFile(new URL('./fixtures/job-screenshot.json',import.meta.url),'utf8'));
// Exercise the exact lazy browser import. The distributed ESM bundle exports only a default object,
// unlike the Node entry point used by the real-engine test below.
const originalSelf=Object.getOwnPropertyDescriptor(globalThis,'self');
globalThis.self=globalThis;
const browserModule=await import('./vendor/ocr/tesseract.esm.min.js');
const browserCreateWorker=browserModule.default.createWorker;
assert.equal(typeof browserCreateWorker,'function');
let browserOptions,browserTerminated=false;
browserModule.default.createWorker=async(languages,oem,options)=>{
  assert.deepEqual(languages,['eng','chi_sim']);assert.equal(oem,1);browserOptions=options;
  return {
    setParameters:async parameters=>assert.equal(parameters.tessedit_pageseg_mode,'6'),
    recognize:async image=>{assert.equal(image,'browser-entry-fixture');return {data:{text:fixture.text,confidence:95}};},
    terminate:async()=>{browserTerminated=true;}
  };
};
try{
  const browserResult=await recognizeImage('browser-entry-fixture',{timeout:1000});
  assert.equal(browserResult.text,fixture.text);assert.ok(browserTerminated);
  assert.deepEqual(Object.fromEntries(Object.keys(ocrPaths()).map(key=>[key,browserOptions[key]])),ocrPaths());
  browserModule.default.createWorker=undefined;
  await assert.rejects(recognizeImage('browser-entry-fixture',{timeout:1000}),/截图识别工具暂未加载成功/);
}finally{
  browserModule.default.createWorker=browserCreateWorker;
  if(originalSelf)Object.defineProperty(globalThis,'self',originalSelf);else delete globalThis.self;
}
const result=await recognizeImage(Buffer.from(fixture.imageBase64,'base64'),{
  workerFactory:createWorker,workerOptions:{workerPath:fileURLToPath(new URL('./node_modules/tesseract.js/src/worker-script/node/index.js',import.meta.url)),langPath:fileURLToPath(new URL('./vendor/ocr/lang/',import.meta.url)),cacheMethod:'none'},timeout:45000
});
const skills=extractRequirements(result.text).skills;
for(const id of fixture.expectedSkills)assert.ok(skills.some(s=>s.id===id),'Actual screenshot OCR lost required skill: '+id);
assert.equal(skills.find(s=>s.id==='ros').priority,'preferred');
// Cancelling before worker initialization completes must release that late worker and never return text.
let resolveFactory,terminated=false;
const signal=new AbortController();
const running=recognizeImage('fixture',{signal:signal.signal,workerFactory:()=>new Promise(resolve=>{resolveFactory=resolve;}),timeout:1000});
signal.abort();await assert.rejects(running,error=>error.name==='AbortError');
resolveFactory({terminate:async()=>{terminated=true;}});await new Promise(resolve=>setTimeout(resolve,10));assert.ok(terminated);
// Worker load failures and timeouts must reject instead of leaving the UI waiting indefinitely.
await assert.rejects(recognizeImage('fixture',{workerFactory:async()=>{throw new Error('load failed');},timeout:100}),/load failed/);
await assert.rejects(recognizeImage('fixture',{workerFactory:()=>new Promise(()=>{}),timeout:20}),/识别用时过长/);
console.log('PASS: distributed browser ESM loading, real Chinese/English screenshot OCR, requirement priorities, same-origin assets, upload limits, cancellation, late cleanup and failure timeout.');
