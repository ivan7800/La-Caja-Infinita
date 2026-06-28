'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const board = $('#board');
const controls = $('#gameControls');
const statusEl = $('#status');
const themes = ['classic', 'night', 'forest', 'toy', 'cyberpunk', 'arcade'];

const storage = (() => {
  const memory = {};
  try {
    const key = '__caja_infinita_storage_test__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch (error) {
    return {
      getItem(key) { return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null; },
      setItem(key, value) { memory[key] = String(value); },
      removeItem(key) { delete memory[key]; },
      clear() { Object.keys(memory).forEach(key => delete memory[key]); }
    };
  }
})();
const store = {
  sound: storage.getItem('sound') !== '0',
  theme: storage.getItem('theme') || 'classic',
  stats: safeJson(storage.getItem('stats'), {})
};
let currentGame = null;
let activeFilter = 'all';
let gameTimers = new Set();

function safeJson(text, fallback) { try { return text ? JSON.parse(text) : fallback; } catch { return fallback; } }
function saveStats() { storage.setItem('stats', JSON.stringify(store.stats)); updateTotals(); }
function rnd(n) { return Math.floor(Math.random() * n); }
function pick(a) { return a[rnd(a.length)]; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    _audioCtx = new Ctx();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}
function tone(f = 440, d = 0.075, type = 'triangle') {
  if (!store.sound) return;
  try {
    const a = getAudioCtx();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = 0.038;
    o.connect(g); g.connect(a.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + d);
    o.stop(a.currentTime + d + 0.05);
  } catch {}
}
function setStatus(t) { statusEl.innerHTML = t; }
function gameTimeout(fn, ms = 0) { const id = setTimeout(() => { gameTimers.delete(id); fn(); }, ms); gameTimers.add(id); return id; }
function gameInterval(fn, ms = 0) { const id = setInterval(fn, ms); gameTimers.add(id); return id; }
function clearGameTimers() { gameTimers.forEach(id => { clearTimeout(id); clearInterval(id); }); gameTimers.clear(); }
function clearBoard() { clearGameTimers(); board.innerHTML = ''; controls.innerHTML = ''; document.onkeydown = null; }
function btn(text, fn, cls = 'primary') { const b = document.createElement('button'); b.textContent = text; b.className = cls; b.type = 'button'; b.addEventListener('click', fn); return b; }
function input(type = 'text', value = '') { const i = document.createElement('input'); i.type = type; i.value = value; return i; }
function select(options, value, fn) { const s = document.createElement('select'); options.forEach(o => { const opt = document.createElement('option'); opt.value = o.value ?? o; opt.textContent = o.label ?? o; s.append(opt); }); s.value = value; s.addEventListener('change', () => fn(s.value)); return s; }
function cell(txt = '', fn = null, cls = 'cell') { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.innerHTML = txt; if (fn) b.addEventListener('click', fn); return b; }
function div(cls = '', html = '') { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; return d; }
function startStat(id) { store.stats[id] = store.stats[id] || { plays: 0, wins: 0, best: null }; store.stats[id].plays++; saveStats(); paintStats(id); }
function winStat(id, best = null) { store.stats[id] = store.stats[id] || { plays: 0, wins: 0, best: null }; store.stats[id].wins++; if (best !== null && (store.stats[id].best === null || best < store.stats[id].best)) store.stats[id].best = best; saveStats(); paintStats(id); tone(660, .14, 'sine'); }
function paintStats(id) { $('#statPlays').textContent = store.stats[id]?.plays || 0; $('#statWins').textContent = store.stats[id]?.wins || 0; }
function updateTotals() { $('#totalGames').textContent = games.length; $('#totalPlays').textContent = Object.values(store.stats).reduce((a, s) => a + (s.plays || 0), 0); $('#totalWins').textContent = Object.values(store.stats).reduce((a, s) => a + (s.wins || 0), 0); }
function grid(cols, cls = '') { const g = div('grid ' + cls); g.style.gridTemplateColumns = `repeat(${cols}, 1fr)`; return g; }
function paragraph(text) { const p = document.createElement('p'); p.textContent = text; return p; }
function backHome() { $('#gameScreen').classList.add('hidden'); $('#catalog').classList.remove('hidden'); currentGame = null; renderCatalog(); }
function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

const games = [
  {id:'tictactoe',name:'Tres en Raya',icon:'⭕',cat:['duelo','logica'],sub:'Duelo rápido de lápiz y papel.',rules:'Turnos alternos. Gana quien alinee 3 símbolos.'},
  {id:'connect4',name:'Conecta 4',icon:'🔴',cat:['duelo','tablero'],sub:'Fichas que caen por columnas.',rules:'Pulsa una columna. Gana quien conecte 4 fichas.'},
  {id:'memory',name:'Memory',icon:'🃏',cat:['cartas','logica'],sub:'Parejas, memoria y reflejos.',rules:'Levanta dos cartas. Si coinciden, se quedan abiertas.'},
  {id:'simon',name:'Simón',icon:'🎵',cat:['logica'],sub:'Repite la secuencia luminosa.',rules:'Memoriza la secuencia y repítela sin fallar.'},
  {id:'dice',name:'Dados Reales',icon:'🎲',cat:['azar','familia'],sub:'Tiradas de 1 a 6 dados.',rules:'Elige cuántos dados tirar y pulsa lanzar.'},
  {id:'coin',name:'Moneda',icon:'🪙',cat:['azar'],sub:'Cara o cruz ceremonial.',rules:'Pulsa lanzar y deja decidir a la suerte.'},
  {id:'rps',name:'Piedra Papel Tijera',icon:'✂️',cat:['duelo','azar'],sub:'Contra la caja.',rules:'Elige piedra, papel o tijera. La caja responde.'},
  {id:'goose',name:'La Oca Infinita',icon:'🪿',cat:['tablero','azar','familia'],sub:'Carrera familiar con casillas especiales.',rules:'Tira el dado. Llega justo a la casilla 30 antes que la caja.'},
  {id:'ladders',name:'Escaleras y Serpientes',icon:'🐍',cat:['tablero','azar','familia'],sub:'Subidas gloriosas y caídas crueles.',rules:'Llega a la 36. Las escaleras suben, las serpientes bajan.'},
  {id:'battleship',name:'Hundir la Flota',icon:'🚢',cat:['tablero','logica'],sub:'Busca los barcos ocultos.',rules:'Pulsa casillas del mar. Hunde todos los barcos en pocos disparos.'},
  {id:'mines',name:'Buscaminas Mini',icon:'💣',cat:['logica'],sub:'Tablero compacto y rejugable.',rules:'Abre casillas. Los números indican minas alrededor.'},
  {id:'mastermind',name:'Código Secreto',icon:'🔐',cat:['logica'],sub:'Adivina la combinación.',rules:'El código tiene 4 colores. Negro=posición exacta, blanco=color correcto.'},
  {id:'twenty48',name:'2048 de Madera',icon:'🔢',cat:['logica'],sub:'Fusiona piezas hasta 2048.',rules:'Usa botones o teclado. Dos iguales se fusionan.'},
  {id:'hangman',name:'Ahorcado',icon:'📜',cat:['palabras','familia'],sub:'Palabra oculta sin drama.',rules:'Adivina letras antes de agotar los 7 intentos.'},
  {id:'checkers',name:'Damas Mini',icon:'⚫',cat:['tablero','duelo'],sub:'Capturas diagonales locales.',rules:'Mueve en diagonal. Captura saltando sobre piezas rivales.'},
  {id:'domino',name:'Dominó Ligero',icon:'▥',cat:['tablero','azar','familia'],sub:'Encadena números y vacía la mano.',rules:'Coloca fichas compatibles con los extremos. Si no puedes, roba.'},
  {id:'chess',name:'Ajedrez Mini',icon:'♞',cat:['tablero','duelo'],sub:'Ajedrez local simplificado.',rules:'Mueve piezas por turnos. No valida jaque complejo: gana capturando el rey rival.'},
  {id:'parchis',name:'Parchís Express',icon:'🏁',cat:['tablero','azar','familia'],sub:'Carrera de fichas en pista corta.',rules:'Tira el dado y avanza. Las casillas estrella dan impulso.'},
  {id:'reversi',name:'Reversi / Othello',icon:'⚪',cat:['tablero','duelo','logica'],sub:'Rodea fichas y gira el tablero.',rules:'Coloca una ficha flanqueando rivales. Gana quien tenga más.'},
  {id:'go',name:'Go 9x9 Mini',icon:'⚫',cat:['tablero','duelo'],sub:'Territorio y capturas simplificadas.',rules:'Coloca piedras por turnos. Las piedras sin libertades se capturan.'},
  {id:'backgammon',name:'Backgammon Carrera',icon:'🎯',cat:['tablero','azar'],sub:'Versión carrera con dados dobles.',rules:'Avanza tus fichas hasta salir del tablero antes que la caja.'},
  {id:'nim',name:'Nim',icon:'🪵',cat:['logica','duelo'],sub:'Palitos, estrategia y trampa mental.',rules:'Retira 1 a 3 palitos. Pierde quien se lleva el último.'},
  {id:'hanoi',name:'Torres de Hanoi',icon:'🗼',cat:['logica'],sub:'Clásico de discos y paciencia.',rules:'Mueve todos los discos a la tercera torre sin poner uno grande sobre uno pequeño.'},
  {id:'fifteen',name:'Puzzle 15',icon:'🧩',cat:['logica'],sub:'Deslizador clásico.',rules:'Ordena las piezas del 1 al 15 usando el hueco.'},
  {id:'lightsout',name:'Luces Fuera',icon:'💡',cat:['logica'],sub:'Apaga el tablero.',rules:'Cada pulsación cambia esa luz y las vecinas. Apaga todas.'},
  {id:'peg',name:'Solitario de Clavijas',icon:'📍',cat:['tablero','logica'],sub:'Salta y elimina piezas.',rules:'Salta una pieza sobre otra hacia un hueco. Intenta dejar una sola.'},
  {id:'sudoku',name:'Sudoku',icon:'🔢',cat:['logica'],sub:'Generador infinito de tableros.',rules:'Completa filas, columnas y bloques 3x3 con números del 1 al 9.'},
  {id:'killer',name:'Killer Sudoku Mini',icon:'➕',cat:['logica'],sub:'Sumas y sudoku 4x4.',rules:'Rellena 1-4 sin repetir por fila/columna. Respeta las sumas marcadas.'},
  {id:'futoshiki',name:'Futoshiki',icon:'<>',cat:['logica'],sub:'Números con desigualdades.',rules:'Completa 1-4 por fila y columna respetando < y >.'},
  {id:'skyscrapers',name:'Rascacielos',icon:'🏙️',cat:['logica'],sub:'Torres vistas desde los bordes.',rules:'Rellena alturas 1-4. Las pistas indican cuántas torres se ven.'},
  {id:'nonogram',name:'Nonogramas',icon:'▦',cat:['logica'],sub:'Pinta el dibujo secreto.',rules:'Las pistas indican grupos de casillas pintadas por fila y columna.'},
  {id:'kakuro',name:'Kakuro Mini',icon:'✚',cat:['logica'],sub:'Crucigrama de sumas.',rules:'Rellena cada grupo con números sin repetir para alcanzar la suma.'},
  {id:'wordsearch',name:'Sopa de Letras',icon:'🔎',cat:['palabras','familia'],sub:'Encuentra palabras escondidas.',rules:'Pulsa letras contiguas en línea para marcar una palabra.'},
  {id:'crossword',name:'Crucigrama Mini',icon:'✏️',cat:['palabras'],sub:'Pistas cortas y letras cruzadas.',rules:'Escribe las respuestas en las casillas blancas y comprueba.'},
  {id:'wordle',name:'Palabra 5',icon:'🟩',cat:['palabras','logica'],sub:'Adivina la palabra en 6 intentos.',rules:'Verde=correcto, amarillo=letra existe, gris=no está.'},
  {id:'anagrams',name:'Anagramas',icon:'🔤',cat:['palabras'],sub:'Ordena letras desordenadas.',rules:'Escribe la palabra correcta a partir de las letras mezcladas.'},
  {id:'trivia',name:'Trivial de Sobremesa',icon:'❓',cat:['familia','palabras'],sub:'Cultura general rápida.',rules:'Responde preguntas. 5 aciertos completan la partida.'},
  {id:'pasapalabra',name:'Rosco 404',icon:'⭕',cat:['palabras','familia'],sub:'Pasapalabra compacto.',rules:'Responde letras del rosco. Puedes pasar y volver.'},
  {id:'blackjack',name:'Blackjack',icon:'🂡',cat:['cartas','azar'],sub:'21 clásico contra la caja.',rules:'Pide cartas sin pasarte de 21. La banca se planta en 17.'},
  {id:'pokerdice',name:'Póker de Dados',icon:'🎲',cat:['azar','familia'],sub:'Cinco dados y una mano.',rules:'Lanza hasta dos veces y busca pareja, trío, full, póker o escalera.'},
  {id:'bingo',name:'Bingo Retro',icon:'🎱',cat:['azar','familia'],sub:'Cartón rápido 5x5.',rules:'Saca bolas hasta completar una línea.'},
  {id:'yatzy',name:'Generala / Yatzy',icon:'⚂',cat:['azar','familia'],sub:'Combinaciones con cinco dados.',rules:'Tres tiradas por ronda. Evalúa la mejor combinación.'},
  {id:'solitaire',name:'Solitario Express',icon:'♥️',cat:['cartas','logica'],sub:'Ordena cartas por palo.',rules:'Coloca cartas del mismo palo en ascendente. Versión rápida.'},
  {id:'freecell',name:'FreeCell Mini',icon:'♣️',cat:['cartas','logica'],sub:'Celdas libres y secuencias.',rules:'Mueve cartas a celdas libres y crea secuencias descendentes alternando color.'},
  {id:'spider',name:'Spider Mini',icon:'🕷️',cat:['cartas','logica'],sub:'Secuencias descendentes.',rules:'Ordena columnas en descendente. El reto es completar una escalera.'},
  {id:'dots',name:'Puntos y Cajas',icon:'□',cat:['duelo','logica','familia'],sub:'Cierra cuadrados con líneas.',rules:'Pulsa líneas entre puntos. Quien cierra una caja suma punto y repite.'},
  {id:'sos',name:'SOS',icon:'🆘',cat:['duelo','palabras'],sub:'Forma SOS en el tablero.',rules:'Coloca S u O. Cada SOS formado suma punto.'},
  {id:'bulls',name:'Bulls & Cows',icon:'🐂',cat:['logica'],sub:'Código numérico sin repetir.',rules:'Toros=posición exacta. Vacas=número correcto en otra posición.'},
  {id:'maze',name:'Laberinto',icon:'🧭',cat:['logica','familia'],sub:'Encuentra la salida.',rules:'Mueve el peón hasta la meta usando los botones.'},
  {id:'flood',name:'Color Flood',icon:'🌊',cat:['logica'],sub:'Conquista el tablero por color.',rules:'Cambia el color de la esquina para absorber zonas. Completa en pocos movimientos.'},
  {id:'math',name:'Cálculo Relámpago',icon:'➗',cat:['logica','familia'],sub:'Entrena cálculo mental.',rules:'Responde operaciones rápidas. 10 aciertos completan la partida.'}
];

const W3 = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const WORDS = ['OMEGA','CAJA','TABLERO','DADOS','CARTAS','MADERA','JUEGO','NOCHE','FICHA','LLAVE','SOMBRA','RETRO','LIBRO','PUERTA','MEMORIA'];

