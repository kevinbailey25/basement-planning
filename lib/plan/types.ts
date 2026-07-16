export type Point = readonly [x: number, y: number];

export type MeasurementConfidence = "exact" | "approximate" | "unknown";
export type ConstructionStatus = "existing" | "proposed" | "remove";
export type FramingStatus = "framed" | "needs-framing" | "unknown";
export type WallSide = "left" | "right";

export interface PlanItemBase {
  id: string;
  label?: string;
  status: ConstructionStatus;
  confidence: MeasurementConfidence;
  note?: string;
}

export interface Wall extends PlanItemBase {
  kind: "wall";
  from: Point;
  to: Point;
  thickness: number;
  interiorSide: WallSide;
  dimensionSide?: WallSide;
  framingStatus: FramingStatus;
}

export interface FramingPlan {
  defaultWallHeight: number;
  studSpacing: number;
  studSize: "2x4";
  topPlateCount: 1;
  bottomPlateCount: 1;
  bottomPlateTreated: true;
  wasteFactor: number;
  stockLength: number;
}

export interface Space extends PlanItemBase {
  kind: "space";
  polygon: readonly Point[];
  labelAt: Point;
}

export interface WallOpeningBase extends PlanItemBase {
  wallId: string;
  offset: number;
  width: number;
}

export interface Door extends WallOpeningBase {
  kind: "door";
  hinge: "start" | "end";
  swing: "inward" | "outward";
}

export interface SlidingDoor extends WallOpeningBase {
  kind: "sliding-door";
  panels: 2;
  operation: "bypass";
}

export interface WindowOpening extends WallOpeningBase {
  kind: "window";
  heightAboveFloor?: number;
}

export interface Light extends PlanItemBase {
  kind: "light";
  at: Point;
  fixture: "recessed";
  diameter: number;
  heightAboveFloor?: number;
}

export interface Switch extends PlanItemBase {
  kind: "switch";
  wallId: string;
  offset: number;
  heightAboveFloor?: number;
}

export interface WaterValve extends PlanItemBase {
  kind: "water-valve";
  wallId: string;
  offset: number;
  referenceWallId: string;
  valveType: "main-water" | "sprinkler-water";
  enclosureWidth: number;
  enclosureBottomAboveFloor: number;
  enclosureHeight: number;
  enclosureStatus: ConstructionStatus;
  labelDistance: number;
  dimensionSide: WallSide;
  dimensionDistance: number;
}

export interface Stairs extends PlanItemBase {
  kind: "stairs";
  from: Point;
  to: Point;
  width: number;
  risers: number;
  direction: "up" | "down";
}

export interface CircuitConnection {
  fromId: string;
  toId: string;
  waypoints?: readonly Point[];
}

export interface Circuit extends PlanItemBase {
  kind: "circuit";
  layer: "lighting";
  connections: readonly CircuitConnection[];
}

export interface Dimension extends PlanItemBase {
  kind: "dimension";
  from: Point;
  to: Point;
  offset: number;
  detail: "overall" | "detail";
  text: string;
}

export type SelectablePlanItem =
  | Wall
  | Space
  | Door
  | SlidingDoor
  | WindowOpening
  | Light
  | Switch
  | WaterValve
  | Stairs
  | Circuit
  | Dimension;

export interface FloorPlan {
  id: string;
  title: string;
  subtitle: string;
  units: "inches";
  origin: "upper-left";
  orientation: { north: "left" | "right" | "up" | "down" };
  warning: string;
  framing: FramingPlan;
  walls: readonly Wall[];
  spaces: readonly Space[];
  doors: readonly Door[];
  slidingDoors: readonly SlidingDoor[];
  windows: readonly WindowOpening[];
  lights: readonly Light[];
  switches: readonly Switch[];
  waterValves: readonly WaterValve[];
  stairs: readonly Stairs[];
  circuits: readonly Circuit[];
  dimensions: readonly Dimension[];
}
