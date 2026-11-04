import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarTarifa } from "@/lib/validaciones/tarifa";

// Lista de tarifas (solo administrador)
export async function GET() {
  const permiso = await requerirAdmin();
  if (permiso.error) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.estado });
  }

  const admin = crearClienteAdmin();
  const { data: tipos } = await admin.from("tiposTarifa").select("id, codigo, nombre");
  const { data: tarifas, error } = await admin.from("tarifas").select("*").order("id");

  if (error || !tipos) {
    console.error(error);
    return NextResponse.json({ error: "No se pudieron cargar las tarifas" }, { status: 500 });
  }

  const lista = tarifas.map((t) => {
    const tipo = tipos.find((x) => x.id === t.tipoId);
    return { ...t, tipoCodigo: tipo?.codigo, tipoNombre: tipo?.nombre };
  });
  return NextResponse.json({ tarifas: lista });
}

// Crear tarifa (solo administrador)
export async function POST(request) {
  const permiso = await requerirAdmin();
  if (permiso.error) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.estado });
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  if (cuerpo === null || typeof cuerpo !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const tipoId = Number(cuerpo.tipoId);
  if (!Number.isInteger(tipoId) || tipoId < 1) {
    return NextResponse.json({ errores: ["Debes elegir un tipo de tarifa."] }, { status: 422 });
  }

  const admin = crearClienteAdmin();
  const { data: tipos } = await admin.from("tiposTarifa").select("id, codigo");
  const tipo = tipos?.find((t) => t.id === tipoId);
  if (!tipo) {
    return NextResponse.json({ errores: ["El tipo de tarifa no existe."] }, { status: 422 });
  }

  const { data: tarifas } = await admin.from("tarifas").select("*");
  const existentes = (tarifas ?? []).map((t) => ({
    ...t,
    codigo: tipos.find((x) => x.id === t.tipoId)?.codigo,
  }));

  const { errores, datos } = validarTarifa(cuerpo, tipo.codigo, existentes);
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
    console.error(error);
    return NextResponse.json({ error: "No se pudo guardar la tarifa" }, { status: 500 });
  }
  return NextResponse.json({ tarifa: creada }, { status: 201 });
}