import assert from "node:assert/strict";
import test from "node:test";

import { estimateFraming, wallsNeedingFraming } from "../lib/plan/framing.ts";
import { pocPlan } from "../lib/plan/poc-plan.ts";

test("framing estimate uses only walls marked needs-framing", () => {
  const estimate = estimateFraming(pocPlan);
  assert.equal(wallsNeedingFraming(pocPlan).length, 12);
  assert.equal(estimate.wallCount, 12);
  assert.equal(estimate.wallLengthInches, 2233);
  assert.equal(estimate.baseStudCount, 156);
  assert.equal(estimate.purchaseStudCount, 172);
  assert.equal(estimate.baseTopPlateBoards, 24);
  assert.equal(estimate.purchaseTopPlateBoards, 26);
  assert.equal(estimate.baseBottomPlateBoards, 24);
  assert.equal(estimate.purchaseBottomPlateBoards, 26);
  assert.equal(estimate.openingCount, 6);
  assert.equal(estimate.junctionCount, 14);
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
