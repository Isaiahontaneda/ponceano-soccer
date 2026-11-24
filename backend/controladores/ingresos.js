import { NextResponse } from "next/server";
import { requerirAdmin } from "@/backend/auth";
import { crearClienteAdmin } from "@/backend/supabase/admin";
import { agruparIngresos, validarRangoIngresos } from "@/backend/validaciones/ingresos";
import { errorInterno, respuestaDenegada } from "@/backend/http";

const TAMANO_PAGINA = 1000;

// Reporte de ingresos (solo administrador):
// GET /api/reportes/ingresos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&agrupar=dia|mes
export async function GET(request) {
  const permiso = await requerirAdmin();
  if (permiso.error) return respuestaDenegada(permiso);

  const parametros = new URL(request.url).searchParams;
  const { errores, datos } = validarRangoIngresos({
    desde: parametros.get("desde"),
    hasta: parametros.get("hasta"),
    agrupar: parametros.get("agrupar") ?? undefined,
  });
  if (errores.length > 0) return NextResponse.json({ errores }, { status: 422 });

  // Se pagina de 1000 en 1000: Supabase devuelve como máximo 1000 filas por consulta y,
  // sin paginar, el reporte quedaría incompleto sin avisar.
  const admin = crearClienteAdmin();
  const reservas = [];
  for (let inicio = 0; ; inicio += TAMANO_PAGINA) {
    const { data, error } = await admin
      .from("reservas")
      .select("fecha, estado, precio")
      .gte("fecha", datos.desde)
      .lte("fecha", datos.hasta)
      .neq("estado", "CANCELADA")
      .order("id")
      .range(inicio, inicio + TAMANO_PAGINA - 1);
    if (error) return errorInterno(error, "No se pudo cargar el reporte de ingresos");

    reservas.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }

  return NextResponse.json({ ...datos, ...agruparIngresos(reservas, datos.agrupar) });
}
