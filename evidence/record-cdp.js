const fs = require('fs');
const path = require('path');

const name = process.argv[2];
const directory = `/private/tmp/htw-record-${name}`;
fs.mkdirSync(directory, { recursive: true });
const stageFile = `/private/tmp/htw-stage-${name}.txt`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  let pages;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      pages = await (await fetch('http://127.0.0.1:9222/json')).json();
      if (pages.some(candidate => candidate.type === 'page')) break;
    }
    catch { await sleep(100); }
  }
  const page = pages?.find(candidate => candidate.type === 'page');
  if (!page) throw new Error('VS Code page was not exposed by Electron');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map();
  let id = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject });
    socket.send(JSON.stringify({ id: next, method, params }));
  });
  await call('Page.enable');
  let frame = 0;
  const stages = [];
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const stage = fs.existsSync(stageFile) ? fs.readFileSync(stageFile, 'utf8').trim() : '';
    if (stage === 'done') break;
    if (stage === 'before' || stage === 'after') {
      const result = await call('Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: false });
      fs.writeFileSync(path.join(directory, `frame${String(frame).padStart(4, '0')}.jpg`), Buffer.from(result.data, 'base64'));
      stages.push(stage);
      frame++;
    }
    await sleep(250);
  }
  socket.close();
  fs.writeFileSync(path.join(directory, 'stages.json'), JSON.stringify({ frames: frame, stages }));
  console.log(JSON.stringify({ name, frames: frame, before: stages.filter(stage => stage === 'before').length, after: stages.filter(stage => stage === 'after').length }));
  if (!stages.includes('before') || !stages.includes('after')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
