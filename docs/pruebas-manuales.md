# Pruebas manuales — Ponceano Soccer

Haz estas pruebas con la aplicación en marcha (`npm run dev` o el sitio desplegado).
Necesitas: un usuario **ADMINISTRADOR**, uno **RECEPCIONISTA** y uno **CLIENTE** (puedes crearlos desde
*Usuarios*), y las tarifas reales cargadas (base $40; día 08:00–17:59 0 %; hora pico 18:00–21:59 +25 %;
noche 22:00–23:59 +12.5 %; sábado +10 %; feriado 2026-11-02 +20 %; cliente frecuente −10 % desde 3 reservas).

Marca cada fila cuando el resultado coincida con lo esperado.

## 1. Inicio y cierre de sesión

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 1.1 | Abrir `/` sin sesión | Redirige a `/login`. |
| 1.2 | Login con correo y contraseña correctos (admin) | Entra a `/admin` y se ven el nombre, el rol y las 5 secciones. |
| 1.3 | Login con contraseña incorrecta | Mensaje «Correo o contraseña incorrectos» (rojo, anunciado como alerta). |
| 1.4 | Login con un correo que no existe | **El mismo** mensaje que en 1.3 (no revela si el correo existe). |
| 1.5 | Login con una cuenta que está en Auth pero no en la tabla `usuarios` | Mensaje «Tu cuenta no está registrada…» y no queda sesión abierta. |
| 1.6 | Con sesión abierta, abrir `/` | Redirige a `/admin`. |
| 1.7 | Pulsar **Cerrar sesión** | Vuelve a `/login`. Al pulsar «atrás» y entrar a `/admin`, redirige a `/login`. |

## 2. Acceso sin sesión y con rol insuficiente

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 2.1 | Sin sesión, abrir `/admin`, `/admin/tarifas`, `/admin/usuarios` | Redirige a `/login`. |
| 2.2 | Sin sesión (ventana privada), abrir `/api/tarifas` | `401` con `{"error":"No autenticado"}`. |
| 2.3 | Sin sesión, abrir `/api/usuarios`, `/api/reservas`, `/api/resumen` | `401` en todas. |
| 2.4 | Entrar como **CLIENTE** y abrir `/admin` | Mensaje «Tu cuenta no tiene acceso al panel…»; sin navegación. |
| 2.5 | Como CLIENTE, abrir `/api/tarifas` y `/api/usuarios` | `403`. |
| 2.6 | Como **RECEPCIONISTA**, abrir `/admin/tarifas` | La sección no aparece en el menú; la página muestra «No tienes permiso…». |
| 2.7 | Como RECEPCIONISTA, abrir `/api/usuarios` (sin filtro) | `403`. Con `?rol=CLIENTE` devuelve solo `id`, `nombre`, `apellido` y `correo`. |
| 2.8 | Como RECEPCIONISTA, entrar a Reservas y Calculadora | Funcionan. |

