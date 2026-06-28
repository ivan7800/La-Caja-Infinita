'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

class ClassList {
  constructor() { this.s = new Set(); }
  add(...xs) { xs.filter(Boolean).forEach(x => String(x).split(/\s+/).filter(Boolean).forEach(v => this.s.add(v))); }
  remove(...xs) { xs.forEach(x => this.s.delete(x)); }
  contains(x) { return this.s.has(x); }
}
class El {
  constructor(tag = 'div', id = '') {
    this.tag = tag; this.id = id; this.children = []; this.style = {}; this.dataset = {}; this.classList = new ClassList();
    this.value = ''; this.type = ''; this.maxLength = 0; this.attributes = {}; this.hidden = false; this.listeners = {};
    this._innerHTML = ''; this._textContent = ''; this.className = '';
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) { this._innerHTML = String(v ?? ''); this.children = []; }
  get textContent() { return this._textContent; }
  set textContent(v) { this._textContent = String(v ?? ''); this._innerHTML = String(v ?? ''); }
  get innerText() { return this.textContent || this.innerHTML; }
  set innerText(v) { this.textContent = v; }
  append(...els) { this.children.push(...els); return this; }
  prepend(...els) { this.children.unshift(...els); return this; }
  addEventListener(ev, fn) { this.listeners[ev] = fn; this['on' + ev] = fn; }
  querySelector(s) { return new El(s.startsWith('#') ? 'button' : 'div', s.replace(/^#/, '')); }
  querySelectorAll() { return []; }
  showModal() {}
  close() {}
  setAttribute(k, v) { this.attributes[k] = v; }
}
const ids = 'board gameControls status totalGames totalPlays totalWins gamesGrid searchInput gameScreen catalog gameTitle gameSubtitle rulesText statPlays statWins boot enterBtn homeBtn backBtn soundBtn themeBtn resetStatsBtn achBtn qaBtn closeAch achievementsDialog achievementsList filters'.split(' ');
const elems = {}; ids.forEach(id => elems[id] = new El('div', id)); elems.searchInput.value = '';
elems.gameScreen.classList.add('hidden');
const document = {
  documentElement: new El('html', 'html'), body: new El('body', 'body'), onkeydown: null,
  querySelector(s) {
    if (s.startsWith('#')) return elems[s.slice(1)] || (elems[s.slice(1)] = new El('div', s.slice(1)));
    if (s === '.filter') return new El('button');
    return new El();
  },
  querySelectorAll(s) { if (s === '.filter') return [new El('button'), new El('button')]; return []; },
  createElement(tag) { return new El(tag); }
};
const localStorage = { m: {}, getItem(k) { return this.m[k] || null; }, setItem(k, v) { this.m[k] = String(v); }, removeItem(k) { delete this.m[k]; }, clear() { this.m = {}; } };
const timers = [];
const context = {
  console, document, localStorage, navigator: {}, location: { protocol: 'file:' },
  window: {}, confirm: () => true,
  setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout: () => {}, setInterval: () => 2, clearInterval: () => {},
  Math, JSON, Array, Set, Map, String, Number, RegExp, Object, Date
};
context.window = context;
vm.createContext(context);
try {
  vm.runInContext(code, context, { filename: 'app.js' });
} catch (error) {
  console.error('INIT ERROR');
  console.error(error.stack || error);
  process.exit(1);
}
const idsFromSource = [...code.matchAll(/\{id:'([^']+)'/g)].map(m => m[1]);
const duplicates = idsFromSource.filter((id, index) => idsFromSource.indexOf(id) !== index);
let failed = [];
let emptyRender = [];
for (const id of idsFromSource) {
  try {
    context.openGame(id);
    const status = elems.status.innerHTML || elems.status.textContent || '';
    const hasUi = elems.board.children.length > 0 || elems.gameControls.children.length > 0 || elems.board.innerHTML.trim().length > 0;
    if (status.includes('Error controlado')) failed.push([id, status]);
    if (!hasUi) emptyRender.push(id);
  } catch (error) {
    failed.push([id, error.stack || String(error)]);
  }
}
const diagnostics = context.__CAJA_DIAGNOSTICS__?.smoke?.() || null;
const renderSmoke = context.__CAJA_RENDER_SMOKE__?.() || [];
const smokeFailed = renderSmoke.filter(x => !x.ok).map(x => x.id);
const result = {
  syntax: 'ok',
  games: idsFromSource.length,
  duplicates,
  failedOpenings: failed.map(x => x[0]),
  emptyRender,
  smokeFailed,
  diagnostics
};
console.log(JSON.stringify(result, null, 2));
if (duplicates.length || failed.length || emptyRender.length || smokeFailed.length) process.exit(2);
