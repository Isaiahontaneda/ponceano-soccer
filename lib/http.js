import "server-only";
import { NextResponse } from "next/server";
import { esUuid } from "./validaciones/comun.js";

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
  if (typeof texto !== "string" || !/^\d{1,15}$/.test(texto)) return null;
  const id = Number(texto);
  return id > 0 ? id : null;
}

// Valida un uuid (id de usuario). Devuelve el texto en minúsculas o null.
export function leerUuid(texto) {
  return esUuid(texto) ? texto.toLowerCase() : null;
}
