import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cachePath = path.join(root,'.cache/metrics.json');
const scholar = 'https://scholar.google.com/citations?user=ktFT40UAAAAJ&hl=en';
export const repositories = ['PicoTrex/Awesome-Nano-Banana-images','LongHZ140516/PaperGallery'];
const ttl = 5 * 60 * 1000;
let memory, lastAttempt = 0, pending;
function validMetric(metric) {
  return metric && Number.isSafeInteger(metric.value) && metric.value >= 0 && Number.isFinite(Date.parse(metric.checkedAt));
}
export function mergeSnapshots(...snapshots) {
  const merged = { repositories: {} };
  for (const snapshot of snapshots) {
    for (const key of ['citations', ...repositories]) {
      const metric = key === 'citations' ? snapshot?.citations : snapshot?.repositories?.[key];
      const target = key === 'citations' ? merged : merged.repositories;
      if (validMetric(metric) && (!target[key] || Date.parse(metric.checkedAt) > Date.parse(target[key].checkedAt))) {
        target[key] = { ...metric, state: 'cached' };
      }
    }
  }
  return merged;
}
function failureCode(error) {
  if (/^http_\d{3}$/.test(error?.code)) return error.code;
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout';
  if (error?.code === 'invalid_response') return error.code;
  return 'network_error';
}
export function parseScholar(html) {
  // Only the total-citations table cell, never the year/chart counts or search snippets.
  const row = html.match(/<td[^>]*class=["'][^"']*gsc_rsb_std[^"']*["'][^>]*>\s*([\d,]+)\s*<\/td>/i);
  if (!row || !html.includes('ktFT40UAAAAJ')) throw Object.assign(Error('Scholar statistics not present'), {code:'invalid_response'});
  const value = Number(row[1].replaceAll(',',''));
  if (!Number.isSafeInteger(value) || value < 0) throw Object.assign(Error('Invalid citation count'), {code:'invalid_response'});
  return value;
}
export function parseGithub(html) {
  const tag = html.match(/<[^>]*id=["']repo-stars-counter-star["'][^>]*>/i)?.[0];
  const valueText = tag?.match(/\btitle=["']([\d,]+)["']/)?.[1] || tag?.match(/aria-label=["']([\d,]+) users? starred/)?.[1];
  const value = Number(valueText?.replaceAll(',',''));
  if (!valueText || !Number.isSafeInteger(value) || value < 0) throw Object.assign(Error('GitHub star count not present'), {code:'invalid_response'});
  return value;
}
async function request(url, json=false) {
  const response = await fetch(url,{headers:{'User-Agent':'JunHeAcademicHomepage/1.0','Accept':json?'application/vnd.github+json':'text/html'},signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw Object.assign(Error(`Source returned ${response.status}`), {code:`http_${response.status}`});
  return json ? response.json() : response.text();
}
async function github(repo) {
  try {
    const data = await request(`https://api.github.com/repos/${repo}`,true);
    if (!Number.isSafeInteger(data.stargazers_count) || data.stargazers_count < 0) throw Object.assign(Error('Invalid stars'), {code:'invalid_response'});
    return data.stargazers_count;
  } catch {
    // Public repository HTML retains exact counts when the shared API quota is exhausted.
    return parseGithub(await request(`https://github.com/${repo}`));
  }
}
async function seed() {
  if(memory)return;
  const localSnapshots = [path.join(root,'content/metrics-snapshot.json'), cachePath].map(async file => {
    try { return JSON.parse(await readFile(file,'utf8')); } catch { return {}; }
  });
  // Recover the deployed last-good readings too, including after CI cache eviction.
  const publishedSnapshot = request('https://hejun0915.github.io/metrics.json',true).catch(() => ({}));
  const snapshots = await Promise.all([...localSnapshots, publishedSnapshot]);
  // A restored CI cache must never replace a newer verified snapshot in the repository.
  memory = mergeSnapshots(...snapshots);
}
export async function getMetrics({force=false,persist=true}={}) {
  await seed();
  if(pending)return pending;
  if(!force && Date.now()-lastAttempt<ttl)return structuredClone(memory);
  lastAttempt=Date.now();
  pending=(async()=>{
    const attemptedAt = new Date().toISOString();
    const sources=[['citations',scholar,()=>request(scholar).then(parseScholar)],...repositories.map(repo=>[repo,`https://github.com/${repo}`,()=>github(repo)])];
    const results=await Promise.allSettled(sources.map(async([key,source,load])=>({key,metric:{value:await load(),checkedAt:new Date().toISOString(),source,state:'fresh'}})));
    memory.refresh = { attemptedAt, sources: {} };
    results.forEach((result,i)=>{
      const key=sources[i][0], target=key==='citations'?memory:memory.repositories;
      if(result.status==='fulfilled') {
        target[key]=result.value.metric;
        memory.refresh.sources[key] = { status:'ok' };
      } else {
        if(target[key])target[key]={...target[key],state:'cached'};
        memory.refresh.sources[key] = { status:'unavailable', reason:failureCode(result.reason) };
      }
    });
    if(persist){
      try { await mkdir(path.dirname(cachePath),{recursive:true}); await writeFile(cachePath,JSON.stringify(memory,null,2)+'\n'); } catch { /* Read-only deployments keep the in-memory snapshot. */ }
    }
    return structuredClone(memory);
  })();
  try{return await pending;}finally{pending=null;}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const metrics=await getMetrics({force:true});
  await writeFile(path.join(root,'content/metrics-snapshot.json'),JSON.stringify(metrics,null,2)+'\n');
  const citationStatus = metrics.refresh.sources.citations;
  if (citationStatus.status !== 'ok') {
    const message = `Scholar refresh unavailable (${citationStatus.reason}); preserving last verified count and date.`;
    console.warn(process.env.GITHUB_ACTIONS ? `::warning title=Scholar statistics::${message}` : message);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const date = metrics.citations?.checkedAt || 'not available';
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Public statistics\n\nScholar: ${citationStatus.status}${citationStatus.reason ? ` (${citationStatus.reason})` : ''}. Last verified: ${date}.\n\nAttempted: ${metrics.refresh.attemptedAt}. Failed requests never advance the verification date.\n`);
  }
  console.log(JSON.stringify(metrics,null,2));
}
