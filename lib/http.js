import "server-only";
import { NextResponse } from "next/server";

// Lee el cuerpo JSON de la petición. Devuelve el objeto, o null si no es JSON
// o si no es un objeto (por ejemplo un arreglo, un número o null).
export async function leerCuerpoJson(request) {
  try {
    const cuerpo = await request.json();
    if (cuerpo === null || typeof cuerpo !== "object" || Array.isArray(cuerpo)) return null;
    return cuerpo;
  } catch {
    return null;
  }
}

// Respuesta estándar de "solicitud inválida" (400).
export function solicitudInvalida() {
  return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
}

// Convierte el resultado de requerirRol/requerirAdmin en respuesta HTTP (401 o 403).
export function respuestaDenegada(permiso) {
  return NextResponse.json({ error: permiso.error }, { status: permiso.estado });
}

// Error interno: el detalle va solo al registro del servidor, nunca al navegador.
export function errorInterno(error, mensaje) {
  console.error(mensaje, error?.message ?? error);
  return NextResponse.json({ error: mensaje }, { status: 500 });
}

// Valida un identificador numérico positivo (id de tarifa, reserva...). Devuelve el número o null.
export function leerIdNumerico(texto) {
  const id = Number(texto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Valida un uuid (id de usuario). Devuelve el texto en minúsculas o null.
export function leerUuid(texto) {
  return typeof texto === "string" && REGEX_UUID.test(texto) ? texto.toLowerCase() : null;
}
