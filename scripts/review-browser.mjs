import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
const pause = ms => new Promise(r => setTimeout(r, ms));
export async function reviewBrowser(origin) {
  const output = resolve('qa/phase-02f-1'); await mkdir(output, {recursive:true});
  const profile = await mkdtemp(resolve('.next/browser-02f-'));
  assert.ok(profile.startsWith(resolve('.next') + sep), 'Browser profile cleanup must stay inside .next');
  const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'], {windowsHide:true,stdio:'ignore'});
  let ws; const pending=new Map(); let id=0;
  const results=[]; let exchanges=0, downloads=0, receiptResult=200;
  try {
    let targets;
    for(let i=0;i<60;i++){try {
      const debugPort=(await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0].trim();
      assert.match(debugPort,/^\d+$/);
      targets=await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();break;
    }catch{await pause(100);}}
    assert.ok(targets?.length,'Headless browser must expose a page');
    ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
    await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
    const send=(method,params={})=>new Promise((res,rej)=>{const key=++id;pending.set(key,{res,rej});ws.send(JSON.stringify({id:key,method,params}));});
    ws.onmessage=async e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p?.rej(new Error(JSON.stringify(msg.error)));else p?.res(msg.result);}
      if(msg.method==='Fetch.requestPaused'){
        const {requestId,request}=msg.params; const path=new URL(request.url).pathname;
        let status=200,body='{}',headers=[{name:'Content-Type',value:'application/json'}];
        if(path.endsWith('recovery-exchanges')){exchanges++;status=receiptResult;body=JSON.stringify({message:'Receipt recovery completed.',data:{receipt_uuid:'22345678-1234-4123-8123-123456789abc'}});}
        else if(path.endsWith('/download')){downloads++;body='%PDF-1.4\n% Synthetic QA only\n%%EOF';headers=[{name:'Content-Type',value:'application/pdf'},{name:'Content-Disposition',value:'attachment; filename="receipt-synthetic.pdf"'},{name:'Cache-Control',value:'private, no-store'},{name:'Pragma',value:'no-cache'}];}
        else if(path.endsWith('recovery-requests')){status=202;body='{}';}
        await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:headers,body:Buffer.from(body).toString('base64')});
      }
    };
    const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
    const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('Browser condition timed out: '+expression);};
    await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
    await send('Network.setBlockedURLs',{urls:['*://*.example.test/*']});
    await send('Fetch.enable',{patterns:[{urlPattern:origin+'/api/donation-receipts/*'}]});
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:output});
    async function navigate(path){await send('Page.navigate',{url:'about:blank'});await until('location.href === "about:blank"');await send('Page.navigate',{url:origin+path});await until('document.readyState === "complete" && !!document.querySelector("h1")');await evaluate('document.fonts.ready.then(()=>true)');await pause(200);}
    async function click(selector){await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(150);}
    async function fill(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${selector.includes('country')?'HTMLSelectElement':'HTMLInputElement'}.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
    async function capture(name,width){
      const metrics=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,active:document.activeElement?.id})`);
      assert.ok(metrics.scroll<=metrics.width+1,`${name} overflows: ${JSON.stringify(metrics)}`);assert.equal(metrics.h1,1);
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
      const path=resolve(output,`${width}-${name}.png`);await writeFile(path,Buffer.from(shot.data,'base64'));results.push({name,width,path,metrics});
    }
    for(const width of [1440,820,390,360]){
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      for(const [name,path] of [['home','/'],['projects','/projects'],['filtered','/projects?country_code=EG'],['detail','/projects/1'],['payment-return','/payment-return'],['receipt-request','/receipts/recover']]){await navigate(path);await capture(name,width);}
      await navigate('/donate/1');await until('!document.querySelector("fieldset").disabled');await capture('donation',width);
      await click('button[type=submit]');await until('!!document.querySelector("[aria-invalid=true]")');await capture('validation',width);
      assert.equal(await evaluate('document.activeElement.id'),'guest-amount');
      for(const [field,value] of Object.entries({amount:'12.34',name:'زائر الاختبار',email:'qa@example.test',phone:'+201001234567'}))await fill('#guest-'+field,value);
      await click('button[type=submit]');await until('!!document.querySelector("#billing-first_name")');await capture('billing',width);
      for(const [field,value] of Object.entries({first_name:'زائر',last_name:'اختبار',street:'شارع الاختبار',building:'12',floor:'2',apartment:'3',city:'القاهرة',state:'القاهرة',country:'EG'}))await fill('#billing-'+field,value);
      await click('button[type=submit]');await until('!!document.querySelector(".checkout-operation")');await capture('review-disabled',width);
      assert.equal(await evaluate('document.querySelectorAll(".checkout-operation button").length'),0);
      const fragment='#token_id=12345678-1234-4123-8123-123456789abc&secret='+'A'.repeat(43);
      await navigate('/receipt-recovery'+fragment);await until('location.hash === "" && !!document.querySelector(".receipt-link-state button")');await capture('recovery-ready',width);
      const before=exchanges;await click('.receipt-link-state button');await until('!document.querySelector(".receipt-link-state").getAttribute("aria-busy").includes("true")');assert.equal(exchanges,before+1);await capture('recovery-authorized',width);
      await click('.receipt-link-state button');await until('!document.querySelector(".receipt-link-state").getAttribute("aria-busy").includes("true")');await capture('browser-handoff',width);
      receiptResult=404;await navigate('/receipt-recovery'+fragment);await until('!!document.querySelector(".receipt-link-state button")');await click('.receipt-link-state button');await until('!document.querySelector(".receipt-link-state button")');await capture('recovery-denied',width);receiptResult=200;
      if(width===360){await navigate('/');await click('.mobile-menu summary');assert.equal(await evaluate('document.querySelector(".mobile-menu").open'),true);await capture('mobile-menu',width);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});results.push({name:'keyboard-tab',active:await evaluate('document.activeElement.outerHTML')});}
      console.log('Browser QA completed width '+width);
    }
    await writeFile(resolve(output,'results.json'),JSON.stringify({results,exchanges,downloads,limitations:['Synthetic CDP interception is not Laravel authorization or cookie verification','No screen reader or physical mobile keyboard','Synthetic PDF is not a real receipt integrity check']},null,2));
  } finally {ws?.close();browser.kill();await pause(400);await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});}
}
