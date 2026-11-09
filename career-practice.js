import {validateCustom} from './core.js';

export function stableID(text) {
  let a=2166136261, b=5381;
  for (const char of text) { const code=char.codePointAt(0); a=Math.imul(a^code,16777619); b=Math.imul(b,33)^code; }
  return (a>>>0).toString(36)+(b>>>0).toString(36);
}
export function careerQuestion(record,index,companies=[]) {
  const item=record.questions[index];
  if(record.verification!=='original-read'||record.evidenceType==='advice'||!item?.text) throw new Error('只有已读取原文的面经题目可以加入练习。');
  const company=companies.find(c=>c.name===record.company)?.id||record.company||'公司未披露';
  return validateCustom({
    id:'user-career-'+stableID(record.id+'\n'+item.text.trim()), title:item.text,
    companies:[company],roles:[record.role||'岗位未披露'],track:record.tracks.length===1?record.tracks[0]:'基础与工程',
    kind:'pending',difficulty:'进阶',tags:['面经转练习',...record.tracks],answer:'',
    caveat:'这是一条面经题目主题，答案尚未整理。请结合原文确认题意，再补充有依据的回答。',
    steps:[],pitfalls:[],followups:[],refs:[],
    source:{kind:'recollection',label:record.source.platform+'面经 · '+record.title,url:record.source.url,
      originRecordId:record.id,
      note:[item.context,record.summary,record.note,'经历时间：'+(record.experienceDate||'未披露'),'来源已读取，不代表公司证实。'+(record.tracks.length>1?'原记录包含多个方向，单题方向待核对。':'')].filter(Boolean).join('\n')}
  });
}
export function addCareerQuestions(current,record,indexes,companies=[]) {
  const questions=[...current], ids=[]; let added=0;
  for(const index of indexes) {
    const q=careerQuestion(record,index,companies); ids.push(q.id);
    if(!questions.some(existing=>existing.id===q.id)) { questions.push(q); added++; }
  }
  if(questions.length>2000) throw new Error('个人题库已达到 2000 道，请先整理题库。');
  return {questions,ids:[...new Set(ids)],added};
}
