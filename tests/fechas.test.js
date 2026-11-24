import test from "node:test";
import assert from "node:assert/strict";
import { temporadaDe } from "../backend/fechas.js";

test("diciembre y mayo son invierno", () => {
  assert.equal(temporadaDe("2026-12-15"), "INVIERNO");
  assert.equal(temporadaDe("2027-05-31"), "INVIERNO");
});

test("junio y noviembre son verano", () => {
  assert.equal(temporadaDe("2026-06-01"), "VERANO");
  assert.equal(temporadaDe("2026-11-30"), "VERANO");
});