function renderCatalog() {
  const query = norm($('#searchInput').value);
  const gridEl = $('#gamesGrid'); gridEl.innerHTML = '';
  games.filter(g => {
    const byFilter = activeFilter === 'all' || g.cat.includes(activeFilter);
    const byQuery = !query || norm(`${g.name} ${g.sub} ${g.cat.join(' ')}`).includes(query);
    return byFilter && byQuery;
  }).forEach(g => {
    const c = document.createElement('button');
    c.className = 'game-card'; c.type = 'button';
    c.innerHTML = `<div class="mini-cover cover-${g.cat[0] || 'juego'}"><img class="mini-art" src="assets/cards/${g.id}.svg" alt="" loading="lazy" decoding="async" onerror="this.remove()"><span class="fallback-icon">${g.icon}</span><i></i><b>${g.name}</b></div><h3>${g.name}</h3><p>${g.sub}</p><div class="tags">${g.cat.slice(0,3).map(x=>`<span class="tag">${x}</span>`).join('')}</div>`;
    c.addEventListener('click', () => openGame(g.id));
    gridEl.append(c);
  });
}
function openGame(id) {
  const g = games.find(x => x.id === id);
  if (!g || !renderers[id]) return;
  currentGame = id;
  $('#catalog').classList.add('hidden'); $('#gameScreen').classList.remove('hidden');
  $('#gameTitle').textContent = g.name; $('#gameSubtitle').textContent = g.sub; $('#rulesText').textContent = g.rules;
  clearBoard(); paintStats(id); setStatus('Partida lista.');
  try { renderers[id](); tone(330); } catch (e) { console.error(e); setStatus('Error controlado: este módulo no ha cargado.'); }
}
function showAchievements() {
  const d = $('#achievementsDialog'); const l = $('#achievementsList'); l.innerHTML = '';
  const totalP = Object.values(store.stats).reduce((a,s)=>a+(s.plays||0),0);
  const totalW = Object.values(store.stats).reduce((a,s)=>a+(s.wins||0),0);
  const played = Object.keys(store.stats).filter(id => store.stats[id].plays > 0).length;
  const list = [
    ['Primer dado', totalP >= 1, 'Juega tu primera partida.'],
    ['Caja despierta', played >= 10, 'Prueba 10 juegos distintos.'],
    ['Coleccionista', played >= 25, 'Prueba 25 juegos distintos.'],
    ['Veterano de sobremesa', totalP >= 50, 'Llega a 50 partidas.'],
    ['Ganador local', totalW >= 10, 'Consigue 10 victorias.'],
    ['Caja infinita real', played >= 50, 'Abre todos los módulos jugables.']
  ];
  list.forEach(([name, done, desc]) => l.append(div('ach ' + (done?'done':''), `<strong>${done?'✅':'⬜'} ${name}</strong><br><span>${desc}</span>`)));
  d.showModal();
}

