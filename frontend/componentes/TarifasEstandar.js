"use client";

import { useEffect, useState } from "react";
import { llamarApi } from "@/frontend/utilidades/api";

// "Noche (18:00–23:59): $45 a $50, hasta $55 en días de muy alta demanda"
function textoRango(rango) {
  const texto = `${rango.nombre} (${rango.desde}–${rango.hasta}): $${rango.minimo} a $${rango.maximo}`;
  return rango.maximoDemandaMuyAlta > rango.maximo
    ? `${texto}, hasta $${rango.maximoDemandaMuyAlta} en días de muy alta demanda`
    : texto;
}

// Rangos publicados por franja. Se leen de la API: son los mismos valores que usa el Core.
export default function TarifasEstandar() {
  const [rangos, setRangos] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Carga inicial desde la API: uso legítimo de un efecto (setState ocurre tras la respuesta).
    llamarApi("/api/precios/rangos").then((res) => {
      if (res.ok) setRangos(res.datos.rangos);
      else setError(true);
    });
  }, []);

  return (
    <section className="tarjeta">
      <h2>Tarifas estándar</h2>
      {error && (
        <p role="alert" className="alerta alerta--error">
          No se pudieron cargar las tarifas estándar.
        </p>
      )}
      {rangos && (
        <>
          <ul>
            {rangos.map((r) => (
              <li key={r.franja}>{textoRango(r)}</li>
            ))}
          </ul>
          <p className="campo__ayuda">
            El precio exacto depende del día, la hora y la demanda. Precios antes de descuentos: los
            clientes frecuentes reciben un descuento adicional.
          </p>
        </>
      )}
    </section>
  );
}
