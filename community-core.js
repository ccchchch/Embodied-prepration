import {safeURL,TRACKS,validateCustom} from './core.js';
import {stableID} from './career-practice.js';

export const CONTRIBUTION_KEY='embodied-prep-contributions-v1';
export const CONTRIBUTION_TYPES={question:'补充题目',correction:'内容纠错',source:'补充依据',job:'反馈岗位状态'};
const text=(value,max=12000)=>typeof value==='string'?value.trim().slice(0,max):'';
export function validateContribution(raw) {
  if(raw?.schemaVersion!==1||!/^contrib-[a-zA-Z0-9-]{1,80}$/.test(raw.id||'')||!Object.hasOwn(CONTRIBUTION_TYPES,raw.type)) throw new Error('不是有效的社区投稿文件。');
  const c=raw.content||{}, t=raw.target||{};
  if(!text(c.title,300)||!text(c.body)||raw.consent!==true) throw new Error('请填写标题和内容，并确认可公开分享。');
  if(c.sourceUrl&&!safeURL(c.sourceUrl)) throw new Error('依据链接需要是 http 或 https 地址。');
  if(!['general','question','career','companies'].includes(t.type)||!/^[-\w]{0,160}$/.test(t.id||'')) throw new Error('投稿关联条目不正确。');
  if(!Number.isFinite(Date.parse(raw.createdAt))) throw new Error('投稿时间不正确。');
  // Allowlist only public contribution fields: never serialize drafts, notes or learning records.
  return {schemaVersion:1,id:raw.id,type:raw.type,createdAt:raw.createdAt,status:'draft',
    target:{type:t.type,id:t.id||'',title:text(t.title,1200)},
    content:{title:text(c.title,300),body:text(c.body),sourceUrl:safeURL(c.sourceUrl),
      company:text(c.company,80),role:text(c.role,100),track:TRACKS.includes(c.track)?c.track:'基础与工程',
      experienceDate:text(c.experienceDate,100)},
    displayName:text(raw.displayName,80),consent:true};
}
export function repositoryURL(value) {
  try {const url=new URL(value); return url.protocol==='https:'&&url.hostname==='github.com'&&/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname)?url.origin+url.pathname.replace(/\/$/,''):'';} catch {return '';}
}
export function contributionMarkdown(value) {
  const p=validateContribution(value);
  return `### ${CONTRIBUTION_TYPES[p.type]}：${p.content.title}\n\n${p.content.body}\n\n依据：${p.content.sourceUrl||'尚未提供'}\n\n关联：${p.target.title||'新内容'}（${p.target.id||'无'}）\n\n署名：${p.displayName||'不署名'}\n\n已确认以上内容可公开分享。\n\n<details><summary>供维护者导入的投稿数据</summary>\n\n\`\`\`json\n${JSON.stringify(p,null,2)}\n\`\`\`\n</details>`;
}
export function issueURL(repository,p) {
  const base=repositoryURL(repository); if(!base)return '';
  const query=new URLSearchParams({title:`[${CONTRIBUTION_TYPES[p.type]}] ${p.content.title}`,body:contributionMarkdown(p)});
  const url=base+'/issues/new?'+query;
  return url.length<=7500?url:base+'/issues/new?template=community-contribution.yml';
}
export function publicQuestion(p) {
  p=validateContribution(p);
  if(p.type!=='question') throw new Error('只有题目投稿可发布为新题。');
  const q=validateCustom({id:'user-'+stableID(p.id),title:p.content.title,answer:'',kind:'pending',difficulty:'进阶',
    track:p.content.track,companies:[p.content.company||'公司未披露'],roles:[p.content.role||'岗位未披露'],tags:['社区贡献'],
    caveat:'社区整理的题目，参考答案待补充。',steps:[],pitfalls:[],followups:[],refs:[],
    source:{kind:'recollection',label:'社区投稿 · '+(p.displayName||'不署名'),url:p.content.sourceUrl,
      note:p.content.body+'\n经历时间：'+(p.content.experienceDate||'未披露')+'。公司归属为贡献者自述，未经公司证实。'}});
  return {...q,id:'community-'+stableID(p.id)};
}
export function validateCommunity(data) {
  if(data?.schemaVersion!==1||!Array.isArray(data.questions)||!Array.isArray(data.reviews)) throw new Error('社区发布数据格式不正确。');
  const ids=new Set();
  const questions=data.questions.map(q=>{
    if(!/^community-[a-z0-9]+$/.test(q.id)||ids.has(q.id))throw new Error('社区题目 ID 不正确或重复。');
    ids.add(q.id); return {...validateCustom({...q,id:'user-'+q.id}),id:q.id};
  });
  const reviews=data.reviews.map(r=>{
    if(!['accepted','needs-info','rejected'].includes(r.status)||!text(r.reviewer,80)||!text(r.note,3000)||!Number.isFinite(Date.parse(r.reviewedAt)))throw new Error('社区审阅记录不完整。');
    return {id:text(r.id,100),status:r.status,title:text(r.title,300),target:{type:text(r.target?.type,30),id:text(r.target?.id,160)},reviewer:text(r.reviewer,80),note:text(r.note,3000),reviewedAt:r.reviewedAt,sourceUrl:safeURL(r.sourceUrl)};
  });
  return {schemaVersion:1,questions,reviews};
}
