# El Core de precios (v3): dónde está cada cosa y cómo demostrarlo

> **Aclaración:** los datos históricos (`historialReservas`, 3 años) y las reservas recientes de la migración 002 son
> **simulados para la demostración**. Los umbrales de demanda son un criterio del negocio, no un cálculo estadístico.

## 1. Mapa rápido

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| **Core** | `backend/core/calcularPrecio.js` | Función pura: 4 etapas y 5 comparaciones. |
| Parámetros | `backend/configuracion.js` (l. 30–74) | Umbrales, ajustes, semanas de historial, temporadas, `RANGOS_PRECIO` y límites de las reglas del cliente. |
| Fechas | `backend/fechas.js` | `temporadaDe` (l. 67) y `diasEntre` (l. 41, días de anticipación). |
| Servicio | `backend/core/servicioPrecio.js` | Lee tarifas, los 2 historiales, las reglas del cliente y los datos del cliente, y llama al Core. |
| Apoyo de beneficios | `backend/core/beneficiosCliente.js` | Funciones puras: contar sellos, describir reglas y armar "Tus beneficios". |
| API de precio | `backend/controladores/precio/calcular.js` | El personal recibe el cálculo completo; el cliente, solo `{ precio, beneficio }` (l. 17–20 y 75). |
| API de beneficios | `backend/controladores/misBeneficios.js` | `GET /api/mis-beneficios`: sellos y reglas activas del cliente de la sesión. |
| CRUD de reglas | `backend/controladores/reglasCliente/`, `backend/validaciones/reglaCliente.js` | Solo administrador. |
| Calculadora | `frontend/paginas/Calculadora.js` | Muestra el cálculo etapa por etapa, con la etapa 4 regla por regla. |
| Pruebas | `tests/core.test.js`, `tests/beneficios.test.js`, `tests/reglaCliente.test.js`, `tests/historial.test.js`, `tests/fechas.test.js` | Sin base de datos. |

```
Navegador ── POST { fecha, horaInicio, clienteId? } ──▶ calcular.js
                                                          │
servicioPrecio.js (en paralelo): tarifas + historial antiguo + historial actual + reglas del cliente + datos del cliente
                                                          │
calcularPrecio.js (CORE)
   ETAPA 1  tarifas.forEach        comparaciones 1, 2   subtotal = base × (1 + recargos)
   ETAPA 2  historiales.forEach    comparaciones 3, 4   ajustado = subtotal × (1 + ajuste)
   ETAPA 3  rango de la franja                          acotado  = ajustado limitado a [mín, máx]
   ETAPA 4  reglasCliente.forEach  comparación 5        precio   = acotado × (1 − mayor descuento)
                                                          │
calcular.js ── personal: todo el resultado · cliente: { precio, beneficio }
```

## 2. El Core, línea por línea (`backend/core/calcularPrecio.js`)

| Qué | Líneas |
| --- | --- |
| Cabecera con las 4 etapas | 1–14 |
| Escalas enteras (centavos × 10³, × 10⁶, × 10⁹) | 37–39 |
| `dividirRedondeando` (redondeo con la mitad hacia arriba, solo enteros) | 55–58 |
| **Etapa 1:** `aplicarReglasTarifas` | 63–100 |
| `tarifas.forEach` | 68 |
| COMPARACIÓN 1: franja horaria (`hora >= horaInicio && hora <= horaFin`) | 75–79 |
| COMPARACIÓN 2: día de la semana (`dia === tarifa.diaSemana`) | 83–84 |
| COMPARACIÓN 2: fecha especial (`fecha === tarifa.fecha`) | 88–89 |
| `default`: se ignoran tipos desconocidos (incluidas las tarifas `CLIENTE_FRECUENTE` viejas) | 92–95 |
| **Etapa 2:** `clasificarDemanda` (nivel de un historial) | 107–112 |
| Promedios en diezmilésimas (sin errores de coma flotante) | 116–123 |
| `decidirAjusteDemanda` (regla de decisión) | 128–145 |
| `contrastarHistorial`, con `historiales.forEach` | 148–164 |
| COMPARACIÓN 3 (antiguo) y COMPARACIÓN 4 (actual) | 151–157 |
| **Etapa 3:** `aplicarRango` | 170–200 |
| **Etapa 4:** `reglaVigente` (vigencia en la fecha de la reserva) | 207–211 |
| `cumpleCondicion` (condición de cada tipo de regla) | 217–242 |
| `evaluarRegla` (activa + vigente + condición) | 245–249 |
| `elegirMayorDescuento` (solo el mayor; en empate, el menor `id`) | 252–261 |
| `evaluarBeneficios`, con `reglasCliente.forEach` | 264–285 |
| COMPARACIÓN 5 | 269–274 |
| `armarDesglose` (desglose ordenado por etapa) | 291–320 |
| **Función principal `calcularPrecio`** | 350 |
| Etapa 1: reglas y subtotal | 357–362 |
| Etapa 2: ajuste por demanda | 365–366 |
| Etapa 3: rango | 369 |
| Etapa 4: beneficios | 372–376 |
| Descuento, control de enteros seguros y **único redondeo** | 381–383 |
| Salida (incluye `beneficios: { evaluadas, aplicada }`) | 385–397 |

