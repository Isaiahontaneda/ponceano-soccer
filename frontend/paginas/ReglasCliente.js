"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fechaLegible, porcentaje } from "@/frontend/utilidades/formato";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";
import Confirmacion from "@/frontend/componentes/Confirmacion";

const FORMULARIO_VACIO = {
  tipoId: "",
  nombre: "",
  descuento: "",
  cadaReservas: "",
  diasAnticipacion: "",
  vigenteDesde: "",
  vigenteHasta: "",
  activa: true,
};

// Parámetro propio de cada tipo de regla.
function parametroTexto(r) {
  if (r.tipoCodigo === "TARJETA_SELLOS") return `Cada ${r.cadaReservas} reservas confirmadas`;
  if (r.tipoCodigo === "RESERVA_ANTICIPADA") return `${r.diasAnticipacion} días o más de anticipación`;
  return "—";
}

function vigenciaTexto(r) {
  const desde = `Desde ${fechaLegible(r.vigenteDesde)}`;
  return r.vigenteHasta ? `${desde} hasta ${fechaLegible(r.vigenteHasta)}` : `${desde}, sin fecha de fin`;
}

// Cuerpo para la API: solo el parámetro que corresponde al tipo (los demás van vacíos).
function cuerpoDe(formulario, tipoCodigo) {
  return {
    ...formulario,
    cadaReservas: tipoCodigo === "TARJETA_SELLOS" ? formulario.cadaReservas : null,
    diasAnticipacion: tipoCodigo === "RESERVA_ANTICIPADA" ? formulario.diasAnticipacion : null,
    vigenteHasta: formulario.vigenteHasta || null,
  };
}

// Regla guardada -> valores del formulario (el descuento se edita en porcentaje).
function formularioDe(r) {
  return {
    tipoId: String(r.tipoId),
    nombre: r.nombre,
    descuento: String(porcentaje(r.descuento)),
    cadaReservas: r.cadaReservas === null ? "" : String(r.cadaReservas),
    diasAnticipacion: r.diasAnticipacion === null ? "" : String(r.diasAnticipacion),
    vigenteDesde: r.vigenteDesde ?? "",
    vigenteHasta: r.vigenteHasta ?? "",
    activa: r.activa,
  };
}

