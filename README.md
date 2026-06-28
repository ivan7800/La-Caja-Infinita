# La Caja Infinita Ultimate v7 — Commercial Absolute Edition

Caja de juegos reunidos en app web, preparada para GitHub Pages, con estética retro/premium, 51 juegos o módulos jugables, progreso local, temas, sonido, logros, PWA offline, portadas SVG propias y QA automatizado.

## Qué incluye

- 51 juegos/módulos jugables.
- 51 portadas SVG propias en `assets/cards/`.
- Interfaz nostálgica tipo caja de juegos antigua.
- Pantalla de arranque tipo tele antigua.
- Buscador y filtros por categoría.
- Sonido retro generado en navegador.
- Temas visuales.
- Estadísticas locales.
- Logros.
- Botón **QA** con autodiagnóstico.
- `qa-self-test.js` para comprobar que todos los juegos abren y renderizan interfaz útil.
- `browser-smoke-test.js` para smoke/E2E móvil con Chromium cuando el entorno lo permite.
- GitHub Actions en `.github/workflows/qa.yml`.
- `manifest.json` y `sw.js` para funcionamiento PWA en GitHub Pages.
- Sin backend, sin login, sin rastreo y sin dependencias externas de ejecución.

## Juegos destacados

- Ajedrez completo con jaque, mate, ahogado, enroque, promoción, en passant e IA local ligera.
- Damas con capturas obligatorias, coronación e IA.
- Reversi/Othello con IA.
- Parchís 4 colores con casa, seguros, capturas y CPU.
- Backgammon con puntos, barra, entrada y retirada.
- Sudoku, Nonogramas, Kakuro, Futoshiki, Rascacielos, Memory, Solitarios, Trivial, Pasapalabra, Sopa de letras, Crucigrama mini y más.

## Publicar en GitHub Pages

1. Sube todos los archivos a la raíz del repositorio.
2. En GitHub, entra en **Settings → Pages**.
3. Selecciona la rama `main` y carpeta `/root`.
4. Abre la URL publicada.
5. Pulsa **QA** dentro de la app.

## Validación local

```bash
npm test
```

También puedes ejecutar por separado:

```bash
node --check app.js
node qa-self-test.js
node browser-smoke-test.js
```

Resultado esperado:

- Sintaxis OK.
- 51 juegos encontrados.
- 51 portadas SVG encontradas.
- 0 aperturas fallidas.
- 0 IDs duplicados.
- 0 renderizadores faltantes.
- 0 módulos sin interfaz útil.

## Documentación incluida

- `QA_REPORT.md`: auditoría técnica y puntuación.
- `PLAYTEST_PROTOCOL.md`: protocolo manual de pruebas.
- `HUMAN_PLAYTEST_SCORECARD.md`: plantilla para testers humanos.
- `COMMERCIAL_READINESS.md`: estado real de producto.
- `SECURITY.md`: notas de seguridad.
- `CHANGELOG.md`: historial de cambios.

## Nota honesta

Esta versión cierra todo lo automatizable dentro de una app estática offline. Para llamarla 10/10 comercial absoluto en sentido estricto todavía haría falta playtesting humano real durante días/semanas y, si el objetivo fuera competición, motores especializados externos para ajedrez/backgammon. Para GitHub, portfolio y demo pública, esta versión está lista.
