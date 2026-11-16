# Informe — Fase B (el cliente reserva) y Fase C (reporte de ingresos)

Rama: `cliente-e-ingresos`.

## 1. Archivos creados y modificados

### Creados

| Archivo | Para qué sirve |
| --- | --- |
| `backend/modelo/reservas.js` | `crearReserva`: crea una reserva pendiente con el precio del Core. La usan el personal y el cliente. |
| `backend/controladores/misReservas.js` | Rutas del cliente: ver sus reservas, reservar y cancelar. |
| `backend/controladores/ingresos.js` | Ruta del reporte de ingresos (solo administrador). |
| `backend/validaciones/ingresos.js` | Funciones puras `validarRangoIngresos` y `agruparIngresos`. |
| `app/api/mis-reservas/route.js`, `app/api/mis-reservas/[id]/route.js` | Archivos finos de las rutas del cliente. |
| `app/api/reportes/ingresos/route.js` | Archivo fino de la ruta del reporte. |
| `app/reservar/page.js`, `app/reservar/layout.js` | Página del cliente. |
| `app/admin/ingresos/page.js`, `app/admin/ingresos/layout.js` | Página de ingresos. |
| `frontend/componentes/PanelCliente.js` | Marco del cliente: logo, nombre y "Cerrar sesión". |
| `frontend/paginas/Reservar.js` | Pantalla del cliente: nueva reserva y "Mis reservas". |
| `frontend/paginas/Ingresos.js` | Pantalla del reporte de ingresos. |
| `tests/core.test.js`, `tests/cancelacion.test.js`, `tests/ingresos.test.js` | Pruebas automáticas (24). |
| `docs/pruebas-manuales-fase-bc.md` | Pruebas manuales paso a paso. |
| `docs/informe-fase-bc.md` | Este informe. |

### Modificados

| Archivo | Qué cambió |
| --- | --- |
| `backend/controladores/reservas/reservas.js` | El `POST` ahora llama a `crearReserva`. Responde igual que antes. |
| `backend/controladores/reservas/disponibilidad.js` | También la puede consultar el cliente. |
| `backend/controladores/auth/login.js` | Responde `{ ok: true, rol }`. |
| `backend/validaciones/reserva.js` | Nueva función `validarCancelacionCliente`. |
| `backend/configuracion.js` | Nueva constante `MAX_PENDIENTES_POR_CLIENTE = 3`. |
| `frontend/paginas/Login.js` | El cliente va a `/reservar`; el resto, a `/admin`. |
| `frontend/componentes/PanelAdmin.js` | Enlace "Ingresos" (solo administrador) y redirección del cliente a `/reservar`. |
| `proxy.js` | Sin sesión, `/reservar` redirige a `/login`. |
| `package.json` | Script `"test": "node --test"`. |
| `README.md` | Secciones Funcionalidades, Roles y Seguridad. |

No se tocaron `backend/core/calcularPrecio.js`, `frontend/paginas/Reservas.js` ni `.env.local`.
No se agregaron dependencias.

## 2. Cómo probarlo

1. `npm test` ejecuta las pruebas automáticas.
2. `npm run dev` y sigue `docs/pruebas-manuales-fase-bc.md`.

Resumen rápido: crea un cliente desde **Usuarios**, inicia sesión con él (llega a `/reservar`), elige fecha y hora,
reserva, y luego confirma esa reserva como recepcionista desde **Reservas**. Como administrador, abre **Ingresos**.

## 3. Salida de las comprobaciones

### `npm run lint`

Sin errores ni avisos (el comando termina sin imprimir nada más que su encabezado):

```
> ponceano-soccer@0.1.0 lint
> eslint
```

### `npm run build`

```
✓ Compiled successfully in 2.5s
✓ Generating static pages using 19 workers (24/24) in 1075ms

Route (app)
├ ○ /admin/ingresos
├ ƒ /api/mis-reservas
├ ƒ /api/mis-reservas/[id]
├ ƒ /api/reportes/ingresos
├ ƒ /api/reservas/disponibilidad
└ ○ /reservar
   (más las rutas que ya existían)
```

