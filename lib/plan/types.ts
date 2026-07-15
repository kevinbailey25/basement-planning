export type Point = readonly [x: number, y: number];

export type MeasurementConfidence = "exact" | "approximate" | "unknown";
export type ConstructionStatus = "existing" | "proposed" | "remove";
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
  | WindowOpening
  | Light
  | Switch
  | Circuit
  | Dimension;

export interface FloorPlan {
  id: string;
  title: string;
  subtitle: string;
  units: "inches";
  origin: "upper-left";
  warning: string;
  walls: readonly Wall[];
  spaces: readonly Space[];
  doors: readonly Door[];
  windows: readonly WindowOpening[];
  lights: readonly Light[];
  switches: readonly Switch[];
  circuits: readonly Circuit[];
  dimensions: readonly Dimension[];
}
