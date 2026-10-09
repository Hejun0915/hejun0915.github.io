// Small native vector UI marks and background geometry; no raster figures are edited.
export function resourceIcon(kind) {
  const paths = {
    paper: 'M3 1h7v2h3v12H3zM5 3v10h6V5H8V3zM5 7h5v1H5zM5 10h5v1H5z',
    project: 'M1 2h14v12H1zM3 4v2h10V4zM3 8v4h4V8zM9 8v1h4V8zM9 11v1h4v-1z',
    code: 'M4 3h2v2H4v2H2v2h2v2h2v2H4v-2H2V9H0V7h2V5h2zM10 3h2v2h2v2h2v2h-2v2h-2v2h-2v-2h2V9h2V7h-2V5h-2zM8 2h2v3H9v3H8v3H7v3H5v-3h1V8h1V5h1z'
  };
  return `<svg class="resource-icon" data-icon="${kind}" viewBox="0 0 16 16" fill="currentColor" fill-rule="evenodd" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="${paths[kind]}"/></svg>`;
}

function random(seed) {
  let state = seed >>> 0;
  return () => {state = (Math.imul(1664525,state) + 1013904223) >>> 0; return state / 4294967296;};
}

export function wallPattern(theme='noon') {
  const palette={
    morning:['#93603b','#c89653','#dec081'],
    noon:['#416449','#82a263','#b2c78e'],
    dusk:['#3b6864','#7d978a','#b68c67'],
    night:['#48335f','#806499','#bba2d3']
  }[theme];
  const rng = random(9152026), pixels = [];
  for(let y=0;y<1536;y+=24)for(let x=0;x<1024;x+=24){
    if(rng()>.33)continue;
    const size = rng()>.91 ? 6 : rng()>.5 ? 3 : 2;
    const px = x+Math.floor(rng()*9)*2, py=y+Math.floor(rng()*9)*2;
    const tone=Math.floor(rng()*palette.length), opacity=(.16+rng()*.3).toFixed(2);
    pixels.push(`<rect x="${px}" y="${py}" width="${size}" height="${size}" fill="${palette[tone]}" opacity="${opacity}"/>`);
    if(size===6 && rng()>.45)pixels.push(`<rect x="${px+8}" y="${py-4}" width="2" height="2" fill="${palette[(tone+1)%3]}" opacity=".3"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536" shape-rendering="crispEdges">${pixels.join('')}</svg>`;
}

export function heroAtmosphere() {
  const rng=random(270915), stars=[];
  for(let i=0;i<44;i++){
    const x=Math.round(20+rng()*1160), y=Math.round(90+rng()*520), s=i%5===0?4:2;
    const duration=(6+rng()*7).toFixed(1), delay=(-rng()*18).toFixed(1);
    stars.push(`<g class="firefly" style="--spark-duration:${duration}s;--spark-delay:${delay}s;--drift-x:${i%2?8:-8}px;--drift-y:${i%3?-8:8}px"><g class="firefly-spark ${i%4===0?'cool-spark':''}"><rect x="${x-4}" y="${y-4}" width="${s+8}" height="${s+8}" opacity=".07"/><rect x="${x-2}" y="${y}" width="${s+4}" height="${s}" opacity=".22"/><rect x="${x}" y="${y-2}" width="${s}" height="${s+4}" opacity=".22"/><rect x="${x}" y="${y}" width="${s}" height="${s}"/></g></g>`);
  }
  return `<svg class="hero-atmosphere" viewBox="0 0 1200 700" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><g class="night-sparks">${stars.join('')}</g></svg>`;
}
