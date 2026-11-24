# El Core de precios (v2): dónde está cada cosa y cómo demostrarlo

> **Aclaración:** los datos históricos (`historialReservas`, 3 años) y las reservas recientes de la migración 002 son
> **simulados para la demostración**. Los umbrales de demanda son un criterio del negocio, no un cálculo estadístico.

## 1. Mapa rápido

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| **Core** | `backend/core/calcularPrecio.js` | Función pura: 4 etapas y 5 comparaciones. |
| Parámetros | `backend/configuracion.js` (l. 34–68) | Umbrales, ajustes, semanas de historial, temporadas y `RANGOS_PRECIO`. |
| Temporada | `backend/fechas.js` (l. 57, `temporadaDe`) | `INVIERNO` (diciembre a mayo) o `VERANO`. |
| Servicio | `backend/core/servicioPrecio.js` | Lee las tarifas, el historial del cliente y los 2 historiales de demanda, y llama al Core. |
| API de precio | `backend/controladores/precio/calcular.js` | El personal recibe el cálculo completo; el cliente, solo `{ precio }` (l. 68). |
| API de rangos | `backend/controladores/precio/rangos.js` | `GET /api/precios/rangos`: devuelve `RANGOS_PRECIO`. |
| Calculadora | `frontend/paginas/Calculadora.js` | Muestra el cálculo etapa por etapa. |
| Tarifas estándar | `frontend/componentes/TarifasEstandar.js` | Rangos publicados, en `/reservar` y en la portada del panel. |
| Pruebas | `tests/core.test.js`, `tests/historial.test.js`, `tests/fechas.test.js` | 60 pruebas sin base de datos. |

```
Navegador ── POST { fecha, horaInicio, clienteId? } ──▶ calcular.js
                                                          │
servicioPrecio.js: tarifas + reservas del cliente + historial antiguo + historial actual (en paralelo)
                                                          │
calcularPrecio.js (CORE)
   ETAPA 1  tarifas.forEach      comparaciones 1, 2, 3   subtotal = base × (1 + recargos)
   ETAPA 2  historiales.forEach  comparaciones 4, 5      ajustado = subtotal × (1 + ajuste)
   ETAPA 3  rango de la franja                           acotado  = ajustado limitado a [mín, máx]
   ETAPA 4  cliente frecuente                            precio   = acotado × (1 − descuento)
                                                          │
calcular.js ── personal: todo el resultado · cliente: { precio }
```

## 2. El Core, línea por línea (`backend/core/calcularPrecio.js`)

| Qué | Líneas |
| --- | --- |
| Cabecera con las 4 etapas | 1–13 |
| Escalas enteras (centavos × 10³, × 10⁶, × 10⁹) | 36–38 |
| `dividirRedondeando` (redondeo con la mitad hacia arriba, solo enteros) | 54–58 |
| **Etapa 1:** `aplicarReglasTarifas` | 62–108 |
| `tarifas.forEach` | 68 |
| COMPARACIÓN 1: franja horaria (`hora >= horaInicio && hora <= horaFin`) | 75–79 |
| COMPARACIÓN 2: día de la semana (`dia === tarifa.diaSemana`) | 83–85 |
| COMPARACIÓN 2: fecha especial (`fecha === tarifa.fecha`) | 88–90 |
| COMPARACIÓN 3: cliente frecuente (`reservas >= tarifa.minReservas`) | 93–100 |
| **Etapa 2:** `clasificarDemanda` (nivel de un historial) | 116–121 |
| Promedios en diezmilésimas (sin errores de coma flotante) | 125–132 |
| `decidirAjusteDemanda` (regla de decisión) | 137–154 |
| `contrastarHistorial`, con `historiales.forEach` | 157–172 |
| COMPARACIÓN 4 (antiguo) y COMPARACIÓN 5 (actual) | 160–166 |
| **Etapa 3:** `aplicarRango` | 179–209 |
| Busca la franja de rango | 180 |
| ¿Se usa el máximo alto ($55)? | 184 |
| Limita al máximo / al mínimo | 194–206 |
| `armarDesglose` (desglose ordenado por etapa) | 215–244 |
| **Función principal `calcularPrecio`** | 262 |
| Etapa 1: reglas y subtotal | 272–278 |
| Etapa 2: ajuste por demanda | 281–282 |
| Etapa 3: rango | 285 |
| Etapa 4: descuento, control de enteros seguros y **único redondeo** | 290–292 |
| Salida | 294–305 |

