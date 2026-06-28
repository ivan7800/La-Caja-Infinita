'use strict';
const CACHE_NAME = 'la-caja-infinita-v7-cache';
const CORE_ASSETS = ['./', './index.html', './styles.css', './app.js', './manifest.json', './assets/box-cover.svg'];
const CARD_ASSETS = [
  './assets/cards/tictactoe.svg',
  './assets/cards/connect4.svg',
  './assets/cards/memory.svg',
  './assets/cards/simon.svg',
  './assets/cards/dice.svg',
  './assets/cards/coin.svg',
  './assets/cards/rps.svg',
  './assets/cards/goose.svg',
  './assets/cards/ladders.svg',
  './assets/cards/battleship.svg',
  './assets/cards/mines.svg',
  './assets/cards/mastermind.svg',
  './assets/cards/twenty48.svg',
  './assets/cards/hangman.svg',
  './assets/cards/checkers.svg',
  './assets/cards/domino.svg',
  './assets/cards/chess.svg',
  './assets/cards/parchis.svg',
  './assets/cards/reversi.svg',
  './assets/cards/go.svg',
  './assets/cards/backgammon.svg',
  './assets/cards/nim.svg',
  './assets/cards/hanoi.svg',
  './assets/cards/fifteen.svg',
  './assets/cards/lightsout.svg',
  './assets/cards/peg.svg',
  './assets/cards/sudoku.svg',
  './assets/cards/killer.svg',
  './assets/cards/futoshiki.svg',
  './assets/cards/skyscrapers.svg',
  './assets/cards/nonogram.svg',
  './assets/cards/kakuro.svg',
  './assets/cards/wordsearch.svg',
  './assets/cards/crossword.svg',
  './assets/cards/wordle.svg',
  './assets/cards/anagrams.svg',
  './assets/cards/trivia.svg',
  './assets/cards/pasapalabra.svg',
  './assets/cards/blackjack.svg',
  './assets/cards/pokerdice.svg',
  './assets/cards/bingo.svg',
  './assets/cards/yatzy.svg',
  './assets/cards/solitaire.svg',
  './assets/cards/freecell.svg',
  './assets/cards/spider.svg',
  './assets/cards/dots.svg',
  './assets/cards/sos.svg',
  './assets/cards/bulls.svg',
  './assets/cards/maze.svg',
  './assets/cards/flood.svg',
  './assets/cards/math.svg'
];
const ASSETS = [...CORE_ASSETS, ...CARD_ASSETS];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
    return response;
  }).catch(() => caches.match('./index.html'))));
});