## 3. Tarifas (admin)

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 3.1 | Abrir **Tarifas** | Se ve «Comparaciones activas del Core: 3 de 3» con ✔ en las tres. |
| 3.2 | Abrir el desplegable «Tipo de tarifa» | **No** aparece «Tarifa base» (ya existe). |
| 3.3 | Crear franja `Madrugada`, 00:00 a 07:59, `5` (%) | Se crea; en la tabla aparece «+5 %» y el efecto «$42.00 por hora (base + 5 %)». |
| 3.4 | Crear otra franja 17:00 a 19:00 | Rechazada: «La franja se cruza con…». |
| 3.5 | Crear franja con inicio 22:00 y fin 21:00 | Rechazada: «La hora de inicio debe ser menor que la hora de fin.» |
| 3.6 | Valor `12.55` (dos decimales) en un recargo | Rechazado: «máximo 1 decimal». |
| 3.7 | Valor `101` o `-1` en un recargo | Rechazado: debe estar entre 0 y 100. |
| 3.8 | Nombre vacío o de más de 60 caracteres | Rechazado. |
| 3.9 | Crear otro «Día de la semana» = Sábado | Rechazado: «Ya existe una regla para ese día». |
| 3.10 | Crear otra «Fecha especial» = 2026-11-02 | Rechazada: «Ya existe una regla para esa fecha». |
| 3.11 | Cliente frecuente con mínimo `0` | Rechazado: debe ser entero ≥ 1. |
| 3.12 | Editar «Hora pico» | El desplegable de tipo está **bloqueado**; el valor aparece como `25` (porcentaje). |
| 3.13 | Editar la tarifa base a `45.50` | Se guarda; las franjas muestran los nuevos precios por hora. |
| 3.14 | Tarifa base con `0`, `-5`, `1001` o `40.123` | Rechazada con mensaje claro. |
| 3.15 | **Eliminar la tarifa base** | Error 409: «No puedes eliminar la tarifa base…». |
| 3.16 | Eliminar la **única** regla de cliente frecuente | Error 409: «No puedes eliminar la última regla de cliente frecuente…». |
| 3.17 | Eliminar «Sábado» (queda el feriado) y luego intentar eliminar el feriado | Lo primero funciona; lo segundo da 409 (última regla de calendario). Vuelve a crear «Sábado». |
| 3.18 | Eliminar una franja si hay otras | Funciona tras confirmar. |
| 3.19 | (Avanzada) Enviar con la consola del navegador un `PUT` cambiando `tipoId` | `422`: «El tipo de una tarifa no se puede cambiar.» |

## 4. Calculadora

Todas con **Cliente = Sin cliente**, salvo donde se indica.

| # | Fecha | Hora | Cliente | Precio esperado | Comparaciones |
| --- | --- | --- | --- | --- | --- |
| 4.1 | lunes 2026-11-09 | 10:00 | Sin cliente | **$40.00** | franja ✔ (Día, 0 %), calendario —, cliente — |
| 4.2 | lunes 2026-11-09 | 19:00 | Sin cliente | **$50.00** | franja ✔ (Hora pico) |
| 4.3 | lunes 2026-11-09 | 22:00 | Sin cliente | **$45.00** | franja ✔ (Noche, 12.5 %) |
| 4.4 | sábado 2026-11-07 | 19:00 | Sin cliente | **$54.00** = 40 × (1 + 0.25 + 0.10) | franja ✔, calendario ✔ (Sábado) |
| 4.5 | lunes feriado 2026-11-02 | 10:00 | Sin cliente | **$48.00** = 40 × 1.20 | calendario ✔ (Feriado) |
| 4.6 | sábado 2026-11-07 | 19:00 | cliente con ≥ 3 reservas **confirmadas** en los 30 días previos | **$48.60** = 54 × 0.90 | las tres ✔ |
| 4.7 | sábado 2026-11-07 | 19:00 | cliente con solo 2 reservas confirmadas | **$54.00** | cliente frecuente — |

Comprobaciones adicionales:

- Se muestra el desglose paso a paso (base, recargos, subtotal, descuento) y el precio final.
- Las reservas **PENDIENTES** o **CANCELADAS** no cuentan para el cliente frecuente; solo las CONFIRMADAS
  y solo las de los 30 días **anteriores** a la fecha.
- Sin fecha u hora, el navegador no deja enviar el formulario.
- Si se borra la tarifa base de la base de datos, la calculadora responde 409 «No hay una tarifa base…».

## 5. Usuarios (admin)

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 5.1 | Crear usuario válido (rol Cliente) | Aparece en la tabla; el campo de contraseña se vacía. |
| 5.2 | Crear con el mismo correo (en mayúsculas) | 409: «Ya existe un usuario con ese correo.» |
| 5.3 | Correo sin `@` o con espacios | Rechazado. |
| 5.4 | Contraseña de 9 caracteres, o sin mayúscula, minúscula o número | Rechazada con mensaje claro. |
| 5.5 | Nombre con números o símbolos (`Ana3`, `<b>`) | Rechazado. |
| 5.6 | Nombre con tildes, ñ, guion o apóstrofe (`José Ñúñez`, `O'Neil-Pérez`) | Aceptado. |
| 5.7 | Editar un usuario | El correo está bloqueado; se pueden cambiar nombre, apellido y rol. |
| 5.8 | Tu propia fila | El botón **Eliminar** está deshabilitado; en la API, 409 si lo intentas. |
| 5.9 | Cambiarte a ti mismo el rol a Cliente | 409: «No puedes quitarte a ti mismo el rol de administrador.» |
| 5.10 | Con un solo administrador en el sistema, degradarlo desde otra cuenta | 409: «No se puede degradar al último administrador…». |
| 5.11 | Eliminar un cliente **con reservas** | 409: «No se puede eliminar al usuario porque tiene N reserva(s)…». |
| 5.12 | Eliminar un cliente sin reservas | Se elimina (también desaparece de Authentication → Users en Supabase). |
| 5.13 | La contraseña nunca se ve en la pestaña Red del navegador en respuestas, ni en la consola del servidor | Correcto. |

