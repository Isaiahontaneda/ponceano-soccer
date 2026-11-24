# Informe — Core v2 (reglas + historial + rangos publicados)

Rama: `core-historico`, creada desde `cliente-e-ingresos`. Sin `push` ni despliegue. No se ejecutó SQL.

## 1. Archivos creados y modificados

### Creados

| Archivo | Para qué sirve |
| --- | --- |
| `docs/plan-core-v2.md` | Plan corto del trabajo. |
| `backend/controladores/precio/rangos.js` y `app/api/precios/rangos/route.js` | `GET /api/precios/rangos`. |
| `frontend/componentes/TarifasEstandar.js` | Sección "Tarifas estándar" (en `/reservar` y en la portada). |
| `supabase/migraciones/002_reservas_recientes_demo.sql` | Reservas recientes de demostración (no ejecutada). |
| `tests/historial.test.js`, `tests/fechas.test.js` | Pruebas nuevas. |
| `tests/datos.js` | Tarifas del negocio y ayuda para armar historiales; lo comparten las pruebas. No es una prueba. |
| `docs/core.md` | Documento del Core: líneas reales, tablas y guía de demostración. |
| `docs/informe-core-v2.md` | Este informe. |

### Modificados

| Archivo | Qué cambió |
| --- | --- |
| `backend/configuracion.js` | Parámetros del historial, umbrales, ajustes y `RANGOS_PRECIO`. |
| `backend/fechas.js` | `temporadaDe(fecha)`. |
| `backend/core/calcularPrecio.js` | 4 etapas y 5 comparaciones, con `forEach`, en funciones cortas. |
| `backend/core/servicioPrecio.js` | `cargarHistorialAntiguo`, `cargarHistorialActual`, y los 4 datos en paralelo. |
| `backend/controladores/precio/calcular.js` | El cliente recibe solo `{ precio }`. |
| `frontend/paginas/Calculadora.js` | El cálculo se muestra por etapas. |
| `frontend/paginas/Reservar.js` | Solo "Precio por hora", sin desglose, más las tarifas estándar. |
| `frontend/paginas/Portada.js` | Tarifas estándar. |
| `tests/core.test.js` | Las dos tablas de precios esperados. |
| `README.md` | Secciones del Core (con los pasos de las migraciones) y de Seguridad. |
| `docs/pruebas-manuales-fase-bc.md` | El paso 6 ya no menciona el desglose (el cliente ya no lo ve). |

No se tocaron `.env.local` ni las tarifas. No se agregaron dependencias.

## 2. Salida de las comprobaciones

**`npm run lint`:** sin errores ni avisos.

```
> ponceano-soccer@0.1.0 lint
> eslint
```

**`npm run build`:**

```
✓ Compiled successfully in 2.6s
✓ Generating static pages using 19 workers (25/25) in 1252ms
├ ○ /admin/calculadora
├ ƒ /api/precios/rangos
└ ○ /reservar
   (más las rutas que ya existían)
```

**`npm test`:**

```
ℹ tests 60
ℹ pass 60
ℹ fail 0
```

- `core.test.js`: 23 pruebas. Son las 22 filas de las dos tablas de la sección 5, más una de la salida por etapas.
- `historial.test.js`: 17 pruebas.
- `fechas.test.js`: 2 pruebas.
- Pruebas anteriores: 18 (cancelación e ingresos).

Todos los precios esperados del documento coincidieron con el cálculo; no hubo que corregir ninguna tabla.
Node sigue mostrando el aviso `MODULE_TYPELESS_PACKAGE_JSON`, que no afecta el resultado (ver el informe de las
fases B y C).

## 3. Desviaciones

1. **La migración 001 no está en el repositorio.** No se reescribió. El código usa los nombres que indica el
   documento (`ocupacionHistorica`, `diaSemana`, `horaInicio`, `temporada`, `diasPosibles`, `ocupacion`). **Agrega el
   archivo** en `supabase/migraciones/001_historial_reservas.sql`.
2. **No existía un documento del Core en `docs/`**: la explicación anterior se dio solo en el chat. Se creó
   `docs/core.md`.
