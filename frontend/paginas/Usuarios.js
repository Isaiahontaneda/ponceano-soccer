"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NOMBRE_ROL } from "@/frontend/utilidades/formato";
import { ROLES } from "@/backend/validaciones/usuario";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";
import Confirmacion from "@/frontend/componentes/Confirmacion";

const FORMULARIO_VACIO = { correo: "", contrasenia: "", nombre: "", apellido: "", rol: "CLIENTE" };

export default function PaginaUsuarios() {
  const router = useRouter();
  const [confirmacion, setConfirmacion] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [yoId, setYoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const [resUsuarios, resYo] = await Promise.all([
      llamarApi("/api/usuarios"),
      llamarApi("/api/auth/yo"),
    ]);

    if (resUsuarios.estado === 401 || resYo.estado === 401) {
      router.push("/login");
      return;
    }
    if (resUsuarios.estado === 403) {
      setErrores(["No tienes permiso para administrar usuarios."]);
      setCargando(false);
      return;
    }
    if (!resUsuarios.ok) {
      setErrores(mensajesDeError(resUsuarios.datos, "No se pudieron cargar los usuarios."));
      setCargando(false);
      return;
    }

    setUsuarios(resUsuarios.datos.usuarios);
    setYoId(resYo.datos?.usuario?.id ?? null);
    setCargando(false);
  }, [router]);

  useEffect(() => {
    // Carga inicial de datos desde la API al abrir la página: uso legítimo de un efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
    setErrores([]);
  }

  function editar(u) {
    setEditandoId(u.id);
    setErrores([]);
    setMensaje("");
    setFormulario({ correo: u.correo, contrasenia: "", nombre: u.nombre, apellido: u.apellido, rol: u.rol });
    window.scrollTo(0, 0);
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrores([]);
    setMensaje("");
    setGuardando(true);

    // Al editar solo se envían nombre, apellido y rol (el correo no cambia).
    const cuerpo = editandoId
      ? { nombre: formulario.nombre, apellido: formulario.apellido, rol: formulario.rol }
      : formulario;

    const resultado = await llamarApi(
      editandoId ? `/api/usuarios/${editandoId}` : "/api/usuarios",
      { metodo: editandoId ? "PUT" : "POST", cuerpo }
    );
    setGuardando(false);

    if (resultado.estado === 401) {
      router.push("/login");
      return;
    }
    if (!resultado.ok) {
      setErrores(mensajesDeError(resultado.datos));
      return;
    }

    setMensaje(editandoId ? "Usuario actualizado." : "Usuario creado.");
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
    await cargar();
  }

  async function eliminar(u) {
    setErrores([]);
    setMensaje("");

    const resultado = await llamarApi(`/api/usuarios/${u.id}`, { metodo: "DELETE" });

    if (resultado.estado === 401) {
      router.push("/login");
      return;
    }
    if (!resultado.ok) {
      setErrores(mensajesDeError(resultado.datos, "No se pudo eliminar el usuario."));
      return;
    }
    setMensaje("Usuario eliminado.");
    await cargar();
  }

  if (cargando) return <p className="cargando">Cargando…</p>;

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <div>
          <h1>Administración de usuarios</h1>
          <p className="pagina__intro">
            Crea cuentas de personal y de clientes, y cambia sus roles.
          </p>
        </div>
      </div>

      <Alertas errores={errores} mensaje={mensaje} />

      <section className="tarjeta">
        <h2>{editandoId ? "Editar usuario" : "Nuevo usuario"}</h2>
        <form onSubmit={enviar} className="formulario">
          <label className="campo">
            Correo electrónico
            <input
              type="email"
              name="correo"
              autoComplete="off"
              value={formulario.correo}
              onChange={(e) => cambiar("correo", e.target.value)}
              maxLength={254}
              disabled={Boolean(editandoId)}
              required
            />
            {editandoId && <span className="campo__ayuda">El correo no se puede editar.</span>}
          </label>

          {!editandoId && (
            <label className="campo">
              Contraseña
              <input
                type="password"
                name="contrasenia"
                autoComplete="new-password"
                value={formulario.contrasenia}
                onChange={(e) => cambiar("contrasenia", e.target.value)}
                minLength={10}
                maxLength={72}
                required
              />
              <span className="campo__ayuda">
                Mínimo 10 caracteres, con mayúscula, minúscula y número.
              </span>
            </label>
          )}

          <label className="campo">
            Nombre
            <input
              type="text"
              name="nombre"
              autoComplete="off"
              value={formulario.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              maxLength={60}
              required
            />
          </label>

          <label className="campo">
            Apellido
            <input
              type="text"
              name="apellido"
              autoComplete="off"
              value={formulario.apellido}
              onChange={(e) => cambiar("apellido", e.target.value)}
              maxLength={60}
              required
            />
          </label>

          <label className="campo">
            Rol
            <select value={formulario.rol} onChange={(e) => cambiar("rol", e.target.value)} required>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {NOMBRE_ROL[rol]}
                </option>
              ))}
            </select>
          </label>

          <div className="acciones">
            <button type="submit" className="boton" disabled={guardando}>
              {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Crear usuario"}
            </button>
            {editandoId && (
              <button type="button" className="boton boton--secundario" onClick={cancelarEdicion}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="tarjeta">
        <h2>Usuarios registrados</h2>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Correo</th>
                <th scope="col">Rol</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.nombre} {u.apellido}
                    {u.id === yoId && " (tú)"}
                  </td>
                  <td>{u.correo}</td>
                  <td>{NOMBRE_ROL[u.rol] ?? u.rol}</td>
                  <td>
                    <div className="acciones">
                      <button
                        type="button"
                        className="boton boton--secundario boton--pequeno"
                        onClick={() => editar(u)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="boton boton--peligro boton--pequeno"
                        onClick={() =>
                          setConfirmacion({
                            mensaje: `¿Eliminar al usuario ${u.nombre} ${u.apellido} (${u.correo})?`,
                            accion: () => eliminar(u),
                          })
                        }
                        disabled={u.id === yoId}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td className="tabla--vacia" colSpan={4}>
                    No hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Confirmacion confirmacion={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}