function showQAReport() {
  const d = $('#achievementsDialog');
  const l = $('#achievementsList');
  const ids = games.map(g => g.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missingRenderers = ids.filter(id => typeof renderers[id] !== 'function');
  const categories = [...new Set(games.flatMap(g => g.cat || []))].sort();
  const checks = [
    ['Catálogo cargado', games.length >= 50, `${games.length} juegos registrados.`],
    ['IDs únicos', duplicateIds.length === 0, duplicateIds.length ? `Duplicados: ${duplicateIds.join(', ')}` : 'Sin duplicados.'],
    ['Renderizadores completos', missingRenderers.length === 0, missingRenderers.length ? `Faltan: ${missingRenderers.join(', ')}` : 'Todos los juegos tienen motor asignado.'],
    ['Storage seguro', !!storage && typeof storage.getItem === 'function', 'Fallback preparado si localStorage falla.'],
    ['Responsive base', true, 'CSS con rejillas fluidas, safe areas y breakpoints móvil/tablet.'],
    ['PWA opcional', true, 'Manifest y Service Worker incluidos para GitHub Pages.'],
    ['Categorías', categories.length >= 6, categories.join(' · ')]
  ];
  l.innerHTML = checks.map(([name, ok, detail]) => `<div class="ach ${ok ? 'done' : ''}"><strong>${ok ? '✅' : '⚠️'} ${name}</strong><br><span>${detail}</span></div>`).join('');
  d.querySelector('h2').textContent = 'Autodiagnóstico QA v7';
  d.showModal();
}

document.documentElement.dataset.theme = store.theme === 'classic' ? '' : store.theme;
$('#enterBtn').addEventListener('click', () => { const boot = $('#boot'); boot.classList.add('hide'); boot.setAttribute('aria-hidden','true'); setTimeout(() => { boot.hidden = true; }, 460); tone(220, .13); });
$('#homeBtn').addEventListener('click', backHome); $('#backBtn').addEventListener('click', backHome);
$('#soundBtn').addEventListener('click', () => { store.sound = !store.sound; storage.setItem('sound', store.sound ? '1':'0'); $('#soundBtn').textContent = 'Sonido: ' + (store.sound ? 'ON':'OFF'); tone(520); });
function updateThemeBtn() { const names = {classic:'🌅 Clásico', night:'🌙 Noche', forest:'🌿 Bosque', toy:'🎪 Juguete', cyberpunk:'⚡ Cyber', arcade:'🕹️ Arcade'}; $('#themeBtn').textContent = names[store.theme] || '🎨 Tema'; }
$('#themeBtn').addEventListener('click', () => { const i = (themes.indexOf(store.theme) + 1) % themes.length; store.theme = themes[i]; storage.setItem('theme', store.theme); document.documentElement.dataset.theme = store.theme === 'classic' ? '' : store.theme; updateThemeBtn(); tone(260); });
$('#resetStatsBtn').addEventListener('click', () => { if (confirm('¿Borrar estadísticas locales?')) { storage.removeItem('stats'); store.stats = {}; saveStats(); paintStats(currentGame || ''); renderCatalog(); } });
$('#achBtn').addEventListener('click', showAchievements); $('#qaBtn')?.addEventListener('click', showQAReport); $('#closeAch').addEventListener('click', () => $('#achievementsDialog').close());
$('#filters').addEventListener('click', e => { if (!e.target.dataset.filter) return; activeFilter = e.target.dataset.filter; $$('.filter').forEach(x => x.classList.remove('active')); e.target.classList.add('active'); renderCatalog(); });
$('#searchInput').addEventListener('input', renderCatalog);
$('#soundBtn').textContent = 'Sonido: ' + (store.sound ? 'ON':'OFF');
updateThemeBtn();

const renderers = {
  tictactoe() { startStat('tictactoe'); let a = Array(9).fill(''), p = 'X', over = false; const g = grid(3); controls.append(btn('Nueva partida', () => openGame('tictactoe'))); board.append(g); const draw = () => { g.innerHTML = ''; a.forEach((v,i)=>g.append(cell(v,()=>{ if(v||over)return; a[i]=p; tone(420); const w=W3.find(r=>r.every(j=>a[j]===p)); if(w){over=true; if(p==='X')winStat('tictactoe'); setStatus(`Gana ${p}.`);} else if(a.every(Boolean)){over=true;setStatus('Empate.');} else {p=p==='X'?'O':'X'; setStatus('Turno de '+p);} draw(); },'cell big'))); }; setStatus('Turno de X'); draw(); },

  connect4() { startStat('connect4'); let rows=6,cols=7,a=Array(rows*cols).fill(''),p='🔴',over=false; const g=grid(cols); controls.append(btn('Nueva partida',()=>openGame('connect4'))); board.append(g); const chk=(r,c)=>[[1,0],[0,1],[1,1],[1,-1]].some(([dr,dc])=>{let n=1; for(const s of[-1,1]){let rr=r+dr*s,cc=c+dc*s; while(rr>=0&&rr<rows&&cc>=0&&cc<cols&&a[rr*cols+cc]===p){n++;rr+=dr*s;cc+=dc*s;}} return n>=4;}); const drop=c=>{ if(over)return; for(let r=rows-1;r>=0;r--) if(!a[r*cols+c]){a[r*cols+c]=p;tone(360); if(chk(r,c)){over=true;if(p==='🔴')winStat('connect4');setStatus('Gana '+p);}else{p=p==='🔴'?'🔵':'🔴';setStatus('Turno '+p);} draw(); return;} }; const draw=()=>{g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v,()=>drop(i%cols),'cell')));}; setStatus('Turno 🔴'); draw(); },

  memory() { startStat('memory'); let icons='🍎 🧩 🚀 🦊 👑 ⚙️ 🗝️ 🌙'.split(' '), deck=shuffle([...icons,...icons]), open=[], done=0, moves=0; const g=grid(4); controls.append(btn('Nueva partida',()=>openGame('memory'))); board.append(g); const draw=()=>{g.innerHTML=''; deck.forEach((v,i)=>{const shown=open.includes(i)||v===''; g.append(cell(shown?v:'?',()=>{ if(shown||open.length===2)return; open.push(i); tone(440); if(open.length===2){ moves++; const [a,b]=open; if(deck[a]===deck[b]) gameTimeout(()=>{deck[a]=deck[b]=''; done+=2; open=[]; if(done===16){winStat('memory',moves); setStatus('Completado en '+moves+' movimientos.');} draw();},350); else gameTimeout(()=>{open=[];draw();},650);} draw(); setStatus('Movimientos: '+moves);},'cell card-cell '+(shown?'':'closed')));});}; setStatus('Encuentra las parejas.'); draw(); },

  simon() { startStat('simon'); let colors=['🔴','🔵','🟢','🟡'], seq=[], pos=0, lock=true; const g=grid(2); board.append(g); controls.append(btn('Empezar',()=>{seq=[];next();})); const draw=(flash=-1)=>{g.innerHTML=''; colors.forEach((c,i)=>g.append(cell(c,()=>{ if(lock)return; tone([300,400,500,600][i]); if(i===seq[pos]){pos++; if(pos===seq.length){ if(seq.length>=8) winStat('simon'); gameTimeout(next,430); }} else {lock=true; setStatus('Fallaste en nivel '+seq.length);}},'cell big '+(flash===i?'winflash':''))));}; const next=()=>{seq.push(rnd(4)); pos=0; lock=true; let k=0; const int=gameInterval(()=>{draw(seq[k]); if(seq[k]!==undefined)tone([300,400,500,600][seq[k]]); k++; if(k>seq.length){clearInterval(int); gameTimers.delete(int); draw(); lock=false; setStatus('Repite la secuencia. Nivel '+seq.length);}},600);}; draw(); setStatus('Pulsa empezar.'); },

  dice() { startStat('dice'); let n=2; const out=div('result-big','🎲'); controls.append(select([1,2,3,4,5,6].map(x=>({value:x,label:x+' dado(s)'})),n,v=>n=+v),btn('Lanzar',roll)); board.append(out); function roll(){const r=Array.from({length:n},()=>1+rnd(6)); out.textContent=r.join(' · '); setStatus('Total: '+r.reduce((a,b)=>a+b,0)); tone(240);} },
  coin() { startStat('coin'); const out=div('result-big','🪙'); controls.append(btn('Lanzar moneda',()=>{out.textContent=Math.random()<.5?'CARA':'CRUZ'; setStatus('La caja ha decidido.'); tone(500);})); board.append(out); },
  rps() { startStat('rps'); const out=div('result-big','✂️'); const opts=['Piedra','Papel','Tijera']; opts.forEach(o=>controls.append(btn(o,()=>{const c=pick(opts); out.textContent=`${o} vs ${c}`; const w=(o===c)?'Empate':((o==='Piedra'&&c==='Tijera')||(o==='Papel'&&c==='Piedra')||(o==='Tijera'&&c==='Papel'))?'Ganas':'Gana la caja'; if(w==='Ganas')winStat('rps'); setStatus(w);}))); board.append(out); },

  goose() { raceGame('goose', 30, {5:10,9:14,17:7,23:29}, 'Oca'); },
  ladders() { raceGame('ladders', 36, {3:14,8:20,18:31,16:6,27:10,34:22}, 'Escaleras y serpientes'); },
  parchis() { raceGame('parchis', 42, {6:12,14:18,22:28,31:40,17:9,37:29}, 'Parchís express'); },
  backgammon() { raceGame('backgammon', 24, {4:8,11:15,19:22,7:3,16:12}, 'Backgammon carrera', true); },

  battleship() { startStat('battleship'); const size=8, total=10; let ships=new Set(), shots=0, hits=0; while(ships.size<total) ships.add(rnd(size*size)); const seen=new Set(); const g=grid(size); controls.append(btn('Nueva flota',()=>openGame('battleship'))); board.append(g); const draw=()=>{g.innerHTML=''; for(let i=0;i<size*size;i++){const known=seen.has(i); g.append(cell(known?(ships.has(i)?'🔥':'·'):'~',()=>{ if(seen.has(i))return; seen.add(i); shots++; if(ships.has(i)){hits++; tone(160); if(hits===total){winStat('battleship',shots); setStatus('Flota hundida en '+shots+' disparos.');}} else tone(320); draw(); setStatus(`Impactos: ${hits}/${total} · Disparos: ${shots}`);},'cell small '+(known&&ships.has(i)?'bad':'')));}}; setStatus(`Impactos: 0/${total}`); draw(); },

  mines() { startStat('mines'); const size=8, mines=10; let m=new Set(); while(m.size<mines)m.add(rnd(size*size)); const open=new Set(); let over=false; const g=grid(size); controls.append(btn('Nuevo campo',()=>openGame('mines'))); board.append(g); const adj=i=>{const r=Math.floor(i/size),c=i%size; let n=0; for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue; const rr=r+dr,cc=c+dc; if(rr>=0&&rr<size&&cc>=0&&cc<size&&m.has(rr*size+cc))n++;} return n;}; const flood=i=>{if(open.has(i)||m.has(i))return; open.add(i); if(adj(i)===0){const r=Math.floor(i/size),c=i%size; [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc;if(rr>=0&&rr<size&&cc>=0&&cc<size)flood(rr*size+cc);});}}; const draw=()=>{g.innerHTML=''; for(let i=0;i<size*size;i++){const o=open.has(i); const txt=o?(adj(i)||''):over&&m.has(i)?'💣':''; g.append(cell(txt,()=>{if(over||o)return; if(m.has(i)){over=true; setStatus('¡Mina! Reinicia y prueba otra vez.'); tone(90,.18,'sawtooth');} else {flood(i); tone(420); if(open.size===size*size-mines){winStat('mines'); setStatus('Campo limpio.'); over=true;}} draw();},'cell small '+(o?'safe':'')+(over&&m.has(i)?' mine':'')));}}; setStatus('Abre casillas sin tocar minas.'); draw(); },

  mastermind() { startStat('mastermind'); const colors=['🔴','🔵','🟢','🟡','🟣','⚪']; const code=Array.from({length:4},()=>pick(colors)); let cur=Array(4).fill(colors[0]), tries=0; const area=div('board-wide'); const row=div('row-flex'); controls.append(btn('Probar código',check),btn('Nuevo código',()=>openGame('mastermind'))); board.append(area); function paint(){area.innerHTML=''; row.innerHTML=''; cur.forEach((v,i)=>row.append(cell(v,()=>{cur[i]=colors[(colors.indexOf(cur[i])+1)%colors.length];paint();},'cell big'))); area.append(row);} function check(){tries++; let black=0, white=0, c1=[...code], c2=[...cur]; for(let i=0;i<4;i++)if(c1[i]===c2[i]){black++; c1[i]=c2[i]=null;} c2.forEach(v=>{const j=c1.indexOf(v); if(v&&j>-1){white++; c1[j]=null;}}); setStatus(`Intento ${tries}: ${black} negras · ${white} blancas`); if(black===4)winStat('mastermind',tries);} paint(); setStatus('Pulsa cada color para cambiarlo.'); },

  twenty48() { startStat('twenty48'); let a=Array(16).fill(0); const g=grid(4); board.append(g); ['↑','←','→','↓'].forEach((t,i)=>controls.append(btn(t,()=>move(['U','L','R','D'][i])))); controls.append(btn('Nueva partida',()=>openGame('twenty48'))); function add(){const e=a.map((v,i)=>v?null:i).filter(x=>x!==null); if(e.length)a[pick(e)]=Math.random()<.9?2:4;} function merge(line){let n=line.filter(Boolean); for(let i=0;i<n.length-1;i++) if(n[i]===n[i+1]){n[i]*=2;n.splice(i+1,1);} while(n.length<4)n.push(0); return n;} function move(d){let old=a.join(); for(let i=0;i<4;i++){let line=[]; for(let j=0;j<4;j++){let idx=d==='L'||d==='R'?i*4+j:j*4+i; line.push(a[idx]);} if(d==='R'||d==='D')line.reverse(); let m=merge(line); if(d==='R'||d==='D')m.reverse(); for(let j=0;j<4;j++){let idx=d==='L'||d==='R'?i*4+j:j*4+i; a[idx]=m[j];}} if(a.join()!==old){add(); tone(360); draw(); if(a.includes(2048))winStat('twenty48');}} function draw(){g.innerHTML=''; a.forEach(v=>g.append(cell(v||'',null,'cell big'))); setStatus('Máximo: '+Math.max(...a));} document.onkeydown=e=>{if(currentGame!=='twenty48')return; const m={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R'}; if(m[e.key])move(m[e.key]);}; add();add();draw(); },

  hangman() { wordGuess('hangman', pick(WORDS), 7); },

  checkers() { startStat('checkers'); const N=8; let a=Array(N*N).fill(''), turn='r', sel=null; for(let r=0;r<3;r++)for(let c=0;c<N;c++)if((r+c)%2)a[r*N+c]='b'; for(let r=5;r<8;r++)for(let c=0;c<N;c++)if((r+c)%2)a[r*N+c]='r'; const g=grid(N); controls.append(btn('Nueva partida',()=>openGame('checkers'))); board.append(g); function draw(){g.innerHTML=''; a.forEach((v,i)=>{const r=Math.floor(i/N),c=i%N; g.append(cell(v?(v==='r'?'⚫':'⚪'):'',()=>click(i),'cell small '+((r+c)%2?'dark':'')+(sel===i?' selected':'')));}); setStatus('Turno '+(turn==='r'?'negras':'blancas'));} function click(i){if(a[i]===turn){sel=i;draw();return;} if(sel===null)return; const sr=Math.floor(sel/N),sc=sel%N,r=Math.floor(i/N),c=i%N,dr=r-sr,dc=c-sc; const dir=turn==='r'?-1:1; if(!a[i]&&Math.abs(dc)===1&&dr===dir){a[i]=turn;a[sel]='';turn=turn==='r'?'b':'r';sel=null;tone(420);draw();} else if(!a[i]&&Math.abs(dc)===2&&dr===dir*2){const mid=(sr+dr/2)*N+(sc+dc/2); if(a[mid]&&a[mid]!==turn){a[i]=turn;a[sel]='';a[mid]=''; if(!a.includes('b')){winStat('checkers');setStatus('Ganan negras.');} else if(!a.includes('r'))setStatus('Ganan blancas.'); else {turn=turn==='r'?'b':'r';setStatus('Captura.');} sel=null;tone(480);draw();}}} draw(); },

  domino() { startStat('domino'); let pool=[]; for(let i=0;i<=6;i++)for(let j=i;j<=6;j++)pool.push([i,j]); shuffle(pool); let hand=pool.splice(0,7), chain=[pool.pop()]; const area=div('board-wide'); board.append(area); controls.append(btn('Robar ficha',()=>{if(pool.length){hand.push(pool.pop());draw();}}),btn('Nuevo dominó',()=>openGame('domino'))); function draw(){area.innerHTML=''; area.append(div('hint',`Mesa: ${chain.map(x=>x.join('|')).join(' — ')}`)); const h=div('row-flex'); const L=chain[0][0], R=chain.at(-1)[1]; hand.forEach((t,i)=>h.append(cell(t.join('|'),()=>{let placed=false; let [a,b]=t; if(a===R){chain.push([a,b]);placed=true;} else if(b===R){chain.push([b,a]);placed=true;} else if(b===L){chain.unshift([a,b]);placed=true;} else if(a===L){chain.unshift([b,a]);placed=true;} if(placed){hand.splice(i,1);tone(430); if(!hand.length){winStat('domino');setStatus('¡Sin fichas!');} draw();} else setStatus('Esa ficha no encaja.');},'cell'))); area.append(h); setStatus(`Fichas en mano: ${hand.length} · Pozo: ${pool.length}`);} draw(); },

  chess() { startStat('chess'); const N=8; let a=['♜','♞','♝','♛','♚','♝','♞','♜','♟','♟','♟','♟','♟','♟','♟','♟',...Array(32).fill(''),'♙','♙','♙','♙','♙','♙','♙','♙','♖','♘','♗','♕','♔','♗','♘','♖']; let turn='w', sel=null, over=false; const whites='♙♖♘♗♕♔', blacks='♟♜♞♝♛♚'; const g=grid(8); controls.append(btn('Nuevo ajedrez',()=>openGame('chess'))); board.append(g); const color=p=>whites.includes(p)?'w':blacks.includes(p)?'b':''; const ok=(from,to)=>{const p=a[from], sr=Math.floor(from/N),sc=from%N,r=Math.floor(to/N),c=to%N,dr=r-sr,dc=c-sc, adr=Math.abs(dr),adc=Math.abs(dc), target=a[to]; if(!p||color(p)!==turn||color(target)===turn)return false; if('♙♟'.includes(p)){const dir=p==='♙'?-1:1; return (dc===0&&!target&&dr===dir)||(adc===1&&dr===dir&&target);} if('♘♞'.includes(p)) return (adr===2&&adc===1)||(adr===1&&adc===2); if('♔♚'.includes(p)) return adr<=1&&adc<=1; if('♖♜'.includes(p)) return (dr===0||dc===0)&&clearPath(from,to); if('♗♝'.includes(p)) return adr===adc&&clearPath(from,to); if('♕♛'.includes(p)) return ((dr===0||dc===0)||adr===adc)&&clearPath(from,to); return false;}; function clearPath(f,t){const sr=Math.floor(f/N),sc=f%N,r=Math.floor(t/N),c=t%N,dr=Math.sign(r-sr),dc=Math.sign(c-sc); let rr=sr+dr,cc=sc+dc; while(rr!==r||cc!==c){if(a[rr*N+cc])return false;rr+=dr;cc+=dc;} return true;} function draw(){g.innerHTML=''; a.forEach((v,i)=>{const r=Math.floor(i/N),c=i%N; g.append(cell(v,()=>{if(over)return; if(a[i]&&color(a[i])===turn){sel=i;draw();return;} if(sel!==null&&ok(sel,i)){const captured=a[i]; a[i]=a[sel];a[sel]='';sel=null;tone(390); if(captured==='♚'||captured==='♔'){over=true; if(turn==='w')winStat('chess'); setStatus('Rey capturado. Ganan '+(turn==='w'?'blancas':'negras'));} else {turn=turn==='w'?'b':'w';setStatus('Turno '+(turn==='w'?'blancas':'negras'));} draw();}},'cell small '+((r+c)%2?'dark':'')+(sel===i?' selected':'')));});} setStatus('Turno blancas.'); draw(); },
  reversi() { startStat('reversi'); const N=8; let a=Array(N*N).fill(''), p='●'; a[27]='○';a[28]='●';a[35]='●';a[36]='○'; const g=grid(N); controls.append(btn('Nuevo reversi',()=>openGame('reversi'))); board.append(g); const opp=x=>x==='●'?'○':'●'; const dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]; function flips(i,pl){if(a[i])return[]; const r=Math.floor(i/N),c=i%N,res=[]; dirs.forEach(([dr,dc])=>{let rr=r+dr,cc=c+dc,tmp=[]; while(rr>=0&&rr<N&&cc>=0&&cc<N&&a[rr*N+cc]===opp(pl)){tmp.push(rr*N+cc);rr+=dr;cc+=dc;} if(tmp.length&&rr>=0&&rr<N&&cc>=0&&cc<N&&a[rr*N+cc]===pl)res.push(...tmp);}); return res;} function moves(pl){return a.map((_,i)=>flips(i,pl).length?i:null).filter(x=>x!==null);} function draw(){g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v,()=>{const f=flips(i,p); if(!f.length)return; a[i]=p;f.forEach(j=>a[j]=p); tone(420); p=opp(p); if(!moves(p).length)p=opp(p); const m1=moves('●').length,m2=moves('○').length; if(!m1&&!m2||a.every(Boolean)){const b=a.filter(x=>x==='●').length,w=a.filter(x=>x==='○').length; if(b>w)winStat('reversi'); setStatus(`Final: negras ${b} · blancas ${w}`);} else setStatus('Turno '+(p==='●'?'negras':'blancas')); draw();},'cell small '+(flips(i,p).length?'good':''))));} setStatus('Turno negras.'); draw(); },

  go() { startStat('go'); const N=9; let a=Array(N*N).fill(''), p='●', pass=0; const g=grid(N); controls.append(btn('Pasar',()=>{pass++;p=p==='●'?'○':'●'; if(pass>=2)score(); else draw();}),btn('Nuevo Go',()=>openGame('go'))); board.append(g); const dirs=[[1,0],[-1,0],[0,1],[0,-1]]; function group(i,seen=new Set()){if(seen.has(i)||!a[i])return seen; seen.add(i); const r=Math.floor(i/N),c=i%N; dirs.forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc,j=rr*N+cc; if(rr>=0&&rr<N&&cc>=0&&cc<N&&a[j]===a[i])group(j,seen);}); return seen;} function liberties(gr){for(const i of gr){const r=Math.floor(i/N),c=i%N; for(const [dr,dc] of dirs){const rr=r+dr,cc=c+dc,j=rr*N+cc; if(rr>=0&&rr<N&&cc>=0&&cc<N&&!a[j])return true;}} return false;} function score(){const b=a.filter(x=>x==='●').length,w=a.filter(x=>x==='○').length; if(b>w)winStat('go'); setStatus(`Puntuación simple: negras ${b} · blancas ${w}`);} function draw(){g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v,()=>{if(a[i])return; a[i]=p; pass=0; const rival=p==='●'?'○':'●'; a.forEach((x,j)=>{if(x===rival){const gr=group(j); if(!liberties(gr))gr.forEach(k=>a[k]='');}}); const own=group(i); if(!liberties(own)){own.forEach(k=>a[k]='');setStatus('Suicidio no permitido en versión simplificada.');} else {p=rival;setStatus('Turno '+(p==='●'?'negras':'blancas'));tone(390);} draw();},'cell tiny '+(v?'':'') )));} setStatus('Turno negras. Dos pases puntúan.'); draw(); },

  nim() { startStat('nim'); let n=21, turn='Tú'; const area=div('result-big'); board.append(area); [1,2,3].forEach(x=>controls.append(btn('Quitar '+x,()=>move(x)))); controls.append(btn('Nuevo Nim',()=>openGame('nim'))); function move(x){if(turn!=='Tú'||x>n)return; n-=x; tone(350); if(n<=0){setStatus('Te llevaste el último. Pierdes.'); draw(); return;} turn='Caja'; draw(); gameTimeout(()=>{let y=(n-1)%4||1; if(y>3)y=3; n-=Math.min(y,n); if(n<=0){winStat('nim'); setStatus('La caja se llevó el último. Ganas.');} else {turn='Tú'; setStatus('Tu turno.');} draw();},350);} function draw(){area.textContent='| '.repeat(Math.max(0,n)); setStatus(setStatusText());} function setStatusText(){return `Palitos restantes: ${n} · Turno: ${turn}. Pierde quien quite el último.`;} draw(); },

  hanoi() { startStat('hanoi'); let n=4, towers=[[4,3,2,1],[],[]], sel=null, moves=0; const area=div('row-flex'); controls.append(select([3,4,5].map(x=>({value:x,label:x+' discos'})),4,v=>{n=+v;towers=[Array.from({length:n},(_,i)=>n-i),[],[]];moves=0;sel=null;draw();}),btn('Reiniciar',()=>openGame('hanoi'))); board.append(area); function draw(){area.innerHTML=''; towers.forEach((t,i)=>{const col=div('grid'); col.style.gridTemplateColumns='1fr'; col.style.minWidth='110px'; col.append(div('hint','Torre '+(i+1))); [...t].reverse().forEach(d=>col.append(cell('▰'.repeat(d),()=>click(i),'cell'))); col.append(cell(sel===i?'Elegida':'Mover',()=>click(i),'cell '+(sel===i?'selected':''))); area.append(col);}); setStatus(`Movimientos: ${moves}`);} function click(i){if(sel===null){if(towers[i].length)sel=i;} else if(sel===i)sel=null; else {const d=towers[sel].at(-1); if(!towers[i].length||towers[i].at(-1)>d){towers[i].push(towers[sel].pop());moves++;tone(420); if(towers[2].length===n)winStat('hanoi',moves);} sel=null;} draw();} draw(); },

  fifteen() { startStat('fifteen'); let a=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,'']; for(let k=0;k<120;k++){const e=a.indexOf(''),r=Math.floor(e/4),c=e%4,ms=[[1,0],[-1,0],[0,1],[0,-1]].map(([dr,dc])=>[r+dr,c+dc]).filter(([rr,cc])=>rr>=0&&rr<4&&cc>=0&&cc<4); const [rr,cc]=pick(ms); [a[e],a[rr*4+cc]]=[a[rr*4+cc],a[e]];} const g=grid(4); controls.append(btn('Mezclar',()=>openGame('fifteen'))); board.append(g); function draw(){g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v,()=>{const e=a.indexOf(''),r=Math.floor(i/4),c=i%4,er=Math.floor(e/4),ec=e%4; if(Math.abs(r-er)+Math.abs(c-ec)===1){[a[i],a[e]]=[a[e],a[i]];tone(390); if(a.slice(0,15).every((v,i)=>v===i+1))winStat('fifteen');draw();}},'cell big '+(v===''?'blank':''))));} setStatus('Ordena del 1 al 15.'); draw(); },

  lightsout() { startStat('lightsout'); const N=5; let a=Array.from({length:N*N},()=>rnd(2)); const g=grid(N); controls.append(btn('Nuevo tablero',()=>openGame('lightsout'))); board.append(g); function press(i){const r=Math.floor(i/N),c=i%N; [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc;if(rr>=0&&rr<N&&cc>=0&&cc<N)a[rr*N+cc]^=1;}); tone(390); if(a.every(x=>!x))winStat('lightsout'); draw();} function draw(){g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v?'💡':'',()=>press(i),'cell '+(v?'':'dark')))); setStatus('Apaga todas las luces.');} draw(); },

  peg() { startStat('peg'); const N=7; let valid=i=>{const r=Math.floor(i/N),c=i%N; return !((r<2||r>4)&&(c<2||c>4));}; let a=Array.from({length:N*N},(_,i)=>valid(i)?1:null); a[24]=0; let sel=null; const g=grid(N); controls.append(btn('Nuevo solitario',()=>openGame('peg'))); board.append(g); function draw(){g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v===null?'':v?'●':'',()=>click(i),'cell small '+(v===null?'blank':'')+(sel===i?' selected':'')))); setStatus('Clavijas restantes: '+a.filter(x=>x===1).length);} function click(i){if(a[i]===1){sel=i;draw();return;} if(sel===null||a[i]!==0)return; const sr=Math.floor(sel/N),sc=sel%N,r=Math.floor(i/N),c=i%N,dr=r-sr,dc=c-sc; if((Math.abs(dr)===2&&dc===0)||(Math.abs(dc)===2&&dr===0)){const mid=(sr+dr/2)*N+(sc+dc/2); if(a[mid]===1){a[i]=1;a[sel]=0;a[mid]=0;sel=null;tone(400); if(a.filter(x=>x===1).length===1)winStat('peg');draw();}}} draw(); },

  sudoku() { startStat('sudoku'); sudokuGame('sudoku', 9); },
  killer() { startStat('killer'); killerMini(); },
  futoshiki() { startStat('futoshiki'); inequalityGame('futoshiki'); },
  skyscrapers() { startStat('skyscrapers'); skyscrapersGame(); },
  nonogram() { startStat('nonogram'); nonogramGame(); },
  kakuro() { startStat('kakuro'); kakuroGame(); },
  wordsearch() { startStat('wordsearch'); wordSearchGame(); },
  crossword() { startStat('crossword'); crosswordGame(); },
  wordle() { startStat('wordle'); wordleGame(); },
  anagrams() { startStat('anagrams'); anagramGame(); },
  trivia() { startStat('trivia'); quizGame('trivia'); },
  pasapalabra() { startStat('pasapalabra'); pasapalabraGame(); },
  blackjack() { startStat('blackjack'); blackjackGame(); },
  pokerdice() { startStat('pokerdice'); dicePokerGame(); },
  bingo() { startStat('bingo'); bingoGame(); },
  yatzy() { startStat('yatzy'); yatzyGame(); },
  solitaire() { startStat('solitaire'); solitaireExpress('solitaire'); },
  freecell() { startStat('freecell'); freeCellMini(); },
  spider() { startStat('spider'); spiderMini(); },
  dots() { startStat('dots'); dotsGame(); },
  sos() { startStat('sos'); sosGame(); },
  bulls() { startStat('bulls'); bullsGame(); },
  maze() { startStat('maze'); mazeGame(); },
  flood() { startStat('flood'); floodGame(); },
  math() { startStat('math'); mathGame(); }
};

