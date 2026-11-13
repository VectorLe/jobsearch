import {esc,safeURL,todayLA,prettyDate,postedAge,deadlineStatus,jobMiles,distanceBand,bandNames,hourlyFloor,digitalCategories,categoryTone,matchJob,sortJobs} from './logic.js';

/* One stateful screen, one secondary guide, and no client dependencies. */
const root=document.querySelector('#app');
const STORAGE='fieldnotes-jobwatch-v3';
const defaults={query:'',center:'El Monte',radius:'30',category:'all',track:'all',sort:'closest',age:'all',minPay:'all',archived:false,saved:false};
let filter={...defaults},db=null,current='jobs',ideasQuery='',ideasCategory='all',ideasExpanded=false;
const state=loadState();

function loadState(){
  const empty={favorites:{},completed:{},center:'El Monte'};
  try {
    for(const key of [STORAGE,'fieldnotes-jobwatch-v2','fieldnotes-career-atlas-v1']) {
      const item=JSON.parse(localStorage.getItem(key)||'null');
      if(item&&typeof item==='object'&&!Array.isArray(item))return {...empty,favorites:item.favorites||{},completed:item.completed||{},center:item.center||'El Monte'};
    }
  }catch{/* Browsers may prohibit local storage. */}
  return empty;
}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{/* No tracking or remote storage. */}}
const text=x=>esc(String(x??''));
const link=(url,label,cls='')=>`<a class="${cls}" href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${text(label)} <span aria-hidden="true">↗</span></a>`;
const opts=(items,value)=>items.map(([a,b])=>`<option value="${text(a)}" ${a===value?'selected':''}>${text(b)}</option>`).join('');
const isChecked=x=>x?'checked':'';
const health=j=>{
  if(j.liveFeed)return 'Third-party result. Verify details with the employer before applying.';
  const res=db.snapshot?.links?.[j.id]?.result;
  if(res==='reachable')return 'Source URL responded at last check. This does not confirm the job remains open.';
  if(res==='blocked')return 'Source blocked the automated request. Open it in your browser.';
  if(res==='unreachable')return 'Source URL may be unavailable; verify through the employer’s careers page.';
  return 'Source has not been checked recently. Confirm status with the employer.';
};
function normalizeJobs(){
  const curated=db.opportunities.map(j=>({...j,liveFeed:false}));
  const feed=(db.live?.jobs||[]).map(j=>({...j,liveFeed:true,category:j.category||'Operations & services',sourceType:'Adzuna feed',observedAt:j.seenAt||null,postedAt:j.postedAt||null,deadline:j.deadline||null,requirements:j.requirements||'See the original employer listing for education, experience and certifications.',note:j.note||j.description||'Verify with employer.',salary:j.salary||'Pay not provided',schedule:j.schedule||'Schedule not listed'}));
  // De-duplicate by employer, role, city even when different feeds reuse a posting.
  const ids=new Set(),fingerprints=new Set();
  return [...curated,...feed].filter(j=>{
    const fingerprint=[j.title,j.employer,j.city].map(x=>String(x||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'')).join('|');
    if(ids.has(j.id)||fingerprints.has(fingerprint))return false;
    ids.add(j.id);fingerprints.add(fingerprint);return true;
  });
}
function jobs(){return normalizeJobs().filter(j=>matchJob(j,filter,filter.center,db.geo,state.favorites));}
function milesLabel(j){
  if(String(j.workMode||'').toLowerCase()==='remote'||String(j.city||'').toLowerCase()==='remote')return 'Remote';
  const m=jobMiles(j,filter.center,db.geo);
  return m===null?'Location to verify':`≈ ${m} mi from ${filter.center}`;
}
function card(j){
  const category=j.category||'Operations & services',tone=categoryTone(category);
  const age=postedAge(j.postedAt),closing=deadlineStatus(j.deadline),saved=Boolean(state.favorites[j.id]);
  const caution=closing.key==='passed',thirdParty=j.liveFeed||String(j.sourceType||'').toLowerCase().includes('third-party');
  const badge=(caption,t='')=>`<span class="pill ${t}">${text(caption)}</span>`;
  return `<article class="job-card tone-${tone}" data-job-id="${text(j.id)}">
    <div class="job-card-head"><div class="pills">${badge(category,'category-badge')}${badge(milesLabel(j),'distance-badge')}${thirdParty?badge('Third-party source','source-badge'):''}${j.experienceLevel?badge(j.experienceLevel,'level-badge'):''}</div>
      <button class="bookmark" type="button" data-save-id="${text(j.id)}" aria-label="${saved?'Unsave':'Save'} ${text(j.title)}" aria-pressed="${saved}">${saved?'★':'☆'}</button></div>
    <div><h3>${link(j.sourceUrl,j.title,'job-title-link')}</h3><p class="company">${text(j.employer)} <span>·</span> ${text(j.city)}</p></div>
    <div class="pay"><span>Pay</span><strong>${text(j.salary||'Not provided')}</strong><small>${text(j.payType||'Check pay in original posting')}</small></div>
    <div class="job-metadata">
      <div class="field"><span>Posted</span><strong class="${age.days!==null&&age.days<=7?'good-text':''}">${text(age.text)}</strong></div>
      <div class="field"><span>Closing</span><strong class="${caution?'danger-text':closing.key==='soon'||closing.key==='today'?'attention-text':''}">${text(closing.text)}</strong></div>
      <div class="field"><span>Schedule</span><strong>${text(j.schedule||'See listing')}</strong></div>
      <div class="field"><span>Work setup</span><strong>${text(j.workMode||'Not specified')}</strong></div>
    </div>
    <div class="qualifications"><h4>Qualifications</h4><p>${text(j.requirements||'The employer has not supplied requirements in this record; inspect the original listing.')}</p></div>
    <p class="job-summary">${text(j.note||'Review the original listing for responsibilities and current status.')}</p>
    <details class="job-more"><summary>Dates, source and other details</summary><div>
      <p><strong>Posting date:</strong> ${age.known?text(prettyDate(j.postedAt)):'Not provided'}${!age.known?` · first researched ${text(prettyDate(j.observedAt||j.seenAt))}`:''}.</p>
      <p><strong>Deadline:</strong> ${j.deadline?text(prettyDate(j.deadline)):'None published / continuous; may close early'}.</p>
      ${j.jobNumber?`<p><strong>Job number:</strong> ${text(j.jobNumber)}</p>`:''}
      <p><strong>Source:</strong> ${text(j.sourceType||'Employer listing')}. ${text(health(j))}</p>
    </div></details>
    <div class="card-actions">${link(j.sourceUrl,'View job posting','button button-primary')}<span>${thirdParty?'Independent verification needed':'Employer information may change'}</span></div>
  </article>`;
}
function startOptions(){
  const cities=db.geo.centers.map(x=>[x,x==='Industry'?'City of Industry':x]);
  const communities=(db.geo.communities||[]).map(x=>[x,x]);
  return `<optgroup label="All 31 SGV cities">${opts(cities,filter.center)}</optgroup><optgroup label="Nearby unincorporated communities">${opts(communities,filter.center)}</optgroup>`;
}
function sectionStats(){
  const all=normalizeJobs();
  const local=all.filter(j=>{const n=jobMiles(j,filter.center,db.geo);return n!==null&&n<=15&&deadlineStatus(j.deadline).key!=='passed';}).length;
  const digital=all.filter(j=>digitalCategories.has(j.category)&&deadlineStatus(j.deadline).key!=='passed').length;
  const fresh=all.filter(j=>{const n=postedAge(j.postedAt).days;return n!==null&&n<=7&&deadlineStatus(j.deadline).key!=='passed';}).length;
  const snapshot=db.snapshot?.generatedAt?prettyDate(db.snapshot.generatedAt.slice(0,10)):'Pending scheduled check';
  return `<div class="metrics">
    <div class="metric accent-aqua"><strong>${all.length}</strong><span>Researched listings</span></div>
    <div class="metric accent-green"><strong id="nearby-count">${local}</strong><span>Within 15 miles of your center</span></div>
    <div class="metric accent-purple"><strong>${digital}</strong><span>Digital and technical roles</span></div>
    <div class="metric accent-yellow"><strong>${fresh}</strong><span>Posted within 7 days</span></div>
  </div><p class="snapshot-note">Research checked: ${text(snapshot)}. A working link does not prove applications remain open.</p>`;
}
function shell(){
  const fields=[...new Set(normalizeJobs().map(j=>j.category||'Operations & services'))].sort();
  const feed=db.live?.status==='not-configured'?`<div class="notice"><span class="notice-mark">i</span><div><strong>Daily discovery is optional</strong><p>Existing job sources are tracked, but finding newly published jobs automatically requires Adzuna API credentials. Meanwhile, use the ${db.role_ideas?.length||0} live job-title searches below for additional options.</p></div></div>`:'';
  return `<section class="hero"><div><div class="eyebrow">San Gabriel Valley · career opportunities</div><h1>Work beyond <span>the screen.</span></h1>
    <p>Local jobs in parks, history, books, collectibles, hands-on work and technology. Compare pay, qualifications and dates before you apply.</p>
    <div class="hero-chips"><span>31 SGV cities</span><span>13 nearby communities</span><span>Outdoor + digital options</span></div></div>
    <aside class="hero-aside"><small>Search center</small><strong id="current-center">${text(filter.center)}</strong><p>Choose any SGV city or nearby community, then expand outward by radius. Distances use city centers, not drive times.</p></aside></section>
    ${sectionStats()}
    <section class="search-panel" aria-label="Search and filter jobs"><div class="panel-title"><h2>Job watch</h2><p>Source-linked leads, not guaranteed vacancies.</p></div>
    <div class="track-switch" role="group" aria-label="Job type">
      <button type="button" data-track="all" class="track ${filter.track==='all'?'selected':''}" aria-pressed="${filter.track==='all'}">All opportunities</button>
      <button type="button" data-track="physical" class="track ${filter.track==='physical'?'selected':''}" aria-pressed="${filter.track==='physical'}">Hands-on & local</button>
      <button type="button" data-track="digital" class="track ${filter.track==='digital'?'selected':''}" aria-pressed="${filter.track==='digital'}">E-commerce & tech</button>
    </div>
    <div class="filter-grid">
      <div class="filter filter-query"><label for="job-query">Search job title, skill or employer</label><input id="job-query" data-search type="search" value="${text(filter.query)}" placeholder="Shopify, museum, field technician…" autocomplete="off"></div>
      <div class="filter"><label for="center">Start from</label><select id="center" data-control="center">${startOptions()}</select></div>
      <div class="filter"><label for="radius">Search area</label><select id="radius" data-control="radius">${opts([['10','Within 10 mi'],['15','Within 15 mi'],['30','Within 30 mi'],['50','Within 50 mi'],['75','Within 75 mi'],['all','All locations']],filter.radius)}</select></div>
      <div class="filter"><label for="category">Career field</label><select id="category" data-control="category">${opts([['all','All fields'],...fields.map(x=>[x,x])],filter.category)}</select></div>
    </div>
    <details class="advanced"><summary>More filters</summary><div class="advanced-grid">
      <div class="filter"><label for="sort">Order jobs</label><select id="sort" data-control="sort">${opts([['closest','Closest first'],['newest','Most recently posted'],['deadline','Closing soon'],['pay','Highest published pay']],filter.sort)}</select></div>
      <div class="filter"><label for="age">Posted within</label><select id="age" data-control="age">${opts([['all','All dates'],['7','7 days'],['14','14 days'],['30','30 days'],['unknown','Dates not supplied']],filter.age)}</select></div>
      <div class="filter"><label for="minPay">Minimum pay (hourly equivalent)</label><select id="minPay" data-control="minPay">${opts([['all','Any / undisclosed'],['20','$20+ / hr'],['25','$25+ / hr'],['30','$30+ / hr'],['40','$40+ / hr']],filter.minPay)}</select></div>
    </div><div class="checks"><label><input type="checkbox" data-control="saved" ${isChecked(filter.saved)}> Saved only</label>
      <label><input type="checkbox" data-control="archived" ${isChecked(filter.archived)}> Include listings past their published deadline</label></div></details>
    <div class="panel-foot"><span id="center-label">Starting in ${text(filter.center)}. Straight-line city-center distances.</span><button class="button button-light" id="reset-filters" type="button">Reset filters</button></div>
    </section>${feed}
    <div id="results-count" class="results-bar" aria-live="polite"></div>
    <div id="job-results"></div>
    ${roleExplorer()}
    <div class="method-note"><strong>About this research</strong><p>Published pay and opening dates are shown only when supplied by the source. Unknown dates are never treated as recent. Qualifications are short summaries, not promises of eligibility; check the employer posting for the complete requirements. Jobs with past application deadlines are hidden by default.</p></div>`;
}
function renderJobResults(){
  const filtered=sortJobs(jobs(),filter.sort,filter.center,db.geo),counter=document.querySelector('#results-count'),container=document.querySelector('#job-results');
  if(!counter||!container)return;
  const nearby=normalizeJobs().filter(j=>{const n=jobMiles(j,filter.center,db.geo);return n!==null&&n<=15&&deadlineStatus(j.deadline).key!=='passed';}).length;
  const nearbyNode=document.querySelector('#nearby-count');if(nearbyNode)nearbyNode.textContent=String(nearby);
  counter.innerHTML=`<div><h2>${filtered.length} matching ${filtered.length===1?'job':'jobs'}</h2><p>${text(filter.sort==='closest'?`Closest to ${filter.center} first`:{newest:'Newest posting dates first',deadline:'Upcoming deadlines first',pay:'Highest comparable pay first'}[filter.sort]||'Closest first')}. Dated openings may have closed earlier.</p></div><span class="count-label">${normalizeJobs().length} researched · ${db.role_ideas?.length||0} more job-title searches</span>`;
  if(!filtered.length){container.innerHTML='<div class="empty"><h3>No jobs matched</h3><p>Try a larger radius, a different field, or enable previously closed listings.</p><button class="button button-primary" type="button" id="reset-filters">Reset filters</button></div>';return;}
  if(filter.sort!=='closest'){container.innerHTML=`<div class="job-grid">${filtered.map(card).join('')}</div>`;return;}
  const groups=new Map();for(const j of filtered){const k=distanceBand(jobMiles(j,filter.center,db.geo));if(!groups.has(k))groups.set(k,[]);groups.get(k).push(j);}
  container.innerHTML=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([k,rows])=>`<section class="group"><div class="group-head"><h3>${text(bandNames[k])}</h3><span>${rows.length} ${rows.length===1?'role':'roles'}</span></div><div class="job-grid">${rows.map(card).join('')}</div></section>`).join('');
}
function roleExplorer(){return `<details id="role-explorer" class="idea-section"><summary><span><small>Broaden the search</small><strong>${db.role_ideas?.length||0} more job titles worth exploring</strong><span class="idea-note">These are search ideas, not verified job openings. Open live search results in another tab.</span></span><span class="idea-arrow" aria-hidden="true">+</span></summary>
    <div class="idea-body"><div class="idea-controls"><div class="filter"><label for="idea-query">Role keyword</label><input id="idea-query" data-idea-search type="search" value="${text(ideasQuery)}" placeholder="Coin, Shopify, garden…"></div>
    <div class="filter"><label for="idea-category">Focus area</label><select id="idea-category" data-idea-category>${opts([['all','All interests'],...new Set((db.role_ideas||[]).map(x=>x.category))].map(x=>Array.isArray(x)?x:[x,x]),ideasCategory)}</select></div></div>
    <div id="idea-results" aria-live="polite"></div></div></details>`;}
