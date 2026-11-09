import {escapeHTML as esc,safeURL,LEVELS} from './core.js';
import {JOB_SKILLS,JOB_TEXT_LIMIT,extractRequirements,skillLabel,inferCompanies,rankJobQuestions} from './job-match-core.js';
import {jobCandidates} from './job-candidates.js';
import {readScreenshot,validateScreenshot} from './job-ocr.js';
import {routeHash} from './routes.js';

let editor={key:null,text:'',company:'auto'};
export function renderJobMatch(root,{questions,records,companies,profile:storedProfile,dailySize=5,loadCareer,onProfile,onStart,recognize=readScreenshot}) {
  const key=storedProfile?JSON.stringify(storedProfile):'';
  if(editor.key!==key)editor={key,text:storedProfile?.text||'',company:storedProfile?.company||'auto'};
  let profile=storedProfile,disposed=false,controller=null,previewURL='',pendingText='',candidates=jobCandidates(questions,[],companies),mode='recollection',hideMastered=false,limit=25,selected=new Set(),selectionTouched=false,ranking=null;
  const validCompanies=new Set(['all',...companies.map(c=>c.id)]);
  if(editor.company!=='auto'&&!validCompanies.has(editor.company))editor.company='all';
  if(profile&&!validCompanies.has(profile.company))profile={...profile,company:'all'};
  const companyName=id=>companies.find(c=>c.id===id)?.name||id;
  root.innerHTML=`<div class="page-head"><div><span class="eyebrow">PREPARE FOR YOUR NEXT ROLE</span><h1>把岗位要求，变成刷题顺序。</h1><p>上传招聘截图，校对识别文字，再从最相关的面经开始。</p></div><span class="tag">截图在本机识别</span></div>
    <div class="job-workspace"><section class="job-input"><div class="section-heading"><h2><span class="job-step">1</span> 导入岗位要求</h2><button class="text-button" id="job-clear">清除岗位内容</button></div>
    <div id="job-drop" class="job-drop" tabindex="0" role="button" aria-label="选择岗位截图，也可拖入或粘贴图片"><span class="job-upload-mark" aria-hidden="true">↥</span><strong>点击选择或拖入招聘截图</strong><span>支持 PNG / JPG / WebP，每张不超过 8 MB<br>也可以在此页面粘贴截图</span></div><input id="job-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>
    <div id="job-image" class="job-image" hidden></div><div id="job-ocr-progress" role="status" aria-live="polite" hidden><span></span><progress max="1" value="0" aria-label="截图识别进度"></progress><button type="button" class="text-button" id="job-cancel">取消识别</button></div><p id="job-file-status" class="source-note" role="status"></p><p id="job-error" class="error" role="alert"></p><div id="job-pending" class="job-pending" hidden></div>
    <form id="job-form"><label for="job-text">岗位职责与任职要求<span>识别后请校对，也可直接粘贴文字</span></label><textarea id="job-text" name="text" rows="11" maxlength="${JOB_TEXT_LIMIT}" placeholder="例如：负责 VLA 模型研发，熟悉 Flow Matching、模仿学习与强化学习，有真机部署和数据采集经验…">${esc(editor.text)}</textarea><div class="job-text-footer"><span id="job-length">${editor.text.length} / ${JOB_TEXT_LIMIT}</span><span>原始图片不会保存到个人备份</span></div><label for="job-company">目标公司<span>技能相关性相同时，优先该公司的面经</span></label><select id="job-company"><option value="auto">从文字中识别公司</option><option value="all">不限公司，按技能匹配</option>${companies.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><button class="button primary job-analyze" id="job-analyze" type="submit">确认文字，匹配面经 →</button></form><p class="source-note">匹配后，校对文字和技能选择仅保存在当前浏览器，并包含在个人备份中；不会进入社区投稿。</p></section>
    <section class="job-analysis" aria-label="岗位识别结果"><h2><span class="job-step">2</span> 确认重点要求</h2><div id="job-requirements"><div class="job-empty"><h3>先告诉我们，这个岗位要做什么</h3><p>识别技能后，可调整重点与加分项，再查看推荐题目。</p></div></div><p id="job-data-status" class="source-note" role="status">正在载入已有面经…</p></section></div>
    <section id="job-results" class="job-results" aria-label="岗位匹配题目"></section>`;
  const $=selector=>root.querySelector(selector);
  $('#job-company').value=editor.company;
  const error=message=>{$('#job-error').textContent=message;};
  const clearPreview=()=>{if(previewURL)URL.revokeObjectURL(previewURL);previewURL='';$('#job-image').innerHTML='';$('#job-image').hidden=true;};
  function invalidate(){
    editor.text=$('#job-text').value;editor.company=$('#job-company').value;$('#job-length').textContent=`${editor.text.length} / ${JOB_TEXT_LIMIT}`;
    profile=null;ranking=null;selected.clear();$('#job-results').innerHTML='';$('#job-requirements').innerHTML='<div class="job-empty"><h3>文字已更新</h3><p>点击“确认文字，匹配面经”更新要求和推荐。</p></div>';
  }
  function saveProfile(){
    const ok=onProfile(profile);editor.key=profile?JSON.stringify(profile):'';editor.company=profile?.company||'auto';$('#job-company').value=editor.company;
    if(!ok)error('当前岗位内容仅暂存在内存，请导出个人备份保留。');
  }
  function requirementView(){
    if(!profile)return;
    const extracted=extractRequirements(profile.text),evidence=new Map(extracted.skills.map(s=>[s.id,s]));
    $('#job-requirements').innerHTML=`<p class="job-detected-company">${profile.company==='all'?'按技能跨公司匹配':`目标公司：<strong>${esc(companyName(profile.company))}</strong>`}</p><p class="muted job-explain">识别到的要求可以修改。重点要求排序权重更高；删除误识别的项，或补充漏掉的技能。</p><div class="job-skills">${profile.skills.map(s=>`<article class="job-skill"><div><strong>${esc(skillLabel(s.id))}</strong><button class="text-button" data-job-remove="${s.id}" aria-label="移除 ${esc(skillLabel(s.id))}">移除</button></div><p>${esc(evidence.get(s.id)?.evidence[0]||'你手动补充的要求')}</p><label class="sr-only" for="job-priority-${s.id}">${esc(skillLabel(s.id))} 优先级</label><select id="job-priority-${s.id}" data-job-priority="${s.id}"><option value="required" ${s.priority==='required'?'selected':''}>重点要求</option><option value="preferred" ${s.priority==='preferred'?'selected':''}>加分项</option></select></article>`).join('')||'<div class="job-empty"><p>暂未识别到可匹配的技能。可以补充下方技能，或完善岗位文字。</p></div>'}</div><div class="job-add-skill"><label for="job-skill-add">补充一项技能</label><select id="job-skill-add"><option value="">选择未识别的技能…</option>${JOB_SKILLS.filter(s=>!profile.skills.some(v=>v.id===s.id)).map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join('')}</select><button class="button" id="job-add-skill">添加</button></div>${extracted.unrecognized.length?`<details class="job-unrecognized"><summary>这些文字未归入技能，建议核对</summary><ul>${extracted.unrecognized.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></details>`:''}<p class="source-note">按中英文技术术语及同义词识别；复杂语义和截图错字可能漏匹配，校对后效果更好。</p>`;
    root.querySelectorAll('[data-job-remove]').forEach(b=>b.onclick=()=>{profile={...profile,skills:profile.skills.filter(s=>s.id!==b.dataset.jobRemove)};saveProfile();requirementView();renderResults(true);});
    root.querySelectorAll('[data-job-priority]').forEach(s=>s.onchange=()=>{profile={...profile,skills:profile.skills.map(v=>v.id===s.dataset.jobPriority?{...v,priority:s.value}:v)};saveProfile();renderResults(true);});
    $('#job-add-skill').onclick=()=>{const id=$('#job-skill-add').value;if(!id)return;profile={...profile,skills:[...profile.skills,{id,priority:'required'}]};saveProfile();requirementView();renderResults(true);};
  }
  function visibleMatches(){return ranking.ranked.filter(r=>(mode==='all'||r.question.source.kind===mode)&&(!hideMastered||r.level!=='mastered'));}
  function renderResults(reset=false){
    if(!profile)return;
    ranking=rankJobQuestions(candidates,profile,records,companies);
    const matches=visibleMatches();
    if(reset){limit=25;selected=new Set(matches.slice(0,dailySize).map(r=>r.question.id));selectionTouched=false;}
    else if(!selectionTouched)selected=new Set(matches.slice(0,dailySize).map(r=>r.question.id));
    else selected=new Set([...selected].filter(id=>matches.some(r=>r.question.id===id)));
    const counts={all:ranking.ranked.length,recollection:ranking.ranked.filter(r=>r.question.source.kind==='recollection').length,practice:ranking.ranked.filter(r=>r.question.source.kind==='practice').length};
    $('#job-results').innerHTML=`<div class="section-heading"><div><h2><span class="job-step">3</span> 从最相关的题开始</h2><p>按重点技能相关性排序；相关性相同时，再看目标公司与面经来源。</p></div></div><div class="job-result-toolbar"><div class="tabs" aria-label="推荐题目来源">${[['recollection','面经回忆'],['practice','专项练习补充'],['all','全部相关题']].map(([id,label])=>`<button class="tab ${mode===id?'active':''}" aria-pressed="${mode===id}" data-job-mode="${id}">${label}<span class="tab-count">${counts[id]}</span></button>`).join('')}</div><label class="job-checkbox"><input id="job-hide-mastered" type="checkbox" ${hideMastered?'checked':''}>隐藏自评已掌握</label></div>
      ${ranking.gaps.length?`<div class="job-gaps"><strong>题库暂未直接覆盖的要求</strong><p>${ranking.gaps.map(s=>esc(skillLabel(s.id))).join(' · ')}</p><small>暂未在题目与标签中找到这些技能。参考答案中提及，不代表已覆盖该项要求。</small></div>`:''}
      <div class="job-selection"><span id="job-selected-count"></span><div><button class="text-button" id="job-select-top">选择前 ${dailySize} 题</button><button class="button primary" id="job-start">开始选中题目 →</button></div></div><div class="job-match-list">${matches.length?matches.slice(0,limit).map((r,index)=>{
        const q=r.question,mainHits=r.hits.filter(h=>h.direct),supporting=r.hits.filter(h=>!h.direct);
        return `<article class="job-match-card"><label class="job-select"><input type="checkbox" data-job-select="${esc(q.id)}" ${selected.has(q.id)?'checked':''} aria-label="选择：${esc(q.title)}"><span>${String(index+1).padStart(2,'0')}</span></label><div><div class="metadata"><span class="tag ${q.source.kind}">${q.source.kind==='recollection'?(r.evidenceType==='repost'?'面经 · 转述整理':'面经回忆'):'专项练习'}</span>${r.companyMatch?'<span class="tag">目标公司相关</span>':''}<span>${esc(q.companies.map(companyName).join(' / '))}</span><span>${esc(LEVELS[r.level]||'未练习')}</span></div><h3>${esc(q.title)}</h3><p class="job-match-reason">${mainHits.length?'题目 / 标签命中：'+mainHits.map(h=>esc(skillLabel(h.id))).join('、'):'仅在参考内容中涉及相关技能'}${supporting.length?`<small>参考内容还涉及：${supporting.map(h=>esc(skillLabel(h.id))).join('、')}</small>`:''}</p><p class="source-note">${esc(r.recordTitle||q.source.label)}${q.kind==='pending'?' · 参考答案待整理':''}${q.source.scope==='general'?' · 通用大模型岗，非具身专属':''}</p><div class="content-actions"><button class="button small" data-job-one="${esc(q.id)}">练这道题</button>${r.recordID?`<a href="${routeHash('career',r.recordID)}">查看面经详情 →</a>`:`<a href="${routeHash('question',q.id)}">查看题目详情 →</a>`}${safeURL(q.source.url)?`<a href="${esc(safeURL(q.source.url))}" target="_blank" rel="noopener noreferrer">原文出处 ↗</a>`:''}</div></div></article>`;
      }).join(''):`<div class="job-empty"><h3>${!profile.skills.length?'先确认至少一项岗位技能':mode==='recollection'?'暂无符合当前条件的面经':'暂无符合当前条件的题目'}</h3><p>${mode==='recollection'&&counts.practice?`可切换“专项练习补充”查看 ${counts.practice} 道相关题。`:'可以检查识别文字、补充技能，或关闭“隐藏自评已掌握”。'}</p></div>`}</div>${matches.length>limit?`<button class="button job-more" id="job-more">继续查看（已显示 ${limit} / ${matches.length}）</button>`:''}<p class="source-note">面经是个人回忆，未经公司证实；专项练习仅供准备参考。推荐顺序不是押题概率，当前题库无法保证覆盖岗位的所有要求。</p>`;
    const updateSelection=()=>{$('#job-selected-count').textContent=`已选 ${selected.size} 题 · 当前 ${matches.length} 道相关题`;$('#job-start').disabled=!selected.size;};
    updateSelection();
    root.querySelectorAll('[data-job-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.jobMode;renderResults(true);});
    $('#job-hide-mastered').onchange=e=>{hideMastered=e.target.checked;renderResults(true);};
    root.querySelectorAll('[data-job-select]').forEach(input=>input.onchange=()=>{selectionTouched=true;if(input.checked){if(selected.size>=20){input.checked=false;error('每组最多选择 20 题，练完可以继续下一组。');return;}selected.add(input.dataset.jobSelect);}else selected.delete(input.dataset.jobSelect);updateSelection();});
    $('#job-select-top').onclick=()=>renderResults(true);
    $('#job-start').onclick=()=>onStart(matches.filter(r=>selected.has(r.question.id)));
    root.querySelectorAll('[data-job-one]').forEach(b=>b.onclick=()=>onStart([matches.find(r=>r.question.id===b.dataset.jobOne)]));
    if($('#job-more'))$('#job-more').onclick=()=>{limit+=25;selectionTouched=true;renderResults();};
  }
  function insertText(text,append=false){
    const next=append?[$('#job-text').value.trim(),text].filter(Boolean).join('\n\n'):text;
    if(next.length>JOB_TEXT_LIMIT){error(`合并后超过 ${JOB_TEXT_LIMIT} 字，请先精简岗位文字。`);return;}
    $('#job-text').value=next;pendingText='';$('#job-pending').hidden=true;invalidate();$('#job-text').focus();
  }
  async function upload(file){
    try{validateScreenshot(file);}catch(e){error(e.message);return;}
    controller?.abort();const current=new AbortController();controller=current;clearPreview();error('');pendingText='';$('#job-pending').hidden=true;
    previewURL=URL.createObjectURL(file);$('#job-image').hidden=false;$('#job-image').innerHTML=`<img src="${esc(previewURL)}" alt="已选择的岗位截图预览"><span>${esc(file.name||'剪贴板截图')}</span>`;
    $('#job-ocr-progress').hidden=false;$('#job-analyze').disabled=true;$('#job-file-status').textContent='首次识别需要加载工具与字库，请稍候。';
    try{
      const result=await recognize(file,{signal:current.signal,onProgress:progress=>{if(disposed||controller!==current)return;$('#job-ocr-progress span').textContent=progress.message;$('#job-ocr-progress progress').value=progress.progress;}});
      if(disposed||controller!==current||current.signal.aborted)return;
      if(!result.text||result.text.trim().length<10)throw new Error('未识别到足够的岗位文字，请上传更清晰的正文截图或直接粘贴。');
      if(result.text.length>JOB_TEXT_LIMIT)throw new Error('识别文字过长，请裁剪岗位职责和任职要求后重试。');
      $('#job-file-status').textContent=result.confidence<55?'部分文字可能识别不准，请对照截图仔细校对。':'识别完成。请校对公司名、技术词和任职要求，再点击匹配。';
      if($('#job-text').value.trim()){
        pendingText=result.text;$('#job-pending').hidden=false;$('#job-pending').innerHTML=`<strong>截图已识别，选择如何使用新文字</strong><pre>${esc(pendingText)}</pre><button type="button" class="button" id="job-append">追加到现有文字</button> <button type="button" class="button" id="job-replace">替换现有文字</button>`;
        $('#job-append').onclick=()=>insertText(pendingText,true);$('#job-replace').onclick=()=>insertText(pendingText);
      }else insertText(result.text);
    }catch(e){if(!disposed&&controller===current){if(e.name==='AbortError')$('#job-file-status').textContent='已取消识别，现有文字保留。';else{$('#job-file-status').textContent='识别未完成，可重新上传或直接粘贴岗位文字。';error(e.message||'截图识别失败，请重试或直接粘贴文字。');}}}
    finally{if(!disposed&&controller===current){$('#job-ocr-progress').hidden=true;$('#job-analyze').disabled=false;controller=null;}}
  }
  function chooseFiles(files){if(files.length!==1){error('请每次选择一张截图，识别后可以继续追加下一张。');return;}void upload(files[0]);}
  $('#job-file').onchange=e=>{if(e.target.files?.length)chooseFiles([...e.target.files]);e.target.value='';};
  $('#job-drop').onclick=()=>$('#job-file').click();
  $('#job-drop').onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();$('#job-file').click();}};
  $('#job-drop').ondragover=e=>{e.preventDefault();e.currentTarget.classList.add('dragging');};
  $('#job-drop').ondragleave=e=>e.currentTarget.classList.remove('dragging');
  $('#job-drop').ondrop=e=>{e.preventDefault();e.currentTarget.classList.remove('dragging');chooseFiles([...e.dataTransfer.files]);};
  const paste=e=>{const files=[...(e.clipboardData?.items||[])].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);if(files.length){e.preventDefault();chooseFiles(files);}};
  root.addEventListener('paste',paste);
  $('#job-cancel').onclick=()=>controller?.abort();
  $('#job-text').oninput=invalidate;$('#job-company').onchange=invalidate;
  $('#job-clear').onclick=()=>{controller?.abort();clearPreview();profile=null;pendingText='';editor={key:'',text:'',company:'auto'};onProfile(null);$('#job-text').value='';$('#job-company').value='auto';$('#job-pending').hidden=true;$('#job-file-status').textContent='岗位内容已清除，个人题库和笔记保留。';error('');invalidate();};
  $('#job-form').onsubmit=e=>{
    e.preventDefault();error('');
    try{
      const text=$('#job-text').value.trim(),extracted=extractRequirements(text),detected=inferCompanies(text,companies);
      profile={text,company:$('#job-company').value==='auto'?(detected.length===1?detected[0]:'all'):$('#job-company').value,skills:extracted.skills.map(({id,priority})=>({id,priority})),analyzedAt:Date.now()};
      editor.text=text;$('#job-text').value=text;saveProfile();requirementView();renderResults(true);
    }catch(e){error(e.message);}
  };
  if(profile&&editor.text===profile.text){requirementView();renderResults(true);}
  else if(editor.text)invalidate();
  async function load(){
    try{const source=await loadCareer();if(disposed)return;candidates=jobCandidates(questions,source,companies);$('#job-data-status').textContent='已纳入题库与已读取原文的面经主题。未核实线索不参与推荐。';renderResults();}
    catch{if(disposed)return;$('#job-data-status').innerHTML='面经资料暂未载入，当前仅匹配题库已有内容。 <button class="text-button" id="job-reload">重试加载</button>';$('#job-reload').onclick=load;}
  }
  void load();
  return ()=>{disposed=true;controller?.abort();if(previewURL)URL.revokeObjectURL(previewURL);root.removeEventListener('paste',paste);};
}
