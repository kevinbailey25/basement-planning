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
    walls: [...pocPlan.walls, { ...pocPlan.walls[0] }],
    circuits: [{
      id: "bad-circuit",
      kind: "circuit",
      label: "Bad circuit",
      layer: "lighting",
      connections: [{ fromId: "missing-switch", toId: "missing-light" }],
      status: "proposed",
      confidence: "approximate",
    }],
  };
  const codes = validatePlan(malformed).map((issue) => issue.code);
  assert.ok(codes.includes("duplicate-id"));
  assert.ok(codes.includes("missing-circuit-endpoint"));
});

test("reports openings that extend beyond their wall", () => {
  const malformed = { ...pocPlan, windows: [{ ...pocPlan.windows[0], offset: 430 }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "opening-out-of-bounds"));
});

test("reports stair geometry without a usable run", () => {
  const malformed = { ...pocPlan, stairs: [{ ...pocPlan.stairs[0], to: pocPlan.stairs[0].from }] };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-stairs"));
});
