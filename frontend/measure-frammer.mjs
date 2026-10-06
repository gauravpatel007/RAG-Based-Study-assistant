import {chromium} from '@playwright/test';
const b=await chromium.launch({channel:'msedge'}); const p=await b.newPage({viewport:{width:1440,height:1000}});
await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5176')?r.continue():r.abort());await p.goto('http://127.0.0.1:5176', {waitUntil:'networkidle'});await p.evaluate(()=>document.fonts.ready);
console.log(await p.locator('h1,h2,h3,section,nav,footer').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,text:e.textContent?.slice(0,65),x:r.x,y:r.y,w:r.width,h:r.height,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,line:s.lineHeight,spacing:s.letterSpacing,gap:s.gap,padding:s.padding,background:s.backgroundColor}})));
console.log(await p.getByText('Study Assistant is a privacy-first', {exact:false}).evaluate(e=>({style:getComputedStyle(e).cssText,font:getComputedStyle(e).fontSize,width:e.getBoundingClientRect().width,line:getComputedStyle(e).lineHeight})));
await b.close();

