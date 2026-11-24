<h1 align="center">Ponceano Soccer</h1>

<p align="center">
  <img src="public/logo.png" alt="Logo de Ponceano Soccer: letras P y S naranja y verde junto a un balón, con el lema Vive, disfruta, juega" width="220">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/STATUS-EN%20DESARROLLO-green" alt="Estado del proyecto: en desarrollo">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Node-%E2%89%A5%2020-339933?logo=nodedotjs&logoColor=white" alt="Node 20 o superior">
</p>

> Sistema web para gestionar las reservas de una cancha sintética de fútbol, con precios calculados automáticamente.

## Índice

- [Descripción del proyecto](#descripción-del-proyecto)
- [Estado del proyecto](#estado-del-proyecto)
- [Funcionalidades](#funcionalidades)
- [Acceso al proyecto](#acceso-al-proyecto)
- [Abre y ejecuta el proyecto](#abre-y-ejecuta-el-proyecto)
- [Base de datos](#base-de-datos)
- [Tecnologías utilizadas](#tecnologías-utilizadas)
- [Arquitectura MVC](#arquitectura-mvc)
- [El Core: cómo se calcula el precio](#el-core-cómo-se-calcula-el-precio)
- [Horario de la cancha](#horario-de-la-cancha)
- [Roles](#roles)
- [Seguridad](#seguridad)
- [Revisión del código](#revisión-del-código)
- [Autor](#autor)

## Descripción del proyecto

Ponceano Soccer permite administrar las reservas de una cancha sintética de fútbol desde un panel web. El precio de
cada reserva no se escribe a mano: se calcula automáticamente a partir de reglas de tarifas (franja horaria, día de la
semana, feriados y descuento por cliente frecuente) que el administrador mantiene en el mismo panel.

Proyecto de la UDLA, curso Ingeniería Web (Tarea 8, Administración MVC).

## Estado del proyecto

![Badge en desarrollo](https://img.shields.io/badge/STATUS-EN%20DESARROLLO-green)

Proyecto académico en desarrollo. 

- Sitio desplegado: <https://ponceano-soccer-ltmnjcv3z-ontanedaisaiah-3553s-projects.vercel.app/login>
- Video explicativo: <https://youtu.be/jd6V3jbnMDs>

## Funcionalidades

- **Reservas:** agenda del día, creación de reservas y cambio de estado, sin permitir fechas pasadas ni dos reservas
  activas en el mismo horario.
- **Cálculo automático del precio** con desglose paso a paso (ver [El Core](#el-core-cómo-se-calcula-el-precio)).
- **Calculadora:** simula el precio de una reserva y muestra qué reglas se aplicaron.
- **Tarifas:** el administrador crea y edita las reglas de precio sin tocar el código.
- **Usuarios y roles:** administrador, recepcionista y cliente, con permisos distintos.
- **Panel de administración** con resumen de reservas del día y aviso si falta la tarifa base.
- **Reservas del cliente:** el cliente inicia sesión, ve los horarios libres, ocupados y pasados, consulta el precio
  con su desglose y reserva en `/reservar`. La reserva queda pendiente hasta que el local la confirma. También ve sus
  reservas y puede cancelar las pendientes que aún no empiezan. Tiene un tope de 3 reservas pendientes.
- **Reporte de ingresos:** el administrador elige un rango de fechas y ve lo confirmado, lo pendiente y el total
  esperado, por día o por mes.



## Acceso al proyecto

- Sitio desplegado: <https://ponceano-soccer-ltmnjcv3z-ontanedaisaiah-3553s-projects.vercel.app/login>
- Repositorio: <https://github.com/Isaiahontaneda/ponceano-soccer>

Para descargarlo:

```bash
git clone https://github.com/Isaiahontaneda/ponceano-soccer.git
cd ponceano-soccer
```

## Abre y ejecuta el proyecto

Requisitos: **Node ≥ 20** y un proyecto de [Supabase](https://supabase.com/).

```bash
npm install
cp .env.example .env.local   # completa los 3 valores (ver abajo)
npm run dev                  # http://localhost:3000
```

Variables de `.env.local` (el archivo no se sube a Git):

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Llave pública, sin permisos sobre las tablas |
| `SUPABASE_SECRET_KEY` | Solo servidor, nunca con prefijo `NEXT_PUBLIC_` |

### Base de datos

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

## Tecnologías utilizadas

| Tecnología | Para qué se usa |
| --- | --- |
| [Next.js 16](https://nextjs.org/) (App Router, JavaScript) | Rutas, páginas y API |
| [React 19](https://react.dev/) | Interfaz del panel |
| [Supabase](https://supabase.com/) (PostgreSQL + Auth) | Base de datos y autenticación |
| [ESLint](https://eslint.org/) | Revisión del código |

## Arquitectura MVC

| Capa | Dónde |
| --- | --- |
| Modelo | Supabase, accedido solo desde el servidor (`backend/supabase/`, `backend/modelo/`) |
| Vista | `frontend/paginas/` |
| Controlador | `backend/controladores/` |
| Core (cálculo de precio) | `backend/core/` |
| Validaciones (funciones puras) | `backend/validaciones/` |

El código está dividido en dos carpetas: `backend/` (lógica que corre solo en el servidor) y `frontend/` (pantallas,
componentes y estilos). La carpeta `app/` es obligatoria en Next.js para definir las rutas: cada archivo de ahí tiene
una sola línea que apunta a su controlador (`app/api/**/route.js`) o a su pantalla (`**/page.js`).

## El Core: cómo se calcula el precio

El Core es el módulo que decide cuánto cuesta una reserva. Está en `backend/core/calcularPrecio.js` y es una
**función pura**: no lee la base de datos ni la hora del servidor. `backend/core/servicioPrecio.js` le entrega las
tarifas, las reservas confirmadas del cliente y dos historiales de demanda. Los parámetros (umbrales, ajustes y
rangos) están en `backend/configuracion.js`.

El cálculo tiene **4 etapas** y **5 comparaciones**:

```
ETAPA 1  Reglas de tarifas   subtotal = base × (1 + recargos)          comparaciones 1, 2 y 3
ETAPA 2  Historial           ajustado = subtotal × (1 + ajuste)        comparaciones 4 y 5
ETAPA 3  Rango publicado     acotado  = ajustado limitado al rango de su franja
ETAPA 4  Cliente frecuente   precio   = acotado × (1 − descuento)
```

1. **Reglas de tarifas** (`tarifas.forEach`): se compara la hora contra cada **franja horaria** (comparación 1); el
   día de la semana y la fecha contra las reglas de **calendario** (comparación 2), y las reservas confirmadas del
   cliente en los 30 días previos contra el mínimo de **cliente frecuente** (comparación 3). Los recargos se suman.
2. **Historial** (`historiales.forEach`): la ocupación del mismo bloque se clasifica en Alta (≥ 70 %), Normal, Baja
   (≤ 25 %) o Sin datos, en el **historial antiguo** (3 años, misma temporada; comparación 4) y en el **historial
   actual** (últimas 8 semanas; comparación 5). Solo si **ambos coinciden** se ajusta el precio: +5 % o +10 % (muy
   alta, promedio ≥ 85 %), y −5 % o −12.5 % (muy baja, promedio ≤ 15 %). Si no coinciden o falta un historial, no
   hay ajuste.
3. **Rango publicado:** el precio se limita al rango de su franja: Mañana $35–$40, Tarde $38–$45, Noche $45–$50
   (hasta $55 solo con demanda muy alta).
4. **Cliente frecuente:** el descuento se aplica al final, después del rango. Por eso un cliente frecuente puede
   pagar menos que el mínimo publicado.

Todo se calcula con enteros (centavos y milésimas) y se redondea **una sola vez**, al final, a 2 decimales con la
mitad hacia arriba. La explicación detallada, con números de línea y una guía de demostración, está en
[docs/core.md](docs/core.md).

> Los datos históricos son **simulados** para la demostración.

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
| Sábado 2026-11-07, 10:00 | 40 × 1.10 = 44 → máximo de la mañana | $40.00 |
| Sábado 2026-11-07, 19:00 | 40 × 1.35 = 54 → máximo de la noche | $50.00 |
| Sábado 19:00 con demanda muy alta | 54 × 1.10 = 59.40 → máximo alto | $55.00 |
| Lunes 22:00 con demanda alta | 45 × 1.05 | $47.25 |
| Lunes 09:00 con demanda muy baja | 40 × 0.875 | $35.00 |
| Sábado 19:00, demanda muy alta y cliente frecuente | 55 × 0.90 | $49.50 |

Sin historial (o con historiales que no coinciden) no hay ajuste por demanda.

### Migraciones del historial

Se ejecutan a mano en el SQL Editor de Supabase, **en este orden**:

1. `supabase/migraciones/001_historial_reservas.sql`: crea la tabla `historialReservas` (3 años de reservas
   simuladas) y la vista `ocupacionHistorica`. Sin ella, no se puede calcular ningún precio.
2. `supabase/migraciones/002_reservas_recientes_demo.sql`: antes, cambia `CORREO-CLIENTE-DEMO` por el correo de un
   usuario con rol Cliente. Crea reservas confirmadas desde el 2026-11-01 hasta ayer, a nombre de ese cliente
   (alimentan el historial actual y cuentan para su descuento de cliente frecuente).

### Reglas que protegen el cálculo

- No se puede eliminar la tarifa base ni la última regla de cada grupo (franja, calendario o cliente frecuente); así
  siempre hay algo contra lo que comparar.
- Las franjas horarias no pueden cruzarse, y no se repiten ni el día de la semana ni la fecha especial.
- El precio de una reserva lo calcula siempre el servidor; el que envíe el navegador se ignora.
- Los rangos publicados están en un solo lugar (`RANGOS_PRECIO`), que usan el Core y la sección "Tarifas estándar".

## Horario de la cancha

Bloques de 1 hora, con inicio de 08:00 a 23:00, en la zona horaria `America/Guayaquil`. Se pueden cambiar en
`backend/configuracion.js`. No se puede reservar en fechas pasadas ni en bloques que ya empezaron, y un mismo horario no
admite dos reservas activas.

## Roles

| Acción | Administrador | Recepcionista | Cliente |
| --- | :---: | :---: | :---: |
| Tarifas y usuarios | ✔ | — | — |
| Reporte de ingresos | ✔ | — | — |
| Reservas (crear, confirmar, cancelar) y calculadora | ✔ | ✔ | — |
| Reservar para sí mismo, ver sus reservas y cancelar sus pendientes | — | — | ✔ |

Al iniciar sesión, el personal entra a `/admin` y el cliente a `/reservar`. Los clientes no se registran solos: los
crea el administrador desde **Usuarios**.

El rol se lee siempre de la tabla `usuarios`, nunca del navegador. Un administrador no puede eliminarse ni quitarse
el rol a sí mismo, y no se puede eliminar ni degradar al último administrador.

## Seguridad

- Sesión validada en el servidor y respuestas 401/403 en cada ruta de la API.
- Validación completa en el servidor; solo se guardan los campos aprobados.
- Control de `Origin` en todas las escrituras (defensa contra CSRF).
- La llave secreta solo existe en código de servidor; el navegador nunca habla directo con Supabase.
- En las rutas del cliente (`/api/mis-reservas`), el dueño de la reserva es siempre el usuario de la sesión: se
  ignora cualquier `clienteId`, `precio`, `estado` o `rol` que mande el navegador.
- Si un cliente intenta cancelar una reserva ajena recibe 404 (igual que si no existiera), para no revelar reservas
  de otras personas.
- El reporte de ingresos solo responde al administrador (403 para los demás roles).
- El cliente recibe del cálculo de precio **solo** `{ precio }`: el desglose y la ocupación histórica (dato sensible
  del negocio) se filtran en el servidor, no solo en la pantalla.
- `historialReservas` y `ocupacionHistorica` no tienen permisos para `anon` ni `authenticated`: solo el servidor las
  lee, con la llave secreta.

## Revisión del código

```bash
npm run lint
npm run build
```

## Autor

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Isaiahontaneda">
        <img src="https://github.com/Isaiahontaneda.png" width="115" alt="Foto de perfil de Isaiah Ontaneda"><br>
        <sub>Isaiah Ontaneda</sub>
      </a>
    </td>
  </tr>
</table>
