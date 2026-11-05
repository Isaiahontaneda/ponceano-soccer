# Informe final — Ponceano Soccer: panel de administración y Core

Rama: `admin-completo` (solo commits locales; no se hizo `git push` ni despliegue).

## 1. Qué se hizo por fase

### Fase 1 — Tarifas
- Validación en `lib/validaciones/tarifa.js`: nombre 1–60; base en dólares (0 < v ≤ 1000, 2 decimales); recargos/descuentos en **porcentaje** (0–100, 1 decimal) convertidos a decimal; campos según el tipo (el resto en `null`); franjas sin cruces; una sola base; sin repetir día ni fecha; `minReservas` entero ≥ 1; tipo desconocido → error.
- `PUT /api/tarifas/[id]` rechaza (422) cambiar el tipo. `DELETE` da 409 para la base y para la última regla de cada grupo (`motivoNoEliminable`, `GRUPOS_CORE`).
- Interfaz: la base no se ofrece si ya existe; tipo bloqueado al editar; etiqueta y ayuda del valor según el tipo; indicador «Comparaciones activas del Core: n de 3» con ✔/✖ y aviso si falta la base; columna «Efecto en el precio»; al editar se carga el porcentaje.
- Migración `supabase/migraciones/001_indice_base_unica.sql`.

### Fase 2 — Core
- `lib/core/calcularPrecio.js`: función pura, con `for` sobre las tarifas y comentarios `COMPARACIÓN 1/2/3`. Aritmética entera (centavos y milésimas): redondeo exacto, mitad hacia arriba, una sola vez.
- `lib/core/servicioPrecio.js`: carga tarifas, cuenta reservas CONFIRMADA de los 30 días previos (`fecha >= fecha-30` y `< fecha`) y llama al Core. Lo reutiliza la creación de reservas.
- `POST /api/precio/calcular` (cualquier rol; un CLIENTE solo para sí mismo) y `GET /api/usuarios?rol=CLIENTE` (admin y recepcionista, solo `id`, `nombre`, `apellido`, `correo`).
- Calculadora `/admin/calculadora` con desglose y las 3 comparaciones (✔/—).
- Pruebas del Core con todos los casos pedidos (40, 50, 45, 54, 48, 48.60, 03:00, sin base, dos descuentos) y más.

### Fase 3 — Usuarios
- `GET/POST /api/usuarios`, `PUT/DELETE /api/usuarios/[id]`. Crear: Auth (`createUser`, `email_confirm`) + insert en `usuarios`, con **rollback** en Auth si el insert falla.
- Validaciones: correo (normalizado, único), contraseña ≥ 10 con mayúscula/minúscula/número (nunca se devuelve ni se registra), nombre y apellido 1–60 solo letras latinas con tildes/ñ, espacios, guion, apóstrofe; rol del enumerado.
- Reglas: no eliminarse ni quitarse el rol a uno mismo; no eliminar ni degradar al último administrador; no eliminar usuarios con reservas (409). Se borra primero en Auth.
- Pantalla `/admin/usuarios`.

### Fase 4 — Reservas
- `GET/POST /api/reservas`, `PATCH /api/reservas/[id]`, `GET /api/reservas/disponibilidad`.
- El precio lo calcula siempre el servidor; se ignoran `precio`, `estado` y `codigo` del navegador. Código `R-AAAAMMDD-HHMM-XXXX` con reintento ante choque. Error `23505` del índice de horario → 409 «Ese horario ya está reservado».
- Validaciones: cliente existente con rol CLIENTE; fecha válida y no pasada en `America/Guayaquil`; bloque válido; si es hoy, el bloque no puede haber empezado.
- Máquina de estados: PENDIENTE→CONFIRMADA/CANCELADA, CONFIRMADA→CANCELADA; CANCELADA es final (409 en lo demás).
- Pantalla `/admin/reservas`: hora dependiente de la fecha (solo bloques libres) y precio estimado antes de guardar.

