import {careerQuestion} from './career-practice.js';

export function jobCandidates(questions,careerRecords,companies) {
  const byID=new Map(questions.map(q=>[q.id,{question:q}]));
  const sourceKeys=new Set(questions.map(q=>q.source.url+'\n'+q.title.replace(/\s+/g,'')));
  for(const record of careerRecords){
    if(record.verification!=='original-read'||!['experience','repost'].includes(record.evidenceType))continue;
    record.questions.forEach((item,index)=>{
      const q=careerQuestion(record,index,companies),key=q.source.url+'\n'+q.title.replace(/\s+/g,'');
      const context={recordID:record.id,recordIndex:index,recordTitle:record.title,primaryText:[item.text,item.context||''].join(' '),secondaryText:'',evidenceType:record.evidenceType};
      if(byID.has(q.id)){byID.set(q.id,{...byID.get(q.id),...context});return;}
      if(sourceKeys.has(key))return;
      sourceKeys.add(key);byID.set(q.id,{question:q,...context});
    });
  }
  return [...byID.values()];
}

export function materializeJobQuestions(current, candidates) {
  const questions=[...current];
  for(const {question:q} of candidates){
    if(q.id.startsWith('user-')&&!questions.some(existing=>existing.id===q.id))questions.push(q);
  }
  if(questions.length>2000)throw new Error('个人题库已达到 2000 道，请先整理题库。');
  return {questions,ids:[...new Set(candidates.map(c=>c.question.id))]};
}
