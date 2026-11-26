# Informe — Reglas de fidelidad del cliente (Core v3)

Rama `reglas-cliente`, creada desde `core-historico` (el Core v2 todavía no estaba en `main`).

## 1. Archivos creados y modificados

**Creados**

| Archivo | Para qué |
| --- | --- |
| `docs/plan-reglas-cliente.md` | Plan corto de trabajo. |
| `backend/core/beneficiosCliente.js` | Funciones puras: `contarReservasCliente` (sellos), `describirRegla`, `resumirBeneficios`. |
| `backend/modelo/reglasCliente.js` | `cargarReglasConTipo` (mismo patrón que `cargarTarifasConTipo`). |
| `backend/validaciones/reglaCliente.js` | Validación pura del CRUD (`validarReglaCliente`, `errorCambioTipo`). |
| `backend/controladores/reglasCliente/reglasCliente.js` | `GET` y `POST /api/reglas-cliente`. |
| `backend/controladores/reglasCliente/reglaClientePorId.js` | `PUT` y `DELETE /api/reglas-cliente/[id]`. |
| `backend/controladores/tiposReglaCliente.js` | `GET /api/tipos-regla-cliente`. |
| `backend/controladores/misBeneficios.js` | `GET /api/mis-beneficios`. |
| `app/api/reglas-cliente/route.js`, `app/api/reglas-cliente/[id]/route.js`, `app/api/tipos-regla-cliente/route.js`, `app/api/mis-beneficios/route.js` | Rutas de una línea. |
| `app/admin/reglas-cliente/layout.js`, `app/admin/reglas-cliente/page.js` | Página `/admin/reglas-cliente`. |
| `frontend/paginas/ReglasCliente.js` | Pantalla del CRUD. |
| `supabase/migraciones/004_retirar_cliente_frecuente.sql` | Migración escrita, **no ejecutada**. |
| `tests/beneficios.test.js`, `tests/reglaCliente.test.js` | Pruebas nuevas. |
| `docs/informe-reglas-cliente.md` | Este informe. |

**Modificados**

| Archivo | Cambio |
| --- | --- |
| `backend/core/calcularPrecio.js` | Sin `CLIENTE_FRECUENTE`; comparaciones renumeradas 1–5; etapa 4 con `reglasCliente.forEach`; salida `beneficios`. |
| `backend/core/servicioPrecio.js` | `cargarReglasCliente`, `cargarReservasCliente`, `cargarDatosCliente`; todo en paralelo; se eliminó `contarReservasConfirmadas`. |
| `backend/configuracion.js` | Sin `DIAS_HISTORIAL_CLIENTE`; límites de las reglas del cliente. |
| `backend/fechas.js` | `diasEntre(desde, hasta)`. |
| `backend/modelo/reservas.js` | `crearReserva` guarda `reglaClienteId` y `descuento`. |
| `backend/controladores/precio/calcular.js` | El cliente recibe solo `{ precio, beneficio }`. |
| `backend/controladores/misReservas.js` | Cada reserva trae `descuento` y el nombre del beneficio. |
| `backend/validaciones/tarifa.js` | Sin el grupo ni la validación de cliente frecuente. |
| `frontend/paginas/Calculadora.js` | Etapa 4 regla por regla; historial como comparaciones 3 y 4. |
| `frontend/paginas/Reservar.js` | "Tus beneficios", beneficio junto al precio y columna Descuento en Mis reservas. |
| `frontend/paginas/Tarifas.js` | El dropdown ya no ofrece `CLIENTE_FRECUENTE` y la tabla oculta esas tarifas viejas. |
| `frontend/componentes/PanelAdmin.js`, `frontend/paginas/Portada.js` | Enlace y módulo "Reglas de cliente" (solo administrador). |
| `frontend/componentes/TarifasEstandar.js` | Texto sin "clientes frecuentes". |
| `tests/core.test.js`, `tests/datos.js`, `tests/historial.test.js`, `tests/fechas.test.js` | Tabla 3.2, reglas iniciales y `diasEntre`. |
| `docs/core.md`, `README.md` | Documentación del Core v3, roles, seguridad y migraciones. |

## 2. Salida real de las verificaciones

```
$ npm run lint
> eslint
(sin errores ni advertencias)

$ npm run build
✓ Compiled successfully in 587ms
✓ Generating static pages using 19 workers (29/29) in 736ms
(rutas nuevas: /admin/reglas-cliente, /api/mis-beneficios, /api/reglas-cliente, /api/reglas-cliente/[id],
 /api/tipos-regla-cliente)

$ npm test
ℹ tests 103
ℹ pass 103
ℹ fail 0
```

