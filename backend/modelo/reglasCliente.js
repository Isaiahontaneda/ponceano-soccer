import "server-only";

// Carga los tipos y todas las reglas del cliente. Cada regla trae "tipoCodigo" y "tipoNombre".
// Mismo patrón que cargarTarifasConTipo. Lanza un error si la base de datos falla.
export async function cargarReglasConTipo(admin) {
  const [resTipos, resReglas] = await Promise.all([
    admin.from("tiposReglaCliente").select("id, codigo, nombre").order("id"),
    admin.from("reglasCliente").select("*").order("id"),
  ]);

  if (resTipos.error) throw resTipos.error;
  if (resReglas.error) throw resReglas.error;

  const tipos = resTipos.data;
  const reglas = resReglas.data.map((r) => {
    const tipo = tipos.find((x) => x.id === r.tipoId);
    return { ...r, tipoCodigo: tipo?.codigo, tipoNombre: tipo?.nombre };
  });

  return { tipos, reglas };
}
