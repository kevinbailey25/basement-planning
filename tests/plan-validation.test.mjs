import assert from "node:assert/strict";
import test from "node:test";

import { pocPlan } from "../lib/plan/poc-plan.ts";
import { validatePlan } from "../lib/plan/validate.ts";

test("POC plan has valid references and unique IDs", () => {
  assert.deepEqual(validatePlan(pocPlan), []);
});

test("reports duplicate IDs and missing circuit endpoints", () => {
  const malformed = {
    ...pocPlan,
    lights: [...pocPlan.lights, { ...pocPlan.lights[0] }],
    circuits: [{ ...pocPlan.circuits[0], connections: [{ fromId: "entry-switch", toId: "missing-light" }] }],
  };
  const codes = validatePlan(malformed).map((issue) => issue.code);
  assert.ok(codes.includes("duplicate-id"));
  assert.ok(codes.includes("missing-circuit-endpoint"));
});

test("reports openings that extend beyond their wall", () => {
  const malformed = { ...pocPlan, windows: [{ ...pocPlan.windows[0], offset: 130 }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "opening-out-of-bounds"));
});
