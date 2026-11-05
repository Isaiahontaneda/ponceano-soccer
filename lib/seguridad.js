import "server-only";
import { NextResponse } from "next/server";
import { origenPermitido } from "./validaciones/origen.js";

// Úsalo al inicio de cada POST/PUT/PATCH/DELETE.
// Devuelve una respuesta 403 si la petición no viene de nuestro propio sitio, o null si es válida.
//
//   const bloqueo = verificarOrigen(request);
//   if (bloqueo) return bloqueo;
export function verificarOrigen(request) {
  const permitido = origenPermitido({
    origin: request.headers.get("origin"),
    host: request.headers.get("host"),
    secFetchSite: request.headers.get("sec-fetch-site"),
  });

  if (!permitido) {
    return NextResponse.json({ error: "Origen de la solicitud no permitido" }, { status: 403 });
  }
  return null;
}
