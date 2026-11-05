"use client";

import { useEffect, useRef } from "react";

// Ventana de confirmación dentro de la página (reemplaza a window.confirm).
// confirmacion: null (cerrada) o { mensaje, accion }; "accion" se ejecuta al aceptar.
export default function Confirmacion({ confirmacion, onCerrar }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (confirmacion && !dialogo.open) dialogo.showModal();
    if (!confirmacion && dialogo.open) dialogo.close();
  }, [confirmacion]);

  function aceptar() {
    const accion = confirmacion.accion;
    onCerrar();
    accion();
  }

  return (
    <dialog
      ref={ref}
      className="confirmacion"
      aria-label="Confirmación"
      onCancel={(evento) => {
        // Tecla Esc: se cierra con el mismo código que el botón Cancelar.
        evento.preventDefault();
        onCerrar();
      }}
    >
      <p>{confirmacion?.mensaje}</p>
      <div className="acciones">
        <button type="button" className="boton" onClick={aceptar}>
          Aceptar
        </button>
        <button type="button" className="boton boton--secundario" onClick={onCerrar} autoFocus>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
