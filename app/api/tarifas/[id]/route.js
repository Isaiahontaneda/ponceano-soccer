import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { validarTarifa } from "@/lib/validaciones/tarifa";

function leerId(texto) {
  const id = Number(texto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Editar tarifa (solo administrador)
export async function PUT(request, { params }) {
  const permiso = await requerirAdmin();
  if (permiso.error) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.estado });
  }

  const id = leerId((await params).id);
  if (!id) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
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

  const { data: actual } = await admin
    .from("tarifas")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!actual) {
    return NextResponse.json({ error: "La tarifa no existe" }, { status: 404 });
  }

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

  const { errores, datos } = validarTarifa(cuerpo, tipo.codigo, existentes, id);
  if (errores.length > 0) {
    return NextResponse.json({ errores }, { status: 422 });
  }

  const { data: editada, error } = await admin
    .from("tarifas")
    .update({ tipoId, ...datos, fechaActualizacion: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo guardar la tarifa" }, { status: 500 });
  }
  return NextResponse.json({ tarifa: editada });
}

// Eliminar tarifa (solo administrador)
export async function DELETE(request, { params }) {
  const permiso = await requerirAdmin();
  if (permiso.error) {
    return NextResponse.json({ error: permiso.error }, { status: permiso.estado });
  }

  const id = leerId((await params).id);
  if (!id) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const admin = crearClienteAdmin();

  const { data: tarifa } = await admin
    .from("tarifas")
    .select("id, tipoId")
    .eq("id", id)
    .maybeSingle();
  if (!tarifa) {
    return NextResponse.json({ error: "La tarifa no existe" }, { status: 404 });
  }

  // Sin tarifa base el Core no puede calcular precios: se protege.
  const { data: tipo } = await admin
    .from("tiposTarifa")
    .select("codigo")
    .eq("id", tarifa.tipoId)
    .single();
  if (tipo?.codigo === "BASE") {
    return NextResponse.json(
      { error: "No puedes eliminar la tarifa base. Edita su valor en su lugar." },
      { status: 409 }
    );
  }

  const { error } = await admin.from("tarifas").delete().eq("id", id);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: "No se pudo eliminar la tarifa" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}