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

test("reports invalid framing assumptions", () => {
  const malformed = { ...pocPlan, framing: { ...pocPlan.framing, studSpacing: 0 } };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-framing-plan"));
});

test("stores both Office water shutoffs with their measured enclosure data", () => {
  const main = pocPlan.waterValves.find((valve) => valve.id === "main-water-valve");
  const sprinkler = pocPlan.waterValves.find((valve) => valve.id === "sprinkler-water-valve");
  assert.ok(main);
  assert.ok(sprinkler);
  assert.deepEqual(
    [main.wallId, main.offset, main.referenceWallId, main.enclosureWidth, main.enclosureBottomAboveFloor, main.enclosureHeight],
    ["office-west-jog-wall", 54, "office-south-wall", 14, 20, 14],
  );
  assert.deepEqual(
    [sprinkler.wallId, sprinkler.offset, sprinkler.referenceWallId, sprinkler.enclosureWidth, sprinkler.enclosureBottomAboveFloor, sprinkler.enclosureHeight],
    ["office-west-wall", 48, "office-bump-south-wall", 14, 20, 24],
  );
});

test("reports water-valve enclosures outside their parent wall", () => {
  const malformed = {
    ...pocPlan,
    waterValves: [{ ...pocPlan.waterValves[0], enclosureWidth: 200 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-water-valve"));
});
