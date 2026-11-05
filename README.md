# Ponceano Soccer

Sistema web para gestionar las reservas de una cancha sintética de fútbol. El precio de cada reserva se calcula
automáticamente a partir de reglas de tarifas que el administrador mantiene en un panel.
Proyecto UDLA, curso Ingeniería Web (Tarea 8, Administración MVC).

- Sitio desplegado: **PENDIENTE**
- Video explicativo: **PENDIENTE**

## Stack

Next.js 16 (App Router, JavaScript), React 19, Supabase (PostgreSQL + Auth). Requiere Node ≥ 20.

## Arquitectura MVC

| Capa | Dónde |
| --- | --- |
| Modelo | Supabase, accedido solo desde el servidor (`lib/supabase/`, `lib/modelo/`) |
| Vista | `app/**/page.js` |
| Controlador | `app/api/**/route.js` |
| Core (cálculo de precio) | `lib/core/` |
| Validaciones (funciones puras) | `lib/validaciones/` |

## El Core: cómo se calcula el precio

El Core es el módulo que decide cuánto cuesta una reserva. No guarda ni lee nada por sí mismo: recibe los datos de la
reserva (fecha, hora de inicio y cuántas reservas confirmadas tiene el cliente) y la lista de tarifas, y devuelve el
precio con su desglose. Está en `lib/core/calcularPrecio.js`; `lib/core/servicioPrecio.js` lo conecta con la base de
datos en el servidor.

```
precio = tarifa base × (1 + recargos) × (1 − descuento)
```

- **Recargos:** el recargo de la franja horaria más todos los recargos de calendario que apliquen. Se suman, así que
  un sábado que además es feriado acumula los dos.
- **Descuento:** el de cliente frecuente; si se cumplen varios, se aplica solo el mayor. Se calcula al final, sobre el
  subtotal.
- **Redondeo:** a 2 decimales, mitad hacia arriba, una sola vez al final. El cálculo usa números enteros (centavos y
  milésimas) para evitar errores de coma flotante.

El Core recorre la lista de tarifas con un ciclo y hace **tres comparaciones**:

1. **Franja horaria:** la hora de inicio de la reserva contra el rango (`horaInicio` ≤ hora ≤ `horaFin`) de cada franja.
2. **Calendario:** el día de la semana de la fecha contra cada regla de día (0 = domingo … 6 = sábado), y la fecha
   contra cada fecha especial.
3. **Cliente frecuente:** las reservas **confirmadas** del cliente en los 30 días anteriores contra el mínimo de
   reservas de cada regla de descuento.

### Tipos de tarifa

| Tipo | Qué guarda | Cómo se escribe el valor |
| --- | --- | --- |
| Tarifa base | Precio por hora | Dólares (ej. `40`) |
| Franja horaria | Hora de inicio y de fin | Porcentaje de recargo (ej. `25`) |
| Día de la semana | Un día (domingo a sábado) | Porcentaje de recargo |
| Fecha especial | Una fecha (ej. un feriado) | Porcentaje de recargo |
| Cliente frecuente | Mínimo de reservas confirmadas | Porcentaje de descuento |

En el panel, los porcentajes se escriben con máximo 1 decimal (ej. `12.5`) y el servidor los guarda como decimal
(`0.125`). La tarifa base lleva máximo 2 decimales.

### Ejemplo con las tarifas del negocio

Base $40; Día 08:00–17:59 (0 %); Hora pico 18:00–21:59 (+25 %); Noche 22:00–23:59 (+12.5 %); Sábado (+10 %);
Feriado 2026-11-02 (+20 %); Cliente frecuente (−10 % desde 3 reservas).

| Reserva | Cálculo | Precio |
| --- | --- | --- |
| Lunes 2026-11-09, 10:00 | 40 | $40.00 |
| Lunes 2026-11-09, 19:00 | 40 × 1.25 | $50.00 |
| Lunes 2026-11-09, 22:00 | 40 × 1.125 | $45.00 |
| Sábado 2026-11-07, 19:00 | 40 × (1 + 0.25 + 0.10) | $54.00 |
| Lunes feriado 2026-11-02, 10:00 | 40 × 1.20 | $48.00 |
| Sábado 2026-11-07, 19:00, cliente con 3 o más reservas | 54 × 0.90 | $48.60 |

### Reglas que protegen el cálculo

- No se puede eliminar la tarifa base ni la última regla de cada grupo (franja, calendario o cliente frecuente); así
  siempre hay algo contra lo que comparar.
- Las franjas horarias no pueden cruzarse, y no se repiten ni el día de la semana ni la fecha especial.
- El precio de una reserva lo calcula siempre el servidor; el que envíe el navegador se ignora.

## Horario de la cancha

Bloques de 1 hora, con inicio de 08:00 a 23:00, en la zona horaria `America/Guayaquil`. Se pueden cambiar en
`lib/configuracion.js`. No se puede reservar en fechas pasadas ni en bloques que ya empezaron, y un mismo horario no
admite dos reservas activas.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completa los 3 valores (ver abajo)
npm run dev                  # http://localhost:3000
```

Variables de `.env.local` (el archivo no se sube a Git):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` — solo servidor, nunca con prefijo `NEXT_PUBLIC_`

## Base de datos

Las tablas (`tiposTarifa`, `usuarios`, `tarifas` y `reservas`) se crean en el SQL Editor de Supabase, con RLS
activado y sin políticas: solo el servidor accede.

**Primer administrador:** en Authentication → Users crea el usuario (con *Auto Confirm User*) y luego ejecuta:

```sql
insert into "usuarios" ("id", "correo", "nombre", "apellido", "rol")
select "id", "email", 'NOMBRE', 'APELLIDO', 'ADMINISTRADOR'
from auth.users where "email" = 'CORREO-DEL-ADMIN';
```

Después, los demás usuarios (incluidos más administradores) se crean desde **Usuarios** en el panel.
Desactiva también el registro público en Authentication → Sign In / Providers.

## Roles

| Acción | Administrador | Recepcionista | Cliente |
| --- | :---: | :---: | :---: |
| Tarifas y usuarios | ✔ | — | — |
| Reservas y calculadora | ✔ | ✔ | — |

El rol se lee siempre de la tabla `usuarios`, nunca del navegador. Un administrador no puede eliminarse ni quitarse
el rol a sí mismo, y no se puede eliminar ni degradar al último administrador.

## Seguridad

- Sesión validada en el servidor y respuestas 401/403 en cada ruta de la API.
- Validación completa en el servidor; solo se guardan los campos aprobados.
- Control de `Origin` en todas las escrituras (defensa contra CSRF).
- La llave secreta solo existe en código de servidor; el navegador nunca habla directo con Supabase.

## Pruebas

```bash
npm test         # pruebas unitarias: validaciones, estados de reserva y Core
npm run lint
npm run build
```

## Despliegue en Vercel

1. Importa el repositorio de GitHub en Vercel.
2. Crea las 3 variables de entorno (la secreta sin marcar como pública).
3. En Supabase, Authentication → URL Configuration: pon la URL de Vercel como Site URL.
