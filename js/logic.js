/* Small, dependency-free helpers. Dates are interpreted in the Los Angeles calendar. */
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(value) {
  try { const url = new URL(String(value)); return ['https:','http:'].includes(url.protocol) ? url.href : '#'; }
  catch { return '#'; }
}
export function todayLA(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function daysUntil(date, today=todayLA()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))) return null;
  const d=Date.parse(date+'T00:00:00Z'),n=Date.parse(today+'T00:00:00Z');
  return Number.isFinite(d)&&Number.isFinite(n)?Math.round((d-n)/86400000):null;
}
export function prettyDate(date) {
  if(daysUntil(date,date)===null)return 'Not supplied';
  return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(date+'T12:00:00Z'));
}
export function postedAge(date,now=todayLA()) {
  const n=daysUntil(date,now);
  if(n===null)return {text:'Date not published',days:null,known:false};
  if(n>0)return {text:'Date needs review',days:null,known:false};
  const days=-n;
  return {text:days===0?'Posted today':days===1?'Posted yesterday':`Posted ${days} days ago`,days,known:true};
}
export function deadlineStatus(date,now=todayLA()) {
  const days=daysUntil(date,now);
  if(days===null)return {key:'unknown',text:'No listed deadline',days:null};
  if(days<0)return {key:'passed',text:`Deadline passed ${-days}d ago`,days};
  if(days===0)return {key:'today',text:'Closes today',days};
  if(days<=7)return {key:'soon',text:`Closes in ${days}d`,days};
  return {key:'future',text:`Closes ${prettyDate(date)}`,days};
}
export function normalizeCity(city, geo) {
  if(!city||!geo?.cities)return null;
  const exact=geo.cities[city];if(exact)return city;
  const val=String(city).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  if(val==='city of industry')return geo.cities.Industry?'Industry':geo.cities['City of Industry']?'City of Industry':null;
  const first=val.split(',')[0].trim();
  return Object.keys(geo.cities).find(key=>key.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===first)||null;
}
export function distanceMiles(a,b) {
  if(!Array.isArray(a)||!Array.isArray(b)||a.length<2||b.length<2)return null;
  if(![...a.slice(0,2),...b.slice(0,2)].every(Number.isFinite))return null;
  const rad=Math.PI/180,lat=(b[0]-a[0])*rad,lon=(b[1]-a[1])*rad;
  const h=Math.sin(lat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(lon/2)**2;
  return Math.round(3958.76*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h))));
}
export function jobMiles(job,center,geo) {
  if(String(job.workMode||'').toLowerCase()==='remote'||String(job.city||'').toLowerCase()==='remote')return null;
  return distanceMiles(geo?.cities?.[normalizeCity(center,geo)],geo?.cities?.[normalizeCity(job.city,geo)]);
}
export function distanceBand(miles) {
  if(miles===null)return 4;
  if(miles<=15)return 0;
  if(miles<=30)return 1;
  if(miles<=50)return 2;
  return 3;
}
export const bandNames=['Within 15 miles','16–30 miles','31–50 miles','Beyond 50 miles','Location to verify / remote'];
export function hourlyFloor(pay) {
  const raw=String(pay||'');const m=raw.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if(!m)return null;
  const n=Number(m[1].replaceAll(',',''));
  if(!(n>0))return null;
  if(/\/yr|annual|per year/i.test(raw))return Math.round(n/2080*100)/100;
  if(/\/hr|hourly|per hour/i.test(raw))return n;
  return null;
}
export const digitalCategories=new Set(['E-commerce & digital','Technical & IT']);
export function categoryTone(category) {
  if(category==='Museums & heritage')return 'heritage';
  if(category==='Parks & outdoors')return 'outdoors';
  if(category==='Books & education')return 'books';
  if(category==='Collectibles & trade')return 'collectibles';
  if(category==='E-commerce & digital')return 'ecommerce';
  if(category==='Technical & IT')return 'technical';
  return 'services';
}
export function matchJob(job, f, center, geo, saved={}) {
  const miles=jobMiles(job,center,geo);
  const remote=String(job.city||'').toLowerCase()==='remote'||String(job.workMode||'').toLowerCase()==='remote';
  if(f.radius!=='all'&&!remote&&(miles===null||miles>Number(f.radius)))return false;
  if(!f.archived&&deadlineStatus(job.deadline).key==='passed')return false;
  if(f.saved&&!saved[job.id])return false;
  if(f.category!=='all'&&job.category!==f.category)return false;
  if(f.track==='digital'&&!digitalCategories.has(job.category))return false;
  if(f.track==='physical'&&digitalCategories.has(job.category))return false;
  if(f.age!=='all') {
    const age=postedAge(job.postedAt).days;
    if(f.age==='unknown' ? age!==null : age===null||age>Number(f.age))return false;
  }
  if(f.minPay!=='all') {
    const floor=hourlyFloor(job.salary);
    if(floor===null||floor<Number(f.minPay))return false;
  }
  if(f.query) {
    const text=[job.title,job.employer,job.city,job.category,job.note,job.requirements,job.schedule,job.workMode].join(' ').toLowerCase();
    if(!text.includes(f.query.trim().toLowerCase()))return false;
  }
  return true;
}
export function sortJobs(jobs,sort='closest',center='',geo={}) {
  const dist=j=>jobMiles(j,center,geo)??9999;
  const age=j=>postedAge(j.postedAt).days??9999;
  const deadline=j=>{const x=deadlineStatus(j.deadline).days;return x===null?9999:x<0?9998:x;};
  return [...jobs].sort((a,b)=>{
    if(sort==='newest')return age(a)-age(b)||dist(a)-dist(b);
    if(sort==='deadline')return deadline(a)-deadline(b)||dist(a)-dist(b);
    if(sort==='pay')return (hourlyFloor(b.salary)??-1)-(hourlyFloor(a.salary)??-1)||dist(a)-dist(b);
    return distanceBand(dist(a))-distanceBand(dist(b))||dist(a)-dist(b)||age(a)-age(b);
  });
}
