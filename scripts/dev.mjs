import http from 'node:http';
import path from 'node:path';
import {readFile,stat,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from './build.mjs';
import {getMetrics} from './metrics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await build();
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/api/metrics'){
    if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'});res.end('Method not allowed');return;}
    const data=await getMetrics();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));return;
  }
  const file=path.resolve(root,'dist','.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(path.join(root,'dist')+path.sep)){res.writeHead(403);res.end('Forbidden');return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}`));
let last='',busy=false;
async function fingerprint(){
 const dirs=['content','src'];const entries=await Promise.all(dirs.map(async d=>(await readdir(path.join(root,d))).map(n=>path.join(root,d,n))));
 return (await Promise.all(entries.flat().map(async p=>[p,(await stat(p)).mtimeMs].join(':')))).join('|');
}
last=await fingerprint();
setInterval(async()=>{
 if(busy)return;busy=true;
 try{const next=await fingerprint();if(next!==last){await build();last=next;}}catch(e){console.error(e.message);}finally{busy=false;}
},800);
