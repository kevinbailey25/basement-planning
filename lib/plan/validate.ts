import { distance } from "./helpers.ts";
import type { FloorPlan, SelectablePlanItem } from "./types.ts";

export interface PlanIssue {
  code: "duplicate-id" | "missing-wall" | "opening-out-of-bounds" | "missing-circuit-endpoint" | "zero-length-wall" | "invalid-stairs" | "invalid-joist" | "invalid-framing-plan" | "invalid-water-valve" | "invalid-plumbing-drain" | "invalid-plumbing-equipment" | "invalid-gas-line" | "invalid-hvac-equipment" | "invalid-hvac-duct" | "invalid-hvac-joist-return" | "missing-joist" | "invalid-hvac-transition" | "invalid-hvac-refrigerant-line";
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
    ...plan.plumbingDrains,
    ...plan.plumbingEquipment,
    ...plan.gasLines,
    ...plan.stairs,
    ...plan.joists,
    ...plan.hvacEquipment,
    ...plan.hvacDucts,
    ...plan.hvacJoistReturns,
    ...plan.hvacDuctTransitions,
    ...plan.hvacRefrigerantLines,
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
    const runLength = distance(item.from, item.to);
    if (runLength === 0 || item.width <= 0 || item.risers < 2 || (item.planBreakOffset != null && (item.planBreakOffset <= 0 || item.planBreakOffset >= runLength))) {
      issues.push({ code: "invalid-stairs", itemId: item.id, message: `Stairs “${item.id}” require a run, positive width, at least two risers, and any plan break strictly inside the run.` });
    }
  }
  for (const item of plan.joists) {
    if (distance(item.from, item.to) === 0 || item.width <= 0 || item.number < 1) {
      issues.push({ code: "invalid-joist", itemId: item.id, message: `Joist “${item.id}” requires a run, positive width, and positive sequence number.` });
    }
  }
  for (const item of plan.hvacEquipment) {
    if (
      !Number.isFinite(item.center[0])
      || !Number.isFinite(item.center[1])
      || item.width <= 0
      || item.depth <= 0
      || !Number.isFinite(item.rotation)
      || (item.height != null && item.height <= 0)
    ) {
      issues.push({ code: "invalid-hvac-equipment", itemId: item.id, message: `HVAC equipment “${item.id}” requires a finite position and rotation with positive footprint dimensions.` });
    }
  }
  for (const item of plan.hvacDucts) {
    const invalidHorizontal = item.orientation === "horizontal" && (() => {
      const points = [item.from, ...(item.waypoints ?? []), item.to];
      const hasZeroSegment = points.slice(1).some((point, index) => distance(points[index], point) === 0);
      const hasInvalidSize = item.shape === "round"
        ? item.diameter <= 0
        : item.width <= 0 || item.height <= 0;
      return hasZeroSegment
      || hasInvalidSize
      || item.bottomAboveFloor < 0;
    })();
    const invalidVertical = item.orientation === "vertical" && (
      !Number.isFinite(item.center[0])
      || !Number.isFinite(item.center[1])
      || item.width <= 0
      || item.depth <= 0
      || !Number.isFinite(item.rotation)
      || item.bottomAboveFloor < 0
      || item.topAboveFloor <= item.bottomAboveFloor
    );
    if (invalidHorizontal || invalidVertical) {
      issues.push({ code: "invalid-hvac-duct", itemId: item.id, message: `HVAC duct “${item.id}” requires positive dimensions, valid elevations, and usable plan geometry.` });
    }
  }
  const joistIds = new Set(plan.joists.map((item) => item.id));
  for (const item of plan.hvacJoistReturns) {
    const twiceArea = Math.abs(item.polygon.reduce((sum, point, index) => {
      const next = item.polygon[(index + 1) % item.polygon.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0));
    if (item.polygon.length < 3 || twiceArea === 0 || item.joistIds.length < 2) {
      issues.push({ code: "invalid-hvac-joist-return", itemId: item.id, message: `Panned joist return “${item.id}” requires a usable footprint and at least two framing references.` });
    }
    for (const joistId of item.joistIds) {
      if (!joistIds.has(joistId)) issues.push({ code: "missing-joist", itemId: item.id, message: `Panned joist return “${item.id}” references missing joist “${joistId}”.` });
    }
  }
  for (const item of plan.hvacDuctTransitions) {
    const twiceArea = Math.abs(item.polygon.reduce((sum, point, index) => {
      const next = item.polygon[(index + 1) % item.polygon.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0));
    if (twiceArea === 0 || item.fromWidth <= 0 || item.toWidth <= 0 || item.height <= 0 || item.bottomAboveFloor < 0) {
      issues.push({ code: "invalid-hvac-transition", itemId: item.id, message: `HVAC transition “${item.id}” requires a usable footprint, positive widths and height, and a valid elevation.` });
    }
  }
  for (const item of plan.hvacRefrigerantLines) {
    const points = [item.from, ...(item.waypoints ?? []), item.to];
    const hasZeroSegment = points.slice(1).some((point, index) => distance(points[index], point) === 0);
    if (
      hasZeroSegment
      || item.wallPenetrationBelowJoists < 0
    ) {
      issues.push({ code: "invalid-hvac-refrigerant-line", itemId: item.id, message: `HVAC refrigerant line “${item.id}” requires usable plan geometry and a non-negative joist offset.` });
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
  for (const item of plan.plumbingDrains) {
    if (
      !Number.isFinite(item.at[0])
      || !Number.isFinite(item.at[1])
      || item.diameter <= 0
      || item.heightAboveFloor < 0
    ) {
      issues.push({ code: "invalid-plumbing-drain", itemId: item.id, message: `Plumbing drain “${item.id}” requires a finite position, positive diameter, and non-negative height.` });
    }
  }
  for (const item of plan.plumbingEquipment) {
    if (
      !Number.isFinite(item.center[0])
      || !Number.isFinite(item.center[1])
      || item.diameter <= 0
      || item.height <= 0
    ) {
      issues.push({ code: "invalid-plumbing-equipment", itemId: item.id, message: `Plumbing equipment “${item.id}” requires a finite position, positive footprint, and positive height.` });
    }
  }
  for (const item of plan.gasLines) {
    const points = [item.from, ...(item.waypoints ?? []), item.to];
    const hasInvalidPoint = points.some((point) => !Number.isFinite(point[0]) || !Number.isFinite(point[1]));
    const hasZeroSegment = points.slice(1).some((point, index) => distance(points[index], point) === 0);
    if (
      hasInvalidPoint
      || hasZeroSegment
      || (item.heightAboveFloor != null && item.heightAboveFloor < 0)
      || (item.offsetBelowJoists != null && item.offsetBelowJoists < 0)
    ) {
      issues.push({ code: "invalid-gas-line", itemId: item.id, message: `Gas line “${item.id}” requires usable plan geometry and non-negative placement measurements.` });
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
