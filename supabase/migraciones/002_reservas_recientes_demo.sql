-- =============================================================================================
-- 002 — Reservas recientes de DEMOSTRACIÓN (historial ACTUAL del Core v2)
--
-- Inserta reservas CONFIRMADAS desde el 2026-11-01 hasta ayer, para que el historial "Últimas
-- semanas" tenga datos. Se ejecuta a mano en el SQL Editor de Supabase, DESPUÉS de la 001.
--
-- ANTES DE EJECUTAR: cambia CORREO-CLIENTE-DEMO (línea de abajo) por el correo de un usuario que
-- ya exista con rol CLIENTE. Si no existe, el script se detiene con un mensaje claro.
--
-- ⚠ ESTAS RESERVAS CUENTAN PARA EL DESCUENTO DE CLIENTE FRECUENTE DEL CLIENTE DE DEMOSTRACIÓN.
--   Es lo esperado: al calcular precios para ese cliente, casi siempre tendrá el −10 %.
--   Para ver precios sin descuento, usa otro cliente o "Sin cliente" en la calculadora.
--
-- Datos SIMULADOS, con los patrones del historial antiguo (temporada de verano):
--   - Mañanas bajas (lunes a viernes a las 08:00 y 09:00, nunca).
--   - Tardes medias.
--   - Noches altas martes, jueves, viernes, sábado y domingo (18:00 a 21:00, siempre).
--   - DESACUERDO A PROPÓSITO: los domingos a las 18:00 no hay ninguna reserva reciente (0 %).
--     El historial antiguo dice ALTA y el actual BAJA → "Los historiales no coinciden".
-- Los bloques que se usan en la demostración son fijos (probabilidad 0 o 1); el resto usa
-- random() con semilla fija, así el resultado se repite igual cada vez.
-- =============================================================================================

select set_config('demo.correo', 'CORREO-CLIENTE-DEMO', false);

do $$
declare
  correo_demo text := lower(current_setting('demo.correo'));
  cliente_demo uuid;
begin
  select "id" into cliente_demo
  from "usuarios"
  where "correo" = correo_demo and "rol" = 'CLIENTE';

  if cliente_demo is null then
    raise exception 'No existe un usuario con rol CLIENTE y correo "%". Créalo desde Usuarios en el panel y cambia CORREO-CLIENTE-DEMO al inicio del script.', correo_demo;
  end if;

  perform setseed(0.42); -- semilla fija: mismas reservas en cada ejecución

  with bloques as (
    select d::date as fecha, h as hora, extract(dow from d)::int as dia -- 0 = domingo ... 6 = sábado
    from generate_series(date '2026-11-01', current_date - 1, interval '1 day') as d
    cross join generate_series(8, 23) as h
  ),
  probabilidades as (
    select fecha, hora, dia,
      case
        when dia = 0 and hora = 18 then 0                              -- desacuerdo a propósito
        when hora between 8 and 9 and dia between 1 and 5 then 0       -- mañanas entre semana: vacías
        when hora between 8 and 11 then 0.20                           -- resto de mañanas: bajas
        when hora between 12 and 17 then 0.45                          -- tardes: medias
        when dia in (0, 2, 4, 5, 6) and hora between 18 and 21 then 1  -- noches altas: siempre
        when dia in (0, 2, 4, 5, 6) then 0.60                          -- 22:00 y 23:00 de esos días
        else 0.45                                                      -- noches de lunes y miércoles
      end as probabilidad
    from bloques
  ),
  elegidas as (
    select * from probabilidades where random() < probabilidad
  ),
  -- Precio con las tarifas actuales (sin ajuste histórico): base $40 + franja + sábado + feriado.
  -- No se aplica el descuento de cliente frecuente, para simplificar.
  con_precio as (
    select fecha, hora,
      40 * (1
        + case when hora between 18 and 21 then 0.25 when hora >= 22 then 0.125 else 0 end
        + case when dia = 6 then 0.10 else 0 end
        + case when fecha = date '2026-11-02' then 0.20 else 0 end
      ) as precio_tarifas,
      case when hora < 12 then 35 when hora < 18 then 38 else 45 end as minimo,
      case when hora < 12 then 40 when hora < 18 then 45 else 50 end as maximo
    from elegidas
  )
  insert into "reservas" ("codigo", "fecha", "horaInicio", "estado", "precio", "clienteId")
  select
    -- R-AAAAMMDD-HHMM-XXXX; el sufijo sale de md5, con el alfabeto sin 0/O ni 1/I.
    'R-' || to_char(fecha, 'YYYYMMDD') || '-' || lpad(hora::text, 2, '0') || '00-' || (
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
               get_byte(decode(md5('demo-' || fecha::text || '-' || hora::text), 'hex'), i) % 32 + 1, 1),
        '' order by i)
      from generate_series(0, 3) as i
    ),
    fecha,
    make_time(hora, 0, 0),
    'CONFIRMADA',
    round(least(greatest(precio_tarifas, minimo), maximo), 2), -- rango publicado normal
    cliente_demo
  from con_precio
  on conflict do nothing; -- no choca con reservas reales ni con el índice de horario único
end $$;

-- Verificación: reservas del cliente de demostración por día de la semana y franja.
select
  extract(dow from r."fecha")::int as "diaSemana",
  case
    when r."horaInicio" < time '12:00' then 'MANANA'
    when r."horaInicio" < time '18:00' then 'TARDE'
    else 'NOCHE'
  end as "franja",
  count(*) as "reservas"
from "reservas" r
join "usuarios" u on u."id" = r."clienteId"
where u."correo" = lower(current_setting('demo.correo'))
  and r."fecha" >= date '2026-11-01'
  and r."estado" = 'CONFIRMADA'
group by 1, 2
order by 1, 2;