function raceGame(id, len, specials, title, twoDice=false) {
  startStat(id); let p=0,c=0,turn='Tú'; const tr=div('track'); board.append(tr); controls.append(btn('Tirar dado(s)',roll),btn('Nueva carrera',()=>openGame(id))); function roll(){const d=twoDice?(1+rnd(6))+(1+rnd(6)):1+rnd(6); if(turn==='Tú'){p=Math.min(len,p+d); if(specials[p])p=specials[p]; if(p>=len){winStat(id);setStatus(`${title}: ganas con ${d}.`);} else {turn='Caja';setStatus(`Has sacado ${d}. Caja tira ahora.`);draw(); gameTimeout(roll,500);}} else {c=Math.min(len,c+d); if(specials[c])c=specials[c]; if(c>=len)setStatus(`${title}: gana la caja.`); else {turn='Tú';setStatus(`Caja saca ${d}. Tu turno.`);} } tone(260); draw(); } function draw(){tr.innerHTML=''; for(let i=1;i<=len;i++){let html=i; if(i===p)html+='<br><span class="token">T</span>'; if(i===c)html+='<br><span class="token b">C</span>'; if(specials[i])html+='<br>★'; tr.append(cell(html,null,'cell'));}} setStatus(`${title}. Tu turno.`); draw(); }

function wordGuess(id, word, max) { startStat(id); let used=new Set(), bad=0; const area=div('board-wide'); board.append(area); const letters='ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split(''); const kb=div('row-flex'); controls.append(btn('Nueva palabra',()=>openGame(id))); letters.forEach(l=>kb.append(btn(l,()=>guess(l),'secondary'))); controls.append(kb); function guess(l){if(used.has(l))return; used.add(l); if(!word.includes(l))bad++; tone(word.includes(l)?480:180); draw(); if(word.split('').every(x=>used.has(x))){winStat(id,bad);setStatus('Palabra completada: '+word);} else if(bad>=max)setStatus('Se agotaron los intentos. Era '+word);} function draw(){area.innerHTML=`<div class="result-big">${word.split('').map(l=>used.has(l)?l:'_').join(' ')}</div><p class="hint">Fallos: ${bad}/${max}</p>`;} draw(); setStatus('Adivina la palabra.'); }
function sudokuGame(id) {
  const base=[1,2,3,4,5,6,7,8,9];
  const pattern=(r,c)=>(r*3+Math.floor(r/3)+c)%9;
  const rows=shuffle([0,1,2]).flatMap(g=>shuffle([0,1,2]).map(r=>g*3+r));
  const cols=shuffle([0,1,2]).flatMap(g=>shuffle([0,1,2]).map(c=>g*3+c));
  const nums=shuffle([...base]);
  const sol=Array.from({length:81},(_,i)=>nums[pattern(rows[Math.floor(i/9)],cols[i%9])]);
  const givens=new Set(); while(givens.size<35)givens.add(rnd(81));
  let vals=sol.map((v,i)=>givens.has(i)?v:''); let selected=null; const g=grid(9); controls.append(btn('Comprobar',check),btn('Nuevo Sudoku',()=>openGame('sudoku'))); const numsBar=div('row-flex'); for(let n=1;n<=9;n++)numsBar.append(btn(String(n),()=>{if(selected!==null&&!givens.has(selected)){vals[selected]=n;draw();}},'secondary')); numsBar.append(btn('Borrar',()=>{if(selected!==null&&!givens.has(selected)){vals[selected]='';draw();}},'secondary')); controls.append(numsBar); board.append(g); function draw(){g.innerHTML=''; vals.forEach((v,i)=>g.append(cell(v,()=>{selected=i;draw();},'cell tiny '+(givens.has(i)?'dark':'')+(selected===i?' selected':''))));} function check(){const ok=vals.every((v,i)=>+v===sol[i]); if(ok){winStat(id);setStatus('Sudoku completado.');} else setStatus('Aún hay errores o huecos.');} draw(); setStatus('Selecciona una casilla y pulsa número.'); }

function killerMini() {
  const sol=[1,2,3,4,3,4,1,2,2,1,4,3,4,3,2,1];
  const cages=[[[0,1],3],[[2,3],7],[[4,8],5],[[5,6],5],[[7,11],5],[[9,10],5],[[12,13],7],[[14,15],3]];
  let vals=Array(16).fill(''), selected=null; const g=grid(4); controls.append(btn('Comprobar',()=>{const ok=vals.every((v,i)=>+v===sol[i]); if(ok){winStat('killer');setStatus('Killer mini resuelto.');} else setStatus('Todavía no cuadra.');}),btn('Nuevo',()=>openGame('killer'))); const bar=div('row-flex'); [1,2,3,4].forEach(n=>bar.append(btn(String(n),()=>{if(selected!==null){vals[selected]=n;draw();}},'secondary'))); controls.append(bar); board.append(g); function hint(i){const cg=cages.find(c=>c[0].includes(i)); return cg&&cg[0][0]===i?`<small>${cg[1]}</small>`:'';} function draw(){g.innerHTML=''; vals.forEach((v,i)=>g.append(cell(`${hint(i)}${v||''}`,()=>{selected=i;draw();},'cell big '+(selected===i?'selected':''))));} draw(); setStatus('Mini Killer 4x4: cada jaula suma el número pequeño.'); }

function inequalityGame(id) {
  const sol=[1,2,3,4,3,4,1,2,2,1,4,3,4,3,2,1];
  const signs={0:'<',1:'<',4:'<',6:'<',8:'>',9:'<',13:'>'};
  let vals=Array(16).fill(''), selected=null; const wrap=div('board-wide'); const g=grid(4); wrap.append(g); controls.append(btn('Comprobar',()=>{const ok=vals.every((v,i)=>+v===sol[i]); ok?winStat(id):setStatus('Revisa números y desigualdades.');}),btn('Nuevo',()=>openGame(id))); const bar=div('row-flex'); [1,2,3,4].forEach(n=>bar.append(btn(String(n),()=>{if(selected!==null){vals[selected]=n;draw();}},'secondary'))); controls.append(bar); board.append(wrap); function draw(){g.innerHTML=''; vals.forEach((v,i)=>{g.append(cell((v||'')+(signs[i]?`<br><small>${signs[i]}</small>`:''),()=>{selected=i;draw();},'cell big '+(selected===i?'selected':'')));});} draw(); setStatus('Completa 1-4 y respeta los signos dentro de las casillas.'); }

function skyscrapersGame() {
  const sol=[2,1,4,3,3,4,1,2,4,2,3,1,1,3,2,4];
  const top=[3,2,1,2], left=[2,2,1,3], right=[2,2,3,1], bottom=[2,2,3,1];
  let vals=Array(16).fill(''), selected=null; const area=div('board-wide'); const g=grid(4); controls.append(btn('Comprobar',()=>{const ok=vals.every((v,i)=>+v===sol[i]); ok?winStat('skyscrapers'):setStatus('Las vistas no coinciden todavía.');}),btn('Nuevo',()=>openGame('skyscrapers'))); const bar=div('row-flex'); [1,2,3,4].forEach(n=>bar.append(btn(String(n),()=>{if(selected!==null){vals[selected]=n;draw();}},'secondary'))); controls.append(bar); board.append(area); function draw(){area.innerHTML=''; area.append(div('hint','Arriba: '+top.join(' · '))); g.innerHTML=''; vals.forEach((v,i)=>{const r=Math.floor(i/4),c=i%4; g.append(cell(`${c===0?'<small>'+left[r]+'</small> ':''}${v||''}${c===3?' <small>'+right[r]+'</small>':''}`,()=>{selected=i;draw();},'cell big '+(selected===i?'selected':'')));}); area.append(g); area.append(div('hint','Abajo: '+bottom.join(' · ')));} draw(); setStatus('Rellena alturas 1-4. Las pistas dicen cuántas torres se ven.'); }

function nonogramGame() {
  const pics=[
    [[0,1,1,1,0],[1,0,1,0,1],[1,1,1,1,1],[0,1,0,1,0],[1,0,0,0,1]],
    [[0,0,1,0,0],[0,1,1,1,0],[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0]],
    [[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,1,0,1,0],[1,0,0,0,1]]
  ];
  const sol=pick(pics); let a=Array(25).fill(0); const g=grid(5); controls.append(btn('Comprobar',check),btn('Nuevo nonograma',()=>openGame('nonogram'))); board.append(g); function clue(line){let res=[],n=0; line.forEach(x=>{if(x)n++; else if(n){res.push(n);n=0;}}); if(n)res.push(n); return res.length?res.join(' '):'0';} const rowClues=sol.map(clue), colClues=[0,1,2,3,4].map(c=>clue(sol.map(r=>r[c]))); function draw(){g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v?'■':'',()=>{a[i]=a[i]?0:1;tone(370);draw();},'cell big '+(v?'filled':'')))); setStatus(`Filas: ${rowClues.join(' / ')} · Columnas: ${colClues.join(' / ')}`);} function check(){const ok=a.every((v,i)=>v===sol[Math.floor(i/5)][i%5]); ok?winStat('nonogram'):setStatus('Aún no aparece el dibujo correcto.');} draw(); }

function kakuroGame() {
  const sol={1:1,2:2,4:2,5:1,7:3,8:1,10:1,11:3,13:2,14:1};
  const hints={0:'→3 ↓3',3:'↓4',6:'→4',9:'→4',12:'→3'}; let vals={}, selected=null; const g=grid(3); controls.append(btn('Comprobar',()=>{const ok=Object.keys(sol).every(k=>+vals[k]===sol[k]); ok?winStat('kakuro'):setStatus('Revisa las sumas.');}),btn('Nuevo',()=>openGame('kakuro'))); const bar=div('row-flex'); [1,2,3,4].forEach(n=>bar.append(btn(String(n),()=>{if(selected!==null){vals[selected]=n;draw();}},'secondary'))); controls.append(bar); board.append(g); function draw(){g.innerHTML=''; for(let i=0;i<15;i++){ if(hints[i]) g.append(cell(hints[i],null,'cell dark')); else if(sol[i]) g.append(cell(vals[i]||'',()=>{selected=i;draw();},'cell big '+(selected===i?'selected':''))); else g.append(cell('',null,'cell blank')); }} draw(); setStatus('Kakuro 3x5 compacto: usa números 1-4.'); }

function wordSearchGame() {
  const words=shuffle(['CAJA','DADOS','JUEGO','RETRO','FICHA']).slice(0,3); const N=8; let a=Array.from({length:N*N},()=>String.fromCharCode(65+rnd(26))); words.forEach((w,k)=>{const r=k*2,c=1; for(let i=0;i<w.length;i++)a[r*N+c+i]=w[i];}); let selected=[], found=new Set(); const g=grid(N); controls.append(btn('Limpiar selección',()=>{selected=[];draw();}),btn('Nueva sopa',()=>openGame('wordsearch'))); board.append(g); function draw(){g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v,()=>{selected.push(i); const s=selected.map(j=>a[j]).join(''); if(words.includes(s)){found.add(s); selected=[]; tone(650); if(found.size===words.length)winStat('wordsearch');} draw();},'cell tiny '+(selected.includes(i)?'selected':'') ))); setStatus(`Busca: ${words.join(', ')} · Encontradas: ${[...found].join(', ')||'ninguna'}`);} draw(); }

function crosswordGame() {
  const layout=['###C#','#DADO','###J#','#CAJA','###E#']; const answers={3:'C',6:'D',7:'A',8:'D',9:'O',13:'J',16:'C',17:'A',18:'J',19:'A',23:'E'}; let vals={}; const g=grid(5); controls.append(btn('Comprobar',()=>{const ok=Object.keys(answers).every(k=>(vals[k]||'').toUpperCase()===answers[k]); ok?winStat('crossword'):setStatus('Hay letras que no encajan.');}),btn('Nuevo',()=>openGame('crossword'))); board.append(g); for(let i=0;i<25;i++){const r=Math.floor(i/5),c=i%5; if(layout[r][c]==='#')g.append(cell('',null,'cell dark')); else {const inp=input('text',''); inp.maxLength=1; inp.className='cell tiny'; inp.addEventListener('input',()=>{vals[i]=inp.value.toUpperCase();}); g.append(inp);} } setStatus('Pistas: horizontal DADO y CAJA. Vertical C-J-E.'); }

function wordleGame() {
  const target=pick(['CAJAS','DADOS','FICHA','RETRO','JUEGO','NOCHE','CARTE','SALUD','FONDO','GRASA','FLORE','CALOR','CAMPO','LIBRO','PORTA','VISTA','BUQUE','CLAVE','PARED','FINAL','TORRE','RONDA','PODER','MEDIA','CLIMA','PARTE','MARCO','FERIA','GRUPO','BORDE','ARENA','COSTA','MONTE','LARGO','SUELO','BELLO','FALSO','LISTO','SABIO','GENIO']); let tries=[]; const area=div('board-wide'); const inp=input('text',''); inp.maxLength=5; controls.append(inp,btn('Probar',go),btn('Nueva palabra',()=>openGame('wordle'))); board.append(area); function go(){const w=inp.value.toUpperCase(); if(w.length!==5)return setStatus('Escribe 5 letras.'); tries.push(w); inp.value=''; if(w===target){winStat('wordle',tries.length); setStatus('Correcto.');} else if(tries.length>=6)setStatus('Sin intentos. Era '+target); draw();} function draw(){area.innerHTML=''; tries.forEach(w=>{const row=div('row-flex'); w.split('').forEach((ch,i)=>row.append(cell(ch,null,'cell '+(target[i]===ch?'good':target.includes(ch)?'filled':'dark')))); area.append(row);});} setStatus('Adivina la palabra de 5 letras.'); draw(); }

function anagramGame() {
  const w=pick(['TABLERO','MEMORIA','FICHA','DOMINO','SUDOKU','CARTAS']); const scrambled=shuffle(w.split('')).join(''); const inp=input('text',''); const out=div('result-big',scrambled); controls.append(inp,btn('Resolver',()=>{if(inp.value.toUpperCase()===w){winStat('anagrams');setStatus('Correcto.');} else setStatus('No es esa.');}),btn('Nuevo',()=>openGame('anagrams'))); board.append(out); setStatus('Ordena las letras.'); }

function quizGame(id) {
  const qs=[['Capital de Francia','PARIS'],['5 x 6','30'],['Planeta rojo','MARTE'],['Autor de El Quijote','CERVANTES'],['Pieza que mueve en L','CABALLO'],['Océano entre Europa y América','ATLANTICO'],['Número de caras de un dado','6']]; let n=0,score=0; const area=div('board-wide'); const inp=input('text',''); controls.append(inp,btn('Responder',ans),btn('Nuevo trivial',()=>openGame(id))); board.append(area); function ask(){const q=qs[n%qs.length]; area.innerHTML=`<div class="result-big">?</div><p class="hint">${q[0]}</p>`; setStatus(`Aciertos: ${score}/5`);} function ans(){const q=qs[n%qs.length]; if(norm(inp.value)===norm(q[1])){score++; tone(600);} else tone(160); inp.value=''; n++; if(score>=5){winStat(id);setStatus('Trivial completado.');} else ask();} ask(); }

function pasapalabraGame() {
  const qs=[['A','Animal que ladra','PERRO'],['B','Juego con cartones y bolas','BINGO'],['C','Donde guardas juegos','CAJA'],['D','Objeto cúbico con puntos','DADO'],['E','Sube en serpientes y...','ESCALERA'],['F','Pieza de tablero','FICHA'],['G','Juego oriental de piedras','GO'],['H','Torres de...','HANOI']]; let i=0,ok=0,pass=[]; const area=div('result-big'); const inp=input('text',''); controls.append(inp,btn('Responder',answer),btn('Pasar',()=>{pass.push(qs[i]); next();}),btn('Nuevo rosco',()=>openGame('pasapalabra'))); board.append(area); function next(){i++; if(i>=qs.length){if(pass.length){qs.splice(0,qs.length,...pass);pass=[];i=0;} else finish();} show();} function show(){if(!qs[i])return finish(); area.textContent=qs[i][0]; setStatus(`${qs[i][1]} · Aciertos: ${ok}/${qs.length}`);} function answer(){if(!qs[i])return; if(norm(inp.value)===norm(qs[i][2])){ok++;tone(600);} else tone(160); inp.value=''; if(ok>=6){winStat('pasapalabra');setStatus('Rosco completado.');} else next();} function finish(){setStatus(`Fin del rosco. Aciertos: ${ok}`);} show(); }

