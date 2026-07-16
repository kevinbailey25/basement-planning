import { add, distance, pointAlong, unitNormal } from "./helpers.ts";
import type {
  Door,
  FloorPlan,
  MeasurementConfidence,
  Point,
  SlidingDoor,
  Wall,
  WallSide,
  WindowOpening,
} from "./types.ts";

type Opening = Door | SlidingDoor | WindowOpening;
export type CompassDirection = "north" | "east" | "south" | "west";

export interface OpeningMeasurementSideOption {
  side: WallSide;
  label: string;
}

export interface OpeningMeasurement {
  wall: Wall;
  side: WallSide;
  sideLabel: string;
  sideOptions: readonly OpeningMeasurementSideOption[];
  openingIds: readonly string[];
  openingStart: number;
  openingEnd: number;
  beforeBoundary: number;
  afterBoundary: number;
  beforeDistance: number;
  openingWidth: number;
  afterDistance: number;
  beforeDirection: CompassDirection;
  afterDirection: CompassDirection;
  confidence: MeasurementConfidence;
  combined: boolean;
}

const EPSILON = 0.001;

function cross(a: Point, b: Point) {
  return a[0] * b[1] - a[1] * b[0];
}

function wallIntersectionOffset(wall: Wall, other: Wall): number | undefined {
  const wallVector: Point = [wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]];
  const otherVector: Point = [other.to[0] - other.from[0], other.to[1] - other.from[1]];
  const denominator = cross(wallVector, otherVector);
  if (Math.abs(denominator) <= EPSILON) return undefined;
  const betweenStarts: Point = [other.from[0] - wall.from[0], other.from[1] - wall.from[1]];
  const wallRatio = cross(betweenStarts, otherVector) / denominator;
  const otherRatio = cross(betweenStarts, wallVector) / denominator;
  if (wallRatio < -EPSILON || wallRatio > 1 + EPSILON || otherRatio < -EPSILON || otherRatio > 1 + EPSILON) return undefined;
  return Math.min(1, Math.max(0, wallRatio)) * distance(wall.from, wall.to);
}

function projectOnWallAxis(wall: Wall, point: Point) {
  const length = distance(wall.from, wall.to);
  if (length === 0) return 0;
  return ((point[0] - wall.from[0]) * (wall.to[0] - wall.from[0]) +
    (point[1] - wall.from[1]) * (wall.to[1] - wall.from[1])) / length;
}

function collinearInterval(wall: Wall, candidate: Wall) {
  const wallVector: Point = [wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]];
  const wallLength = distance(wall.from, wall.to);
  if (wallLength === 0) return undefined;
  const fromWall: Point = [candidate.from[0] - wall.from[0], candidate.from[1] - wall.from[1]];
  const toWall: Point = [candidate.to[0] - wall.from[0], candidate.to[1] - wall.from[1]];
  if (Math.abs(cross(wallVector, fromWall)) / wallLength > EPSILON || Math.abs(cross(wallVector, toWall)) / wallLength > EPSILON) return undefined;
  const projected = [projectOnWallAxis(wall, candidate.from), projectOnWallAxis(wall, candidate.to)];
  return { wall: candidate, start: Math.min(...projected), end: Math.max(...projected) };
}

function connectedCollinearWalls(plan: FloorPlan, wall: Wall) {
  const intervals = plan.walls
    .map((candidate) => collinearInterval(wall, candidate))
    .filter((candidate): candidate is { wall: Wall; start: number; end: number } => candidate != null);
  const members = new Map<string, { wall: Wall; start: number; end: number }>();
  let start = 0;
  let end = distance(wall.from, wall.to);
  let changed = true;
  while (changed) {
    changed = false;
    for (const interval of intervals) {
      if (members.has(interval.wall.id) || interval.end < start - EPSILON || interval.start > end + EPSILON) continue;
      members.set(interval.wall.id, interval);
      start = Math.min(start, interval.start);
      end = Math.max(end, interval.end);
      changed = true;
    }
  }
  return { members: [...members.values()], start, end };
}

function oppositeSide(side: WallSide): WallSide {
  return side === "left" ? "right" : "left";
}

