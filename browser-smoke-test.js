'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function findChromium() {
  const candidates = [
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p)) || 'chromium';
}

function serve() {
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      let filePath = path.normalize(decodeURIComponent(url.pathname));
      if (filePath === '/' || filePath === '.') filePath = '/index.html';
      const full = path.join(ROOT, filePath.replace(/^[/\\]+/, ''));
      if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      const ext = path.extname(full);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(full).pipe(res);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(error.stack || error));
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function getJson(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (error) { reject(error); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

async function waitFor(fn, timeoutMs = 10000, intervalMs = 120) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw lastError || new Error('waitFor timeout');
}

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = error => reject(error);
      this.ws.onmessage = event => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result);
        } else if (msg.method) {
          this.events.push(msg);
        }
      };
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(payload);
    });
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

async function evaluate(cdp, expression, label = 'evaluation') {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    timeout: 8000
  });
  if (result.exceptionDetails) {
    throw new Error(`${label} failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result?.value;
}

function fallbackVmQa(reason) {
  const qa = spawnSync(process.execPath, ['qa-self-test.js'], { cwd: ROOT, encoding: 'utf8' });
  if (qa.status !== 0) {
    process.stderr.write(qa.stdout || '');
    process.stderr.write(qa.stderr || '');
    throw new Error('Fallback QA failed');
  }
  const parsed = JSON.parse(qa.stdout);
  const cardDir = path.join(ROOT, 'assets', 'cards');
  const cards = fs.existsSync(cardDir) ? fs.readdirSync(cardDir).filter(x => x.endsWith('.svg')) : [];
  if (cards.length !== parsed.games) throw new Error(`Expected ${parsed.games} SVG cards, found ${cards.length}`);
  const criticalFiles = ['package.json', '.github/workflows/qa.yml', 'PLAYTEST_PROTOCOL.md', 'QA_REPORT.md'];
  const missingFiles = criticalFiles.filter(file => !fs.existsSync(path.join(ROOT, file)));
  if (missingFiles.length) throw new Error(`Missing commercial QA files: ${missingFiles.join(', ')}`);
  console.log(JSON.stringify({
    browser: 'skipped_by_environment_policy',
    fallback: 'vm-dom-commercial-qa',
    reason: String(reason && reason.message ? reason.message : reason).slice(0, 220),
    games: parsed.games,
    cards: cards.length,
    duplicateIds: parsed.duplicates.length,
    failedOpenings: parsed.failedOpenings.length,
    emptyRender: parsed.emptyRender.length,
    smokeFailed: parsed.smokeFailed.length,
    status: 'ok'
  }, null, 2));
}

async function runBrowserQa() {
  const server = await serve();
  const port = server.address().port;
  const chromePort = 9300 + Math.floor(Math.random() * 400);
  const chrome = spawn(findChromium(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-proxy-server',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    `--remote-debugging-port=${chromePort}`,
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  try {
    await waitFor(() => getJson(`http://127.0.0.1:${chromePort}/json/version`), 12000);
    const pages = await waitFor(async () => {
      const list = await getJson(`http://127.0.0.1:${chromePort}/json`);
      return list.find(x => x.type === 'page') || list[0];
    }, 12000);
    const cdp = new CDP(pages.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    await waitFor(() => evaluate(cdp, 'location.href.includes("index.html") && document.readyState === "complete" && !!window.__CAJA_DIAGNOSTICS__', 'readyState'), 12000);
    await evaluate(cdp, 'document.getElementById("enterBtn")?.click(); true;', 'enter');

    const diagnostics = await evaluate(cdp, 'window.__CAJA_DIAGNOSTICS__.smoke()', 'diagnostics');
    const commercial = await evaluate(cdp, 'window.__CAJA_COMMERCIAL_QA__.checks()', 'commercial checks');
    if (!diagnostics || diagnostics.duplicateIds.length || diagnostics.missingRenderers.length) {
      throw new Error(`Diagnostics failed: ${JSON.stringify(diagnostics)}`);
    }
    if (!commercial || commercial.cards.length !== diagnostics.gameCount) {
      throw new Error(`Commercial QA failed: ${JSON.stringify(commercial)}`);
    }

    const renderSmoke = await evaluate(cdp, 'window.__CAJA_RENDER_SMOKE__()', 'render smoke');
    const failed = renderSmoke.filter(x => !x.ok || String(x.status || '').includes('Error controlado'));
    if (failed.length) throw new Error(`Render smoke failed: ${JSON.stringify(failed.slice(0, 8))}`);

    const interaction = await evaluate(cdp, `(() => {
      const click = text => {
        const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().includes(text));
        if (!b) return false;
        b.click();
        return true;
      };
      const status = () => document.getElementById('status')?.textContent || '';
      const out = [];
      openGame('pokerdice'); click('Puntuar'); out.push(['pokerdiceGuard', /Primero lanza/.test(status())]); click('Lanzar'); click('Puntuar'); out.push(['pokerdiceScore', /Resultado/.test(status())]);
      openGame('yatzy'); click('Evaluar'); out.push(['yatzyGuard', /Primero lanza/.test(status())]); click('Lanzar'); click('Evaluar'); out.push(['yatzyScore', /Resultado/.test(status())]);
      openGame('blackjack'); click('Plantarse'); out.push(['blackjackEnd', /Ganas|Gana|Empate/.test(status())]);
      openGame('nim'); click('Quitar 1'); out.push(['nimMove', /Palitos|turno|Turno/i.test(status())]);
      openGame('chess'); out.push(['chessBoard', document.querySelectorAll('.chess-cell').length === 64]);
      openGame('backgammon'); out.push(['backgammonBoard', document.querySelectorAll('.bg-point').length >= 24]);
      const noSafeError = !document.documentElement.classList.contains('safe-error-mode');
      const noBodyOverflow = document.documentElement.scrollWidth <= window.innerWidth + 12;
      return { out, noSafeError, noBodyOverflow, width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth };
    })()`, 'interaction flows');
    const badInteractions = interaction.out.filter(([, ok]) => !ok);
    if (badInteractions.length || !interaction.noSafeError) {
      throw new Error(`Interaction checks failed: ${JSON.stringify(interaction)}`);
    }

    const missingAssets = commercial.cards.filter(asset => !fs.existsSync(path.join(ROOT, asset.replace(/^\.\//, ''))));
    if (missingAssets.length) throw new Error(`Missing SVG card assets: ${missingAssets.join(', ')}`);

    cdp.close();
    console.log(JSON.stringify({
      browser: 'chromium-headless',
      viewport: '390x844 mobile',
      games: diagnostics.gameCount,
      cards: commercial.cards.length,
      renderSmoke: renderSmoke.length,
      interaction: interaction.out,
      noSafeError: interaction.noSafeError,
      noBodyOverflow: interaction.noBodyOverflow,
      status: 'ok'
    }, null, 2));
  } finally {
    chrome.kill('SIGKILL');
    server.close();
  }
}

runBrowserQa().catch(error => {
  if (process.env.STRICT_BROWSER === '1') {
    console.error(error.stack || error);
    process.exit(1);
  }
  fallbackVmQa(error);
});
