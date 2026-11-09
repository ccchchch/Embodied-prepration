// Pure logic and content checks; no browser or third-party package required.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMPANIES, QUESTIONS, ROADMAPS, SOURCE_ATTACHMENTS } from './data.js';
import { freshState, filterQuestions, assess, isDue, validateBackup, validateCustom, mergeBackup, safeURL, escapeHTML } from './core.js';

const ids=QUESTIONS.map(q=>q.id);
assert.equal(new Set(ids).size,ids.length,'Question IDs must be unique');
const companyIDs=new Set(COMPANIES.map(c=>c.id));
for(const q of QUESTIONS){
  assert.ok(q.title&&q.answer&&q.caveat&&q.steps.length&&q.refs.length,`${q.id}: complete answer and references`);
  assert.ok(q.companies.every(id=>companyIDs.has(id)),`${q.id}: known companies`);
  assert.ok(q.refs.every(ref=>safeURL(ref.url)),`${q.id}: safe reference URLs`);
  if(q.source.kind==='recollection')assert.ok(safeURL(q.source.url)||Object.hasOwn(SOURCE_ATTACHMENTS,q.source.attachment),'Recollections require a public source or a registered local attachment');
}
assert.ok(COMPANIES.every(c=>QUESTIONS.some(q=>q.companies.includes(c.id))));
assert.equal(COMPANIES.filter(c=>c.region==='domestic').length,19);
assert.equal(COMPANIES.filter(c=>c.region==='overseas').length,6);
assert.equal(QUESTIONS.filter(q=>q.source.kind==='recollection').length,30);
assert.ok(QUESTIONS.filter(q=>q.source.kind==='recollection').every(q=>q.companies.length===1),'Do not cross-attribute recollections');
for(const c of COMPANIES) {
  const matched=filterQuestions(QUESTIONS,{}, {...freshState().prefs,company:c.id});
  assert.ok(matched.length>0&&matched.every(q=>q.companies.includes(c.id)),c.name);
}
assert.equal(ROADMAPS.length,4);
const defaults=freshState();
const dexmalVol2=filterQuestions(QUESTIONS,{}, {...defaults.prefs,company:'dexmal',source:'recollection'},'bank','Vol.2');
assert.equal(dexmalVol2.length,18,'All 18 screenshot questions must be independently available');
assert.deepEqual(dexmalVol2.map(q=>q.id),Array.from({length:18},(_,i)=>`recall-dexmal-vol2-${String(i+1).padStart(2,'0')}`));
assert.ok(dexmalVol2.every(q=>q.companies.length===1&&q.companies[0]==='dexmal'));
for(const [id,attachment] of Object.entries(SOURCE_ATTACHMENTS)){
  assert.match(attachment.url,/^\.\/assets\/sources\/[a-z0-9-]+\.png$/);
  let bytes;
  try{bytes=await readFile(new URL(attachment.url,import.meta.url));}
  catch(error){if(attachment.localOnly&&error.code==='ENOENT')continue;throw error;}
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',`${id}: actual PNG source exists`);
}
assert.equal(filterQuestions(QUESTIONS,{}, {...defaults.prefs,company:'pi',source:'recollection'},'bank','Vol.2').length,0,'Paper authors do not inherit the interview attribution');
const pretraining=filterQuestions(QUESTIONS,{}, {...defaults.prefs,topic:'预训练'});
assert.equal(pretraining.length,18);
assert.equal(pretraining.filter(q=>q.source.kind==='recollection').length,3);
const pretrainingWAM=filterQuestions(QUESTIONS,{}, {...defaults.prefs,topic:'预训练',company:'nvidia',track:'WAM',role:'世界模型算法工程师'});
assert.ok(pretrainingWAM.length>0&&pretrainingWAM.every(q=>q.track==='WAM'&&q.tags.includes('预训练')));
assert.equal(filterQuestions(QUESTIONS,{}, {...defaults.prefs,topic:'预训练',company:'galaxea',source:'recollection'}).length,0,'Post-training recollections must not become pretraining interview evidence');
assert.ok(pretraining.filter(q=>q.source.kind==='recollection').every(q=>q.source.scope==='general'&&q.roles.length===1&&q.roles[0]==='大模型算法岗（通用训练）'));
assert.equal(filterQuestions(QUESTIONS,{},defaults.prefs).length,QUESTIONS.length);
const target=filterQuestions(QUESTIONS,{}, {...defaults.prefs,company:'nvidia',track:'WAM',role:'世界模型算法工程师'});
assert.ok(target.length>0&&target.every(q=>q.track==='WAM'&&q.companies.includes('nvidia')));
assert.equal(filterQuestions(QUESTIONS,{}, {...defaults.prefs,company:'nvidia',source:'recollection'}).length,0);
assert.ok(filterQuestions(QUESTIONS,{},defaults.prefs,'bank','flow matching').length>0);
assert.equal(filterQuestions(QUESTIONS,{},defaults.prefs,'bank','NON_EXISTENT_QUESTION').length,0);
const now=1800000000000;
const weak=assess({draft:'回答',note:'复盘',saved:true},'weak',now);
const learning=assess({},'learning',now),mastered=assess({},'mastered',now);
assert.ok(isDue(weak,now));assert.ok(!isDue(learning,now));assert.ok(isDue(learning,now+86400000));
assert.ok(!isDue(mastered,now+604799999));assert.ok(isDue(mastered,now+604800000));
assert.equal(weak.note,'复盘');assert.equal(weak.saved,true);
const state={...freshState(),records:{[ids[0]]:weak,[ids[1]]:mastered}};
assert.equal(filterQuestions(QUESTIONS,state.records,defaults.prefs,'review','',now).length,1);
assert.equal(filterQuestions(QUESTIONS,state.records,defaults.prefs,'saved').length,1);
const restored=validateBackup(JSON.parse(JSON.stringify(state)),ids);
assert.equal(restored.records[ids[0]].draft,'回答');assert.equal(restored.records[ids[0]].dueAt,now);
const oldState=JSON.parse(JSON.stringify(state));delete oldState.prefs.topic;
assert.equal(validateBackup(oldState,ids).prefs.topic,'all','Old backups remain compatible with the topic filter');
assert.deepEqual(validateBackup(oldState,ids).records,restored.records,'Adding topic filtering preserves learning records');
assert.equal(validateBackup({...state,prefs:{...state.prefs,topic:'预训练'}},ids).prefs.topic,'预训练');
assert.equal(validateBackup({...state,prefs:{...state.prefs,topic:'unknown'}},ids).prefs.topic,'all');
const custom=validateCustom({id:'user-example',title:'我自己的题',track:'WAM',companies:['其他公司'],roles:['具身算法工程师'],kind:'definite',difficulty:'基础',answer:'',source:{kind:'recollection',url:'https://example.com/interview'}});
assert.equal(custom.kind,'pending','Empty answers must never be marked definite');
const customPretrain=validateCustom({...custom,tags:['个人题库','预训练']});
const customRestored=validateBackup({...freshState(),customQuestions:[customPretrain]},ids);
assert.equal(filterQuestions(customRestored.customQuestions,{}, {...defaults.prefs,topic:'预训练'}).length,1,'Custom topic tags survive backup and filtering');
assert.throws(()=>validateCustom({...custom,source:{kind:'recollection',url:'javascript:alert(1)'}}));
assert.equal(safeURL('data:text/html,test'),'');assert.equal(safeURL('javascript:alert(1)'),'');
assert.ok(!escapeHTML('<img src=x onerror="alert(1)">').includes('<img'));
assert.throws(()=>validateBackup({...state,records:{[ids[0]]:{dueAt:'bad'}}},ids));
assert.throws(()=>validateBackup({...state,schemaVersion:2},ids));
assert.throws(()=>validateBackup({...state,customQuestions:[custom,custom]},ids));
const incoming=validateBackup({...freshState(),customQuestions:[custom],records:{[ids[0]]:{draft:'旧的回答'},[custom.id]:{note:'导入笔记'}}},ids);
const merged=mergeBackup(state,incoming);
assert.equal(merged.records[ids[0]].draft,'回答','Existing local work must survive import');
assert.equal(merged.records[custom.id].note,'导入笔记');
assert.equal(mergeBackup(merged,incoming).customQuestions.length,1,'Repeated imports must be idempotent');
const source=await readFile(new URL('./app.js',import.meta.url),'utf8');
new Function(source.replace(/^import .*;\n/gm,''));
console.log(`PASS: ${QUESTIONS.length} questions, ${COMPANIES.length} companies; filters, reviews, persistence round-trip, safe imports, merge conflicts and app syntax.`);
