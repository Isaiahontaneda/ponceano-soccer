# Pruebas manuales — Fase B (el cliente reserva) y Fase C (ingresos)

## Antes de empezar

1. Ejecuta `npm run dev` y abre <http://localhost:3000>.
2. Entra como administrador y, en **Usuarios**, crea dos clientes (**Cliente A** y **Cliente B**) y un recepcionista.
3. Comprueba en **Tarifas** que existe la tarifa base.

Para las pruebas que llaman a la API directamente, inicia sesión con el usuario indicado, abre la consola del
navegador (F12 → Consola) y pega el código. Cada ejemplo imprime el código de respuesta y el cuerpo.

## A. El cliente inicia sesión y reserva

| # | Paso | Resultado esperado |
| --- | --- | --- |
| 1 | Sin sesión, abre `/reservar`. | Redirige a `/login`. |
| 2 | Inicia sesión como Cliente A. | Llega a `/reservar`. Ve su nombre y el botón "Cerrar sesión", sin menú. |
| 3 | Con la sesión del Cliente A, abre `/admin`. | Redirige a `/reservar`. |
| 4 | Mira el campo de fecha. | Trae la fecha de hoy y no deja elegir días anteriores. |
| 5 | Mira los bloques de hoy. | Las horas que ya pasaron dicen "Pasado" y están deshabilitadas. |
| 6 | Elige una fecha futura y pulsa un bloque libre. | Aparece "Precio por hora" con el precio final (desde el Core v2, el cliente no ve el desglose). |
| 7 | Pulsa "Reservar". | Mensaje "Reserva R-…: Pendiente de confirmación." La reserva aparece en "Mis reservas" como Pendiente. |
| 8 | Mira el bloque que acabas de reservar. | Dice "Ocupado" y está deshabilitado. |
| 9 | Compara el precio de la tabla con el de la Calculadora del panel (mismo cliente, fecha y hora). | Es el mismo. |

## B. El cliente cancela

| # | Paso | Resultado esperado |
| --- | --- | --- |
| 10 | En "Mis reservas", pulsa "Cancelar" en una pendiente y luego "Cancelar" en la ventana. | No cambia nada. |
| 11 | Pulsa "Cancelar" y luego "Aceptar". | Mensaje "Reserva R-…: cancelada." El estado pasa a Cancelada y el bloque vuelve a estar libre. |
| 12 | Mira una reserva Confirmada o Cancelada. | No tiene botón "Cancelar". |
| 13 | Con el Cliente A y sin reservas: mira "Mis reservas". | "Todavía no tienes reservas." |

## C. El personal confirma

| # | Paso | Resultado esperado |
| --- | --- | --- |
| 14 | Inicia sesión como recepcionista. | Llega a `/admin`. |
| 15 | En **Reservas**, elige la fecha de una reserva hecha por el Cliente A. | La reserva aparece con el nombre del cliente y en Pendiente. |
| 16 | Pulsa "Confirmar" y acepta. | Pasa a Confirmada. |
| 17 | Vuelve a entrar como Cliente A. | La reserva aparece Confirmada y sin botón "Cancelar". |

## D. Seguridad

| # | Paso | Resultado esperado |
| --- | --- | --- |
| 18 | Como Cliente A, ejecuta el **código 1**. | Las cuatro rutas responden 403. |
| 19 | Como recepcionista, ejecuta el **código 2**. | 403. |
| 20 | Como Cliente B, crea una reserva y anota su id (**código 3**). Luego, como Cliente A, ejecuta el **código 4** con ese id. | 404 "La reserva no existe". Como Cliente B, la reserva sigue Pendiente. |
| 21 | Como Cliente A, ejecuta el **código 5** (manda `clienteId` ajeno, `precio: 0.01` y `estado: "CONFIRMADA"`). | 201. La reserva queda a nombre del Cliente A, con el precio del Core y en `PENDIENTE`. |
| 22 | Como Cliente A, crea reservas hasta tener 3 pendientes e intenta una cuarta. | 409 "Ya tienes 3 reservas pendientes. Espera a que el local las confirme o cancela una." |
| 23 | Como Cliente B, ejecuta el **código 5** con una fecha y hora que ya reservó el Cliente A. | 409 "Ese horario ya está reservado". |
| 24 | Como Cliente A, ejecuta el **código 5** con una fecha pasada (por ejemplo `2020-01-01`). | 422 "No se puede reservar en una fecha pasada." |
| 25 | Como Cliente A, ejecuta el **código 4** con `estado: "CONFIRMADA"` sobre una reserva propia. | 422. La reserva no cambia. |
| 26 | Cierra la sesión y abre `/reservar`. | Redirige a `/login`. |

### Código 1 — rutas del personal con sesión de cliente

```js
for (const ruta of ["/api/reservas", "/api/usuarios", "/api/tarifas", "/api/reportes/ingresos?desde=2026-11-01&hasta=2026-11-30"]) {
  const r = await fetch(ruta);
  console.log(ruta, r.status);
}
```

### Código 2 — ingresos con sesión de recepcionista

```js
const r = await fetch("/api/reportes/ingresos?desde=2026-11-01&hasta=2026-11-30");
console.log(r.status, await r.json());
```

### Código 3 — ver mis reservas (para anotar el id)

```js
const r = await fetch("/api/mis-reservas");
console.table((await r.json()).reservas);
```

### Código 4 — cancelar una reserva por id

```js
const id = 123; // cambia por el id de la reserva
const r = await fetch(`/api/mis-reservas/${id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ estado: "CANCELADA" }),
});
console.log(r.status, await r.json());
```

### Código 5 — reservar mandando datos que el servidor debe ignorar

```js
const r = await fetch("/api/mis-reservas", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fecha: "2026-12-05", // cambia por una fecha futura
    horaInicio: "19:00",
    clienteId: "00000000-0000-4000-8000-000000000000", // ajeno: se ignora
    precio: 0.01, // se ignora
    estado: "CONFIRMADA", // se ignora
  }),
});
console.log(r.status, await r.json());
```

## E. Reporte de ingresos

| # | Paso | Resultado esperado |
| --- | --- | --- |
| 27 | Como recepcionista, mira el menú. | No aparece "Ingresos". |
| 28 | Como administrador, abre **Ingresos**. | Rango por defecto: del día 1 del mes actual hasta hoy, agrupado por día. |
| 29 | Mira las tres tarjetas. | "Total esperado" es la suma de "Ingresos confirmados" y "Pendientes por confirmar". |
| 30 | Compara la tabla con las reservas del rango. | Cada día muestra cantidad y monto de confirmadas y pendientes. Las canceladas no aparecen. La fila "Total" coincide con las tarjetas. |
| 31 | Cambia a "Mes" y pulsa "Consultar". | Una fila por mes, con los mismos totales. |
| 32 | Confirma una reserva pendiente del rango y vuelve a consultar. | Su monto pasa de "Pendientes" a "Confirmados"; el total esperado no cambia. |
| 33 | Elige un rango sin reservas. | "No hay reservas en este rango." |
| 34 | Pon "Desde" posterior a "Hasta". | Error "La fecha «desde» no puede ser posterior a la fecha «hasta»." |
| 35 | Elige un rango de más de 366 días. | Error "El rango no puede pasar de 366 días." |

## F. Lo que no debe cambiar

| # | Paso | Resultado esperado |
| --- | --- | --- |
| 36 | Como recepcionista, crea una reserva desde **Reservas** eligiendo un cliente. | Funciona igual que antes: mismo mensaje y mismo precio. |
| 37 | Intenta crear otra en el mismo horario. | "Ese horario ya está reservado". |
