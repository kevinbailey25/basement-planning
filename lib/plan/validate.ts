import { distance } from "./helpers.ts";
import type { FloorPlan, SelectablePlanItem } from "./types.ts";

export interface PlanIssue {
  code: "duplicate-id" | "missing-wall" | "opening-out-of-bounds" | "missing-circuit-endpoint" | "zero-length-wall" | "invalid-stairs" | "invalid-framing-plan" | "invalid-water-valve";
  itemId: string;
  message: string;
}

export function allPlanItems(plan: FloorPlan): SelectablePlanItem[] {
  return [
    ...plan.walls,
    ...plan.spaces,
    ...plan.doors,
    ...plan.slidingDoors,
    ...plan.windows,
    ...plan.lights,
    ...plan.switches,
    ...plan.waterValves,
    ...plan.stairs,
    ...plan.circuits,
    ...plan.dimensions,
  ];
}

export function validatePlan(plan: FloorPlan): PlanIssue[] {
  const issues: PlanIssue[] = [];
  if (
    plan.framing.defaultWallHeight <= 0
    || plan.framing.studSpacing <= 0
    || plan.framing.stockLength <= 0
    || plan.framing.wasteFactor < 0
  ) {
    issues.push({ code: "invalid-framing-plan", itemId: plan.id, message: "Framing assumptions require positive dimensions and a non-negative waste factor." });
  }
  const allItems = allPlanItems(plan);
  const counts = new Map<string, number>();
  for (const item of allItems) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  for (const [id, count] of counts) {
    if (count > 1) issues.push({ code: "duplicate-id", itemId: id, message: `ID “${id}” is used ${count} times.` });
  }

  const walls = new Map(plan.walls.map((item) => [item.id, item]));
  for (const item of plan.walls) {
    if (distance(item.from, item.to) === 0) issues.push({ code: "zero-length-wall", itemId: item.id, message: `Wall “${item.id}” has no length.` });
  }
  for (const item of plan.stairs) {
    if (distance(item.from, item.to) === 0 || item.width <= 0 || item.risers < 2) {
      issues.push({ code: "invalid-stairs", itemId: item.id, message: `Stairs “${item.id}” require a run, positive width, and at least two risers.` });
    }
  }
  for (const item of [...plan.doors, ...plan.slidingDoors, ...plan.windows]) {
    const parent = walls.get(item.wallId);
    if (!parent) {
      issues.push({ code: "missing-wall", itemId: item.id, message: `Opening “${item.id}” references missing wall “${item.wallId}”.` });
      continue;
    }
    if (item.offset < 0 || item.width <= 0 || item.offset + item.width > distance(parent.from, parent.to)) {
      issues.push({ code: "opening-out-of-bounds", itemId: item.id, message: `Opening “${item.id}” falls outside wall “${item.wallId}”.` });
    }
  }
  for (const item of plan.switches) {
    const parent = walls.get(item.wallId);
    if (!parent) issues.push({ code: "missing-wall", itemId: item.id, message: `Switch “${item.id}” references missing wall “${item.wallId}”.` });
  }
  for (const item of plan.waterValves) {
    const parent = walls.get(item.wallId);
    const reference = walls.get(item.referenceWallId);
    if (!parent || !reference) {
      const missingId = !parent ? item.wallId : item.referenceWallId;
      issues.push({ code: "missing-wall", itemId: item.id, message: `Water valve “${item.id}” references missing wall “${missingId}”.` });
      continue;
    }
    const parentLength = distance(parent.from, parent.to);
    const halfWidth = item.enclosureWidth / 2;
    const referenceTouchesStart = Math.abs(
      distance(reference.from, parent.from) + distance(parent.from, reference.to)
      - distance(reference.from, reference.to),
    ) < 0.001;
    if (
      item.offset < 0
      || item.enclosureWidth <= 0
      || item.offset - halfWidth < 0
      || item.offset + halfWidth > parentLength
      || item.enclosureBottomAboveFloor < 0
      || item.enclosureHeight <= 0
      || item.labelDistance <= 0
      || item.dimensionDistance <= 0
      || !referenceTouchesStart
    ) {
      issues.push({ code: "invalid-water-valve", itemId: item.id, message: `Water valve “${item.id}” requires valid enclosure dimensions and a reference wall at the start of “${item.wallId}”.` });
    }
  }

  const endpointIds = new Set([...plan.lights, ...plan.switches].map((item) => item.id));
  for (const item of plan.circuits) {
    for (const connection of item.connections) {
      for (const endpoint of [connection.fromId, connection.toId]) {
        if (!endpointIds.has(endpoint)) issues.push({ code: "missing-circuit-endpoint", itemId: item.id, message: `Circuit “${item.id}” references missing endpoint “${endpoint}”.` });
      }
    }
  }
  return issues;
}
