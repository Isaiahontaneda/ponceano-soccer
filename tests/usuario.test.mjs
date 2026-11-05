import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarUsuarioNuevo,
  validarUsuarioEdicion,
  validarCorreo,
  validarContrasenia,
  motivoNoPuedeCambiarRol,
  motivoNoPuedeEliminar,
} from "../lib/validaciones/usuario.js";

const VALIDO = {
  correo: "Ana.Perez@Correo.COM ",
  contrasenia: "Clave12345",
  nombre: " Ana María ",
  apellido: "O'Neil-Pérez",
  rol: "CLIENTE",
};

test("usuario válido: normaliza correo a minúsculas y recorta nombres", () => {
  const { errores, datos } = validarUsuarioNuevo(VALIDO);
  assert.deepEqual(errores, []);
  assert.equal(datos.correo, "ana.perez@correo.com");
  assert.equal(datos.nombre, "Ana María");
  assert.equal(datos.apellido, "O'Neil-Pérez");
  assert.equal(datos.rol, "CLIENTE");
});

test("correo: formato inválido se rechaza", () => {
  for (const c of ["", "sin-arroba", "a@b", "a@@b.com", "a b@c.com", "a@b..com", "@dominio.com", "a@.com", null, undefined, 5, "a".repeat(250) + "@x.com"]) {
    assert.ok(validarCorreo(c).error, `debería rechazar ${c}`);
  }
  assert.equal(validarCorreo("a@b.co").error, null);
  assert.equal(validarCorreo("nombre+etiqueta@sub.dominio.com").error, null);
});

test("contraseña: mínimo 10 caracteres con mayúscula, minúscula y número", () => {
  assert.equal(validarContrasenia("Abcdefgh12"), null); // justo 10
  assert.ok(validarContrasenia("Abcdefg12")); // 9
  assert.ok(validarContrasenia("abcdefghi12")); // sin mayúscula
  assert.ok(validarContrasenia("ABCDEFGHI12")); // sin minúscula
  assert.ok(validarContrasenia("Abcdefghijk")); // sin número
  assert.ok(validarContrasenia(""));
  assert.ok(validarContrasenia(null));
  assert.ok(validarContrasenia(1234567890));
  assert.ok(validarContrasenia("Aa1" + "x".repeat(70))); // más de 72
  assert.equal(validarContrasenia("Aa1" + "x".repeat(69)), null); // justo 72
});

test("contraseña con tilde y ñ cuenta como mayúscula/minúscula", () => {
  assert.equal(validarContrasenia("Ñandú12345"), null);
});

test("nombre y apellido: 1 a 60 caracteres, solo letras, espacios, guion o apóstrofe", () => {
  const con = (nombre, apellido = "Pérez") => validarUsuarioNuevo({ ...VALIDO, nombre, apellido }).errores;
  assert.deepEqual(con("José Ñúñez"), []);
  assert.deepEqual(con("Ana", "De la Cruz"), []);
  assert.deepEqual(con("a".repeat(60)), []);
  for (const mala of ["", "   ", "a".repeat(61), "Ana3", "Ana<script>", "Ana_Maria", "Ana.", "-Ana", "Ana-", "Ana -- Maria", "'", "Ана", null, 7]) {
    assert.equal(con(mala).length, 1, `debería rechazar nombre ${JSON.stringify(mala)}`);
  }
  assert.equal(con("Ana", "Pérez2").length, 1);
});

test("rol: debe estar en el enumerado", () => {
  for (const rol of ["ADMINISTRADOR", "RECEPCIONISTA", "CLIENTE"]) {
    assert.deepEqual(validarUsuarioNuevo({ ...VALIDO, rol }).errores, []);
  }
  for (const rol of ["admin", "ROOT", "", null, undefined, 1]) {
    assert.equal(validarUsuarioNuevo({ ...VALIDO, rol }).errores.length, 1, `debería rechazar ${rol}`);
  }
});

test("usuario nuevo con todo mal acumula los errores", () => {
  const { errores } = validarUsuarioNuevo({});
  assert.equal(errores.length, 5);
  assert.equal(validarUsuarioNuevo(null).errores.length, 5);
});

test("edición: solo nombre, apellido y rol (ignora correo y contraseña)", () => {
  const { errores, datos } = validarUsuarioEdicion({ ...VALIDO, rol: "RECEPCIONISTA" });
  assert.deepEqual(errores, []);
  assert.deepEqual(Object.keys(datos).sort(), ["apellido", "nombre", "rol"]);
  assert.equal(validarUsuarioEdicion({ nombre: "", apellido: "x", rol: "CLIENTE" }).errores.length, 1);
});

// ---------- Reglas de negocio

const admin1 = { id: "a1", rol: "ADMINISTRADOR" };
const cliente = { id: "c1", rol: "CLIENTE" };

test("un admin no puede quitarse el rol de administrador a sí mismo", () => {
  assert.match(
    motivoNoPuedeCambiarRol({ actualId: "a1", objetivo: admin1, nuevoRol: "CLIENTE", totalAdministradores: 3 }),
    /a ti mismo/
  );
});

test("no se puede degradar al último administrador", () => {
  assert.match(
    motivoNoPuedeCambiarRol({ actualId: "a2", objetivo: admin1, nuevoRol: "RECEPCIONISTA", totalAdministradores: 1 }),
    /último administrador/
  );
});

test("sí se puede degradar a otro admin si quedan más; y cambiar roles que no son admin", () => {
  assert.equal(
    motivoNoPuedeCambiarRol({ actualId: "a2", objetivo: admin1, nuevoRol: "CLIENTE", totalAdministradores: 2 }),
    null
  );
  assert.equal(
    motivoNoPuedeCambiarRol({ actualId: "a1", objetivo: cliente, nuevoRol: "ADMINISTRADOR", totalAdministradores: 1 }),
    null
  );
  // Mantener el rol de administrador (editar solo el nombre) siempre se permite.
  assert.equal(
    motivoNoPuedeCambiarRol({ actualId: "a1", objetivo: admin1, nuevoRol: "ADMINISTRADOR", totalAdministradores: 1 }),
    null
  );
});

test("eliminar: no a uno mismo, no al último admin, no con reservas", () => {
  assert.match(
    motivoNoPuedeEliminar({ actualId: "a1", objetivo: admin1, totalAdministradores: 2, totalReservas: 0 }),
    /tu propia cuenta/
  );
  assert.match(
    motivoNoPuedeEliminar({ actualId: "a2", objetivo: admin1, totalAdministradores: 1, totalReservas: 0 }),
    /último administrador/
  );
  assert.match(
    motivoNoPuedeEliminar({ actualId: "a1", objetivo: cliente, totalAdministradores: 1, totalReservas: 2 }),
    /2 reserva/
  );
  assert.equal(
    motivoNoPuedeEliminar({ actualId: "a1", objetivo: cliente, totalAdministradores: 1, totalReservas: 0 }),
    null
  );
  assert.equal(
    motivoNoPuedeEliminar({ actualId: "a2", objetivo: admin1, totalAdministradores: 2, totalReservas: 0 }),
    null
  );
});
