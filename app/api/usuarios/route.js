import { NextResponse } from "next/server";
import { requerirAdmin, requerirPersonal } from "@/lib/auth";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { ROLES, validarUsuarioNuevo } from "@/lib/validaciones/usuario";
import { verificarOrigen } from "@/lib/seguridad";
import { errorInterno, leerCuerpoJson, respuestaDenegada, solicitudInvalida } from "@/lib/http";

// Lista de usuarios.
// - Con ?rol=CLIENTE: administrador o recepcionista; devuelve solo datos básicos
//   (para los desplegables de cliente de la calculadora y de las reservas).
// - Cualquier otra lista: solo administrador, con rol y fecha de creación.
export async function GET(request) {
  const permiso = await requerirPersonal();
  if (permiso.error) return respuestaDenegada(permiso);

  const rol = new URL(request.url).searchParams.get("rol");
  if (rol !== null && !ROLES.includes(rol)) {
    return NextResponse.json({ error: "El rol indicado no es válido" }, { status: 400 });
  }

  const soloClientes = rol === "CLIENTE";
  if (!soloClientes && permiso.usuario.rol !== "ADMINISTRADOR") {
    return NextResponse.json({ error: "No tienes permiso para esta acción" }, { status: 403 });
  }

  const campos = soloClientes
    ? "id, nombre, apellido, correo"
    : "id, correo, nombre, apellido, rol, fechaCreacion";

  let consulta = crearClienteAdmin().from("usuarios").select(campos);
  if (rol) consulta = consulta.eq("rol", rol);
  const { data, error } = await consulta.order("apellido").order("nombre");

  if (error) return errorInterno(error, "No se pudieron cargar los usuarios");
  return NextResponse.json({ usuarios: data });
}

// Crear usuario (solo administrador).
// 1) Crea la cuenta en Supabase Auth (ahí vive la contraseña) con la secret key.
// 2) Inserta la fila en "usuarios" con el mismo id.
// Si el paso 2 falla, se elimina la cuenta de Auth recién creada (rollback).
export async function POST(request) {
  const bloqueo = verificarOrigen(request);
  if (bloqueo) return bloqueo;

  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const cuerpo = await leerCuerpoJson(request);
  if (!cuerpo) return solicitudInvalida();

  const { errores, datos } = validarUsuarioNuevo(cuerpo);
  if (errores.length > 0) return NextResponse.json({ errores }, { status: 422 });

  const admin = crearClienteAdmin();

  // El correo debe ser único.
  const { data: existente, error: errorBusqueda } = await admin
    .from("usuarios")
    .select("id")
    .eq("correo", datos.correo)
    .maybeSingle();
  if (errorBusqueda) return errorInterno(errorBusqueda, "No se pudo crear el usuario");
  if (existente) {
    return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
  }

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email: datos.correo,
    password: datos.contrasenia,
    email_confirm: true,
  });
  if (errorAuth || !creado?.user) {
    if (errorAuth?.code === "email_exists") {
      return NextResponse.json({ error: "Ya existe un usuario con ese correo." }, { status: 409 });
    }
    // Nunca se registra la contraseña ni el cuerpo de la petición.
    return errorInterno(errorAuth, "No se pudo crear el usuario");
  }

  const id = creado.user.id;
  const { data: usuario, error: errorInsert } = await admin
    .from("usuarios")
    .insert({
      id,
      correo: datos.correo,
      nombre: datos.nombre,
      apellido: datos.apellido,
      rol: datos.rol,
    })
    .select("id, correo, nombre, apellido, rol, fechaCreacion")
    .single();

  if (errorInsert) {
    // Rollback: no dejar una cuenta de Auth sin su fila en "usuarios".
    const { error: errorRollback } = await admin.auth.admin.deleteUser(id);
    if (errorRollback) {
      console.error("No se pudo deshacer la cuenta de Auth creada:", errorRollback.message);
    }
    return errorInterno(errorInsert, "No se pudo crear el usuario");
  }

  return NextResponse.json({ usuario }, { status: 201 });
}
