import assert from "node:assert/strict";
import test from "node:test";

import { pocPlan } from "../lib/plan/poc-plan.ts";
import { validatePlan } from "../lib/plan/validate.ts";

test("POC plan has valid references and unique IDs", () => {
  assert.deepEqual(validatePlan(pocPlan), []);
});

test("office door hinges on its south end and swings inward", () => {
  const officeDoor = pocPlan.doors.find((door) => door.id === "office-door");
  assert.ok(officeDoor);
  assert.equal(officeDoor.hinge, "end");
  assert.equal(officeDoor.swing, "inward");
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

test("reports a stair plan break outside the run", () => {
  const malformed = { ...pocPlan, stairs: [{ ...pocPlan.stairs[0], planBreakOffset: 999 }] };
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

test("stores the approximate furnace footprint from the field survey", () => {
  const furnace = pocPlan.hvacEquipment.find((item) => item.id === "existing-furnace");
  assert.ok(furnace);
  assert.equal(furnace.equipmentType, "furnace");
  assert.deepEqual([furnace.center, furnace.width, furnace.depth, furnace.rotation], [[408.5, 247], 18, 30, 0]);
  assert.equal(furnace.status, "existing");
  assert.equal(furnace.confidence, "approximate");
});

test("reports HVAC equipment without a usable footprint", () => {
  const malformed = {
    ...pocPlan,
    hvacEquipment: [{ ...pocPlan.hvacEquipment[0], width: 0 }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-hvac-equipment"));
});

test("stores the measured furnace return assembly", () => {
  const riser = pocPlan.hvacDucts.find((item) => item.id === "furnace-return-vertical-trunk");
  const trunk = pocPlan.hvacDucts.find((item) => item.id === "main-return-ceiling-trunk");
  assert.ok(riser && riser.orientation === "vertical");
  assert.ok(trunk && trunk.orientation === "horizontal");
  assert.deepEqual([riser.center, riser.width, riser.depth, riser.bottomAboveFloor, riser.topAboveFloor], [[392.5, 250], 12, 24, 0, 91]);
  assert.deepEqual([trunk.from, trunk.to, trunk.width, trunk.height, trunk.bottomAboveFloor], [[392.5, 250], [84.5, 250], 24, 10, 81]);
  assert.equal(trunk.airflowRole, "return");
});

test("reports invalid HVAC ducts", () => {
  const malformedDuct = {
    ...pocPlan,
    hvacDucts: [{ ...pocPlan.hvacDucts[0], topAboveFloor: 0 }],
  };
  assert.ok(validatePlan(malformedDuct).some((issue) => issue.code === "invalid-hvac-duct"));
});

test("stores the measured furnace supply trunk through its first reduction", () => {
  const plenum = pocPlan.hvacDucts.find((item) => item.id === "furnace-supply-vertical-plenum");
  const trunk24 = pocPlan.hvacDucts.find((item) => item.id === "main-supply-ceiling-trunk-24");
  const trunk20 = pocPlan.hvacDucts.find((item) => item.id === "main-supply-ceiling-trunk-20");
  const expansion = pocPlan.hvacDuctTransitions.find((item) => item.id === "furnace-supply-east-expansion");
  const reduction = pocPlan.hvacDuctTransitions.find((item) => item.id === "main-supply-reduction-24-to-20");
  assert.ok(plenum && plenum.orientation === "vertical");
  assert.ok(trunk24 && trunk24.orientation === "horizontal");
  assert.ok(trunk20 && trunk20.orientation === "horizontal");
  assert.ok(expansion);
  assert.ok(reduction);
  assert.deepEqual([plenum.center, plenum.width, plenum.depth, plenum.bottomAboveFloor, plenum.topAboveFloor], [[408.5, 251.75], 16.5, 20.5, 58, 91]);
  assert.deepEqual([trunk24.from, trunk24.waypoints, trunk24.to, trunk24.width, trunk24.height], [[412.25, 219.5], [[412.25, 207.5]], [161.5, 207.5], 24, 8]);
  assert.deepEqual([expansion.fromWidth, expansion.toWidth, expansion.fixedEdge], [16.5, 24, "north"]);
  assert.deepEqual([reduction.fromWidth, reduction.toWidth, reduction.fixedEdge], [24, 20, "west"]);
  assert.deepEqual([trunk20.from, trunk20.to, trunk20.width, trunk20.bottomAboveFloor], [[150, 209.5], [4, 209.5], 20, 83]);
});

test("reports an HVAC transition without a usable footprint", () => {
  const malformed = {
    ...pocPlan,
    hvacDuctTransitions: [{
      ...pocPlan.hvacDuctTransitions[0],
      polygon: [[0, 0], [1, 1], [2, 2], [3, 3]],
    }],
  };
  assert.ok(validatePlan(malformed).some((issue) => issue.code === "invalid-hvac-transition"));
});