function intersectionTouchesSide(wall: Wall, other: Wall, offset: number, side: WallSide) {
  const intersection = pointAlong(wall.from, wall.to, offset);
  const wallVector: Point = [wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]];
  const sideSign = side === "right" ? 1 : -1;
  return [other.from, other.to].some((point) => {
    const fromIntersection: Point = [point[0] - intersection[0], point[1] - intersection[1]];
    return cross(wallVector, fromIntersection) * sideSign > EPSILON;
  });
}

function confidenceOf(items: readonly { confidence: MeasurementConfidence }[]): MeasurementConfidence {
  if (items.some((item) => item.confidence === "unknown")) return "unknown";
  return items.every((item) => item.confidence === "exact") ? "exact" : "approximate";
}

function compassDirection(
  orientation: FloorPlan["orientation"],
  vector: Point,
): CompassDirection {
  const northByScreenDirection: Record<FloorPlan["orientation"]["north"], Point> = {
    left: [-1, 0],
    right: [1, 0],
    up: [0, -1],
    down: [0, 1],
  };
  const north = northByScreenDirection[orientation.north];
  const east: Point = [-north[1], north[0]];
  const candidates: Array<[CompassDirection, Point]> = [
    ["north", north],
    ["east", east],
    ["south", [-north[0], -north[1]]],
    ["west", [-east[0], -east[1]]],
  ];
  return candidates.reduce((best, candidate) => {
    const bestDot = best[1][0] * vector[0] + best[1][1] * vector[1];
    const candidateDot = candidate[1][0] * vector[0] + candidate[1][1] * vector[1];
    return candidateDot > bestDot ? candidate : best;
  })[0];
}

function pointInPolygon(point: Point, polygon: readonly Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses = (currentPoint[1] > point[1]) !== (previousPoint[1] > point[1]);
    const edgeX = ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
      (previousPoint[1] - currentPoint[1]) + currentPoint[0];
    if (crosses && point[0] < edgeX) inside = !inside;
  }
  return inside;
}

function measurementSideOptions(plan: FloorPlan, wall: Wall, selected: Opening): OpeningMeasurementSideOption[] {
  const midpoint = pointAlong(wall.from, wall.to, selected.offset + selected.width / 2);
  const sampleDistance = wall.thickness / 2 + 4;
  const sides: WallSide[] = [wall.interiorSide, oppositeSide(wall.interiorSide)];
  const spaces = sides.map((side) => {
    const sample = add(midpoint, unitNormal(wall.from, wall.to, side), sampleDistance);
    return plan.spaces.find((space) => pointInPolygon(sample, space.polygon));
  });
  return sides.map((side, index) => {
    const space = spaces[index];
    const otherSpace = spaces[index === 0 ? 1 : 0];
    if (space && space.id !== otherSpace?.id) return { side, label: space.label ?? space.id };
    if (!space && otherSpace) return { side, label: "Exterior" };
    const direction = compassDirection(plan.orientation, unitNormal(wall.from, wall.to, side));
    return { side, label: `${direction[0].toUpperCase()}${direction.slice(1)} side` };
  });
}

function adjoiningDoorGroup(openings: readonly Opening[], selected: Opening): Opening[] {
  if (selected.kind !== "door") return [selected];
  const doors = openings
    .filter((opening): opening is Door => opening.kind === "door")
    .sort((a, b) => a.offset - b.offset);
  const selectedIndex = doors.findIndex((door) => door.id === selected.id);
  if (selectedIndex < 0) return [selected];
  let first = selectedIndex;
  let last = selectedIndex;
  while (first > 0 && Math.abs(doors[first - 1].offset + doors[first - 1].width - doors[first].offset) <= EPSILON) first -= 1;
  while (last < doors.length - 1 && Math.abs(doors[last].offset + doors[last].width - doors[last + 1].offset) <= EPSILON) last += 1;
  return doors.slice(first, last + 1);
}

