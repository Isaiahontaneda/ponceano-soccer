-- Garantiza a nivel de base de datos que solo exista UNA tarifa base (tipoId = 1).
-- Es idempotente: se puede ejecutar varias veces sin error.
create unique index if not exists "tarifas_una_sola_base"
  on "tarifas" ("tipoId")
  where "tipoId" = 1;