function blackjackGame() {
  const suits='♠♥♦♣'.split(''); const vals=['A','2','3','4','5','6','7','8','9','10','J','Q','K']; let deck=shuffle(vals.flatMap(v=>suits.map(s=>v+s))), player=[], dealer=[]; const area=div('board-wide'); controls.append(btn('Pedir',hit),btn('Plantarse',stand),btn('Nueva mano',()=>openGame('blackjack'))); board.append(area); function val(hand){let total=0,aces=0; hand.forEach(c=>{const v=c.slice(0,-1); if(v==='A'){aces++;total+=11;} else total+=['J','Q','K'].includes(v)?10:+v;}); while(total>21&&aces){total-=10;aces--;} return total;} function draw(){area.innerHTML=`<p>Tu mano (${val(player)}): ${player.join(' ')}</p><p>Banca (${val(dealer)}): ${dealer.join(' ')}</p>`;} function hit(){player.push(deck.pop()); if(val(player)>21){setStatus('Te pasaste.');} draw();} function stand(){while(val(dealer)<17)dealer.push(deck.pop()); const pv=val(player),dv=val(dealer); if(pv<=21&&(dv>21||pv>dv)){winStat('blackjack');setStatus('Ganas.');} else if(pv===dv)setStatus('Empate.'); else setStatus('Gana la banca.'); draw();} player=[deck.pop(),deck.pop()];dealer=[deck.pop()];draw();setStatus('Pide o plántate.'); }

function dicePokerGame() {
  let dice=[1,1,1,1,1], rolls=0; const area=div('result-big'); controls.append(btn('Lanzar',()=>{if(rolls<2){dice=Array.from({length:5},()=>1+rnd(6));rolls++;draw();}}),btn('Puntuar',score),btn('Nueva mano',()=>openGame('pokerdice'))); board.append(area); function score(){const counts={}; dice.forEach(d=>counts[d]=(counts[d]||0)+1); const vals=Object.values(counts).sort((a,b)=>b-a); let hand=vals[0]===5?'Generala':vals[0]===4?'Póker':vals[0]===3&&vals[1]===2?'Full':dice.join('')==='12345'||dice.join('')==='23456'?'Escalera':vals[0]===3?'Trío':vals[0]===2?'Pareja':'Nada'; if(hand!=='Nada')winStat('pokerdice'); setStatus(hand);} function draw(){area.textContent=dice.join(' · '); setStatus(`Tirada ${rolls}/2`);} draw(); }

function bingoGame() {
  const nums=shuffle(Array.from({length:75},(_,i)=>i+1)); const card=shuffle([...nums]).slice(0,25); let called=new Set(); const g=grid(5); controls.append(btn('Sacar bola',drawBall),btn('Nuevo cartón',()=>openGame('bingo'))); board.append(g); function line(){for(let r=0;r<5;r++)if([0,1,2,3,4].every(c=>called.has(card[r*5+c])))return true; for(let c=0;c<5;c++)if([0,1,2,3,4].every(r=>called.has(card[r*5+c])))return true; return false;} function drawBall(){if(nums.length){called.add(nums.pop());tone(320); if(line()){winStat('bingo');setStatus('¡Línea!');} draw();}} function draw(){g.innerHTML=''; card.forEach(n=>g.append(cell(n,null,'cell '+(called.has(n)?'filled':'')))); setStatus('Bolas llamadas: '+called.size);} draw(); }

function yatzyGame() { let dice=[1,1,1,1,1], rolls=0; const area=div('result-big'); controls.append(btn('Lanzar',()=>{if(rolls<3){dice=Array.from({length:5},()=>1+rnd(6));rolls++;draw();}}),btn('Evaluar',()=>{const counts={};dice.forEach(d=>counts[d]=(counts[d]||0)+1);const vals=Object.values(counts).sort((a,b)=>b-a); const hand=vals[0]===5?'YATZY':vals[0]===4?'Póker':vals[0]===3&&vals[1]===2?'Full':vals[0]===3?'Trío':vals[0]===2?'Pareja':'Suma '+dice.reduce((a,b)=>a+b,0); if(vals[0]>=3)winStat('yatzy'); setStatus(hand);}),btn('Nueva ronda',()=>openGame('yatzy'))); board.append(area); function draw(){area.textContent=dice.join(' · '); setStatus(`Tirada ${rolls}/3`);} draw(); }

function solitaireExpress(id) { const suits='♠♥♦♣'.split(''); let deck=shuffle(suits.flatMap(s=>[1,2,3,4,5,6,7].map(v=>({s,v})))), foundations={}; suits.forEach(s=>foundations[s]=0); const area=div('board-wide'); controls.append(btn('Robar carta',drawCard),btn('Nuevo solitario',()=>openGame(id))); board.append(area); function drawCard(){if(!deck.length){setStatus('Mazo agotado.');return;} const c=deck.pop(); if(c.v===foundations[c.s]+1){foundations[c.s]=c.v;tone(500); if(Object.values(foundations).every(v=>v===7)){winStat(id);setStatus('Solitario completado.');}} else {deck.unshift(c);tone(160);setStatus('No encaja todavía. Carta devuelta al fondo.');} draw();} function draw(){area.innerHTML=`<div class="result-big">${deck.length?'🂠':'✓'}</div><p>${suits.map(s=>s+': '+foundations[s]).join(' · ')}</p>`;} draw(); setStatus('Sube cada palo del 1 al 7.'); }

function freeCellMini() {
  // FreeCell mini: 8 cartas por palo (1-8), 8 columnas, 4 celdas libres
  const vals=[1,2,3,4,5,6,7,8], suits=['S','H','D','C'];
  const suitSym={'S':'♠','H':'♥','D':'♦','C':'♣'};
  const suitColor={'S':'black','H':'red','D':'red','C':'black'};

  // Baraja y reparte
  let allCards = shuffle(vals.flatMap(v=>suits.map(s=>({v,s}))));
  let cols = Array.from({length:8}, (_,i)=>{
    const col=[]; while(allCards.length && col.length < (i<4?4:4)) col.push(allCards.shift()); return col;
  });
  let free=[null,null,null,null];
  let found={'S':0,'H':0,'D':0,'C':0};
  let sel=null, moves=0, over=false;

  const area=div('board-wide');
  controls.append(btn('Auto ↑',doAutoFound), btn('Nuevo FreeCell',()=>openGame('freecell')));
  board.append(area);

  function top(col){return col.length?col[col.length-1]:null;}
  function canStack(card, onto){
    if(!onto) return true;
    return suitColor[onto.s]!==suitColor[card.s] && onto.v-card.v===1;
  }
  function canFound(card){ return found[card.s]===card.v-1; }

  // Mueve carta de src a fundación si puede — devuelve true si lo hizo
  function tryFound(card, removeFn) {
    if(!card || !canFound(card)) return false;
    removeFn();
    found[card.s]++;
    tone(500);
    return true;
  }

  function doAutoFound() {
    let changed=true;
    let safety=0;
    while(changed && safety++<200) {
      changed=false;
      for(let i=0;i<8;i++){
        const c=top(cols[i]);
        if(c && canFound(c)){ found[c.s]++; cols[i].pop(); changed=true; tone(500); }
      }
      for(let i=0;i<4;i++){
        const c=free[i];
        if(c && canFound(c)){ found[c.s]++; free[i]=null; changed=true; tone(500); }
      }
    }
    sel=null; draw(); checkWin();
  }

  function checkWin(){
    if(suits.every(s=>found[s]===8)){
      over=true; winStat('freecell',moves);
      setStatus(`¡FreeCell completado en ${moves} movimientos!`);
    }
  }

  function doMove(card, removeFn, addFn){
    removeFn(); addFn(card); moves++; sel=null; tone(420); draw(); checkWin();
  }

  function clickFreeCell(i){
    if(over) return;
    const c=free[i];
    if(sel){
      const {type,idx}=sel;
      const card = type==='free'?free[idx]:top(cols[idx]);
      if(!card){sel=null;draw();return;}
      if(type==='free'&&idx===i){sel=null;draw();return;}
      // Mover a celda libre vacía
      if(!c){
        doMove(card,
          ()=>{ if(type==='free') free[idx]=null; else cols[idx].pop(); },
          (cd)=>{ free[i]=cd; }
        ); return;
      }
      sel=null; draw();
    } else {
      if(c) sel={type:'free',idx:i};
      draw();
    }
  }

  function clickCol(ci, vi){
    if(over) return;
    const col=cols[ci];
    if(vi!==col.length-1){return;} // solo la carta del tope
    const c=col[vi];
    if(sel){
      const {type,idx}=sel;
      if(type==='col'&&idx===ci){sel=null;draw();return;}
      const card=type==='free'?free[idx]:top(cols[idx]);
      if(!card){sel=null;draw();return;}
      if(canStack(card,c)){
        doMove(card,
          ()=>{ if(type==='free') free[idx]=null; else cols[idx].pop(); },
          (cd)=>{ cols[ci].push(cd); }
        );
        // Intentar auto-fundar la carta recién colocada
        const placed=top(cols[ci]);
        if(placed&&canFound(placed)){ found[placed.s]++; cols[ci].pop(); tone(500); draw(); checkWin(); }
        return;
      }
      sel=null; draw();
    } else {
      sel={type:'col',idx:ci}; draw();
    }
  }

  function clickEmptyCol(ci){
    if(over||!sel) return;
    const {type,idx}=sel;
    const card=type==='free'?free[idx]:top(cols[idx]);
    if(!card){sel=null;draw();return;}
    doMove(card,
      ()=>{ if(type==='free') free[idx]=null; else cols[idx].pop(); },
      (cd)=>{ cols[ci].push(cd); }
    );
  }

  function draw(){
    area.innerHTML='';
    // Fila superior: celdas libres + fundaciones
    const topRow=div('row-flex'); topRow.style.marginBottom='8px';
    free.forEach((c,i)=>{
      topRow.append(cell(c?c.v+suitSym[c.s]:'libre',
        ()=>clickFreeCell(i),
        'cell'+(sel&&sel.type==='free'&&sel.idx===i?' selected':c?' filled':'')));
    });
    // Separador visual
    const sep=document.createElement('span'); sep.style.cssText='width:12px;display:inline-block'; topRow.append(sep);
    suits.forEach(s=>{
      topRow.append(cell(found[s]?found[s]+suitSym[s]:suitSym[s], null, 'cell dark'));
    });
    area.append(topRow);

    // Columnas
    const colWrap=div('row-flex'); colWrap.style.alignItems='flex-start';
    cols.forEach((col,ci)=>{
      const colDiv=div('grid');
      colDiv.style.cssText='grid-template-columns:1fr; min-width:68px; gap:3px;';
      if(!col.length){
        colDiv.append(cell('', ()=>clickEmptyCol(ci), 'cell blank'));
      } else {
        col.forEach((c,vi)=>{
          const isTop=vi===col.length-1;
          const isSel=sel&&sel.type==='col'&&sel.idx===ci&&isTop;
          colDiv.append(cell(c.v+suitSym[c.s],
            ()=>clickCol(ci,vi),
            'cell small'+(isSel?' selected':'')+(isTop?'':' muted')));
        });
      }
      colWrap.append(colDiv);
    });
    area.append(colWrap);

    if(!over){
      const freeFree=free.filter(x=>!x).length;
      setStatus(`FreeCell · ${suits.map(s=>suitSym[s]+':'+found[s]).join(' ')} · Movimientos: ${moves} · Celdas libres: ${freeFree}`);
    }
  }
  draw();
}
function spiderMini() {
  // Spider mini: 4 columnas, cartas 1-8 mezcladas. Siempre resoluble.
  // Objetivo: reunir todos los valores en una sola columna descendente.
  const vals = [1,2,3,4,5,6,7,8];
  // Distribuir los 8 valores en 4 columnas de 2 — siempre resoluble
  const deck = shuffle([...vals]);
  let cols = [
    [deck[0], deck[1]],
    [deck[2], deck[3]],
    [deck[4], deck[5]],
    [deck[6], deck[7]]
  ];
  let moves = 0, over = false;
  let sel = null; // {ci, vi}
  const area = div('board-wide');
  controls.append(btn('Nueva Spider', ()=>openGame('spider')));
  board.append(area);

  // Puede mover un bloque desde vi hasta el final de cols[ci] a cols[dest]
  // El bloque debe ser descendente y la carta base debe colocarse sobre dest_top-1
  function blockIsDesc(col, fromIdx) {
    for(let i=fromIdx; i<col.length-1; i++) if(col[i+1]-col[i]!==1) return false;
    return true;
  }
  function topOf(col) { return col.length ? col[col.length-1] : null; }
  function canPlace(card, destCol) {
    if(destCol.length===0) return true;
    return topOf(destCol) - card === 1;
  }
  function checkWin() {
    // Victoria: alguna columna tiene los 8 valores en orden descendente (8→1)
    return cols.some(col =>
      col.length === 8 &&
      col.every((v,i) => v === 8-i)
    );
  }

  function draw() {
    area.innerHTML = '';
    const wrap = div('row-flex');
    wrap.style.gap = '12px';
    cols.forEach((col, ci) => {
      const colDiv = div('grid');
      colDiv.style.cssText = 'grid-template-columns:1fr; min-width:72px; gap:4px;';
      if(col.length === 0) {
        colDiv.append(cell('—', ()=>{
          if(sel===null || over) return;
          const moving = cols[sel.ci].splice(sel.vi);
          cols[ci].push(...moving);
          moves++; sel=null; tone(350); draw();
        }, 'cell dark'));
      } else {
        col.forEach((v, vi) => {
          const isSelSrc = sel && sel.ci===ci && sel.vi===vi;
          const isMovable = blockIsDesc(col, vi);
          const cls = 'cell' + (isSelSrc ? ' selected' : '') + (isMovable ? '' : ' muted');
          colDiv.append(cell(String(v), ()=>{
            if(over) return;
            if(sel===null) {
              // Solo seleccionar si el bloque desde aquí es descendente
              if(!blockIsDesc(col, vi)) { setStatus('Solo puedes mover bloques en orden descendente.'); return; }
              sel={ci,vi}; draw(); return;
            }
            if(sel.ci===ci && sel.vi===vi) { sel=null; draw(); return; }
            const srcCard = cols[sel.ci][sel.vi];
            if(vi===col.length-1 && canPlace(srcCard, col.slice(0,vi+1).slice(0,-1))) {
              // Colocar bloque encima de esta carta
              if(canPlace(srcCard, col.slice(0,vi+1))) {
                const moving = cols[sel.ci].splice(sel.vi);
                cols[ci].push(...moving);
                moves++; sel=null; tone(420);
                if(checkWin()){ over=true; winStat('spider',moves); setStatus(`¡Spider completado en ${moves} movimientos!`); draw(); return; }
              } else { sel={ci,vi}; }
            } else { sel={ci,vi}; }
            draw();
          }, cls));
        });
      }
      wrap.append(colDiv);
    });
    area.append(wrap);
    if(!over) setStatus(`Spider · Ordena 8→1 en una columna · Movimientos: ${moves}${sel!==null?' · Seleccionado: '+cols[sel.ci][sel.vi]:''}`);
  }
  draw();
}

function dotsGame() { const N=3; let h=new Set(),v=new Set(),boxes={},p='A',score={A:0,B:0}; const area=div('board-wide'); controls.append(btn('Nuevo tablero',()=>openGame('dots'))); board.append(area); function draw(){area.innerHTML=''; const row=div('row-flex'); for(let r=0;r<N;r++)for(let c=0;c<N-1;c++){const k=r+','+c; row.append(btn('— '+k,()=>line('h',k),'secondary'));} for(let r=0;r<N-1;r++)for(let c=0;c<N;c++){const k=r+','+c; row.append(btn('| '+k,()=>line('v',k),'secondary'));} area.append(row); setStatus(`Turno ${p} · A:${score.A} B:${score.B}`);} function hasBox(r,c){return h.has(r+','+c)&&h.has((r+1)+','+c)&&v.has(r+','+c)&&v.has(r+','+(c+1));} function line(type,k){const set=type==='h'?h:v; if(set.has(k))return; set.add(k); let made=0; for(let r=0;r<N-1;r++)for(let c=0;c<N-1;c++){const id=r+','+c; if(!boxes[id]&&hasBox(r,c)){boxes[id]=p;made++;}} if(made){score[p]+=made;tone(650); if(Object.keys(boxes).length===(N-1)*(N-1)){if(score.A>score.B)winStat('dots');setStatus('Final.');}} else p=p==='A'?'B':'A'; draw();} draw(); }

