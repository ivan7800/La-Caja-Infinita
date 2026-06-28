# Playtest Protocol — La Caja Infinita Ultimate v7

## Objetivo

Verificar que cada juego carga, se entiende, responde a interacción básica y no deja al usuario bloqueado en móvil o escritorio.

## Checklist rápida por juego

Para cada módulo:

1. Abrir desde el catálogo.
2. Leer reglas rápidas.
3. Pulsar el control principal.
4. Hacer una interacción del tablero o entrada.
5. Reiniciar el juego.
6. Volver a la caja.
7. Comprobar que no aparece pantalla en blanco ni mensaje de error controlado.
8. Puntuar diversión y claridad en `HUMAN_PLAYTEST_SCORECARD.md`.

## Pruebas críticas

### Póker de Dados

- Pulsar **Puntuar** antes de lanzar.
- Resultado esperado: debe pedir lanzar primero.
- Lanzar una vez y puntuar.
- Resultado esperado: muestra resultado y cierra la mano.

### Generala / Yatzy

- Pulsar **Evaluar** antes de lanzar.
- Resultado esperado: debe pedir lanzar primero.
- Lanzar y evaluar.
- Resultado esperado: muestra resultado y cierra la ronda.

### Blackjack

- Pedir cartas hasta pasarse o plantarse.
- Resultado esperado: al terminar, las acciones ya no cambian la mano.
- Verificar que la banca aparece oculta hasta plantarse.

### Nim

- Quitar palitos hasta final.
- Resultado esperado: el mensaje de victoria/derrota permanece visible.

### Carreras

- Jugar Oca o Escaleras hasta que alguien llegue al final.
- Resultado esperado: después del final no se puede seguir tirando en la misma partida.

### Ajedrez

- Hacer un movimiento legal de peón.
- Intentar un movimiento ilegal.
- Comprobar que no se permite dejar el rey en jaque.
- Verificar que el modo contra la caja responde.

### Backgammon

- Tirar dados.
- Seleccionar ficha propia.
- Mover según dado disponible.
- Comprobar que la barra y las fichas fuera se actualizan.

## Comandos técnicos

```bash
npm test
node qa-self-test.js
node browser-smoke-test.js
```

## Criterio de aceptación

La versión se considera lista para GitHub si:

- `npm test` termina con código 0.
- Los 51 juegos abren.
- Las 51 portadas SVG existen.
- No hay IDs duplicados.
- No hay renderizadores faltantes.
- No hay módulos sin interfaz útil.
- En móvil, el tablero no rompe el layout general.
- El usuario siempre puede volver a la caja.
- Ningún tester reporta pantalla en blanco en dos rondas consecutivas.