## 6. Reservas

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 6.1 | Abrir **Reservas** | Fecha de hoy (Ecuador) y tabla del día. |
| 6.2 | Elegir cliente, fecha futura y hora | El desplegable de hora solo muestra bloques **libres**; aparece «Precio estimado». |
| 6.3 | Crear la reserva | Mensaje con el código `R-AAAAMMDD-HHMM-XXXX` y el precio; estado **Pendiente**. |
| 6.4 | Volver a elegir la misma fecha | La hora recién reservada ya no aparece; se muestra en «Ocupados». |
| 6.5 | Elegir la fecha de **hoy** | No aparecen las horas que ya empezaron. |
| 6.6 | (Avanzada) Enviar por la consola un `POST /api/reservas` con fecha pasada | `422`: «No se puede reservar en una fecha pasada.» |
| 6.7 | (Avanzada) Enviar un `POST` con `"precio": 0.01` | Se ignora: el precio guardado es el calculado por el Core. |
| 6.8 | (Avanzada) Reservar dos veces el mismo horario | `409`: «Ese horario ya está reservado». |
| 6.9 | **Confirmar** una reserva pendiente | Estado **Confirmada**; quedan solo el botón Cancelar. |
| 6.10 | **Cancelar** una reserva confirmada o pendiente | Estado **Cancelada**; sin botones; el horario vuelve a quedar libre. |
| 6.11 | (Avanzada) `PATCH` de CANCELADA a CONFIRMADA o de CONFIRMADA a PENDIENTE | `409`. |
| 6.12 | Comprobar el cliente frecuente: confirmar 3 reservas de un cliente y calcular para una fecha posterior | Aplica el −10 %. |

## 7. Seguridad general

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 7.1 | Ventana privada: abrir `/admin/tarifas` | Redirige a `/login`. |
| 7.2 | Ventana privada: abrir `/api/auth/yo` | `401`. |
| 7.3 | `curl -X POST -H "Origin: https://otro.com" <sitio>/api/auth/logout` | `403` «Origen de la solicitud no permitido». |
| 7.4 | Revisar las cabeceras de la página en la pestaña Red | Presentes: `Content-Security-Policy` (producción), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. |
| 7.5 | Revisar el código fuente entregado al navegador (Ver código fuente / pestaña Fuentes) | No aparece ninguna llave `sb_secret_`. |
| 7.6 | Intentar poner el sitio dentro de un `<iframe>` | El navegador lo bloquea. |
| 7.7 | Mensaje de error interno forzado (p. ej., apagar la red de Supabase) | El navegador ve un mensaje genérico, sin detalles de base de datos. |

## 8. Interfaz

| # | Prueba | Resultado esperado |
| --- | --- | --- |
| 8.1 | Navegar solo con teclado (Tab) | El foco se ve siempre (recuadro azul); «Saltar al contenido» aparece al empezar. |
| 8.2 | Reducir la ventana a ancho de móvil (≈ 375 px) | Sin desplazamiento horizontal de la página; las tablas se desplazan dentro de su caja. |
| 8.3 | Sección activa del menú | Subrayada en naranja y con color verde. |
| 8.4 | Pestañas del navegador | Títulos en español: «Tarifas — Ponceano Soccer», etc. El ícono es el logo. |
| 8.5 | Sistema operativo en modo oscuro | La aplicación se sigue viendo en tema claro. |
