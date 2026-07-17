import assert from "node:assert/strict";
import test from "node:test";
import { pocPlan } from "../lib/plan/poc-plan.ts";

test("main ceiling joists preserve the measured north-to-south run", () => {
  const main = pocPlan.joists.filter((item) => item.id.startsWith("main-"));
  assert.equal(main.length, 41);
  assert.equal(main[0].id, "main-ceiling-joist-01");
  assert.equal(main[40].id, "main-ceiling-joist-41");
  assert.equal(main[0].width, 2.25);
  assert.equal(main[0].from[0] - main[0].width / 2, 13.25);
  assert.equal(main[16].from[0] - main[16].width / 2, 194.25);
  assert.equal(main[31].from[0] - main[31].width / 2, 399.5);
  assert.equal(main[40].from[0] + main[40].width / 2, 543.75);
  assert.equal(main[0].to[1], 264.5);
  assert.equal(main[30].to[1], 264.5);
  assert.equal(main[40].to[1], 263);
});

test("doubled joists retain zero clear gap", () => {
  for (const [first, second] of [[6, 7], [9, 10], [25, 26], [28, 29]]) {
    const a = pocPlan.joists.find((item) => item.id === `main-ceiling-joist-${String(first).padStart(2, "0")}`);
    const b = pocPlan.joists.find((item) => item.id === `main-ceiling-joist-${String(second).padStart(2, "0")}`);
    assert.ok(a && b);
    assert.equal(b.from[0] - a.from[0], a.width);
  }
});

test("bathroom joists retain only the observed main alignments", () => {
  const bathroom = pocPlan.joists.filter((item) => item.id.startsWith("bathroom-"));
  assert.deepEqual(bathroom.map((item) => item.number), [1, 3, 5, 8, 11]);
  assert.ok(bathroom.every((item) => item.from[1] === 269.5 && item.to[1] === 324.5));
});

test("office joists preserve aligned starts and measured gaps", () => {
  const main = pocPlan.joists.filter((item) => item.id.startsWith("main-"));
  const office = pocPlan.joists.filter((item) => item.id.startsWith("office-"));
  assert.equal(office.length, 14);
  assert.deepEqual(office.slice(0, 5).map((item) => item.from[0]), main.slice(0, 5).map((item) => item.from[0]));
  assert.deepEqual(
    office.slice(5).map((item, index) => item.from[0] - office[index + 4].from[0] - joistWidthForTest),
    [9.75, 9.5, 9.5, 10, 9.5, 4.75, 12, 16.5, 17],
  );
  assert.ok(office.slice(0, 10).every((item) => item.to[1] === 567));
  assert.ok(office.slice(10).every((item) => item.to[1] === 525));
});

const joistWidthForTest = 2.25;
