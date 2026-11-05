import { comparacionesActivas } from "@/lib/validaciones/tarifa";

const ETIQUETAS = [
  ["franja", "Franja horaria"],
  ["calendario", "Calendario"],
  ["clienteFrecuente", "Cliente frecuente"],
];

// Muestra cuántas de las 3 comparaciones del Core tienen al menos una regla.
// "tarifas" es la lista de tarifas con "tipoCodigo".
export default function IndicadorCore({ tarifas }) {
  const estado = comparacionesActivas(tarifas);

  return (
    <div>
      {!estado.hayBase && (
        <p role="alert" className="alerta alerta--aviso">
          Falta la tarifa base: sin ella el Core no puede calcular precios. Crea una tarifa de tipo
          «Tarifa base».
        </p>
      )}
      <ul className="core" aria-label="Comparaciones activas del Core">
        <li className="core__titulo">Comparaciones activas del Core: {estado.total} de 3</li>
        {ETIQUETAS.map(([clave, texto]) => (
          <li key={clave} className={estado[clave] ? "core__si" : "core__no"}>
            <span aria-hidden="true">{estado[clave] ? "✔" : "✖"}</span> {texto}
            <span className="solo-lectores">{estado[clave] ? " (activa)" : " (falta una regla)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
