import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateContribution,publicQuestion,validateCommunity} from '../community-core.js';
import {COMMUNITY_DATA} from '../community-data.js';
import {QUESTIONS,COMPANIES} from '../data.js';

const [file,...args]=process.argv.slice(2);
const option=name=>{const i=args.indexOf(name);return i<0?'':args[i+1]||'';};
try{
  if(!file||file.startsWith('-'))throw new Error('用法：node scripts/review-contribution.mjs 投稿.json --status accepted|needs-info|rejected --reviewer 署名 --note 审阅说明 [--apply]');
  const input=await readFile(file,'utf8');
  if(Buffer.byteLength(input)>256*1024)throw new Error('投稿超过 256 KB。');
  const p=validateContribution(JSON.parse(input));
  const status=option('--status'),reviewer=option('--reviewer'),note=option('--note');
  if(!['accepted','needs-info','rejected'].includes(status)||!reviewer.trim()||!note.trim())throw new Error('必须指定审阅状态、审阅者和可公开的审阅说明。');
  const data=validateCommunity(COMMUNITY_DATA);
  const career=JSON.parse(await readFile(new URL('../career-data.json',import.meta.url),'utf8'));
  if(p.target.id){
    const known=p.target.type==='question'?[...QUESTIONS,...data.questions]:p.target.type==='companies'?COMPANIES:p.target.type==='career'?career.records:[];
    if(!known.some(item=>item.id===p.target.id))throw new Error('关联条目不存在，请核对后再发布审阅记录。');
  }
  let target=p.target;
  if(status==='accepted'&&p.type==='question'){
    const q=publicQuestion(p);
    if(!data.questions.some(existing=>existing.id===q.id))data.questions.push(q);
    target={type:'question',id:q.id};
  }
  const review={id:p.id,status,title:p.content.title,target,reviewer,note,reviewedAt:new Date().toISOString(),sourceUrl:p.content.sourceUrl};
  if(data.reviews.some(r=>r.id===review.id&&r.status===status&&r.reviewer===reviewer&&r.note===note))throw new Error('相同审阅已记录，未重复写入。');
  data.reviews.push(review);const output=validateCommunity(data);
  console.log(JSON.stringify({mode:args.includes('--apply')?'apply':'preview',review,communityQuestions:output.questions.length},null,2));
  if(args.includes('--apply')){
    const dest=fileURLToPath(new URL('../community-data.js',import.meta.url));
    const temporary=dest+'.tmp';
    await writeFile(temporary,'// Maintainer-reviewed public content. Raw submissions stay outside the site.\nexport const COMMUNITY_DATA = '+JSON.stringify(output,null,2)+';\n');
    await rename(temporary,dest);
    console.log('审阅记录已写入 community-data.js；请运行 npm test 并通过 PR 审核发布。');
  }else console.log('预览完成，未改动文件。确认公开说明后添加 --apply。');
}catch(error){console.error(error.message);process.exitCode=1;}
