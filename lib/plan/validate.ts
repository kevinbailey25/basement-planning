import { distance, wallCabinetSpan } from "./helpers.ts";
import type { FloorPlan, SelectablePlanItem } from "./types.ts";

export interface PlanIssue {
  code: "duplicate-id" | "missing-wall" | "missing-soffit" | "opening-out-of-bounds" | "missing-circuit-endpoint" | "zero-length-wall" | "invalid-stairs" | "invalid-joist" | "invalid-framing-plan" | "invalid-soffit" | "invalid-light" | "invalid-wall-light" | "invalid-switch" | "invalid-receptacle" | "invalid-ceiling-receptacle" | "invalid-exhaust-fan" | "invalid-wall-cabinet" | "invalid-cabinet-run" | "invalid-bathroom-fixture" | "missing-plumbing-drain" | "invalid-water-valve" | "invalid-plumbing-drain" | "invalid-plumbing-equipment" | "invalid-radon-pipe" | "invalid-gas-line" | "invalid-hvac-equipment" | "invalid-hvac-duct" | "invalid-hvac-joist-return" | "invalid-hvac-return-grille" | "invalid-hvac-wall-cavity-return" | "invalid-hvac-wall-ducted-return" | "missing-hvac-source" | "missing-joist" | "invalid-hvac-transition" | "invalid-hvac-refrigerant-line";
  itemId: string;
  message: string;
}

