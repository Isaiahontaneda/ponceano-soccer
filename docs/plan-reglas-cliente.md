# Plan — Reglas de fidelidad del cliente (Core v3)

Rama: `reglas-cliente`, creada desde `core-historico` (el Core v2 todavía no está en `main`).

## Orden de trabajo

1. **Core** — `backend/core/calcularPrecio.js`: se quita `CLIENTE_FRECUENTE` del `switch`, se renumeran las
   comparaciones (1 franja, 2 calendario, 3 historial antiguo, 4 historial actual) y se agrega la etapa 4,
   `evaluarBeneficios` (`reglasCliente.forEach`, comparación 5, solo el mayor descuento).
   `backend/fechas.js`: `diasEntre(desde, hasta)`. `backend/configuracion.js`: se quita `DIAS_HISTORIAL_CLIENTE` y se
   agregan los límites de las reglas del cliente.
2. **Servicio** — `backend/modelo/reglasCliente.js` (`cargarReglasConTipo`, como `cargarTarifasConTipo`),
   `backend/core/beneficiosCliente.js` (funciones puras: contar sellos y describir reglas) y
   `backend/core/servicioPrecio.js` (`cargarReglasCliente`, `cargarDatosCliente`; se elimina
   `contarReservasConfirmadas`). `backend/modelo/reservas.js` guarda `reglaClienteId` y `descuento`.
3. **API de precio y del cliente** — `backend/controladores/precio/calcular.js` (el cliente recibe
   `{ precio, beneficio }`), nueva `GET /api/mis-beneficios` y descuento en `GET /api/mis-reservas`.
4. **CRUD de reglas** — `backend/validaciones/reglaCliente.js`, controladores `tiposReglaCliente.js` y
   `reglasCliente/{reglasCliente,reglaClientePorId}.js`, y sus rutas en `app/api/`.
5. **Tarifas** — se retira `CLIENTE_FRECUENTE` de `backend/validaciones/tarifa.js`, de `Tarifas.js` (el dropdown no
   lo ofrece) y de los textos.
6. **Pantallas** — nueva `frontend/paginas/ReglasCliente.js` (`/admin/reglas-cliente`), enlace en `PanelAdmin.js` y
   en la portada; etapa 4 en `Calculadora.js`; "Tus beneficios" y descuento en `Reservar.js`.
7. **Migración** — `supabase/migraciones/004_retirar_cliente_frecuente.sql` (se escribe, no se ejecuta).
8. **Pruebas** — `tests/core.test.js` (tabla 3.2), `tests/beneficios.test.js`, `tests/reglaCliente.test.js`,
   `tests/fechas.test.js`.
9. **Documentación** — `docs/core.md`, `README.md` y `docs/informe-reglas-cliente.md`.

Un commit por paso. Al final: `npm run lint`, `npm run build` y `npm test`.
