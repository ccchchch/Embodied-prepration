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
console.log('PASS: real Chinese/English screenshot OCR, recognized requirement priorities, same-origin assets, upload limits, cancellation, late cleanup and failure timeout.');
