import {esc,safeURL,todayLA,prettyDate,postedAge,deadlineStatus,jobMiles,distanceBand,bandNames,hourlyFloor,matchJob,sortJobs} from './logic.js';

const root=document.querySelector('#app');
const STORAGE='fieldnotes-jobwatch-v2';
const defaults={query:'',center:'El Monte',radius:'30',category:'all',sort:'closest',age:'all',minPay:'all',archived:false,saved:false};
let filter={...defaults};
let db=null;
let state=readState();
let current='jobs';

function readState(){
  try {
    const existing=JSON.parse(localStorage.getItem(STORAGE)||'null');
    if(existing&&typeof existing==='object'&&!Array.isArray(existing))return {favorites:existing.favorites||{},completed:existing.completed||{},center:existing.center||'El Monte'};
    const old=JSON.parse(localStorage.getItem('fieldnotes-career-atlas-v1')||'null');
    return {favorites:old?.favorites||{},completed:old?.completed||{},center:'El Monte'};
  }catch{return {favorites:{},completed:{},center:'El Monte'};}
}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{/* Private browsing may disable storage. */}}
const link=(url,label,cls='')=>`<a class="${cls}" href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;
const tag=(label,kind='')=>`<span class="tag ${kind?'tag-'+kind:''}">${esc(label)}</span>`;
const options=(items,selected)=>items.map(([value,text])=>`<option value="${esc(value)}" ${selected===value?'selected':''}>${esc(text)}</option>`).join('');
const safeText=value=>esc(String(value??''));
const checked=(value)=>value?'checked':'';

function normalizeJobs(){
  const curated=db.opportunities.map(job=>({...job,liveFeed:false}));
  const feed=(db.live?.jobs||[]).map(j=>({
    ...j,liveFeed:true,category:j.category||'Other',sourceType:'Adzuna feed',observedAt:j.seenAt||null,
    postedAt:j.postedAt||null,deadline:j.deadline||null,requirements:j.requirements||'See employer listing for minimum qualifications.',
    note:j.note||j.description||'Third-party job lead. Verify details with the employer.',
    salary:j.salary||'Pay not provided',schedule:j.schedule||'See job listing'
  }));
  return [...curated,...feed];
}
function getJobs(){return normalizeJobs().filter(j=>matchJob(j,filter,filter.center,db.geo,state.favorites));}
function travelLabel(job){const miles=jobMiles(job,filter.center,db.geo);return miles===null?'Distance unavailable':`≈${miles} mi from ${filter.center}`;}
function postingText(job){
  const p=postedAge(job.postedAt);
  const type=job.liveFeed?'Feed-reported posting date':'Employer opening date';
  const detail=p.known?`${type}: ${prettyDate(job.postedAt)}`:`Posting date unavailable; first tracked ${prettyDate(job.observedAt||job.seenAt)}`;
  return {short:p.text,detail};
}
function sourceHealth(job){
  if(job.liveFeed)return 'External feed; status not independently verified.';
  const val=db.snapshot?.links?.[job.id];
  if(!val||val.result==='not-checked')return 'Source link not yet checked.';
  if(val.result==='reachable')return 'Source URL responded at last check; this does not prove hiring is active.';
  if(val.result==='blocked')return 'The source blocked automated verification.';
  if(val.result==='unreachable')return 'Source URL did not respond as expected at last check.';
  return 'Source status needs manual verification.';
}
function jobCard(j){
  const p=postingText(j),d=deadlineStatus(j.deadline);
  const archived=d.key==='passed';
  const freshness=postedAge(j.postedAt).days;
  const timeTone=freshness!==null&&freshness<=7?'green':'';
  const deadlineTone=archived?'red':d.key==='today'||d.key==='soon'?'yellow':'';
  const booked=Boolean(state.favorites[j.id]);
  return `<article class="job-card">
    <div class="job-top"><div class="job-tags">${tag(j.category||'Other','blue')}${tag(travelLabel(j),'green')}${j.liveFeed?tag('Third-party feed'):''}</div>
      <button class="bookmark" type="button" data-save-id="${esc(j.id)}" aria-label="${booked?'Remove saved job':'Save job'}: ${esc(j.title)}" aria-pressed="${booked}">${booked?'★':'☆'}</button></div>
    <div><h3 class="job-title">${link(j.sourceUrl,j.title)}</h3><p class="employer">${safeText(j.employer)} · ${safeText(j.city)}</p></div>
    <div class="pay-box"><strong>${safeText(j.salary||'Pay not provided')}</strong><small>${safeText(j.payType|| (j.liveFeed?'Pay not independently verified':'Published pay; verify with employer'))}</small></div>
    <div class="job-facts">
      <div class="fact"><label>Posted</label><span class="${timeTone?'highlight':''}">${safeText(p.short)}</span></div>
      <div class="fact"><label>Closing</label><span class="${deadlineTone==='yellow'?'urgent':deadlineTone==='red'?'expired':''}">${safeText(d.text)}</span></div>
      <div class="fact"><label>Schedule</label><span>${safeText(j.schedule||'Not specified')}</span></div>
      <div class="fact"><label>Work location</label><span>${safeText(j.city)} · ${safeText(travelLabel(j))}</span></div>
    </div>
    <p class="job-description">${safeText(j.note||'Read the employer posting for responsibilities.')}</p>
    <details class="job-details"><summary>Requirements and source details</summary>
      <p><strong>Qualifications:</strong> ${safeText(j.requirements||'Check the posting for minimum qualifications.')}</p>
      <p><strong>Posting information:</strong> ${safeText(p.detail)}. ${j.deadline?'Filing deadline: '+safeText(prettyDate(j.deadline))+'.':'No fixed closing date supplied.'}</p>
      ${j.jobNumber?`<p><strong>Job number:</strong> ${safeText(j.jobNumber)}</p>`:''}
      <p><strong>Source:</strong> ${safeText(j.sourceType||'Employer listing')} · ${safeText(sourceHealth(j))}</p>
    </details>
    <div class="job-actions">${link(j.sourceUrl,'View original listing','btn btn-primary')}<small>${safeText(j.liveFeed?'Unverified feed lead':'Curated employer source')}</small></div>
  </article>`;
}
function setActiveNav(view){
  document.querySelectorAll('[data-view]').forEach(a=>{
    if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
}
function jobShell(){
  const choices=[['all','All kinds'],...[...new Set(normalizeJobs().map(j=>j.category))].sort().map(x=>[x,x])];
  const currentCount=normalizeJobs().length;
  const fresh=normalizeJobs().filter(j=>{const n=postedAge(j.postedAt).days;return n!==null&&n<=7&&deadlineStatus(j.deadline).key!=='passed';}).length;
  const nearby=normalizeJobs().filter(j=>{const n=jobMiles(j,filter.center,db.geo);return n!==null&&n<=15&&deadlineStatus(j.deadline).key!=='passed';}).length;
  const savedCount=Object.values(state.favorites).filter(Boolean).length;
  const updated=db.snapshot?.generatedAt ? prettyDate(db.snapshot.generatedAt.slice(0,10)):'Pending first refresh';
  return `<div class="hero">
    <div><span class="eyebrow">Job watch · Southern California</span><h1>Find work <span>closer to home.</span></h1>
      <p>Start in the San Gabriel Valley, then widen the search. Museum work, parks, education, books, collectibles and hands-on roles—with pay, posting age and practical requirements on each card.</p></div>
    <div class="hero-aside"><strong>San Gabriel Valley first</strong><p>Choose any of eight valley starting points. Distances are approximate straight-line miles between city centers, not driving times.</p><p>Last data check: ${safeText(updated)}</p></div>
  </div>
  <div class="stat-row">
    <div class="stat"><strong>${currentCount}</strong><span>Tracked jobs</span></div>
    <div class="stat"><strong>${nearby}</strong><span>Within 15 miles, not past deadline</span></div>
    <div class="stat"><strong>${fresh}</strong><span>Posted in the last 7 days</span></div>
    <div class="stat"><strong id="saved-count">${savedCount}</strong><span>Saved jobs</span></div>
  </div>
  ${db.live?.status==='not-configured'?`<div class="feed-note">New-job discovery is not connected yet. The curated listings still appear, and the scheduled check can monitor their links and deadlines. To find additional jobs daily, configure the optional Adzuna API keys in GitHub Actions. ${link('https://github.com/VectorLe/jobsearch#daily-updates','Setup details')}</div>`:''}
  ${['error','partial'].includes(db.live?.status)?`<div class="feed-note">The third-party job feed had some errors at its last update. Existing employer listings remain available; verify each feed result independently.</div>`:''}
  <section class="filters" aria-label="Job filters">
    <div class="filters-heading"><h2>Search jobs</h2><p>Search local first; increase the radius as needed.</p></div>
    <div class="filter-grid">
      <div class="filter"><label for="query">Keyword or employer</label><input id="query" data-search type="search" placeholder="Museum, park, bookshop…" value="${esc(filter.query)}"></div>
      <div class="filter"><label for="center">Start from</label><select id="center" data-control="center">${options(db.geo.centers.map(c=>[c,c]),filter.center)}</select></div>
      <div class="filter"><label for="radius">Search radius</label><select id="radius" data-control="radius">${options([['15','Within 15 miles'],['30','Within 30 miles'],['50','Within 50 miles'],['75','Within 75 miles'],['all','All distances']],filter.radius)}</select></div>
      <div class="filter"><label for="category">Field</label><select id="category" data-control="category">${options(choices,filter.category)}</select></div>
    </div>
    <div class="filter-bottom"><p class="filter-help">Center: <strong id="center-label">${safeText(filter.center)}</strong> · city-to-city distances · roles in Los Angeles city are not prioritized.</p>
      <button class="btn btn-quiet btn-small" id="reset-filters" type="button">Clear filters</button></div>
    <details class="advanced"><summary>More filters</summary>
      <div class="advanced-fields">
        <div class="filter"><label for="sort">Sort by</label><select id="sort" data-control="sort">${options([['closest','Closest first'],['newest','Newest posting'],['deadline','Closing soon'],['pay','Highest listed pay']],filter.sort)}</select></div>
        <div class="filter"><label for="age">Posted within</label><select id="age" data-control="age">${options([['all','Any date'],['7','7 days'],['14','14 days'],['30','30 days'],['unknown','Unknown dates only']],filter.age)}</select></div>
        <div class="filter"><label for="minPay">Minimum pay</label><select id="minPay" data-control="minPay">${options([['all','Any or undisclosed'],['20','At least $20/hr'],['25','At least $25/hr'],['30','At least $30/hr'],['40','At least $40/hr']],filter.minPay)}</select></div>
      </div>
      <div class="checks"><label class="check"><input type="checkbox" data-control="saved" ${checked(filter.saved)}> Saved jobs only</label>
      <label class="check"><input type="checkbox" data-control="archived" ${checked(filter.archived)}> Include passed deadlines</label></div>
    </details>
  </section>
  <div id="results-count" class="results-bar" aria-live="polite"></div>
  <div id="job-results"></div>`;
}
function renderJobResults(){
  const jobs=sortJobs(getJobs(),filter.sort,filter.center,db.geo);
  const countEl=document.querySelector('#results-count');
  const listEl=document.querySelector('#job-results');
  if(!countEl||!listEl)return;
  countEl.innerHTML=`<div><strong>${jobs.length} matching ${jobs.length===1?'job':'jobs'}</strong><p>Sorted ${filter.sort==='closest'?'by proximity from '+safeText(filter.center):safeText({newest:'by most recent posting',deadline:'by filing deadline',pay:'by minimum listed hourly pay'}[filter.sort]||'by proximity')}. Unknown posting dates are never treated as recent.</p></div>`;
  if(!jobs.length){listEl.innerHTML=`<div class="empty"><h3>No jobs match these filters</h3><p>Try a wider radius, another category, or include listings with passed deadlines.</p><button id="reset-filters" class="btn" type="button" style="margin-top:16px">Clear filters</button></div>`;return;}
  if(filter.sort==='closest'){
    const groups=new Map();for(const job of jobs){const group=distanceBand(jobMiles(job,filter.center,db.geo));if(!groups.has(group))groups.set(group,[]);groups.get(group).push(job);}
    listEl.innerHTML=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([band,rows])=>`<section class="job-section"><h2 class="band-title">${safeText(bandNames[band])} <span>${rows.length} ${rows.length===1?'listing':'listings'}</span></h2><div class="job-grid">${rows.map(jobCard).join('')}</div></section>`).join('');
  }else listEl.innerHTML=`<div class="job-grid">${jobs.map(jobCard).join('')}</div>`;
  const badge=document.querySelector('#saved-count');if(badge)badge.textContent=Object.values(state.favorites).filter(Boolean).length;
}
function renderJobs(){root.innerHTML=jobShell();renderJobResults();}
function renderExplore(){
  const shortlist=['heritage','museum-ed','auction','numismatic','garden','recreation','tutoring','rare-books'];
  const careers=shortlist.map(id=>db.careers.find(j=>j.id===id)).filter(Boolean);
  const places=[...db.places].sort((a,b)=>(jobMiles(a,state.center,db.geo)??999)-(jobMiles(b,state.center,db.geo)??999));
  const complete=db.tasks.filter(t=>state.completed[t.id]).length;
  const total=db.tasks.length,pct=total?Math.round(100*complete/total):0;
  const taskList=tasks=>tasks.map(t=>`<div class="task ${state.completed[t.id]?'is-done':''}"><input id="task-${esc(t.id)}" data-task="${esc(t.id)}" type="checkbox" ${checked(state.completed[t.id])}><label for="task-${esc(t.id)}"><strong>${safeText(t.title)}</strong><small>${safeText(t.detail)}</small></label></div>`).join('');
  root.innerHTML=`<div class="explore-head"><span class="eyebrow">Paths, places and next steps</span><h1>Explore what comes next.</h1><p>The job listings are the priority. Use this page to compare work styles, visit organizations in person and test a career before committing to retraining.</p></div>
    <div class="section-head"><div><h2>Potential career paths</h2><p>A short list based on the original research, not a psychological diagnosis.</p></div></div>
    <div class="explore-grid">${careers.map(c=>`<article class="explore-card"><small>${safeText(c.category)}</small><h3>${safeText(c.title)}</h3><p>${safeText(c.summary)}</p><div class="first"><strong>First step:</strong> ${safeText(c.firstSteps?.[0]||'Explore a relevant organization.')}</div></article>`).join('')}</div>
    <div class="section-head"><div><h2>Places to contact or visit</h2><p>Local museums, gardens, historic sites and organizations for hands-on observation.</p></div></div>
    <div class="places-grid">${places.map(p=>`<article class="place-card"><h3>${safeText(p.name)}</h3><div class="city">${safeText(p.city)} · ≈${jobMiles(p,state.center,db.geo)??'?'} miles from ${safeText(state.center)}</div><p>${safeText(p.bestFor)}</p>${link(p.url,'Official website')}</article>`).join('')}</div>
    <div class="section-head"><div><h2>Personal action checklist</h2><p>Small experiments before a complete career switch.</p></div></div>
    <div class="plan"><div class="plan-progress"><span>${complete} of ${total} tasks complete</span><strong>${pct}%</strong></div><div class="progress-track"><span style="width:${pct}%"></span></div>${taskList(db.tasks.slice(0,8))}${db.tasks.length>8?`<details class="job-details"><summary>Show ${db.tasks.length-8} additional steps</summary>${taskList(db.tasks.slice(8))}</details>`:''}</div>
    <div class="research-note"><h3>A note on evidence</h3><p>Career fit is a working hypothesis based on interests and activities described on ${link('https://vectorle.xyz/','the source website')}. It is not a clinical personality assessment. Pay and eligibility vary by employer; confirm directly before applying. Job distance is approximate and does not represent commute time.</p></div>`;
}
function render(){current=location.hash==='#explore'?'explore':'jobs';setActiveNav(current);if(!db)return;if(current==='explore')renderExplore();else renderJobs();}

root.addEventListener('input',e=>{if(e.target.matches('[data-search]')){filter.query=e.target.value;renderJobResults();}});
root.addEventListener('change',e=>{
  const control=e.target.dataset.control;
  if(control){filter[control]=e.target.type==='checkbox'?e.target.checked:e.target.value;if(control==='center'){state.center=filter.center;persist();const label=document.querySelector('#center-label');if(label)label.textContent=filter.center;}renderJobResults();}
  const task=e.target.dataset.task;
  if(task){state.completed[task]=e.target.checked;persist();renderExplore();}
});
root.addEventListener('click',e=>{
  const save=e.target.closest('[data-save-id]');
  if(save){const id=save.dataset.saveId;state.favorites[id]=!state.favorites[id];persist();renderJobResults();return;}
  if(e.target.closest('#reset-filters')){filter={...defaults,center:state.center};renderJobs();}
});
window.addEventListener('hashchange',render);

async function start(){
  try{
    const keys=['opportunities','live_jobs','careers','places','tasks','geo','snapshot'];
    const data=await Promise.all(keys.map(async key=>{const r=await fetch('./data/'+key+'.json');if(!r.ok)throw new Error(key+': HTTP '+r.status);return r.json();}));
    db=Object.fromEntries(keys.map((key,i)=>[key==='live_jobs'?'live':key,data[i]]));
    if(!db.geo.centers.includes(state.center))state.center=db.geo.reference;
    filter.center=state.center;
    render();
  }catch(error){root.innerHTML=`<div class="empty" style="margin-top:90px"><h3>Unable to load job research</h3><p>${safeText(error.message)}. Try refreshing the page, or check the deployment settings.</p></div>`;}
}
start();