Los 14 precios de la sección 3.2 coinciden con la tabla del documento; no hubo que cambiar ningún valor esperado.

## 3. Desviaciones respecto al documento

1. **Firma del Core.** `reglasCliente` entra como tercer parámetro (`calcularPrecio(reserva, tarifas, reglasCliente)`),
   igual que `tarifas`, y `cliente` dentro del objeto de la reserva. Es el cambio más pequeño sobre la firma anterior.
2. **`cargarDatosCliente` lee las reglas por su cuenta** (para saber qué ids son de tarjeta de sellos), así las cinco
   cargas de `calcularPrecioReserva` siguen en un solo `Promise.all`. Cuesta una lectura extra de una tabla de 4 filas.
3. **El conteo de sellos se hace en JavaScript** (`contarReservasCliente`, función pura y probada), sobre las reservas
   no canceladas del cliente, en lugar de dos consultas separadas. Es más fácil de probar y hace lo mismo.
4. **La respuesta de personal incluye `cliente`** (lo que contó el servidor) para que la Calculadora muestre de dónde
   sale cada motivo. El cliente nunca lo recibe.
5. **El 409 de "una regla activa por tipo"** se decide en la validación pura, que devuelve `conflicto` aparte de
   `errores` (422).
6. **Borrar una regla** no consulta antes las reservas: se intenta el `delete` y el error 23503 de la llave foránea se
   traduce a 409. Es la opción que pide el documento y evita una carrera entre la consulta y el borrado.
7. **Tarifas `CLIENTE_FRECUENTE` viejas:** además de no ofrecerse en el dropdown, se ocultan en la tabla de tarifas
   hasta que la 004 las borre (editarlas fallaría con "Tipo de tarifa no reconocido").
8. **Columnas de `reservas`:** se asume que `reservas` tiene `fechaCreacion` (el documento la usa para ordenar). La
   migración 003 no está en el repositorio, así que no pude comprobar los nombres exactos contra el SQL.

## 4. Limitaciones conocidas

- **Sello usado dos veces por concurrencia:** dos peticiones simultáneas del mismo cliente podrían usar el mismo
  sello, porque la consulta (contar sellos) y la inserción de la reserva no son atómicas. El tope de 3 pendientes
  limita el daño; la solución completa sería una función SQL con bloqueo.
- **Bienvenida y registro público:** la bienvenida depende de que las cuentas las cree el administrador. Con
  registro público, cualquiera podría crear cuentas nuevas para repetir el 10 %; habría que revisarla.
- **Formato de `fechaCreacion`:** el último sello se busca comparando `fechaCreacion` como texto, que funciona porque
  la base la devuelve siempre en UTC con el mismo formato.
- **Las reglas usadas no se pueden borrar**, solo desactivar (es lo esperado por `ON DELETE RESTRICT`).

## 5. Pasos para el usuario

1. Agrega `supabase/migraciones/003_reglas_cliente.sql` al repositorio (ya la ejecutaste en Supabase).
2. Despliega el código nuevo. **Después**, ejecuta `004_retirar_cliente_frecuente.sql` en el SQL Editor. Si se
   ejecuta antes, el sitio en producción (código viejo) pierde el descuento de cliente frecuente. El `select` final
   debe mostrar solo tarifas de tipo base, franja, día de la semana y fecha especial.
3. Crea un cliente nuevo en **Usuarios** para probar la bienvenida.
4. Qué ver en cada caso de demostración (detalle en `docs/core.md`, sección 4):
   - **Cliente nuevo:** Calculadora → etapa 4, "Reservas previas: 0" y "Bienvenida: Aplica (se usa esta)". Precio
     $36.00 un lunes a las 10:00 con pocos días de anticipación.
   - **Cliente con 3 confirmadas:** "Tarjeta de sellos: Aplica (se usa esta)", $34.00. Al reservar, la tarjeta vuelve
     a 0; si se cancela esa reserva, el sello vuelve.
   - **7 días de anticipación:** sábado a las 19:00 a 7 días, "Reserva anticipada: Aplica", $47.50 (con 6 días, $50.00).
   - **Mañana vacía:** lunes a las 09:00, "Horario valle: Aplica" si la etapa 2 dice demanda baja; $34.20 o $31.50.
   - **Cliente con `fetch`:** la respuesta de `/api/precio/calcular` trae solo `precio` y `beneficio`.
   - **Recepcionista:** no ve "Reglas de cliente" en el menú y `/api/reglas-cliente` le responde 403.
