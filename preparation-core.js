// Personal planning data. Nothing in this module is included in community submissions.
export const DAILY_SIZES = [3, 5, 10];
export const defaultGoal = () => ({company:'all', role:'all', track:'all', dailySize:5});
export const freshPreparation = () => ({goal:null, active:null, history:[]});
const levels = ['weak', 'learning', 'mastered'];
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const timestamp = v => Number.isSafeInteger(v) && v >= 0 && v <= 8640000000000000;

export function validateGoal(value, tracks) {
  if (!object(value) || !['company','role'].every(k => typeof value[k] === 'string' && value[k].trim() && value[k].length <= 300) ||
      !['all', ...tracks].includes(value.track) || !DAILY_SIZES.includes(value.dailySize)) throw new Error('备考目标格式不正确');
  return {company:value.company, role:value.role, track:value.track, dailySize:value.dailySize};
}

function validateSession(value, validIDs, archived = false) {
  if (!object(value) || !/^session-[a-zA-Z0-9-]{1,80}$/.test(value.id) ||
      !Array.isArray(value.ids) || value.ids.length > 2500 || !value.ids.length ||
      !value.ids.every(id => typeof id === 'string') || new Set(value.ids).size !== value.ids.length ||
      !Number.isInteger(value.index) || value.index < 0 || value.index >= value.ids.length ||
      !object(value.grades) || !timestamp(value.startedAt) || !timestamp(value.updatedAt) || value.updatedAt < value.startedAt) {
    throw new Error('练习进度格式不正确');
  }
  const ids = value.ids.filter(id => validIDs.has(id));
  const grades = {};
  for (const [id, grade] of Object.entries(value.grades)) {
    if (!value.ids.includes(id) || !levels.includes(grade)) throw new Error('练习自评格式不正确');
    if (validIDs.has(id)) grades[id] = grade;
  }
  if (archived && (!timestamp(value.finishedAt) || value.finishedAt < value.updatedAt || !['completed','switched'].includes(value.reason))) {
    throw new Error('练习回顾格式不正确');
  }
  if (!ids.length) return null;
  return {
    id:value.id, ids, index:Math.max(0, ids.indexOf(value.ids[value.index])), grades,
    startedAt:value.startedAt, updatedAt:value.updatedAt,
    returnView:['bank','review','saved','career','plan'].includes(value.returnView) ? value.returnView : 'plan',
    returnId:typeof value.returnId === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value.returnId) ? value.returnId : '',
    ...(archived ? {finishedAt:value.finishedAt, reason:value.reason} : {})
  };
}

export function validatePreparation(value, validIDs, tracks) {
  if (value === undefined) return freshPreparation(); // Backups made before planning remain valid.
  if (!object(value) || !Array.isArray(value.history) || value.history.length > 30) throw new Error('备考计划格式不正确');
  const history = value.history.map(s => validateSession(s, validIDs, true)).filter(Boolean);
  if (new Set(history.map(s => s.id)).size !== history.length) throw new Error('练习回顾存在重复记录');
  const active = value.active == null ? null : validateSession(value.active, validIDs);
  return {goal:value.goal == null ? null : validateGoal(value.goal, tracks), active, history:history.filter(s => s.id !== active?.id)};
}

export function mergePreparation(current = freshPreparation(), incoming = freshPreparation()) {
  const importedActive = current.history.some(s => s.id === incoming.active?.id) ? null : incoming.active;
  const active = current.active || importedActive;
  const sessions = new Map(incoming.history.map(s => [s.id, s]));
  // A different imported active session stays available in recent practice, never overwriting the local queue.
  if (incoming.active && incoming.active.id !== active?.id) sessions.set(incoming.active.id, {...incoming.active, finishedAt:incoming.active.updatedAt, reason:'switched'});
  for (const s of current.history) sessions.set(s.id, s);
  if (active) sessions.delete(active.id);
  return {goal:current.goal || incoming.goal, active, history:[...sessions.values()].sort((a,b) => b.finishedAt - a.finishedAt).slice(0,30)};
}

export function dayKey(time = Date.now()) {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
const due = (r, now) => levels.includes(r?.level) && Number.isFinite(r.dueAt) && r.dueAt <= now;
const today = (r, now) => levels.includes(r?.level) && Number.isFinite(r.lastAt) && r.lastAt <= now && dayKey(r.lastAt) === dayKey(now);
export function matchingGoal(questions, goal) {
  return questions.filter(q => (goal.company === 'all' || q.companies.includes(goal.company)) &&
    (goal.role === 'all' || q.roles.includes(goal.role)) && (goal.track === 'all' || q.track === goal.track));
}
export function recommendationReason(record, now = Date.now()) {
  if (due(record, now)) return record.level === 'weak' ? '到期复习 · 上次待巩固' : '已到复习时间';
  if (record?.level === 'weak') return '优先补齐薄弱点';
  if (!levels.includes(record?.level)) return '还未自评 · 从基础开始';
  return '已有思路 · 再讲清一步';
}
export function planOverview(questions, records, goal = defaultGoal(), now = Date.now()) {
  const matched = matchingGoal(questions, goal);
  const doneToday = matched.filter(q => today(records[q.id], now)).length;
  const rank = q => due(records[q.id], now) ? 0 : records[q.id]?.level === 'weak' ? 1 : !levels.includes(records[q.id]?.level) ? 2 : 3;
  const difficulty = {基础:0, 进阶:1, 深入:2};
  const candidates = matched.filter(q => !today(records[q.id], now) && (records[q.id]?.level !== 'mastered' || due(records[q.id], now)))
    .sort((a,b) => rank(a)-rank(b) || (rank(a) === 0 ? records[a.id].dueAt-records[b.id].dueAt : 0) || difficulty[a.difficulty]-difficulty[b.difficulty]);
  return {
    matched, doneToday, queue:candidates.slice(0, Math.max(0, goal.dailySize-doneToday)),
    due:matched.filter(q => due(records[q.id], now)).length,
    weak:matched.filter(q => records[q.id]?.level === 'weak').length,
    unseen:matched.filter(q => !levels.includes(records[q.id]?.level)).length,
    mastered:matched.filter(q => records[q.id]?.level === 'mastered').length
  };
}
export function sessionGroups(session) {
  return {
    weak:session.ids.filter(id => session.grades[id] === 'weak'),
    learning:session.ids.filter(id => session.grades[id] === 'learning'),
    mastered:session.ids.filter(id => session.grades[id] === 'mastered'),
    skipped:session.ids.filter(id => !session.grades[id])
  };
}