### Fase 5 — Identidad visual y navegación
- Logo `public/logo.png` con `next/image` en encabezado y login, y como ícono (`app/icon.png`). Paleta extraída del logo con Python/PIL fuera del proyecto: naranja `#FF642C`, verde `#005010`, negro.
- `app/globals.css` con variables y clases; sin estilos en línea. Tema claro, foco visible, enlace «Saltar al contenido», responsivo.
- `app/admin/layout.js` + `PanelAdmin.js` (encabezado, navegación por rol, usuario y rol, «Cerrar sesión», sección activa). Portada `/admin` con tarjetas y resumen real (`/api/resumen`).
- `/` redirige (por `proxy.js`: con sesión a `/admin`, sin sesión a `/login`; `app/page.js` queda como respaldo). Se eliminó la página de ejemplo de Next.js y sus recursos. `<html lang="es">` y títulos por sección.

### Fase 6 — Seguridad y calidad
- `lib/seguridad.js`: `verificarOrigen` (compara `Origin` con `Host`) en **todos** los POST/PUT/PATCH/DELETE, login y logout incluidos; la regla pura está probada.
- Cabeceras (`next.config.mjs`): `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `COOP`, `HSTS`, `Cache-Control: no-store` en `/api`, y **CSP** (solo en producción).
- Revisión de las rutas con la lista pedida (sesión, rol, validación, `maybeSingle`, campos devueltos, errores genéricos, sin `console.log`): corregidas las de la versión anterior (`.single()` en `obtenerUsuarioActual`, mensajes de error, ids).
- `server-only` en todo módulo de servidor con llaves; ningún componente cliente importa módulos de servidor (verificado con búsqueda).
- `.env.example` con los 3 nombres; `.gitignore` ignora `.env*` salvo la plantilla.

### Fase 7 — Documentación
- `README.md`, `docs/pruebas-manuales.md`, `docs/guion-video.md`, `supabase/esquema.sql`, `supabase/datos-iniciales.sql` y este informe.

### Fase 8 — Preparación del despliegue
- `npm run build` pasa sin errores ni advertencias. Las variables y los ajustes de Supabase están en la sección 2.

### Commits (rama `admin-completo`)
```
aaae263 feat(tarifas): validación en porcentaje, protección del Core, identidad visual y pruebas
6678975 feat(core): cálculo de precio con tres comparaciones y calculadora en el panel
c6431bc feat(usuarios): módulo de usuarios con creación segura, reglas de negocio y pruebas
bf99d55 feat(reservas): módulo de reservas con precio calculado por el servidor y máquina de estados
9b68a0c feat(seguridad): portada del panel, cabeceras de seguridad, CSP y plantilla de variables
(+ commit de documentación y entregables, el último de la rama)
```
Nota: los cambios de identidad visual, portada y seguridad se repartieron en los commits anteriores en lugar de hacer un commit por fase estricta; la Fase 5 y la 6 quedaron en los commits 1 y 5.

## 2. Qué debes hacer tú a mano

1. **Migraciones SQL en Supabase** (SQL Editor, en este orden):
   1. `supabase/migraciones/001_indice_base_unica.sql` (índice único de la tarifa base). Antes comprueba que solo haya **una** fila con `tipoId = 1`; si hubiera dos, el índice fallará. Hasta que lo ejecutes, el código igualmente impide una segunda base (validación), y si el índice existe, la carrera se detecta con el error 23505 → 409.
   - `esquema.sql` y `datos-iniciales.sql` son documentación: **no** hace falta ejecutarlos en tu proyecto actual.
2. **Ajustes en Supabase:** desactivar el registro público (*Authentication → Sign In / Providers → Allow new users to sign up*), y tras desplegar poner la URL de Vercel en *Authentication → URL Configuration* (Site URL y Redirect URLs).
3. **Logo:** no hizo falta copiarlo: `public/logo.png` existía (estaba sin versionar y quedó incluido en el primer commit).
4. **Variables en Vercel** (Production, y Preview si la usarás): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (esta última nunca pública).
5. Crear los usuarios de prueba (un recepcionista y uno o más clientes) desde el panel, y hacer las pruebas manuales.
6. Hacer `git push` y desplegar cuando quieras (no lo hice por instrucción).

## 3. Resultados

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Sin errores ni advertencias. |
| `npm test` | **82 pruebas, 82 pasan**, 0 fallan. |
| `npm run build` | Compila sin errores ni advertencias; 13 rutas de API, la portada, el login y los 4 módulos del panel. |
| `npm audit` | **0 vulnerabilidades en dependencias de producción** (`--omit=dev`). 8 de severidad moderada en la cadena de desarrollo `eslint-config-next → typescript-eslint → minimatch` (ReDoS en `minimatch`, solo afecta a las herramientas de lint, no al sitio). La única corrección propuesta es `npm audit fix --force`, que **degradaría** `eslint-config-next` a 15.5.29 (cambio mayor); no se aplicó. |
| Búsqueda de llaves | Ningún archivo versionado ni el historial de Git contiene `sb_secret_`, `sb_publishable_` ni JWT. `.env.local` no está versionado. |

También probé con `next start` y `curl`, **sin sesión**: `/` y `/admin*` redirigen a `/login` (307); las 8 rutas GET y las 9 de escritura dan 401; un `Origin` ajeno da 403 (login, logout, DELETE); un `Origin` propio llega a la validación (400); las cabeceras de seguridad están presentes y el HTML solo referencia recursos del mismo origen.

## 4. Decisiones que tomé por mi cuenta

- **Pruebas:** `node --test tests/` (directorio) falla en Node 24 («Cannot find module»). Usé el patrón `node --test "tests/**/*.test.mjs"`. Sin `"type": "module"`: los módulos puros se importan con rutas relativas y extensión, y Node 24 detecta ESM por sintaxis.
- **Franjas cruzadas:** el Core usa extremos incluidos (`inicio ≤ hora ≤ fin`), así que dos franjas que se tocan en un extremo (p. ej. …18:00 y 18:00…) cuentan como cruzadas y se rechazan.
- **«Si es hoy, no ha pasado ya»:** interpretado como que el bloque **no puede haber empezado** (`horaInicio ≤ hora actual` se rechaza). Es lo más restrictivo; si quieres permitir reservar el bloque en curso, se cambia en `lib/validaciones/reserva.js`.
- **Límite de anticipación:** máximo 365 días (constante `MAX_DIAS_ANTICIPACION`) para evitar fechas absurdas.
- **Contraseña:** máximo 72 caracteres (límite práctico de bcrypt).
- **Nombres:** solo alfabeto latino; se juntan espacios repetidos; un solo separador entre palabras.
- **Reservas de hoy** en la portada y la disponibilidad: no cuentan las canceladas (liberan el horario).
- **CSP:** conservadora (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`…) pero con `'unsafe-inline'` en scripts y estilos, necesario para la hidratación de Next.js. Una CSP con *nonce* exigiría renderizar dinámicamente todas las páginas y renunciar al prerenderizado de Cache Components. Solo se envía en producción para no arriesgar el modo `dev`.
- **Control de origen:** si falta `Origin` (curl, herramientas) se permite salvo que `Sec-Fetch-Site` indique `cross-site`/`same-site`; con `Origin` presente debe coincidir exactamente con `Host`.
- **Login:** además de autenticar, comprueba que exista la fila en `usuarios`; si no, cierra la sesión y responde 403 (así no queda una sesión a medias que provoque redirecciones en bucle).
- **Panel por rol:** el RECEPCIONISTA ve Calculadora y Reservas; un CLIENTE que inicia sesión ve un aviso de acceso denegado.
- **Estilos:** `app/globals.css` único (no CSS Modules). El naranja no se usa como color de texto (no llega a 4.5:1); los botones son verde oscuro con texto blanco.
- **Archivos retirados:** `app/page.module.css`, `app/favicon.ico` y los SVG de ejemplo de `public/` (eran de la plantilla de Next.js).
- **Geist Mono** se quitó del layout porque ya no se usa.
- **Redirección de `/`:** hecha en `proxy.js` (sin leer cookies en un componente de servidor, compatible con Cache Components).

