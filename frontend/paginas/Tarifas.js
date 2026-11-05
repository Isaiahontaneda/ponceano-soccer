"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DIAS, dolares, hora, porcentaje } from "@/frontend/utilidades/formato";
import { llamarApi, mensajesDeError } from "@/frontend/utilidades/api";
import Alertas from "@/frontend/componentes/Alertas";
import AvisoBase from "@/frontend/componentes/AvisoBase";
import Confirmacion from "@/frontend/componentes/Confirmacion";

const FORMULARIO_VACIO = {
  tipoId: "",
  nombre: "",
  valor: "",
  horaInicio: "",
  horaFin: "",
  diaSemana: "",
  fecha: "",
  minReservas: "",
};

// Texto del valor según el tipo: base en dólares, el resto en porcentaje.
function valorTexto(t) {
  if (t.tipoCodigo === "BASE") return dolares(t.valor);
  if (t.tipoCodigo === "CLIENTE_FRECUENTE") return `−${porcentaje(t.valor)} %`;
  return `+${porcentaje(t.valor)} %`;
}

function detalleTexto(t) {
  switch (t.tipoCodigo) {
    case "BASE":
      return "Precio por hora";
    case "FRANJA_HORARIA":
      return `${hora(t.horaInicio)} a ${hora(t.horaFin)}`;
    case "DIA_SEMANA":
      return DIAS[t.diaSemana];
    case "FECHA_ESPECIAL":
      return t.fecha;
    case "CLIENTE_FRECUENTE":
      return `Desde ${t.minReservas} reservas confirmadas`;
    default:
      return "";
  }
}

// Cómo influye cada regla en el precio final (fórmula del precio).
function efectoTexto(t, base) {
  switch (t.tipoCodigo) {
    case "BASE":
      return `Precio base: ${dolares(t.valor)} por hora`;
    case "FRANJA_HORARIA":
      return base
        ? `${dolares(Number(base.valor) * (1 + Number(t.valor)))} por hora (base + ${porcentaje(t.valor)} %)`
        : "—";
    case "DIA_SEMANA":
    case "FECHA_ESPECIAL":
      return "Se suma al recargo de la franja";
    case "CLIENTE_FRECUENTE":
      return "Se resta al final, sobre el subtotal";
    default:
      return "—";
  }
}

