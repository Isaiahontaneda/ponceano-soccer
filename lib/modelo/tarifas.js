import "server-only";

// Carga los tipos y todas las tarifas. Cada tarifa trae "tipoCodigo", "tipoNombre"
// y también "codigo" (alias que usan las validaciones).
// Lanza un error si la base de datos falla.
export async function cargarTarifasConTipo(admin) {
  const [resTipos, resTarifas] = await Promise.all([
    admin.from("tiposTarifa").select("id, codigo, nombre").order("id"),
    admin.from("tarifas").select("*").order("id"),
  ]);

  if (resTipos.error) throw resTipos.error;
  if (resTarifas.error) throw resTarifas.error;

  const tipos = resTipos.data;
  const tarifas = resTarifas.data.map((t) => {
    const tipo = tipos.find((x) => x.id === t.tipoId);
    return { ...t, tipoCodigo: tipo?.codigo, tipoNombre: tipo?.nombre, codigo: tipo?.codigo };
  });

  return { tipos, tarifas };
}
