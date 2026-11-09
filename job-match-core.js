// An editable vocabulary for transparent, local matching. Scores are ordering rules, not probabilities.
export const JOB_TEXT_LIMIT = 20000;
export const JOB_SKILLS = [
  ['vla','VLA / 视觉语言动作',['vla','vision language action','视觉语言动作','视觉-语言-动作','openvla','rt-2','pi0','pi0.5','π0','π0.5'],1],
  ['vlm','多模态 / VLM',['vlm','多模态','vision language model','视觉语言模型','mllm'],1],
  ['agent','Agent / 任务规划',['agent','agentic','任务规划','语言规划','工具调用','任务分解','子任务','subtask','saycan'],2],
  ['world','世界模型 / WAM',['world model','world action model','世界模型','wam','视频预测','视频生成'],2],
  ['pretrain','预训练',['预训练','pretraining','pre-training','pretrain'],2],
  ['posttrain','后训练 / 微调',['后训练','post-training','posttraining','微调','fine-tuning','finetuning','sft','lora'],2],
  ['rl','强化学习',['强化学习','reinforcement learning','rl','ppo','sac','奖励函数','reward','advantage','rlt','recap'],2],
  ['imitation','模仿学习',['模仿学习','imitation learning','behavior cloning','behaviour cloning','行为克隆','bc','dagger'],2],
  ['diffusion','扩散模型 / Diffusion Policy',['diffusion','扩散模型','扩散策略','去噪'],2],
  ['flow','Flow Matching',['flow matching','flow-matching','流匹配','rectified flow'],3],
  ['transformer','Transformer / Attention',['transformer','attention','注意力机制','自注意力','rope','位置编码'],2],
  ['action','动作表示 / Action Chunk',['动作表示','动作分块','action chunk','action chunking','动作离散化','连续动作','离散动作','动作token'],2],
  ['rtc','实时动作衔接 / RTC',['rtc','real time chunking','real-time chunking','动作队列','动作衔接'],3],
  ['cache','KV Cache',['kv cache','kv-cache','缓存失效'],3],
  ['data','数据采集与处理',['数据采集','数据清洗','数据配比','数据管线','数据流水线','data pipeline','数据质量','数据对齐','数据混合','抽帧','dataset','数据集'],2],
  ['teleop','遥操作',['遥操作','teleoperation','teleop','主从位姿'],2],
  ['distributed','分布式训练',['分布式训练','distributed training','deepspeed','fsdp','ddp','多卡','张量并行','流水线并行','zero'],2],
  ['stability','训练稳定性',['训练稳定','梯度爆炸','梯度裁剪','loss spike','nan','混合精度','bf16','fp16'],2],
  ['scaling','Scaling Law / 训练预算',['scaling law','chinchilla','计算最优','算力预算','缩放定律'],2],
  ['efficiency','训练性能 / 吞吐',['训练吞吐','吞吐量','mfu','通信瓶颈','性能分析','profiling','算子优化'],2],
  ['deploy','推理部署与优化',['部署','推理优化','推理加速','低延迟','实时推理','tensorrt','onnx','量化','延迟预算','闭环控制'],2],
  ['eval','评测与泛化',['评测','评估','benchmark','泛化','消融','成功率','ood','分布偏移','evaluation'],2],
  ['sim2real','仿真与 Sim-to-Real',['sim2real','sim-to-real','sim to real','域随机化','domain randomization','isaac','mujoco','仿真'],2],
  ['manipulation','机器人操作',['机器人操作','robot manipulation','robotic manipulation','灵巧操作','灵巧手','双臂','抓取','接触操作'],2],
  ['control','运动控制',['运动控制','控制理论','阻抗控制','力控','mpc','pid','动力学','运动学','轨迹跟踪'],2],
  ['planning','运动规划',['运动规划','motion planning','轨迹规划','路径规划','rrt','astar','a*'],2],
  ['vision3d','三维视觉 / 感知',['三维视觉','3d视觉','3d vision','点云','point cloud','位姿估计','目标检测','视觉感知','相机标定','手眼标定'],2],
  ['slam','SLAM / 定位导航',['slam','定位建图','视觉里程计','导航','odometry'],2],
  ['ros','ROS / ROS2',['ros','ros2','ros 2'],2],
  ['cpp','C++',['c++','cpp','c / c++','c/c++'],2],
  ['python','Python',['python'],1],
  ['pytorch','PyTorch',['pytorch','torch'],2],
  ['cuda','CUDA / GPU 编程',['cuda','gpu编程','gpu programming','triton'],2],
  ['optimization','优化与基础算法',['反向传播','梯度下降','优化器','optimizer','adamw','adam','学习率','数据结构','算法复杂度'],1]
].map(([id,label,aliases,specificity])=>({id,label,aliases,specificity}));
const skillsByID = new Map(JOB_SKILLS.map(s=>[s.id,s]));
const normalize = text => String(text).normalize('NFKC').toLowerCase().replace(/π/g,'pi').replace(/[‐‑–—]/g,'-').replace(/([\p{Script=Han}])[ \t]+(?=[\p{Script=Han}])/gu,'$1');
const escapeRE = text => text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const patterns = new Map(JOB_SKILLS.map(skill=>[skill.id,skill.aliases.map(alias=>{
  const value=normalize(alias), body=escapeRE(value).replace(/[ -]+/g,'[\\s-]*');
  return new RegExp((/^[a-z0-9]/.test(value)?'(?<![a-z0-9])':'')+body+(/[a-z0-9]$/.test(value)?'(?![a-z0-9])':''),'iu');
})]));
const matches = (text,skill) => patterns.get(skill.id).some(re=>re.test(normalize(text)));
export const skillLabel = id => skillsByID.get(id)?.label || id;

