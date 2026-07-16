import { distance } from "./helpers.ts";
import type { FloorPlan, SelectablePlanItem } from "./types.ts";

export interface PlanIssue {
  code: "duplicate-id" | "missing-wall" | "opening-out-of-bounds" | "missing-circuit-endpoint" | "zero-length-wall" | "invalid-stairs";
  itemId: string;
  message: string;
}

export function allPlanItems(plan: FloorPlan): SelectablePlanItem[] {
  return [
    ...plan.walls,
    ...plan.spaces,
    ...plan.doors,
    ...plan.windows,
    ...plan.lights,
    ...plan.switches,
    ...plan.stairs,
    ...plan.circuits,
    ...plan.dimensions,
  ];
}

export function validatePlan(plan: FloorPlan): PlanIssue[] {
  const issues: PlanIssue[] = [];
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
  for (const item of [...plan.doors, ...plan.windows]) {
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
