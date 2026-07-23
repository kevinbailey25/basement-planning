export type Point = readonly [x: number, y: number];

export type MeasurementConfidence = "exact" | "approximate" | "unknown";
export type ConstructionStatus = "existing" | "proposed" | "remove";
export type WallSide = "left" | "right";
export type AirflowRole = "supply" | "return" | "exhaust" | "unknown";

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
  height?: number;
}

export interface Soffit extends PlanItemBase {
  kind: "soffit";
  polygon: readonly [Point, Point, Point, Point];
  bottomAboveFloor?: number;
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

export interface WallCabinet extends PlanItemBase {
  kind: "wall-cabinet";
  cabinetType: "breaker-panel" | "networking";
  wallId: string;
  referenceWallId: string;
  offset: number;
  width: number;
  bottomAboveFloor: number;
  height: number;
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

export interface PlumbingDrain extends PlanItemBase {
  kind: "plumbing-drain";
  fixture: "tub-shower" | "toilet" | "sink" | "unknown";
  at: Point;
  diameter: number;
  heightAboveFloor: number;
  capStatus: "capped" | "open" | "unknown";
  pipeColor: "white" | "black" | "unknown";
}

export interface PlumbingEquipment extends PlanItemBase {
  kind: "plumbing-equipment";
  equipmentType: "water-heater";
  shape: "cylinder";
  center: Point;
  diameter: number;
  height: number;
}

export type GasEndpoint = "none" | "service-entry" | "wall-termination" | "rise" | "drop" | "appliance";

export interface GasLine extends PlanItemBase {
  kind: "gas-line";
  from: Point;
  to: Point;
  waypoints?: readonly Point[];
  placement: "joist-bay" | "below-joists" | "equipment-room" | "unknown";
  heightAboveFloor?: number;
  offsetBelowJoists?: number;
  fromEndpoint?: GasEndpoint;
  toEndpoint?: GasEndpoint;
}

export interface Stairs extends PlanItemBase {
  kind: "stairs";
  from: Point;
  to: Point;
  width: number;
  risers: number;
  direction: "up" | "down";
  planBreakOffset?: number;
}

export interface Joist extends PlanItemBase {
  kind: "joist";
  number: number;
  from: Point;
  to: Point;
  width: number;
}

export interface HvacEquipment extends PlanItemBase {
  kind: "hvac-equipment";
  equipmentType: "furnace";
  center: Point;
  width: number;
  depth: number;
  rotation: number;
  height?: number;
}

interface HorizontalHvacDuctBase extends PlanItemBase {
  kind: "hvac-duct";
  orientation: "horizontal";
  airflowRole: AirflowRole;
  from: Point;
  to: Point;
  waypoints?: readonly Point[];
  bendStyle?: "round";
  bottomAboveFloor: number;
}

export interface RectangularHorizontalHvacDuct extends HorizontalHvacDuctBase {
  shape: "rectangular";
  width: number;
  height: number;
}

export interface RoundHorizontalHvacDuct extends HorizontalHvacDuctBase {
  shape: "round";
  diameter: number;
}

export type HorizontalHvacDuct = RectangularHorizontalHvacDuct | RoundHorizontalHvacDuct;

export interface VerticalHvacDuct extends PlanItemBase {
  kind: "hvac-duct";
  orientation: "vertical";
  airflowRole: AirflowRole;
  shape: "rectangular";
  center: Point;
  width: number;
  depth: number;
  rotation: number;
  bottomAboveFloor: number;
  topAboveFloor: number;
}

export type HvacDuct = HorizontalHvacDuct | VerticalHvacDuct;

export interface HvacJoistReturn extends PlanItemBase {
  kind: "hvac-joist-return";
  airflowRole: "return";
  polygon: readonly Point[];
  joistIds: readonly string[];
}

export interface HvacWallCavityReturn extends PlanItemBase {
  kind: "hvac-wall-cavity-return";
  airflowRole: "return";
  sourceDuctId: string;
  wallId: string;
  cavitySpans: readonly (readonly [fromOffset: number, toOffset: number])[];
  preservedStudOffsets: readonly number[];
  connectionRoute: readonly Point[];
  upperBootPolygon: readonly Point[];
  chaseBottomAboveFloor: number;
  chaseTopAboveFloor: number;
  grilleSide: WallSide;
  grilleCenterOffset: number;
  grilleWidth: number;
  grilleHeight: number;
  grilleBottomAboveFloor: number;
}

export interface HvacWallDuctedReturn extends PlanItemBase {
  kind: "hvac-wall-ducted-return";
  airflowRole: "return";
  sourceDuctId: string;
  wallId: string;
  wallSpan: readonly [fromOffset: number, toOffset: number];
  connectionRoute: readonly Point[];
  upperBootPolygon: readonly Point[];
  chaseBottomAboveFloor: number;
  chaseTopAboveFloor: number;
  grilleSide: WallSide;
  grilleCenterOffset: number;
  grilleWidth: number;
  grilleHeight: number;
  grilleBottomAboveFloor: number;
}

export interface HvacDuctTransition extends PlanItemBase {
  kind: "hvac-duct-transition";
  airflowRole: AirflowRole;
  shape: "rectangular";
  polygon: readonly [Point, Point, Point, Point];
  fromWidth: number;
  toWidth: number;
  height: number;
  bottomAboveFloor: number;
  fixedEdge: "north" | "south" | "east" | "west";
}

export interface HvacRefrigerantLine extends PlanItemBase {
  kind: "hvac-refrigerant-line";
  from: Point;
  to: Point;
  waypoints?: readonly Point[];
  wallPenetrationBelowJoists: number;
  support: "joist-underside";
  exteriorTurn: "up" | "down" | "unknown";
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
  | Soffit
  | Door
  | SlidingDoor
  | WindowOpening
  | Light
  | Switch
  | WallCabinet
  | WaterValve
  | PlumbingDrain
  | PlumbingEquipment
  | GasLine
  | Stairs
  | Joist
  | HvacEquipment
  | HvacDuct
  | HvacJoistReturn
  | HvacWallCavityReturn
  | HvacWallDuctedReturn
  | HvacDuctTransition
  | HvacRefrigerantLine
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
  soffits: readonly Soffit[];
  doors: readonly Door[];
  slidingDoors: readonly SlidingDoor[];
  windows: readonly WindowOpening[];
  lights: readonly Light[];
  switches: readonly Switch[];
  wallCabinets: readonly WallCabinet[];
  waterValves: readonly WaterValve[];
  plumbingDrains: readonly PlumbingDrain[];
  plumbingEquipment: readonly PlumbingEquipment[];
  gasLines: readonly GasLine[];
  stairs: readonly Stairs[];
  joists: readonly Joist[];
  hvacEquipment: readonly HvacEquipment[];
  hvacDucts: readonly HvacDuct[];
  hvacJoistReturns: readonly HvacJoistReturn[];
  hvacWallCavityReturns: readonly HvacWallCavityReturn[];
  hvacWallDuctedReturns: readonly HvacWallDuctedReturn[];
  hvacDuctTransitions: readonly HvacDuctTransition[];
  hvacRefrigerantLines: readonly HvacRefrigerantLine[];
  circuits: readonly Circuit[];
  dimensions: readonly Dimension[];
}