### Etapa 1: reglas de tarifas
Es la lógica de siempre, ahora con `tarifas.forEach` y un `switch` por tipo de tarifa. Los recargos de franja y de
calendario se suman. El descuento de cliente frecuente se **calcula** aquí, pero se **aplica** en la etapa 4.

### Etapa 2: historial de demanda
El servicio entrega una lista con **dos** historiales:

| Historial | De dónde sale | Muestras |
| --- | --- | --- |
| **ANTIGUO**, "Historial 3 años (misma temporada)" | Vista `ocupacionHistorica`: mismo día de la semana, hora y temporada (`servicioPrecio.js`, l. 32–48). Si no hay fila, la ocupación es 0: nunca hubo reservas en ese bloque. | Días posibles |
| **ACTUAL**, "Últimas semanas" | Reservas `CONFIRMADA` de las 8 semanas anteriores (mismo día y hora). Solo cuentan las fechas que ya pasaron y desde el 2026-11-01 (`servicioPrecio.js`, l. 53–70). Con menos de 2 semanas, `ocupacion: null`. | Semanas |

Comparaciones 4 y 5 (una por historial, dentro de `historiales.forEach`):

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

Los límites se pasan a la misma escala entera que el precio ajustado, así que la comparación no redondea nada.

### Etapa 4: descuento y redondeo
`precio = acotado × (1000 − descuento)`, en centavos × 10⁹. Aquí ocurre el **único** redondeo a centavos. El rango
se aplica **antes** del descuento: el precio publicado es el general, y el descuento es un beneficio adicional. Por
eso un cliente frecuente puede pagar menos que el mínimo publicado (35 × 0.90 = $31.50).

## 3. Ejemplos con las tarifas del negocio

Base $40; Día 0 %; Hora pico (18:00–21:59) +25 %; Noche (22:00–23:59) +12.5 %; Sábado +10 %; Feriado 2026-11-02
+20 %; Cliente frecuente −10 % desde 3 reservas.

| Caso | Cálculo | Precio |
| --- | --- | --- |
| Lunes 19:00, sin historial | 40 × 1.25 = 50 | $50.00 |
| Sábado 19:00, sin historial | 54 → máximo 50 | $50.00 |
| Sábado 19:00, demanda muy alta (0.95 y 0.90) | 54 × 1.10 = 59.40 → máximo alto 55 | $55.00 |
| Lunes 22:00, demanda alta (0.75 y 0.72) | 45 × 1.05 | $47.25 |
| Lunes 09:00, demanda muy baja (0.06 y 0.10) | 40 × 0.875 | $35.00 |
| Lunes 22:00, demanda muy baja | 39.375 → mínimo 45 | $45.00 |
| Sábado 19:00, historiales que no coinciden (0.95 y 0.20) | 54 → máximo 50 | $50.00 |
| Sábado 19:00, demanda muy alta y cliente frecuente | 55 × 0.90 | $49.50 |

Todos están en `tests/core.test.js`.

## 4. Guía de demostración

**Antes de empezar:** ejecuta las migraciones 001 y 002 (ver el README). Para ver los precios sin el descuento,
usa en la Calculadora **"Sin cliente"** o un cliente distinto del de demostración.

Los resultados de los casos 1 y 2 dependen de los datos de la 001. Para elegir el bloque, revisa primero la vista en
el SQL Editor:

```sql
select * from "ocupacionHistorica"
where "temporada" = 'VERANO'
order by "ocupacion" desc;   -- o "asc" para ver los bloques más vacíos
```

