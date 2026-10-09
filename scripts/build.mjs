import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resourceIcon, wallPattern, heroAtmosphere } from './pixel-ui.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const external = 'target="_blank" rel="noopener noreferrer"';
const starIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';
export async function build() {
  const [profile, papers, template] = await Promise.all([read('content/profile.json').then(JSON.parse), read('content/publications.json').then(JSON.parse), read('src/index.template.html')]);
  const snapshot = await read('content/metrics-snapshot.json').then(JSON.parse).catch(()=>({}));
  const linkAdvisor = text => profile.advisor
    ? escape(text).replaceAll(escape(profile.advisor.name), `<a class="advisor-link" href="${escape(profile.advisor.url)}" ${external}>${escape(profile.advisor.name)}</a>`)
    : escape(text);
  const authors = names => names.map(raw => {
    const star = raw.endsWith('*'), name = star ? raw.slice(0,-1) : raw;
    const text = `${escape(name)}${star ? '<sup>*</sup>' : ''}`;
    return name === 'Jun He' ? `<strong>${text}</strong>` : text;
  }).join(', ');
  const paper = p => `<article class="paper" id="paper-${escape(p.key.toLowerCase().replace(/[^a-z0-9]+/g,'-'))}">
    <div class="paper-content"><p class="paper-meta"><span class="venue">${escape(p.venue)}</span>${p.status ? `<span class="paper-status">${escape(p.status)}</span>` : ''}</p>
    <h3><a href="${escape(p.paper)}" ${external}>${escape(p.title)}</a></h3>
    <p class="authors">${authors(p.authors)}</p><p class="paper-summary">${escape(p.summary)}</p>
    <div class="paper-links"><a href="${escape(p.paper)}" ${external}>${resourceIcon('paper')}<span>Paper ↗</span></a>${p.projectUrl ? `<a href="${escape(p.projectUrl)}" ${external}>${resourceIcon('project')}<span>Project ↗</span></a>` : ''}${p.githubUrl ? `<a href="${escape(p.githubUrl)}" ${external}>${resourceIcon('code')}<span>Code ↗</span></a>` : ''}</div></div>
    <div class="teaser-stage"><a class="teaser-link" href="${escape(p.projectUrl || p.paper)}" ${external} aria-label="View ${escape(p.key)} ${p.projectUrl ? 'project' : 'paper'}"><img src="${escape(p.image)}" alt="${escape(p.imageAlt)}" loading="lazy"></a></div>
    </article>`;
  const years = [...new Set(papers.map(p=>p.year))].sort((a,b)=>b-a);
  const blocks = years.map(year => `<div class="year-group"><h3 class="year-label">${year}</h3><div class="paper-list">${papers.filter(p=>p.year===year).map(paper).join('\n')}</div></div>`).join('\n');
  const citations = snapshot.citations?.value ?? profile.citations;
  const values = {
    ATMOSPHERE:heroAtmosphere(),
    GITHUB:escape(profile.github), EMAIL:escape(profile.email), SCHOLAR:escape(profile.scholar), INTRO:escape(profile.intro), BIO:linkAdvisor(profile.bio), CITATIONS:citations,
    STATISTICSDATE:escape((snapshot.citations?.checkedAt || profile.statisticsDate).slice(0,10)), METRICSENDPOINT:process.env.DEPLOY_TARGET === 'github-pages' ? '' : escape(profile.metricsEndpoint || 'api/metrics'),
    INTERESTS:profile.interests.map((x,i)=>`<span class="interest"><span aria-hidden="true">0${i+1}</span>${escape(x)}</span>`).join(''), PUBLICATIONS:blocks,
    NEWS:profile.news.map(n=>`<p><time datetime="${escape(n.date)}">${escape(n.date.replace('-','.'))}</time><span>${n.parts.map(part=>part.type==='method' ? `<a class="news-method" href="${escape(part.href)}">${escape(part.text)}</a>` : part.type==='venue' ? `<span class="news-venue">${escape(part.text)}</span>` : escape(part.text)).join('')}</span></p>`).join('\n'),
    EXPERIENCE:profile.experience.map(x=>`<article class="experience-item"><time>${escape(x.date)}</time><div class="institution"><img src="${escape(x.logo)}" alt="${escape(x.name)} logo" width="54" height="54" loading="lazy"><div><h3>${escape(x.name)}</h3><p class="role">${escape(x.role)}</p></div></div><p class="experience-description">${linkAdvisor(x.description)}</p></article>`).join('\n'),
    PROJECTS:profile.projects.map(x=>{
      const key=x.repo, metric=snapshot.repositories?.[key];
      return `<article class="project"><div class="project-media"><a class="project-cover" href="${escape(x.url)}" ${external} aria-label="Explore ${escape(x.name)}"><img src="${escape(x.image)}" alt="${escape(x.name)} project preview" loading="lazy" width="800" height="450"></a><a class="star-count" href="https://github.com/${escape(key)}/stargazers" ${external} aria-label="${escape(x.name)} GitHub stars">${starIcon}<span data-repo="${escape(key)}">${metric ? metric.value.toLocaleString('en-US') : '—'}</span></a></div><div class="project-body"><p class="project-kicker">${escape(x.kind)}</p><div class="project-title"><h3><a href="${escape(x.url)}" ${external}>${escape(x.name)}</a></h3></div><p>${escape(x.description)}</p><div class="project-bottom"><a href="${escape(x.url)}" ${external}>Explore project ↗</a><small data-repo-date="${escape(key)}">${metric ? 'As of · '+metric.checkedAt.slice(0,10) : 'GitHub stars'}</small></div></div></article>`;
    }).join('\n')
  };
  const html = template.replace(/\{\{([A-Z]+)\}\}/g,(_,key)=>{ if (!(key in values)) throw Error('Unknown template key '+key); return values[key]; });
  await rm(path.join(root,'dist'),{recursive:true,force:true});
  await mkdir(path.join(root,'dist'),{recursive:true});
  await Promise.all([writeFile(path.join(root,'dist/index.html'),html),writeFile(path.join(root,'dist/metrics.json'),JSON.stringify(snapshot)),cp(path.join(root,'public/assets'),path.join(root,'dist/assets'),{recursive:true}),cp(path.join(root,'src/styles.css'),path.join(root,'dist/styles.css')),cp(path.join(root,'src/main.js'),path.join(root,'dist/main.js')),cp(path.join(root,'src/themes.css'),path.join(root,'dist/themes.css')),cp(path.join(root,'src/theme.js'),path.join(root,'dist/theme.js')),cp(path.join(root,'src/atmosphere.css'),path.join(root,'dist/atmosphere.css'))]);
  await Promise.all(['morning','noon','dusk','night'].map(theme=>writeFile(path.join(root,`dist/assets/art/pixel-wall-${theme}.svg`),wallPattern(theme))));
  await writeFile(path.join(root,'dist/.nojekyll'),'');
  console.log(`Built ${papers.length} publications → dist/index.html`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
