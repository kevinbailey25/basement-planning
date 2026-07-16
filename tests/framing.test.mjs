import assert from "node:assert/strict";
import test from "node:test";

import { estimateFraming, wallsNeedingFraming } from "../lib/plan/framing.ts";
import { pocPlan } from "../lib/plan/poc-plan.ts";

test("framing estimate uses only walls marked needs-framing", () => {
  const estimate = estimateFraming(pocPlan);
  assert.equal(wallsNeedingFraming(pocPlan).length, 11);
  assert.equal(estimate.wallCount, 11);
  assert.equal(estimate.wallLengthInches, 2109);
  assert.equal(estimate.baseStudCount, 147);
  assert.equal(estimate.purchaseStudCount, 162);
  assert.equal(estimate.baseTopPlateBoards, 22);
  assert.equal(estimate.purchaseTopPlateBoards, 25);
  assert.equal(estimate.baseBottomPlateBoards, 22);
  assert.equal(estimate.purchaseBottomPlateBoards, 25);
  assert.equal(estimate.openingCount, 5);
  assert.equal(estimate.junctionCount, 13);
});

test("finished landing portion is excluded from the Office wall estimate", () => {
  assert.equal(
    pocPlan.walls.find((wall) => wall.id === "finished-landing-office-jog-wall")?.framingStatus,
    "framed",
  );
  assert.deepEqual(
    pocPlan.walls.find((wall) => wall.id === "office-south-wall")?.from,
    [196, 327],
  );
});

test("finished Furnace Room boundaries are excluded from the framing estimate", () => {
  const framedIds = new Set(
    pocPlan.walls
      .filter((wall) => wall.framingStatus === "framed")
      .map((wall) => wall.id),
  );
  assert.ok(framedIds.has("furnace-room-south-wall"));
  assert.ok(framedIds.has("furnace-room-storage-wall"));
  assert.equal(
    pocPlan.walls.find((wall) => wall.id === "storage-north-wall")?.framingStatus,
    "needs-framing",
  );
});