export function measureOpening(plan: FloorPlan, selectedId: string, requestedSide?: WallSide): OpeningMeasurement | undefined {
  const selected = [...plan.windows, ...plan.doors, ...plan.slidingDoors].find((opening) => opening.id === selectedId);
  if (!selected) return undefined;
  const wall = plan.walls.find((candidate) => candidate.id === selected.wallId);
  if (!wall) return undefined;
  const side = requestedSide ?? wall.interiorSide;
  const sideOptions = measurementSideOptions(plan, wall, selected);

  const chain = connectedCollinearWalls(plan, wall);
  const chainWallIds = new Set(chain.members.map((member) => member.wall.id));
  const chainWallById = new Map(chain.members.map((member) => [member.wall.id, member.wall]));
  const chainOpenings = [...plan.windows, ...plan.doors, ...plan.slidingDoors]
    .filter((opening) => chainWallIds.has(opening.wallId))
    .map((opening) => {
      const openingWall = chainWallById.get(opening.wallId)!;
      const projected = [
        projectOnWallAxis(wall, pointAlong(openingWall.from, openingWall.to, opening.offset)),
        projectOnWallAxis(wall, pointAlong(openingWall.from, openingWall.to, opening.offset + opening.width)),
      ];
      return { opening, start: Math.min(...projected), end: Math.max(...projected) };
    })
    .sort((a, b) => a.start - b.start);
  const selectedWallOpenings = chainOpenings
    .filter((candidate) => candidate.opening.wallId === wall.id)
    .map((candidate) => candidate.opening);
  const group = adjoiningDoorGroup(selectedWallOpenings, selected);
  const groupIds = new Set(group.map((opening) => opening.id));
  const groupOnAxis = chainOpenings.filter((candidate) => groupIds.has(candidate.opening.id));
  const openingStart = Math.min(...groupOnAxis.map((opening) => opening.start));
  const openingEnd = Math.max(...groupOnAxis.map((opening) => opening.end));
  const beforeOpening = chainOpenings
    .filter((candidate) => !groupIds.has(candidate.opening.id) && candidate.end <= openingStart + EPSILON)
    .at(-1);
  const afterOpening = chainOpenings.find((candidate) =>
    !groupIds.has(candidate.opening.id) && candidate.start >= openingEnd - EPSILON
  );
  const intersections = chain.members.flatMap((member) => plan.walls
    .filter((candidate) => !chainWallIds.has(candidate.id))
    .map((candidate) => {
      const localOffset = wallIntersectionOffset(member.wall, candidate);
      if (localOffset == null) return undefined;
      const offset = projectOnWallAxis(wall, pointAlong(member.wall.from, member.wall.to, localOffset));
      return { wall: candidate, offset };
    })
    .filter((candidate): candidate is { wall: Wall; offset: number } =>
      candidate != null && intersectionTouchesSide(wall, candidate.wall, candidate.offset, side)
    ));
  const beforeCandidates = [
    { offset: chain.start, item: undefined },
    ...(beforeOpening ? [{ offset: beforeOpening.end, item: beforeOpening.opening }] : []),
    ...intersections.filter((candidate) => candidate.offset <= openingStart + EPSILON).map((candidate) => ({ offset: candidate.offset, item: candidate.wall })),
  ];
  const afterCandidates = [
    { offset: chain.end, item: undefined },
    ...(afterOpening ? [{ offset: afterOpening.start, item: afterOpening.opening }] : []),
    ...intersections.filter((candidate) => candidate.offset >= openingEnd - EPSILON).map((candidate) => ({ offset: candidate.offset, item: candidate.wall })),
  ];
  const before = beforeCandidates.reduce((nearest, candidate) => candidate.offset > nearest.offset ? candidate : nearest);
  const after = afterCandidates.reduce((nearest, candidate) => candidate.offset < nearest.offset ? candidate : nearest);
  const beforeBoundary = before.offset;
  const afterBoundary = after.offset;
  const wallVector: Point = [wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]];
  const relevantItems = [...chain.members.map((member) => member.wall), ...group, ...(before.item ? [before.item] : []), ...(after.item ? [after.item] : [])];

  return {
    wall,
    side,
    sideLabel: sideOptions.find((option) => option.side === side)?.label ?? "Selected side",
    sideOptions,
    openingIds: group.map((opening) => opening.id),
    openingStart,
    openingEnd,
    beforeBoundary,
    afterBoundary,
    beforeDistance: openingStart - beforeBoundary,
    openingWidth: openingEnd - openingStart,
    afterDistance: afterBoundary - openingEnd,
    beforeDirection: compassDirection(plan.orientation, [-wallVector[0], -wallVector[1]]),
    afterDirection: compassDirection(plan.orientation, wallVector),
    confidence: confidenceOf(relevantItems),
    combined: group.length > 1,
  };
}
