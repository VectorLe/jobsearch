import test from 'node:test';
import assert from 'node:assert/strict';
import {deadlineStatus, daysUntil, esc, safeURL, scoreCareer, grossAnnual, runwayMonths, countProgress, careerMatches} from '../js/logic.js';

test('deadlines distinguish expired, due, upcoming, and unknown',()=>{
  assert.equal(deadlineStatus('2026-11-10','2026-11-11').key,'passed');
  assert.equal(deadlineStatus('2026-11-11','2026-11-11').key,'today');
  assert.equal(deadlineStatus('2026-11-13','2026-11-11').key,'soon');
  assert.equal(deadlineStatus(null,'2026-11-11').key,'unknown');
  assert.equal(daysUntil('2026-12-01','2026-11-11'),20);
});
test('HTML is escaped and javascript URLs blocked',()=>{
  assert.equal(esc('<b>"hi" &'), '&lt;b&gt;&quot;hi&quot; &amp;');
  assert.equal(safeURL('javascript:alert(1)'),'#');
  assert.equal(safeURL('https://vectorle.xyz/'),'https://vectorle.xyz/');
});
test('weighted scores are stable and handle zero weights',()=>{
  const c={scores:{subject:5,movement:3,entry:2,income:4,autonomy:5,learning:4}};
  assert.equal(scoreCareer(c,{subject:1,movement:0,entry:0,income:0,autonomy:0,learning:0}),5);
  assert.equal(scoreCareer(c,{subject:0,movement:0,entry:0,income:0,autonomy:0,learning:0}),0);
});
test('income scenario and task progress',()=>{
  assert.equal(grossAnnual(25,35,48),42000);
  assert.equal(runwayMonths(12000,3000),4);
  assert.equal(countProgress([{id:'a'},{id:'b'}],{a:true}).pct,50);
});
test('career filters use subject, category and movement',()=>{
  const c={title:'Historic-site interpreter',category:'Heritage',summary:'Walk and guide',why:'Museums',tagline:'history',scores:{movement:5}};
  assert.equal(careerMatches(c,'interpreter','Heritage',4),true);
  assert.equal(careerMatches(c,'interpreter','Outdoors',4),false);
  assert.equal(careerMatches(c,'interpreter','Heritage',6),false);
});
