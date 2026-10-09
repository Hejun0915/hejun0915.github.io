import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=await fs.readFile(path.join(root,'dist/index.html'),'utf8');
if(html.includes('{{'))throw Error('Unresolved template value');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
for(const [,ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)){
 if(ref.startsWith('#')){if(!ids.has(ref.slice(1)))throw Error('Missing anchor '+ref);}
 else if(!/^(https?:|mailto:|data:)/.test(ref)){await fs.access(path.resolve(root,'dist',ref));}
}
for(const file of ['styles.css','themes.css','atmosphere.css']){
 const css=await fs.readFile(path.join(root,'dist',file),'utf8');
 for(const [,ref] of css.matchAll(/url\(['"]?([^'"\)]+)['"]?\)/g)){
  if(ref.startsWith('#')){if(!ids.has(ref.slice(1)))throw Error('Missing CSS filter '+ref);}
  else if(!/^(https?:|data:)/.test(ref))await fs.access(path.resolve(root,'dist',ref));
 }
}
const papers=JSON.parse(await fs.readFile(path.join(root,'content/publications.json'),'utf8'));
if(papers.some(p=>!p.authors.some(a=>a.replace('*','')==='Jun He')))throw Error('Paper is missing Jun He');
if(new Set(papers.map(p=>p.key)).size!==papers.length)throw Error('Duplicate publication');
console.log(`OK: ${papers.length} papers, HTML/CSS assets, anchors and author identity.`);