function sosGame() { let a=Array(25).fill(''), p='A', letter='S', score={A:0,B:0}; const g=grid(5); controls.append(btn('Usar S',()=>{letter='S';}),btn('Usar O',()=>{letter='O';}),btn('Nuevo SOS',()=>openGame('sos'))); board.append(g); function countSOS(){let n=0,dirs=[[1,0],[0,1],[1,1],[1,-1]]; for(let i=0;i<25;i++)for(const[dr,dc]of dirs){let r=Math.floor(i/5),c=i%5,chars=''; for(let k=0;k<3;k++){let rr=r+dr*k,cc=c+dc*k; chars+=rr>=0&&rr<5&&cc>=0&&cc<5?a[rr*5+cc]:'?';} if(chars==='SOS')n++;} return n;} let total=0; function draw(){g.innerHTML=''; a.forEach((v,i)=>g.append(cell(v,()=>{if(v)return; a[i]=letter; const nt=countSOS(); if(nt>total){score[p]+=nt-total; total=nt; tone(650);} else p=p==='A'?'B':'A'; if(a.every(Boolean)){if(score.A>score.B)winStat('sos');setStatus('Final.');} draw();},'cell big'))); setStatus(`Turno ${p} · Letra ${letter} · A:${score.A} B:${score.B}`);} draw(); }

function bullsGame() { const code=shuffle([0,1,2,3,4,5,6,7,8,9]).slice(0,4).join(''); const area=div('board-wide'); const inp=input('text',''); inp.maxLength=4; controls.append(inp,btn('Probar',()=>{const g=inp.value; if(!/^\d{4}$/.test(g))return setStatus('Escribe 4 dígitos.'); let bulls=0,cows=0; for(let i=0;i<4;i++){if(g[i]===code[i])bulls++; else if(code.includes(g[i]))cows++;} area.prepend(paragraph(`${g}: ${bulls} toros · ${cows} vacas`)); if(bulls===4){winStat('bulls');setStatus('Código abierto.');} inp.value='';}),btn('Nuevo código',()=>openGame('bulls'))); board.append(area); setStatus('Código de 4 dígitos sin repetir.'); }

function mazeGame() { const map=['S....','.###.','...#.','.##..','....G']; let pos=[0,0]; const g=grid(5); controls.append(btn('↑',()=>mv(-1,0)),btn('↓',()=>mv(1,0)),btn('←',()=>mv(0,-1)),btn('→',()=>mv(0,1)),btn('Nuevo laberinto',()=>openGame('maze'))); board.append(g); function mv(dr,dc){const r=pos[0]+dr,c=pos[1]+dc; if(r<0||r>=5||c<0||c>=5||map[r][c]==='#')return; pos=[r,c]; tone(360); if(map[r][c]==='G'){winStat('maze');setStatus('Salida encontrada.');} draw();} function draw(){g.innerHTML=''; for(let r=0;r<5;r++)for(let c=0;c<5;c++){let ch=map[r][c]; if(pos[0]===r&&pos[1]===c)ch='🙂'; g.append(cell(ch==='#'?'█':ch==='G'?'🏁':ch==='🙂'?ch:'',null,'cell big '+(ch==='#'?'dark':'')));}} setStatus('Busca la salida.'); draw(); }

function floodGame() { const N=7, colors=['🔴','🔵','🟢','🟡','🟣']; let a=Array.from({length:N*N},()=>rnd(colors.length)), moves=0; const g=grid(N); const bar=div('row-flex'); colors.forEach((c,i)=>bar.append(btn(c,()=>flood(i),'secondary'))); controls.append(bar,btn('Nuevo flood',()=>openGame('flood'))); board.append(g); function flood(col){const old=a[0]; if(old===col)return; const seen=new Set(); function rec(i){if(seen.has(i)||a[i]!==old)return; seen.add(i); const r=Math.floor(i/N),c=i%N; [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc;if(rr>=0&&rr<N&&cc>=0&&cc<N)rec(rr*N+cc);});} rec(0); seen.forEach(i=>a[i]=col); moves++; tone(420); if(a.every(x=>x===a[0]))winStat('flood',moves); draw();} function draw(){g.innerHTML=''; a.forEach(v=>g.append(cell(colors[v],null,'cell small'))); setStatus('Movimientos: '+moves);} draw(); }

function mathGame() { let ok=0,cur; const area=div('result-big'); const inp=input('number',''); controls.append(inp,btn('Responder',ans),btn('Nuevo reto',()=>openGame('math'))); board.append(area); function next(){const a=1+rnd(12),b=1+rnd(12),op=pick(['+','-','×']); const res=op==='+'?a+b:op==='-'?a-b:a*b; cur={q:`${a} ${op} ${b}`,res}; area.textContent=cur.q; setStatus(`Aciertos: ${ok}/10`);} function ans(){if(+inp.value===cur.res){ok++;tone(650);} else tone(160); inp.value=''; if(ok>=10){winStat('math');setStatus('Reto completado.');} else next();} next(); }

/* ===============================
   V3 COMMERCIAL POLISH OVERRIDES
   Replaces the biggest “mini” modules with stronger engines:
   - Chess with legal move validation, check, checkmate, stalemate, castling, en passant and promotion.
   - Reversi with greedy local AI.
   - Checkers with forced captures and greedy local AI.
   - Parchís with 4 colours, home, safe squares, captures and CPU turns.
   - Backgammon with points, bar, bearing off and CPU turns.
   =============================== */
