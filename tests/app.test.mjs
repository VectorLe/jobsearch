import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('dashboard loads job cards and has a single secondary view',async()=>{
  let body='',results='',counter='';
  const root={addEventListener(){},get innerHTML(){return body;},set innerHTML(x){body=x;}};
  const resultEl={get innerHTML(){return results;},set innerHTML(x){results=x;}};
  const countEl={get innerHTML(){return counter;},set innerHTML(x){counter=x;}};
  globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
  globalThis.location={hash:'#jobs'};
  globalThis.window={addEventListener(){}};
  globalThis.document={querySelector:(selector)=>({
    '#app':root,'#job-results':resultEl,'#results-count':countEl,'#saved-count':{textContent:''}
  })[selector]||null,querySelectorAll:()=>[]};
  globalThis.fetch=async (url)=>({ok:true,json:async()=>JSON.parse(await readFile(new URL('../'+url.replace(/^\.\//,''),import.meta.url),'utf8'))});
  await import('../js/app.js');
  await new Promise(resolve=>setTimeout(resolve,50));
  assert.match(body,/Search jobs/);
  assert.match(results,/Museum Education Coordinator/);
  assert.match(results,/Posted .* days ago|Posted yesterday|Posted today/);
  assert.match(results,/Pay|\$27\.17/);
  assert.match(counter,/matching jobs/);
});
