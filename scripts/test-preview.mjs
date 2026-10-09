import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../src/main.js',import.meta.url),'utf8');
const fn=source.match(/function constrainedPreviewScale\([\s\S]*?\n\}/)?.[0];
assert(fn,'Preview geometry function exists');
const context={};vm.runInNewContext(fn,context);
for(const input of [
 {width:350,height:45,textHeight:340,availableWidth:870,availableHeight:390,viewportHeight:900},
 {width:300,height:210,textHeight:180,availableWidth:720,availableHeight:230,viewportHeight:700},
 {width:320,height:110,textHeight:410,availableWidth:710,availableHeight:450,viewportHeight:600},
 {width:400,height:900,textHeight:260,availableWidth:650,availableHeight:940,viewportHeight:600},
 {width:1100,height:90,textHeight:310,availableWidth:820,availableHeight:350,viewportHeight:800}
]){
 const scale=context.constrainedPreviewScale(input);
 assert(scale>0);
 assert(input.width*scale<=input.availableWidth+.001,'No figure crosses the left rule');
 assert(input.height*scale<=input.availableHeight+.001,'No figure crosses an adjacent row');
 assert(input.height*scale<=input.viewportHeight*.7+.001,'Tall figures stay within the viewport');
}
console.log('PASS: very wide, short, tall and oversized figures remain within row and viewport bounds.');
