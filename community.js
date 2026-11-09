import {escapeHTML as esc,safeURL,TRACKS} from './core.js';
import {CONTRIBUTION_KEY,CONTRIBUTION_TYPES,validateContribution,contributionMarkdown,issueURL,repositoryURL,validateCommunity} from './community-core.js';
import {COMMUNITY_CONFIG} from './community-config.js';
import {COMMUNITY_DATA} from './community-data.js';
import {routeHash} from './routes.js';

export const community=validateCommunity(COMMUNITY_DATA);
let drafts=[],storageOK=true,active=null,toast=()=>{};
const repo=repositoryURL(COMMUNITY_CONFIG.repositoryUrl);
export function downloadJSON(value,name) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function saveDraft(p) {
  if(!storageOK)throw new Error('贡献草稿存储不可用，请先导出当前投稿文件。');
  const next=[p,...drafts.filter(d=>d.id!==p.id)].slice(0,100);
  localStorage.setItem(CONTRIBUTION_KEY,JSON.stringify(next)); drafts=next;
}
export function setupCommunity(notify) {
  toast=notify;
  try {const raw=localStorage.getItem(CONTRIBUTION_KEY);if(raw){const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.length>100)throw new Error();drafts=parsed.map(validateContribution);}} catch {storageOK=false;}
  document.body.insertAdjacentHTML('beforeend',`<dialog id="contribution-dialog" aria-labelledby="contribution-title"><div class="dialog-head"><div><span class="eyebrow">CONTRIBUTE ONE SMALL THING</span><h2 id="contribution-title">贡献一条信息</h2></div><button type="button" class="icon-button" data-close-contribution aria-label="关闭投稿">✕</button></div><p class="muted">先预览，再选择导出或前往仓库提交。你的作答、复盘笔记和学习记录不会包含在投稿中。</p><form id="contribution-form"><input type="hidden" name="id"><input type="hidden" name="createdAt"><input type="hidden" name="targetType"><input type="hidden" name="targetId"><input type="hidden" name="targetTitle"><p id="contribution-target" class="source-note"></p><label>贡献类型<select name="type">${Object.entries(CONTRIBUTION_TYPES).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label><label>标题 / 题目<input name="title" required maxlength="300" placeholder="一句话说明你补充或更正的内容"></label><label>内容<textarea name="body" required rows="5" maxlength="12000" placeholder="补充题意、指出哪句话需要修改，或说明岗位状态的核实依据。未知的信息可以留空。"></textarea></label><label>公开依据链接（选填）<input name="sourceUrl" type="url" maxlength="2000" placeholder="原帖、论文、代码或官方岗位页"></label><div class="form-grid"><label>公司（选填）<input name="company" maxlength="80"></label><label>岗位（选填）<input name="role" maxlength="100"></label></div><div class="form-grid"><label>方向<select name="track">${TRACKS.map(t=>`<option>${t}</option>`).join('')}</select></label><label>经历时间（选填）<input name="experienceDate" maxlength="100" placeholder="例如 2026-10；不确定可留空"></label></div><label>公开署名（选填）<input name="displayName" maxlength="80" placeholder="留空则内容不署名；GitHub 提交仍显示账号"></label><label class="consent"><input type="checkbox" name="consent" required>我已检查以上内容可公开分享，并已去除个人联系方式和保密信息。</label><p id="contribution-error" class="error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" data-close-contribution>取消</button><button class="button primary" type="submit">预览贡献内容</button></div></form><section id="contribution-preview" hidden></section></dialog>`);
  document.querySelectorAll('[data-close-contribution]').forEach(b=>b.onclick=()=>document.querySelector('#contribution-dialog').close());
  document.querySelector('#contribution-form').onsubmit=e=>{
    e.preventDefault(); const v=Object.fromEntries(new FormData(e.currentTarget));
    try {active=validateContribution({schemaVersion:1,id:v.id,createdAt:v.createdAt,type:v.type,target:{type:v.targetType,id:v.targetId,title:v.targetTitle},content:v,displayName:v.displayName,consent:v.consent==='on'});showPreview();}
    catch(error){document.querySelector('#contribution-error').textContent=error.message;}
  };
}
export function openContribution(target={type:'general',id:'',title:''},type='correction',prefill={},existing=null) {
  const form=document.querySelector('#contribution-form');form.reset();
  const p=existing||{id:'contrib-'+crypto.randomUUID(),createdAt:new Date().toISOString(),type,target,content:prefill,displayName:''};
  const values={...p.content,id:p.id,createdAt:p.createdAt,type:p.type,targetType:p.target.type,targetId:p.target.id,targetTitle:p.target.title,displayName:p.displayName};
  for(const [key,value] of Object.entries(values))if(form.elements[key])form.elements[key].value=value;
  form.elements.consent.checked=existing?.consent===true;
  document.querySelector('#contribution-target').textContent=p.target.title?'关联：'+p.target.title:'提交新的社区内容';
  document.querySelector('#contribution-error').textContent='';
  document.querySelector('#contribution-preview').hidden=true;form.hidden=false;
  document.querySelector('#contribution-dialog').showModal();
}
function showPreview() {
  const root=document.querySelector('#contribution-preview'); document.querySelector('#contribution-form').hidden=true;root.hidden=false;
  const url=issueURL(repo,active);
  root.innerHTML=`<span class="tag">${esc(CONTRIBUTION_TYPES[active.type])}</span><h3>${esc(active.content.title)}</h3><p class="contribution-body">${esc(active.content.body)}</p>${active.content.sourceUrl?`<a href="${esc(active.content.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看依据 ↗</a>`:''}<p class="muted">${esc(active.content.company||'公司未披露')} · ${esc(active.content.role||'岗位未披露')} · 经历：${esc(active.content.experienceDate||'未披露')}<br>署名：${esc(active.displayName||'不署名')}</p><div class="notice">${repo?'前往 GitHub 后还需由你提交 Issue。仓库中的投稿将公开显示，提交后由维护者审阅。':'社区接收仓库正在准备中。现在可以保存草稿或导出投稿文件，尚未发送给维护者。'}</div><details><summary>检查完整投稿文件</summary><pre class="contribution-json">${esc(JSON.stringify(active,null,2))}</pre></details><div class="dialog-actions contribution-actions"><button class="button" id="contribution-edit">返回修改</button><button class="button" id="contribution-save">保存草稿</button><button class="button primary" id="contribution-export">导出投稿</button>${url?`<a class="button primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">前往 GitHub 提交 ↗</a>`:''}</div><p class="save-hint">导出文件只包含上方预览的信息。长内容请在 GitHub 的投稿表单中附上此文件。</p>`;
  document.querySelector('#contribution-edit').onclick=()=>{root.hidden=true;document.querySelector('#contribution-form').hidden=false;};
  document.querySelector('#contribution-save').onclick=()=>{try{saveDraft(active);toast('草稿已保存在本机，尚未提交社区。');if(document.querySelector('#community-drafts'))renderCommunity(document.querySelector('#main'));}catch(error){toast(error.message);}};
  document.querySelector('#contribution-export').onclick=()=>{downloadJSON(active,active.id+'.json');toast('投稿文件已导出，请通过仓库或交给维护者提交。');};
}
export function reviewedNotes(type,id) {
  const reviews=community.reviews.filter(r=>r.status==='accepted'&&r.target.type===type&&r.target.id===id);
  return reviews.length?`<section class="reviewed-notes"><h3>社区审阅补充</h3>${reviews.map(r=>`<p class="contribution-body">${esc(r.note)}</p><small>${esc(r.reviewer)} · ${esc(r.reviewedAt.slice(0,10))}${r.sourceUrl?` · <a href="${esc(safeURL(r.sourceUrl))}" target="_blank" rel="noopener noreferrer">依据 ↗</a>`:''}</small>`).join('')}</section>`:'';
}
export function renderCommunity(root) {
  root.innerHTML=`<section class="page-head"><div><span class="eyebrow">BUILT TOGETHER</span><h1>让下一位求职者，少走一点弯路。</h1><p>补一条题，修正一句答案，确认一个岗位状态。</p></div></section><section class="community-intro"><div><span class="tag">社区共建 · 第一阶段</span><h2>从一条有依据的补充开始</h2><p>你可以只分享问题，也可以参与核对与修订。来源读取、答案审阅和岗位有效性分别记录。</p><button class="button primary" id="community-new">贡献一条信息</button> <button class="button" id="community-correct">反馈内容问题</button></div><ol class="community-steps"><li><b>01</b><span>准备内容<small>选择条目，补充来源</small></span></li><li><b>02</b><span>预览并提交<small>检查公开内容，提交仓库</small></span></li><li><b>03</b><span>审阅与修订<small>维护者核验，记录修改依据</small></span></li></ol></section><div class="notice">${repo?`社区仓库：<a href="${esc(repo)}" target="_blank" rel="noopener noreferrer">${esc(repo.replace('https://github.com/',''))} ↗</a>。投稿需在 GitHub 完成提交。`:'当前可保存贡献草稿、导出投稿文件；公开接收仓库尚未配置。草稿不会自动发送。'}${storageOK?'':' 本机草稿读取失败，原数据保留；请使用导出投稿。'}</div><div class="community-columns"><section><div class="section-heading"><h2>我的贡献草稿</h2><span class="muted">仅此浏览器 · ${drafts.length} 条</span></div><div id="community-drafts">${drafts.length?drafts.map(p=>`<article class="contribution-card"><span class="tag">未提交 · ${esc(CONTRIBUTION_TYPES[p.type])}</span><h3>${esc(p.content.title)}</h3><p>${esc(p.target.title||'新内容')}</p><button class="button small" data-contribution-draft="${esc(p.id)}">继续编辑</button></article>`).join(''):'<div class="empty"><h3>从一处小补充开始</h3><p>在题目、公司或情报详情中点击“纠错 / 补充”，会自动带上关联条目。</p></div>'}</div></section><section><h2>最近审阅记录</h2>${community.reviews.length?community.reviews.slice(-10).reverse().map(r=>`<article class="contribution-card"><span class="tag">${{accepted:'已采纳',rejected:'未采纳','needs-info':'待补充'}[r.status]}</span><h3>${esc(r.title)}</h3><p class="contribution-body">${esc(r.note)}</p><small>${esc(r.reviewer)} · ${esc(r.reviewedAt.slice(0,10))}</small>${r.target.id?`<p><a href="${routeHash(r.target.type,r.target.id)}">查看关联条目 →</a></p>`:''}</article>`).join(''):'<div class="empty"><h3>等待第一份贡献</h3><p>经维护者审阅后，公开的修订说明会出现在这里。</p></div>'}<p class="source-note">个人题库、作答和复盘笔记保存在你的浏览器中。贡献草稿独立保存，不会自动包含在个人备份里。<br><a href="./CONTRIBUTING.md" target="_blank">阅读贡献与审阅说明 ↗</a></p></section></div>`;
  root.querySelector('#community-new').onclick=()=>openContribution({type:'general',id:'',title:''},'question');
  root.querySelector('#community-correct').onclick=()=>openContribution();
  root.querySelectorAll('[data-contribution-draft]').forEach(b=>b.onclick=()=>openContribution(undefined,undefined,undefined,drafts.find(d=>d.id===b.dataset.contributionDraft)));
}
