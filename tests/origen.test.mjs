import { test } from "node:test";
import assert from "node:assert/strict";
import { origenPermitido } from "../lib/validaciones/origen.js";

test("mismo origen: se permite", () => {
  assert.equal(origenPermitido({ origin: "http://localhost:3000", host: "localhost:3000", secFetchSite: "same-origin" }), true);
  assert.equal(origenPermitido({ origin: "https://ponceano.vercel.app", host: "ponceano.vercel.app", secFetchSite: null }), true);
});

test("otro origen: se rechaza", () => {
  assert.equal(origenPermitido({ origin: "https://malo.com", host: "ponceano.vercel.app", secFetchSite: "cross-site" }), false);
  assert.equal(origenPermitido({ origin: "http://localhost:3001", host: "localhost:3000", secFetchSite: null }), false);
});

test("Origin nulo o inválido: se rechaza", () => {
  assert.equal(origenPermitido({ origin: "null", host: "localhost:3000", secFetchSite: null }), false);
  assert.equal(origenPermitido({ origin: "no es una url", host: "localhost:3000", secFetchSite: null }), false);
});

test("un subdominio parecido no engaña", () => {
  assert.equal(origenPermitido({ origin: "https://ponceano.vercel.app.malo.com", host: "ponceano.vercel.app", secFetchSite: null }), false);
});

test("sin Origin: se permite salvo que el navegador declare otro sitio", () => {
  assert.equal(origenPermitido({ origin: null, host: "localhost:3000", secFetchSite: null }), true);
  assert.equal(origenPermitido({ origin: null, host: "localhost:3000", secFetchSite: "same-origin" }), true);
  assert.equal(origenPermitido({ origin: null, host: "localhost:3000", secFetchSite: "cross-site" }), false);
  assert.equal(origenPermitido({ origin: null, host: "localhost:3000", secFetchSite: "same-site" }), false);
});

test("sin Host: se rechaza", () => {
  assert.equal(origenPermitido({ origin: "http://localhost:3000", host: null, secFetchSite: null }), false);
});
