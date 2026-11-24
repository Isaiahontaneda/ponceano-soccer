# Plan — Core v2 (reglas + historial + rangos publicados)

Rama: `core-historico`, creada desde `cliente-e-ingresos` (la rama con el trabajo más reciente).

## Orden de trabajo

1. **Configuración** — `backend/configuracion.js`: inicio del sistema, meses de invierno, semanas de historial,
   umbrales, ajustes y `RANGOS_PRECIO`. `backend/fechas.js`: `temporadaDe(fecha)`.
2. **Core** — `backend/core/calcularPrecio.js`, partido en funciones cortas, una por etapa:
   - Etapa 1: `aplicarReglasTarifas` (`tarifas.forEach`, comparaciones 1–3).
   - Etapa 2: `clasificarDemanda`, `decidirAjusteDemanda` y `contrastarHistorial` (`historiales.forEach`,
     comparaciones 4–5).
   - Etapa 3: `aplicarRango`.
   - Etapa 4 y redondeo único: `calcularPrecio`.
   - Desglose por etapas: `armarDesglose`.
3. **Servicio** — `backend/core/servicioPrecio.js`: `cargarHistorialAntiguo`, `cargarHistorialActual` y
   `calcularPrecioReserva` con los cuatro datos en paralelo.
4. **Controladores** — `backend/controladores/precio/calcular.js` (el cliente recibe solo `{ precio }`) y el nuevo
   `backend/controladores/precio/rangos.js` (`GET /api/precios/rangos`).
5. **Pantallas** — `Calculadora.js` por etapas; `Reservar.js` solo con el precio; nuevo componente
   `TarifasEstandar.js` en `/reservar` y en la portada del panel.
6. **Migración** — `supabase/migraciones/002_reservas_recientes_demo.sql` (se escribe, no se ejecuta).
7. **Pruebas** — `tests/core.test.js` (tablas de la sección 5), `tests/historial.test.js`, `tests/fechas.test.js`.
8. **Documentación** — `docs/core.md`, `README.md` (Core, Seguridad y pasos de migración) y
   `docs/informe-core-v2.md`.

Un commit por paso. Al final: `npm run lint`, `npm run build` y `npm test`.
