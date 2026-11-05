// Muestra los errores (lista) y el mensaje de éxito de una página del panel.
// Los errores usan role="alert" para que los lectores de pantalla los anuncien.
export default function Alertas({ errores = [], mensaje = "" }) {
  return (
    <>
      {errores.length > 0 && (
        <div role="alert" className="alerta alerta--error">
          <ul>
            {errores.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {mensaje && (
        <p role="status" className="alerta alerta--ok">
          {mensaje}
        </p>
      )}
    </>
  );
}