Elige una fecha **futura** con el día de la semana del bloque. Los días de la semana van de 0 = domingo a
6 = sábado.

### Caso 1: un precio que sube
Calculadora → un sábado futuro a las 19:00, "Sin cliente". Si el bloque tiene ocupación ≥ 0.70 en ambos historiales:
- Etapa 2: ambas filas en **Alta**. La decisión es "Ambos historiales muestran demanda muy alta" (+10 %) o "… alta"
  (+5 %).
- Etapa 3: con demanda muy alta, "Limitado al máximo por demanda muy alta: $55.00". Con demanda alta, el precio
  queda limitado a $50.00.

### Caso 2: un precio que baja
Calculadora → un lunes futuro a las 09:00. La migración 002 deja vacías las mañanas de 08:00 y 09:00 entre semana,
así que el historial actual da **0 %** (Baja). Si el antiguo también es Baja, el ajuste es −5 % o −12.5 % y el
precio queda en $38.00 o $35.00.

### Caso 3: historiales en desacuerdo (domingo 18:00)
Calculadora → el próximo domingo a las 18:00.
- Historial antiguo: **Alta** (las noches de domingo están llenas en la simulación).
- Historial actual: **0 %, Baja**. La 002 no crea ninguna reserva los domingos a las 18:00.
- Decisión: "Los historiales no coinciden: no se ajusta", ajuste 0 %. Precio: 40 × 1.25 = **$50.00**.

### Caso 4: un precio limitado por el rango
Calculadora → un sábado futuro a las 10:00. Las tarifas dan 40 × 1.10 = 44, pero la etapa 3 muestra "Limitado al
máximo publicado: $40.00". El precio es $40.00, salvo que el historial lo baje.

### Caso 5: el cliente recibe solo `{ precio }`
Inicia sesión como cliente, abre `/reservar`, presiona F12 → Consola y ejecuta:

```js
const r = await fetch("/api/precio/calcular", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ fecha: "2026-12-05", horaInicio: "19:00" }),
});
console.log(r.status, await r.json());
```

Resultado: `200 { precio: 50 }` (o el que corresponda). No incluye desglose, comparaciones, ocupaciones ni rango.
Haz lo mismo con una sesión de recepcionista: la respuesta trae `historial`, `rango`, `desglose`, etc.

### Caso 6: tarifas estándar
Como cliente en `/reservar`, o como personal en la portada del panel, aparece "Tarifas estándar" con los tres rangos.
Los textos salen de `GET /api/precios/rangos`, que lee la misma configuración que el Core.

## 5. Preguntas probables

| Pregunta | Respuesta |
| --- | --- |
| ¿Por qué dos historiales y no uno? | Para que un dato aislado no mueva el precio. Solo se ajusta si el pasado lejano y el reciente coinciden. |
| ¿Por qué el rango va antes del descuento? | El rango es el precio publicado para todos; el descuento es un beneficio extra del cliente. |
| ¿Por qué enteros? | `0.1 + 0.2` no da `0.3` en JavaScript. Con centavos y milésimas el resultado es exacto, con un solo redondeo. |
| ¿Cómo se compara un promedio como 0.15 sin errores? | En diezmilésimas y sin dividir: `suma ≥ umbral × cantidad` (l. 125–132). |
| ¿El Core consulta la base de datos o la hora? | No. Lo hace el servicio (`hoyEnNegocio()` en `servicioPrecio.js`, l. 77). Por eso hay 60 pruebas sin base de datos. |
| ¿Por qué el cliente no ve el desglose? | La ocupación histórica es información del negocio. Se filtra en el servidor (`calcular.js`, l. 68), no solo en la pantalla. |
| ¿Qué pasa si un bloque nunca tuvo reservas en el historial antiguo? | La vista no tiene fila y eso cuenta como ocupación 0, no como falta de datos. |
| ¿Las pendientes cuentan como demanda? | No. Solo las `CONFIRMADA`. |
