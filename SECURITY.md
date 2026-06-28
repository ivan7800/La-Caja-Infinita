# Security

La Caja Infinita Ultimate v7 es una app web estática pensada para GitHub Pages.

## Superficie de riesgo

- No hay backend.
- No hay login.
- No hay base de datos remota.
- No se envían datos a servidores externos.
- El progreso se guarda en `localStorage` del navegador.

## Recomendaciones

- Publicar siempre por HTTPS mediante GitHub Pages.
- No añadir scripts externos sin revisar origen y permisos.
- No convertir el progreso local en cuentas online sin añadir política de privacidad y control de datos.
- Mantener `npm test` en GitHub Actions antes de publicar cambios.

## Reporte de fallos

Abrir un issue indicando:

- Dispositivo.
- Navegador.
- Juego afectado.
- Pasos para reproducir.
- Captura si es posible.
