import {mkdir,copyFile,writeFile,rm} from 'node:fs/promises';
import {prepareOCR} from './prepare-ocr.mjs';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
// Explicit list prevents private screenshots, personal backups and raw research from shipping.
const files=['index.html','styles.css','career.css','community.css','preparation.css','job-match.css','app.js','core.js','preparation-core.js','preparation.js','job-match-core.js','job-match.js','job-candidates.js','job-ocr.js','data.js','pretraining.js','dexmal-vol2.js','career.js','career-data.json','routes.js','career-practice.js','community-core.js','community.js','community-data.js','community-config.js','CONTRIBUTING.md','THIRD_PARTY_NOTICES.md'];
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const file of files)await copyFile(new URL(file,root),new URL(file,dist));
await writeFile(new URL('.nojekyll',dist),'');
const ocrFiles=await prepareOCR(new URL('vendor/ocr/',dist));
console.log(`Built ${files.length} public files and ${ocrFiles.length} OCR assets in dist/; private source images and personal data excluded.`);