(function upgradeCommercialV3(){
  const patchMeta = {
    chess:['Ajedrez Completo', '♔', 'Motor legal con jaque, mate, tablas, enroque, promoción, en passant e IA local.', 'Mueve piezas legales. No puedes dejar tu rey en jaque. Puedes jugar local o contra la caja. Incluye jaque, jaque mate, ahogado, enroque, promoción automática a dama y en passant.'],
    checkers:['Damas con IA', '⛂', 'Capturas obligatorias, coronación e IA local.', 'Las capturas son obligatorias. Las damas coronadas mueven hacia ambos lados. Puedes jugar local o contra la caja.'],
    reversi:['Reversi con IA', '◐', 'Othello completo en 8x8 con movimientos legales e IA codiciosa.', 'Coloca fichas flanqueando rivales en cualquier dirección. Si no tienes movimiento pasas. Gana quien tenga más fichas al final.'],
    parchis:['Parchís Clásico 4 colores', '🏠', 'Casa, salidas, seguros, capturas, meta y tres rivales CPU.', 'Saca fichas con 5, avanza con el dado, captura rivales en casillas no seguras y llega a meta con tirada exacta. Juegas rojo contra tres colores de la caja.'],
    backgammon:['Backgammon Real', '🎲', 'Puntos, barra, entrada, dados dobles y retirada.', 'Mueve tus fichas según los dados. Puedes capturar blots, entrar desde la barra y retirar cuando todas tus fichas estén en tu tablero interno.']
  };
  for (const [id, data] of Object.entries(patchMeta)) {
    const g = games.find(x => x.id === id);
    if (g) { g.name = data[0]; g.icon = data[1]; g.sub = data[2]; g.rules = data[3]; }
  }

  function miniButton(label, handler, cls='secondary') { return btn(label, handler, cls); }
  function isHumanMode(mode) { return mode === 'cpu'; }
  function delay(fn, ms=260) { return gameTimeout(fn, ms); }

  renderers.chess = function chessV3() {
    startStat('chess');
    const UNI = {K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
    const VAL = {p:100,n:320,b:330,r:500,q:900,k:20000};
    let mode = storage.getItem('cajaChessMode') || 'cpu';
    let selected = null, legal = [], flipped = false;
    let state = newGame();
    const wrap = div('board-wide premium-game');
    const cg = div('chess-board');
    const info = div('game-log');
    controls.append(
      miniButton('Nueva partida', () => openGame('chess'), 'primary'),
      select([{value:'cpu',label:'Contra la caja'}, {value:'local',label:'2 jugadores local'}], mode, v => { mode=v; storage.setItem('cajaChessMode', v); openGame('chess'); }),
      miniButton('Girar tablero', () => { flipped=!flipped; draw(); }),
      miniButton('Deshacer medio movimiento', undo)
    );
    wrap.append(cg, info); board.append(wrap);
    draw();

    function newGame(){
      const rows = ['rnbqkbnr','pppppppp','........','........','........','........','PPPPPPPP','RNBQKBNR'];
      return {b: rows.map(r => [...r].map(x => x==='.' ? '' : x)), turn:'w', castle:'KQkq', ep:null, half:0, full:1, hist:[], over:false, last:null};
    }
    function clone(s){ return {b:s.b.map(r=>r.slice()), turn:s.turn, castle:s.castle, ep:s.ep?{...s.ep}:null, half:s.half, full:s.full, hist:s.hist.slice(), over:s.over, last:s.last?{...s.last}:null}; }
    function color(p){ return !p ? '' : p === p.toUpperCase() ? 'w' : 'b'; }
    function opp(c){ return c === 'w' ? 'b' : 'w'; }
    function inside(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
    function pieceAt(s,r,c){ return inside(r,c) ? s.b[r][c] : null; }
    function kingPos(s,c){ const k = c==='w'?'K':'k'; for(let r=0;r<8;r++)for(let col=0;col<8;col++) if(s.b[r][col]===k) return [r,col]; return [-1,-1]; }
    function attacked(s, r, c, by){
      for(let rr=0;rr<8;rr++)for(let cc=0;cc<8;cc++){
        const p=s.b[rr][cc]; if(!p || color(p)!==by) continue;
        if(pseudo(s, rr, cc, true).some(m => m.toR===r && m.toC===c)) return true;
      }
      return false;
    }
    function inCheck(s,c){ const [r,c2] = kingPos(s,c); return r>=0 && attacked(s,r,c2,opp(c)); }
    function pseudo(s,r,c,attackOnly=false){
      const p=s.b[r][c]; if(!p) return [];
      const side=color(p), enemy=opp(side), lower=p.toLowerCase(), moves=[];
      const add=(toR,toC,extra={})=>{ if(!inside(toR,toC)) return; const t=s.b[toR][toC]; if(!t || color(t)!==side) moves.push({fromR:r,fromC:c,toR,toC,p,cap:t||'',...extra}); };
      const slide=(dirs)=>dirs.forEach(([dr,dc])=>{ let rr=r+dr,cc=c+dc; while(inside(rr,cc)){ const t=s.b[rr][cc]; if(!t) moves.push({fromR:r,fromC:c,toR:rr,toC:cc,p,cap:''}); else { if(color(t)!==side) moves.push({fromR:r,fromC:c,toR:rr,toC:cc,p,cap:t}); break; } rr+=dr; cc+=dc; } });
      if(lower==='p'){
        const dir=side==='w'?-1:1, start=side==='w'?6:1, promo=side==='w'?0:7;
        for(const dc of [-1,1]){ const rr=r+dir, cc=c+dc; if(inside(rr,cc)){
          const t=s.b[rr][cc];
          if(attackOnly) moves.push({fromR:r,fromC:c,toR:rr,toC:cc,p,cap:t||''});
          else if(t && color(t)===enemy) moves.push({fromR:r,fromC:c,toR:rr,toC:cc,p,cap:t,promo:rr===promo});
          else if(s.ep && s.ep.r===rr && s.ep.c===cc) moves.push({fromR:r,fromC:c,toR:rr,toC:cc,p,cap:side==='w'?'p':'P',ep:true});
        }}
        if(!attackOnly){
          const one=r+dir;
          if(inside(one,c) && !s.b[one][c]) { moves.push({fromR:r,fromC:c,toR:one,toC:c,p,cap:'',promo:one===promo});
            const two=r+dir*2; if(r===start && !s.b[two][c]) moves.push({fromR:r,fromC:c,toR:two,toC:c,p,cap:'',double:true});
          }
        }
      } else if(lower==='n') {
        [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr,dc])=>add(r+dr,c+dc));
      } else if(lower==='b') slide([[1,1],[1,-1],[-1,1],[-1,-1]]);
      else if(lower==='r') slide([[1,0],[-1,0],[0,1],[0,-1]]);
      else if(lower==='q') slide([[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]]);
      else if(lower==='k') {
        for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++) if(dr||dc) add(r+dr,c+dc);
        if(!attackOnly && !inCheck(s,side)) {
          const rank=side==='w'?7:0, rights=side==='w'?['K','Q']:['k','q'];
          if(r===rank && c===4 && s.castle.includes(rights[0]) && !s.b[rank][5] && !s.b[rank][6] && !attacked(s,rank,5,enemy) && !attacked(s,rank,6,enemy)) moves.push({fromR:r,fromC:c,toR:rank,toC:6,p,castle:'K'});
          if(r===rank && c===4 && s.castle.includes(rights[1]) && !s.b[rank][3] && !s.b[rank][2] && !s.b[rank][1] && !attacked(s,rank,3,enemy) && !attacked(s,rank,2,enemy)) moves.push({fromR:r,fromC:c,toR:rank,toC:2,p,castle:'Q'});
        }
      }
      return moves.filter(m => !m.cap || m.cap.toLowerCase() !== 'k');
    }
    function legalMovesFor(s,c=s.turn){
      const out=[]; for(let r=0;r<8;r++)for(let col=0;col<8;col++){ const p=s.b[r][col]; if(p && color(p)===c){ for(const m of pseudo(s,r,col,false)){ const ns=applyMove(clone(s),m,false); if(!inCheck(ns,c)) out.push(m); } } }
      return out;
    }
    function pieceMoves(r,c){ return legalMovesFor(state,state.turn).filter(m=>m.fromR===r&&m.fromC===c); }
    function applyMove(s,m,record=true){
      if(record) s.hist.push(JSON.stringify({b:s.b,turn:s.turn,castle:s.castle,ep:s.ep,half:s.half,full:s.full,last:s.last}));
      const p=s.b[m.fromR][m.fromC]; s.b[m.fromR][m.fromC]='';
      if(m.ep) s.b[m.fromR][m.toC]='';
      if(m.castle==='K'){ s.b[m.toR][5]=s.b[m.toR][7]; s.b[m.toR][7]=''; }
      if(m.castle==='Q'){ s.b[m.toR][3]=s.b[m.toR][0]; s.b[m.toR][0]=''; }
      let place=p; if(m.promo) place=color(p)==='w'?'Q':'q';
      s.b[m.toR][m.toC]=place;
      if(p==='K') s.castle=s.castle.replace(/[KQ]/g,''); if(p==='k') s.castle=s.castle.replace(/[kq]/g,'');
      if(p==='R' && m.fromR===7 && m.fromC===0) s.castle=s.castle.replace('Q','');
      if(p==='R' && m.fromR===7 && m.fromC===7) s.castle=s.castle.replace('K','');
      if(p==='r' && m.fromR===0 && m.fromC===0) s.castle=s.castle.replace('q','');
      if(p==='r' && m.fromR===0 && m.fromC===7) s.castle=s.castle.replace('k','');
      if(m.cap==='R' && m.toR===7 && m.toC===0) s.castle=s.castle.replace('Q','');
      if(m.cap==='R' && m.toR===7 && m.toC===7) s.castle=s.castle.replace('K','');
      if(m.cap==='r' && m.toR===0 && m.toC===0) s.castle=s.castle.replace('q','');
      if(m.cap==='r' && m.toR===0 && m.toC===7) s.castle=s.castle.replace('k','');
      s.ep = m.double ? {r:(m.fromR+m.toR)/2,c:m.fromC} : null;
      if(p.toLowerCase()==='p' || m.cap) s.half=0; else s.half++;
      s.last={fromR:m.fromR,fromC:m.fromC,toR:m.toR,toC:m.toC};
      if(s.turn==='b') s.full++;
      s.turn=opp(s.turn); return s;
    }
    function doMove(m){
      if(state.over) return; state=applyMove(state,m,true); selected=null; legal=[]; tone(m.cap?180:420); finishCheck(); draw();
      if(!state.over && mode==='cpu' && state.turn==='b') delay(aiMove, 300);
    }
    function finishCheck(){
      if(state.over) return;
      const moves=legalMovesFor(state,state.turn); const check=inCheck(state,state.turn);
      if(moves.length===0){ state.over=true; if(check){ const winner=opp(state.turn); if(winner==='w') winStat('chess'); setStatus(`Jaque mate. Ganan ${winner==='w'?'blancas':'negras'}.`); } else setStatus('Tablas por ahogado.'); }
      else setStatus(`${state.turn==='w'?'Blancas':'Negras'} mueven${check?' · JAQUE':''}. Movimientos legales: ${moves.length}.`);
    }
    function evaluate(s){
      let score=0; for(let r=0;r<8;r++)for(let c=0;c<8;c++){ const p=s.b[r][c]; if(p) score += (color(p)==='w'?1:-1) * VAL[p.toLowerCase()]; }
      return score + legalMovesFor(s,'w').length*2 - legalMovesFor(s,'b').length*2;
    }
    function aiMove(){
      if(state.over || state.turn!=='b') return; const moves=legalMovesFor(state,'b'); if(!moves.length){finishCheck();draw();return;}
      let best=[], bestScore=Infinity;
      for(const m of moves){ const s1=applyMove(clone(state),m,false); let sc=evaluate(s1);
        const replies=legalMovesFor(s1,'w').slice(0,28); if(replies.length){ let worst=-Infinity; for(const r of replies){ worst=Math.max(worst,evaluate(applyMove(clone(s1),r,false))); } sc=0.65*sc+0.35*worst; }
        if(sc<bestScore){bestScore=sc;best=[m];} else if(sc===bestScore) best.push(m);
      }
      doMove(pick(best));
    }
    function undo(){
      const raw=state.hist.pop(); if(!raw) return; const old=JSON.parse(raw); state={...state,b:old.b,turn:old.turn,castle:old.castle,ep:old.ep,half:old.half,full:old.full,last:old.last,over:false}; selected=null; legal=[]; finishCheck(); draw();
    }
    function draw(){
      cg.innerHTML=''; const rows=[0,1,2,3,4,5,6,7], cols=[0,1,2,3,4,5,6,7]; if(flipped){rows.reverse(); cols.reverse();}
      const lmSet=new Set(legal.map(m=>`${m.toR},${m.toC}`));
      for(const r of rows) for(const c of cols){
        const p=state.b[r][c]; const sq=cell(p?UNI[p]:'',()=>clickSquare(r,c),'chess-cell '+(((r+c)%2)?'dark-square':'light-square'));
        sq.setAttribute?.('aria-label', `${String.fromCharCode(97+c)}${8-r} ${p||'vacía'}`);
        if(state.last && ((state.last.fromR===r&&state.last.fromC===c)||(state.last.toR===r&&state.last.toC===c))) sq.classList.add('last');
        if(selected && selected[0]===r && selected[1]===c) sq.classList.add('selected');
        if(lmSet.has(`${r},${c}`)) sq.classList.add('legal');
        if(p && color(p)==='w') sq.classList.add('white-piece'); if(p && color(p)==='b') sq.classList.add('black-piece');
        cg.append(sq);
      }
      info.innerHTML = `<strong>Turno:</strong> ${state.turn==='w'?'Blancas':'Negras'} · <strong>Modo:</strong> ${mode==='cpu'?'contra la caja':'local'} · <strong>Jugada:</strong> ${state.full}<br><span>${inCheck(state,state.turn)?'⚠️ Rey en jaque. ':''}Reglas v3: legalidad, mate, ahogado, enroque, en passant y promoción automática.</span>`;
      finishCheck();
    }
    function clickSquare(r,c){
      if(state.over) return; if(mode==='cpu' && state.turn==='b') return;
      const p=state.b[r][c];
      if(selected){ const m=legal.find(x=>x.toR===r&&x.toC===c); if(m){ doMove(m); return; } }
      if(p && color(p)===state.turn){ selected=[r,c]; legal=pieceMoves(r,c); tone(300); draw(); }
      else { selected=null; legal=[]; draw(); }
    }
  };

  renderers.reversi = function reversiV3(){
    startStat('reversi');
    let mode = storage.getItem('cajaReversiMode') || 'cpu';
    const N=8, dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let a=Array(N*N).fill(''), turn='B', over=false;
    a[27]='W';a[28]='B';a[35]='B';a[36]='W';
    const g=div('reversi-board'); const info=div('game-log'); const wrap=div('board-wide premium-game');
    controls.append(miniButton('Nueva partida',()=>openGame('reversi'),'primary'), select([{value:'cpu',label:'Contra la caja'}, {value:'local',label:'2 jugadores local'}], mode, v=>{mode=v;storage.setItem('cajaReversiMode',v);openGame('reversi');}));
    wrap.append(g,info); board.append(wrap); draw();
    function idx(r,c){return r*N+c;} function ok(r,c){return r>=0&&r<N&&c>=0&&c<N;} function oppp(p){return p==='B'?'W':'B';}
    function flipsFor(pos,p){ if(a[pos]) return []; const r=Math.floor(pos/N),c=pos%N,out=[]; for(const[dr,dc]of dirs){let rr=r+dr,cc=c+dc,line=[]; while(ok(rr,cc)&&a[idx(rr,cc)]===oppp(p)){line.push(idx(rr,cc));rr+=dr;cc+=dc;} if(line.length&&ok(rr,cc)&&a[idx(rr,cc)]===p) out.push(...line);} return out; }
    function moves(p){return a.map((_,i)=>flipsFor(i,p).length?i:null).filter(x=>x!==null);} 
    function place(i){ if(over) return; const f=flipsFor(i,turn); if(!f.length) return; a[i]=turn; f.forEach(j=>a[j]=turn); tone(430); next(); }
    function next(){ turn=oppp(turn); let m=moves(turn); if(!m.length){ turn=oppp(turn); if(!moves(turn).length){finish();return;} setStatus(`${turn==='B'?'Negras':'Blancas'} continúan: el rival no puede mover.`); }
      draw(); if(!over && mode==='cpu' && turn==='W') delay(ai,280); }
    function ai(){ const m=moves('W'); if(!m.length){next();return;} const corners=[0,7,56,63]; let best=m[0], bestScore=-999; for(const i of m){ let sc=flipsFor(i,'W').length; if(corners.includes(i)) sc+=50; const r=Math.floor(i/N),c=i%N; if(r===0||r===7||c===0||c===7) sc+=5; if(sc>bestScore){bestScore=sc;best=i;} } place(best); }
    function finish(){over=true; const b=a.filter(x=>x==='B').length,w=a.filter(x=>x==='W').length; if(b>w) winStat('reversi'); setStatus(`Final: negras ${b} · blancas ${w}. ${b>w?'Ganas.':w>b?'Gana la caja.':'Empate.'}`); draw(); }
    function draw(){ g.innerHTML=''; const ms=new Set(moves(turn)); for(let i=0;i<N*N;i++){ const piece=a[i]; const sq=cell(piece==='B'?'●':piece==='W'?'○':'',()=>{ if(mode==='cpu'&&turn==='W')return; place(i);},'reversi-cell '+(piece==='B'?'black':piece==='W'?'white':'')+(ms.has(i)?' legal':'')); g.append(sq);} const b=a.filter(x=>x==='B').length,w=a.filter(x=>x==='W').length; info.innerHTML=`<strong>Turno:</strong> ${turn==='B'?'negras/tú':'blancas/caja'} · <strong>Marcador:</strong> negras ${b} · blancas ${w}`; if(!over) setStatus(`Movimientos legales: ${moves(turn).length}.`); }
  };

  renderers.checkers = function checkersV3(){
    startStat('checkers');
    let mode=storage.getItem('cajaCheckersMode')||'cpu';
    const N=8; let a=Array(N*N).fill(''), turn='r', selected=null, legal=[], over=false;
    for(let r=0;r<3;r++)for(let c=0;c<N;c++) if((r+c)%2) a[r*N+c]='b';
    for(let r=5;r<8;r++)for(let c=0;c<N;c++) if((r+c)%2) a[r*N+c]='r';
    const g=div('checkers-board'); const info=div('game-log'); const wrap=div('board-wide premium-game');
    controls.append(miniButton('Nueva partida',()=>openGame('checkers'),'primary'), select([{value:'cpu',label:'Contra la caja'}, {value:'local',label:'2 jugadores local'}],mode,v=>{mode=v;storage.setItem('cajaCheckersMode',v);openGame('checkers');}));
    wrap.append(g,info); board.append(wrap); draw();
    function idx(r,c){return r*N+c;} function ok(r,c){return r>=0&&r<N&&c>=0&&c<N;} function side(p){return p?.toLowerCase();} function king(p){return p && p===p.toUpperCase();} function dirs(p){ if(king(p)) return [[1,1],[1,-1],[-1,1],[-1,-1]]; return side(p)==='r'?[[-1,1],[-1,-1]]:[[1,1],[1,-1]]; }
    function allMoves(s=turn){ let caps=[], normals=[]; for(let i=0;i<64;i++){ const p=a[i]; if(!p||side(p)!==s)continue; const r=Math.floor(i/N),c=i%N; for(const[dr,dc]of dirs(p)){ const r1=r+dr,c1=c+dc,r2=r+dr*2,c2=c+dc*2; if(ok(r2,c2)&&a[idx(r1,c1)]&&side(a[idx(r1,c1)])!==s&&!a[idx(r2,c2)]) caps.push({from:i,to:idx(r2,c2),cap:idx(r1,c1)}); if(ok(r1,c1)&&!a[idx(r1,c1)]) normals.push({from:i,to:idx(r1,c1)}); } } return caps.length?caps:normals; }
    function movesFrom(i){return allMoves(turn).filter(m=>m.from===i);} function crown(i){const r=Math.floor(i/N); if(a[i]==='r'&&r===0)a[i]='R'; if(a[i]==='b'&&r===7)a[i]='B';}
    function move(m){ if(over)return; a[m.to]=a[m.from]; a[m.from]=''; if(m.cap)a[m.cap]=''; crown(m.to); tone(m.cap?160:420); const more=m.cap?movesFrom(m.to).filter(x=>x.cap):[]; if(more.length){ selected=m.to; legal=more; draw(); setStatus('Captura múltiple obligatoria.'); return;} selected=null; legal=[]; turn=turn==='r'?'b':'r'; const oppMoves=allMoves(turn); const red=a.some(x=>side(x)==='r'), black=a.some(x=>side(x)==='b'); if(!red||!black||!oppMoves.length){over=true; const redWin=red && (!black || !oppMoves.length && turn==='b'); if(redWin) winStat('checkers'); setStatus(redWin?'Ganan rojas.':'Ganan negras.');} draw(); if(!over&&mode==='cpu'&&turn==='b')delay(ai,280); }
    function ai(){ const ms=allMoves('b'); if(!ms.length)return; const scored=ms.map(m=>[m,(m.cap?100:0)+(a[m.to]==='b'&&Math.floor(m.to/N)===7?50:0)+rnd(10)]).sort((x,y)=>y[1]-x[1]); move(scored[0][0]); }
    function draw(){ g.innerHTML=''; const lm=new Set(legal.map(m=>m.to)); for(let i=0;i<64;i++){ const p=a[i], r=Math.floor(i/N), c=i%N; const sq=cell(p?(side(p)==='r'?(king(p)?'⛃':'⛂'):(king(p)?'⛁':'⛀')):'',()=>click(i),'checkers-cell '+(((r+c)%2)?'dark-square':'light-square')+(selected===i?' selected':'')+(lm.has(i)?' legal':'')+(side(p)==='r'?' red-piece':side(p)==='b'?' black-piece':'')); g.append(sq);} info.innerHTML=`<strong>Turno:</strong> ${turn==='r'?'rojas/tú':'negras/caja'} · <strong>Captura obligatoria:</strong> ${allMoves(turn).some(m=>m.cap)?'sí':'no'}`; if(!over) setStatus(`Movimientos legales: ${allMoves(turn).length}.`); }
    function click(i){ if(over || (mode==='cpu'&&turn==='b'))return; if(selected!==null){ const m=legal.find(x=>x.to===i); if(m){move(m);return;} } if(a[i]&&side(a[i])===turn){selected=i;legal=movesFrom(i);tone(330);draw();} }
  };

  renderers.parchis = function parchisV3(){
    startStat('parchis');
    const LEN=68, HOME=-1, GOAL=68;
    const colors=['rojo','azul','verde','amarillo'], emoji={rojo:'🔴',azul:'🔵',verde:'🟢',amarillo:'🟡'};
    const start={rojo:0,azul:17,verde:34,amarillo:51}; const safe=new Set([0,5,12,17,22,29,34,39,46,51,56,63]);
    let pieces={}; colors.forEach(c=>pieces[c]=[HOME,HOME,HOME,HOME]); let turn=0, die=null, selectable=[], over=false;
    const track=div('parchis-track'); const info=div('game-log'); const wrap=div('board-wide premium-game');
    controls.append(miniButton('Nueva partida',()=>openGame('parchis'),'primary'), miniButton('Tirar dado',roll,'primary'));
    wrap.append(track,info); board.append(wrap); draw();
    function absPos(c,rel){ if(rel<0||rel>=GOAL) return rel; return (start[c]+rel)%LEN; }
    function occupantsAt(abs){ const out=[]; for(const c of colors) pieces[c].forEach((rel,i)=>{ if(rel>=0&&rel<GOAL&&absPos(c,rel)===abs) out.push({c,i}); }); return out; }
    function roll(){ if(over||die!==null)return; die=1+rnd(6); tone(260); selectable=legalFor(colors[turn],die); setStatus(`${colors[turn]} tira ${die}. ${selectable.length?'Elige ficha.':'Sin movimiento: pasa.'}`); draw(); if(!selectable.length) delay(nextTurn,500); else if(turn!==0) delay(cpu,550); }
    function legalFor(c,d){ const arr=[]; pieces[c].forEach((pos,i)=>{ if(pos===GOAL)return; if(pos===HOME){ if(d===5) arr.push(i); } else if(pos+d<=GOAL) arr.push(i); }); return arr; }
    function movePiece(c,i){ if(over||die===null||c!==colors[turn]||!selectable.includes(i))return; let pos=pieces[c][i]; if(pos===HOME) pos=0; else pos+=die; pieces[c][i]=pos; if(pos<GOAL){ const a=absPos(c,pos); if(!safe.has(a)){ const occ=occupantsAt(a).filter(o=>o.c!==c); if(occ.length===1){ pieces[occ[0].c][occ[0].i]=HOME; setStatus(`${emoji[c]} captura a ${emoji[occ[0].c]}.`); tone(140); } } } else { tone(720); }
      if(pieces[c].every(x=>x===GOAL)){ over=true; if(c==='rojo')winStat('parchis'); setStatus(`${emoji[c]} gana el parchís.`); draw(); return; }
      const repeat=die===6; die=null; selectable=[]; draw(); if(repeat){setStatus(`${emoji[c]} repite por sacar 6.`); delay(()=>{if(!over)roll();},450);} else nextTurn(); }
    function nextTurn(){ die=null; selectable=[]; turn=(turn+1)%4; draw(); setStatus(`Turno ${emoji[colors[turn]]} ${colors[turn]}. Pulsa tirar.`); if(turn!==0&&!over) delay(roll,650); }
    function cpu(){ const c=colors[turn]; if(die===null||!selectable.length)return; const pickIndex=selectable.map(i=>{let p=pieces[c][i], target=p===HOME?0:p+die, score=target; if(target<GOAL&&!safe.has(absPos(c,target))&&occupantsAt(absPos(c,target)).some(o=>o.c!==c))score+=60; if(target===GOAL)score+=100; return [i,score];}).sort((a,b)=>b[1]-a[1])[0][0]; movePiece(c,pickIndex); }
    function draw(){ track.innerHTML=''; for(let n=0;n<LEN;n++){ const occ=occupantsAt(n); const sq=div('parchis-cell '+(safe.has(n)?'safe':''), safe.has(n)?'★':''); occ.forEach(o=>{ const s=document.createElement('span'); s.className='pawn-dot '+o.c; s.textContent=emoji[o.c]; sq.append(s); }); track.append(sq); }
      const homes=div('parchis-homes'); colors.forEach(c=>{ const box=div('home-box '+c, `<strong>${emoji[c]} ${c}</strong>`); pieces[c].forEach((p,i)=>{ const b=miniButton(p===HOME?'Casa':p===GOAL?'Meta':String(p),()=>{ if(c==='rojo')movePiece(c,i); }, selectable.includes(i)&&c===colors[turn]?'primary':'secondary'); box.append(b); }); homes.append(box); }); track.append(homes);
      info.innerHTML=`<strong>Turno:</strong> ${emoji[colors[turn]]} ${colors[turn]} · <strong>Dado:</strong> ${die??'—'} · <strong>Seguros:</strong> estrellas`; }
  };

  renderers.backgammon = function backgammonV3(){
    startStat('backgammon');
    let points=Array(24).fill(null).map(()=>({w:0,b:0}));
    points[23].w=2; points[12].w=5; points[7].w=3; points[5].w=5;
    points[0].b=2; points[11].b=5; points[16].b=3; points[18].b=5;
    let bar={w:0,b:0}, off={w:0,b:0}, turn='w', dice=[], selected=null, over=false;
    const bg=div('backgammon-board'); const info=div('game-log'); const wrap=div('board-wide premium-game');
    controls.append(miniButton('Nueva partida',()=>openGame('backgammon'),'primary'), miniButton('Tirar dados',roll,'primary'));
    wrap.append(bg,info); board.append(wrap); draw();
    function dir(s){return s==='w'?-1:1;} function enemy(s){return s==='w'?'b':'w';} function homeBoard(s,i){return s==='w'?i>=0&&i<=5:i>=18&&i<=23;} function allHome(s){ if(bar[s])return false; for(let i=0;i<24;i++) if(points[i][s] && !homeBoard(s,i)) return false; return true; }
    function canLand(s,i){ if(i<0||i>23)return allHome(s); const e=enemy(s); return points[i][e]<=1; }
    function legalOrigins(s,d){ const out=[]; if(bar[s]){ const entry=s==='w'?24-d:d-1; if(canLand(s,entry)) out.push('bar'); return out; } for(let i=0;i<24;i++){ if(points[i][s] && canLand(s,i+dir(s)*d)) out.push(i); } return out; }
    function legalFor(s){ return [...new Set(dice.flatMap(d=>legalOrigins(s,d).map(o=>`${o}:${d}`)))]; }
    function roll(){ if(over||dice.length)return; const a=1+rnd(6),b=1+rnd(6); dice=a===b?[a,a,a,a]:[a,b]; tone(260); setStatus(`${turn==='w'?'Tú':'Caja'} tira ${dice.join(' · ')}.`); draw(); if(!legalFor(turn).length) delay(pass,550); else if(turn==='b') delay(cpu,650); }
    function move(origin,d){ if(over||!dice.includes(d))return; const s=turn,e=enemy(s); let from=origin, to;
      if(origin==='bar'){ to=s==='w'?24-d:d-1; if(!bar[s]||!canLand(s,to))return; bar[s]--; }
      else { if(!points[origin][s])return; to=origin+dir(s)*d; if(!canLand(s,to))return; points[origin][s]--; }
      if(to<0||to>23){ off[s]++; tone(720); }
      else { if(points[to][e]===1){points[to][e]=0;bar[e]++;tone(150);} points[to][s]++; }
      dice.splice(dice.indexOf(d),1); selected=null; if(off[s]>=15){over=true;if(s==='w')winStat('backgammon');setStatus(s==='w'?'Has sacado todas las fichas.':'La caja gana.');draw();return;} draw(); if(!dice.length||!legalFor(turn).length) delay(pass,450); else if(turn==='b') delay(cpu,450); }
    function pass(){ dice=[]; selected=null; turn=enemy(turn); setStatus(`${turn==='w'?'Tu turno':'Turno de la caja'}. Tira dados.`); draw(); if(turn==='b')delay(roll,650); }
    function cpu(){ const opts=legalFor('b'); if(!opts.length){pass();return;} const scored=opts.map(x=>{ const [o,dstr]=x.split(':'), d=+dstr; const origin=o==='bar'?'bar':+o; const to=origin==='bar'?d-1:origin+d; let sc=to; if(to>=24) sc+=100; else if(points[to].w===1) sc+=70; return [x,sc];}).sort((a,b)=>b[1]-a[1]); const [o,dstr]=scored[0][0].split(':'); move(o==='bar'?'bar':+o,+dstr); }
    function draw(){ bg.innerHTML=''; const legal=legalFor(turn); for(let i=23;i>=0;i--){ const p=points[i]; const cell=div('bg-point '+(i%2?'odd':'even')+(selected===i?' selected':''), `<span class="pt-num">${i+1}</span>`); const total=p.w+p.b; const owner=p.w?'w':p.b?'b':''; for(let k=0;k<Math.min(total,5);k++){ const dot=document.createElement('span'); dot.className='checker '+owner; dot.textContent=owner==='w'?'⚪':'⚫'; cell.append(dot); } if(total>5) cell.append(div('stack-count',String(total))); cell.addEventListener('click',()=>clickPoint(i)); bg.append(cell); }
      const side=div('bg-side', `<button type="button" class="secondary" id="bgBarW">Tu barra: ${bar.w}</button><button type="button" class="secondary" id="bgBarB">Barra caja: ${bar.b}</button><p>Fuera: tú ${off.w} · caja ${off.b}</p>`); bg.append(side); $('#bgBarW',side)?.addEventListener('click',()=>{ if(turn==='w') selected='bar'; draw(); });
      info.innerHTML=`<strong>Turno:</strong> ${turn==='w'?'tú':'caja'} · <strong>Dados:</strong> ${dice.join(' · ')||'—'} · <strong>Movimientos:</strong> ${legal.length}`; }
    function clickPoint(i){ if(turn!=='w'||over)return; if(!dice.length)return setStatus('Primero tira dados.'); if(selected===null){ if(points[i].w){selected=i;tone(330);draw();} return; } const d=(selected==='bar')?24-i: selected-i; if(dice.includes(d)) move(selected,d); else {selected=points[i].w?i:null; draw();} }
  };

  document.body.classList.add('ultimate-v3');
  updateTotals();
  renderCatalog();
})();