### `npm test`

```
ℹ tests 24
ℹ pass 24
ℹ fail 0
```

- `core.test.js`: 6 pruebas (los seis precios de ejemplo).
- `cancelacion.test.js`: 7 pruebas.
- `ingresos.test.js`: 11 pruebas.

Node imprime el aviso `MODULE_TYPELESS_PACKAGE_JSON` porque `package.json` no declara `"type": "module"`. No afecta
el resultado. No se agregó ese campo para no cambiar cómo carga Next.js los demás archivos.

## 4. Desviaciones

1. **Errores internos dentro de `crearReserva`.** La función devuelve `{ estado, cuerpo }`, así que no puede usar
   `errorInterno` (que devuelve una respuesta HTTP ya armada). Tiene una función local de 3 líneas, `fallo`, que
   hace lo mismo: escribe el detalle en el log y devuelve solo el mensaje genérico con estado 500.
2. **`crearReserva` se partió en dos.** La inserción con reintento de código quedó en `insertarReserva`, en el mismo
   archivo, para que ninguna de las dos funciones sea larga.
3. **Rango de 366 días, contando los dos extremos.** Del 1 de enero al 31 de diciembre de un año bisiesto son 366 días
   y se acepta; un día más se rechaza.
4. **Cancelación del cliente.** Además de `.eq("estado", "PENDIENTE")`, la actualización lleva
   `.eq("clienteId", usuario.id)` como segunda barrera. Un id que no es un número responde 400 "Id inválido", igual
   que la ruta del personal.
5. **Mensaje de "falta la tarifa base".** Al compartir `crearReserva`, el cliente recibe el mismo texto que el
   personal ("Créala antes de registrar reservas"). En la práctica casi no lo verá: sin tarifa base tampoco se puede
   calcular el precio, y el botón "Reservar" solo aparece cuando hay precio.
6. **"Total esperado" se suma en el navegador.** Son solo dos números que ya vienen redondeados del servidor y se
   muestran con 2 decimales. Las sumas de muchas reservas sí se hacen en centavos, en el servidor.
7. **Desglose en tabla.** El desglose del precio se muestra con la misma tabla y las mismas clases CSS que la
   Calculadora, en vez de una lista nueva. No se agregó CSS.
8. **`Reservas.js` no se tocó.** Las reservas hechas por clientes ya aparecen en la agenda del día y se pueden
   confirmar o cancelar con los botones que existían.
9. **Usuario con sesión que entra a `/`.** El proxy lo sigue mandando a `/admin`; si es cliente, `PanelAdmin` lo
   reenvía a `/reservar`. Es un salto extra, pero evita leer el rol en el proxy.
10. **Core.** No se encontró ningún error en `calcularPrecio.js`: los seis precios de ejemplo coinciden.

## 5. Limitaciones conocidas

- El tope de pendientes no es atómico: con dos peticiones simultáneas del mismo cliente podría pasarse por una.
- Las reservas pendientes no expiran solas: siguen ocupando el horario hasta que alguien las confirme o cancele.
- Los clientes no se registran solos: los crea el administrador.
- La lista "Mis reservas" muestra como máximo las 100 más recientes.
- Estos cambios no se probaron contra la base de datos real desde aquí (solo lint, build y pruebas automáticas).
  Las pruebas manuales del documento son las que comprueban el flujo completo.

## 6. Qué debes hacer tú

1. Crear al menos un usuario con rol `CLIENTE` desde **Usuarios** (dos, para las pruebas de seguridad).
2. Recorrer `docs/pruebas-manuales-fase-bc.md`.
3. Revisar la rama `cliente-e-ingresos` y, si todo está bien, subirla. No se hizo `push` ni despliegue.
