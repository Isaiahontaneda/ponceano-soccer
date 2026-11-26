import { NextResponse } from "next/server";
import { requerirAdmin } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { cargarReglasConTipo } from "@/backend/modelo/reglasCliente";
import { errorCambioTipo, validarReglaCliente } from "@/backend/validaciones/reglaCliente";
import { verificarOrigen } from "@/backend/seguridad";
import {
  errorInterno,
  leerCuerpoJson,
  leerIdNumerico,
  respuestaDenegada,
  solicitudInvalida,
} from "@/backend/http";

// Editar regla del cliente (solo administrador). También sirve para activarla o desactivarla.
export async function PUT(request, { params }) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const id = leerIdNumerico((await params).id);
  if (!id) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const admin = crearClienteAdmin();
  let reglas;
  try {
    ({ reglas } = await cargarReglasConTipo(admin));
  } catch (error) {
    return errorInterno(error, "No se pudo guardar la regla");
  }

  const actual = reglas.find((r) => r.id === id);
  if (!actual) return NextResponse.json({ error: "La regla no existe" }, { status: 404 });

  // El tipo no se puede cambiar: los campos de cada tipo son distintos.
  const errorTipo = errorCambioTipo(actual, Number(cuerpo.tipoId));
  if (errorTipo) return NextResponse.json({ errores: [errorTipo] }, { status: 422 });

  const { errores, conflicto, datos } = validarReglaCliente(cuerpo, actual.tipoCodigo, reglas, id);
  if (errores.length > 0) return NextResponse.json({ errores }, { status: 422 });
  if (conflicto) return NextResponse.json({ error: conflicto }, { status: 409 });

  // El tipo no se toca: solo se actualizan los campos aprobados por la validación.
  const { data: editada, error } = await admin
    .from("reglasCliente")
    .update({ ...datos, fechaActualizacion: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return errorInterno(error, "No se pudo guardar la regla");
  if (!editada) return NextResponse.json({ error: "La regla no existe" }, { status: 404 });
  return NextResponse.json({ regla: editada });
}

// Eliminar regla del cliente (solo administrador)
export async function DELETE(request, { params }) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const id = leerIdNumerico((await params).id);
  if (!id) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const admin = crearClienteAdmin();
  const { data: borradas, error } = await admin.from("reglasCliente").delete().eq("id", id).select("id");

  if (error) {
    // 23503 = llave foránea: reservas.reglaClienteId apunta a esta regla (ON DELETE RESTRICT).
    // Nunca se muestra el error de la base de datos.
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Esta regla ya se aplicó en reservas; desactívala en lugar de borrarla." },
        { status: 409 }
      );
    }
    return errorInterno(error, "No se pudo eliminar la regla");
  }
  if (borradas.length === 0) return NextResponse.json({ error: "La regla no existe" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
