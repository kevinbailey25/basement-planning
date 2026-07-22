import assert from "node:assert/strict";
import test from "node:test";

import { estimateFraming, wallsToAdd } from "../lib/plan/framing.ts";
import { pocPlan } from "../lib/plan/poc-plan.ts";

test("framing estimate uses only walls in the Add construction scope", () => {
  const estimate = estimateFraming(pocPlan);
  assert.equal(wallsToAdd(pocPlan).length, 14);
  assert.equal(estimate.wallCount, 14);
  assert.equal(estimate.wallLengthInches, 2414);
  assert.equal(estimate.baseStudCount, 170);
  assert.equal(estimate.purchaseStudCount, 187);
  assert.equal(estimate.baseTopPlateBoards, 26);
  assert.equal(estimate.purchaseTopPlateBoards, 28);
  assert.equal(estimate.baseBottomPlateBoards, 26);
  assert.equal(estimate.purchaseBottomPlateBoards, 28);
  assert.equal(estimate.openingCount, 7);
  assert.equal(estimate.junctionCount, 17);
});

test("retained landing wall is excluded from the Additions estimate", () => {
  assert.equal(
    pocPlan.walls.find((wall) => wall.id === "finished-landing-office-jog-wall")?.status,
    "existing",
  );
  assert.deepEqual(
    pocPlan.walls.find((wall) => wall.id === "office-south-wall")?.from,
    [196, 327],
  );
});

test("closet wall framing dimensions use the east face", () => {
  assert.equal(
    pocPlan.walls.find((wall) => wall.id === "office-closet-divider-wall")?.dimensionSide,
    "right",
  );
  assert.equal(
    pocPlan.walls.find((wall) => wall.id === "office-west-jog-wall")?.dimensionSide,
    "right",
  );
});

test("Utility Room demolition is excluded while its new walls are estimated", () => {
  assert.equal(pocPlan.walls.find((wall) => wall.id === "furnace-room-south-wall")?.status, "existing");
  assert.equal(pocPlan.walls.find((wall) => wall.id === "furnace-room-storage-wall")?.status, "remove");
  assert.equal(pocPlan.walls.find((wall) => wall.id === "storage-north-wall")?.status, "proposed");
  assert.ok(wallsToAdd(pocPlan).some((wall) => wall.id === "utility-room-east-wall"));
  assert.ok(wallsToAdd(pocPlan).some((wall) => wall.id === "utility-room-north-wall-east-extension"));
});
