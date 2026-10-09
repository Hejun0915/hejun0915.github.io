import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {parseScholar,parseGithub,getMetrics,mergeSnapshots} from './metrics.mjs';
const oldMetric={value:488,checkedAt:'2026-09-23T10:00:00Z'};
const newMetric={value:499,checkedAt:'2026-10-09T10:00:00Z'};
const repo='PicoTrex/Awesome-Nano-Banana-images';
const combined=mergeSnapshots({citations:newMetric,repositories:{[repo]:oldMetric}},{citations:oldMetric,repositories:{[repo]:newMetric}});
assert.equal(combined.citations.value,499,'Old CI cache cannot override a newer committed snapshot');
assert.equal(combined.repositories[repo].value,499,'Choose the latest reading separately for each source');
assert.equal(mergeSnapshots({citations:newMetric},{citations:{...newMetric,value:-1}}).citations.value,499);
assert.equal(mergeSnapshots({citations:newMetric},{citations:{value:490,checkedAt:'2026-10-10T10:00:00Z'}}).citations.value,490,'Real decreases must not be hidden');
assert.equal(parseScholar('ktFT40UAAAAJ<td class="gsc_rsb_std">1,234</td><td class="gsc_rsb_std">900</td>'),1234);
assert.throws(()=>parseScholar('<h1>Sorry, unusual traffic</h1>'));
assert.throws(()=>parseScholar('<td class="gsc_rsb_std">100</td>'));
assert.equal(parseGithub('<span id="repo-stars-counter-star" title="23,778">23.8k</span>'),23778);
assert.equal(parseGithub('<span id="repo-stars-counter-star" title="0">0</span>'),0);
assert.throws(()=>parseGithub('<h1>Rate limit exceeded</h1>'));
const realFetch=globalThis.fetch;
try {
  globalThis.fetch=async url=>{
    if(String(url).includes('scholar.google'))return new Response('ktFT40UAAAAJ<td class="gsc_rsb_std">499</td>');
    if(String(url).includes('api.github'))return new Response('rate limited',{status:403});
    return new Response('<span id="repo-stars-counter-star" title="24,001">24k</span>');
  };
  const fresh=await getMetrics({force:true,persist:false});
  assert.equal(fresh.citations.value,499);
  assert.equal(fresh.repositories['PicoTrex/Awesome-Nano-Banana-images'].value,24001);
  globalThis.fetch=async()=>{throw Error('Offline');};
  const stale=await getMetrics({force:true,persist:false});
  assert.equal(stale.citations.value,fresh.citations.value);
  assert.equal(stale.citations.checkedAt,fresh.citations.checkedAt);
  assert.equal(stale.citations.state,'cached');
  assert.equal(stale.repositories['PicoTrex/Awesome-Nano-Banana-images'].state,'cached');
  assert.equal(stale.refresh.sources.citations.reason,'network_error');
  globalThis.fetch=async()=>new Response('Unavailable',{status:403});
  const blocked=await getMetrics({force:true,persist:false});
  assert.equal(blocked.citations.checkedAt,fresh.citations.checkedAt);
  assert.equal(blocked.refresh.sources.citations.reason,'http_403');
  globalThis.fetch=async()=>new Response('<h1>Verification required</h1>');
  const challenge=await getMetrics({force:true,persist:false});
  assert.equal(challenge.citations.value,499);
  assert.equal(challenge.refresh.sources.citations.reason,'invalid_response');
} finally {globalThis.fetch=realFetch;}

// Exercise browser polling and the visible date without a real network or DOM.
const main=await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8');
const metricUI=main.slice(main.indexOf('const fmt ='),main.indexOf('// Enlarge the real teaser'));
let now=Date.parse('2026-10-09T11:00:00Z'), timer, calls=0;
let snapshot={citations:newMetric};
class Clock extends Date {static now(){return now;}}
const value={dataset:{},textContent:''},date={textContent:'',title:''},events={};
const document={hidden:false,body:{dataset:{}},querySelector:selector=>selector.includes('metric-date')?date:value,querySelectorAll:()=>[],addEventListener:(type,fn)=>events[type]=fn};
const context={document,Date:Clock,Intl,Number,Promise,AbortController,setTimeout,clearTimeout,setInterval:fn=>timer=fn,fetch:async()=>{calls++;return new Response(JSON.stringify(snapshot));}};
vm.runInNewContext(metricUI,context);
async function settle(){await new Promise(resolve=>setTimeout(resolve,0));}
await settle();
assert.equal(value.textContent,'499');
assert.match(date.textContent,/As of/);
assert.equal(calls,1);
now+=5*60*1000;
snapshot={citations:{value:500,checkedAt:'2026-10-09T11:05:00Z'}};
timer(); await settle();
assert.equal(value.textContent,'500','An open page receives later published statistics');
const verifiedDate=date.textContent;
now+=5*60*1000; snapshot={citations:oldMetric};
timer(); await settle();
assert.equal(value.textContent,'500','An old CDN response cannot roll back the number');
assert.equal(date.textContent,verifiedDate);
document.hidden=true; now+=5*60*1000; const before=calls;
timer(); await settle(); assert.equal(calls,before,'Do not poll hidden tabs');
document.hidden=false; snapshot={citations:{value:501,checkedAt:'2026-10-09T11:15:00Z'}};
events.visibilitychange(); await settle(); assert.equal(value.textContent,'501');
snapshot={citations:snapshot.citations,refresh:{sources:{citations:{status:'unavailable'}}}};
now+=5*60*1000; timer(); await settle();
assert.match(date.title,/unavailable/); assert.equal(value.textContent,'501');
console.log('OK: source parsing, cache freshness, failure diagnostics, preserved verification dates, visible-tab polling and stale-response protection.');