### Etapa 1: reglas de tarifas
`tarifas.forEach` y un `switch` por tipo de tarifa. Los recargos de franja y de calendario se suman. El tipo
`CLIENTE_FRECUENTE` ya no existe en el `switch`: si quedan tarifas de ese tipo en la base, caen en el `default` y se
ignoran hasta que la migración 004 las borre.

### Etapa 2: historial de demanda
El servicio entrega una lista con **dos** historiales:

| Historial | De dónde sale | Muestras |
| --- | --- | --- |
| **ANTIGUO**, "Historial 3 años (misma temporada)" | Vista `ocupacionHistorica`: mismo día de la semana, hora y temporada (`servicioPrecio.js`, l. 16–33). Si no hay fila, la ocupación es 0: nunca hubo reservas en ese bloque. | Días posibles |
| **ACTUAL**, "Últimas semanas" | Reservas `CONFIRMADA` de las 8 semanas anteriores (mismo día y hora). Solo cuentan las fechas que ya pasaron y desde el 2026-11-01 (`servicioPrecio.js`, l. 37–54). Con menos de 2 semanas, `ocupacion: null`. | Semanas |

Comparaciones 3 y 4 (una por historial, dentro de `historiales.forEach`):

| Nivel | Condición |
| --- | --- |
| ALTA | ocupación ≥ 0.70 |
| BAJA | ocupación ≤ 0.25 |
| NORMAL | En medio |
| SIN_DATOS | ocupación `null` |

**Regla de decisión** (`decidirAjusteDemanda`). Ningún dato aislado cambia el precio: hace falta que el pasado
lejano y el reciente **coincidan**.

| Antiguo | Actual | Ajuste | Motivo |
| --- | --- | --- | --- |
| ALTA | ALTA | +10 % si el promedio es ≥ 0.85 (demanda muy alta); si no, +5 % | "Ambos historiales muestran demanda muy alta / alta" |
| BAJA | BAJA | −12.5 % si el promedio es ≤ 0.15; si no, −5 % | "Ambos historiales muestran demanda muy baja / baja" |
| Alguno SIN_DATOS | | 0 % | "Historial insuficiente: no se ajusta" |
| Cualquier otra combinación | | 0 % | "Los historiales no coinciden: no se ajusta" |

¿Por qué −12.5 %? Porque 40 × 0.875 = 35, justo el mínimo publicado de la mañana.

### Etapa 3: rango publicado
Las franjas de **rango** no son las franjas de **tarifa**: las de tarifa (Día, Hora pico, Noche) deciden el
recargo, y las de rango solo ponen los límites del precio.

| Franja de rango | Horas | Mínimo | Máximo | Máximo con demanda muy alta |
| --- | --- | --- | --- | --- |
| Mañana | 08:00–11:59 | $35 | $40 | $40 |
| Tarde | 12:00–17:59 | $38 | $45 | $45 |
| Noche | 18:00–23:59 | $45 | $50 | **$55** |

### Etapa 4: beneficios del cliente
El Core recibe `reglasCliente` (todas, sin filtrar: así la Calculadora puede explicar por qué una no aplicó) y
`cliente`, que prepara el servicio (`cargarDatosCliente`, `servicioPrecio.js` l. 76–82):

| Dato | Cómo se cuenta |
| --- | --- |
| `reservasPrevias` | Reservas del cliente que no están canceladas, en cualquier estado. |
| `confirmadasDesdeUltimoSello` | Reservas `CONFIRMADA` creadas después de la última reserva no cancelada que usó un sello (o todas, si nunca usó uno). Una reserva **pendiente** con sello ya cuenta como "usado"; si se cancela, el sello vuelve (`beneficiosCliente.js`, l. 7–25). |
| `diasAnticipacion` | `diasEntre(hoy, fecha)`. |

