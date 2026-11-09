export const STORAGE_KEY = 'embodied-prep-v1';
export const TRACKS = ['VLA','Agentic Robotics','WAM','基础与工程'];
export const TOPICS = ['预训练'];
export const LEVELS = {new:'未练习',weak:'待巩固',learning:'有思路',mastered:'已掌握'};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value) {
  try { const url = new URL(value); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export const freshState = () => ({schemaVersion:1,customQuestions:[],records:{},prefs:{company:'all',role:'all',source:'all',track:'all',topic:'all',sort:'recommended'}});
export const isDue = (record, now=Date.now()) => Boolean(record?.level && record.level !== 'new' && Number.isFinite(record.dueAt) && record.dueAt <= now);
export function assess(record,level,now=Date.now()) {
  const delay={weak:0,learning:86400000,mastered:604800000}[level];
  if(delay===undefined) throw new Error('未知的掌握程度');
  return {...record,level,lastAt:now,dueAt:now+delay,attempts:(record?.attempts||0)+1};
}
export function filterQuestions(questions,records,filters,view='bank',query='',now=Date.now()) {
  const term=query.trim().toLocaleLowerCase();
  const result=questions.filter(q =>
    (filters.company==='all'||q.companies.includes(filters.company)) &&
    (filters.role==='all'||q.roles.includes(filters.role)) &&
    (filters.source==='all'||q.source.kind===filters.source) &&
    (filters.track==='all'||q.track===filters.track) &&
    (!filters.topic||filters.topic==='all'||q.tags.includes(filters.topic)) &&
    (view!=='saved'||records[q.id]?.saved) &&
    (view!=='review'||isDue(records[q.id],now)) &&
    (!term||[q.title,q.track,...q.tags,...q.roles].join(' ').toLocaleLowerCase().includes(term))
  );
  if(filters.sort==='difficulty') {const order={基础:0,进阶:1,深入:2};result.sort((a,b)=>order[a.difficulty]-order[b.difficulty]);}
  if(filters.sort==='unseen') result.sort((a,b)=>Number(Boolean(records[a.id]?.level))-Number(Boolean(records[b.id]?.level)));
  if(filters.sort==='recommended') result.sort((a,b)=>{
    const score=q=>isDue(records[q.id],now)?0:!records[q.id]?.level?1:records[q.id]?.level==='mastered'?3:2;
    return score(a)-score(b);
  });
  return result;
}
const object=value=>value && typeof value==='object' && !Array.isArray(value);
function str(value,label,max=16000) { if(typeof value!=='string'||value.length>max) throw new Error(`${label}格式不正确`); return value; }
function list(value,label,max=30) {if(!Array.isArray(value)||value.length>max)throw new Error(`${label}必须是数组（最多 ${max} 项）`);return value;}
function texts(value,label,max=30) {return list(value,label,max).map(v=>str(v,label,6000));}
export function validateCustom(q) {
  if(!object(q)||typeof q.id!=='string'||!/^user-[a-zA-Z0-9-]{1,80}$/.test(q.id)) throw new Error('自定义题目 ID 格式不正确');
  if(!TRACKS.includes(q.track)||!['definite','open','pending'].includes(q.kind)||!['基础','进阶','深入'].includes(q.difficulty)) throw new Error('题目方向、答案性质或难度不正确');
  if(!object(q.source)||!['practice','recollection'].includes(q.source.kind)) throw new Error('题目来源类型不正确');
  const title=str(q.title,'题目',1200).trim(), companies=texts(q.companies,'公司',10),roles=texts(q.roles,'岗位',10);
  if(!title||!companies.length||!roles.length||companies.some(x=>!x.trim())||roles.some(x=>!x.trim())) throw new Error('题目、公司和岗位不能为空');
  const refs=list(q.refs??[],'参考资料').map(ref=>{
    if(!object(ref)||!safeURL(ref.url)) throw new Error('参考链接必须是 http 或 https 地址');
    return {title:str(ref.title,'资料标题',300),url:safeURL(ref.url)};
  });
  if(q.source.url && !safeURL(q.source.url)) throw new Error('来源链接必须是 http 或 https 地址');
  const answer=str(q.answer??'','答案'),kind=answer.trim()?q.kind:'pending';
  return {id:q.id,title,companies,roles,track:q.track,kind,difficulty:q.difficulty,tags:texts(q.tags??['个人题库'],'标签'),answer,
    caveat:str(q.caveat??'个人录入内容，结论与来源需要自行核对。','适用条件'),steps:texts(q.steps??[],'学习步骤'),pitfalls:texts(q.pitfalls??[],'常见误区'),followups:texts(q.followups??[],'追问'),refs,
    source:{kind:q.source.kind,label:str(q.source.label??'个人录入','来源标题',300),note:str(q.source.note??'个人录入，未经公司证实。','来源说明'),url:q.source.url?safeURL(q.source.url):'',...(typeof q.source.originRecordId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(q.source.originRecordId)?{originRecordId:q.source.originRecordId}:{})}};
}
export function validateBackup(value,baseIDs) {
  if(!object(value)||value.schemaVersion!==1)throw new Error('不是受支持的研习室备份（需要 schemaVersion: 1）');
  const customQuestions=list(value.customQuestions,'自定义题库',2000).map(validateCustom);
  if(new Set(customQuestions.map(q=>q.id)).size!==customQuestions.length)throw new Error('备份中存在重复题目 ID');
  if(!object(value.records))throw new Error('学习记录格式不正确');
  const validIDs=new Set([...baseIDs,...customQuestions.map(q=>q.id)]),records={};
  for(const [id,r] of Object.entries(value.records)) {
    if(!validIDs.has(id))continue;
    if(!object(r))throw new Error('某条学习记录格式不正确');
    const entry={saved:r.saved===true,draft:str(r.draft??'','作答'),note:str(r.note??'','笔记')};
    if(r.level){if(!['weak','learning','mastered'].includes(r.level))throw new Error('掌握程度不正确');entry.level=r.level;}
    for(const key of ['dueAt','lastAt','attempts'])if(r[key]!==undefined){if(!Number.isFinite(r[key])||r[key]<0)throw new Error('复习时间或次数不正确');entry[key]=r[key];}
    records[id]=entry;
  }
  return {schemaVersion:1,customQuestions,records,prefs:object(value.prefs)?{
    company:typeof value.prefs.company==='string'?value.prefs.company:'all',role:typeof value.prefs.role==='string'?value.prefs.role:'all',
    source:['all','practice','recollection'].includes(value.prefs.source)?value.prefs.source:'all',track:['all',...TRACKS].includes(value.prefs.track)?value.prefs.track:'all',
    topic:TOPICS.includes(value.prefs.topic)?value.prefs.topic:'all',
    sort:['recommended','difficulty','unseen'].includes(value.prefs.sort)?value.prefs.sort:'recommended',
  }:freshState().prefs};
}
export function mergeBackup(current,incoming) {
  // Preserve existing records and questions on conflict; importing never silently overwrites local work.
  const currentIDs=new Set(current.customQuestions.map(q=>q.id));
  return {...current,customQuestions:[...current.customQuestions,...incoming.customQuestions.filter(q=>!currentIDs.has(q.id))],records:{...incoming.records,...current.records}};
}
