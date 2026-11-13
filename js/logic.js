/* Small, testable helpers shared by the job board. No dependencies. */
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value) {
  try { const url = new URL(String(value)); return ['https:','http:'].includes(url.protocol) ? url.href : '#'; }
  catch { return '#'; }
}
export function todayLA(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const obj = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}
export function daysUntil(iso, today = todayLA()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  const from = Date.parse(today + 'T00:00:00Z');
  const to = Date.parse(iso + 'T00:00:00Z');
  return Number.isFinite(from) && Number.isFinite(to) ? Math.round((to - from) / 86400000) : null;
}
export function prettyDate(iso) {
  if (daysUntil(iso, iso) === null) return 'Not supplied';
  return new Intl.DateTimeFormat('en-US', {timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(iso+'T12:00:00Z'));
}
export function postedAge(postedAt, now = todayLA()) {
  const days = daysUntil(postedAt, now);
  if (days === null) return {text:'Posting date not provided',days:null,known:false};
  if (days > 0) return {text:'Posting date needs review',days:null,known:false};
  const age = -days;
  return {text:age===0?'Posted today':age===1?'Posted yesterday':`Posted ${age} days ago`,days:age,known:true};
}
export function deadlineStatus(deadline, now = todayLA()) {
  const days = daysUntil(deadline,now);
  if (days===null) return {key:'unknown',text:'Closing date not listed',days:null};
  if (days<0) return {key:'passed',text:`Closed ${-days}d ago (per listed deadline)`,days};
  if (days===0) return {key:'today',text:'Deadline today',days};
  if (days<=7) return {key:'soon',text:`Closes in ${days}d`,days};
  return {key:'future',text:`Closes ${prettyDate(deadline)}`,days};
}
export function distanceMiles(a,b) {
  if (!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2) return null;
  if (![...a.slice(0,2),...b.slice(0,2)].every(Number.isFinite)) return null;
  const rad=Math.PI/180,lat=(b[0]-a[0])*rad,lon=(b[1]-a[1])*rad;
  const h=Math.sin(lat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(lon/2)**2;
  return Math.round(3958.76 * 2 * Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h))));
}
export function jobMiles(job, centerCity, geo) {
  return distanceMiles(geo?.cities?.[centerCity],geo?.cities?.[job.city]);
}
export function distanceBand(miles) {
  if (miles===null) return 4;
  if (miles<=15) return 0;
  if (miles<=30) return 1;
  if (miles<=50) return 2;
  return 3;
}
export const bandNames = ['In and around the San Gabriel Valley','Expanding outward · 16–30 miles','Wider search · 31–50 miles','Outer area · beyond 50 miles','Location needs checking'];
export function hourlyFloor(pay) {
  const text = String(pay||'');
  const match = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  const first=Number(match[1].replaceAll(',',''));
  if (!(first>0)) return null;
  if (/\/yr|annual|per year/i.test(text)) return Math.round(first/2080*100)/100;
  if (/\/hr|hourly|per hour/i.test(text)) return first;
  return null;
}
export function matchJob(job, f, center, geo, saved={}) {
  const miles=jobMiles(job,center,geo);
  if (f.radius!=='all' && (miles===null || miles>Number(f.radius))) return false;
  if (!f.archived && deadlineStatus(job.deadline).key==='passed') return false;
  if (f.saved && !saved[job.id]) return false;
  if (f.category!=='all' && job.category!==f.category) return false;
  if (f.age!=='all') {
    const age=postedAge(job.postedAt).days;
    if (f.age==='unknown' ? age!==null : age===null || age>Number(f.age)) return false;
  }
  if (f.minPay!=='all') {
    const pay=hourlyFloor(job.salary);
    if (pay===null || pay<Number(f.minPay)) return false;
  }
  if (f.query) {
    const search=[job.title,job.employer,job.city,job.category,job.note,job.requirements].join(' ').toLowerCase();
    if (!search.includes(f.query.trim().toLowerCase())) return false;
  }
  return true;
}
export function sortJobs(jobs, sort='closest',center='',geo={}) {
  const dist=j=>jobMiles(j,center,geo) ?? 9999;
  const age=j=>postedAge(j.postedAt).days ?? 9999;
  const deadline=j=>{const d=deadlineStatus(j.deadline).days;return d===null?9999:d<0?9998:d;};
  return [...jobs].sort((a,b)=>{
    if (sort==='newest') return age(a)-age(b)||dist(a)-dist(b);
    if (sort==='deadline') return deadline(a)-deadline(b)||dist(a)-dist(b);
    if (sort==='pay') return (hourlyFloor(b.salary)??-1)-(hourlyFloor(a.salary)??-1)||dist(a)-dist(b);
    return distanceBand(dist(a))-distanceBand(dist(b))||dist(a)-dist(b)||age(a)-age(b);
  });
}
