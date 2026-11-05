# Ponceano Soccer

Sistema web para gestionar las reservas de una cancha sintética de fútbol (negocio familiar).
Proyecto de la UDLA, curso **Ingeniería Web**, Tarea 8 «Administración MVC».

El **precio de cada reserva se calcula automáticamente** con un **Core**: recorre la tabla de reglas de
tarifas y hace **tres comparaciones** contra los datos de la reserva (franja horaria, calendario y cliente
frecuente). El **panel de administración** permite mantener esas reglas, los usuarios y las reservas.

> Enlace del sitio desplegado: **PENDIENTE**
> Enlace del video explicativo: **PENDIENTE**

---

## Stack

| Parte | Tecnología |
| --- | --- |
| Framework | Next.js 16.4.5 (App Router, Cache Components), React 19, JavaScript |
| Base de datos y login | Supabase (PostgreSQL + Supabase Auth con correo y contraseña) |
| Estilos | CSS propio (`app/globals.css`), sin Tailwind |
| Pruebas | Ejecutor integrado de Node (`node --test`) |
| Despliegue previsto | Vercel (repositorio en GitHub) |

Dependencias: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `server-only`.

## Arquitectura MVC

| Capa | Dónde está | Qué hace |
| --- | --- | --- |
| **Modelo** | Supabase (PostgreSQL) y `lib/supabase/admin.js`, `lib/modelo/` | Datos. Solo se accede desde el servidor con la llave *secret*. |
| **Vista** | `app/**/page.js`, `app/admin/PanelAdmin.js`, `app/globals.css` | Páginas React (componentes cliente que llaman a la API con `fetch`). |
| **Controlador** | `app/api/**/route.js` | Route Handlers: comprueban sesión y rol, validan, llaman al modelo y al Core. |
| **Core (servicio de precio)** | `lib/core/calcularPrecio.js` y `lib/core/servicioPrecio.js` | Cálculo del precio con las 3 comparaciones. |
| **Validaciones** | `lib/validaciones/*.js` | Funciones puras (se prueban sin base de datos). |

### El Core

```
precio = tarifaBase × (1 + recargos) × (1 − descuento)
```

- **recargos** = recargo de la franja horaria + todos los recargos de calendario que apliquen
  (un sábado feriado acumula ambos).
- **descuento** = el mayor descuento de cliente frecuente que se cumpla; se aplica al final.
- Redondeo a 2 decimales, mitad hacia arriba, **una sola vez** (el cálculo usa enteros, sin errores de coma flotante).

Las tres comparaciones (marcadas con `COMPARACIÓN 1/2/3` en `lib/core/calcularPrecio.js`):

1. **Franja horaria:** hora de inicio de la reserva vs. el rango `horaInicio ≤ hora ≤ horaFin` de cada regla.
2. **Calendario:** día de la semana vs. `diaSemana` (0 = domingo … 6 = sábado) y fecha vs. `fecha` de las fechas especiales.
3. **Cliente frecuente:** reservas **CONFIRMADAS** del cliente en los 30 días previos vs. `minReservas`.

El sistema impide eliminar la tarifa base y la última regla de cada grupo, para que siempre existan las 3 comparaciones.

## Estructura de carpetas