3. **Comparaciones 4 y 5 en un solo bloque.** Dentro de `historiales.forEach` el mismo código clasifica cada
   historial; el comentario dice "COMPARACIÓN 4 (ANTIGUO) y COMPARACIÓN 5 (ACTUAL)". Es la forma más simple de
   respetar "una lista, un `forEach`, una comparación por elemento".
4. **Promedios en diezmilésimas.** `decidirAjusteDemanda` compara `suma ≥ umbral × cantidad` con enteros. Con
   decimales, el borde 0.10 + 0.20 (promedio 0.15) da 0.15000000000000002 y se clasificaría mal. Hay una prueba de
   ese borde.
5. **Hora fuera de los rangos publicados** (por ejemplo, 07:00 en una llamada directa a la API): no se limita y
   `rango` es `null`. En las pantallas no puede pasar, porque solo se ofrecen los bloques de 08:00 a 23:00.
6. **`muestras` del historial antiguo sin fila:** es `null` (no se sabe cuántos días hubo) y la ocupación es 0, como
   pide el documento.
7. **Migración 002, bloques fijos.** Los bloques que se usan en la demostración (las noches altas de 18:00 a 21:00,
   las mañanas vacías a las 08:00 y 09:00 entre semana, y el domingo a las 18:00) tienen probabilidad 0 o 1. Así la
   demostración no depende del azar. El resto usa `random()` con `setseed(0.42)`. Como la 001 no está en el
   repositorio, los patrones se tomaron de la descripción del documento, no del archivo.
8. **Migración 002, precio sin descuento.** El precio de cada reserva usa las tarifas y los rangos normales, pero no
   el descuento de cliente frecuente, para que el SQL sea simple.
9. **Pasos de las migraciones en el README.** Están dentro de la sección del Core (subsección "Migraciones del
   historial"), para tocar solo las secciones permitidas.
10. **Texto desactualizado en el README.** La sección Funcionalidades dice que el cliente "consulta el precio con su
    desglose". No se cambió porque está fuera de las secciones permitidas; conviene ajustarla.
11. **`docs/pruebas-manuales-fase-bc.md`.** Se corrigió el paso 6, que decía que el cliente ve el desglose.
12. **Commits sin la línea `Co-Authored-By`**, siguiendo tu preferencia guardada.

## 4. Limitaciones conocidas

- **Los datos históricos son simulados** (001 y 002).
- **Los umbrales y ajustes son un criterio del negocio** (70 %, 25 %, 85 %, 15 %, ±5 %, +10 %, −12.5 %), no
  salen de un cálculo estadístico.
- **El historial actual tiene pocas semanas** porque el sistema empezó el 2026-11-01. Se exigen al menos 2; con
  menos, el resultado es "Historial insuficiente".
- **Las reservas pendientes no cuentan como demanda**: solo las confirmadas.
- **Ahora todo cálculo de precio necesita la vista `ocupacionHistorica`.** Si la 001 no está ejecutada en una base,
  la calculadora y la creación de reservas fallan con un error 500.
- **El precio de una reserva queda fijo al crearla.** Si después cambia la demanda, no se recalcula.
- Estos cambios no se probaron contra la base de datos real; solo con lint, build y las pruebas automáticas.

## 5. Pasos para ti

1. Agrega `supabase/migraciones/001_historial_reservas.sql` al repositorio (ya la ejecutaste en Supabase).
2. Si no tienes un cliente de demostración, créalo desde **Usuarios** con rol Cliente.
3. Abre `supabase/migraciones/002_reservas_recientes_demo.sql`, cambia `CORREO-CLIENTE-DEMO` por su correo y
   ejecútala en el SQL Editor.
4. Resultado esperado: una tabla con la cantidad de reservas por día de la semana (0 = domingo) y franja. En
   particular:
   - Las noches de domingo, martes, jueves, viernes y sábado tienen muchas reservas.
   - Las mañanas tienen pocas.
   - Ningún domingo tiene reserva a las 18:00 (compruébalo con
     `select * from "reservas" where extract(dow from "fecha") = 0 and "horaInicio" = '18:00' and "fecha" >= '2026-11-01';`).
   - Si el correo no existe o no es de un cliente, el script se detiene con un mensaje.
5. Sigue la guía de demostración de [core.md](core.md) (sección 4). En la Calculadora, usa "Sin cliente" para ver
   los precios sin el descuento de cliente frecuente.
