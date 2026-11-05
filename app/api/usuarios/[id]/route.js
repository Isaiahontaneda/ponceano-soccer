import { NextResponse } from "next/server";
import { requerirAdmin } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  motivoNoPuedeCambiarRol,
  motivoNoPuedeEliminar,
  validarUsuarioEdicion,
} from "@/lib/validaciones/usuario";
import { verificarOrigen } from "@/lib/seguridad";
import {
  errorInterno,
  leerCuerpoJson,
  leerUuid,
  respuestaDenegada,
  solicitudInvalida,
} from "@/lib/http";

async function contarAdministradores(admin) {
  const { count, error } = await admin
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("rol", "ADMINISTRADOR");
  if (error) throw error;
  return count ?? 0;
}

// Editar nombre, apellido y rol (solo administrador). El correo no se edita.
export async function PUT(request, { params }) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const id = leerUuid((await params).id);
  if (!id) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const { errores, datos } = validarUsuarioEdicion(cuerpo);
  if (errores.length > 0) return NextResponse.json({ errores }, { status: 422 });

  const admin = crearClienteAdmin();
  try {
    const { data: objetivo, error } = await admin
      .from("usuarios")
      .select("id, rol")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!objetivo) return NextResponse.json({ error: "El usuario no existe" }, { status: 404 });

    // Reglas de negocio: ni el propio admin ni el último administrador pueden dejar de serlo.
    const motivo = motivoNoPuedeCambiarRol({
      actualId: permiso.usuario.id,
      objetivo,
      nuevoRol: datos.rol,
      totalAdministradores: await contarAdministradores(admin),
    });
    if (motivo) return NextResponse.json({ error: motivo }, { status: 409 });

    const { data: editado, error: errorUpdate } = await admin
      .from("usuarios")
      .update({ ...datos, fechaActualizacion: new Date().toISOString() })
      .eq("id", id)
      .select("id, correo, nombre, apellido, rol, fechaCreacion")
      .maybeSingle();
    if (errorUpdate) throw errorUpdate;
    if (!editado) return NextResponse.json({ error: "El usuario no existe" }, { status: 404 });

    return NextResponse.json({ usuario: editado });
  } catch (error) {
    return errorInterno(error, "No se pudo guardar el usuario");
  }
}

// Eliminar usuario (solo administrador).
export async function DELETE(request, { params }) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const id = leerUuid((await params).id);
  if (!id) return NextResponse.json({ error: "Id inválido" }, { status: 400 });

  const admin = crearClienteAdmin();
  try {
    const { data: objetivo, error } = await admin
      .from("usuarios")
      .select("id, rol")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!objetivo) return NextResponse.json({ error: "El usuario no existe" }, { status: 404 });

    const { count: totalReservas, error: errorReservas } = await admin
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("clienteId", id);
    if (errorReservas) throw errorReservas;

    const motivo = motivoNoPuedeEliminar({
      actualId: permiso.usuario.id,
      objetivo,
      totalAdministradores: await contarAdministradores(admin),
      totalReservas: totalReservas ?? 0,
    });
    if (motivo) return NextResponse.json({ error: motivo }, { status: 409 });

    // Primero se borra en Auth; la fila de "usuarios" cae por "on delete cascade".
    const { error: errorAuth } = await admin.auth.admin.deleteUser(id);
    if (errorAuth) throw errorAuth;

    // Por seguridad, se asegura que la fila ya no exista (no falla si ya cayó en cascada).
    const { error: errorFila } = await admin.from("usuarios").delete().eq("id", id);
    if (errorFila) throw errorFila;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorInterno(error, "No se pudo eliminar el usuario");
  }
}