export function extractRequirements(text) {
  if(typeof text!=='string'||text.length>JOB_TEXT_LIMIT)throw new Error(`岗位文字不能超过 ${JOB_TEXT_LIMIT} 字。`);
  if(text.trim().length<10)throw new Error('请提供至少 10 个字的岗位职责或任职要求。');
  let preferred=false;
  const found=new Map(), unrecognized=[];
  const clauses=text.split(/[\n。；;！？]|[，,]|(?:但是|但要求|但需)/u).map(s=>s.trim()).filter(Boolean);
  for(const clause of clauses){
    const semantic=normalize(clause);
    if(/加分项|优先条件|优先考虑|nice[ -]to[ -]have|preferred qualifications/i.test(semantic))preferred=true;
    if(/任职要求|岗位职责|必备条件|基本要求|minimum qualifications|responsibilities|requirements/i.test(semantic))preferred=false;
    if(/不(?:要求|需要|涉及)|无需|无须|不作为要求|not required|no need|not necessary|without requiring/i.test(semantic))continue;
    const priority=preferred||/加分|优先|有.*更佳|preferred|a plus|nice[ -]to[ -]have/i.test(semantic)?'preferred':'required';
    const hit=JOB_SKILLS.filter(s=>matches(clause,s));
    for(const skill of hit){
      const prior=found.get(skill.id);
      const evidence=[...new Set([...(prior?.evidence||[]),clause])].slice(0,2);
      found.set(skill.id,{id:skill.id,priority:prior?.priority==='required'?'required':priority,evidence});
    }
    if(!hit.length&&clause.length>=12&&!/学历|本科|硕士|博士|薪资|福利|工作地点|招聘人数|年终|五险|沟通|团队|工作经验/.test(clause))unrecognized.push(clause);
  }
  return {skills:[...found.values()],unrecognized:unrecognized.slice(0,6)};
}

