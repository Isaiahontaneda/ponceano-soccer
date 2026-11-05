import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { cargarTarifasConTipo } from "@/lib/modelo/tarifas";
import { motivoNoEliminable, validarTarifa } from "@/lib/validaciones/tarifa";
import { verificarOrigen } from "@/lib/seguridad";
import {
  errorInterno,
  leerCuerpoJson,
  leerIdNumerico,
  respuestaDenegada,
  solicitudInvalida,
} from "@/lib/http";

// Editar tarifa (solo administrador)
export async function PUT(request, { params }) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const id = leerIdNumerico((await params).id);
  if (!id) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const tipoId = Number(cuerpo.tipoId);
  if (!Number.isInteger(tipoId) || tipoId < 1) {
    return NextResponse.json({ errores: ["Debes elegir un tipo de tarifa."] }, { status: 422 });
  }

  const admin = crearClienteAdmin();
  let tarifas;
  try {
    ({ tarifas } = await cargarTarifasConTipo(admin));
  } catch (error) {
    return errorInterno(error, "No se pudo guardar la tarifa");
  }

  const actual = tarifas.find((t) => t.id === id);
  if (!actual) return NextResponse.json({ error: "La tarifa no existe" }, { status: 404 });

  // El tipo no se puede cambiar: evita dejar el sistema sin base o sin una comparación.
  if (tipoId !== actual.tipoId) {
    return NextResponse.json(
      { errores: ["El tipo de una tarifa no se puede cambiar. Elimínala y crea una nueva."] },
      { status: 422 }
    );
  }

  const { errores, datos } = validarTarifa(cuerpo, actual.tipoCodigo, tarifas, id);
  if (errores.length > 0) {
    return NextResponse.json({ errores }, { status: 422 });
  }

  // El tipo no se toca: solo se actualizan los campos aprobados por la validación.
  const { data: editada, error } = await admin
    .from("tarifas")
    .update({ ...datos, fechaActualizacion: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return errorInterno(error, "No se pudo guardar la tarifa");
  if (!editada) return NextResponse.json({ error: "La tarifa no existe" }, { status: 404 });
  return NextResponse.json({ tarifa: editada });
}

// Eliminar tarifa (solo administrador)
export async function DELETE(request, { params }) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const id = leerIdNumerico((await params).id);
  if (!id) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const admin = crearClienteAdmin();
  let tarifas;
  try {
    ({ tarifas } = await cargarTarifasConTipo(admin));
  } catch (error) {
    return errorInterno(error, "No se pudo eliminar la tarifa");
  }

  const tarifa = tarifas.find((t) => t.id === id);
  if (!tarifa) return NextResponse.json({ error: "La tarifa no existe" }, { status: 404 });

  // Protege la tarifa base y la última regla de cada grupo del Core (GRUPOS_CORE).
  const motivo = motivoNoEliminable(tarifa, tarifas);
  if (motivo) return NextResponse.json({ error: motivo }, { status: 409 });

  const { error } = await admin.from("tarifas").delete().eq("id", id);
  if (error) return errorInterno(error, "No se pudo eliminar la tarifa");
  return NextResponse.json({ ok: true });
}
