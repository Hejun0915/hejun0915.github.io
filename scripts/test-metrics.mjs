import assert from 'node:assert/strict';
import {parseScholar,parseGithub,getMetrics} from './metrics.mjs';
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
  console.log('OK: exact counts, blocked pages, API fallback, offline last-success timestamps.');
} finally {globalThis.fetch=realFetch;}
