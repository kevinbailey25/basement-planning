import { distance } from "./helpers.ts";
import type { FloorPlan, Point, Wall } from "./types.ts";

export interface FramingEstimate {
  wallCount: number;
  wallLengthInches: number;
  baseStudCount: number;
  purchaseStudCount: number;
  baseTopPlateBoards: number;
  purchaseTopPlateBoards: number;
  baseBottomPlateBoards: number;
  purchaseBottomPlateBoards: number;
  openingCount: number;
  junctionCount: number;
}

function pointKey(point: Point) {
  return `${point[0]},${point[1]}`;
}

function pointOnWall(point: Point, wall: Wall) {
  const [x, y] = point;
  const [x1, y1] = wall.from;
  const [x2, y2] = wall.to;
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(cross) > 0.001) return false;
  return x >= Math.min(x1, x2) - 0.001
    && x <= Math.max(x1, x2) + 0.001
    && y >= Math.min(y1, y2) - 0.001
    && y <= Math.max(y1, y2) + 0.001;
}

export function wallsNeedingFraming(plan: FloorPlan) {
  return plan.walls.filter((wall) => wall.framingStatus === "needs-framing");
}

export function estimateFraming(plan: FloorPlan): FramingEstimate {
  const walls = wallsNeedingFraming(plan);
  const wallLengthInches = walls.reduce((sum, wall) => sum + distance(wall.from, wall.to), 0);
  const baseStudCount = walls.reduce(
    (sum, wall) => sum + Math.ceil(distance(wall.from, wall.to) / plan.framing.studSpacing) + 1,
    0,
  );
  const purchaseStudCount = Math.ceil(baseStudCount * (1 + plan.framing.wasteFactor));
  const basePlateBoards = Math.ceil(wallLengthInches / plan.framing.stockLength);
  const purchasePlateBoards = Math.ceil(
    (wallLengthInches * (1 + plan.framing.wasteFactor)) / plan.framing.stockLength,
  );
  const wallIds = new Set(walls.map((wall) => wall.id));
  const openingCount = [...plan.doors, ...plan.windows]
    .filter((opening) => wallIds.has(opening.wallId)).length;
  const junctions = new Set<string>();
  for (const wall of walls) {
    for (const point of [wall.from, wall.to] as const) {
      if (plan.walls.some((other) => other.id !== wall.id && pointOnWall(point, other))) {
        junctions.add(pointKey(point));
      }
    }
  }

  return {
    wallCount: walls.length,
    wallLengthInches,
    baseStudCount,
    purchaseStudCount,
    baseTopPlateBoards: basePlateBoards,
    purchaseTopPlateBoards: purchasePlateBoards,
    baseBottomPlateBoards: basePlateBoards,
    purchaseBottomPlateBoards: purchasePlateBoards,
    openingCount,
    junctionCount: junctions.size,
  };
}
