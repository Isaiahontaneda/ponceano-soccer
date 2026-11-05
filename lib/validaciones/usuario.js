// Validación de usuarios. Funciones puras (sin base de datos ni alias "@/").

export const ROLES = ["ADMINISTRADOR", "RECEPCIONISTA", "CLIENTE"];

// Letras latinas (con tildes y ñ), separadas por espacios, guiones o apóstrofes.
const REGEX_NOMBRE = /^\p{Script=Latin}+(?:[ '’-]\p{Script=Latin}+)*$/u;
// Formato básico de correo: algo@dominio.ext, sin espacios ni puntos consecutivos.
const REGEX_CORREO = /^[^\s@.][^\s@]*@[^\s@.]+(?:\.[^\s@.]+)+$/;

// La contraseña se mide en caracteres; 72 es un límite razonable (bcrypt, que usa Supabase, ignora lo que pase de 72 bytes).
const MIN_CONTRASENIA = 10;
const MAX_CONTRASENIA = 72;

export function validarCorreo(valor) {
  const correo = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  if (correo.length === 0 || correo.length > 254 || correo.includes("..") || !REGEX_CORREO.test(correo)) {
    return { error: "El correo es obligatorio y debe tener un formato válido (ejemplo: nombre@dominio.com).", correo: "" };
  }
  return { error: null, correo };
}

export function validarContrasenia(valor) {
  if (typeof valor !== "string" || valor.length < MIN_CONTRASENIA) {
    return `La contraseña debe tener al menos ${MIN_CONTRASENIA} caracteres.`;
  }
  if (valor.length > MAX_CONTRASENIA) {
    return `La contraseña debe tener máximo ${MAX_CONTRASENIA} caracteres.`;
  }
  if (!/\p{Lu}/u.test(valor) || !/\p{Ll}/u.test(valor) || !/\d/.test(valor)) {
    return "La contraseña debe incluir al menos una mayúscula, una minúscula y un número.";
  }
  return null;
}

// Valida un nombre o apellido. "etiqueta" es el nombre del campo para el mensaje.
function validarNombrePersona(valor, etiqueta) {
  // Se recortan los extremos y se juntan los espacios repetidos.
  const texto = typeof valor === "string" ? valor.trim().replace(/ {2,}/g, " ") : "";
  if (texto.length < 1 || texto.length > 60) {
    return { error: `${etiqueta} es obligatorio y debe tener máximo 60 caracteres.`, texto: "" };
  }
  if (!REGEX_NOMBRE.test(texto)) {
    return {
      error: `${etiqueta} solo puede tener letras (con tildes y ñ), espacios, guiones o apóstrofes.`,
      texto: "",
    };
  }
  return { error: null, texto };
}

export function validarRol(valor) {
  return typeof valor === "string" && ROLES.includes(valor);
}

// Datos para crear un usuario. Devuelve { errores, datos }.
// "datos" incluye la contraseña solo para pasarla a Supabase Auth: nunca se guarda en la tabla
// "usuarios", ni se devuelve al navegador, ni se escribe en los registros.
export function validarUsuarioNuevo(entrada) {
  const dato = entrada && typeof entrada === "object" ? entrada : {};
  const errores = [];

  const correo = validarCorreo(dato.correo);
  if (correo.error) errores.push(correo.error);

  const errorContrasenia = validarContrasenia(dato.contrasenia);
  if (errorContrasenia) errores.push(errorContrasenia);

  const nombre = validarNombrePersona(dato.nombre, "El nombre");
  if (nombre.error) errores.push(nombre.error);

  const apellido = validarNombrePersona(dato.apellido, "El apellido");
  if (apellido.error) errores.push(apellido.error);

  if (!validarRol(dato.rol)) errores.push("El rol debe ser Administrador, Recepcionista o Cliente.");

  return {
    errores,
    datos: {
      correo: correo.correo,
      contrasenia: dato.contrasenia,
      nombre: nombre.texto,
      apellido: apellido.texto,
      rol: dato.rol,
    },
  };
}

// Datos para editar un usuario (el correo no se edita). Devuelve { errores, datos }.
export function validarUsuarioEdicion(entrada) {
  const dato = entrada && typeof entrada === "object" ? entrada : {};
  const errores = [];

  const nombre = validarNombrePersona(dato.nombre, "El nombre");
  if (nombre.error) errores.push(nombre.error);

  const apellido = validarNombrePersona(dato.apellido, "El apellido");
  if (apellido.error) errores.push(apellido.error);

  if (!validarRol(dato.rol)) errores.push("El rol debe ser Administrador, Recepcionista o Cliente.");

  return {
    errores,
    datos: { nombre: nombre.texto, apellido: apellido.texto, rol: dato.rol },
  };
}

// ---------- Reglas de negocio (el servidor aporta los datos de la base)

// ¿Se puede cambiar el rol de "objetivo" a "nuevoRol"? Devuelve un mensaje de error o null.
//   actualId: id del administrador que hace el cambio
//   objetivo: { id, rol } usuario que se edita
//   totalAdministradores: cuántos ADMINISTRADOR hay ahora
export function motivoNoPuedeCambiarRol({ actualId, objetivo, nuevoRol, totalAdministradores }) {
  const dejaDeSerAdmin = objetivo.rol === "ADMINISTRADOR" && nuevoRol !== "ADMINISTRADOR";
  if (!dejaDeSerAdmin) return null;

  if (objetivo.id === actualId) {
    return "No puedes quitarte a ti mismo el rol de administrador.";
  }
  if (totalAdministradores <= 1) {
    return "No se puede degradar al último administrador del sistema.";
  }
  return null;
}

// ¿Se puede eliminar al usuario "objetivo"? Devuelve un mensaje de error o null.
//   totalReservas: cuántas reservas tiene como cliente
export function motivoNoPuedeEliminar({ actualId, objetivo, totalAdministradores, totalReservas }) {
  if (objetivo.id === actualId) {
    return "No puedes eliminar tu propia cuenta.";
  }
  if (objetivo.rol === "ADMINISTRADOR" && totalAdministradores <= 1) {
    return "No se puede eliminar al último administrador del sistema.";
  }
  if (totalReservas > 0) {
    return `No se puede eliminar al usuario porque tiene ${totalReservas} reserva(s) registrada(s).`;
  }
  return null;
}