export function validateJobProfile(value) {
  if(value==null)return null;
  if(typeof value!=='object'||Array.isArray(value)||typeof value.text!=='string'||value.text.length>JOB_TEXT_LIMIT||value.text.trim().length<10||
     typeof value.company!=='string'||value.company.length>100||!value.company||!Array.isArray(value.skills)||value.skills.length>JOB_SKILLS.length||
     !Number.isSafeInteger(value.analyzedAt)||value.analyzedAt<0||value.analyzedAt>8640000000000000)throw new Error('岗位匹配记录格式不正确');
  const ids=new Set();
  const skills=value.skills.map(s=>{
    if(!s||!skillsByID.has(s.id)||ids.has(s.id)||!['required','preferred'].includes(s.priority))throw new Error('岗位技能格式不正确');
    ids.add(s.id);return {id:s.id,priority:s.priority};
  });
  return {text:value.text,company:value.company,skills,analyzedAt:value.analyzedAt};
}

const companyAliases = {bytedance:['字节','bytedance'],agibot:['智元','agibot'],unitree:['宇树','unitree'],galaxea:['星海图','galaxea'],x2:['自变量','x square'],galbot:['银河通用','galbot'],spirit:['千寻智能','spirit ai'],ai2:['智平方'],tars:['它石智航'],psibot:['灵初智能'],robotera:['星动纪元'],astribot:['星尘智能'],noematrix:['穹彻智能'],limx:['逐际动力'],engineai:['众擎'],noetix:['松延动力'],dexmal:['原力灵机','dexmal'],giga:['极佳视界'],anyverse:['无界动力'],pi:['physical intelligence'],deepmind:['deepmind'],nvidia:['nvidia','英伟达'],figure:['figure ai'],skild:['skild'],generalist:['generalist']};
export function inferCompanies(text,companies) {
  const normalized=normalize(text);
  return companies.filter(c=>[c.name,...(companyAliases[c.id]||[])].some(alias=>{
    const value=normalize(alias),p=escapeRE(value);
    return new RegExp((/^[a-z]/.test(value)?'(?<![a-z])':'')+p+(/[a-z]$/.test(value)?'(?![a-z])':'')).test(normalized);
  })).map(c=>c.id);
}

export function rankJobQuestions(candidates, profile, records={}, companies=[]) {
  const ranked=[];
  for(const candidate of candidates){
    const q=candidate.question;
    // A career record's broad summary/track must not turn every theme into a technical match.
    const primary=candidate.primaryText ?? [q.title,...q.tags].join(' ');
    const secondary=candidate.secondaryText ?? [q.answer,...q.steps,...q.pitfalls,...q.followups].join(' ');
    const hits=profile.skills.flatMap(requirement=>{
      const skill=skillsByID.get(requirement.id);if(!skill)return [];
      const direct=matches(primary,skill),supporting=!direct&&matches(secondary,skill);
      if(!direct&&!supporting)return [];
      return [{id:skill.id,priority:requirement.priority,direct,points:skill.specificity*(requirement.priority==='required'?3:1)*(direct?3:1)}];
    });
    if(!hits.length)continue;
    const companyMatch=profile.company!=='all'&&(q.companies.includes(profile.company)||inferCompanies(q.companies.join(' / '),companies).includes(profile.company));
    const score=hits.reduce((sum,h)=>sum+h.points,0);
    ranked.push({...candidate,hits,score,companyMatch,level:records[q.id]?.level||''});
  }
  // Requirements dominate; company and source are tie breakers, never invented evidence of relevance.
  ranked.sort((a,b)=>b.score-a.score||Number(b.companyMatch)-Number(a.companyMatch)||Number(b.question.source.kind==='recollection')-Number(a.question.source.kind==='recollection')||Number(a.level==='mastered')-Number(b.level==='mastered')||a.question.id.localeCompare(b.question.id));
  const covered=new Set(ranked.flatMap(r=>r.hits.filter(h=>h.direct).map(h=>h.id)));
  return {ranked,gaps:profile.skills.filter(s=>!covered.has(s.id))};
}