Si `cliente` es `null` ("Sin cliente"), **no se evalúa ninguna regla**. Si no, en `reglasCliente.forEach` ocurre la
**comparación 5**: una regla aplica si está **activa**, está **vigente** en la fecha de la reserva
(`vigenteDesde ≤ fecha ≤ vigenteHasta`, si existe) y cumple su condición:

| Tipo | Regla inicial | Condición |
| --- | --- | --- |
| `TARJETA_SELLOS` | 15 %, cada 3 reservas | `confirmadasDesdeUltimoSello ≥ cadaReservas` |
| `BIENVENIDA` | 10 % | `reservasPrevias === 0` |
| `RESERVA_ANTICIPADA` | 5 %, 7 días | `diasAnticipacion ≥ diasAnticipacion de la regla` |
| `HORARIO_VALLE` | 10 % | La etapa 2 decidió demanda baja o muy baja (`historial.ajuste < 0`) |

El horario valle reutiliza la etapa 2: el Core ya sabe qué horarios están vacíos, y esta regla convierte ese dato
en un incentivo para el cliente.

**Regla de combinación:** los descuentos **no se acumulan**. Se usa solo el mayor; en empate, el de menor `id`. Así
nadie suma sellos, bienvenida y reserva anticipada para pagar la mitad.

Después: `precio = acotado × (1000 − descuento)`, en centavos × 10⁹. Aquí ocurre el **único** redondeo a centavos.
El rango va **antes** del descuento: el precio publicado es el general y el beneficio es adicional. Por eso un
cliente puede pagar menos que el mínimo publicado (35 × 0.90 = $31.50).

## 3. Ejemplos con las tarifas y reglas del negocio

Base $40; Día 0 %; Hora pico (18:00–21:59) +25 %; Noche (22:00–23:59) +12.5 %; Sábado +10 %; Feriado 2026-11-02
+20 %. Reglas del cliente: las 4 iniciales, activas desde el 2026-11-01.

| Caso | Cálculo | Precio |
| --- | --- | --- |
| Lunes 2026-11-30 10:00, sin cliente | 40 | $40.00 |
| Lunes 10:00, primera reserva del cliente | 40 × 0.90 (bienvenida) | $36.00 |
| Lunes 10:00, 3 confirmadas desde el último sello | 40 × 0.85 (sellos) | $34.00 |
| Lunes 10:00, 2 confirmadas desde el último sello | sin beneficio | $40.00 |
| Lunes 10:00, 3 sellos y 9 días de anticipación | gana el mayor: 40 × 0.85 | $34.00 |
| Sábado 2026-12-05 19:00, 7 días de anticipación exactos | 54 → 50 (rango) × 0.95 | $47.50 |
| Sábado 19:00, 6 días de anticipación | sin beneficio | $50.00 |
| Sábado 19:00, demanda muy alta (+10 %) y 3 sellos | 55 (rango) × 0.85 | $46.75 |
| Lunes 09:00, demanda muy baja (−12.5 %), sin sellos ni anticipación | 35 × 0.90 (valle) | $31.50 |
| Lunes 14:00, demanda baja (−5 %), sin sellos ni anticipación | 38 × 0.90 (valle) | $34.20 |
| Lunes 09:00, historiales en desacuerdo | no hay valle | $40.00 |
| Lunes 10:00, primera reserva, bienvenida inactiva | sin beneficio | $40.00 |
| Lunes 10:00, primera reserva, bienvenida con `vigenteHasta = 2026-11-29` | fuera de vigencia | $40.00 |
| Lunes 10:00, sin cliente, con 30 días de anticipación | sin cliente, sin beneficios | $40.00 |

Todos están en `tests/core.test.js` (los que empiezan con "3.2").

## 4. Guía de demostración

**Antes de empezar:** ejecuta las migraciones 001, 002 y 003 (ver el README). En la Calculadora, la etapa 4 muestra
los datos que contó el servidor (reservas previas, confirmadas desde el último sello y días de anticipación) y una
fila por regla con "Aplica" o "No aplica" y su motivo. La regla que se usa dice **"Aplica (se usa esta)"**.

### Caso 1: un cliente nuevo (bienvenida)
Crea un cliente nuevo en **Usuarios**. En la Calculadora, elígelo con cualquier fecha futura a las 10:00.
- Reservas previas: **0**. Bienvenida: "Aplica (se usa esta): Primera reserva del cliente".
- Precio: 40 × 0.90 = **$36.00** (si la fecha tiene menos de 7 días de anticipación y no es horario valle).
Inicia sesión como ese cliente en `/reservar`: al elegir el bloque aparece "Descuento aplicado: Bienvenida (−10 %)".
Después de reservar, la bienvenida ya no aplica (la reserva pendiente cuenta como reserva previa).