export function allPlanItems(plan: FloorPlan): SelectablePlanItem[] {
  return [
    ...plan.walls,
    ...plan.spaces,
    ...plan.soffits,
    ...plan.doors,
    ...plan.slidingDoors,
    ...plan.windows,
    ...plan.lights,
    ...plan.wallLights,
    ...plan.exhaustFans,
    ...plan.switches,
    ...plan.receptacles,
    ...plan.ceilingReceptacles,
    ...plan.wallCabinets,
    ...plan.cabinetRuns,
    ...plan.bathroomFixtures,
    ...plan.waterValves,
    ...plan.plumbingDrains,
    ...plan.plumbingEquipment,
    ...plan.radonPipes,
    ...plan.gasLines,
    ...plan.stairs,
    ...plan.joists,
    ...plan.hvacEquipment,
    ...plan.hvacDucts,
    ...plan.hvacJoistReturns,
    ...plan.hvacReturnGrilles,
    ...plan.hvacWallCavityReturns,
    ...plan.hvacWallDuctedReturns,
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
  for (const item of plan.soffits) {
    const twiceArea = Math.abs(item.polygon.reduce((sum, point, index) => {
      const next = item.polygon[(index + 1) % item.polygon.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0));
    if (twiceArea === 0 || (item.bottomAboveFloor != null && item.bottomAboveFloor <= 0)) {
      issues.push({ code: "invalid-soffit", itemId: item.id, message: `Soffit “${item.id}” requires a usable footprint and any known bottom elevation must be positive.` });
    }
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
  const joistReturns = new Map(plan.hvacJoistReturns.map((item) => [item.id, item]));
  for (const item of plan.hvacReturnGrilles) {
    const source = joistReturns.get(item.sourceReturnId);
    if (!source) {
      issues.push({ code: "missing-hvac-source", itemId: item.id, message: `Return grille “${item.id}” requires a panned-return source “${item.sourceReturnId}”.` });
    }
    if (
      !Number.isFinite(item.center[0])
      || !Number.isFinite(item.center[1])
      || item.width <= 0
      || item.length <= 0
      || !Number.isFinite(item.rotation)
    ) {
      issues.push({ code: "invalid-hvac-return-grille", itemId: item.id, message: `Return grille “${item.id}” requires a finite center and rotation with positive face dimensions.` });
    }
  }
  const hvacDucts = new Map(plan.hvacDucts.map((item) => [item.id, item]));
  for (const item of plan.hvacWallCavityReturns) {
    const wall = walls.get(item.wallId);
    const source = hvacDucts.get(item.sourceDuctId);
    if (!wall) {
      issues.push({ code: "missing-wall", itemId: item.id, message: `Wall-cavity return “${item.id}” references missing wall “${item.wallId}”.` });
      continue;
    }
    if (!source || source.airflowRole !== "return") {
      issues.push({ code: "missing-hvac-source", itemId: item.id, message: `Wall-cavity return “${item.id}” requires a return-air source duct “${item.sourceDuctId}”.` });
    }
    const wallLength = distance(wall.from, wall.to);
    const hasInvalidCavity = item.cavitySpans.length < 1 || item.cavitySpans.some(([from, to]) => from < 0 || to <= from || to > wallLength);
    const hasInvalidStud = item.preservedStudOffsets.some((offset) => offset <= 0 || offset >= wallLength);
    const hasInvalidRoute = item.connectionRoute.length < 3
      || item.connectionRoute.slice(1).some((point, index) => distance(item.connectionRoute[index], point) === 0);
    const twiceBootArea = Math.abs(item.upperBootPolygon.reduce((sum, point, index) => {
      const next = item.upperBootPolygon[(index + 1) % item.upperBootPolygon.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0));
    const grilleFrom = item.grilleCenterOffset - item.grilleWidth / 2;
    const grilleTo = item.grilleCenterOffset + item.grilleWidth / 2;
    if (
      hasInvalidCavity
      || hasInvalidStud
      || hasInvalidRoute
      || item.upperBootPolygon.length < 3
      || twiceBootArea === 0
      || item.chaseBottomAboveFloor < 0
      || item.chaseTopAboveFloor <= item.chaseBottomAboveFloor
      || item.grilleWidth <= 0
      || item.grilleHeight <= 0
      || item.grilleBottomAboveFloor < item.chaseBottomAboveFloor
      || item.grilleBottomAboveFloor + item.grilleHeight > item.chaseTopAboveFloor
      || grilleFrom < 0
      || grilleTo > wallLength
    ) {
      issues.push({ code: "invalid-hvac-wall-cavity-return", itemId: item.id, message: `Wall-cavity return “${item.id}” requires valid wall modules, preserved studs, connector geometry, chase elevations, and a grille within its parent wall.` });
    }
  }
  for (const item of plan.hvacWallDuctedReturns) {
    const wall = walls.get(item.wallId);
    const source = hvacDucts.get(item.sourceDuctId);
    if (!wall) {
      issues.push({ code: "missing-wall", itemId: item.id, message: `Ducted wall return “${item.id}” references missing wall “${item.wallId}”.` });
      continue;
    }
    if (!source || source.airflowRole !== "return") {
      issues.push({ code: "missing-hvac-source", itemId: item.id, message: `Ducted wall return “${item.id}” requires a return-air source duct “${item.sourceDuctId}”.` });
    }
    const wallLength = distance(wall.from, wall.to);
    const [spanFrom, spanTo] = item.wallSpan;
    const hasInvalidRoute = item.connectionRoute.length < 3
      || item.connectionRoute.slice(1).some((point, index) => distance(item.connectionRoute[index], point) === 0);
    const twiceBootArea = Math.abs(item.upperBootPolygon.reduce((sum, point, index) => {
      const next = item.upperBootPolygon[(index + 1) % item.upperBootPolygon.length];
      return sum + point[0] * next[1] - next[0] * point[1];
    }, 0));
    const grilleFrom = item.grilleCenterOffset - item.grilleWidth / 2;
    const grilleTo = item.grilleCenterOffset + item.grilleWidth / 2;
    if (
      spanFrom < 0
      || spanTo <= spanFrom
      || spanTo > wallLength
      || hasInvalidRoute
      || item.upperBootPolygon.length < 3
      || twiceBootArea === 0
      || item.chaseBottomAboveFloor < 0
      || item.chaseTopAboveFloor <= item.chaseBottomAboveFloor
      || item.grilleWidth <= 0
      || item.grilleHeight <= 0
      || item.grilleBottomAboveFloor < item.chaseBottomAboveFloor
      || item.grilleBottomAboveFloor + item.grilleHeight > item.chaseTopAboveFloor
      || grilleFrom < spanFrom
      || grilleTo > spanTo
    ) {
      issues.push({ code: "invalid-hvac-wall-ducted-return", itemId: item.id, message: `Ducted wall return “${item.id}” requires a valid wall span, connector geometry, chase elevations, and a grille within its planned wall module.` });
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
  for (const item of plan.lights) {
    if (
      (item.fixture === "under-cabinet" && (!item.to || distance(item.at, item.to) === 0))
      || (item.fixture !== "under-cabinet" && item.to != null)
    ) {
      issues.push({ code: "invalid-light", itemId: item.id, message: `Light “${item.id}” requires a non-zero end point only when its fixture is an under-cabinet run.` });
    }
  }
  for (const item of plan.wallLights) {
    const parent = walls.get(item.wallId);
    if (!parent) {
      issues.push({ code: "missing-wall", itemId: item.id, message: `Wall light “${item.id}” references missing wall “${item.wallId}”.` });
      continue;
    }
    if (
      item.offset < 0
      || item.offset > distance(parent.from, parent.to)
      || (item.heightAboveFloor != null && item.heightAboveFloor < 0)
    ) {
      issues.push({ code: "invalid-wall-light", itemId: item.id, message: `Wall light “${item.id}” requires an offset within wall “${item.wallId}” and a non-negative mounting height when specified.` });
    }
  }
  for (const item of plan.switches) {
    const parent = walls.get(item.wallId);
    if (!parent) {
      issues.push({ code: "missing-wall", itemId: item.id, message: `Switch “${item.id}” references missing wall “${item.wallId}”.` });
      continue;
    }
    const hasGangIndex = item.gangIndex != null;
    const hasGangCount = item.gangCount != null;
    const hasControlIndex = item.controlIndex != null;
    const hasControlCount = item.controlCount != null;
    if (
      item.offset < 0
      || item.offset > distance(parent.from, parent.to)
      || (item.heightAboveFloor != null && item.heightAboveFloor < 0)
      || hasGangIndex !== hasGangCount
      || (hasGangIndex && (
        !Number.isInteger(item.gangIndex)
        || !Number.isInteger(item.gangCount)
        || item.gangIndex! < 1
        || item.gangCount! < 1
        || item.gangIndex! > item.gangCount!
      ))
      || hasControlIndex !== hasControlCount
      || (hasControlIndex && (
        !hasGangIndex
        || !Number.isInteger(item.controlIndex)
        || !Number.isInteger(item.controlCount)
        || item.controlIndex! < 1
        || item.controlCount! < 2
        || item.controlIndex! > item.controlCount!
      ))
    ) {
      issues.push({ code: "invalid-switch", itemId: item.id, message: `Switch “${item.id}” requires an offset within wall “${item.wallId}”, a non-negative mounting height, complete one-based gang metadata, and complete one-based within-gang control metadata when specified.` });
    }
  }
  for (const item of plan.wallCabinets) {
    const parent = walls.get(item.wallId);
    const reference = walls.get(item.referenceWallId);
    if (!parent || !reference) {
      const missingId = !parent ? item.wallId : item.referenceWallId;
      issues.push({ code: "missing-wall", itemId: item.id, message: `Wall cabinet “${item.id}” references missing wall “${missingId}”.` });
      continue;
    }
    const span = wallCabinetSpan(item, parent, reference);
    if (
      !span
      || item.offset < 0
      || item.width <= 0
      || item.bottomAboveFloor < 0
      || item.height <= 0
      || span[0] < 0
      || span[1] > distance(parent.from, parent.to)
    ) {
      issues.push({ code: "invalid-wall-cabinet", itemId: item.id, message: `Wall cabinet “${item.id}” requires a connected reference wall, positive dimensions, and a span within its parent wall.` });
    }
  }
  for (const item of plan.receptacles) {
    const parent = walls.get(item.wallId);
    if (!parent) {
      issues.push({ code: "missing-wall", itemId: item.id, message: `Receptacle “${item.id}” references missing wall “${item.wallId}”.` });
      continue;
    }
    if (
      item.offset < 0
      || item.offset > distance(parent.from, parent.to)
      || (item.heightAboveFloor != null && item.heightAboveFloor < 0)
    ) {
      issues.push({ code: "invalid-receptacle", itemId: item.id, message: `Receptacle “${item.id}” requires an offset within wall “${item.wallId}” and a non-negative mounting height when specified.` });
    }
  }
  const soffits = new Map(plan.soffits.map((item) => [item.id, item]));
  for (const item of plan.ceilingReceptacles) {
    if (!soffits.has(item.soffitId)) {
      issues.push({ code: "missing-soffit", itemId: item.id, message: `Ceiling receptacle “${item.id}” references missing soffit “${item.soffitId}”.` });
      continue;
    }
    if (!Number.isFinite(item.at[0]) || !Number.isFinite(item.at[1])) {
      issues.push({ code: "invalid-ceiling-receptacle", itemId: item.id, message: `Ceiling receptacle “${item.id}” requires a finite plan position.` });
    }
  }
  for (const item of plan.cabinetRuns) {
    const parent = walls.get(item.wallId);
    if (!parent) {
      issues.push({ code: "missing-wall", itemId: item.id, message: `Cabinet run “${item.id}” references missing wall “${item.wallId}”.` });
      continue;
    }
    const wallLength = distance(parent.from, parent.to);
    if (
      item.offset < 0
      || item.width <= 0
      || item.offset + item.width > wallLength
      || item.baseDepth <= 0
      || item.countertopOffset < 0
      || item.countertopWidth <= 0
      || item.countertopOffset + item.countertopWidth > wallLength
      || item.countertopDepth < item.baseDepth
      || item.countertopHeight <= 0
      || item.upperDepth <= 0
      || item.upperBottomAboveFloor < item.countertopHeight
      || item.upperHeight <= 0
    ) {
      issues.push({ code: "invalid-cabinet-run", itemId: item.id, message: `Cabinet run “${item.id}” requires positive dimensions, usable elevations, and cabinet and countertop spans within its parent wall.` });
    }
  }
  const plumbingDrains = new Map(plan.plumbingDrains.map((item) => [item.id, item]));
  for (const item of plan.bathroomFixtures) {
    if (!plumbingDrains.has(item.drainId)) {
      issues.push({ code: "missing-plumbing-drain", itemId: item.id, message: `Bathroom fixture “${item.id}” references missing drain “${item.drainId}”.` });
    }
    if (
      !Number.isFinite(item.center[0])
      || !Number.isFinite(item.center[1])
      || item.width <= 0
      || item.depth <= 0
      || !Number.isFinite(item.rotation)
      || (item.sinkCenter != null && (!Number.isFinite(item.sinkCenter[0]) || !Number.isFinite(item.sinkCenter[1])))
      || (item.fixtureType === "vanity" && item.sinkCenter == null)
      || (item.fixtureType !== "vanity" && item.sinkCenter != null)
    ) {
      issues.push({ code: "invalid-bathroom-fixture", itemId: item.id, message: `Bathroom fixture “${item.id}” requires a finite center and rotation with positive footprint dimensions; vanities also require a finite sink center.` });
    }
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
  for (const item of plan.radonPipes) {
    const points = [item.from, ...item.waypoints, item.to];
    const hasInvalidPoint = points.some((point) => !Number.isFinite(point[0]) || !Number.isFinite(point[1]));
    const hasZeroSegment = points.slice(1).some((point, index) => distance(points[index], point) === 0);
    if (
      hasInvalidPoint
      || hasZeroSegment
      || item.diameter <= 0
      || item.verticalRiseAboveFloor < 0
      || item.diagonalEndAboveFloor <= item.verticalRiseAboveFloor
      || item.westRunBottomAboveFloor < item.diagonalEndAboveFloor
      || item.offsetBelowJoists < 0
    ) {
      issues.push({ code: "invalid-radon-pipe", itemId: item.id, message: `Radon pipe “${item.id}” requires usable plan geometry, a positive diameter, ordered measured elevations, and a non-negative joist offset.` });
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

  for (const item of plan.exhaustFans) {
    const source = hvacDucts.get(item.hvacDuctId);
    const isFinitePoint = Number.isFinite(item.at[0]) && Number.isFinite(item.at[1]);
    const isSourceEndpoint = source?.orientation === "horizontal"
      && (distance(item.at, source.from) < 0.001 || distance(item.at, source.to) < 0.001);
    if (!source || source.airflowRole !== "exhaust") {
      issues.push({ code: "missing-hvac-source", itemId: item.id, message: `Exhaust fan “${item.id}” requires an exhaust-air duct “${item.hvacDuctId}”.` });
    }
    if (!isFinitePoint || !isSourceEndpoint) {
      issues.push({ code: "invalid-exhaust-fan", itemId: item.id, message: `Exhaust fan “${item.id}” requires a finite position at an endpoint of its mapped HVAC duct.` });
    }
  }

  const endpointIds = new Set([...plan.lights, ...plan.wallLights, ...plan.exhaustFans, ...plan.switches].map((item) => item.id));
  for (const item of plan.circuits) {
    for (const connection of item.connections) {
      for (const endpoint of [connection.fromId, connection.toId]) {
        if (!endpointIds.has(endpoint)) issues.push({ code: "missing-circuit-endpoint", itemId: item.id, message: `Circuit “${item.id}” references missing endpoint “${endpoint}”.` });
      }
    }
  }
  return issues;
}
