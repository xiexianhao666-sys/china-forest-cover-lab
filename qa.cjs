const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const D=require('./dist/data-core.js');
const ids=JSON.parse(fs.readFileSync('dist/china.geojson','utf8')).features.filter(f=>f.properties.name).map(f=>String(f.properties.adcode));
for(const id of ids)for(let y=1990;y<=2025;y++){assert(D.rate(id,y)>=0&&D.rate(id,y)<=100);assert.equal(D.change(id,y,y,ids),0)}
assert(Number.isFinite(D.national(ids,2025)));
const browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9333','--user-data-dir='+path.resolve('.qa-browser'),'about:blank'],{stdio:'ignore',windowsHide:true});
(async()=>{
let pages;for(let n=0;n<40;n++){try{pages=await(await fetch('http://127.0.0.1:9333/json')).json();if(pages.length)break}catch{}await delay(250)}
assert(pages?.length,'Browser did not launch');
const ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
let count=0;const pending=new Map(),errors=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text)};
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++count;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
try{
await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1150,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'file:///'+path.resolve('dist/index.html').replaceAll('\\','/')});
await delay(900);
assert.equal(await evaluate("document.querySelectorAll('#map .province').length"),34);
assert.equal(await evaluate("document.querySelectorAll('.rank-row').length"),8);
await evaluate("document.querySelector('#map .province[data-id=\"330000\"]').dispatchEvent(new MouseEvent('click',{bubbles:true}))");
assert.match(await evaluate("document.getElementById('trendSubtitle').textContent"),/浙江/);
await evaluate("const s=document.getElementById('start');s.value='2010';s.dispatchEvent(new Event('change'));document.getElementById('changeMode').click()");
assert.match(await evaluate("document.getElementById('mapSubtitle').textContent"),/百分点/);
await evaluate("document.getElementById('sourceBtn').click()");assert.equal(await evaluate("document.getElementById('sourceDialog').open"),true);
await evaluate("document.getElementById('closeDialog').click();document.getElementById('resetBtn').click()");
assert.equal(await evaluate("document.getElementById('region').value"),'all');
await evaluate("window.__downloads=[];window.download=(content,type,file)=>window.__downloads.push({content,type,file});document.getElementById('exportBtn').click();document.getElementById('chartExport').click()");
assert.equal(await evaluate('window.__downloads.length'),2);assert.match(await evaluate('window.__downloads[0].content'),/合成演示非实际数据/);
assert.match(await evaluate('window.__downloads[1].content'),/合成演示/);
const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync('qa-desktop.png',Buffer.from(shot.data,'base64'));
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(200);
assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,'Mobile horizontal overflow');
const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync('qa-mobile.png',Buffer.from(mobile.data,'base64'));
assert.deepEqual(errors,[]);console.log('PASS: synthetic bounds, province selection, year change, map mode, dialog, reset, CSV/SVG exports, mobile width, browser errors.');
}finally{await send('Browser.close').catch(()=>{});ws.close()}
})().catch(e=>{console.error(e.message);browser.kill();process.exitCode=1});