export default function PaginaTarifas() {
  const router = useRouter();
  const [confirmacion, setConfirmacion] = useState(null);
  const [tarifas, setTarifas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const [resTarifas, resTipos] = await Promise.all([
      llamarApi("/api/tarifas"),
      llamarApi("/api/tipos-tarifa"),
    ]);

    if (resTarifas.estado === 401 || resTipos.estado === 401) {
      router.push("/login");
      return;
    }
    if (resTarifas.estado === 403 || resTipos.estado === 403) {
      setErrores(["No tienes permiso para administrar tarifas."]);
      setCargando(false);
      return;
    }
    if (!resTarifas.ok || !resTipos.ok) {
      setErrores(["No se pudieron cargar los datos."]);
      setCargando(false);
      return;
    }

    setTarifas(resTarifas.datos.tarifas);
    setTipos(resTipos.datos.tipos);
    setCargando(false);
  }, [router]);

  useEffect(() => {
    // Carga inicial de datos desde la API al abrir la página: uso legítimo de un efecto.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  const tipoElegido = tipos.find((t) => String(t.id) === String(formulario.tipoId))?.codigo;
  const base = tarifas.find((t) => t.tipoCodigo === "BASE");

  // Si ya existe la tarifa base, no se ofrece crear otra (al editar se muestran todos).
  const tiposOfrecidos = editandoId || !base ? tipos : tipos.filter((t) => t.codigo !== "BASE");

  function cambiar(campo, valor) {
    setFormulario((anterior) => ({ ...anterior, [campo]: valor }));
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
    setErrores([]);
  }

  function editar(t) {
    setEditandoId(t.id);
    setErrores([]);
    setMensaje("");
    setFormulario({
      tipoId: String(t.tipoId),
      nombre: t.nombre,
      // La base se edita en dólares; recargos y descuentos, en porcentaje.
      valor: t.tipoCodigo === "BASE" ? String(t.valor) : String(porcentaje(t.valor)),
      horaInicio: hora(t.horaInicio),
      horaFin: hora(t.horaFin),
      diaSemana: t.diaSemana === null ? "" : String(t.diaSemana),
      fecha: t.fecha ?? "",
      minReservas: t.minReservas === null ? "" : String(t.minReservas),
    });
    window.scrollTo(0, 0);
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErrores([]);
    setMensaje("");
    setGuardando(true);

    const resultado = await llamarApi(
      editandoId ? `/api/tarifas/${editandoId}` : "/api/tarifas",
      { metodo: editandoId ? "PUT" : "POST", cuerpo: formulario }
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

    setMensaje(editandoId ? "Tarifa actualizada." : "Tarifa creada.");
    setEditandoId(null);
    setFormulario(FORMULARIO_VACIO);
    await cargar();
  }

  async function eliminar(t) {
    setErrores([]);
    setMensaje("");

    const resultado = await llamarApi(`/api/tarifas/${t.id}`, { metodo: "DELETE" });

    if (resultado.estado === 401) {
      router.push("/login");
      return;
    }
    if (!resultado.ok) {
      setErrores(mensajesDeError(resultado.datos, "No se pudo eliminar la tarifa."));
      return;
    }
    setMensaje("Tarifa eliminada.");
    await cargar();
  }

  if (cargando) {
    return <p className="cargando">Cargando…</p>;
  }

  const etiquetaValor =
    tipoElegido === "BASE"
      ? "Valor (precio por hora en dólares)"
      : tipoElegido === "CLIENTE_FRECUENTE"
      ? "Descuento (porcentaje)"
      : "Recargo (porcentaje)";
  const ayudaValor =
    tipoElegido === "BASE"
      ? "Ejemplo: 40 o 40.50 (máximo 2 decimales)."
      : "Ejemplo: 12.5 equivale a 12.5 % (de 0 a 100, máximo 1 decimal).";

  return (
    <div className="pagina">
      <div className="pagina__cabecera">
        <div>
          <h1>Administración de tarifas</h1>
          <p className="pagina__intro">
            Estas reglas determinan el precio de cada reserva.
          </p>
        </div>
      </div>

      <AvisoBase tarifas={tarifas} />

      <Alertas errores={errores} mensaje={mensaje} />

      <section className="tarjeta">
        <h2>{editandoId ? "Editar tarifa" : "Nueva tarifa"}</h2>
        <form onSubmit={enviar} className="formulario">
          <label className="campo">
            Tipo de tarifa
            <select
              value={formulario.tipoId}
              onChange={(e) => cambiar("tipoId", e.target.value)}
              disabled={Boolean(editandoId)}
              required
            >
              <option value="">Selecciona un tipo…</option>
              {tiposOfrecidos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            {editandoId && (
              <span className="campo__ayuda">El tipo no se puede cambiar al editar.</span>
            )}
          </label>

          <label className="campo">
            Nombre
            <input
              type="text"
              value={formulario.nombre}
              onChange={(e) => cambiar("nombre", e.target.value)}
              maxLength={60}
              required
            />
          </label>

          <label className="campo">
            {etiquetaValor}
            <input
              type="number"
              inputMode="decimal"
              step={tipoElegido === "BASE" ? "0.01" : "0.1"}
              min="0"
              value={formulario.valor}
              onChange={(e) => cambiar("valor", e.target.value)}
              required
            />
            {tipoElegido && <span className="campo__ayuda">{ayudaValor}</span>}
          </label>

          {tipoElegido === "FRANJA_HORARIA" && (
            <>
              <label className="campo">
                Hora de inicio
                <input
                  type="time"
                  value={formulario.horaInicio}
                  onChange={(e) => cambiar("horaInicio", e.target.value)}
                  required
                />
              </label>
              <label className="campo">
                Hora de fin
                <input
                  type="time"
                  value={formulario.horaFin}
                  onChange={(e) => cambiar("horaFin", e.target.value)}
                  required
                />
                <span className="campo__ayuda">
                  Incluida en la franja. Ejemplo: 18:00 a 21:59 cubre los bloques de 18:00, 19:00,
                  20:00 y 21:00.
                </span>
              </label>
            </>
          )}

          {tipoElegido === "DIA_SEMANA" && (
            <label className="campo">
              Día de la semana
              <select
                value={formulario.diaSemana}
                onChange={(e) => cambiar("diaSemana", e.target.value)}
                required
              >
                <option value="">Selecciona un día…</option>
                {DIAS.map((dia, indice) => (
                  <option key={indice} value={indice}>
                    {dia}
                  </option>
                ))}
              </select>
            </label>
          )}

          {tipoElegido === "FECHA_ESPECIAL" && (
            <label className="campo">
              Fecha
              <input
                type="date"
                value={formulario.fecha}
                onChange={(e) => cambiar("fecha", e.target.value)}
                required
              />
            </label>
          )}

          {tipoElegido === "CLIENTE_FRECUENTE" && (
            <label className="campo">
              Mínimo de reservas confirmadas (últimos 30 días)
              <input
                type="number"
                min="1"
                step="1"
                value={formulario.minReservas}
                onChange={(e) => cambiar("minReservas", e.target.value)}
                required
              />
            </label>
          )}

          <div className="acciones">
            <button type="submit" className="boton" disabled={guardando}>
              {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Crear tarifa"}
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
        <h2>Tarifas actuales</h2>
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Tipo</th>
                <th scope="col">Nombre</th>
                <th scope="col">Valor</th>
                <th scope="col">Detalle</th>
                <th scope="col">Efecto en el precio</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t) => (
                <tr key={t.id}>
                  <td>{t.tipoNombre}</td>
                  <td>{t.nombre}</td>
                  <td>{valorTexto(t)}</td>
                  <td>{detalleTexto(t)}</td>
                  <td>{efectoTexto(t, base)}</td>
                  <td>
                    <div className="acciones">
                      <button
                        type="button"
                        className="boton boton--secundario boton--pequeno"
                        onClick={() => editar(t)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="boton boton--peligro boton--pequeno"
                        onClick={() =>
                          setConfirmacion({
                            mensaje: `¿Eliminar la tarifa "${t.nombre}"?`,
                            accion: () => eliminar(t),
                          })
                        }
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tarifas.length === 0 && (
                <tr>
                  <td className="tabla--vacia" colSpan={6}>
                    No hay tarifas registradas.
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