function renderRoleResults(){
  const node=document.querySelector('#idea-results');if(!node)return;
  const q=ideasQuery.toLowerCase().trim();
  const filtered=(db.role_ideas||[]).filter(r=>(ideasCategory==='all'||r.category===ideasCategory)&&(!q||[r.title,r.summary,r.typicalQualifications,r.category].join(' ').toLowerCase().includes(q)));
  const prioritized=[...filtered].sort((a,b)=>filter.track==='digital'?Number(digitalCategories.has(b.category))-Number(digitalCategories.has(a.category)):filter.track==='physical'?Number(digitalCategories.has(a.category))-Number(digitalCategories.has(b.category)):0);
  const shown=ideasExpanded?prioritized:prioritized.slice(0,12);
  node.innerHTML=`<p class="ideas-intro">${filtered.length} role ideas. Salary and availability are intentionally not invented. Searches use ${text(filter.center)} as the starting location.</p>
    <div class="idea-grid">${shown.map(r=>{
      const q=encodeURIComponent(r.query||r.title),loc=encodeURIComponent(filter.center+', CA');
      const indeed=`https://www.indeed.com/jobs?q=${q}&l=${loc}&sort=date`;
      const gov=`https://www.governmentjobs.com/jobs?keyword=${q}&location=${loc}`;
      return `<article class="idea-card tone-${categoryTone(r.category)}"><span>${text(r.category)}</span><h4>${text(r.title)}</h4><p>${text(r.summary)}</p><p class="idea-qual"><strong>Typical qualifications:</strong> ${text(r.typicalQualifications)}</p><small>${text(r.movement)}</small><div class="idea-links">${link(indeed,'Search jobs')}${link(gov,'Public-sector search')}</div></article>`;}).join('')}</div>
    ${filtered.length>12?`<button class="button button-light show-ideas" type="button" data-show-ideas>${ideasExpanded?'Show fewer roles':`Show all ${filtered.length} roles`}</button>`:''}`;
}
function renderJobs(){root.innerHTML=shell();renderJobResults();renderRoleResults();}
function renderExplore(){
  const careers=db.careers||[],sites=[...db.places].sort((a,b)=>(jobMiles(a,state.center,db.geo)??9999)-(jobMiles(b,state.center,db.geo)??9999));
  const tasks=db.tasks||[],done=tasks.filter(x=>state.completed[x.id]).length;
  const careerCards=careers.map(c=>`<article class="career-card tone-${categoryTone(c.category)}"><small>${text(c.category)}</small><h3>${text(c.title)}</h3><p>${text(c.summary)}</p><p class="career-step"><strong>First experiment:</strong> ${text(c.firstSteps?.[0]||'Talk with someone doing this work.')}</p></article>`).join('');
  root.innerHTML=`<section class="explore-intro"><div class="eyebrow">Practical next steps</div><h1>Explore the work, <span>not just the title.</span></h1><p>Career ideas include field-based work, tangible goods and a practical digital fallback. Sample the daily duties before committing to retraining.</p></section>
    <div class="section-title"><h2>Career directions</h2><p>${careers.length} focused options from the original research, including digital and technical bridge work.</p></div><div class="career-grid">${careerCards}</div>
    <div class="section-title"><h2>Places to visit</h2><p>Field visits and conversations often reveal more than a job description.</p></div>
    <div class="places-grid">${sites.map(s=>`<article class="place-card"><h3>${text(s.name)}</h3><span>${text(s.city)} · ${text(jobMiles(s,state.center,db.geo)??'—')} mi from ${text(state.center)}</span><p>${text(s.bestFor)}</p>${link(s.url,'Official website')}</article>`).join('')}</div>
    <div class="section-title"><h2>Transition checklist</h2><p>One sequence of small experiments, not a long personality assessment.</p></div><div class="checklist"><div class="plan-count"><strong>${done} of ${tasks.length} completed</strong><span>${tasks.length?Math.round(done/tasks.length*100):0}%</span></div><div class="progress"><span style="width:${tasks.length?done/tasks.length*100:0}%"></span></div>
      ${tasks.map(t=>`<label class="task ${state.completed[t.id]?'completed':''}"><input type="checkbox" data-task="${text(t.id)}" ${isChecked(state.completed[t.id])}><span><strong>${text(t.title)}</strong><small>${text(t.detail)}</small></span></label>`).join('')}
    </div><div class="method-note"><strong>Limitations</strong><p>These are occupational hypotheses grounded in interests and activities, not a psychological assessment. Employer qualifications, pay, scheduling and commuting requirements can change. ${link('https://vectorle.xyz/','Original context website')}.</p></div>`;
}
function render(){current=location.hash==='#explore'?'explore':'jobs';document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});if(!db)return;current==='explore'?renderExplore():renderJobs();}

root.addEventListener('input',event=>{
  if(event.target.matches('[data-search]')){filter.query=event.target.value;renderJobResults();}
  if(event.target.matches('[data-idea-search]')){ideasQuery=event.target.value;ideasExpanded=false;renderRoleResults();}
});
root.addEventListener('change',event=>{
  const control=event.target.dataset.control;
  if(control){filter[control]=event.target.type==='checkbox'?event.target.checked:event.target.value;
    if(control==='center'){state.center=filter.center;persist();const node=document.querySelector('#center-label');if(node)node.textContent=`Starting in ${filter.center}. Straight-line city-center distances.`;const here=document.querySelector('#current-center');if(here)here.textContent=filter.center;}
    renderJobResults();renderRoleResults();
  }
  if(event.target.matches('[data-idea-category]')){ideasCategory=event.target.value;ideasExpanded=false;renderRoleResults();}
  const task=event.target.dataset.task;if(task){state.completed[task]=event.target.checked;persist();renderExplore();}
});
root.addEventListener('click',event=>{
  const save=event.target.closest('[data-save-id]');
  if(save){state.favorites[save.dataset.saveId]=!state.favorites[save.dataset.saveId];persist();renderJobResults();return;}
  const pick=event.target.closest('[data-track]');
  if(pick){filter.track=pick.dataset.track;document.querySelectorAll('[data-track]').forEach(el=>{const yes=el.dataset.track===filter.track;el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',String(yes));});renderJobResults();renderRoleResults();return;}
  if(event.target.closest('#reset-filters')){filter={...defaults,center:state.center};ideasQuery='';ideasCategory='all';renderJobs();return;}
  if(event.target.closest('[data-show-ideas]')){ideasExpanded=!ideasExpanded;renderRoleResults();}
});
window.addEventListener('hashchange',render);

async function start(){
  try{
    const keys=['opportunities','live_jobs','careers','places','tasks','geo','snapshot','role_ideas'];
    const data=await Promise.all(keys.map(async key=>{const r=await fetch('./data/'+key+'.json');if(!r.ok)throw new Error(key+': HTTP '+r.status);return r.json();}));
    db=Object.fromEntries(keys.map((key,i)=>[key==='live_jobs'?'live':key,data[i]]));
    if(![...db.geo.centers,...(db.geo.communities||[])].includes(state.center))state.center=db.geo.reference;
    filter.center=state.center;
    render();
  }catch(error){
    // Preserve the static job listings shipped in index.html. Never blank the page on error.
    const warning=document.createElement('p');warning.className='load-warning';warning.textContent='Interactive filters are unavailable. Browse the job links below, then refresh or check deployment settings.';
    root.prepend(warning);
    console.error('Failed to initialize job watch:',error);
  }
}
start();
