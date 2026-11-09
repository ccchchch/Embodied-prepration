import {escapeHTML as esc,safeURL} from './core.js';
import {routeHash} from './routes.js';
import {reviewedNotes} from './community.js';

export const CAREER_TRACKS=['VLA','Agentic Robotics','WAM'];
const sourceLabels={experience:'作者自述',recruitment:'招聘信息',repost:'转述整理',advice:'作者观点 / 求职建议',unknown:'来源性质待核实'};
const verificationLabels={'original-read':'已读取原文','preview-only':'仅搜索预览',lead:'待核实线索'};
let snapshot=null,loadError='',generation=0;
function isInterview(r){return r.questions.length>0||Boolean(r.interview);}
const filters={track:'all',type:'all',stage:'all',platform:'all',evidence:'all',relevance:'all',salaryEvidence:'all',query:''};

function matchesType(r,type){
  if(!type||type==='all')return true;
  if(type==='lead')return r.verification!=='original-read';
  if(r.verification!=='original-read')return false;
  if(type==='interview')return isInterview(r);
  if(type==='salary')return Boolean(r.salary);
  if(type==='recruitment')return r.evidenceType==='recruitment';
  if(type==='advice')return r.evidenceType==='advice';
  return false;
}

export function filterCareer(records,f={}){
  const term=(f.query||'').trim().toLocaleLowerCase();
  return records.filter(r=>(!f.track||f.track==='all'||r.tracks.includes(f.track))&&
    matchesType(r,f.type)&&
    (!f.salaryEvidence||f.salaryEvidence==='all'||(r.salary&&r.verification==='original-read'&&r.evidenceType===f.salaryEvidence))&&
    (!f.stage||f.stage==='all'||r.hiringStage===f.stage)&&
    (!f.platform||f.platform==='all'||r.source.platform===f.platform)&&
    (!f.evidence||f.evidence==='all'||r.evidenceType===f.evidence)&&
    (!f.relevance||f.relevance==='all'||(r.relevance||'direct')===f.relevance)&&
    (!term||[r.title,r.company,r.team,r.role,r.summary,r.source.author,r.source.platform,...(r.insights||[]),...r.questions.flatMap(q=>[q.text,q.context])].join(' ').toLocaleLowerCase().includes(term)));
}
export function careerCounts(records){
  const read=records.filter(r=>r.verification==='original-read');
  return {read:read.length,interviews:read.filter(isInterview).length,salaries:read.filter(r=>r.salary).length,leads:records.length-read.length};
}
export function validateCareer(data){
  if(data.schemaVersion!==1||!Array.isArray(data.records))throw new Error('求职情报数据格式不正确');
  const ids=new Set();
  for(const r of data.records){
    if(!r.id||ids.has(r.id))throw new Error('求职情报 ID 缺失或重复');
    ids.add(r.id);
    if(!r.title||!Array.isArray(r.tracks)||!r.tracks.every(t=>CAREER_TRACKS.includes(t)))throw new Error('情报标题或方向缺失');
    if(!safeURL(r.source?.url)||!r.collectedAt)throw new Error('情报需要来源和采集时间');
    if(!Object.hasOwn(verificationLabels,r.verification)||!Object.hasOwn(sourceLabels,r.evidenceType))throw new Error('情报证据属性缺失');
    if(!Array.isArray(r.questions)||!r.questions.every(q=>typeof q.text==='string'&&q.text.trim()))throw new Error('面经问题格式不正确');
    if(r.insights&&(!Array.isArray(r.insights)||!r.insights.every(s=>typeof s==='string'&&s.trim())))throw new Error('整理要点格式不正确');
    if(r.relevance&&!['direct','adjacent'].includes(r.relevance))throw new Error('岗位关联范围不正确');
    if(r.evidenceType==='advice'&&(isInterview(r)||r.salary))throw new Error('作者建议不能作为面经或薪资样本');
    if(r.verification!=='original-read'&&(r.questions.length||r.salary||r.interview))throw new Error('未读取原文的线索不能包含面试经历、正式问题或薪资样本');
    if(r.salary&&(!r.salary.originalText||!r.salary.basis))throw new Error('薪资样本需要原始口径与来源位置');
    if(r.salary?.guaranteedAnnualCash!=null){
      const s=r.salary;
      if(!(s.baseMonthly>0&&s.guaranteedMonths>0&&s.guaranteedAnnualCash===s.baseMonthly*s.guaranteedMonths))throw new Error('保证年现金只能由明确保证的月薪和薪数计算');
    }
  }
  return data;
}
function readable(value){return value==null||value===''?'未披露':String(value);}
function money(value,currency){return value==null?'未披露':`${Number(value).toLocaleString('zh-CN')} ${currency||'币种未披露'}`;}
function salaryHTML(s){
  if(!s)return '';
  const fields=[...(s.dailyRate?[['日薪 / 招聘区间',readable(s.dailyRate)]]:[]),...(s.monthlyRange?[['月薪 / 招聘区间',readable(s.monthlyRange)]]:[]),['明确月薪',money(s.baseMonthly,s.currency)],['保证薪数',s.guaranteedMonths==null?'未披露':`${s.guaranteedMonths} 薪`],['保证年现金（计算值）',money(s.guaranteedAnnualCash,s.currency)],['浮动奖金',readable(s.bonus)],['一次性签字费',readable(s.signingBonus)],['股权 / 期权',readable(s.equity)],['原文总包口径',readable(s.totalClaimed)],['税前 / 税后',readable(s.taxBasis)]];
  return `<section class="career-salary"><h3>薪资口径</h3><p class="career-quote">${esc(s.originalText)}</p><dl class="career-facts">${fields.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="muted">信息位置：${esc(s.basis)}${s.note?` · ${esc(s.note)}`:''}</p></section>`;
}
export function careerRecord(id){return snapshot?.records.find(r=>r.id===id);}
export async function loadCareerRecords(){
  if(snapshot)return snapshot.records;
  const response=await fetch('./career-data.json',{cache:'no-store'});
  if(!response.ok)throw new Error('求职情报暂时无法读取');
  snapshot=validateCareer(await response.json());return snapshot.records;
}
export function setCareerFilters(values={}){for(const key of Object.keys(filters))filters[key]=values[key]||(key==='query'?'':'all');}
export function careerFilters(){return {...filters};}
function recordHTML(r,detail=false){
  const lead=r.verification!=='original-read';
  return `<article class="career-card"><div class="career-card-top"><div>${r.tracks.map(t=>`<span class="tag">${esc(t)}</span>`).join(' ')} <span class="tag ${lead?'career-lead':'career-read'}">${verificationLabels[r.verification]}</span></div><span class="muted">${esc(r.source.platform)} · ${esc(sourceLabels[r.evidenceType])}</span></div><h2>${detail?esc(r.title):`<a href="${routeHash('career',r.id)}">${esc(r.title)}</a>`}</h2><div class="career-meta">${[r.relevance==='adjacent'?'相邻工程岗位':null,r.company,r.team,r.role,r.hiringStage,r.location].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div><p>${esc(r.summary||'等待读取原文后整理。')}</p>${r.questions.length?`<details><summary>查看 ${r.questions.length} 个面经题目主题</summary><ol class="career-questions">${r.questions.map((q,index)=>`<li>${esc(q.text)}${q.context?`<small>${esc(q.context)}</small>`:''}<button class="button small career-question-action" data-practice-record="${esc(r.id)}" data-practice-index="${index}">加入个人练习</button></li>`).join('')}</ol></details>`:''}${r.insights?.length?`<details><summary>查看 ${r.insights.length} 条整理要点</summary><ul class="career-questions">${r.insights.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></details>`:''}${salaryHTML(r.salary)}<div class="career-evidence"><a href="${esc(safeURL(r.source.url))}" target="_blank" rel="noopener noreferrer">${lead?'打开来源核实':'查看'+esc(r.source.platform)+'原文'} ↗</a>${r.source.indexUrl?`<a href="${esc(safeURL(r.source.indexUrl))}" target="_blank" rel="noopener noreferrer">线索出处 ↗</a>`:''}<span>作者：${esc(readable(r.source.author))}</span><span>经历：${esc(readable(r.experienceDate))}</span><span>发布：${esc(readable(r.publishedAt))}</span><span>采集：${esc(r.collectedAt.replace('T',' '))}</span></div>${r.note?`<p class="career-note">${esc(r.note)}</p>`:''}${detail?reviewedNotes('career',r.id):''}<div class="content-actions">${r.questions.length&&!lead?`<button class="button primary" data-practice-record="${esc(r.id)}" data-practice-index="all">练习这篇面经 · ${r.questions.length} 题</button>`:''}<button class="button" data-share-route="${routeHash('career',r.id)}">复制链接</button><button class="button" data-contribute-type="career" data-contribute-id="${esc(r.id)}">纠错 / 补充</button></div></article>`;
}
function renderResults(root){
  const records=filterCareer(snapshot.records,filters);
  root.querySelector('#career-results-count').textContent=`${records.length} 条记录`;
  root.querySelector('#career-results').innerHTML=records.length?records.map(recordHTML).join(''):'<div class="empty"><h3>暂无符合条件的记录</h3><p>调整筛选，或在下一次整理后查看。未核实的线索不计入面经和薪资样本。</p></div>';
}
function renderContent(root,options={}){
  if(options.id){const r=careerRecord(options.id);root.innerHTML=r?`<div class="record-detail"><a class="button ghost" href="#/career">← 全部求职情报</a>${recordHTML(r,true)}</div>`:'<div class="empty"><h2>未找到这条情报</h2><a href="#/career">返回求职情报</a></div>';return;}
  const c=careerCounts(snapshot.records);
  root.innerHTML=`<section class="page-head"><div><span class="eyebrow">ROBOTICS CAREER RESEARCH</span><h1>求职情报</h1><p>VLA、Agentic Robotics、WAM · 面经与薪资逐条溯源</p></div><div class="content-actions"><button class="button" data-share-current>分享筛选</button><button class="button" id="career-refresh">刷新资料</button></div></section><div class="stats career-stats">${[['已读取原文',c.read],['面经记录',c.interviews],['薪资记录',c.salaries],['待核实线索',c.leads]].map(([label,n])=>`<div class="stat"><span class="muted">${label}</span><div class="stat-value">${n}</div></div>`).join('')}</div><div class="career-context"><strong>按岗位与经历比较，不以个例代表行情。</strong><p>作者自述、转述、招聘报价和求职建议分别标注。记录数不等于独立候选人数；重复题源不用于计算面试频率。相邻工程岗位可单独筛选。WAM 指 World Action Model。原文已读取不代表公司已证实。</p><small>最近整理：${esc(readable(snapshot.updatedAt))} · ${esc(snapshot.statusNote||'')}</small></div><div class="career-filters"><label>方向<select id="career-track"><option value="all">全部方向</option>${CAREER_TRACKS.map(t=>`<option ${filters.track===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label><label>资料类型<select id="career-type">${[['all','全部资料'],['interview','面经记录'],['salary','薪资记录'],['recruitment','招聘岗位'],['advice','求职建议'],['lead','待核实线索']].map(([v,label])=>`<option value="${v}" ${filters.type===v?'selected':''}>${label}</option>`).join('')}</select></label><label>招聘阶段<select id="career-stage"><option value="all">全部阶段</option>${[...new Set(snapshot.records.map(r=>r.hiringStage).filter(Boolean))].map(v=>`<option ${filters.stage===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label>来源平台<select id="career-platform"><option value="all">全部平台</option>${[...new Set(snapshot.records.map(r=>r.source.platform))].map(v=>`<option ${filters.platform===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label>来源性质<select id="career-evidence"><option value="all">全部来源性质</option>${Object.entries(sourceLabels).map(([v,label])=>`<option value="${v}" ${filters.evidence===v?'selected':''}>${label}</option>`).join('')}</select></label><label>岗位范围<select id="career-relevance">${[['all','全部相关资料'],['direct','目标方向资料'],['adjacent','相邻工程岗位']].map(([v,label])=>`<option value="${v}" ${filters.relevance===v?'selected':''}>${label}</option>`).join('')}</select></label><label>薪资性质<select id="career-salary-evidence">${[['all','全部（含非薪资资料）'],['experience','Offer 自述'],['recruitment','招聘报价'],['repost','转述资料']].map(([v,label])=>`<option value="${v}" ${filters.salaryEvidence===v?'selected':''}>${label}</option>`).join('')}</select></label><label class="career-search-label">搜索<input id="career-search" type="search" value="${esc(filters.query)}" placeholder="公司、作者、岗位、问题或要点"></label></div><div class="section-heading"><h2>来源记录</h2><span id="career-results-count" class="muted"></span></div><div id="career-results" class="career-list"></div>`;
  for(const [id,key] of [['career-track','track'],['career-type','type'],['career-stage','stage'],['career-platform','platform'],['career-evidence','evidence'],['career-relevance','relevance'],['career-salary-evidence','salaryEvidence'],['career-search','query']])root.querySelector('#'+id).addEventListener('input',event=>{filters[key]=event.target.value;renderResults(root);options.onChange?.({...filters});});
  root.querySelector('#career-refresh').addEventListener('click',()=>renderCareer(root,true,options));
  renderResults(root);
}
export async function renderCareer(root,refresh=false,options={}){
  const own=++generation;
  root.dataset.careerRender=String(own);
  if(!snapshot||refresh){
    root.innerHTML='<div class="loading" id="career-loading">正在读取求职资料…</div>';
    try{
      const response=await fetch('./career-data.json',{cache:'no-store'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=validateCareer(await response.json());
      if(own!==generation||!root.querySelector('#career-loading'))return;
      snapshot=data;loadError='';
    }catch(error){
      if(own!==generation||!root.querySelector('#career-loading'))return;
      loadError=error.message;
      root.innerHTML=`<div class="empty"><h2>求职资料暂时无法读取</h2><p>${esc(loadError)}</p><button class="button" id="career-retry">重试</button></div>`;
      root.querySelector('#career-retry').onclick=()=>renderCareer(root,true,options);return;
    }
  }
  renderContent(root,options);
}