## 5. Limitaciones conocidas

- **Condiciones de carrera sin transacciones:** las reglas «último administrador», «última regla de un grupo del Core» y «una sola base» se comprueban leyendo y luego escribiendo; dos peticiones simultáneas podrían saltárselas (la base lo evita solo para el horario de reservas y, tras la migración 001, para la tarifa base). Para cerrarlas del todo harían falta funciones SQL transaccionales.
- **Crear usuario no es atómico entre Auth y la tabla:** hay *rollback* en Auth, pero si ese borrado también fallara quedaría una cuenta huérfana (se registra en el log del servidor).
- **Sin límite de intentos de login propio:** se delega en el límite de Supabase Auth.
- **El «mínimo de reservas» solo cuenta CONFIRMADAS de los 30 días previos**; no hay editor para la ventana de 30 días (constante en `lib/configuracion.js`).
- **Un CLIENTE no tiene todavía pantallas propias:** el sistema es de administración; la calculadora para clientes existe solo en la API.
- **Precio de reservas ya creadas:** no se recalcula si cambian las tarifas (queda guardado el precio del momento).
- **`esquema.sql` es una reconstrucción** hecha a partir de la descripción del esquema, no un volcado de tu base; los textos de `tiposTarifa.nombre` de `datos-iniciales.sql` son los que usé yo.
- **Horario en cambios de día:** «hoy» y la hora actual se calculan en `America/Guayaquil` en el servidor; la interfaz de reservas usa lo mismo en el navegador.

