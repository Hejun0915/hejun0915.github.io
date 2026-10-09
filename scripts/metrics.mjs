import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cachePath = path.join(root,'.cache/metrics.json');
const scholar = 'https://scholar.google.com/citations?user=ktFT40UAAAAJ&hl=en';
export const repositories = ['PicoTrex/Awesome-Nano-Banana-images','LongHZ140516/PaperGallery'];
const ttl = 5 * 60 * 1000;
let memory, lastAttempt = 0, pending;
export function parseScholar(html) {
  // Only the total-citations table cell, never the year/chart counts or search snippets.
  const row = html.match(/<td[^>]*class=["'][^"']*gsc_rsb_std[^"']*["'][^>]*>\s*([\d,]+)\s*<\/td>/i);
  if (!row || !html.includes('ktFT40UAAAAJ')) throw Error('Scholar statistics not present');
  const value = Number(row[1].replaceAll(',',''));
  if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid citation count');
  return value;
}
export function parseGithub(html) {
  const tag = html.match(/<[^>]*id=["']repo-stars-counter-star["'][^>]*>/i)?.[0];
  const valueText = tag?.match(/\btitle=["']([\d,]+)["']/)?.[1] || tag?.match(/aria-label=["']([\d,]+) users? starred/)?.[1];
  const value = Number(valueText?.replaceAll(',',''));
  if (!valueText || !Number.isSafeInteger(value) || value < 0) throw Error('GitHub star count not present');
  return value;
}
async function request(url, json=false) {
  const response = await fetch(url,{headers:{'User-Agent':'JunHeAcademicHomepage/1.0','Accept':json?'application/vnd.github+json':'text/html'},signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw Error(`Source returned ${response.status}`);
  return json ? response.json() : response.text();
}
async function github(repo) {
  try {
    const data = await request(`https://api.github.com/repos/${repo}`,true);
    if (!Number.isSafeInteger(data.stargazers_count) || data.stargazers_count < 0) throw Error('Invalid stars');
    return data.stargazers_count;
  } catch {
    // Public repository HTML retains exact counts when the shared API quota is exhausted.
    return parseGithub(await request(`https://github.com/${repo}`));
  }
}
async function seed() {
  if(memory)return;
  try { memory=JSON.parse(await readFile(cachePath,'utf8')); }
  catch { try { memory=JSON.parse(await readFile(path.join(root,'content/metrics-snapshot.json'),'utf8')); } catch { memory={}; } }
  memory.repositories ||= {};
}
export async function getMetrics({force=false,persist=true}={}) {
  await seed();
  if(pending)return pending;
  if(!force && Date.now()-lastAttempt<ttl)return structuredClone(memory);
  lastAttempt=Date.now();
  pending=(async()=>{
    const sources=[['citations',scholar,()=>request(scholar).then(parseScholar)],...repositories.map(repo=>[repo,`https://github.com/${repo}`,()=>github(repo)])];
    const results=await Promise.allSettled(sources.map(async([key,source,load])=>({key,metric:{value:await load(),checkedAt:new Date().toISOString(),source,state:'fresh'}})));
    results.forEach((result,i)=>{
      const key=sources[i][0], target=key==='citations'?memory:memory.repositories;
      if(result.status==='fulfilled')target[key]=result.value.metric;
      else if(target[key])target[key]={...target[key],state:'cached'};
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
  const snapshot=structuredClone(metrics);
  if(snapshot.citations)snapshot.citations.state='cached';
  for(const metric of Object.values(snapshot.repositories||{}))metric.state='cached';
  await writeFile(path.join(root,'content/metrics-snapshot.json'),JSON.stringify(snapshot,null,2)+'\n');
  console.log(JSON.stringify(metrics,null,2));
}
