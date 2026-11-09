import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateCareer,filterCareer,careerCounts,renderCareer} from './career.js';

const data=validateCareer(JSON.parse(await readFile(new URL('./career-data.json',import.meta.url),'utf8')));
const base={...data.records[0],id:'fixture',verification:'original-read',evidenceType:'experience',questions:[{text:'示例问题'}],salary:null,interview:undefined,tracks:['VLA'],hiringStage:'校招',relevance:'direct'};
const salary={...base,id:'salary-fixture',questions:[],salary:{originalText:'测试样本',basis:'正文',currency:'CNY',baseMonthly:30000,guaranteedMonths:12,guaranteedAnnualCash:360000}};
assert.deepEqual(careerCounts([base,salary,...data.records.filter(r=>r.verification==='lead')]),{read:2,interviews:1,salaries:1,leads:data.records.filter(r=>r.verification==='lead').length});
assert.equal(filterCareer([base,salary],{type:'interview',track:'VLA',stage:'校招'}).length,1);
assert.equal(filterCareer([base,salary],{type:'salary',track:'WAM'}).length,0);
assert.equal(filterCareer([base],{query:'示例问题'}).length,1);
assert.throws(()=>validateCareer({schemaVersion:1,records:[{...base,verification:'lead'}]}));
assert.throws(()=>validateCareer({schemaVersion:1,records:[{...salary,salary:{...salary.salary,guaranteedMonths:null}}]}));
assert.throws(()=>validateCareer({schemaVersion:1,records:[{...base,source:{url:'javascript:alert(1)'}}]}));
assert.throws(()=>validateCareer({schemaVersion:1,records:[base,base]}));

const processOnly={...base,id:'process-only',questions:[],interview:{round:'三面',format:'白板编程'}};
assert.equal(filterCareer([processOnly],{type:'interview'}).length,1);
assert.equal(careerCounts([processOnly]).interviews,1);
assert.throws(()=>validateCareer({schemaVersion:1,records:[{...processOnly,verification:'lead'}]}));

const advice={...base,id:'advice',evidenceType:'advice',questions:[],insights:['核对可用计算资源'],source:{platform:'牛客',author:'示例作者',url:'https://www.nowcoder.com/example'}};
const recruitment={...salary,id:'job',evidenceType:'recruitment',source:{platform:'企业官网',url:'https://example.com/jobs',author:''},salary:{originalText:'40–60k / 月',basis:'岗位页',monthlyRange:'40–60k / 月'}};
const preview={...recruitment,id:'preview',verification:'preview-only',salary:null};
const adjacent={...base,id:'adjacent',relevance:'adjacent'};
assert.deepEqual(filterCareer([advice,recruitment,preview],{type:'recruitment'}).map(r=>r.id),['job']);
assert.deepEqual(filterCareer([advice,recruitment],{type:'advice',platform:'牛客',evidence:'advice'}).map(r=>r.id),['advice']);
assert.equal(filterCareer([advice],{query:'示例作者'}).length,1);
assert.equal(filterCareer([advice],{query:'计算资源'}).length,1);
assert.deepEqual(filterCareer([base,adjacent],{relevance:'direct'}).map(r=>r.id),['fixture']);
assert.equal(careerCounts([advice]).interviews,0);
assert.equal(careerCounts([advice]).salaries,0);
assert.throws(()=>validateCareer({schemaVersion:1,records:[{...advice,questions:base.questions}]}));
assert.throws(()=>validateCareer({schemaVersion:1,records:[{...advice,salary:salary.salary}]}));

// Exercise rendered content and filter event wiring without requiring a browser.
const nodes=new Map();
const root={dataset:{},innerHTML:'',querySelector(id){
  if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',handlers:{},addEventListener(event,fn){this.handlers[event]=fn;}});
  return nodes.get(id);
}};
const previousFetch=globalThis.fetch;
try{
  globalThis.fetch=async()=>({ok:true,json:async()=>({schemaVersion:1,records:[advice,recruitment,preview]})});
  await renderCareer(root,true);
  const html=nodes.get('#career-results').innerHTML;
  assert.match(html,/查看牛客原文/);
  assert.match(html,/查看企业官网原文/);
  assert.match(html,/40–60k \/ 月/);
  assert.match(html,/核对可用计算资源/);
  nodes.get('#career-platform').handlers.input({target:{value:'牛客'}});
  assert.equal(nodes.get('#career-results-count').textContent,'1 条记录');
  assert.doesNotMatch(nodes.get('#career-results').innerHTML,/40–60k/);
}finally{globalThis.fetch=previousFetch;}

console.log(`PASS: ${data.records.length} career records; provenance, platform/author/scope filters, lead/advice exclusion, rendered sources and compensation basis.`);