## 6. Pruebas manuales y lo que no pude comprobar

Hazlas con [`pruebas-manuales.md`](pruebas-manuales.md).

**No pude comprobar** (no tengo credenciales ni navegador, y no leí `.env.local`):
- Ningún flujo **con sesión iniciada**: login real, CRUD de tarifas, usuarios y reservas contra tu Supabase, creación de cuentas en Auth, el rollback, y los permisos por rol con cuentas reales. La lógica está cubierta por pruebas unitarias de las funciones puras y revisada leyendo el código, pero **las rutas con base de datos no se ejecutaron**.
- Que la **CSP no rompa nada en un navegador real** (solo verifiqué cabeceras y que el HTML referencia únicamente recursos propios). Si ves algo roto en producción, revisa la consola; la política se ajusta en `next.config.mjs` o se quita una línea.
- La apariencia visual (colores, responsivo, foco) en pantalla: se diseñó con contrastes calculados, pero **no la vi renderizada**.
- La migración 001 contra tu base y la existencia exacta del nombre del índice `reservas_horario_unico` en el mensaje del error `23505` (el código lo busca por ese nombre; si el mensaje no lo incluyera, el choque se trataría como colisión de código y acabaría en un error 500 genérico tras 5 intentos, en lugar del 409; el precomprobado del horario cubre el caso normal).
- El comportamiento con Vercel (`Host` y `Origin` en producción deberían coincidir; si usas un dominio propio detrás de otro proxy y ves 403 en los envíos, habrá que revisarlo).

## 7. Puntos en que el código no cumple lo pedido o lo cumple distinto

- **Commits por fase:** no hay exactamente un commit por cada una de las 8 fases (las fases 5 y 6 se repartieron en los commits 1 y 5, y las fases 7–8 van en el último).
- **`npm test`:** el script no es `node --test tests/` sino con patrón (razón en la sección 4).
- **`/api/resumen`** es una ruta nueva que no estaba en la lista; la portada la necesita para no inventar datos.
- **CSP:** presente pero con `'unsafe-inline'`; no es una CSP «estricta».
- **Prueba de rutas con base de datos:** no se ejecutó ninguna (ver sección 6).
- La Fase 8 pide listar los ajustes de Supabase y Vercel: están en la sección 2.
