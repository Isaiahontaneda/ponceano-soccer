import { NextResponse } from "next/server";
import { requerirAdmin } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { cargarTarifasConTipo } from "@/backend/modelo/tarifas";
import { validarTarifa } from "@/backend/validaciones/tarifa";
import { verificarOrigen } from "@/backend/seguridad";
import { errorInterno, leerCuerpoJson, respuestaDenegada, solicitudInvalida } from "@/backend/http";

// Lista de tarifas (solo administrador)
export async function GET() {
  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  try {
    const { tarifas } = await cargarTarifasConTipo(crearClienteAdmin());
    // El alias interno "codigo" no se expone: el contrato público usa "tipoCodigo".
    const lista = tarifas.map((t) => {
      const copia = { ...t };
      delete copia.codigo;
      return copia;
    });
    return NextResponse.json({ tarifas: lista });
  } catch (error) {
    return errorInterno(error, "No se pudieron cargar las tarifas");
  }
}

// Crear tarifa (solo administrador)
export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const tipoId = Number(cuerpo.tipoId);
  if (!Number.isInteger(tipoId) || tipoId < 1) {
    return NextResponse.json({ errores: ["Debes elegir un tipo de tarifa."] }, { status: 422 });
  }

  const admin = crearClienteAdmin();
  let tipos, tarifas;
  try {
    ({ tipos, tarifas } = await cargarTarifasConTipo(admin));
  } catch (error) {
    return errorInterno(error, "No se pudo guardar la tarifa");
  }

  const tipo = tipos.find((t) => t.id === tipoId);
  if (!tipo) {
    return NextResponse.json({ errores: ["El tipo de tarifa no existe."] }, { status: 422 });
  }

  const { errores, datos } = validarTarifa(cuerpo, tipo.codigo, tarifas);
  if (errores.length > 0) {
    return NextResponse.json({ errores }, { status: 422 });
  }

  // Solo se guardan los campos que la validación aprobó (nada más del cuerpo original).
  const { data: creada, error } = await admin
    .from("tarifas")
    .insert({ tipoId, ...datos })
    .select()
    .single();

  if (error) {
    // 23505 = índice único (p. ej. "tarifas_una_sola_base") violado por una petición simultánea.
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya existe una tarifa base." }, { status: 409 });
    }
    return errorInterno(error, "No se pudo guardar la tarifa");
  }
  return NextResponse.json({ tarifa: creada }, { status: 201 });
}
