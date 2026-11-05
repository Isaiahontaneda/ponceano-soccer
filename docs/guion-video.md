# Guion del video explicativo (5–7 minutos)

Pantalla compartida con el sitio desplegado (o local) y el editor de código a mano.
Antes de grabar: ten un administrador, un cliente con 3 reservas confirmadas y una ventana privada lista.

| Tiempo | Qué se muestra | Qué se dice |
| --- | --- | --- |
| 0:00–0:30 | Portada del repositorio / login | «Ponceano Soccer gestiona las reservas de una cancha sintética. El precio de cada reserva lo calcula un Core a partir de reglas que el administrador mantiene en este panel. Está hecho con Next.js y Supabase en arquitectura MVC.» |
| 0:30–1:10 | Login como administrador → portada | Iniciar sesión. «El login lo hace el servidor con Supabase Auth. El rol sale siempre de la tabla `usuarios`, no del navegador.» Señalar el resumen: reservas de hoy, tarifas y **comparaciones activas del Core: 3 de 3**. |
| 1:10–2:20 | **Tarifas** | Mostrar la tabla y la columna «Efecto en el precio». Abrir el desplegable de tipo (no ofrece «Tarifa base» porque ya existe). Crear una franja válida (p. ej. «Madrugada» 00:00–07:59, 5 %). Explicar: «la base va en dólares; los recargos y descuentos, en porcentaje, y el servidor los convierte a decimal». Editar una tarifa: el tipo está bloqueado. |
| 2:20–3:00 | Validaciones del servidor | Intentar una franja que se cruza (17:00–19:00) y un porcentaje `12.55`: mostrar el mensaje rojo del servidor. «La interfaz ayuda, pero la validación real está en el servidor; solo se guardan los campos aprobados.» |
| 3:00–3:30 | Protección del Core | Intentar eliminar la **tarifa base** y la **última regla de cliente frecuente**: mostrar el 409. «El Core necesita al menos una regla por comparación, así que el sistema no deja borrarlas.» |
| 3:30–4:40 | **Calculadora** | Sábado 2026-11-07, 19:00, sin cliente → **$54.00**; mostrar el desglose (base 40 + 25 % + 10 %). Luego elegir el cliente frecuente → **$48.60** con las **3 comparaciones ✔**. Mostrar un lunes a las 10:00 → $40.00 con solo la franja. |
| 4:40–5:30 | **Usuarios** y **Reservas** | Crear un usuario (la contraseña con `type="password"`, validación de contraseña). Intentar eliminarse a sí mismo (bloqueado). En Reservas: elegir cliente y fecha, ver que la hora solo ofrece bloques libres, ver el precio estimado, crear, confirmar y cancelar. «El precio se recalcula en el servidor; si alguien enviara otro precio, se ignora.» |
| 5:30–6:30 | Recorrido por el código | `app/admin/tarifas/page.js` (**Vista**) → `app/api/tarifas/route.js` (**Controlador**: `verificarOrigen`, `requerirAdmin`, validar, guardar) → `lib/validaciones/tarifa.js` (validación pura) → `lib/core/calcularPrecio.js` (**Core**: el `for` con `COMPARACIÓN 1/2/3`) → `lib/core/servicioPrecio.js` → `tests/core.test.mjs`. Ejecutar `npm test`. |
| 6:30–7:00 | Ventana privada y sitio desplegado | En ventana privada abrir `/admin/tarifas` → redirige a login; abrir `/api/tarifas` → 401. Mostrar la URL de Vercel. «Las llaves secretas solo existen en el servidor.» Cierre. |

## Consejos

- Si algo se alarga, recorta el recorrido por el código; la demostración de las 3 comparaciones es lo más importante.
- Antes de grabar, repasa `docs/pruebas-manuales.md` para tener los casos ya probados.
- No muestres `.env.local` ni el panel de llaves de Supabase.
