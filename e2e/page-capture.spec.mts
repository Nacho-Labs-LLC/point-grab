import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createPointGrabMcpServer, createFileHistoryStore } from '../packages/mcp-server/dist/index.js';
let web: Server, webhook: Server, url: string, directory: string, historyPath: string, client: Client;
const history = () => createFileHistoryStore(historyPath).readHistory();
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'point-grab-page-')); historyPath = join(directory, 'history.json');
  const app = createPointGrabMcpServer({ historyPath }); await app.historyStore.ensureHistoryFile();
  client = new Client({ name: 'page-capture-browser', version: '1' });
  const [a,b] = InMemoryTransport.createLinkedPair(); await Promise.all([client.connect(a), app.server.connect(b)]);
  webhook = app.startWebhookServer(0); await once(webhook, 'listening');
  const bundle = await readFile('packages/core/dist/index.global.js');
  web = createServer((req,res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type','text/javascript'); res.end(bundle); return; }
    res.setHeader('Content-Type','text/html');
    res.end(`<!doctype html><html><head><title>Real page capture</title></head><body style="margin:0;background:white;height:2000px;font:18px system-ui"><div id="target" style="position:absolute;left:100px;top:100px;width:300px;height:200px;background:rgb(255,0,0)">Real webpage target</div><div id="lower" style="position:absolute;left:100px;top:1000px;width:300px;height:200px;background:rgb(0,0,255)"></div><p id="copy" style="position:absolute;top:400px">Normal copy still works</p><input aria-label="Sensitive input" value="SECRET" style="position:absolute;left:120px;top:240px"><script src="/bundle.js"></script><script>window.pg=PointGrab.init({devOnly:false,mcpWebhook:true});</script></body></html>`);
  }); web.listen(0,'127.0.0.1'); await once(web,'listening'); url = `http://127.0.0.1:${(web.address() as any).port}`;
});
test.afterAll(async () => { await client?.close(); for (const s of [web,webhook]) if(s) await new Promise<void>(r=>s.close(()=>r())); if(directory) await rm(directory,{recursive:true,force:true}); });
test.beforeEach(async ({page}) => {
  const errors: string[]=[]; page.on('pageerror',e=>errors.push(e.message)); (page as any).__errors=errors;
  await page.context().route('http://localhost:3456/inspect',r=>r.continue({url:`http://127.0.0.1:${(webhook.address() as any).port}/inspect`}));
  await page.goto(url); await page.evaluate(()=>Object.defineProperty(navigator,'mediaDevices',{value:undefined,configurable:true}));
});
test.afterEach(async ({page})=>expect((page as any).__errors).toEqual([]));
async function open(page: Page) {
  await page.keyboard.press('Control+c'); await page.getByRole('button',{name:'Actions',exact:true}).click();
  await page.getByText('Add screenshot',{exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Select current page region',exact:true})).toBeVisible();
}
async function drag(page: Page,x=150,y=150,w=200,h=80,reverse=false) {
  await page.mouse.move(reverse?x+w:x,reverse?y+h:y); await page.mouse.down();
  await page.mouse.move(reverse?x:x+w,reverse?y:y+h,{steps:5}); await page.mouse.up();
}
async function pixels(page: Page) {
  const image=page.getByAltText('Selected screenshot region'); await expect(image).toBeVisible();
  return image.evaluate(async (img:HTMLImageElement)=>{await img.decode(); const c=document.createElement('canvas'); c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);return {width:c.width,height:c.height,center:[...ctx.getImageData(c.width/2,c.height/2,1,1).data]};});
}
test('live page reverse drag → real red pixels → preview/comment → acknowledged persisted MCP image',async({page})=>{
  const before=(await history()).entries.length; await page.evaluate(()=>navigator.clipboard.writeText('sentinel'));
  await open(page); await drag(page,150,150,200,80,true);
  expect(await pixels(page)).toEqual({width:200,height:80,center:[255,0,0,255]});
  expect((await history()).entries).toHaveLength(before);
  const data=await page.getByAltText('Selected screenshot region').getAttribute('src');
  await page.getByLabel('Comment',{exact:true}).fill('Make this blue');
  await page.screenshot({path:'test-results/page-capture/review.png'});
  await page.getByRole('button',{name:'Send image + comment'}).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  const entries=(await history()).entries;expect(entries).toHaveLength(before+1);const entry=entries[0];
  expect(entry.context.screenGrab.comment).toBe('Make this blue'); expect(entry.context.screenGrab.region).toEqual({x:150,y:150,width:200,height:80});
  expect(data).toBe(`data:image/png;base64,${entry.context.screenGrab.data}`);
  const result=await client.callTool({name:'point_grab_get',arguments:{id:entry.id}});
  expect(result.content).toContainEqual({type:'image',mimeType:'image/png',data:entry.context.screenGrab.data});
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('sentinel');
});
test('instruction overlay does not block dragging a region underneath it',async({page})=>{
  await page.evaluate(()=>{const el=document.createElement('div');el.style.cssText='position:absolute;left:500px;top:10px;width:200px;height:80px;background:rgb(255,0,0)';document.body.append(el);});
  await open(page);await drag(page,520,20,150,40);expect((await pixels(page)).center).toEqual([255,0,0,255]);
});
test('nested scrolling during drag invalidates the rectangle',async({page})=>{
  await page.evaluate(()=>{const s=document.createElement('div');s.id='scroller';s.style.cssText='position:absolute;left:450px;top:150px;width:150px;height:150px;overflow:auto';s.innerHTML='<div style="height:600px">Scroll content</div>';document.body.append(s);});
  await open(page);await page.mouse.move(150,150);await page.mouse.down();await page.mouse.move(350,230);await page.locator('#scroller').evaluate(el=>el.scrollTop=100);
  await expect(page.getByRole('status')).toContainText('Page moved');await page.mouse.up();await expect(page.getByAltText('Selected screenshot region')).toHaveCount(0);
});
test('smooth-scroll CSS does not shift cloned-page capture away from settled viewport',async({page})=>{
  await page.evaluate(()=>{document.documentElement.style.scrollBehavior='smooth';window.scrollTo({top:900,behavior:'instant' as ScrollBehavior});});
  await open(page);await drag(page,150,150,200,80);
  expect(await pixels(page)).toEqual({width:200,height:80,center:[0,0,255,255]});
});
test('scroll offset and DPR 2 produce selected page coordinates and device pixels',async({browser})=>{
  const context=await browser.newContext({viewport:{width:1000,height:700},deviceScaleFactor:2});
  await context.route('http://localhost:3456/inspect',r=>r.continue({url:`http://127.0.0.1:${(webhook.address() as any).port}/inspect`}));
  const page=await context.newPage();await page.goto(url);await page.evaluate(()=>scrollTo(0,900));await open(page);await drag(page,150,150,200,80);
  expect(await pixels(page)).toEqual({width:400,height:160,center:[0,0,255,255]});
  await page.getByRole('button',{name:'Send image + comment'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const grab=(await history()).entries[0].context.screenGrab;
  expect(grab.region).toEqual({x:150,y:1050,width:200,height:80});expect(grab.width).toBe(400);expect(grab.height).toBe(160);
  expect(await page.evaluate(()=>scrollY)).toBe(900);await context.close();
});
test('Escape, pointercancel, tiny drag and scrolling during selection never send; Retake returns to live page',async({page})=>{
  const before=(await history()).entries.length;await open(page);await drag(page,150,150,2,2);
  await expect(page.getByRole('status')).toContainText('at least 8');
  await page.mouse.move(150,150);await page.mouse.down();await page.getByRole('dialog').dispatchEvent('pointercancel');await page.mouse.up();
  await expect(page.getByRole('dialog',{name:'Select current page region'})).toBeVisible();
  await page.evaluate(()=>scrollTo(0,100));await expect(page.getByRole('status')).toContainText('Page moved');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(()=>scrollTo(0,0));await open(page);await drag(page);await pixels(page);
  await page.getByRole('button',{name:'Retake'}).click();await expect(page.getByRole('dialog',{name:'Select current page region'})).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await history()).entries).toHaveLength(before);
});
test('Point-grab UI excluded and editable values redacted without changing actual input',async({page})=>{
  await page.evaluate(()=>{const ui=document.createElement('div');ui.id='__point-grab-test__';ui.style.cssText='position:absolute;left:150px;top:150px;width:200px;height:80px;background:lime';document.body.append(ui);});
  await open(page);await drag(page);expect((await pixels(page)).center).toEqual([255,0,0,255]);
  await page.getByRole('button',{name:'Retake'}).click();
  await page.getByLabel('Sensitive input').evaluate((el:HTMLInputElement)=>{el.style.background='lime';});
  await drag(page,130,242,120,12);
  expect((await pixels(page)).center).toEqual([255,0,0,255]);await expect(page.getByRole('dialog')).toContainText('redacted');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Sensitive input')).toHaveValue('SECRET');
});
for (const [name,html] of [
  ['iframe','<iframe src="https://example.com"></iframe>'], ['video','<video></video>'],['canvas','<canvas></canvas>'],
  ['cross-origin image','<img src="https://example.com/picture.png">'],['filter','<div style="filter:blur(2px)">Blur</div>'],
  ['shadow DOM','<div id="shadow"></div>'], ['broken image','<img src="/broken.png">'],
] as const) test(`unsupported ${name} fails visibly, no partial preview`,async({page})=>{
  await page.evaluate(({html,name})=>{const holder=document.createElement('div');holder.innerHTML=html;const el=holder.firstElementChild as HTMLElement;el.style.cssText+=';position:absolute;left:160px;top:160px;width:100px;height:50px';document.body.append(el);if(name==='shadow DOM')el.attachShadow({mode:'open'}).innerHTML='<span>Shadow</span>';},{html,name});
  await open(page);await drag(page);await expect(page.getByRole('alert')).toContainText('Cannot capture');
  await expect(page.getByAltText('Selected screenshot region')).toHaveCount(0);await page.getByRole('button',{name:'Cancel',exact:true}).click();
});
test('failed send keeps preview/comment; retry persists only after acknowledgement',async({page})=>{
  const before=(await history()).entries.length;await open(page);await drag(page);await pixels(page);
  await page.getByLabel('Comment',{exact:true}).fill('Keep for retry');
  await page.route('http://localhost:3456/inspect',r=>r.fulfill({status:503,headers:{'Access-Control-Allow-Origin':'*'},body:'{}'}));
  await page.getByRole('button',{name:'Send image + comment'}).click();await expect(page.getByRole('status')).toContainText('503');
  await expect(page.getByLabel('Comment',{exact:true})).toHaveValue('Keep for retry');expect((await history()).entries).toHaveLength(before);
  await page.unroute('http://localhost:3456/inspect');await page.getByRole('button',{name:'Send image + comment'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);expect((await history()).entries).toHaveLength(before+1);
});
test('pending Send locks controls until real acknowledgement',async({page})=>{
  const before=(await history()).entries.length;let release!:()=>void, requests=0;const gate=new Promise<void>(r=>release=r);
  await page.route('http://localhost:3456/inspect',async route=>{requests++;await gate;await route.continue({url:`http://127.0.0.1:${(webhook.address() as any).port}/inspect`});});
  await open(page);await drag(page);await pixels(page);await page.getByRole('button',{name:'Send image + comment'}).click();
  await expect(page.getByRole('status')).toHaveText('Sending…');for(const name of ['Send image + comment','Retake','Cancel'])await expect(page.getByRole('button',{name,exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Review screenshot'})).toBeVisible();expect((await history()).entries).toHaveLength(before);
  release();await expect(page.getByRole('dialog')).toHaveCount(0);expect(requests).toBe(1);expect((await history()).entries).toHaveLength(before+1);
});
for(const mode of ['legacy acknowledgement','missing transport'])test(`${mode} fails visibly and never claims success`,async({page})=>{
  const before=(await history()).entries.length;
  if(mode==='missing transport')await page.evaluate(()=>(window as any).pg.unregisterPlugin('mcp-webhook'));
  else await page.route('http://localhost:3456/inspect',r=>r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({success:true,id:'legacy'})}));
  await open(page);await drag(page);await pixels(page);await page.getByRole('button',{name:'Send image + comment'}).click();
  await expect(page.getByRole('status')).toContainText(mode==='missing transport'?'exactly one image transport':'did not acknowledge image support');
  await expect(page.getByRole('dialog',{name:'Review screenshot'})).toBeVisible();expect((await history()).entries).toHaveLength(before);
});
test('selected text and native input copy plus ordinary comment paste remain native',async({page})=>{
  await page.locator('#copy').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);getSelection()!.removeAllRanges();getSelection()!.addRange(r);});
  await page.keyboard.press('Control+c');expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('Normal copy still works');
  expect(await page.evaluate(()=>(window as any).pg.isActive())).toBe(false);await page.evaluate(()=>getSelection()!.removeAllRanges());
  await page.getByLabel('Sensitive input').focus();await page.keyboard.press('Control+a');await page.keyboard.press('Control+c');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('SECRET');await page.getByLabel('Sensitive input').blur();await page.evaluate(()=>getSelection()!.removeAllRanges());
  await open(page);await drag(page);await pixels(page);await page.evaluate(()=>navigator.clipboard.writeText('pasted comment'));
  await page.getByLabel('Comment',{exact:true}).focus();await page.keyboard.press('Control+v');await expect(page.getByLabel('Comment',{exact:true})).toHaveValue('pasted comment');
});
