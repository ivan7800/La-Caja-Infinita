# Changelog

## v7.0.0 — Commercial Absolute Edition

- Añadidas 51 portadas SVG propias, una por cada juego.
- Añadido `package.json` con scripts `check`, `qa`, `e2e` y `test`.
- Añadido `browser-smoke-test.js` para prueba de navegador móvil con Chromium cuando el entorno lo permite.
- Añadido fallback de QA para entornos corporativos que bloquean `127.0.0.1`, `file:` o `data:`.
- Añadido workflow `.github/workflows/qa.yml` para GitHub Actions.
- Añadido `HUMAN_PLAYTEST_SCORECARD.md`.
- Añadido `COMMERCIAL_READINESS.md`.
- Actualizado Service Worker a caché v7 con precache de portadas.
- Reforzado responsive móvil del catálogo y tableros grandes.
- Actualizados metadatos y diagnóstico a `7.0.0-commercial-absolute`.

## v6.0.0 — Commercial QA Edition

- Corregidos Póker de Dados, Yatzy, Blackjack, Nim, Oca y Escaleras.
- Añadido autodiagnóstico QA.
- Añadidos documentos `QA_REPORT.md` y `PLAYTEST_PROTOCOL.md`.
