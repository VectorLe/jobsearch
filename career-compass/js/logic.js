/* Pure helpers: easy to unit test, no framework or external dependency. */
export const dimensions = [
  { key: 'subject', label: 'Subject interest', short: 'Interest' },
  { key: 'movement', label: 'Daily movement', short: 'Movement' },
  { key: 'entry', label: 'Ease of transition', short: 'Access' },
  { key: 'income', label: 'Income potential', short: 'Income' },
  { key: 'autonomy', label: 'Independence', short: 'Autonomy' },
  { key: 'learning', label: 'Room to learn', short: 'Learning' }
];
export const defaultWeights = { subject: 5, movement: 5, entry: 3, income: 3, autonomy: 2, learning: 3 };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function safeURL(value) {
  try { const url = new URL(String(value)); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '#'; }
  catch { return '#'; }
}
export function todayLA(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone: 'America/Los_Angeles', year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}
export function daysUntil(isoDate, nowIso = todayLA()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate))) return null;
  const a = Date.parse(`${nowIso}T00:00:00Z`), b = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b-a)/86400000) : null;
}
export function deadlineStatus(deadline, nowIso = todayLA()) {
  const days = daysUntil(deadline, nowIso);
  if (days === null) return {key:'unknown',label:'Deadline unconfirmed',days:null};
  if (days < 0) return {key:'passed',label:'Deadline passed',days};
  if (days === 0) return {key:'today',label:'Deadline today',days};
  if (days <= 7) return {key:'soon',label:`Closes in ${days}d`,days};
  return {key:'dated',label:`Deadline ${prettyDate(deadline)}`,days};
}
export function prettyDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Not specified';
  return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
}
export function freshnessDays(stamp, now = new Date()) {
  if (!stamp) return null;
  const then = Date.parse(stamp);
  return Number.isFinite(then) ? Math.max(0,Math.floor((now.getTime()-then)/86400000)) : null;
}
export function scoreCareer(career, weights = defaultWeights) {
  const total = dimensions.reduce((a,d)=>a+Math.max(0,Number(weights[d.key])||0),0);
  if (!total) return 0;
  return dimensions.reduce((sum,d)=>sum+(Number(career.scores?.[d.key])||0)*Math.max(0,Number(weights[d.key])||0),0)/total;
}
export function rankCareers(careers, weights) { return [...careers].sort((a,b)=>scoreCareer(b,weights)-scoreCareer(a,weights)); }
export function careerMatches(career, query, category = 'All', minMovement = 1) {
  const search = [career.title,career.category,career.summary,career.why,career.tagline].join(' ').toLowerCase();
  return (category==='All'||career.category===category) && career.scores.movement>=minMovement && (!query||search.includes(query.toLowerCase()));
}
export function grossAnnual(hourly, hours, weeks) {
  const vals=[hourly,hours,weeks].map(Number);
  return vals.every(x=>Number.isFinite(x)&&x>=0) ? vals.reduce((a,b)=>a*b,1) : 0;
}
export function runwayMonths(savings, monthlyExpenses) {
  const s=Math.max(0,Number(savings)||0), e=Number(monthlyExpenses);
  return e>0 ? s/e : null;
}
export function countProgress(tasks, completed) {
  const done=tasks.filter(t=>Boolean(completed?.[t.id])).length;
  return { done, total:tasks.length, pct:tasks.length?Math.round(done/tasks.length*100):0 };
}
export function byClosing(a,b,nowIso=todayLA()) {
  const x=daysUntil(a.deadline,nowIso),y=daysUntil(b.deadline,nowIso);
  const norm=d=>d===null?9999:d<0?9998+Math.abs(d):d;
  return norm(x)-norm(y);
}
