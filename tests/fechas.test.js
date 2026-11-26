import test from "node:test";
import assert from "node:assert/strict";
import { diasEntre, temporadaDe } from "../backend/fechas.js";

test("diciembre y mayo son invierno", () => {
  assert.equal(temporadaDe("2026-12-15"), "INVIERNO");
  assert.equal(temporadaDe("2027-05-31"), "INVIERNO");
});

test("junio y noviembre son verano", () => {
  assert.equal(temporadaDe("2026-06-01"), "VERANO");
  assert.equal(temporadaDe("2026-11-30"), "VERANO");
});

test("diasEntre: mismo día, días siguientes y fechas anteriores", () => {
  assert.equal(diasEntre("2026-11-26", "2026-11-26"), 0);
  assert.equal(diasEntre("2026-11-26", "2026-12-03"), 7);
  assert.equal(diasEntre("2026-11-26", "2026-11-20"), -6);
});

test("diasEntre: cambio de mes y de año", () => {
  assert.equal(diasEntre("2026-11-30", "2026-12-01"), 1);
  assert.equal(diasEntre("2026-12-28", "2027-01-04"), 7);
  assert.equal(diasEntre("2027-02-28", "2027-03-01"), 1); // 2027 no es bisiesto
  assert.equal(diasEntre("2028-02-28", "2028-03-01"), 2); // 2028 sí
});
