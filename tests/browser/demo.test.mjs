import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

let browser, server, origin;
const received = [];
const root = resolve('dist');
const basePath = process.env.TEST_BASE_PATH || '/portfolio/';
assert.match(basePath, /^\/[a-z0-9-]+\/$/);
const csp = readFileSync('index.html','utf8').match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
before(async () => {
  server = createServer((req,res) => {
    received.push({ url: req.url, method: req.method });
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (!pathname.startsWith(basePath)) { res.writeHead(404); res.end(); return; }
    const relative = '/' + pathname.slice(basePath.length);
    const file=resolve(root, '.' + (relative === '/' ? '/index.html' : relative));
    if (!file.startsWith(root + '/') || !existsSync(file)) { res.writeHead(404);res.end();return; }
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(file)] || 'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'Content-Security-Policy':csp,'Permissions-Policy':'camera=(), microphone=(), geolocation=()','Cache-Control':'no-store'});
    res.end(readFileSync(file));
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  origin=`http://127.0.0.1:${server.address().port}`;
  const systemChrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : existsSync(systemChrome)?{executablePath:systemChrome}:{})});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});

async function open(t, mobile=false) {
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},timezoneId:'America/Recife'});
  const errors=[], external=[], failedAssets=[];
  await context.route('**/*',async route=>{
    const url=route.request().url();
    if (/^https?:/.test(url) && new URL(url).origin !== origin) { external.push(url);await route.abort(); }
    else await route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{ if (response.status() >= 400) failedAssets.push(response.url()); });
  t.after(async()=>{assert.deepEqual(errors,[],'Erros no navegador');assert.deepEqual(external,[],'Tentativa de rede externa');assert.deepEqual(failedAssets,[],'Recurso com erro HTTP');await context.close();});
  await page.goto(origin+basePath);
  await page.getByRole('heading',{name:'Olá, vamos explorar.'}).waitFor();
  return page;
}
async function nav(page,name) { await page.getByRole('button',{name,exact:true}).filter({visible:true}).first().click(); }
async function data(page) {
  await nav(page,'Configurações');
  const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'JSON fictício',exact:true}).click();
  const download=await waiting;const stream=await download.createReadStream();let content='';for await(const chunk of stream)content+=chunk;
  return JSON.parse(content);
}
async function deleteEntry(page,name) {
  await nav(page,'Movimentações');
  await page.getByRole('button',{name:new RegExp(name)}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Excluir',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  await page.getByRole('alertdialog').waitFor({state:'hidden'});
}

test('desktop: cadastro, edição, exclusão, importação fictícia, exportação e reinício', async t=>{
  const page=await open(t);
  await page.getByRole('button',{name:/^Gastei/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Valor',{exact:true}).fill('48,00');
  await dialog.getByLabel('Descrição',{exact:true}).fill('Lanche fictício de teste');
  await dialog.getByRole('button',{name:'Confirmar e salvar',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  let snapshot=await data(page);
  assert.equal(snapshot.entries.find(entry=>entry.description==='Lanche fictício de teste').amount,4800);
  await nav(page,'Movimentações');await page.getByRole('button',{name:/Lanche fictício de teste/}).click();
  await dialog.getByLabel('Valor',{exact:true}).fill('49,00');
  await dialog.getByRole('button',{name:'Confirmar e salvar',exact:true}).click();await dialog.waitFor({state:'hidden'});
  snapshot=await data(page);assert.equal(snapshot.entries.find(entry=>entry.description==='Lanche fictício de teste').amount,4900);
  await deleteEntry(page,'Lanche fictício de teste');
  snapshot=await data(page);assert.equal(snapshot.entries.some(entry=>entry.description==='Lanche fictício de teste'),false);
  await page.getByRole('button',{name:'Importar exemplo fictício',exact:true}).click();
  await dialog.getByRole('button',{name:'Confirmar importação fictícia',exact:true}).click();await dialog.waitFor({state:'hidden'});
  snapshot=await data(page);assert.equal(snapshot.entries.filter(entry=>entry.origin==='exemplo fictício').length,2);
  await page.getByRole('button',{name:'Importar exemplo fictício',exact:true}).click();
  assert.equal(await dialog.getByRole('button',{name:'Confirmar importação fictícia',exact:true}).isDisabled(),true);
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Reiniciar demonstração',exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button',{name:'Confirmar',exact:true}).click();
  snapshot=await data(page);assert.equal(snapshot.entries.some(entry=>entry.origin==='exemplo fictício'),false);
});

for(const name of ['parcela final','primeira parcela']) {
  test(`navegador: excluir ${name} reabre o saldo correto e mantém vínculos`,async t=>{
    const page=await open(t);const before=await data(page);
    await deleteEntry(page,`Projeto fictício · ${name}`);
    const snapshot=await data(page);
    const pending=snapshot.entries.find(entry=>entry.payer==='Cliente Exemplo'&&entry.status==='pending');
    assert.equal(pending.amount,name==='parcela final'?70000:30000);
    assert.equal(pending.date,before.entries.find(entry=>entry.id==='sample-job').expectedDate);
    const surviving=snapshot.entries.find(entry=>entry.payer==='Cliente Exemplo'&&entry.status==='confirmed');
    assert.equal(surviving.receivable,pending.id);
  });
}

test('recebimento parcial pelo formulário e navegação pelas áreas principais',async t=>{
  const page=await open(t);
  await nav(page,'Entradas e freelas');
  await page.getByRole('button',{name:'Registrar recebimento',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('radio',{name:/Recebi só uma parte/}).click();
  await dialog.locator('input[inputmode="decimal"]').fill('300,00');
  await dialog.getByRole('button',{name:'Confirmar recebimento',exact:true}).click();await dialog.waitFor({state:'hidden'});
  const snapshot=await data(page);
  assert.equal(snapshot.entries.find(entry=>entry.id==='t11').amount,70000);
  assert.ok(snapshot.entries.some(entry=>entry.receivable==='t11'&&entry.amount===30000));
  for(const name of ['Planejar','Objetivos','Contas e cartões','Dívidas','Recorrências','Calendário','Relatórios','Gestor']) {
    await nav(page,name);
    assert.equal(await page.locator('main h1').innerText(),name);
  }
});

test('celular: navegação, formulário, tema e layout sem rolagem horizontal',async t=>{
  const page=await open(t,true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await page.getByRole('button',{name:'Alternar tema',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('class'),'dark');
  await page.getByRole('button',{name:/^Gastei/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Valor',{exact:true}).fill('12,50');
  await dialog.getByLabel('Descrição',{exact:true}).fill('Café fictício móvel');
  await dialog.getByRole('button',{name:'Confirmar e salvar',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Registros',exact:true}).click();assert.ok(await page.getByRole('button',{name:/Café fictício móvel/}).isVisible());
  await page.reload();await page.getByRole('heading',{name:'Olá, vamos explorar.'}).waitFor();
  mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
});

test('isolamento: apenas arquivos estáticos, sem persistência, permissões ou canais de dados',async t=>{
  const page=await open(t);const requestsBefore=received.length;
  const blocked=await page.evaluate(async()=>{
    let fetchBlocked=false,xhrBlocked=false,socketBlocked=false;
    try { await fetch('/api/finance'); } catch { fetchBlocked=true; }
    try { new XMLHttpRequest(); } catch { xhrBlocked=true; }
    try { new WebSocket('wss://example.invalid'); } catch { socketBlocked=true; }
    return {fetchBlocked,xhrBlocked,socketBlocked,beacon:navigator.sendBeacon('/api/finance','fiction'),local:localStorage.length,session:sessionStorage.length,files:document.querySelectorAll('input[type=file]').length,cookie:document.cookie};
  });
  assert.deepEqual(blocked,{fetchBlocked:true,xhrBlocked:true,socketBlocked:true,beacon:false,local:0,session:0,files:0,cookie:''});
  assert.equal(received.length,requestsBefore);
  assert.ok(received.every(request=>request.method==='GET'&&!request.url.includes('/api/')));
  assert.equal(await page.locator('a[href^="http"]').count(),0);
  mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
});

test('hospedagem: recursos, estilos e fontes funcionam no subdiretório após atualização', async t => {
  const page = await open(t);
  await page.evaluate(() => document.fonts.ready);
  const resources = await page.locator('script[src], link[href], img[src]').evaluateAll(elements =>
    elements.map(element => element.src || element.href));
  assert.ok(resources.some(url => url.endsWith('.js')));
  assert.ok(resources.some(url => url.endsWith('.css')));
  for (const url of resources) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, origin);
    assert.ok(parsed.pathname.startsWith(basePath), url);
  }
  assert.equal(await page.evaluate(() => document.fonts.status), 'loaded');
  assert.ok(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.cssRules.length > 0)));
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  const response = await fetch(new URL(icon, page.url()));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<svg/);
  await nav(page, 'Relatórios');
  assert.equal(page.url(), origin + basePath);
  await page.reload();
  await page.getByRole('heading', { name: 'Olá, vamos explorar.' }).waitFor();
  assert.equal(page.url(), origin + basePath);
  assert.ok(existsSync(resolve(root, '.nojekyll')));
});