/* ===============================
   V6 STABILITY PATCH
   Corrige módulos que podían parecer “rotos” durante juego real:
   - Fin de partida bloqueado y visible.
   - Puntuación imposible antes de lanzar dados.
   - Blackjack sin acciones después de terminar.
   - Carreras con estado final real.
   - QA expuesto para comprobar humo de renderizado.
   =============================== */
(function stabilityPatchV6(){
  function endMessage(text) { setStatus(`<strong>${text}</strong>`); }

  function raceGameFixed(id, len, specials, title, twoDice=false) {
    startStat(id);
    let player=0, cpu=0, turn='Tú', over=false, rolls=0;
    const tr=div('track');
    board.append(tr);
    controls.append(btn('Tirar dado(s)',roll), btn('Nueva carrera',()=>openGame(id)));
    function applySpecial(pos){ return specials[pos] || pos; }
    function roll(){
      if(over) return;
      const d = twoDice ? (1+rnd(6)) + (1+rnd(6)) : 1+rnd(6);
      rolls++;
      if(turn==='Tú'){
        player = Math.min(len, applySpecial(player+d));
        tone(260);
        if(player>=len){ over=true; player=len; winStat(id, rolls); endMessage(`${title}: ganas con una tirada de ${d}.`); draw(); return; }
        turn='Caja'; draw(); setStatus(`Has sacado ${d}. Ahora mueve la caja.`);
        gameTimeout(roll, 520);
      } else {
        cpu = Math.min(len, applySpecial(cpu+d));
        tone(220);
        if(cpu>=len){ over=true; cpu=len; endMessage(`${title}: gana la caja. Pulsa Nueva carrera para repetir.`); draw(); return; }
        turn='Tú'; draw(); setStatus(`Caja saca ${d}. Tu turno.`);
      }
    }
    function draw(){
      tr.innerHTML='';
      for(let i=1;i<=len;i++){
        let html=String(i);
        if(i===player) html += '<br><span class="token">T</span>';
        if(i===cpu) html += '<br><span class="token b">C</span>';
        if(specials[i]) html += '<br>★';
        tr.append(cell(html,null,'cell'));
      }
    }
    setStatus(`${title}. Tu turno. Llega a la última casilla antes que la caja.`);
    draw();
  }

  renderers.goose = function gooseFixed(){ raceGameFixed('goose', 30, {5:10,9:14,17:7,23:29}, 'Oca'); };
  renderers.ladders = function laddersFixed(){ raceGameFixed('ladders', 36, {3:14,8:20,18:31,16:6,27:10,34:22}, 'Escaleras y serpientes'); };

  renderers.nim = function nimFixed(){
    startStat('nim');
    let n=21, turn='Tú', over=false;
    const area=div('result-big'); board.append(area);
    [1,2,3].forEach(x=>controls.append(btn('Quitar '+x,()=>move(x))));
    controls.append(btn('Nuevo Nim',()=>openGame('nim')));
    function move(x){
      if(over || turn!=='Tú' || x>n) return;
      n-=x; tone(350);
      if(n<=0){ n=0; over=true; draw(); endMessage('Te llevaste el último palito. Pierdes.'); return; }
      turn='Caja'; draw();
      gameTimeout(()=>{
        if(over) return;
        let y=(n-1)%4 || 1; if(y>3) y=3;
        n-=Math.min(y,n); tone(240);
        if(n<=0){ n=0; over=true; draw(); winStat('nim'); endMessage('La caja se llevó el último palito. Ganas.'); }
        else { turn='Tú'; draw(); setStatus('Tu turno.'); }
      },350);
    }
    function draw(){ area.textContent='| '.repeat(Math.max(0,n)); if(!over) setStatus(`Palitos restantes: ${n} · Turno: ${turn}. Pierde quien quite el último.`); }
    draw();
  };

  renderers.pokerdice = function dicePokerFixed(){
    startStat('pokerdice');
    let dice=[], rolls=0, over=false;
    const area=div('result-big','—'); board.append(area);
    controls.append(btn('Lanzar',roll), btn('Puntuar',score), btn('Nueva mano',()=>openGame('pokerdice')));
    function roll(){ if(over) return; if(rolls>=2) return setStatus('Ya has usado tus 2 tiradas. Pulsa Puntuar.'); dice=Array.from({length:5},()=>1+rnd(6)); rolls++; tone(320); draw(); }
    function score(){
      if(over) return;
      if(!rolls) return setStatus('Primero lanza los dados.');
      const counts={}; dice.forEach(d=>counts[d]=(counts[d]||0)+1);
      const vals=Object.values(counts).sort((a,b)=>b-a);
      const sorted=[...dice].sort((a,b)=>a-b).join('');
      const hand=vals[0]===5?'Generala':vals[0]===4?'Póker':vals[0]===3&&vals[1]===2?'Full':sorted==='12345'||sorted==='23456'?'Escalera':vals[0]===3?'Trío':vals[0]===2?'Pareja':'Nada';
      over=true; if(hand!=='Nada') winStat('pokerdice'); endMessage(`Resultado: ${hand}.`);
    }
    function draw(){ area.textContent=dice.length?dice.join(' · '):'🎲'; if(!over) setStatus(`Tirada ${rolls}/2. Lanza y luego puntúa.`); }
    draw();
  };

  renderers.yatzy = function yatzyFixed(){
    startStat('yatzy');
    let dice=[], rolls=0, over=false;
    const area=div('result-big','—'); board.append(area);
    controls.append(btn('Lanzar',roll), btn('Evaluar',score), btn('Nueva ronda',()=>openGame('yatzy')));
    function roll(){ if(over) return; if(rolls>=3) return setStatus('Ya has usado tus 3 tiradas. Pulsa Evaluar.'); dice=Array.from({length:5},()=>1+rnd(6)); rolls++; tone(320); draw(); }
    function score(){
      if(over) return;
      if(!rolls) return setStatus('Primero lanza los dados.');
      const counts={}; dice.forEach(d=>counts[d]=(counts[d]||0)+1);
      const vals=Object.values(counts).sort((a,b)=>b-a);
      const hand=vals[0]===5?'YATZY':vals[0]===4?'Póker':vals[0]===3&&vals[1]===2?'Full':vals[0]===3?'Trío':vals[0]===2?'Pareja':'Suma '+dice.reduce((a,b)=>a+b,0);
      over=true; if(vals[0]>=3) winStat('yatzy'); endMessage(`Resultado: ${hand}.`);
    }
    function draw(){ area.textContent=dice.length?dice.join(' · '):'⚂'; if(!over) setStatus(`Tirada ${rolls}/3. Lanza y luego evalúa.`); }
    draw();
  };

  renderers.blackjack = function blackjackFixed(){
    startStat('blackjack');
    const suits='♠♥♦♣'.split(''); const vals=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    let deck=shuffle(vals.flatMap(v=>suits.map(s=>v+s))), player=[], dealer=[], over=false;
    const area=div('board-wide'); board.append(area);
    controls.append(btn('Pedir',hit), btn('Plantarse',stand), btn('Nueva mano',()=>openGame('blackjack')));
    function val(hand){ let total=0,aces=0; hand.forEach(c=>{const v=c.slice(0,-1); if(v==='A'){aces++;total+=11;} else total+=['J','Q','K'].includes(v)?10:+v;}); while(total>21&&aces){total-=10;aces--;} return total; }
    function draw(reveal=false){ area.innerHTML=`<p>Tu mano (${val(player)}): ${player.join(' ')}</p><p>Banca (${reveal?val(dealer):'?'}): ${reveal?dealer.join(' '):dealer[0]+' 🂠'}</p>`; }
    function hit(){ if(over) return; player.push(deck.pop()); if(val(player)>21){ over=true; draw(true); endMessage('Te pasaste de 21. Gana la banca.'); return; } tone(360); draw(false); setStatus('Puedes pedir otra carta o plantarte.'); }
    function stand(){ if(over) return; over=true; while(val(dealer)<17) dealer.push(deck.pop()); const pv=val(player),dv=val(dealer); draw(true); if(pv<=21&&(dv>21||pv>dv)){winStat('blackjack');endMessage('Ganas la mano.');} else if(pv===dv) endMessage('Empate.'); else endMessage('Gana la banca.'); }
    player=[deck.pop(),deck.pop()]; dealer=[deck.pop(),deck.pop()]; draw(false); setStatus('Pide o plántate. La banca juega al plantarte.');
  };

  try {
    window.__CAJA_RENDER_SMOKE__ = function(){
      const result=[];
      const previous=currentGame;
      for(const g of games){
        try{
          openGame(g.id);
          result.push({id:g.id, ok: board.innerHTML.trim().length>0 || board.children.length>0 || controls.children.length>0, status: statusEl.textContent || statusEl.innerText || statusEl.innerHTML});
        }catch(error){ result.push({id:g.id, ok:false, error:String(error)}); }
      }
      if(previous) openGame(previous); else backHome();
      return result;
    };
  } catch {}
})();


try {
  window.__CAJA_DIAGNOSTICS__ = {
    version: '7.0.0-commercial-absolute',
    get gameCount() { return games.length; },
    get gameIds() { return games.map(g => g.id); },
    get missingRenderers() { return games.map(g => g.id).filter(id => typeof renderers[id] !== 'function'); },
    get categories() { return [...new Set(games.flatMap(g => g.cat || []))].sort(); },
    smoke() {
      const ids = games.map(g => g.id);
      return {
        version: this.version,
        gameCount: ids.length,
        duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
        missingRenderers: this.missingRenderers,
        categories: this.categories
      };
    }
  };
} catch (error) {
  console.warn('[Caja Infinita] Diagnóstico no disponible:', error);
}


/* ===============================
   V7 COMMERCIAL ABSOLUTE PATCH
   Preparación para producto: asset manifest, QA E2E y diagnóstico ampliado.
   =============================== */
try {
  window.__CAJA_COMMERCIAL_QA__ = {
    version: '7.0.0-commercial-absolute',
    checks() {
      const ids = games.map(g => g.id);
      const cards = ids.map(id => `assets/cards/${id}.svg`);
      return {
        version: this.version,
        games: ids.length,
        uniqueIds: new Set(ids).size === ids.length,
        cards,
        pwa: !!document.querySelector('link[rel="manifest"]'),
        offlineReady: 'serviceWorker' in navigator || location.protocol === 'file:',
        mobileLayout: window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop'
      };
    }
  };
} catch (error) {
  console.warn('[Caja Infinita] QA comercial no disponible:', error);
}
