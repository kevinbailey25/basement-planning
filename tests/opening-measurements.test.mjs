import assert from "node:assert/strict";
import test from "node:test";

import { measureOpening } from "../lib/plan/opening-measurements.ts";
import { pocPlan } from "../lib/plan/poc-plan.ts";

test("measures clear wall around the selected east-wall window", () => {
  const measurement = measureOpening(pocPlan, "east-wall-window-north");
  assert.ok(measurement);
  assert.equal(measurement.beforeDistance, 70);
  assert.equal(measurement.openingWidth, 47);
  assert.equal(measurement.afterDistance, 162);
  assert.equal(measurement.beforeDirection, "north");
  assert.equal(measurement.afterDirection, "south");
  assert.equal(measurement.confidence, "approximate");
});

test("measures the selected south window between the preceding opening and wall junction", () => {
  const measurement = measureOpening(pocPlan, "east-wall-window-south");
  assert.ok(measurement);
  assert.equal(measurement.beforeDistance, 162);
  assert.equal(measurement.openingWidth, 47);
  assert.equal(measurement.afterDistance, 26);
});

test("combines adjoining double-door leaves into one opening", () => {
  const measurement = measureOpening(pocPlan, "furnace-room-double-door-north-leaf");
  assert.ok(measurement);
  assert.equal(measurement.combined, true);
  assert.deepEqual(measurement.openingIds, [
    "furnace-room-double-door-north-leaf",
    "furnace-room-double-door-south-leaf",
  ]);
  assert.equal(measurement.beforeDistance, 21);
  assert.equal(measurement.openingWidth, 60);
  assert.equal(measurement.afterDistance, 21);
});

test("stops a window measurement at the nearest intersecting wall", () => {
  const measurement = measureOpening(pocPlan, "north-wall-window-east");
  assert.ok(measurement);
  assert.equal(measurement.beforeBoundary, 304);
  assert.equal(measurement.beforeDistance, 63.5);
  assert.equal(measurement.openingWidth, 48);
  assert.equal(measurement.beforeDirection, "west");
  assert.equal(measurement.afterDirection, "east");
});

test("measures the office door from either adjacent space", () => {
  const office = measureOpening(pocPlan, "office-door");
  const landing = measureOpening(pocPlan, "office-door", "left");
  assert.ok(office);
  assert.ok(landing);
  assert.equal(office.side, "right");
  assert.equal(office.sideLabel, "Office");
  assert.deepEqual(office.sideOptions, [
    { side: "right", label: "Office" },
    { side: "left", label: "Landing" },
  ]);
  assert.equal(office.beforeDistance, 147);
  assert.equal(office.afterDistance, 17);
  assert.equal(landing.sideLabel, "Landing");
  assert.equal(landing.beforeDistance, 18);
  assert.equal(landing.afterDistance, 17);
});

test("labels the opposite side of an exterior window", () => {
  const interior = measureOpening(pocPlan, "north-wall-window-east");
  const exterior = measureOpening(pocPlan, "north-wall-window-east", "left");
  assert.ok(interior);
  assert.ok(exterior);
  assert.deepEqual(interior.sideOptions, [
    { side: "right", label: "Main open area" },
    { side: "left", label: "Exterior" },
  ]);
  assert.equal(exterior.sideLabel, "Exterior");
  assert.equal(exterior.beforeDistance, 208.5);
});

test("continues Storage-side measurements across connected collinear wall segments", () => {
  const mainArea = measureOpening(pocPlan, "storage-door");
  const storage = measureOpening(pocPlan, "storage-door", "left");
  assert.ok(mainArea);
  assert.ok(storage);
  assert.equal(mainArea.sideLabel, "Main open area");
  assert.equal(mainArea.afterDistance, 28);
  assert.equal(storage.sideLabel, "Storage");
  assert.equal(storage.afterBoundary, 241);
  assert.equal(storage.afterDistance, 73);
  assert.equal(storage.afterDirection, "west");
});

test("keeps the office window 112 inches east of office-west-wall", () => {
  const window = pocPlan.windows.find((opening) => opening.id === "north-wall-office-window");
  const measurement = measureOpening(pocPlan, "north-wall-office-window");
  assert.ok(window);
  assert.ok(measurement);
  assert.equal(window.offset, 112);
  assert.equal(measurement.sideLabel, "Office");
  assert.equal(measurement.beforeDistance, 70);
});

test("measures the bypass closet doors from the Office or Closet face", () => {
  const office = measureOpening(pocPlan, "office-closet-sliding-door");
  const closet = measureOpening(pocPlan, "office-closet-sliding-door", "left");
  assert.ok(office);
  assert.ok(closet);
  assert.deepEqual(office.sideOptions, [
    { side: "right", label: "Office" },
    { side: "left", label: "Closet" },
  ]);
  assert.equal(office.openingWidth, 72);
  assert.equal(office.beforeDistance, 98);
  assert.equal(office.afterDistance, 26);
  assert.equal(closet.beforeDistance, 26);
  assert.equal(closet.afterDistance, 26);
});
