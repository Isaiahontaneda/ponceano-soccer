-- ============================================================================
-- Ponceano Soccer — datos iniciales: los 5 tipos de tarifa.
-- El orden importa: el código asume BASE = 1 (índice "tarifas_una_sola_base").
-- Es idempotente: se puede ejecutar varias veces.
-- ============================================================================

insert into "tiposTarifa" ("id", "codigo", "nombre")
overriding system value
values
  (1, 'BASE',              'Tarifa base'),
  (2, 'FRANJA_HORARIA',    'Franja horaria'),
  (3, 'DIA_SEMANA',        'Día de la semana'),
  (4, 'FECHA_ESPECIAL',    'Fecha especial'),
  (5, 'CLIENTE_FRECUENTE', 'Cliente frecuente')
on conflict ("id") do nothing;

-- Deja el contador de la identidad después del último id insertado a mano.
select setval(pg_get_serial_sequence('"tiposTarifa"', 'id'), greatest((select max("id") from "tiposTarifa"), 5));