export default function PaginaReglasCliente() {
  const router = useRouter();
  const [reglas, setReglas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmacion, setConfirmacion] = useState(null);

  const cargar = useCallback(async () => {
    const [resReglas, resTipos] = await Promise.all([
      llamarApi("/api/reglas-cliente"),
      llamarApi("/api/tipos-regla-cliente"),
    ]);

    if (resReglas.estado === 401 || resTipos.estado === 401) {
      router.push("/login");
      return;
    }
    if (resReglas.estado === 403 || resTipos.estado === 403) {
      setErrores(["No tienes permiso para administrar las reglas de cliente."]);
      setCargando(false);
      return;
    }
    if (!resReglas.ok || !resTipos.ok) {
      setErrores(["No se pudieron cargar los datos."]);
      setCargando(false);
      return;
    }

    setReglas(resReglas.datos.reglas);
    setTipos(resTipos.datos.tipos);
    setCargando(false);
  }, [router]);

  useEffect(() => {
    // Carga inicial de datos desde la API al abrir la página: uso legítimo de un efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const tipoElegido = tipos.find((t) => String(t.id) === String(formulario.tipoId))?.codigo;

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
    setErrores([]);
  }

  function editar(r) {
    setEditandoId(r.id);
    setErrores([]);
    setMensaje("");
    setFormulario(formularioDe(r));
    window.scrollTo(0, 0);
  }

  // Envía a la API y, si sale bien, muestra el mensaje y recarga. Devuelve true si se guardó.
  async function guardar(url, metodo, cuerpo, textoOk) {
    setErrores([]);
    setMensaje("");
    const resultado = await llamarApi(url, { metodo, cuerpo });

    if (resultado.estado === 401) {
      router.push("/login");
      return false;
    }
    if (!resultado.ok) {
      setErrores(mensajesDeError(resultado.datos));
      return false;
    }
    setMensaje(textoOk);
    await cargar();
    return true;
  }

  async function enviar(evento) {
    evento.preventDefault();
    setGuardando(true);
    const ok = await guardar(
      editandoId ? `/api/reglas-cliente/${editandoId}` : "/api/reglas-cliente",
      editandoId ? "PUT" : "POST",
      cuerpoDe(formulario, tipoElegido),
      editandoId ? "Regla actualizada." : "Regla creada."
    );
    setGuardando(false);
    if (ok) {
      setEditandoId(null);
      setFormulario(FORMULARIO_VACIO);
    }
  }

  function cambiarEstado(r) {
    const cuerpo = cuerpoDe({ ...formularioDe(r), activa: !r.activa }, r.tipoCodigo);
    guardar(`/api/reglas-cliente/${r.id}`, "PUT", cuerpo, r.activa ? "Regla desactivada." : "Regla activada.");
  }

  function eliminar(r) {
    guardar(`/api/reglas-cliente/${r.id}`, "DELETE", undefined, "Regla eliminada.");
  }

  if (cargando) return <p className="cargando">Cargando…</p>;

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <div>
          <h1>Reglas de cliente</h1>
          <p className="pagina__intro">
            Descuentos de fidelidad. Los descuentos no se acumulan: en cada reserva se aplica solo el mayor.
          </p>
        </div>
      </div>

      <Alertas errores={errores} mensaje={mensaje} />

      <section className="tarjeta">
        <h2>{editandoId ? "Editar regla" : "Nueva regla"}</h2>
        <form onSubmit={enviar} className="formulario">
          <label className="campo">
            Tipo de regla
            <select
              value={formulario.tipoId}
              onChange={(e) => cambiar("tipoId", e.target.value)}
              disabled={Boolean(editandoId)}
              required
            >
              <option value="">Selecciona un tipo…</option>
              {tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {editandoId && <span className="campo__ayuda">El tipo no se puede cambiar al editar.</span>}
          </label>

          <label className="campo">
            Nombre
            <input
              type="text"
              value={formulario.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              minLength={3}
              maxLength={60}
              required
            />
          </label>

          <label className="campo">
            Descuento (porcentaje)
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              max="50"
              value={formulario.descuento}
              onChange={(e) => cambiar("descuento", e.target.value)}
              required
            />
            <span className="campo__ayuda">De 0.1 a 50, con máximo 1 decimal (por ejemplo 12.5).</span>
          </label>

          {tipoElegido === "TARJETA_SELLOS" && (
            <label className="campo">
              Cada cuántas reservas confirmadas
              <input
                type="number"
                min="1"
                max="50"
                step="1"
                value={formulario.cadaReservas}
                onChange={(e) => cambiar("cadaReservas", e.target.value)}
                required
              />
            </label>
          )}

          {tipoElegido === "RESERVA_ANTICIPADA" && (
            <label className="campo">
              Días de anticipación (mínimo)
              <input
                type="number"
                min="1"
                max="365"
                step="1"
                value={formulario.diasAnticipacion}
                onChange={(e) => cambiar("diasAnticipacion", e.target.value)}
                required
              />
            </label>
          )}

          <label className="campo">
            Vigente desde
            <input
              type="date"
              value={formulario.vigenteDesde}
              onChange={(e) => cambiar("vigenteDesde", e.target.value)}
              required
            />
          </label>

          <label className="campo">
            Vigente hasta (opcional)
            <input
              type="date"
              value={formulario.vigenteHasta}
              onChange={(e) => cambiar("vigenteHasta", e.target.value)}
            />
            <span className="campo__ayuda">Déjalo vacío si la regla no tiene fecha de fin.</span>
          </label>

          <label className="campo">
            <span>
              <input
                type="checkbox"
                checked={formulario.activa}
                onChange={(e) => cambiar("activa", e.target.checked)}
              />{" "}
              Regla activa
            </span>
            <span className="campo__ayuda">Solo puede haber una regla activa de cada tipo.</span>
          </label>

          <div className="acciones">
            <button type="submit" className="boton" disabled={guardando}>
              {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Crear regla"}
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
        <h2>Reglas actuales</h2>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Descuento</th>
                <th scope="col">Parámetro</th>
                <th scope="col">Vigencia</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reglas.map((r) => (
                <tr key={r.id}>
                  <td>{r.nombre}</td>
                  <td>{r.tipoNombre}</td>
                  <td>−{porcentaje(r.descuento)} %</td>
                  <td>{parametroTexto(r)}</td>
                  <td>{vigenciaTexto(r)}</td>
                  <td>{r.activa ? "Activa" : "Inactiva"}</td>
                  <td>
                    <div className="acciones">
                      <button
                        type="button"
                        className="boton boton--secundario boton--pequeno"
                        onClick={() => editar(r)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="boton boton--secundario boton--pequeno"
                        onClick={() => cambiarEstado(r)}
                      >
                        {r.activa ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        type="button"
                        className="boton boton--peligro boton--pequeno"
                        onClick={() =>
                          setConfirmacion({
                            mensaje: `¿Eliminar la regla "${r.nombre}"?`,
                            accion: () => eliminar(r),
                          })
                        }
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {reglas.length === 0 && (
                <tr>
                  <td className="tabla--vacia" colSpan={7}>
                    No hay reglas de cliente registradas.
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