```
app/
  layout.js, globals.css, icon.png, page.js   -> raíz, estilos globales, ícono, "/" (redirige)
  login/                                      -> inicio de sesión
  admin/                                      -> panel (layout con navegación)
    page.js                                   -> portada con resumen
    tarifas/ calculadora/ usuarios/ reservas/ -> módulos
    _comun/                                   -> utilidades de la interfaz (llamarApi, alertas...)
  api/
    auth/{login,logout,yo}                    -> sesión
    tarifas/, tipos-tarifa/                   -> CRUD de tarifas
    usuarios/                                 -> CRUD de usuarios
    reservas/, reservas/disponibilidad        -> reservas
    precio/calcular                           -> Core
    resumen                                   -> datos de la portada
lib/
  auth.js                                     -> usuario actual, requerirRol / requerirAdmin
  seguridad.js, http.js                       -> verificación de origen, ayudas HTTP
  configuracion.js                            -> horario, zona horaria, ventanas
  fechas.js, formato.js                       -> utilidades de fecha y de presentación
  core/                                       -> calcularPrecio (puro) y servicioPrecio (servidor)
  modelo/                                     -> consultas compartidas
  supabase/{server,admin}.js                  -> clientes de Supabase
  validaciones/                               -> tarifa, usuario, reserva, origen, comun
proxy.js                                      -> renueva la sesión y redirige sin sesión
supabase/                                     -> esquema.sql, datos-iniciales.sql, migraciones/
tests/                                        -> pruebas unitarias (*.test.mjs)
docs/                                         -> pruebas manuales, guion del video, informe final
```

## Requisitos

- **Node.js ≥ 20** (desarrollado con Node 24 y npm 11) y Git.
- Un proyecto de **Supabase** con la base de datos creada.

## Instalación paso a paso

1. Clona el repositorio e instala las dependencias:

   ```bash
   git clone <URL-DEL-REPOSITORIO>
   cd ponceano-soccer
   npm install
   ```

2. Crea tu archivo de variables de entorno copiando la plantilla:

   ```bash
   cp .env.example .env.local
   ```

3. Completa `.env.local` (ver siguiente sección) y arranca:

   ```bash
   npm run dev
   ```

   Abre <http://localhost:3000>: te llevará al inicio de sesión.

## Variables de entorno

Solo se listan los **nombres**; los valores están en el panel de Supabase (Project Settings → API).

| Variable | Dónde se usa | Notas |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Servidor y `proxy.js` | URL del proyecto. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Servidor y `proxy.js` | Llave `sb_publishable_...`. No da acceso a las tablas. |
| `SUPABASE_SECRET_KEY` | **Solo servidor** | Llave `sb_secret_...`. Jamás con prefijo `NEXT_PUBLIC_`. |

`.env.local` está ignorado por Git. **Nunca lo subas ni lo pegues en chats o capturas.**

## Base de datos

El esquema ya existe en Supabase. Los archivos de `supabase/` sirven como documentación y para repetirlo:

1. `supabase/esquema.sql` — esquema completo consolidado (tablas, enumerados, índices, RLS).
2. `supabase/datos-iniciales.sql` — los 5 tipos de tarifa.
3. `supabase/migraciones/` — cambios posteriores. Ejecútalos **en orden** en el *SQL Editor* de Supabase:
   - `001_indice_base_unica.sql` — garantiza una sola tarifa base.

RLS está activado en las 4 tablas **sin políticas** y sin permisos para `anon` ni `authenticated`: solo el servidor
(llave *secret*) accede a los datos. **No agregues políticas públicas.**

### Crear el primer ADMINISTRADOR

1. En Supabase: **Authentication → Users → Add user → Create new user**. Escribe correo y contraseña y marca
   **Auto Confirm User**.
2. En el **SQL Editor** inserta su fila en `usuarios` (el `id` debe ser el mismo que en Auth):

   ```sql
   insert into "usuarios" ("id", "correo", "nombre", "apellido", "rol")
   select "id", "email", 'NOMBRE', 'APELLIDO', 'ADMINISTRADOR'
   from auth.users
   where "email" = 'CORREO-DEL-ADMIN';
   ```

3. Inicia sesión en la aplicación. Los demás usuarios se crean desde **Usuarios** en el panel.

### Desactivar el registro público

En Supabase: **Authentication → Sign In / Providers** (en versiones anteriores, *Settings*) y desactiva
**Allow new users to sign up**. Así nadie puede crearse una cuenta por su cuenta: los usuarios los crea el
administrador desde el servidor.