### Caso 2: un cliente con 3 confirmadas (sellos)
Usa el cliente de demostración de la 002 (tiene muchas confirmadas y nunca usó un sello) o confirma 3 reservas de
otro cliente desde **Reservas**.
- Tarjeta de sellos: "Aplica (se usa esta): N reservas confirmadas desde el último sello (se necesitan 3)".
- Precio de un lunes a las 10:00: **$34.00**.
Si ese cliente reserva, la reserva guarda `reglaClienteId` y `descuento = 0.150`, y la tarjeta vuelve a 0. Si la
cancela, el sello vuelve.

### Caso 3: una reserva con 7 días de anticipación
Con un cliente sin sellos ni bienvenida, calcula un sábado que esté exactamente a 7 días a las 19:00.
- Reserva anticipada: "7 días de anticipación (se necesitan 7)". Precio: 50 × 0.95 = **$47.50**.
- Con 6 días: "No aplica" y $50.00.

### Caso 4: una mañana vacía (valle)
Calculadora → un lunes futuro a las 09:00 con un cliente que ya tiene reservas. La 002 deja vacías las mañanas
entre semana; si el historial antiguo también es Baja, la etapa 2 da −5 % o −12.5 %.
- Horario valle: "Aplica (se usa esta): La etapa 2 detectó demanda baja en este horario".
- Precio: 38 × 0.90 = **$34.20** o 35 × 0.90 = **$31.50**.
Con "Sin cliente" en el mismo bloque, la etapa 4 dice "Sin cliente: no se evalúan beneficios".

### Caso 5: el cliente recibe solo `{ precio, beneficio }`
Inicia sesión como cliente, abre `/reservar`, presiona F12 → Consola y ejecuta:

```js
const r = await fetch("/api/precio/calcular", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fecha: "2026-12-05", horaInicio: "19:00", clienteId: "otro-id" }),
});
console.log(r.status, await r.json());
```

Resultado: `200 { precio: 50, beneficio: null }` o, con beneficio, `{ precio: 34, beneficio: { nombre: "Tarjeta de
sellos", descuento: 0.15 } }`. No incluye desglose, historial, ocupaciones, rango ni reglas evaluadas, y el
`clienteId` enviado se ignora (se usa el de la sesión). Con una sesión de recepcionista la respuesta trae
`historial`, `rango`, `beneficios.evaluadas`, `desglose`, etc.

También puedes probar `await (await fetch("/api/mis-beneficios")).json()`: devuelve solo `sellos` y `reglas`.

## 5. Preguntas probables

| Pregunta | Respuesta |
| --- | --- |
| ¿Por qué dos historiales y no uno? | Para que un dato aislado no mueva el precio. Solo se ajusta si el pasado lejano y el reciente coinciden. |
| ¿Por qué el rango va antes del descuento? | El rango es el precio publicado para todos; el descuento es un beneficio extra del cliente. |
| ¿Por qué no se acumulan los descuentos? | Para que nadie sume sellos, bienvenida y anticipada y pague la mitad. Se usa el mayor (l. 252–261). |
| ¿Por qué el horario valle usa la etapa 2? | El Core ya sabe qué horarios están vacíos; la regla convierte ese dato en un incentivo. |
| ¿Qué pasa si un cliente crea dos pendientes seguidas con el mismo sello? | La primera ya cuenta como sello usado, así que la segunda no lo recibe. Si se cancela la primera, el sello vuelve. |
| ¿Por qué enteros? | `0.1 + 0.2` no da `0.3` en JavaScript. Con centavos y milésimas el resultado es exacto, con un solo redondeo. |
| ¿El Core consulta la base de datos o la hora? | No. Lo hace el servicio (`hoyEnNegocio()` en `servicioPrecio.js`, l. 89). |
| ¿Por qué el cliente ve su beneficio pero no el desglose? | La ocupación histórica es información del negocio; el beneficio es suyo, y un programa de fidelidad que el cliente no ve no fideliza. Se filtra en el servidor (`calcular.js`, l. 17–20 y 75). |
| ¿Se puede borrar una regla ya usada? | No: la base responde con error de llave foránea y la API lo traduce a 409 "desactívala en lugar de borrarla". |
