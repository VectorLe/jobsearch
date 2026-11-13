import {esc,safeURL,jobURLKey,todayLA,prettyDate,isRecentPosting,postedAge,deadlineStatus,jobMiles,distanceBand,bandNames,hourlyFloor,digitalCategories,categoryTone,matchJob,sortJobs} from './logic.js';

/* One stateful screen, one secondary guide, and no client dependencies. */
const root=document.querySelector('#app');
const STORAGE='fieldnotes-jobwatch-v3';
const defaults={query:'',center:'El Monte',radius:'30',category:'all',track:'all',sort:'closest',age:'all',minPay:'all',archived:false,saved:false,includeRemote:true};
let filter={...defaults},db=null,current='jobs',ideasQuery='',ideasCategory='all',ideasExpanded=false;
let cachedJobs=null;
let visibleCount=24, apprenticeshipExpanded=false;
const PAGE_SIZE=24;
const state=loadState();

function loadState(){
  const empty={favorites:{},completed:{},center:'El Monte',includeRemote:true};
  try {
    for(const key of [STORAGE,'fieldnotes-jobwatch-v2','fieldnotes-career-atlas-v1']) {
      const item=JSON.parse(localStorage.getItem(key)||'null');
      if(item&&typeof item==='object'&&!Array.isArray(item))return {...empty,favorites:item.favorites||{},completed:item.completed||{},center:item.center||'El Monte',includeRemote:item.includeRemote!==false};
    }
  }catch{/* Browsers may prohibit local storage. */}
  return empty;
}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{/* No tracking or remote storage. */}}
const text=esc;
const link=(url,label,cls='',ariaLabel='')=>`<a class="${cls}" href="${esc(safeURL(url))}"${ariaLabel?` aria-label="${text(ariaLabel)}"`:''} target="_blank" rel="noopener noreferrer">${text(label)} <span aria-hidden="true">↗</span></a>`;
const opts=(items,value)=>items.map(([a,b])=>`<option value="${text(a)}" ${a===value?'selected':''}>${text(b)}</option>`).join('');
const isChecked=x=>x?'checked':'';
const health=j=>{
  if(j.feedStale)return 'The provider was unavailable at the last refresh. This older result must be checked with the source.';
  if(j.provider==='greenhouse')return 'Published on the employer job board at the last successful refresh. The employer may close it at any time.';
  if(j.provider==='jobicy')return 'Sourced from Jobicy. Confirm US eligibility, qualifications and current availability with the employer.';
  if(j.provider==='adzuna')return 'Sourced from Adzuna. Confirm the employer listing is still accepting applications.';
  const res=db.snapshot?.links?.[j.id]?.result;
  if(res==='reachable')return 'Source URL responded at last check. This does not confirm the job remains open.';
  if(res==='blocked')return 'Source blocked the automated request. Open it in your browser.';
  if(res==='unreachable')return 'Source URL may be unavailable; verify through the employer’s careers page.';
  return 'Source has not been checked recently. Confirm status with the employer.';
};
function normalizeJobs(){
  if(cachedJobs)return cachedJobs;
  const curated=db.opportunities.filter(j=>isRecentPosting(j.postedAt)).map(j=>({...j,liveFeed:false}));
  const feed=(db.live?.jobs||[]).filter(j=>isRecentPosting(j.postedAt)).map(j=>({...j,liveFeed:true,category:j.category||'Operations & services',sourceType:j.sourceType||'Third-party job feed',observedAt:j.observedAt||j.seenAt||null,postedAt:j.postedAt||null,deadline:j.deadline||null,requirements:j.requirements||'See the original source for education, experience and certifications.',note:j.note||j.description||'Verify with the source.',salary:j.salary||'Pay not published',schedule:j.schedule||'Schedule not listed'}));
  // De-duplicate by employer, role, city even when different feeds reuse a posting.
  const ids=new Set(),fingerprints=new Set(),urls=new Set();
  cachedJobs=[...curated,...feed].filter(j=>{
    const fingerprint=[j.title,j.employer,j.city].map(x=>String(x||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'')).join('|');
    const canonical=jobURLKey(j.sourceUrl);
    if(ids.has(j.id)||fingerprints.has(fingerprint)||(canonical&&urls.has(canonical)))return false;
    ids.add(j.id);fingerprints.add(fingerprint);if(canonical)urls.add(canonical);return true;
  });
  return cachedJobs;
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
  const caution=closing.key==='passed',thirdParty=['jobicy','adzuna'].includes(j.provider)||String(j.sourceType||'').toLowerCase().includes('third-party');
  const badge=(caption,t='')=>`<span class="pill ${t}">${text(caption)}</span>`;
  const action=closing.key==='passed'?'View archived posting':j.provider==='jobicy'?'View on Jobicy':j.provider==='adzuna'?'View on Adzuna':'View employer posting';
  return `<article class="job-card tone-${tone}" data-job-id="${text(j.id)}">
    <div class="job-card-head"><div class="pills">${badge(category,'category-badge')}${badge(milesLabel(j),'distance-badge')}${thirdParty?badge(j.provider==='jobicy'?'Jobicy source':j.provider==='adzuna'?'Adzuna source':'Third-party source','source-badge'):''}${j.feedStale?badge('Source refresh delayed','source-badge'):''}${j.experienceLevel?badge(j.experienceLevel,'level-badge'):''}</div>
      <button class="bookmark" type="button" data-save-id="${text(j.id)}" aria-label="${saved?'Unsave':'Save'} ${text(j.title)}" aria-pressed="${saved}">${saved?'★':'☆'}</button></div>
    <div><h3>${link(j.sourceUrl,j.title,'job-title-link')}</h3><p class="company">${text(j.employer)} <span>·</span> ${text(j.city)}</p></div>
    <div class="pay"><span>Reported pay</span><strong>${text(j.salary||'Not provided')}</strong><small>${text(j.payType||'Check pay in original posting')}</small></div>
    <div class="job-metadata">
      <div class="field"><span>Posted</span><strong class="${age.days!==null&&age.days<=7?'good-text':''}">${text(age.text)}</strong></div>
      <div class="field"><span>Closing</span><strong class="${caution?'danger-text':closing.key==='soon'||closing.key==='today'?'attention-text':''}">${text(closing.text)}</strong></div>
      <div class="field"><span>Schedule</span><strong>${text(j.schedule||'See listing')}</strong></div>
      <div class="field"><span>Work setup</span><strong>${text(j.workMode||'Not specified')}</strong></div>
    </div>
    <div class="qualifications"><h4>Qualifications to check</h4><p>${text(j.requirements||'The employer has not supplied requirements in this record; inspect the original listing.')}</p></div>
    <p class="job-summary">${text(j.note||'Review the original listing for responsibilities and current status.')}</p>
    <details class="job-more"><summary>Dates, source and other details</summary><div>
      <p><strong>Posting date:</strong> ${age.known?text(prettyDate(j.postedAt)):'Not provided'}${!age.known?` · first researched ${text(prettyDate(j.observedAt||j.seenAt))}`:''}.</p>
      <p><strong>Deadline:</strong> ${j.deadline?text(prettyDate(j.deadline)):'None published / continuous; may close early'}.</p>
      ${j.jobNumber?`<p><strong>Job number:</strong> ${text(j.jobNumber)}</p>`:''}
      ${j.eligibility?`<p><strong>Remote eligibility:</strong> ${text(j.eligibility)}</p>`:''}
      <p><strong>Source:</strong> ${text(j.sourceType||'Employer listing')}. ${text(health(j))}</p>
    </div></details>
    <div class="card-actions">${link(j.sourceUrl,action,'button button-primary',`${action} for ${j.title} at ${j.employer}`)}<span>${thirdParty?'Verify details with the employer.':'Check eligibility and application status.'}</span></div>
  </article>`;
}
function startOptions(){
  const cities=db.geo.centers.map(x=>[x,x==='Industry'?'City of Industry':x]);
  const communities=(db.geo.communities||[]).map(x=>[x,x]);
  return `<optgroup label="All 31 SGV cities">${opts(cities,filter.center)}</optgroup><optgroup label="Nearby unincorporated communities">${opts(communities,filter.center)}</optgroup>`;
}
function sectionStats(){
  const all=normalizeJobs();
  const active=all.filter(j=>deadlineStatus(j.deadline).key!=='passed');
  const nearby=active.filter(j=>{const miles=jobMiles(j,filter.center,db.geo);return miles!==null&&miles<=15;}).length;
  const withPay=all.filter(j=>hourlyFloor(j.salary)!==null).length;
  const saved=all.filter(j=>state.favorites[j.id]).length;
  const snapshot=db.snapshot?.generatedAt?prettyDate(db.snapshot.generatedAt.slice(0,10)):'Not checked yet';
  return `<div class="metrics">
    <div class="metric accent-aqua"><strong>${all.length}</strong><span>Jobs posted in past 30 days</span></div>
    <div class="metric accent-green"><strong id="nearby-count">${nearby}</strong><span>Within 15 miles of ${text(filter.center)}</span></div>
    <div class="metric accent-purple"><strong>${withPay}</strong><span>With reported pay</span></div>
    <div class="metric accent-yellow"><strong id="saved-count">${saved}</strong><span>Saved for review</span></div>
  </div><p class="snapshot-note">Source links last checked: ${text(snapshot)}. A reachable link does not confirm a job is still accepting applications.</p>`;
}
function shell(){
  const fields=[...new Set(normalizeJobs().map(j=>j.category||'Operations & services'))].sort();
  const sources=db.live?.sources||{};
  const feed=`<div class="notice"><span class="notice-mark">i</span><div><strong>Only jobs posted in the last 30 days</strong><p>Listings must have a genuine published date. ${db.opportunities.length} reviewed job records, ${sources.greenhouse||0} employer-board results, ${sources.jobicy||0} Jobicy leads, ${sources.remotive||0} Remotive remote leads and ${sources.adzuna||0} optional Adzuna leads. Openings and wages need source confirmation. Undated postings and older jobs are excluded. Training programs below are not job vacancies.</p></div></div>`;
  return `<section class="hero"><div><div class="eyebrow">Local job research, built around you</div><h1>Find work that <span>fits your life.</span></h1>
    <p>Search around any San Gabriel Valley city. Compare pay, qualifications, location and deadlines for jobs posted in the past 30 days. Compare trade apprenticeships separately.</p>
    <div class="hero-chips"><span>31 SGV cities</span><span>Past 30 days only</span><span>In-person and remote options</span><span>Original source links</span></div></div>
    <aside class="hero-aside"><small>Your starting point</small><strong id="current-center">${text(filter.center)}</strong><p>Choose your city, narrow your interests, then open the original listing to check whether applications are still being accepted.</p><a class="hero-jump" href="#results-count">Browse matching jobs <span aria-hidden="true">&darr;</span></a></aside></section>
    ${sectionStats()}
    <section class="search-panel" aria-label="Search and filter jobs"><div class="panel-title"><h2>Find your next role</h2><p>Start broad, then narrow by city, pay and experience.</p></div>
    <div class="track-switch" role="group" aria-label="Job type">
      <button type="button" data-track="all" class="track ${filter.track==='all'?'selected':''}" aria-pressed="${filter.track==='all'}">All jobs</button>
      <button type="button" data-track="physical" class="track ${filter.track==='physical'?'selected':''}" aria-pressed="${filter.track==='physical'}">More movement</button>
      <button type="button" data-track="heritage" class="track ${filter.track==='heritage'?'selected':''}" aria-pressed="${filter.track==='heritage'}">History and books</button>
      <button type="button" data-track="collectibles" class="track ${filter.track==='collectibles'?'selected':''}" aria-pressed="${filter.track==='collectibles'}">Coins and auctions</button>
      <button type="button" data-track="digital" class="track ${filter.track==='digital'?'selected':''}" aria-pressed="${filter.track==='digital'}">Shopify and tech</button>
      <button type="button" data-track="trades" class="track ${filter.track==='trades'?'selected':''}" aria-pressed="${filter.track==='trades'}">Skilled trades</button>
    </div>
    <div class="filter-grid">
      <div class="filter filter-query"><label for="job-query">Job title, skill or employer</label><input id="job-query" data-search type="search" value="${text(filter.query)}" placeholder="Try museum educator, Shopify, park ranger" autocomplete="off"></div>
      <div class="filter"><label for="center">Start from</label><select id="center" data-control="center">${startOptions()}</select></div>
      <div class="filter"><label for="radius">How far from your city?</label><select id="radius" data-control="radius">${opts([['10','Within 10 mi'],['15','Within 15 mi'],['30','Within 30 mi'],['50','Within 50 mi'],['75','Within 75 mi'],['all','All locations']],filter.radius)}</select></div>
      <div class="filter"><label for="category">Type of work</label><select id="category" data-control="category">${opts([['all','All fields'],...fields.map(x=>[x,x])],filter.category)}</select></div>
    </div>
    <details class="advanced"><summary>More ways to narrow your results</summary><div class="advanced-grid">
      <div class="filter"><label for="sort">Order jobs</label><select id="sort" data-control="sort">${opts([['closest','Closest first'],['newest','Most recently posted'],['deadline','Closing soon'],['pay','Highest published pay']],filter.sort)}</select></div>
      <div class="filter"><label for="age">Published within</label><select id="age" data-control="age">${opts([['all','Last 30 days'],['7','7 days'],['14','14 days']],filter.age)}</select></div>
      <div class="filter"><label for="minPay">Minimum published pay (hourly equivalent)</label><select id="minPay" data-control="minPay">${opts([['all','Any / undisclosed'],['20','$20+ / hr'],['25','$25+ / hr'],['30','$30+ / hr'],['40','$40+ / hr']],filter.minPay)}</select></div>
    </div><div class="checks"><label><input type="checkbox" data-control="saved" ${isChecked(filter.saved)}> Saved only</label>
      <label><input type="checkbox" data-control="includeRemote" ${isChecked(filter.includeRemote)}> Include US-eligible remote jobs</label>
      <label><input type="checkbox" data-control="archived" ${isChecked(filter.archived)}> Include recent jobs with passed deadlines</label></div></details>
    <div class="panel-foot"><span id="center-label">Distances are approximate and measured between city centers. Not driving times.</span><button class="button button-light" id="reset-filters" type="button">Clear filters</button></div>
    </section>${feed}
    <div id="results-count" class="results-bar" aria-live="polite"></div>
    <div id="job-results"></div>
    ${apprenticeshipSection()}
    ${roleExplorer()}
    <div class="method-note"><strong>Before you apply</strong><p>Every lead links to its source. Pay, dates and qualifications come from available listings and may be incomplete or outdated. Posting age uses the published date, not the day this site discovered the job. A working link is not proof of an open position. Verify the full requirements and deadline with the employer.</p></div>`;
}
function appliedFilters(){
  const fields={
    query:filter.query.trim()?`Search: ${filter.query.trim().slice(0,34)}`:null,
    radius:filter.radius!==defaults.radius?`Radius: ${filter.radius==='all'?'all locations':filter.radius+' mi'}`:null,
    category:filter.category!=='all'?filter.category:null,
    track:filter.track!=='all'?{
      physical:'More movement',heritage:'History and books',collectibles:'Coins and auctions',digital:'Shopify and tech',trades:'Skilled trades'
    }[filter.track]:null,
    age:filter.age!=='all'?`Published: ${filter.age==='unknown'?'date missing':filter.age+' days'}`:null,
    minPay:filter.minPay!=='all'?`At least $${filter.minPay}/hr`:null,
    saved:filter.saved?'Saved only':null,
    archived:filter.archived?'Past deadlines included':null
  };
  return Object.entries(fields).filter(([,label])=>Boolean(label));
}
function filterSummary(){
  const chips=appliedFilters().map(([key,label])=>
    `<button type="button" class="filter-chip" data-clear-filter="${text(key)}" aria-label="Remove ${text(label)} filter">${text(label)} <span aria-hidden="true">&times;</span></button>`).join('');
  return chips?`<div class="active-filters" aria-label="Applied filters">${chips}</div>`:'';
}
function renderJobResults(){
  const filtered=sortJobs(jobs(),filter.sort,filter.center,db.geo),counter=document.querySelector('#results-count'),container=document.querySelector('#job-results');
  const shown=filtered.slice(0,visibleCount);
  if(!counter||!container)return;
  const nearby=normalizeJobs().filter(j=>{const n=jobMiles(j,filter.center,db.geo);return n!==null&&n<=15&&deadlineStatus(j.deadline).key!=='passed';}).length;
  const nearbyNode=document.querySelector('#nearby-count');if(nearbyNode)nearbyNode.textContent=String(nearby);
  const savedNode=document.querySelector('#saved-count');if(savedNode)savedNode.textContent=String(normalizeJobs().filter(j=>state.favorites[j.id]).length);
  counter.innerHTML=`<div><h2>${filtered.length} ${filtered.length===1?'job matches':'jobs match'} your search</h2><p>${text(filter.sort==='closest'?`Nearest to ${filter.center} first`:{newest:'Most recently published first',deadline:'Upcoming deadlines first',pay:'Highest comparable pay first'}[filter.sort]||'Nearest first')}. Check current status before applying.</p>${filterSummary()}</div><span class="count-label">${normalizeJobs().length} source-linked records · ${db.role_ideas?.length||0} additional role searches</span>`;
  if(!filtered.length){container.innerHTML='<div class="empty"><h3>No matching recent jobs</h3><p>Expand your radius or try a different city. See trade training programs below and browse additional role searches.</p><button class="button button-primary" type="button" id="reset-filters">Clear filters</button></div>';return;}
  const more=filtered.length>shown.length?`<div class="more-jobs"><p>Showing ${shown.length} of ${filtered.length} matching records</p><button type="button" class="button button-light" data-more-jobs>Show ${Math.min(PAGE_SIZE,filtered.length-shown.length)} more jobs</button></div>`:'';
  if(filter.sort!=='closest'){container.innerHTML=`<div class="job-grid">${shown.map(card).join('')}</div>${more}`;return;}
  const groups=new Map();for(const j of shown){const k=distanceBand(jobMiles(j,filter.center,db.geo));if(!groups.has(k))groups.set(k,[]);groups.get(k).push(j);}
  container.innerHTML=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([k,rows])=>`<section class="group"><div class="group-head"><h3>${text(bandNames[k])}</h3><span>${rows.length} ${rows.length===1?'role':'roles'} shown</span></div><div class="job-grid">${rows.map(card).join('')}</div></section>`).join('')+more;
}
/** Apprentice program references are not job postings and have no invented posting date. */
function apprenticeshipSection(){
  return `<section id="apprenticeships" class="apprenticeship-section" aria-labelledby="apprenticeship-title">
    <div class="section-title"><h2 id="apprenticeship-title">Union apprenticeships and skilled trades</h2>
    <p>Compare paid training and hands-on work. These are standing programs or recruitment calendars, not jobs posted within 30 days. Verify each intake before applying.</p></div>
    <div class="trade-quicklinks"><span>Explore:</span><a href="#apprenticeship-list">Electrical</a><a href="#apprenticeship-list">Sprinkler fitting</a><a href="#apprenticeship-list">Welding</a><a href="#apprenticeship-list">Elevators</a><a href="#apprenticeship-list">Piping and HVAC</a></div>
    <div id="apprenticeship-list"></div></section>`;
}
function renderApprenticeships(){
  const dest=document.querySelector('#apprenticeship-list');if(!dest)return;
  const programs=[...(db.apprenticeships||[])].sort((a,b)=>
    (jobMiles(a,filter.center,db.geo)??9999)-(jobMiles(b,filter.center,db.geo)??9999));
  const shown=apprenticeshipExpanded?programs:programs.slice(0,6);
  dest.innerHTML=`<div class="apprenticeship-grid">${shown.map(p=>{
    const distance=jobMiles(p,filter.center,db.geo);
    return `<article class="apprenticeship-card"><div class="pills"><span class="pill trade-kind">${text(p.kind)}</span><span class="pill">${distance===null?'Region-wide / see program':`≈ ${distance} mi from ${text(filter.center)}`}</span></div>
      <h3>${text(p.title)}</h3><p class="company">${text(p.sponsor)} · ${text(p.city)}</p>
      <div class="trade-status"><strong>Application status</strong><span>${text(p.status)}</span></div>
      <p class="trade-work">${text(p.work)}</p>
      <div class="qualifications"><h4>Qualifications to check</h4><p>${text(p.requirements)}</p></div>
      <p class="trade-pay"><strong>Pay:</strong> ${text(p.pay)}</p>
      <p class="trade-action">${text(p.action)}</p>
      ${link(p.url,'Check official apprenticeship details','button button-light',`Official apprenticeship details for ${p.sponsor}`)}
    </article>`;}).join('')}</div>
    ${programs.length>6?`<button class="button button-light" type="button" data-show-apprenticeships>${apprenticeshipExpanded?'Show fewer programs':`Show all ${programs.length} apprenticeship programs`}</button>`:''}`;
}
function roleExplorer(){return `<details id="role-explorer" class="idea-section"><summary><span><small>Broaden the search</small><strong>Explore ${db.role_ideas?.length||0} other job titles</strong><span class="idea-note">Take your search beyond the saved leads. These links open live searches, not verified vacancies.</span></span><span class="idea-arrow" aria-hidden="true">+</span></summary>
    <div class="idea-body"><div class="idea-controls"><div class="filter"><label for="idea-query">Search role ideas</label><input id="idea-query" data-idea-search type="search" value="${text(ideasQuery)}" placeholder="Coin, Shopify, garden…"></div>
    <div class="filter"><label for="idea-category">Type of work</label><select id="idea-category" data-idea-category>${opts([['all','All interests'],...new Set((db.role_ideas||[]).map(x=>x.category))].map(x=>Array.isArray(x)?x:[x,x]),ideasCategory)}</select></div></div>
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
      return `<article class="idea-card tone-${categoryTone(r.category)}"><span>${text(r.category)}</span><h4>${text(r.title)}</h4><p>${text(r.summary)}</p><p class="idea-qual"><strong>Typical qualifications:</strong> ${text(r.typicalQualifications)}</p><small>${text(r.movement)}</small><div class="idea-links">${link(indeed,'Search jobs','',`Search job listings for ${r.title}`)}${link(gov,'Public-sector search','',`Search public-sector listings for ${r.title}`)}</div></article>`;}).join('')}</div>
    ${filtered.length>12?`<button class="button button-light show-ideas" type="button" data-show-ideas>${ideasExpanded?'Show fewer roles':`Show all ${filtered.length} roles`}</button>`:''}`;
}
function renderJobs(){root.innerHTML=shell();renderJobResults();renderApprenticeships();renderRoleResults();}
function renderExplore(){
  const careers=db.careers||[],sites=[...db.places].sort((a,b)=>(jobMiles(a,state.center,db.geo)??9999)-(jobMiles(b,state.center,db.geo)??9999));
  const tasks=db.tasks||[],done=tasks.filter(x=>state.completed[x.id]).length;
  const careerCards=careers.map(c=>`<article class="career-card tone-${categoryTone(c.category)}"><small>${text(c.category)}</small><h3>${text(c.title)}</h3><p>${text(c.summary)}</p><p class="career-step"><strong>First experiment:</strong> ${text(c.firstSteps?.[0]||'Talk with someone doing this work.')}</p></article>`).join('');
  root.innerHTML=`<section class="explore-intro"><div class="eyebrow">Career experiments</div><h1>Explore the work, <span>not just the title.</span></h1><p>Career ideas include field-based work, tangible goods and a practical digital fallback. Sample the daily duties before committing to retraining.</p></section>
    <div class="section-title"><h2>Ways to change direction</h2><p>${careers.length} paths, including hands-on work and technology roles that use your existing experience.</p></div><div class="career-grid">${careerCards}</div>
    <div class="section-title"><h2>See the work up close</h2><p>Visit nearby employers, ask about daily duties and find out what qualifications matter.</p></div>
    <div class="places-grid">${sites.map(s=>`<article class="place-card"><h3>${text(s.name)}</h3><span>${text(s.city)} · ${text(jobMiles(s,state.center,db.geo)??'N/A')} mi from ${text(state.center)}</span><p>${text(s.bestFor)}</p>${link(s.url,'Official website','',`Visit the website for ${s.name}`)}</article>`).join('')}</div>
    <div class="section-title"><h2>Test a path in small steps</h2><p>Build evidence from real work before making a larger career change.</p></div><div class="checklist"><div class="plan-count"><strong>${done} of ${tasks.length} completed</strong><span>${tasks.length?Math.round(done/tasks.length*100):0}%</span></div><div class="progress"><span style="width:${tasks.length?done/tasks.length*100:0}%"></span></div>
      ${tasks.map(t=>`<label class="task ${state.completed[t.id]?'completed':''}"><input type="checkbox" data-task="${text(t.id)}" ${isChecked(state.completed[t.id])}><span><strong>${text(t.title)}</strong><small>${text(t.detail)}</small></span></label>`).join('')}
    </div><div class="method-note"><strong>What this guide can and cannot tell you</strong><p>These are starting points drawn from publicly expressed interests, not an assessment of your personality or employability. Test the work in person. Always confirm pay, duties and entry requirements with the employer. ${link('https://vectorle.xyz/','Original context website')}.</p></div>`;
}
function render(){current=location.hash==='#explore'?'explore':'jobs';document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});if(!db)return;current==='explore'?renderExplore():renderJobs();}

