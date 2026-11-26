import { NextResponse } from "next/server";
import { requerirAdmin } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { cargarReglasConTipo } from "@/backend/modelo/reglasCliente";
import { validarReglaCliente } from "@/backend/validaciones/reglaCliente";
import { verificarOrigen } from "@/backend/seguridad";
import { errorInterno, leerCuerpoJson, respuestaDenegada, solicitudInvalida } from "@/backend/http";

// Lista de reglas del cliente (solo administrador)
export async function GET() {
  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  try {
    const { reglas } = await cargarReglasConTipo(crearClienteAdmin());
    return NextResponse.json({ reglas });
  } catch (error) {
    return errorInterno(error, "No se pudieron cargar las reglas del cliente");
  }
}

// Crear regla del cliente (solo administrador)
export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const tipoId = Number(cuerpo.tipoId);
  if (!Number.isInteger(tipoId) || tipoId < 1) {
    return NextResponse.json({ errores: ["Debes elegir un tipo de regla."] }, { status: 422 });
  }

  const admin = crearClienteAdmin();
  let tipos, reglas;
  try {
    ({ tipos, reglas } = await cargarReglasConTipo(admin));
  } catch (error) {
    return errorInterno(error, "No se pudo guardar la regla");
  }

  const tipo = tipos.find((t) => t.id === tipoId);
  if (!tipo) {
    return NextResponse.json({ errores: ["El tipo de regla no existe."] }, { status: 422 });
  }

  const { errores, conflicto, datos } = validarReglaCliente(cuerpo, tipo.codigo, reglas);
  if (errores.length > 0) return NextResponse.json({ errores }, { status: 422 });
  if (conflicto) return NextResponse.json({ error: conflicto }, { status: 409 });

  // Solo se guardan los campos que la validación aprobó (nada más del cuerpo original).
  const { data: creada, error } = await admin
    .from("reglasCliente")
    .insert({ tipoId, ...datos })
    .select()
    .single();

  if (error) return errorInterno(error, "No se pudo guardar la regla");
  return NextResponse.json({ regla: creada }, { status: 201 });
}
