// Ayuda para que las páginas del panel (componentes cliente) llamen a nuestras APIs.

// Hace la petición y devuelve siempre { ok, estado, datos }, sin lanzar errores.
export async function llamarApi(url, { metodo = "GET", cuerpo } = {}) {
  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const datos = await respuesta.json().catch(() => ({}));
    return { ok: respuesta.ok, estado: respuesta.status, datos };
  } catch {
    return {
      ok: false,
      estado: 0,
      datos: { error: "No se pudo conectar con el servidor. Revisa tu conexión." },
    };
  }
}

// Convierte la respuesta de error de la API en una lista de mensajes para mostrar.
export function mensajesDeError(datos, porDefecto = "Ocurrió un error inesperado.") {
  if (Array.isArray(datos?.errores) && datos.errores.length > 0) return datos.errores;
  return [datos?.error ?? porDefecto];
}
