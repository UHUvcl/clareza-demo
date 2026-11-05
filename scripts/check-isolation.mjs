import { readFileSync, readdirSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
for (const folder of ['app', 'lib', 'components', 'hooks']) {
  for (const file of walk(folder)) {
    const source=readFileSync(file,'utf8');
    assert.doesNotMatch(source, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|sendBeacon|serviceWorker|SpeechRecognition|webkitSpeechRecognition|modelContext|localStorage|sessionStorage|indexedDB|document\.cookie/, file);
    assert.doesNotMatch(source, /signin-with-chatgpt|signout-with-chatgpt|\/api\/finance|cloudflare:workers|https?:\/\//, file);
    assert.doesNotMatch(source, /type=["']file["']/, file);
  }
}
for (const forbidden of ['app/api','db','drizzle','.openai','.wrangler','.env','public/sw.js']) assert.equal(existsSync(forbidden),false,forbidden);
const pkg=JSON.parse(readFileSync('package.json','utf8'));
for(const dependency of ['next','vinext','wrangler','drizzle-orm','tesseract.js']) assert.equal(dependency in pkg.dependencies,false,dependency);
const html=readFileSync('dist/index.html','utf8');
assert.ok(html.includes("connect-src 'none'"));
assert.ok(html.includes("worker-src 'none'"));
assert.ok(html.includes("form-action 'none'"));
for(const file of walk('dist')) {
  assert.doesNotMatch(file,/\.map$/);
  if(/\.(js|css|html)$/.test(file)) assert.doesNotMatch(readFileSync(file,'utf8'),/chatgpt\.site|chatgpt-team\.site|\/api\/finance|oai-authenticated-user|signin-with-chatgpt|cloudflare:workers/,file);
}
console.log('Isolamento verificado: sem API, autenticação, armazenamento persistente, seletores de arquivos ou integrações; CSP presente no build.');
