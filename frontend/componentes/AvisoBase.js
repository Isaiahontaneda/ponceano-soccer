import { comparacionesActivas } from "@/backend/validaciones/tarifa";

// Avisa si todavía no existe la tarifa base (sin ella no se pueden calcular precios).
// "tarifas" es la lista de tarifas con "tipoCodigo".
export default function AvisoBase({ tarifas }) {
  if (comparacionesActivas(tarifas).hayBase) return null;

  return (
    <p role="alert" className="alerta alerta--aviso">
      Falta la tarifa base: sin ella no se pueden calcular precios. Crea una tarifa de tipo «Tarifa base».
    </p>
  );
}