root.addEventListener('input',event=>{
  if(event.target.matches('[data-search]')){visibleCount=PAGE_SIZE;filter.query=event.target.value;renderJobResults();}
  if(event.target.matches('[data-idea-search]')){ideasQuery=event.target.value;ideasExpanded=false;renderRoleResults();}
});
root.addEventListener('change',event=>{
  const control=event.target.dataset.control;
  if(control){visibleCount=PAGE_SIZE;filter[control]=event.target.type==='checkbox'?event.target.checked:event.target.value;
    if(control==='includeRemote'){state.includeRemote=filter.includeRemote;persist();}
    if(control==='center'){state.center=filter.center;persist();const node=document.querySelector('#center-label');if(node)node.textContent=`Starting in ${filter.center}. Straight-line city-center distances.`;const here=document.querySelector('#current-center');if(here)here.textContent=filter.center;}
    renderJobResults();renderApprenticeships();renderRoleResults();
  }
  if(event.target.matches('[data-idea-category]')){ideasCategory=event.target.value;ideasExpanded=false;renderRoleResults();}
  const task=event.target.dataset.task;
  if(task){
    state.completed[task]=event.target.checked;persist();
    event.target.closest('.task')?.classList.toggle('completed',event.target.checked);
    const count=db.tasks.filter(item=>state.completed[item.id]).length;
    const total=db.tasks.length;
    const summary=document.querySelector('.plan-count strong');
    const pct=document.querySelector('.plan-count span');
    const bar=document.querySelector('.progress span');
    if(summary)summary.textContent=`${count} of ${total} completed`;
    if(pct)pct.textContent=`${total?Math.round(count/total*100):0}%`;
    if(bar)bar.style.width=`${total?count/total*100:0}%`;
  }
});
root.addEventListener('click',event=>{
  const save=event.target.closest('[data-save-id]');
  if(save){state.favorites[save.dataset.saveId]=!state.favorites[save.dataset.saveId];persist();renderJobResults();return;}
  const pick=event.target.closest('[data-track]');
  if(pick){visibleCount=PAGE_SIZE;filter.track=pick.dataset.track;document.querySelectorAll('[data-track]').forEach(el=>{const yes=el.dataset.track===filter.track;el.classList.toggle('selected',yes);el.setAttribute('aria-pressed',String(yes));});renderJobResults();renderRoleResults();if(filter.track==='trades'){document.querySelector('#apprenticeships')?.scrollIntoView({behavior:'smooth',block:'start'});}return;}
  const clear=event.target.closest('[data-clear-filter]');
  if(clear){visibleCount=PAGE_SIZE;filter[clear.dataset.clearFilter]=defaults[clear.dataset.clearFilter];renderJobs();return;}
  if(event.target.closest('#reset-filters')){visibleCount=PAGE_SIZE;filter={...defaults,center:state.center,includeRemote:state.includeRemote};ideasQuery='';ideasCategory='all';renderJobs();return;}
  if(event.target.closest('[data-more-jobs]')){visibleCount+=PAGE_SIZE;renderJobResults();return;}
  if(event.target.closest('[data-show-ideas]')){ideasExpanded=!ideasExpanded;renderRoleResults();}
  if(event.target.closest('[data-show-apprenticeships]')){apprenticeshipExpanded=!apprenticeshipExpanded;renderApprenticeships();}
});
window.addEventListener('hashchange',render);

async function start(){
  try{
    const keys=['opportunities','live_jobs','careers','places','tasks','geo','snapshot','role_ideas','apprenticeships'];
    const seed=document.querySelector('#job-seed');
    const embedded=seed?JSON.parse(seed.textContent):null;
    const data=embedded?keys.map(key=>embedded[key]):await Promise.all(keys.map(async key=>{
      const r=await fetch('./data/'+key+'.json');
      if(!r.ok)throw new Error(key+': HTTP '+r.status);
      return r.json();
    }));
    db=Object.fromEntries(keys.map((key,i)=>[key==='live_jobs'?'live':key,data[i]]));
    cachedJobs=null;
    if(![...db.geo.centers,...(db.geo.communities||[])].includes(state.center))state.center=db.geo.reference;
    filter.center=state.center;
    filter.includeRemote=state.includeRemote;
    render();
  }catch(error){
    // Preserve the static job listings shipped in index.html. Never blank the page on error.
    const warning=document.createElement('p');warning.className='load-warning';warning.textContent='Interactive filters are unavailable. Browse the job links below, then refresh or check deployment settings.';
    root.prepend(warning);
    console.error('Failed to initialize job watch:',error);
  }
}
start();
