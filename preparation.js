import {escapeHTML as esc, TRACKS, LEVELS} from './core.js';
import {DAILY_SIZES, defaultGoal, planOverview, recommendationReason, sessionGroups} from './preparation-core.js';
import {routeHash} from './routes.js';

const date = time => new Intl.DateTimeFormat('zh-CN', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(time);
const options = (values, selected, allLabel, label = v => v) => `<option value="all">${allLabel}</option>` + values.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(label(v))}</option>`).join('');
export function resumeBanner(active) {
  return active ? `<section class="resume-banner" aria-label="未完成练习"><div><strong>接着上次的进度</strong><p>本组 ${active.ids.length} 题 · 已自评 ${Object.keys(active.grades).length} 题 · 上次停在第 ${active.index+1} 题</p></div><button class="button primary" data-resume-practice>继续练习 →</button></section>` : '';
}

export function renderPreparation(root, {questions, records, preparation, companies, onGoal, onStart, onReport, onBackup}) {
  const goal = preparation.goal || defaultGoal();
  const overview = planOverview(questions, records, goal);
  const companyName = id => companies.find(c => c.id === id)?.name || id;
  const companyIDs = [...new Set([...companies.map(c=>c.id), ...questions.flatMap(q=>q.companies), ...(goal.company !== 'all' ? [goal.company] : [])])];
  const roles = [...new Set([...questions.flatMap(q=>q.roles), ...(goal.role !== 'all' ? [goal.role] : [])])];
  const percent = Math.min(100, Math.round(overview.doneToday/goal.dailySize*100));
  root.innerHTML = `<div class="page-head"><div><span class="eyebrow">ONE INTERVIEW, ONE STEP AT A TIME</span><h1>今天，向目标再近一步。</h1><p>选定备考范围，把每天的练习控制在能完成的数量。</p></div><button class="button" id="plan-backup">导出个人备份</button></div>${resumeBanner(preparation.active)}
    <section class="plan-goal"><div class="section-heading"><div><h2>${preparation.goal ? '我的备考目标' : '先定一个小目标'}</h2><p>可随时调整；公司与岗位用于匹配练习内容。</p></div><span class="tag">仅保存在本机</span></div>
      <form id="plan-form"><div class="plan-fields"><label>目标公司<select name="company">${options(companyIDs,goal.company,'暂不限定公司',companyName)}</select></label><label>目标岗位<select name="role">${options(roles,goal.role,'暂不限定岗位')}</select></label><label>技术方向<select name="track">${options(TRACKS,goal.track,'全部技术方向')}</select></label><label>每天练几题<select name="dailySize">${DAILY_SIZES.map(n=>`<option value="${n}" ${n===goal.dailySize?'selected':''}>${n} 题 / 天</option>`).join('')}</select></label></div><div class="plan-form-footer"><p>调整目标后重新计算匹配范围，已有作答与复习记录会保留。</p><button type="submit" class="button primary">保存目标并更新计划</button></div></form></section>
    <div class="plan-columns"><section class="plan-today"><span class="eyebrow">TODAY'S PRACTICE</span><div class="plan-today-heading"><h2>今日练习</h2><span id="plan-today-count"><b>${overview.doneToday}</b> / ${goal.dailySize} 题</span></div><progress value="${Math.min(overview.doneToday,goal.dailySize)}" max="${goal.dailySize}" aria-label="今日目标完成 ${percent}%"></progress><p class="muted">按本机日期计算，在当前目标范围内自评一次算完成一题。</p>
      ${overview.queue.length ? `<ol class="plan-queue">${overview.queue.map(q=>`<li><span class="plan-reason">${esc(recommendationReason(records[q.id]))}</span><a href="${routeHash('question',q.id)}">${esc(q.title)}</a><small>${esc(q.track)} · ${esc(q.difficulty)}</small></li>`).join('')}</ol><button class="button primary plan-start" id="plan-start">开始今日 ${overview.queue.length} 题 →</button>` : `<div class="plan-empty"><h3>${!overview.matched.length?'这个目标暂时没有匹配题目':overview.doneToday>=goal.dailySize?'今天的目标已完成':'当前没有需要安排的题目'}</h3><p>${!overview.matched.length?'试着放宽公司、岗位或方向，也可以录入自己的面经。':overview.doneToday>=goal.dailySize?'今天自评过的题目不会重复填入计划。还想练习，可进入题库自由选择。':'已掌握且未到复习时间的题目暂不重复安排。你仍可以去题库自由练习。'}</p><button class="button" data-view="bank">去题库看看</button></div>`}
      <p class="source-note">排序依据：到期复习 → 薄弱题 → 未练习题 → 有思路的题。同类优先基础题；今天已自评的题不重复计入每日目标。</p></section>
    <aside class="plan-progress"><h2>目标范围内的进度</h2><div class="plan-metrics">${[[overview.matched.length,'匹配题目'],[overview.due,'到期复习'],[overview.weak,'待巩固'],[overview.unseen,'未自评']].map(([n,label])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('')}</div><h3>各方向自评情况</h3>${TRACKS.map(track=>{const qs=overview.matched.filter(q=>q.track===track);if(!qs.length)return '';const done=qs.filter(q=>records[q.id]?.level==='mastered').length;const weak=qs.filter(q=>records[q.id]?.level==='weak').length;return `<div class="plan-track"><div><strong>${esc(track)}</strong><span>自评掌握 ${done} / ${qs.length}</span></div><progress value="${done}" max="${qs.length}" aria-label="${esc(track)} 自评掌握 ${done} / ${qs.length}"></progress><small>${weak} 题待巩固</small></div>`;}).join('')}<p class="source-note">统计来自个人自评，不是自动评分或面试通过率。专项题的公司关联是备考建议，不代表该公司真实问过。</p></aside></div>
    <section class="plan-history"><div class="section-heading"><div><h2>最近练习</h2><p>保留最近 30 组；切换新练习时，上组进度会放在这里。</p></div></div>${preparation.history.length?`<div class="plan-history-list">${preparation.history.map(s=>`<article><div><strong>${s.reason==='switched'?'中途切换的练习':'本组复盘'} · ${s.ids.length} 题</strong><p>${date(s.finishedAt)} · 已自评 ${Object.keys(s.grades).length} 题 · 未自评 ${sessionGroups(s).skipped.length} 题</p></div><button class="button" data-plan-report="${esc(s.id)}">查看回顾</button></article>`).join('')}</div>`:'<div class="plan-empty"><h3>完成第一组，就能看到自己的薄弱点</h3><p>回顾会保留每题当时的自评，并提供继续未自评题目的入口。</p></div>'}</section>`;
  root.querySelector('#plan-form').onsubmit = event => {event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));onGoal({...values,dailySize:Number(values.dailySize)});};
  const start=root.querySelector('#plan-start');if(start)start.onclick=()=>onStart(overview.queue.map(q=>q.id));
  root.querySelectorAll('[data-plan-report]').forEach(b=>b.onclick=()=>onReport(b.dataset.planReport));
  root.querySelector('#plan-backup').onclick=onBackup;
}

export function renderPracticeReport(root, report, questions, {onRetry, storageOK}) {
  const groups=sessionGroups(report), byID=id=>questions.find(q=>q.id===id);
  root.innerHTML=`<section class="practice-report"><span class="eyebrow">REFLECT, THEN MOVE FORWARD</span><h1>这一组，哪里更清楚了？</h1><p>共 ${report.ids.length} 题 · 已自评 ${Object.keys(report.grades).length} 题 · ${groups.skipped.length} 题未自评</p><div class="report-summary">${[['weak','待巩固'],['learning','有思路'],['mastered','已掌握'],['skipped','未自评']].map(([key,label])=>`<div><strong>${groups[key].length}</strong><span>${label}</span></div>`).join('')}</div><p class="source-note">以下为这组练习结束时的自评快照，不是系统评分。${storageOK?'作答和复盘笔记已保存在本机。':'记录仅暂存在内存，请导出个人备份。'}</p><div class="content-actions">${groups.skipped.length?'<button class="button primary" id="report-unfinished">继续未自评的题</button>':''}${groups.weak.length?'<button class="button" id="report-weak">再练待巩固的题</button>':''}<button class="button" data-view="plan">返回备考计划</button><button class="button ghost" data-action="bank">回到题库</button></div><ol class="report-questions">${report.ids.map(id=>`<li><a href="${routeHash('question',id)}">${esc(byID(id)?.title||'题目已移除')}</a><span class="tag ${esc(report.grades[id]||'pending')}">${esc(LEVELS[report.grades[id]]||'未自评')}</span></li>`).join('')}</ol></section>`;
  const unfinished=root.querySelector('#report-unfinished'),weak=root.querySelector('#report-weak');
  if(unfinished)unfinished.onclick=()=>onRetry(groups.skipped);
  if(weak)weak.onclick=()=>onRetry(groups.weak);
}
