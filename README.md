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
| Cálculo de precio | `lib/core/` |
| Validaciones (funciones puras) | `lib/validaciones/` |

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

En el SQL Editor de Supabase ejecuta, en orden: `supabase/esquema.sql`, `supabase/datos-iniciales.sql` y las
migraciones de `supabase/migraciones/`. Las tablas tienen RLS activado sin políticas: solo el servidor accede.

**Primer administrador:** en Authentication → Users crea el usuario (con *Auto Confirm User*) y luego ejecuta:

```sql
insert into "usuarios" ("id", "correo", "nombre", "apellido", "rol")
select "id", "email", 'NOMBRE', 'APELLIDO', 'ADMINISTRADOR'
from auth.users where "email" = 'CORREO-DEL-ADMIN';
```

Después, los demás usuarios (incluidos más administradores) se crean desde **Usuarios** en el panel.
Desactiva también el registro público en Authentication → Sign In / Providers.

## Roles

- **Administrador:** todo (tarifas, usuarios, reservas, calculadora).
- **Recepcionista:** reservas y calculadora.
- **Cliente:** sin acceso al panel.

El rol se lee siempre de la tabla `usuarios`, nunca del navegador.

## Seguridad

Sesión validada en el servidor, 401/403 en cada ruta de la API, validación completa en el servidor, precio calculado
solo en el servidor, control de `Origin` en las escrituras, cabeceras de seguridad y CSP, y llave secreta solo en
código de servidor.

## Pruebas

```bash
npm test         # pruebas unitarias
npm run lint
npm run build
```

Pruebas manuales: [`docs/pruebas-manuales.md`](docs/pruebas-manuales.md).

## Despliegue en Vercel

1. Importa el repositorio de GitHub en Vercel.
2. Crea las 3 variables de entorno (la secreta sin marcar como pública).
3. En Supabase, Authentication → URL Configuration: pon la URL de Vercel como Site URL.

Más detalle en [`docs/informe-final.md`](docs/informe-final.md) y [`docs/guion-video.md`](docs/guion-video.md).
