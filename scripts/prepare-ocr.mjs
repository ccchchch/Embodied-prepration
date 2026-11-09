import {mkdir,copyFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);

export async function prepareOCR(target=new URL('../vendor/ocr/',import.meta.url)) {
  await mkdir(target,{recursive:true});await mkdir(new URL('core/',target),{recursive:true});await mkdir(new URL('lang/',target),{recursive:true});
  const files=[
    ['tesseract.js/dist/tesseract.esm.min.js','tesseract.esm.min.js'],
    ['tesseract.js/dist/worker.min.js','worker.min.js'],
    ['tesseract.js/dist/worker.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'],
    ['tesseract.js/dist/tesseract.min.js.LICENSE.txt','tesseract.min.js.LICENSE.txt'],
    ['tesseract.js/LICENSE.md','TESSERACT-LICENSE.txt'],
    ['tesseract.js-core/LICENSE','CORE-LICENSE.txt'],
    ['@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz','lang/chi_sim.traineddata.gz'],
    ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','lang/eng.traineddata.gz']
  ];
  // Include the regular, SIMD and relaxed-SIMD builds. The engine selects a compatible build at runtime.
  for(const name of await readdir(new URL('node_modules/tesseract.js-core/',root))){
    if(/^tesseract-core(?:-[a-z-]+)?\.wasm(?:\.js)?$/.test(name))files.push(['tesseract.js-core/'+name,'core/'+name]);
  }
  for(const [source,destination] of files)await copyFile(new URL('node_modules/'+source,root),new URL(destination,target));
  await copyFile(new URL('THIRD_PARTY_NOTICES.md',root),new URL('THIRD_PARTY_NOTICES.md',target));
  await writeFile(new URL('manifest.json',target),JSON.stringify({tesseract:'7.0.0',languages:['chi_sim','eng'],files:files.map(([,name])=>name)},null,2)+'\n');
  return files.map(([,name])=>name);
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(`Prepared ${(await prepareOCR()).length} local OCR assets.`);
