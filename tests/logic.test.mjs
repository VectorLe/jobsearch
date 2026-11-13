import test from 'node:test';
import assert from 'node:assert/strict';
import {esc,safeURL,daysUntil,postedAge,deadlineStatus,distanceMiles,jobMiles,distanceBand,hourlyFloor,matchJob,sortJobs} from '../js/logic.js';
const geo={cities:{'El Monte':[34.0686,-118.0276],'Arcadia':[34.1397,-118.0353],'Riverside':[33.9806,-117.3755]}};
const base={id:'a',title:'Museum educator',employer:'City',city:'Arcadia',category:'Heritage',salary:'$27.17/hr',deadline:'2026-11-30',postedAt:'2026-11-09',note:'Tours'};
test('posting age uses actual opening date, not tracking timestamp',()=>{
  assert.equal(postedAge('2026-11-09','2026-11-12').text,'Posted 3 days ago');
  assert.equal(postedAge(null,'2026-11-12').text,'Posting date not provided');
  assert.equal(postedAge('2026-11-13','2026-11-12').known,false);
});
test('deadlines distinguish known expiration from unknown',()=>{
  assert.equal(daysUntil('2026-11-30','2026-11-12'),18);
  assert.equal(deadlineStatus('2026-11-11','2026-11-12').key,'passed');
  assert.equal(deadlineStatus(null,'2026-11-12').key,'unknown');
});
test('radius uses geographic center and not a hardcoded LA city center',()=>{
  assert.equal(distanceMiles(geo.cities['El Monte'],geo.cities['El Monte']),0);
  assert.ok(jobMiles(base,'El Monte',geo)>=4 && jobMiles(base,'El Monte',geo)<=8);
  assert.ok(jobMiles({...base,city:'Riverside'},'El Monte',geo)>30);
  assert.equal(distanceBand(6),0);
});
test('pay conversions keep annual and hourly amounts comparable',()=>{
  assert.equal(hourlyFloor('$20.62–$23.47/hr'),20.62);
  assert.ok(hourlyFloor('$63,972–$79,848/yr')>30);
  assert.equal(hourlyFloor('Check employer for pay'),null);
});
test('filters exclude expired and out-of-radius jobs',()=>{
  const f={query:'',radius:'15',archived:true,saved:false,category:'all',age:'all',minPay:'all'};
  assert.equal(matchJob(base,f,'El Monte',geo),true);
  assert.equal(matchJob({...base,city:'Riverside'},f,'El Monte',geo),false);
  assert.equal(matchJob(base,{...f,category:'Outdoors'},'El Monte',geo),false);
  assert.equal(sortJobs([base,{...base,id:'b',city:'Riverside'}],'closest','El Monte',geo)[0].id,'a');
});
test('HTML escaping and external-link safety',()=>{
  assert.equal(esc('<img src=x>'),'&lt;img src=x&gt;');
  assert.equal(safeURL('javascript:alert(1)'),'#');
});
