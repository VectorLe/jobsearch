import {dimensions,defaultWeights,esc,safeURL,todayLA,prettyDate,deadlineStatus,freshnessDays,scoreCareer,rankCareers,careerMatches,grossAnnual,runwayMonths,countProgress,byClosing} from './logic.js';
import {loadState,saveState,cleanImported,downloadJSON,initialState} from './storage.js';

const main=document.querySelector('#main-content');
const nav=document.querySelector('.nav');
const persistent=loadState();
const ui={query:'',category:'All',minimumMovement:1,jobQuery:'',jobFilter:'all',placeFilter:'All',sourceFilter:'All',showArchived:false};
let db=null;
const salary=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
const badge=(label,tone='muted')=>`<span class="badge ${tone}">${esc(label)}</span>`;
const ext=(url,label,cls='text-link')=>`<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer" class="${cls}">${esc(label)} ↗</a>`;
const head=(eyebrow,title,description,right='')=>`<div class="page-header"><div><span class="eyebrow">${esc(eyebrow)}</span><h1>${title}</h1><p>${esc(description)}</p></div>${right}</div>`;
const section=(eyebrow,title,right='')=>`<div class="section-heading"><div><span class="section-kicker">${esc(eyebrow)}</span><h2>${title}</h2></div>${right}</div>`;
const bars=(n,color='')=>`<div class="score-track ${color}"><span style="width:${Math.max(0,Math.min(100,(Number(n)||0)*20))}%"></span></div>`;
const number=(n)=>Number(n||0).toFixed(1);
const list=items=>`<ul class="compact-list">${items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`;
const empty=(msg)=>`<div class="empty">${esc(msg)}</div>`;
const fields=(path)=>db.careers.find(c=>c.id===path);
const snapshotJob=(id)=>db.snapshot?.links?.[id] || null;
const externalHealth=(record)=>{
  if(!record)return 'Link not checked';
  if(record.result==='reachable')return 'URL responds (not hiring confirmation)';
  if(record.result==='blocked')return 'Website blocked automated check';
  if(record.result==='unreachable')return 'Link unavailable at last check';
  return 'Link status unconfirmed';
};
function allJobs(){
  return [...db.opportunities, ...(db.live?.jobs||[]).map(x=>({...x,liveFeed:true,category:x.category||'Feed',priority:'medium',careerIds:[],observedAt:x.seenAt||db.live.generatedAt?.slice(0,10)||'',note:x.note||'Third-party job feed; verify relevance, qualifications, and status with employer.',deadline:null}))];
}
function renderOverview(){
  const progress=countProgress(db.tasks,persistent.completed);
  const upcoming=db.opportunities.filter(j=>['soon','today','dated'].includes(deadlineStatus(j.deadline).key)).sort((a,b)=>byClosing(a,b)).slice(0,4);
  const ranked=rankCareers(db.careers,{...defaultWeights,...persistent.weights});
  const stats=[{value:db.careers.length,label:'Career paths',sub:'16 detailed routes'},{value:db.places.length,label:'Local field sites',sub:'Outside central LA'},{value:allJobs().length,label:'Job leads',sub:'Status checked daily'},{value:`${progress.pct}%`,label:'90-day plan',sub:`${progress.done} of ${progress.total} steps`}];
  return `<div class="page">
    <section class="hero"><span class="eyebrow">FIELD DOSSIER — SOUTHERN CALIFORNIA / 2026</span><h1>Work worth <em class="accent">walking toward.</em></h1>
    <p>A different career, built around ideas, real places, tangible objects and physical engagement. Explore viable paths in heritage, parks, books, gold and silver, teaching and independent enterprise.</p>
    <div class="hero-actions"><a class="btn btn-primary" href="#/careers">Explore the paths <span>→</span></a><a class="btn btn-outline" href="#/plan">Start the 90-day plan <span>→</span></a></div></section>
    <div class="stat-grid">${stats.map(s=>`<div class="stat-card"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div><div class="stat-sub">${s.sub}</div></div>`).join('')}</div>
    ${section('01 / RECOMMENDED PATHS','The strongest hypotheses',`<a href="#/compare" class="text-link">CUSTOMIZE RANKINGS ↗</a>`)}
    <div class="grid-3">${['heritage','auction','garden'].map((id,i)=>{const c=fields(id);return `<article class="card top-path"><div class="card-topline"><span class="num">0${i+1} / PRIMARY TRACK</span>${badge(c.tagline,i===0?'green':'muted')}</div><h3>${esc(c.title)}</h3><p>${esc(c.why)}</p><div class="card-foot"><span class="micro-label">MOVEMENT ${c.scores.movement}/5 · SUBJECT ${c.scores.subject}/5</span><a href="#/careers/${c.id}">OPEN DOSSIER →</a></div></article>`;}).join('')}</div>
    <div class="split" style="margin-top:26px">
     <div class="card card-flat"><div class="ribbon">${badge('DEADLINE MONITOR','blue')}<span class="micro-label">RESEARCHED NOV 11, 2026 · NOT LIVE HIRING CONFIRMATION</span></div><h3>Opportunities to check</h3>
      ${upcoming.length?upcoming.map(j=>jobRow(j)).join(''):empty('No known future deadlines among the manually verified 2026 leads. Use Job Watch for archival listings and the optional feed.')}
      <a class="text-link" href="#/opportunities">VIEW ALL JOB LEADS ↗</a>
     </div>
     <div class="card card-flat"><span class="kicker">THE CENTRAL QUESTION</span><h3>Do you love the subject — or the work?</h3>
      <p>A museum can be bureaucratic. A coin dealer may spend hours on retail and security. An independent guide must sell, schedule and handle customers. Test the daily routine before changing careers.</p>
      <div class="signal-list"><div class="signal"><strong>Observed evidence</strong><p>Broad reading, completed athletic milestones, and a physical-product business project.</p></div><div class="signal"><strong>Working hypothesis</strong><p>Intellectual variety + movement + tangible results may outperform another desk-heavy role.</p></div><div class="signal"><strong>Not yet known</strong><p>Minimum income, speaking comfort, tolerance for repetition, and appetite for business risk.</p></div></div>
      <div class="card-foot"><span class="micro-label">NO CLINICAL CLAIMS</span><a href="#/profile">EVIDENCE & LIMITATIONS →</a></div>
     </div>
    </div>
    ${section('02 / A CAREER IS A ROUTINE','Working-life comparison',`<a class="text-link" href="#/careers">ALL ${db.careers.length} PATHS ↗</a>`)}
    <div class="card card-flat"><div class="score-stack">${ranked.slice(0,6).map(c=>`<div><div class="score-label"><a href="#/careers/${c.id}" style="text-decoration:none">${esc(c.title)}</a><strong>${number(scoreCareer(c,{...defaultWeights,...persistent.weights}))} / 5</strong></div>${bars(scoreCareer(c,{...defaultWeights,...persistent.weights}),'yellow')}</div>`).join('')}</div><p class="fineprint" style="margin-top:18px">Scores are qualitative editorial estimates, not psychometric findings. Modify the weights in Compare Paths.</p></div>
    <div class="neutral-note" style="margin-top:23px"><strong>How daily updates work:</strong> A scheduled GitHub workflow recalculates deadlines, checks known source URLs, and optionally fetches fresh matching jobs when API credentials are configured. Reachable links are <em>not</em> confirmation that positions remain open. <a href="#/sources">Read methodology →</a></div>
  </div>`;
}
function careerCard(c){return `<article class="card career-card"><div class="card-topline"><span class="micro-label">${esc(c.category)}</span>${badge(c.tagline,'muted')}</div><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><div class="career-tags"><span class="pill">Movement ${c.scores.movement}/5</span><span class="pill">Entry ${c.scores.entry}/5</span><span class="pill">Learning ${c.scores.learning}/5</span></div><div class="card-foot"><span class="micro-label">FIT ${number(scoreCareer(c,{...defaultWeights,...persistent.weights}))} / 5</span><a href="#/careers/${c.id}">VIEW PATH →</a></div></article>`;}
function renderCareers(){
 const cats=['All',...new Set(db.careers.map(c=>c.category))];
 const arr=rankCareers(db.careers,{...defaultWeights,...persistent.weights}).filter(c=>careerMatches(c,ui.query,ui.category,Number(ui.minimumMovement)));
 return `<div class="page">${head('CAREER INTELLIGENCE / 02','Explore the <em>possibilities.</em>','Each path covers real tasks, qualifications, risks, the first experiment and likely lifestyle trade-offs.')}
  <div class="filterbar"><label class="search-wrap"><span class="search-icon">⌕</span><input class="input" type="search" data-control="career-search" placeholder="Search roles, subjects, skills…" value="${esc(ui.query)}" aria-label="Search career paths"></label>
  <select class="select" data-control="career-category" aria-label="Filter career category">${cats.map(c=>`<option value="${esc(c)}" ${ui.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
  <select class="select" data-control="career-movement" aria-label="Minimum movement"><option value="1" ${ui.minimumMovement==1?'selected':''}>All movement levels</option><option value="3" ${ui.minimumMovement==3?'selected':''}>Movement ≥ 3/5</option><option value="4" ${ui.minimumMovement==4?'selected':''}>Movement ≥ 4/5</option><option value="5" ${ui.minimumMovement==5?'selected':''}>Highly physical only</option></select></div>
  <p class="result-count">${arr.length} of ${db.careers.length} paths · rankings respond to the priorities set in Compare Paths</p>
  <div class="career-grid">${arr.length?arr.map(careerCard).join(''):empty('No roles match these filters.')}</div>
  <div class="alert-note" style="margin-top:22px"><strong>Keep subject fit and daily-task fit separate.</strong> All scores are research hypotheses; an employer's actual schedule and duties take priority over our estimates.</div></div>`;
}
function careerDetail(id){const c=fields(id);if(!c)return renderCareers();
 const jobs=db.opportunities.filter(j=>(j.careerIds||[]).includes(c.id));
 return `<div class="page"><a href="#/careers" class="detail-back">← ALL CAREER PATHS</a>
   <div class="detail-hero"><span class="eyebrow">PATH DOSSIER / ${esc(c.category.toUpperCase())}</span><div class="ribbon" style="margin-top:12px">${badge(c.tagline,'green')}<span class="pill">Transition: ${esc(c.transition)}</span></div><h1>${esc(c.title)}</h1><p>${esc(c.summary)}</p><div class="hero-actions"><a class="btn btn-primary" href="#/plan">Add real-world test →</a><a class="btn btn-outline" href="#/compare">Compare paths ↗</a></div></div>
   <div class="split" style="margin-top:15px"><div class="card card-flat detail-column"><span class="kicker">THE MATCH</span><h3>Why this path appears promising</h3><p>${esc(c.why)}</p><hr><h3>A typical workday includes</h3>${list(c.day)}</div>
   <div class="card card-flat"><span class="kicker">QUALITATIVE FIT MAP</span><h3>Six dimensions</h3><div class="score-stack">${dimensions.map(d=>`<div><div class="score-label"><span>${esc(d.label)}</span><strong>${c.scores[d.key]}/5</strong></div>${bars(c.scores[d.key],d.key==='movement'?'yellow':'')}</div>`).join('')}</div><p class="fineprint" style="margin-top:15px">Estimated fit, not a measured personality score.</p></div></div>
   <div class="grid-3 detail-section"><div class="card detail-column"><span class="kicker">REALITY CHECK</span><h3>Trade-offs</h3>${list(c.risks)}</div><div class="card detail-column"><span class="kicker">FIRST MOVES</span><h3>Test it cheaply</h3>${list(c.firstSteps)}</div><div class="card detail-column"><span class="kicker">REQUIREMENTS</span><h3>Skills & eligibility</h3>${list(c.credentials)}</div></div>
   <div class="grid-2 detail-section"><div class="card"><span class="kicker">INCOME OUTLOOK</span><h3>Do the numbers work?</h3><p>${esc(c.payOutlook)}</p><a href="#/finances" class="text-link">OPEN INCOME PLANNER ↗</a></div><div class="card"><span class="kicker">WHERE TO START</span><h3>${esc(c.primaryLead)}</h3><div class="button-row">${c.links.map(x=>ext(x.url,x.label,'btn btn-small btn-outline')).join('')}</div></div></div>
   ${jobs.length?`${section('MATCHED ROLES','Related job leads') }<div class="card card-flat">${jobs.map(jobRow).join('')}</div>`:''}
   <div class="neutral-note" style="margin-top:22px">An interest in a field does not establish its professional credentials or a guaranteed income. Request accurate job descriptions and confirm minimum requirements directly with the employer.</div>
   </div>`;
}
function renderCompare(){
 const weights={...defaultWeights,...persistent.weights};const ordered=rankCareers(db.careers,weights);let a=fields(persistent.compareA)||ordered[0],b=fields(persistent.compareB)||ordered[1];
 const sel=(which,v)=>`<select class="select" data-control="compare-${which}" aria-label="Choose ${which==='a'?'first':'second'} career">${db.careers.map(c=>`<option value="${esc(c.id)}" ${v===c.id?'selected':''}>${esc(c.title)}</option>`).join('')}</select>`;
 return `<div class="page">${head('DECISION LAB / 03','Compare, don’t <em>guess.</em>','Choose two careers, adjust the priorities, and see how the working assumptions change.')}
  <div class="grid-2"><div class="card card-flat"><span class="kicker">YOUR PRIORITIES</span><h3>What actually matters?</h3><p>Move the sliders. Equal scales are subjective estimates; the weights make your priorities explicit.</p>
  ${dimensions.map(d=>`<div class="range-row"><label for="w-${d.key}">${esc(d.short)}</label><input type="range" min="0" max="5" step="1" id="w-${d.key}" data-control="weight" data-key="${d.key}" value="${weights[d.key]}"><output id="v-${d.key}">${weights[d.key]}</output></div>`).join('')}
  <button class="btn btn-small btn-outline" type="button" data-action="reset-weights" style="margin-top:15px">Reset weights</button></div>
  <div class="card card-flat"><span class="kicker">DYNAMIC RANKING</span><h3>Weighted shortlist</h3><div class="score-stack">${ordered.slice(0,8).map((c,i)=>`<div><div class="score-label"><span>${String(i+1).padStart(2,'0')} / ${esc(c.title)}</span><strong>${number(scoreCareer(c,weights))}</strong></div>${bars(scoreCareer(c,weights),'yellow')}</div>`).join('')}</div></div></div>
  ${section('HEAD-TO-HEAD','A closer look')}
  <div class="compare-selectors"><div class="compare-item"><span class="kicker">OPTION A</span>${sel('a',a.id)}<h3>${esc(a.title)}</h3><p class="subtle">${esc(a.why)}</p></div><div class="compare-item"><span class="kicker">OPTION B</span>${sel('b',b.id)}<h3>${esc(b.title)}</h3><p class="subtle">${esc(b.why)}</p></div></div>
  <div class="card card-flat" style="margin-top:13px"><div class="compare-row"><span class="micro-label">DIMENSION</span><span class="micro-label">OPTION A</span><span class="micro-label">OPTION B</span></div>
  ${dimensions.map(d=>`<div class="compare-row"><label>${esc(d.short)}</label><div>${bars(a.scores[d.key],'yellow')}<b>${a.scores[d.key]}/5</b></div><div>${bars(b.scores[d.key])}<b>${b.scores[d.key]}/5</b></div></div>`).join('')}
  <div class="compare-row"><label><strong>WEIGHTED FIT</strong></label><b>${number(scoreCareer(a,weights))} / 5</b><b>${number(scoreCareer(b,weights))} / 5</b></div><div class="compare-footer">These estimates organize judgment; they are not test-derived personality scores or earnings forecasts.</div></div></div>`;
}
function jobRow(j){const st=deadlineStatus(j.deadline);const tone=st.key==='passed'?'red':st.key==='soon'||st.key==='today'?'green':'muted';return `<div class="job-row"><div><div class="job-row-upper">${badge(st.label,tone)}<span class="micro-label">${esc(j.city)}</span></div><h4>${esc(j.title)}</h4><p>${esc(j.employer)} · ${esc(j.salary||'Pay not disclosed')}</p></div><a class="btn btn-small btn-outline" target="_blank" rel="noopener noreferrer" href="${esc(safeURL(j.sourceUrl))}">SOURCE ↗</a></div>`;}
function renderJobs(){
 const jobs=allJobs().filter(j=>{
  const state=deadlineStatus(j.deadline).key;
  const text=[j.title,j.employer,j.city,j.category,j.note].join(' ').toLowerCase();
  if(ui.jobQuery&&!text.includes(ui.jobQuery.toLowerCase()))return false;
  if(ui.jobFilter==='favorites'&&!persistent.favorites[j.id])return false;
  if(ui.jobFilter==='deadline'&&!['today','soon','dated'].includes(state))return false;
  if(ui.jobFilter==='expired'&&state!=='passed')return false;
  if(ui.jobFilter==='unknown'&&state!=='unknown')return false;
  return true;
 }).sort((a,b)=>byClosing(a,b));
 const last=db.snapshot?.generatedAt||null;const age=freshnessDays(last);
 const feed=db.live?.status==='ok'?`Adzuna returned ${(db.live.jobs||[]).length} recent external listings. Verify every match.`:'Optional new-job feed not configured; stored leads and deadlines still refresh daily.';
 return `<div class="page">${head('OPPORTUNITY RADAR / 04','The job <em>watch.</em>','Curated government, cultural and local roles plus optional API-sourced leads. Historical listings remain visible with expiration labels.')}
   <div class="grid-3"><div class="stat-card"><div class="stat-label">Stored research leads</div><div class="stat-value">${db.opportunities.length}</div><div class="stat-sub">Originally researched Nov 11, 2026</div></div><div class="stat-card"><div class="stat-label">Upcoming dated deadlines</div><div class="stat-value">${db.opportunities.filter(j=>['soon','today','dated'].includes(deadlineStatus(j.deadline).key)).length}</div><div class="stat-sub">Local-date calculation</div></div><div class="stat-card"><div class="stat-label">Last automated check</div><div class="stat-value" style="font-size:24px;margin-top:18px">${last?esc(prettyDate(last.slice(0,10))):'Pending'}</div><div class="stat-sub">${age===null?'No refresh recorded':age===0?'Checked today':age+' day(s) ago'}</div></div></div>
   <div class="neutral-note" style="margin-top:13px"><strong>Freshness rules:</strong> A deadline tells you when a posting was scheduled to close; an HTTP response does not prove continued recruitment. All roles require manual employer confirmation. ${esc(feed)}</div>
   <div class="filterbar"><label class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-control="job-search" type="search" placeholder="Search titles, employers, cities…" aria-label="Search job leads" value="${esc(ui.jobQuery)}"></label>
   <select class="select" data-control="job-filter" aria-label="Filter job leads"><option value="all" ${ui.jobFilter==='all'?'selected':''}>All leads</option><option value="deadline" ${ui.jobFilter==='deadline'?'selected':''}>Upcoming deadlines</option><option value="expired" ${ui.jobFilter==='expired'?'selected':''}>Passed deadlines</option><option value="unknown" ${ui.jobFilter==='unknown'?'selected':''}>Deadline unknown</option><option value="favorites" ${ui.jobFilter==='favorites'?'selected':''}>Saved leads</option></select>
   <button type="button" class="btn btn-outline" data-action="download-jobs">EXPORT JOB LEADS ↓</button></div>
   <p class="result-count">Showing ${jobs.length} opportunities · sorted by known filing deadline</p>
   <div class="job-grid">${jobs.length?jobs.map(j=>{const st=deadlineStatus(j.deadline);const health=snapshotJob(j.id);return `<article class="card job-card"><div class="card-topline"><span class="micro-label">${esc(j.category)}</span><button type="button" class="btn btn-small ${persistent.favorites[j.id]?'btn-primary':'btn-outline'}" data-action="favorite" data-id="${esc(j.id)}" aria-label="${persistent.favorites[j.id]?'Remove saved job':'Save job'}">${persistent.favorites[j.id]?'★ SAVED':'☆ SAVE'}</button></div><h3>${esc(j.title)}</h3><p><strong>${esc(j.employer)}</strong><br>${esc(j.city)} · ${esc(j.schedule||'Schedule varies')}</p><div class="ribbon">${badge(st.label,st.key==='passed'?'red':st.key==='today'||st.key==='soon'?'green':'muted')}${j.liveFeed?badge('EXTERNAL FEED','blue'):badge('CURATED RESEARCH','muted')}</div><div class="job-info"><p class="salary-big">${esc(j.salary||'Salary unspecified')}</p><p>${esc(j.note||'')}</p><p class="fineprint">${esc(externalHealth(health))} · Initially recorded ${esc(j.observedAt||'from feed')}</p><a class="btn btn-primary" href="${esc(safeURL(j.sourceUrl))}" target="_blank" rel="noopener noreferrer">CHECK EMPLOYER / SOURCE ↗</a></div></article>`;}).join(''):empty('No job leads match the current filters.')}</div>
   <div class="alert-note" style="margin-top:20px"><strong>Eligibility first:</strong> The Arcadia coordinator and museum education roles require specific prior experience. State park interpreter classifications may also have degree-content requirements. Never assume a general bachelor's degree substitutes.</div>
 </div>`;
}
function renderPlaces(){
 const categories=['All',...new Set(db.places.map(p=>p.category))];const places=db.places.filter(p=>ui.placeFilter==='All'||p.category===ui.placeFilter);
 const cities=['San Marino','Arcadia','Monrovia','Claremont','Upland','Ontario','Riverside'];
 return `<div class="page">${head('FIELD GUIDE / 05','Beyond the <em>desk.</em>','A regional directory of places to visit, volunteer, investigate or use to begin an informational interview. These are leads, not guaranteed vacancies.')}
 <div class="territory"><span class="kicker">GEOGRAPHIC CORRIDOR · NOT A ROUTE MAP</span><h3>East of Los Angeles</h3><p>A schematic exploration corridor—not travel directions or a measure of driving time. Filter local opportunities by interests below.</p><div class="territory-route">${cities.map(c=>`<div class="city-pill"><span>${esc(c)}</span></div>`).join('')}</div></div>
 <div class="tabs" role="group" aria-label="Local guide categories">${categories.map(c=>`<button class="tab ${ui.placeFilter===c?'active':''}" type="button" data-action="place-tab" data-value="${esc(c)}">${esc(c)}</button>`).join('')}</div>
 <p class="result-count" style="margin-top:18px">${places.length} local leads</p><div class="grid-3">${places.map(p=>`<article class="card place-card"><span class="micro-label">${esc(p.city)} / ${esc(p.category)}</span><h3>${esc(p.name)}</h3><p>${esc(p.bestFor)}</p><p class="place-addr">${esc(p.address)}</p><div class="card-foot">${ext(p.url,'WEBSITE','text-link')}${ext('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.address),'MAP','text-link')}</div></article>`).join('')}</div>
 <div class="neutral-note" style="margin-top:22px">Public visits and volunteer work provide low-risk exposure. Do not run commercial tours or teaching events at a museum or garden without permission; some venues explicitly restrict outside paid instruction.</div></div>`;
}
function renderProfile(){let p=db.profile;
 return `<div class="page">${head('EVIDENCE & HYPOTHESES / 06','An interest profile, <em>not a diagnosis.</em>','The personal website supplies evidence of interests and activities. It cannot establish clinical traits, psychometric scores, hidden motives or professional credentials.')}
   <div class="alert-note"><strong>Evidence standard:</strong> The site's own description treats many topics as subjects to learn about, not claims of expertise. A collection of books does not imply every title has been read. Behavioral inferences remain hypotheses until tested at work.</div>
   ${section('DIRECTLY OBSERVED','What the source actually supports')}
   <div class="grid-2">${p.observations.map(o=>`<article class="card"><div class="card-topline"><span class="micro-label">${esc(o.label)}</span>${badge(o.confidence,o.confidence==='High'?'green':'muted')}</div><div class="evidence-quote"><p>${esc(o.evidence)}</p><small>OBSERVED / SOURCE: ${ext(o.source,new URL(o.source).hostname,'text-link')}</small></div><p style="margin-top:17px"><strong>Interpretation:</strong> ${esc(o.interpretation)}</p></article>`).join('')}</div>
   ${section('UNCERTAINTY','What remains unknown')}
   <div class="grid-2"><div class="card"><span class="kicker">QUESTIONS THAT CHANGE THE RANKING</span><h3>Ask before committing</h3>${list(p.unknowns)}</div><div class="card"><span class="kicker">DECISION RULES</span><h3>Methodological safeguards</h3>${list(p.principles)}</div></div>
   ${section('YOUR OWN REACTIONS','Validate the hypotheses')}
   <div class="card card-flat"><p>Rate each experience only after a real shift, supervised trial or serious shadowing session. Scores stay in this browser and are not clinical measurements.</p><div class="grid-2">${['heritage','auction','garden','numismatic','coaching','walking-tours'].map(id=>{const c=fields(id);return `<div style="border-bottom:1px solid var(--line-dim);padding:12px 0"><div class="score-label"><strong>${esc(c.title)}</strong><span class="micro-label">ENJOYMENT</span></div><select class="select" data-control="self-rating" data-id="${id}" aria-label="Actual experience rating for ${esc(c.title)}"><option value="0">Not tested yet</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${(persistent.ratings[id]||0)===n?'selected':''}>${n}/5 — ${['','Poor','Fair','Good','Very good','Excellent'][n]}</option>`).join('')}</select></div>`}).join('')}</div></div>
 </div>`;
}
function renderPlan(){
 const cp=countProgress(db.tasks,persistent.completed);
 const phases=[{id:1,label:'Days 01–30',title:'Observe & test',text:'Learn the work behind the job title. Contact employers and volunteer programs; collect real-world evidence.'},{id:2,label:'Days 31–60',title:'Practice & validate',text:'Complete multiple shifts, one physical work trial, and an educational or entrepreneurship pilot.'},{id:3,label:'Days 61–90',title:'Choose & transition',text:'Compare experiences, confirm eligibility and financial sustainability, then apply selectively.'}];
 return `<div class="page">${head('FIELD PLAN / 07','Ninety days to <em>clarity.</em>','A concrete transition experiment designed to minimize irreversible commitments and maximize direct experience.',`<div class="button-row"><button class="btn btn-outline" type="button" data-action="export-state">BACK UP PROGRESS ↓</button><button class="btn btn-outline" type="button" data-action="import-state">RESTORE BACKUP ↑</button></div>`)}
 <div class="card card-flat"><div class="footer-row"><div><span class="kicker">EXPERIMENT COMPLETION</span><div class="salary-big" style="margin:3px 0">${cp.done}<span class="subtle"> / ${cp.total} complete</span></div></div><strong>${cp.pct}%</strong></div><div class="progress-rail"><span style="width:${cp.pct}%"></span></div><p class="fineprint" style="margin:13px 0 0">Your task status and notes are saved only in this browser. Back up the file if you switch devices or clear browser storage.</p></div>
 <div class="phase-grid" style="margin-top:15px">${phases.map(p=>`<div class="card phase-card"><span class="kicker">${p.label.toUpperCase()}</span><h3>${p.title}</h3><p>${p.text}</p></div>`).join('')}</div>
 ${phases.map(p=>`<div class="phase-row"><div><span class="section-kicker">PHASE 0${p.id} / ${p.label.toUpperCase()}</span><h3>${p.title}</h3></div><span class="micro-label">${db.tasks.filter(t=>t.phase===p.id&&persistent.completed[t.id]).length} / ${db.tasks.filter(t=>t.phase===p.id).length} DONE</span></div>
  <div class="card card-flat task-list">${db.tasks.filter(t=>t.phase===p.id).map(t=>`<div class="task ${persistent.completed[t.id]?'complete':''}"><input type="checkbox" id="task-${esc(t.id)}" data-control="task" data-id="${esc(t.id)}" ${persistent.completed[t.id]?'checked':''}><label for="task-${esc(t.id)}"><strong>${esc(t.title)}</strong><span>${esc(t.detail)}</span></label>${t.priority==='urgent'?badge('TIME-SENSITIVE','red'):''}</div>`).join('')}</div>`).join('')}
 ${section('FIELD JOURNAL','Notes from the actual work')}
 <div class="card"><label class="micro-label" for="field-notes">WHAT DID THE DAY FEEL LIKE?</label><textarea class="textarea" id="field-notes" data-control="journal" placeholder="Examples: two hours of standing felt fine; enjoyed discussing an artifact; disliked repetitive ticket sales; found customer interaction energizing…">${esc(persistent.notes)}</textarea><div class="footer-row" style="margin-top:10px"><span class="fineprint">Autosaved to this browser. No network submission.</span><span class="micro-label" id="save-message">LOCAL NOTES</span></div></div>
 <input class="hidden" type="file" accept="application/json,.json" id="import-file" aria-label="Import saved progress">
 </div>`;
}
function renderFinances(){
 const f=persistent.finances||initialState().finances;
 const annual=grossAnnual(f.hourly,f.hours,f.weeks);
 const monthly=annual/12;
 const run=runwayMonths(f.savings,f.expenses);
 const financialFields=[{key:'hourly',title:'Target hourly pay ($)',min:0,max:500,step:1},{key:'hours',title:'Paid hours per week',min:0,max:80,step:1},{key:'weeks',title:'Paid weeks per year',min:0,max:52,step:1},{key:'expenses',title:'Required monthly spending ($)',min:0,max:100000,step:100},{key:'savings',title:'Liquid transition savings ($)',min:0,max:10000000,step:100}];
 return `<div class="page">${head('FINANCIAL REALITY / 08','Make the leap <em>sustainable.</em>','An intentionally simple financial worksheet. Figures are user-controlled scenarios, not verified pay offers or financial advice.')}
 <div class="split"><div class="card"><span class="kicker">YOUR SCENARIO / LOCAL ONLY</span><h3>Adjust the assumptions</h3><div class="form-grid">${financialFields.map(x=>`<div class="form-field"><label for="f-${x.key}">${x.title}</label><input id="f-${x.key}" class="input" type="number" min="${x.min}" max="${x.max}" step="${x.step}" value="${esc(f[x.key])}" data-control="finance" data-key="${x.key}"></div>`).join('')}</div><p class="fineprint" style="margin-top:15px">Calculations are gross earnings and simple savings ÷ expenses. They exclude taxes, benefits, fees, health insurance, insurance premiums, debt changes and seasonal variability.</p></div>
 <div class="card"><span class="kicker">MODEL OUTPUT</span><h3>What your assumptions imply</h3><div class="calc-result"><div class="stat-card"><span class="stat-label">Annual gross</span><div class="stat-value">${salary(annual)}</div><span class="stat-sub">Before any taxes or benefits</span></div><div class="stat-card"><span class="stat-label">Monthly gross</span><div class="stat-value">${salary(monthly)}</div><span class="stat-sub">12-month average</span></div><div class="stat-card"><span class="stat-label">Savings runway</span><div class="stat-value">${run===null?'—':number(run)+' mo'}</div><span class="stat-sub">If zero income</span></div><div class="stat-card"><span class="stat-label">Gross less spending</span><div class="stat-value">${salary(monthly-Number(f.expenses||0))}</div><span class="stat-sub">Not after-tax cash flow</span></div></div></div></div>
 ${section('MARKET CONTEXT','National occupation medians')}
 <div class="card card-flat"><p>U.S. Bureau of Labor Statistics broad occupational medians (May 2025, from the accompanying research). They are not California entry offers. Compare with specific employer postings.</p>
  ${[['Tour and travel guides',38120],['Recreation workers',36560],['Tutors',43350],['Fitness trainers and instructors',47160],['Museum technicians and conservators',51440],['Carpenters',60580]].map(([name,pay])=>`<div class="score-label"><span>${name}</span><b>${salary(pay)}</b></div><div class="score-track yellow" style="margin-bottom:11px"><span style="width:${Math.round(pay/65000*100)}%"></span></div>`).join('')}
  <p class="fineprint">Research reference values are frozen until a person reviews the latest BLS data. The scheduled updater does not silently rewrite salary benchmarks.</p></div>
 <div class="alert-note" style="margin-top:20px"><strong>Do not compare only advertised hourly pay.</strong> Evaluate expected annual hours, eligibility, commute, insurance, retirement and training cost. A substitute museum role may pay more per hour but yield less total income than stable full-time recreation work.</div>
 </div>`;
}
function renderSources(){
 const types=['All',...new Set(db.sources.map(s=>s.type))];const src=db.sources.filter(s=>ui.sourceFilter==='All'||s.type===ui.sourceFilter);
 const last=db.snapshot?.generatedAt||null;
 return `<div class="page">${head('RESEARCH LOG / 09','Evidence, updates <em>& limits.</em>','Source links, freshness rules and the technical design of this independent dashboard.')}
 <div class="grid-2"><div class="card"><span class="kicker">METHOD / HONEST UNCERTAINTY</span><h3>What is known vs inferred</h3><p>Observed facts are drawn from the personal site, linked business and employer postings. Working preferences are hypotheses. Scores are editable qualitative estimates, not psychological testing.</p><p>Job links can remain accessible after hiring has closed. A daily HTTP status check means only that an automated client could reach the page; it does not validate vacancies.</p></div>
 <div class="card"><span class="kicker">AUTOMATION HEALTH</span><h3>Refresh status</h3><div class="salary-big" style="font-size:26px">${last?esc(prettyDate(last.slice(0,10))):'No run yet'}</div><p>Last automated URL and deadline check. ${last?`Exact recorded time: ${esc(last)}.`:'Run the Python updater to generate a snapshot.'}</p><p><strong>New-job discovery:</strong> ${db.live?.status==='ok'?'Adzuna feed configured.':'Optional Adzuna feed not configured.'} Daily curation of profile conclusions is not automated.</p><p class="fineprint">Scheduled GitHub Actions operate on the default branch; external APIs require credentials and may fail or be rate-limited.</p></div></div>
 ${section('SOURCE LIBRARY','Inspect the underlying references')}
 <div class="tabs" role="group" aria-label="Source types">${types.map(t=>`<button type="button" data-action="source-tab" data-value="${esc(t)}" class="tab ${ui.sourceFilter===t?'active':''}">${esc(t)}</button>`).join('')}</div>
 <div class="card card-flat" style="margin-top:15px">${src.map(s=>`<div class="source-row"><div><h4>${esc(s.title)}</h4><p>${esc(s.publisher)} · ${esc(s.type)}</p></div>${ext(s.url,'OPEN')}</div>`).join('')}</div>
 ${section('IMPLEMENTATION','Built for simple maintenance')}
 <div class="grid-3"><div class="card"><span class="kicker">NO BUILD STEP</span><h3>Native web platform</h3><p>HTML, CSS and ES modules. No React, build tooling, external fonts, tracking or runtime API keys. Fast static hosting.</p></div><div class="card"><span class="kicker">EDITABLE DATA</span><h3>Plain JSON</h3><p>Career paths, sites, tasks and verified job leads live in separate readable files. Edit them without changing the interface.</p></div><div class="card"><span class="kicker">DAILY CHECK</span><h3>GitHub Actions</h3><p>A standard-library Python script recalculates deadlines, records URL reachability and optionally downloads new third-party job results.</p></div></div>
 <div class="neutral-note" style="margin-top:22px">Privacy: imported notes, task checkboxes, preferences and financial scenarios are stored only in the current browser via localStorage. Do not store secret personal information in public GitHub JSON files. The site uses <code>noindex</code> as a request to search engines, not as access control. A private Netlify deployment requires separate access protection.</div>
 </div>`;
}
const routeLabels={overview:'OVERVIEW',careers:'CAREER PATHS',compare:'COMPARE',opportunities:'JOB WATCH',places:'FIELD GUIDE',profile:'EVIDENCE & FIT',plan:'ACTION PLAN',finances:'FINANCIALS',sources:'SOURCES'};
function route(){const part=(location.hash||'#/overview').replace(/^#\/?/,'').split('/').filter(Boolean);return [part[0]||'overview',part[1]||null];}
function render(focusId){
 if(!db)return;
 const [sectionName,id]=route();const section=routeLabels[sectionName]?sectionName:'overview';
 document.querySelector('#current-section').textContent=routeLabels[section];
 document.title=(routeLabels[section]||'Overview')+' — Fieldnotes Career Atlas';
 nav.querySelectorAll('[data-nav]').forEach(x=>{const active=x.dataset.nav===section;x.classList.toggle('active',active);if(active)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
 const pages={overview:renderOverview,careers:()=>id?careerDetail(id):renderCareers(),compare:renderCompare,opportunities:renderJobs,places:renderPlaces,profile:renderProfile,plan:renderPlan,finances:renderFinances,sources:renderSources};
 main.innerHTML=pages[section]();
 if(focusId){const el=main.querySelector(`[data-control="${focusId}"]`);if(el){el.focus();if(el.setSelectionRange&&['search','text'].includes(el.type)){el.setSelectionRange(el.value.length,el.value.length)}}}
}
function commit(){saveState(persistent)}
function controlledRender(key){render(key)}
main.addEventListener('input',e=>{
 const t=e.target,key=t.dataset.control;
 if(key==='career-search'){ui.query=t.value;controlledRender(key)}
 if(key==='job-search'){ui.jobQuery=t.value;controlledRender(key)}
 if(key==='weight'){persistent.weights[t.dataset.key]=Number(t.value);commit();document.querySelector('#v-'+t.dataset.key).textContent=t.value;}
 if(key==='journal'){persistent.notes=t.value.slice(0,20000);commit();const tag=document.querySelector('#save-message');if(tag)tag.textContent='SAVED LOCALLY ✓'}
 if(key==='finance'){persistent.finances[t.dataset.key]=Math.max(0,Number(t.value)||0);commit();}
});
main.addEventListener('change',e=>{
 const t=e.target,key=t.dataset.control;
 if(key==='career-category'){ui.category=t.value;render()}
 if(key==='career-movement'){ui.minimumMovement=Number(t.value);render()}
 if(key==='job-filter'){ui.jobFilter=t.value;render()}
 if(key==='weight'){render()}
 if(key==='compare-a'){persistent.compareA=t.value;commit();render()}
 if(key==='compare-b'){persistent.compareB=t.value;commit();render()}
 if(key==='self-rating'){persistent.ratings[t.dataset.id]=Number(t.value);commit();render()}
 if(key==='task'){persistent.completed[t.dataset.id]=t.checked;commit();render()}
 if(key==='finance'){render()}
});
main.addEventListener('click',e=>{
 const btn=e.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action;
 if(action==='place-tab'){ui.placeFilter=btn.dataset.value;render()}
 if(action==='source-tab'){ui.sourceFilter=btn.dataset.value;render()}
 if(action==='reset-weights'){persistent.weights={...defaultWeights};commit();render()}
 if(action==='favorite'){const id=btn.dataset.id;persistent.favorites[id]=!persistent.favorites[id];commit();render()}
 if(action==='export-state')downloadJSON('fieldnotes-backup.json',{...persistent,exportedAt:new Date().toISOString()});
 if(action==='import-state')document.querySelector('#import-file')?.click();
 if(action==='download-jobs')downloadJSON('fieldnotes-job-leads.json',{exportedAt:new Date().toISOString(),note:'Posting status is not confirmed by HTTP reachability.',jobs:allJobs()});
});
main.addEventListener('change',async e=>{
 if(e.target.id!=='import-file')return;
 const file=e.target.files?.[0];if(!file)return;
 try{const imported=cleanImported(JSON.parse(await file.text()));Object.assign(persistent,imported);commit();render();window.alert('Backup restored to this browser.');}
 catch(err){window.alert('Import failed: '+err.message)}
});
window.addEventListener('hashchange',()=>{document.body.classList.remove('nav-open');document.querySelector('#menu-toggle')?.setAttribute('aria-expanded','false');render();window.scrollTo({top:0,behavior:'instant'})});
document.querySelector('#menu-toggle')?.addEventListener('click',()=>{const on=document.body.classList.toggle('nav-open');document.querySelector('#menu-toggle').setAttribute('aria-expanded',String(on))});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('nav-open');document.querySelector('#menu-toggle')?.setAttribute('aria-expanded','false')}});
async function loadJSON(path,fallback=null){try{const r=await fetch('./data/'+path,{cache:'no-cache'});if(!r.ok)throw Error(r.status);return await r.json()}catch(e){if(fallback!==null)return fallback;throw Error(`Failed to read ${path}: ${e.message}`)}}
async function bootstrap(){
 try{
  const names=['careers.json','profile.json','opportunities.json','places.json','tasks.json','sources.json','snapshot.json','live_jobs.json'];
  const result=await Promise.all(names.map((name,i)=>loadJSON(name,i===6?{generatedAt:null,links:{}}:i===7?{status:'not-configured',jobs:[]}:null)));
  db=Object.fromEntries(['careers','profile','opportunities','places','tasks','sources','snapshot','live'].map((key,i)=>[key,result[i]]));
  const age=freshnessDays(db.snapshot.generatedAt);const tag=age===null?'No refresh yet':age===0?'Checked today':age+'d since refresh';
  document.querySelector('#top-date').textContent=`${todayLA()} · ${tag}`;
  if(age!==null&&age>=3){document.querySelector('.live-dot').style.background='var(--red)'}
  if(!location.hash)location.hash='#/overview';render();
 }catch(e){main.innerHTML=`<div class="page"><div class="alert-note"><strong>Unable to load dashboard data.</strong><p>${esc(e.message)}</p><p>Use a local web server (not file://) and keep the JSON files alongside index.html.</p></div></div>`;console.error(e)}
}
bootstrap();
