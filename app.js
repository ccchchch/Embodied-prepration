import {COMPANIES,QUESTIONS,ROADMAPS,SOURCE_ATTACHMENTS} from './data.js';
import {renderCareer,careerRecord,setCareerFilters,careerFilters} from './career.js';
import {community,setupCommunity,renderCommunity,openContribution,reviewedNotes} from './community.js';
import {readRoute,routeHash,shareURL} from './routes.js';
import {addCareerQuestions} from './career-practice.js';
import {STORAGE_KEY,TRACKS,TOPICS,LEVELS,escapeHTML as esc,safeURL,freshState,isDue,assess,filterQuestions,validateBackup,validateCustom,mergeBackup} from './core.js';

const BASE_QUESTIONS=[...QUESTIONS,...community.questions];
const $=selector=>document.querySelector(selector);
const icons={grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',repeat:'<path d="M20 7H7a4 4 0 0 0-4 4m17-4-4-4m4 4-4 4M4 17h13a4 4 0 0 0 4-4M4 17l4-4m-4 4 4 4"/>',bookmark:'<path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z"/>',building:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h1m4 0h1M9 11h1m4 0h1m-5 10v-6h4v6"/>',route:'<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 6h7a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h7"/>',download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 16v5h16v-5"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',check:'<path d="m5 12 4 4 10-10"/>',book:'<path d="M12 5v16M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',back:'<path d="M19 12H5m5-5-5 5 5 5"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.book}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
let state=freshState(),storageOK=true;
try { const raw=localStorage.getItem(STORAGE_KEY);if(raw)state=validateBackup(JSON.parse(raw),BASE_QUESTIONS.map(q=>q.id)); } catch {storageOK=false;}
let view='bank',query='',session=null,revealed=false,editingID=null,toastTimer;
let selectedID='',routeError='';
let companyRegion='domestic',companyTrack='all',companyQuery='';
const all=()=>[...BASE_QUESTIONS,...state.customQuestions];
const byID=id=>all().find(q=>q.id===id);
const record=id=>state.records[id]||{};
const companyName=id=>COMPANIES.find(c=>c.id===id)?.name||id;
const roleOptions=()=>[...new Set(all().flatMap(q=>q.roles))];
const companyOptions=()=>[...new Set([...COMPANIES.map(c=>c.id),...all().flatMap(q=>q.companies)])];
function normalizeFilters(){if(!companyOptions().includes(state.prefs.company))state.prefs.company='all';if(!roleOptions().includes(state.prefs.role))state.prefs.role='all';}
normalizeFilters();
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
function save(){
  if(!storageOK){toast('浏览器存储不可用或原记录损坏。请先导出本次记录备份。');return false;}
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{storageOK=false;toast('保存失败：浏览器存储不可用或已满，请导出备份。');return false;}
}
function setRecord(id,patch){state.records[id]={...record(id),...patch};return save();}
function counts(){const questions=all();return {total:questions.length,mastered:questions.filter(q=>record(q.id).level==='mastered').length,due:questions.filter(q=>isDue(record(q.id))).length,saved:questions.filter(q=>record(q.id).saved).length,done:questions.filter(q=>record(q.id).level).length};}
function updateNavigation(){const c=counts();$('#all-count').textContent=c.total;$('#review-count').textContent=c.due;$('#saved-count').textContent=c.saved;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#company-options').innerHTML=companyOptions().map(id=>`<option value="${esc(companyName(id))}">`).join('');}
const viewNames={bank:'题库广场',review:'待复习',saved:'我的收藏',companies:'目标公司',roadmap:'学习路线',career:'求职情报',community:'社区共建'};
function navigate(next){view=next;selectedID='';routeError='';session=null;revealed=false;writeLocation(routeHash(view,'',view==='bank'||view==='review'||view==='saved'?{...state.prefs,query}:{}));render();window.scrollTo(0,0);}
function render(){
  updateNavigation();$('#breadcrumb').innerHTML=`学习空间 <span class="slash">/</span> ${session?'专注练习':viewNames[view]}`;
  if(routeError){$('#main').innerHTML=`<div class="empty"><h1>${esc(routeError)}</h1><p>个人题目仅保存在创建它的浏览器中。公开题目、公司和情报可以用独立链接打开。</p><button class="button" data-action="bank">回到题库</button></div>`;return;}
  if(session){renderPractice();return;}
  if(view==='companies')selectedID?renderCompanyDetail(selectedID):renderCompanies();else if(view==='roadmap')renderRoadmap();else if(view==='career')renderCareer($('#main'),false,{id:selectedID,onChange:values=>writeLocation(routeHash('career','',values),true)});else if(view==='community')renderCommunity($('#main'));else renderBank();
  if(!storageOK)$('#main').insertAdjacentHTML('afterbegin','<p class="error" role="alert">浏览器记录未能读取或保存。当前操作暂存在内存中，请使用左下角“导出”保留数据；原存储不会被覆盖。</p>');
}
const options=(values,current,label,display=x=>x)=>`<option value="all">${label}</option>`+values.map(value=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(display(value))}</option>`).join('');
const kindLabel=q=>q.kind==='definite'?'明确结论':q.kind==='pending'?'待整理':'开放讨论';
function sourceLink(source){
  // Local paths come only from the built-in registry; imported questions cannot supply them.
  const attachment=Object.hasOwn(SOURCE_ATTACHMENTS,source.attachment)?SOURCE_ATTACHMENTS[source.attachment]:null;
  if(attachment?.localOnly)return `<span data-local-attachment="${esc(source.attachment)}">原始截图未公开分发 · 题意来源与答案依据见说明</span>`;
  if(attachment)return `<a href="${esc(attachment.url)}" target="_blank" rel="noopener noreferrer">${esc(attachment.title)} ↗</a>`;
  const url=safeURL(source.url);
  return url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">查看原文 ↗</a>`:'';
}
const symbol=q=>q.track==='VLA'?'V':q.track==='WAM'?'W':q.track==='Agentic Robotics'?'A':'⌘';
const trackClass=q=>q.track==='WAM'?'wam':q.track==='Agentic Robotics'?'agent':q.track==='基础与工程'?'base':'';
const list=()=>filterQuestions(all(),state.records,state.prefs,view,query);
function pageHead(title,description,eyebrow='YOUR EMBODIED LEARNING SPACE'){return `<div class="page-head"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div><span class="date-label">${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date())}</span></div>`;}
function renderBank(){const c=counts();const intro=view==='bank'?pageHead('把每一道题，变成你的底气。','选定目标公司与岗位，从读懂论文，到讲清自己的判断。'):pageHead(viewNames[view],view==='review'?'把还没吃透的知识，再向前推进一步。':'值得反复推敲的问题，留在这里。');
  $('#main').innerHTML=intro+(view==='bank'?`<section class="hero"><div><span class="eyebrow">FROM KNOWING TO UNDERSTANDING</span><h2>下一站，具身智能。</h2><p>VLA · Agentic Robotics · World Action Model<br>有依据的答案，有方向的思考，有积累的每一天。</p><button class="button primary" data-action="start">开始一组练习 ${icon('arrow')}</button></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="orbit"></div><div class="orbit"></div><span class="core">π</span><i class="orbit-dot"></i><span class="art-label">PERCEIVE → REASON → ACT</span></div></section><section class="stats" aria-label="学习概况">${[[c.total,'题库总量','道','book'],[c.done,'已经练习','道','check'],[c.due,'今日待复习','道','repeat'],[c.mastered,'自评已掌握','道','route']].map(([value,label,unit,i])=>`<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(i)}</span></div><div class="stat-value">${value}<span>${unit}</span></div></div>`).join('')}</section>`:'')+
  `<section><div class="section-heading"><div><h2>${view==='bank'?'为你的下一场面试做准备':view==='review'?'到期复习队列':'收藏题目'}</h2><p>${view==='review'?'不熟悉：立即复习 · 有思路：1 天后 · 已掌握：7 天后':'公司与岗位可以自由切换，筛选条件会自动保留。'}</p></div><div class="content-actions"><button class="button" data-share-current>分享筛选</button><button class="text-button" data-action="reset">重置筛选 ↻</button></div></div>
  <div class="filters"><label>目标公司<select id="filter-company">${options(companyOptions(),state.prefs.company,'全部公司',companyName)}</select></label><label>岗位方向<select id="filter-role">${options(roleOptions(),state.prefs.role,'全部岗位方向')}</select></label><label>题目来源<select id="filter-source">${options(['recollection','practice'],state.prefs.source,'全部来源',s=>s==='recollection'?'公开 / 个人面经回忆':'研究方向专项题')}</select></label><label>练习专题<select id="filter-topic">${options(TOPICS,state.prefs.topic,'全部专题')}</select></label><label class="search-filter">搜索题目<input id="search" type="search" placeholder="搜索 π₀、Flow Matching、数据…" value="${esc(query)}"></label></div>
  <div id="topic-tabs" class="tabs" aria-label="技术方向"></div><div class="list-summary"><span id="result-count"></span><select id="sort" aria-label="题目排序"><option value="recommended" ${state.prefs.sort==='recommended'?'selected':''}>推荐顺序</option><option value="unseen" ${state.prefs.sort==='unseen'?'selected':''}>未练习优先</option><option value="difficulty" ${state.prefs.sort==='difficulty'?'selected':''}>从基础到深入</option></select></div><div class="question-list" id="question-list"></div><p class="source-note">专项题按公开研究方向匹配公司，不代表公司真题或正在招聘的岗位。面经回忆保留原文或截图来源，未经公司证实。</p></section>`;
  renderRows();
  ['company','role','source','topic'].forEach(key=>$(`#filter-${key}`).addEventListener('change',e=>{state.prefs[key]=e.target.value;save();syncBankURL();renderRows();}));
  $('#search').addEventListener('input',e=>{query=e.target.value;syncBankURL();renderRows();});
  $('#sort').addEventListener('change',e=>{state.prefs.sort=e.target.value;save();syncBankURL();renderRows();});
}
function renderRows(){
  const items=list();const matching=filterQuestions(all(),state.records,{...state.prefs,track:'all'},view,query);
  $('#topic-tabs').innerHTML=['all',...TRACKS].map(t=>`<button class="tab ${state.prefs.track===t?'active':''}" data-track="${esc(t)}" aria-pressed="${state.prefs.track===t}">${t==='all'?'全部题目':t}<span class="tab-count">${t==='all'?matching.length:matching.filter(q=>q.track===t).length}</span></button>`).join('');
  $('#result-count').textContent=`共 ${items.length} 道题 · ${items.filter(q=>q.source.kind==='recollection').length} 道面经回忆`;
  $('#question-list').innerHTML=items.length?items.map(q=>`<article class="question-row"><span class="track-symbol ${trackClass(q)}" aria-hidden="true">${symbol(q)}</span><div class="question-main"><button class="question-title" data-open="${esc(q.id)}">${esc(q.title)}</button><div class="metadata"><span>${esc(q.track)}</span><span class="dot">·</span><span>${esc(q.companies.slice(0,2).map(companyName).join(' / '))}${q.companies.length>2?` 等 ${q.companies.length} 家`:''}</span><span class="tag ${q.source.kind}">${q.source.kind==='recollection'?'面经回忆':'专项题'}</span>${q.source.scope==='general'?'<span class="tag">通用大模型岗 · 非具身专属</span>':''}${q.tags.includes('预训练')?'<span class="tag">预训练</span>':''}<span><i class="status-dot ${esc(record(q.id).level||'')}"></i>${LEVELS[record(q.id).level||'new']}</span></div></div><div class="row-end"><span class="tag ${q.kind}">${kindLabel(q)}</span><span class="difficulty">${q.difficulty}</span><button class="icon-button ${record(q.id).saved?'selected':''}" data-save="${esc(q.id)}" aria-label="${record(q.id).saved?'取消收藏':'收藏'}：${esc(q.title)}" aria-pressed="${Boolean(record(q.id).saved)}">${icon('bookmark')}</button><button class="icon-button" data-open="${esc(q.id)}" aria-label="练习：${esc(q.title)}">${icon('arrow')}</button></div></article>`).join(''):`<div class="empty"><h3>${view==='review'?'当前没有到期题目':'这里还没有匹配的题目'}</h3><p>${view==='review'?'你可以去题库练习，或调整公司与方向筛选。':'试试切换公司、放宽筛选，或录入你自己的面经。'}</p><button class="button" data-action="reset">清除筛选</button><button class="button ghost" data-action="bank">回到题库</button></div>`;
}
function renderCompanies(){
  $('#main').innerHTML=pageHead('找到你想加入的那一群人。',`已收录 ${COMPANIES.length} 家团队，其中 ${COMPANIES.filter(c=>c.region==='domestic').length} 家国内公司。按公开技术方向选择，不做主观排名。`,'CHOOSE YOUR NEXT CHAPTER')+
    `<div class="company-toolbar"><div class="tabs" aria-label="公司地区">${[['domestic','国内团队'],['overseas','海外团队'],['all','全部公司']].map(([id,label])=>`<button class="tab ${companyRegion===id?'active':''}" data-company-region="${id}" aria-pressed="${companyRegion===id}">${label}<span class="tab-count">${id==='all'?COMPANIES.length:COMPANIES.filter(c=>c.region===id).length}</span></button>`).join('')}</div><div class="company-search"><label class="sr-only" for="company-search">搜索公司或模型</label><input id="company-search" type="search" value="${esc(companyQuery)}" placeholder="搜索公司、模型或技术方向…"><label class="sr-only" for="company-track">筛选技术方向</label><select id="company-track">${options(TRACKS,companyTrack,'全部技术方向')}</select></div></div><p id="company-count" class="source-note"></p><div class="company-grid" id="company-grid"></div><p class="source-note">公司研究方向根据官方页面、论文或开源仓库整理；题目匹配是备考建议。专项题不代表该公司面经，岗位分类也不是实时招聘 JD。可通过“录入面经”添加其他公司。</p>`;
  renderCompanyCards();
  $('#company-search').addEventListener('input',e=>{companyQuery=e.target.value;renderCompanyCards();});
  $('#company-track').addEventListener('change',e=>{companyTrack=e.target.value;renderCompanyCards();});
}
function renderCompanyCards(){
  const term=companyQuery.trim().toLocaleLowerCase();
  const companies=COMPANIES.filter(c=>(companyRegion==='all'||c.region===companyRegion)&&(companyTrack==='all'||c.tracks.includes(companyTrack))&&(!term||[c.name,c.en,c.focus,...c.tracks].join(' ').toLocaleLowerCase().includes(term)));
  $('#company-count').textContent=`显示 ${companies.length} 家 · 优先阅读对应团队的公开资料，再进入专项练习`;
  $('#company-grid').innerHTML=companies.length?companies.map(c=>{
    const questions=all().filter(q=>q.companies.includes(c.id)),recall=questions.filter(q=>q.source.kind==='recollection').length;
    return `<article class="company-card"><div class="company-card-top"><span class="company-logo" aria-hidden="true">${c.mark}</span><span class="tag">${c.region==='domestic'?'国内':'海外'}</span></div><h3><a href="${routeHash('companies',c.id)}">${c.name}</a></h3><span class="company-en">${c.en}</span><p>${c.focus}</p><div class="metadata">${c.tracks.map(t=>`<span class="tag">${t}</span>`).join('')}</div><p class="company-provenance">面经回忆 ${recall} 道 <span>·</span> 专项练习 ${questions.length-recall} 道</p><div class="card-bottom"><a href="${safeURL(c.url)}" target="_blank" rel="noopener noreferrer">公开技术资料 ↗</a><button class="button" data-company="${c.id}">开始练习 ${icon('arrow')}</button></div></article>`;
  }).join(''):'<div class="empty"><h3>暂时没有匹配的团队</h3><p>试试缩短搜索词，或切换地区和技术方向。</p></div>';
}
function renderRoadmap(){
  $('#main').innerHTML=pageHead('理解原理，再把它做出来。',`${ROADMAPS.length} 条学习路径。每一步都留下可以解释、复现和验证的结果。`,'READ → IMPLEMENT → EXPLAIN')+`<div class="roadmap-grid">${ROADMAPS.filter(p=>!selectedID||p.track===selectedID).map(p=>`<article class="roadmap-card"><span class="eyebrow">LEARNING PATH</span><h2><a href="${routeHash('roadmap',p.track)}">${p.track}</a></h2><p>${p.subtitle}</p>${p.steps.map(s=>`<div class="roadmap-step"><h3>${s.title}</h3><p>${s.description}</p><a href="${safeURL(s.ref.url)}" target="_blank" rel="noopener noreferrer">${s.ref.title} ↗</a></div>`).join('')}<button class="button primary" data-path="${p.track}">练习这个方向 ${icon('arrow')}</button></article>`).join('')}</div><p class="source-note">WAM 在此按 World Action Model 理解。学习路径是整理建议，不是公司官方考纲。</p>`;
}
function start(id){let items=list();if(id&&!items.some(q=>q.id===id))items=byID(id)?[byID(id)]:[];if(!items.length){toast('当前没有匹配题目，请先调整筛选。');return;}session={ids:items.map(q=>q.id),index:Math.max(0,items.findIndex(q=>q.id===id)),graded:new Set(),started:Date.now(),questionStarted:Date.now()};revealed=false;writeLocation(routeHash('question',session.ids[session.index]));render();window.scrollTo(0,0);}
const paragraphs=text=>esc(text).replace(/\n/g,'<br>');
const bulletList=(title,items,ordered=false)=>items.length?`<h3>${title}</h3><${ordered?'ol':'ul'}>${items.map(s=>`<li>${esc(s)}</li>`).join('')}</${ordered?'ol':'ul'}>`:'';
function answerHTML(q){return `<section class="answer-section" aria-label="参考答案"><h2>${q.kind==='definite'?'明确结论与适用条件':q.kind==='pending'?'这道题的答案还在整理中':'参考思路 · 没有唯一标准答案'}</h2><div class="answer-summary"><p>${paragraphs(q.answer||'先把你的理解写下来，再寻找论文或官方文档验证。此题尚无已整理的参考答案。')}</p></div>${q.formula?`<pre class="formula">${esc(q.formula)}</pre>`:''}<p class="boundary">${esc(q.caveat)}</p>${bulletList('怎样把它学会',q.steps.length?q.steps:['界定题目中的概念、输入输出与适用条件。','寻找原论文或官方文档，记录支持结论的证据。','做一个最小实验检验自己的解释。'],true)}${bulletList('容易踩的坑',q.pitfalls)}${bulletList('继续追问',q.followups)}${q.refs.length?`<h3>参考依据 <span class="save-hint">学习步骤与取舍分析由研习室整理</span></h3>${q.refs.map(r=>`<a class="reference" href="${esc(safeURL(r.url))}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗ <span>打开原文</span></a>`).join('')}`:''}<div class="answer-input"><div class="field-heading"><label for="note">我的复盘笔记</label><span class="save-hint" id="note-saved">${storageOK?'输入后自动保存':'暂存于内存'}</span></div><textarea id="note" maxlength="16000" rows="3" placeholder="我漏掉了什么？下次要怎样讲得更清楚？">${esc(record(q.id).note||'')}</textarea></div></section>`;}
function renderPractice(){
  const q=byID(session.ids[session.index]);if(!q){session=null;render();return;}
  const r=record(q.id);const n=session.ids.length,i=session.index;
  $('#main').innerHTML=`<div class="practice-top"><button class="button ghost" data-action="exit">${icon('back')} 返回${viewNames[view]}</button><div class="practice-progress"><span>${String(i+1).padStart(2,'0')} / ${String(n).padStart(2,'0')}</span><span class="progress-line"><i style="width:${Math.round((i+1)/n*100)}%"></i></span><span id="timer">00:00</span></div></div><div class="practice-layout"><article class="practice-card"><div class="meta-top"><span class="tag">${q.track}</span><span class="tag ${q.kind}">${kindLabel(q)}</span><span class="tag">${q.difficulty}</span><button class="icon-button ${r.saved?'selected':''}" data-save="${q.id}" aria-label="${r.saved?'取消收藏':'收藏'}本题" aria-pressed="${Boolean(r.saved)}">${icon('bookmark')}</button></div><h1>${esc(q.title)}</h1><p class="prompt">${esc(q.roles.join(' / '))} <span class="dot">·</span> ${esc(q.companies.map(companyName).join(' / '))}</p><div class="source-note"><strong>${esc(q.source.label)}</strong> ${sourceLink(q.source)}<br>${esc(q.source.note)}</div><div class="content-actions">${q.id.startsWith('user-')?'<span class="tag">个人题目 · 仅本机</span>':`<button class="button" data-share-route="${routeHash('question',q.id)}">复制题目链接</button>`}<button class="button" data-contribute-type="question" data-contribute-id="${esc(q.id)}">${q.id.startsWith('user-')?'贡献题目':'纠错 / 补充'}</button>${q.source.originRecordId?`<a class="button" href="${routeHash('career',q.source.originRecordId)}">返回面经出处</a>`:''}</div>${reviewedNotes('question',q.id)}<div class="answer-input"><div class="field-heading"><label for="draft">先说说你的理解</label><span class="save-hint" id="draft-saved">${storageOK?'输入后自动保存':'暂存于内存'}</span></div><textarea id="draft" maxlength="16000" rows="5" placeholder="像在面试中一样回答：先给结论，再解释原因，最后讲清边界与验证方法。">${esc(r.draft||'')}</textarea></div><div id="answer-area">${revealed?answerHTML(q):`<div class="reveal-area"><button class="button primary" data-action="reveal">${icon('book')} ${q.kind==='definite'?'查看参考答案':'查看学习思路'}</button><p>先独立思考，再对照补全；也可以直接查看。</p></div>`}</div><div class="assessment"><p>这次掌握得怎样？自评后安排下一次复习。</p><div class="assessment-buttons"><button class="button weak" data-grade="weak">还不熟悉 · 今天复习</button><button class="button learning" data-grade="learning">有思路 · 1 天后</button><button class="button mastered" data-grade="mastered">已掌握 · 7 天后</button></div><p class="save-hint" id="grade-status">${r.level?`上次自评：${LEVELS[r.level]}。`:''}${q.id.startsWith('user-')?'<button class="text-button" data-edit="'+q.id+'">编辑题目 / 补充答案</button>':''}</p></div></article><aside class="practice-side"><h3>本组练习</h3><p>当前筛选的 ${n} 道题 · 已自评 <span id="session-done">${session.graded.size}</span> 道</p><div class="queue">${session.ids.map((id,index)=>`<button data-goto="${index}" class="${i===index?'active':''}" ${i===index?'aria-current="step"':''}><span>${String(index+1).padStart(2,'0')}</span><span>${esc(byID(id)?.title||'题目不可用')}</span></button>`).join('')}</div></aside></div><div class="practice-controls"><button class="button" data-action="prev" ${i===0?'disabled':''}>${icon('back')} 上一题</button><button class="button primary" data-action="next">${i===n-1?'结束本组':'下一题'} ${icon('arrow')}</button></div>`;
  bindWriting();bindLocalAttachments();tick();
}
function bindWriting(){const id=session.ids[session.index];for(const field of ['draft','note']){const element=$(`#${field}`);if(element)element.oninput=e=>{const ok=setRecord(id,{[field]:e.target.value});$(`#${field}-saved`).textContent=ok?'已保存到本机':'仅暂存，记得导出';};}}
function go(index){if(index<0||index>=session.ids.length)return;session.index=index;session.questionStarted=Date.now();revealed=false;writeLocation(routeHash('question',session.ids[index]));renderPractice();window.scrollTo(0,0);}
function finish(){const done=session.graded.size,total=session.ids.length;session=null;writeLocation(routeHash(view,selectedID));$('#main').innerHTML=`<section class="finish-card"><div class="finish-check">✓</div><span class="eyebrow">ONE STEP FURTHER</span><h1>又向前走了一步。</h1><p>本组 ${total} 道题，已自评 ${done} 道。<br>${storageOK?'作答、笔记和掌握程度已经保存在当前浏览器。':'存储不可用，请导出备份保留本次记录。'}</p><button class="button primary" data-action="bank">回到题库</button><button class="button ghost" data-action="review">查看待复习</button></section>`;updateNavigation();window.scrollTo(0,0);}
function tick(){if(!session||!$('#timer'))return;const seconds=Math.floor((Date.now()-session.questionStarted)/1000);$('#timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
setInterval(tick,1000);
function toggleSaved(id){setRecord(id,{saved:!record(id).saved});updateNavigation();if(session){document.querySelectorAll(`[data-save="${id}"]`).forEach(button=>{button.classList.toggle('selected',record(id).saved);button.setAttribute('aria-pressed',String(Boolean(record(id).saved)));button.setAttribute('aria-label',record(id).saved?'取消收藏本题':'收藏本题');});}else renderRows();}
function openQuestionForm(id){editingID=id||null;const form=$('#question-form');form.reset();$('#form-error').textContent='';$('#dialog-title').textContent=id?'编辑这道题':'录入个人题目';if(id){const q=byID(id);const data={company:companyName(q.companies[0]),role:q.roles[0],track:q.track,topic:q.tags.includes('预训练')?'预训练':'all',title:q.title,sourceUrl:q.source.url||'',sourceKind:q.source.kind,kind:q.kind,difficulty:q.difficulty,answer:q.answer,steps:q.steps.join('\n'),referenceUrl:q.refs[0]?.url||''};for(const [key,value] of Object.entries(data))form.elements[key].value=value;}else if(state.prefs.company!=='all')form.elements.company.value=companyName(state.prefs.company);$('#question-dialog').showModal();}
$('#question-form').addEventListener('submit',e=>{
  e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));
  try{
    for(const field of ['sourceUrl','referenceUrl'])if(values[field]&&!safeURL(values[field]))throw new Error('链接只支持 http 或 https。');
    if(!values.answer.trim()&&values.kind==='definite')throw new Error('“明确结论”需要填写参考答案；也可以选择“暂未整理”。');
    const company=COMPANIES.find(c=>[c.id,c.name,c.en].some(s=>s.toLowerCase()===values.company.trim().toLowerCase()))?.id||values.company.trim();
    const q=validateCustom({id:editingID||`user-${crypto.randomUUID()}`,title:values.title,track:values.track,companies:[company],roles:[values.role.trim()],kind:values.kind,difficulty:values.difficulty,tags:[...new Set([...(editingID?byID(editingID).tags.filter(tag=>!TOPICS.includes(tag)):[]),'个人题库',...(TOPICS.includes(values.topic)?[values.topic]:[])])],answer:values.answer,caveat:'个人录入的参考内容，请结合原文与实验核验。',steps:values.steps.split('\n').map(s=>s.trim()).filter(Boolean),pitfalls:[],followups:[],refs:values.referenceUrl?[{title:'个人补充的答案依据',url:values.referenceUrl}]:[],source:{kind:values.sourceKind,label:'个人录入 · '+(values.sourceKind==='recollection'?'面经回忆':'专项练习'),url:values.sourceUrl,note:values.sourceKind==='recollection'?'个人录入的面经回忆，未经公司证实。':'个人整理的专项练习，不代表公司真题。'}});
    if(editingID)state.customQuestions=state.customQuestions.map(item=>item.id===editingID?q:item);else state.customQuestions.push(q);
    const editing=Boolean(editingID);const ok=save();$('#question-dialog').close();if(!editing){routeError='';selectedID='';state.prefs.company=company;state.prefs.role='all';state.prefs.track='all';state.prefs.source='all';state.prefs.topic=TOPICS.includes(values.topic)?values.topic:'all';query='';view='bank';session=null;save();}writeLocation(routeHash(session?'question':view,session?session.ids[session.index]:'',session?{}:{...state.prefs,query}));render();toast(ok?(editing?'题目已更新':'题目已加入你的个人题库'):'题目暂存于内存，请导出备份。');
  }catch(error){$('#form-error').textContent=error.message;}
});
function exportBackup(){const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`embodied-prep-${new Date().toISOString().slice(0,10)}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出，包含自定义题目、笔记与学习记录。');}
$('#backup-file').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{
    if(file.size>8*1024*1024)throw new Error('备份文件超过 8 MB，请分批整理。');
    const incoming=validateBackup(JSON.parse(await file.text()),BASE_QUESTIONS.map(q=>q.id));
    const before=state.customQuestions.length;state=mergeBackup(state,incoming);normalizeFilters();const ok=save();render();toast(`已合并 ${state.customQuestions.length-before} 道新题，保留本机已有记录。${ok?'':'请重新导出以保留结果。'}`);
  }catch(error){toast(`导入失败：${error.message}。原数据未更改。`);}finally{e.target.value='';}
});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-share-current')){copyPageLink(currentShareHash());return;}
  if(b.dataset.shareRoute){copyPageLink(b.dataset.shareRoute);return;}
  if(b.dataset.contributeType){contributeFor(b.dataset.contributeType,b.dataset.contributeId);return;}
  if(b.dataset.practiceRecord){practiceCareer(b.dataset.practiceRecord,b.dataset.practiceIndex);return;}
  if(b.dataset.view){navigate(b.dataset.view);return;}
  if(b.dataset.track){state.prefs.track=b.dataset.track;save();syncBankURL();renderRows();return;}
  if(b.dataset.open){start(b.dataset.open);return;}
  if(b.dataset.save){toggleSaved(b.dataset.save);return;}
  if(b.dataset.company){state.prefs={...freshState().prefs,company:b.dataset.company};query='';save();navigate('bank');return;}
  if(b.dataset.companyRegion){companyRegion=b.dataset.companyRegion;renderCompanies();return;}
  if(b.dataset.path){state.prefs={...freshState().prefs,...(TOPICS.includes(b.dataset.path)?{topic:b.dataset.path}:{track:b.dataset.path})};query='';save();navigate('bank');return;}
  if(b.dataset.goto!==undefined){go(Number(b.dataset.goto));return;}
  if(b.dataset.edit){openQuestionForm(b.dataset.edit);return;}
  if(b.dataset.grade){const id=session.ids[session.index];const ok=setRecord(id,assess(record(id),b.dataset.grade));session.graded.add(id);$('#grade-status').textContent=`本次自评：${LEVELS[b.dataset.grade]}。${ok?'已保存并安排复习。':'仅暂存，请导出备份。'}`;if($('#session-done'))$('#session-done').textContent=session.graded.size;updateNavigation();toast('已记录，准备好后进入下一题。');return;}
  switch(b.dataset.action){
    case 'start':start();break;
    case 'reset':state.prefs=freshState().prefs;query='';save();syncBankURL();render();break;
    case 'bank':navigate('bank');break;
    case 'review':state.prefs=freshState().prefs;query='';save();navigate('review');break;
    case 'exit':session=null;writeLocation(routeHash(view,selectedID,view==='bank'?{...state.prefs,query}:{}));render();break;
    case 'reveal':revealed=true;$('#answer-area').innerHTML=answerHTML(byID(session.ids[session.index]));bindWriting();break;
    case 'prev':go(session.index-1);break;
    case 'next':session.index===session.ids.length-1?finish():go(session.index+1);break;
  }
});
$('.brand').addEventListener('click',e=>{e.preventDefault();navigate('bank');});
$('#add-question').addEventListener('click',()=>openQuestionForm());
$('#close-dialog').addEventListener('click',()=>$('#question-dialog').close());
$('#cancel-dialog').addEventListener('click',()=>$('#question-dialog').close());
$('#backup').addEventListener('click',exportBackup);
$('#restore').addEventListener('click',()=>$('#backup-file').click());
setupCommunity(toast);
window.addEventListener('hashchange',applyRoute);
applyRoute();

function writeLocation(hash,replace=false){if(location.hash!==hash)history[replace?'replaceState':'pushState'](null,'',hash);}
function syncBankURL(){if(!session&&['bank','review','saved'].includes(view))writeLocation(routeHash(view,'',{...state.prefs,query}),true);}
function currentShareHash(){return view==='career'?routeHash(view,selectedID,selectedID?{}:careerFilters()):session?routeHash('question',session.ids[session.index]):routeHash(view,selectedID,['bank','review','saved'].includes(view)?{...state.prefs,query}:{});}
function applyRoute(){
  if(!location.hash)writeLocation(routeHash('bank','',state.prefs),true);
  const route=readRoute(location.hash);routeError='';selectedID=route.id||'';session=null;revealed=false;
  if(route.view==='question'){
    view='bank';const q=byID(route.id);
    if(q)session={ids:[q.id],index:0,graded:new Set(),started:Date.now(),questionStarted:Date.now()};
    else routeError='未找到这道题';
  }else if(route.view==='missing'){view='bank';routeError='这个链接暂时无法打开';}
  else {view=route.view;
    if(['bank','review','saved'].includes(view)){
      const p=route.params||{};state.prefs={...freshState().prefs,...Object.fromEntries(Object.keys(freshState().prefs).filter(k=>typeof p[k]==='string').map(k=>[k,p[k]]))};
      if(!['all',...TRACKS].includes(state.prefs.track))state.prefs.track='all';
      if(!['all',...TOPICS].includes(state.prefs.topic))state.prefs.topic='all';
      if(!['all','practice','recollection'].includes(state.prefs.source))state.prefs.source='all';
      query=(p.query||'').slice(0,2000);normalizeFilters();
    }
    if(view==='career')setCareerFilters(route.params);
    if(view==='roadmap'&&selectedID&&!ROADMAPS.some(p=>p.track===selectedID))routeError='未找到这条学习路线';
  }
  render();window.scrollTo(0,0);
}
async function copyPageLink(hash){
  const url=shareURL(location.href,hash);
  const hint=['localhost','127.0.0.1','[::1]'].includes(location.hostname)?'当前是本机地址；公开部署后可供其他人访问。':'可以分享给其他求职者。';
  try{await navigator.clipboard.writeText(url);toast('链接已复制。'+hint);}
  catch{
    let dialog=$('#share-dialog');
    if(!dialog){document.body.insertAdjacentHTML('beforeend','<dialog id="share-dialog" aria-labelledby="share-title"><h2 id="share-title">复制内容链接</h2><label for="share-url">链接</label><input id="share-url" class="share-field" readonly><p id="share-hint" class="muted"></p><form method="dialog"><button class="button">关闭</button></form></dialog>');dialog=$('#share-dialog');}
    $('#share-url').value=url;$('#share-hint').textContent=hint;dialog.showModal();$('#share-url').select();
  }
}
function practiceCareer(id,index){
  try{
    const record=careerRecord(id);if(!record)throw new Error('请先打开这条面经。');
    const indexes=index==='all'?record.questions.map((_,i)=>i):[Number(index)];
    const result=addCareerQuestions(state.customQuestions,record,indexes,COMPANIES);
    state.customQuestions=result.questions;const ok=save();view='career';selectedID=id;
    session={ids:result.ids,index:0,graded:new Set(),started:Date.now(),questionStarted:Date.now()};revealed=false;
    writeLocation(routeHash('question',result.ids[0]));render();window.scrollTo(0,0);
    toast(`${result.added?`已加入 ${result.added} 道新题`:'已打开个人题库中的题目'}，已有答案和笔记保留。${ok?'':'请导出个人备份保留本次内容。'}`);
  }catch(error){toast(error.message);}
}
function contributeFor(type,id){
  if(type==='question'){
    const q=byID(id);if(!q)return;
    if(q.id.startsWith('user-'))openContribution({type:'general',id:'',title:''},'question',{title:q.title,body:q.answer||q.source.note,company:q.companies.map(companyName).join(' / '),role:q.roles.join(' / '),track:q.track,sourceUrl:q.source.url});
    else openContribution({type,id,title:q.title},'correction',{sourceUrl:q.refs[0]?.url||q.source.url||''});
  }else if(type==='career'){const r=careerRecord(id);if(r)openContribution({type,id,title:r.title},'correction',{company:r.company,role:r.role,sourceUrl:r.source.url,experienceDate:r.experienceDate});}
  else {const c=COMPANIES.find(c=>c.id===id);if(c)openContribution({type:'companies',id,title:c.name},'source',{company:c.name,sourceUrl:c.url});}
}
function renderCompanyDetail(id){
  const c=COMPANIES.find(c=>c.id===id);
  if(!c){$('#main').innerHTML='<div class="empty"><h2>未找到这家公司</h2><a href="#/companies">返回公司列表</a></div>';return;}
  const questions=all().filter(q=>q.companies.includes(c.id));
  $('#main').innerHTML=`<div class="record-detail"><a href="#/companies" class="button ghost">← 全部公司</a><section class="company-detail-intro"><span class="eyebrow">TEAM & PREPARATION</span><h1>${esc(c.name)}</h1><p>${esc(c.en)}</p><p>${esc(c.focus)}</p><div class="metadata">${c.tracks.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div><div class="content-actions"><a class="button" href="${esc(safeURL(c.url))}" target="_blank" rel="noopener noreferrer">公开技术资料 ↗</a><button class="button" data-share-route="${routeHash('companies',id)}">复制公司链接</button><button class="button" data-contribute-type="companies" data-contribute-id="${esc(id)}">补充团队 / 岗位信息</button><a class="button" href="${routeHash('career','',{query:c.name})}">查找相关面经与薪资</a></div><p class="source-note">公司技术画像核对于 2026-11-05。招聘状态未逐岗核验，请以官方岗位页为准。</p></section>${reviewedNotes('companies',id)}<div class="section-heading" style="margin-top:26px"><h2>相关备考题 · ${questions.length} 道</h2><button class="button primary" data-company="${esc(id)}">进入公司题库</button></div><div class="question-list">${questions.map(q=>`<article class="question-row"><div class="question-main"><a class="question-title" href="${routeHash('question',q.id)}">${esc(q.title)}</a><div class="metadata"><span class="tag">${q.source.kind==='recollection'?'面经回忆':'专项练习'}</span><span>${esc(q.track)}</span></div></div></article>`).join('')}</div></div>`;
}

async function bindLocalAttachments(){
  if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
  for(const element of document.querySelectorAll('[data-local-attachment]')){
    const attachment=SOURCE_ATTACHMENTS[element.dataset.localAttachment];
    try{const response=await fetch(attachment.url,{method:'HEAD'});if(response.ok&&element.isConnected){const a=document.createElement('a');a.href=attachment.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=attachment.title+'（本机文件） ↗';element.replaceWith(a);}}catch{}
  }
}