## Roles y permisos

| Acción | ADMINISTRADOR | RECEPCIONISTA | CLIENTE |
| --- | :---: | :---: | :---: |
| Tarifas (ver, crear, editar, eliminar) | ✔ | — | — |
| Usuarios (ver, crear, editar, eliminar) | ✔ | — | — |
| Lista de clientes (solo nombre y correo) | ✔ | ✔ | — |
| Reservas (ver, crear, confirmar, cancelar) | ✔ | ✔ | — |
| Calculadora de precio | ✔ | ✔ | ✔ (solo para sí mismo, vía API) |
| Acceso al panel `/admin` | ✔ | ✔ | — (mensaje de acceso denegado) |

El rol **siempre se lee de la tabla `usuarios`** con el id de la sesión; nunca se confía en lo que envía el navegador.

## Seguridad implementada

- **Autenticación en el servidor** con Supabase Auth; la sesión viaja en cookies que renueva `proxy.js`.
- **Rol real desde la base de datos** (`lib/auth.js`); si la cuenta existe en Auth pero no en `usuarios`, se trata como no autenticada.
- **401/403 en cada ruta de la API** (`requerirRol`, `requerirAdmin`); la redirección de `proxy.js` es solo comodidad.
- **Validación completa en el servidor** y se guardan **solo los campos aprobados** (nunca el cuerpo tal cual).
- **El precio nunca viene del navegador:** lo calcula siempre el servidor con el Core.
- **Control de origen** (`Origin` vs `Host`) en todos los `POST/PUT/PATCH/DELETE`, incluidos login y logout (defensa contra CSRF).
- **Cabeceras de seguridad:** `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `COOP`, `HSTS` y **CSP** (en producción); las respuestas de la API van con `Cache-Control: no-store`.
- **RLS activado sin políticas:** el navegador no puede tocar las tablas; solo el servidor con la llave *secret* (`server-only`).
- **Contraseñas** gestionadas por Supabase Auth; exigidas ≥ 10 caracteres con mayúscula, minúscula y número; jamás se devuelven ni se registran.
- **Mensajes de error genéricos** al navegador (el detalle solo va al registro del servidor) y login sin revelar si el correo existe.
- **Reglas que protegen los datos:** no se elimina la tarifa base ni la última regla de cada comparación; no se elimina ni degrada al último administrador; no se borran usuarios con reservas; el horario no se puede reservar dos veces (índice único).
- **Registro público de Supabase desactivado** (ver arriba).

## Pruebas

```bash
npm test        # pruebas unitarias (validaciones, máquina de estados y Core)
npm run lint
npm run build
```

Las pruebas usan `node --test` con un patrón (`tests/**/*.test.mjs`): Node 24 no acepta un directorio como argumento.
Los módulos probados son funciones puras y se importan con rutas relativas explícitas (sin el alias `@/`).
Las pruebas manuales están en [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md).

## Despliegue en Vercel

1. Sube el repositorio a GitHub e impórtalo en Vercel (framework: Next.js; no cambies los comandos).
2. En **Settings → Environment Variables** crea las 3 variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) para Production (y Preview si lo usarás).
   `SUPABASE_SECRET_KEY` **no** debe marcarse como pública.
3. Despliega. Copia la URL resultante.
4. En Supabase: **Authentication → URL Configuration**: pon la URL de Vercel como **Site URL** y agrégala en **Redirect URLs**.
5. Ejecuta las migraciones pendientes de `supabase/migraciones/` y crea el primer administrador (ver arriba).
6. Prueba el inicio de sesión en el sitio desplegado.

## Documentación

- [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md) — lista de pruebas manuales con resultado esperado.
- [`docs/guion-video.md`](docs/guion-video.md) — guion del video explicativo (5–7 minutos).
- [`docs/informe-final.md`](docs/informe-final.md) — qué se hizo, decisiones, limitaciones y pendientes.
