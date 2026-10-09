import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('../src/theme.js',import.meta.url),'utf8');
const pure = {module:{exports:{}}}; vm.runInNewContext(source,pure);
const {themeForHour,toggleManualTheme,randomGreeting,GREETINGS} = pure.module.exports;
for(const [hour,theme] of [[0,'night'],[4.99,'night'],[5,'morning'],[10.99,'morning'],[11,'noon'],[16.99,'noon'],[17,'dusk'],[19.99,'dusk'],[20,'night'],[23.99,'night']])assert.equal(themeForHour(hour),theme);
assert.throws(()=>themeForHour(24));assert.throws(()=>themeForHour(NaN));
assert.equal(toggleManualTheme(null,'dusk'),'dusk');assert.equal(toggleManualTheme('dusk','dusk'),null);assert.equal(toggleManualTheme('morning','night'),'night');
for(const theme of Object.keys(GREETINGS)){
  assert(GREETINGS[theme].length>=3);
  for(const sample of [0,.4,.999])assert(GREETINGS[theme].includes(randomGreeting(theme,'',()=>sample)));
  assert.notEqual(randomGreeting(theme,GREETINGS[theme][0],()=>0),GREETINGS[theme][0]);
}
function element(dataset={}) {
  return {dataset,attrs:{},events:{},classes:new Set(),textContent:'',setAttribute(k,v){this.attrs[k]=v;},addEventListener(k,v){this.events[k]=v;},classList:{toggle(){}}};
}
function browser({storageThrows=false}={}) {
  let now=new Date(2026,8,23,6,30),timer;
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now.getTime()]));}static now(){return now.getTime();}}
  const root=element(),nodes=Object.fromEntries(['meta','#theme-status','#theme-clock','#theme-greeting','#world-scene','#world-time','#theme-announcement'].map(x=>[x,element()]));
  const buttons=['morning','noon','dusk','night'].map(name=>element({themeChoice:name}));
  const events={},storage=new Map();
  const document={documentElement:root,readyState:'loading',hidden:false,querySelector:q=>q.startsWith('meta')?nodes.meta:nodes[q],querySelectorAll:()=>buttons,addEventListener:(k,fn)=>events[k]=fn};
  const sessionStorage={getItem(k){if(storageThrows)throw Error('Storage blocked');return storage.get(k)??null;},setItem(k,v){if(storageThrows)throw Error('Storage blocked');storage.set(k,v);},removeItem(k){if(storageThrows)throw Error('Storage blocked');storage.delete(k);}};
  const win={document};
  vm.runInNewContext(source,{window:win,document,Date:Clock,Intl,sessionStorage,setInterval:fn=>timer=fn,addEventListener:(k,fn)=>events[k]=fn});
  assert.equal(root.dataset.theme,'morning');assert.equal(root.dataset.themeMode,'auto');
  events.DOMContentLoaded();
  return {root,nodes,buttons,events,storage,tick:hour=>{now=new Date(2026,8,23,hour,30);timer();}};
}
for(const storageThrows of [false,true]) {
  const b=browser({storageThrows});
  const initialGreeting=b.nodes['#theme-greeting'].textContent;
  assert(GREETINGS.morning.includes(initialGreeting));
  assert.equal(b.nodes['#theme-clock'].textContent,'06:30');
  b.tick(7);assert.equal(b.nodes['#theme-greeting'].textContent,initialGreeting);
  b.buttons[3].events.click();assert.equal(b.root.dataset.theme,'night');assert.equal(b.root.dataset.themeMode,'manual');assert.equal(b.buttons[3].attrs['aria-pressed'],'true');
  assert(GREETINGS.night.includes(b.nodes['#theme-greeting'].textContent));
  b.tick(14);assert.equal(b.root.dataset.theme,'night');assert.equal(b.nodes['#theme-clock'].textContent,'14:30');
  b.buttons[3].events.click();assert.equal(b.root.dataset.theme,'noon');assert.equal(b.root.dataset.themeMode,'auto');assert.equal(b.buttons[3].attrs['aria-pressed'],'false');assert.equal(b.storage.size,0);
  b.tick(17);assert.equal(b.root.dataset.theme,'dusk');b.tick(20);assert.equal(b.root.dataset.theme,'night');b.tick(5);assert.equal(b.root.dataset.theme,'morning');
  assert.match(b.nodes['#world-scene'].attrs['aria-label'],/morning/);
  assert(GREETINGS.morning.includes(b.nodes['#theme-greeting'].textContent));
  assert.notEqual(b.nodes['#theme-greeting'].textContent,initialGreeting);
  assert(!/Auto|Manual/.test(b.nodes['#theme-status'].textContent));
}
console.log('PASS: theme switching, local clock, random greetings, stable greetings between ticks, accessibility and blocked storage.');
