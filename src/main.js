const links = [...document.querySelectorAll('#navigation a')];
const sections = links.map(link => document.querySelector(link.hash));
const progress = document.querySelector('#page-progress');
const progressText = document.querySelector('#progress-text');
let scheduled = false;
function updateReadingPosition() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const amount = max > 0 ? Math.min(100, Math.max(0, Math.round(scrollY / max * 100))) : 100;
  progress.value = amount;
  progress.textContent = progressText.textContent = `${amount}%`;
  let active = 0;
  sections.forEach((section, i) => { if (section.getBoundingClientRect().top < innerHeight * .38) active = i; });
  if (amount === 100) active = links.length - 1;
  links.forEach((link, i) => {
    link.classList.toggle('active', i === active);
    if (i === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  scheduled = false;
}
function scheduleProgress() { if (!scheduled) { scheduled = true; requestAnimationFrame(updateReadingPosition); } }
addEventListener('scroll', scheduleProgress, { passive:true });
addEventListener('resize', scheduleProgress);
addEventListener('load', scheduleProgress);
document.fonts?.ready.then(scheduleProgress);
updateReadingPosition();

// Only the small night lights animate, and only while the introduction is visible.
const hero = document.querySelector('.hero');
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => hero.classList.toggle('is-visible', entry.isIntersecting), {rootMargin:'40px'}).observe(hero);
} else hero.classList.add('is-visible');

const fmt = new Intl.NumberFormat('en-US');
function validMetric(metric) {
  return metric && Number.isSafeInteger(metric.value) && metric.value >= 0 && Number.isFinite(Date.parse(metric.checkedAt));
}
function renderMetric(valueEl, dateEl, metric, label) {
  if (!valueEl || !validMetric(metric)) return;
  valueEl.textContent = fmt.format(metric.value);
  const date = new Date(metric.checkedAt);
  const recent = metric.state === 'fresh';
  const text = `${recent ? 'Updated' : 'Saved'} · ${date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`;
  dateEl.textContent = text;
  dateEl.title = `${label}: ${date.toLocaleString()}${recent ? '' : ' · Last successful reading; refresh unavailable.'}`;
}
function renderMetrics(data) {
  renderMetric(document.querySelector('[data-metric="citations"]'),document.querySelector('[data-metric-date="citations"]'),data.citations,'Google Scholar');
  document.querySelectorAll('[data-repo]').forEach(el => {
    const repo = el.dataset.repo;
    const date = [...document.querySelectorAll('[data-repo-date]')].find(x=>x.dataset.repoDate===repo);
    renderMetric(el,date,data.repositories?.[repo],'GitHub stars');
  });
}
async function json(url, timeout=20000) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),timeout);
  try { const response = await fetch(url,{signal:controller.signal,cache:'no-store'}); if(!response.ok)throw Error(`HTTP ${response.status}`); return await response.json(); }
  finally { clearTimeout(timer); }
}
async function updateMetrics() {
  let snapshot = {};
  try { snapshot = await json('metrics.json',5000); renderMetrics(snapshot); } catch { /* Build-time values remain visible. */ }
  const endpoint = document.body.dataset.metricsEndpoint;
  if (endpoint) try {
    const data = await json(endpoint);
    if (!validMetric(data.citations) && !data.repositories) throw Error('Invalid metrics response');
    renderMetrics(data);
    return;
  } catch { /* Static hosting can still refresh GitHub through its public API. */ }
  await Promise.allSettled([...document.querySelectorAll('[data-repo]')].map(async el=>{
    const repo = el.dataset.repo;
    const data = await json(`https://api.github.com/repos/${repo}`,8000);
    if (!Number.isSafeInteger(data.stargazers_count)) return;
    const date = [...document.querySelectorAll('[data-repo-date]')].find(x=>x.dataset.repoDate===repo);
    renderMetric(el,date,{value:data.stargazers_count,checkedAt:new Date().toISOString(),state:'fresh'},'GitHub stars');
  }));
}
updateMetrics();

// Enlarge the real teaser, anchored to its right edge, without reflowing the row.
// Restrict the hover treatment to a fine pointer; touch keeps the readable layout.
const previewMedia = matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
const previewRows = [...document.querySelectorAll('.paper')];
function closePreview(row) { row.classList.remove('is-previewing'); }
function constrainedPreviewScale({width, height, textHeight, availableWidth, availableHeight, viewportHeight}) {
  if(width<=0 || height<=0 || availableWidth<=0 || availableHeight<=0 || viewportHeight<=0)return 1;
  const wanted=Math.max(1,textHeight/height);
  const limit=Math.min(wanted,availableWidth/width,availableHeight/height,viewportHeight*.7/height);
  // Round down so subpixel layout never pushes a long figure over the boundary.
  return Math.max(.001,Math.floor(limit*1000)/1000);
}
function openPreview(row) {
  if (!previewMedia.matches) return;
  const img = row.querySelector('.teaser-link img');
  if (!img.complete || !img.naturalWidth) return;
  const anchor = row.querySelector('.teaser-link').getBoundingClientRect();
  const text = row.querySelector('.paper-content').getBoundingClientRect();
  const bounds = row.getBoundingClientRect();
  // Leave a small inset from the row's left rule; never enter the year gutter.
  const scale = constrainedPreviewScale({
    width:img.offsetWidth,height:img.offsetHeight,textHeight:text.height,
    availableWidth:Math.min(anchor.right,bounds.right)-bounds.left-12,
    availableHeight:bounds.height-24,viewportHeight:innerHeight
  });
  row.style.setProperty('--preview-scale', String(scale));
  row.classList.add('is-previewing');
}
previewRows.forEach(row => {
  const teaser = row.querySelector('.teaser-link');
  teaser.addEventListener('pointerenter', () => openPreview(row));
  teaser.addEventListener('pointerleave', () => { if (!teaser.matches(':focus-visible')) closePreview(row); });
  teaser.addEventListener('focus', () => { if(teaser.matches(':focus-visible')) openPreview(row); });
  teaser.addEventListener('blur', () => closePreview(row));
});
document.addEventListener('keydown', event => { if(event.key === 'Escape') previewRows.forEach(closePreview); });
previewMedia.addEventListener('change', () => previewRows.forEach(closePreview));
addEventListener('resize', () => previewRows.forEach(closePreview));
