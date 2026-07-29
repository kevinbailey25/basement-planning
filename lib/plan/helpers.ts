import type {
  BathroomFixture,
  CabinetRun,
  CeilingReceptacle,
  Circuit,
  Dimension,
  Door,
  ExhaustFan,
  Light,
  HvacEquipment,
  GasLine,
  HvacJoistReturn,
  HvacReturnGrille,
  HvacWallCavityReturn,
  HvacWallDuctedReturn,
  HvacRefrigerantLine,
  HorizontalHvacDuct,
  HvacDuctTransition,
  Joist,
  Point,
  PlumbingDrain,
  PlumbingEquipment,
  RadonPipe,
  Receptacle,
  SlidingDoor,
  Soffit,
  Space,
  Stairs,
  Switch,
  Wall,
  WallCabinet,
  WallLight,
  WaterValve,
  VerticalHvacDuct,
  WindowOpening,
} from "./types.ts";

export const wall = (value: Omit<Wall, "kind">): Wall => ({ kind: "wall", ...value });
export const space = (value: Omit<Space, "kind">): Space => ({ kind: "space", ...value });
export const soffit = (value: Omit<Soffit, "kind">): Soffit => ({ kind: "soffit", ...value });
export const door = (value: Omit<Door, "kind">): Door => ({ kind: "door", ...value });
export const slidingDoor = (
  value: Omit<SlidingDoor, "kind">,
): SlidingDoor => ({ kind: "sliding-door", ...value });
export const windowOpening = (
  value: Omit<WindowOpening, "kind">,
): WindowOpening => ({ kind: "window", ...value });
export const light = (value: Omit<Light, "kind">): Light => ({ kind: "light", ...value });
export const wallLight = (value: Omit<WallLight, "kind">): WallLight => ({ kind: "wall-light", ...value });
export const exhaustFan = (
  value: Omit<ExhaustFan, "kind">,
): ExhaustFan => ({ kind: "exhaust-fan", ...value });
export const wallSwitch = (value: Omit<Switch, "kind">): Switch => ({
  kind: "switch",
  ...value,
});
export const receptacle = (
  value: Omit<Receptacle, "kind">,
): Receptacle => ({ kind: "receptacle", ...value });
export const ceilingReceptacle = (
  value: Omit<CeilingReceptacle, "kind">,
): CeilingReceptacle => ({ kind: "ceiling-receptacle", ...value });
export const wallCabinet = (
  value: Omit<WallCabinet, "kind">,
): WallCabinet => ({ kind: "wall-cabinet", ...value });
export const cabinetRun = (
  value: Omit<CabinetRun, "kind">,
): CabinetRun => ({ kind: "cabinet-run", ...value });
export const bathroomFixture = (
  value: Omit<BathroomFixture, "kind">,
): BathroomFixture => ({ kind: "bathroom-fixture", ...value });
export const waterValve = (
  value: Omit<WaterValve, "kind">,
): WaterValve => ({ kind: "water-valve", ...value });
export const plumbingDrain = (
  value: Omit<PlumbingDrain, "kind">,
): PlumbingDrain => ({ kind: "plumbing-drain", ...value });
export const plumbingEquipment = (
  value: Omit<PlumbingEquipment, "kind">,
): PlumbingEquipment => ({ kind: "plumbing-equipment", ...value });
export const radonPipe = (
  value: Omit<RadonPipe, "kind">,
): RadonPipe => ({ kind: "radon-pipe", ...value });
export const gasLine = (value: Omit<GasLine, "kind">): GasLine => ({
  kind: "gas-line",
  ...value,
});
export const stairs = (value: Omit<Stairs, "kind">): Stairs => ({
  kind: "stairs",
  ...value,
});
export const joist = (value: Omit<Joist, "kind">): Joist => ({
  kind: "joist",
  ...value,
});
export const hvacEquipment = (
  value: Omit<HvacEquipment, "kind">,
): HvacEquipment => ({ kind: "hvac-equipment", ...value });
export const hvacJoistReturn = (
  value: Omit<HvacJoistReturn, "kind" | "airflowRole">,
): HvacJoistReturn => ({ kind: "hvac-joist-return", airflowRole: "return", ...value });
export const hvacReturnGrille = (
  value: Omit<HvacReturnGrille, "kind" | "airflowRole">,
): HvacReturnGrille => ({ kind: "hvac-return-grille", airflowRole: "return", ...value });
export const hvacWallCavityReturn = (
  value: Omit<HvacWallCavityReturn, "kind" | "airflowRole">,
): HvacWallCavityReturn => ({ kind: "hvac-wall-cavity-return", airflowRole: "return", ...value });
export const hvacWallDuctedReturn = (
  value: Omit<HvacWallDuctedReturn, "kind" | "airflowRole">,
): HvacWallDuctedReturn => ({ kind: "hvac-wall-ducted-return", airflowRole: "return", ...value });
type HorizontalHvacDuctInput = HorizontalHvacDuct extends infer Duct
  ? Duct extends HorizontalHvacDuct
    ? Omit<Duct, "kind" | "orientation">
    : never
  : never;
export const horizontalHvacDuct = (
  value: HorizontalHvacDuctInput,
): HorizontalHvacDuct => ({ kind: "hvac-duct", orientation: "horizontal", ...value } as HorizontalHvacDuct);
export const verticalHvacDuct = (
  value: Omit<VerticalHvacDuct, "kind" | "orientation">,
): VerticalHvacDuct => ({ kind: "hvac-duct", orientation: "vertical", ...value });
export const hvacDuctTransition = (
  value: Omit<HvacDuctTransition, "kind">,
): HvacDuctTransition => ({ kind: "hvac-duct-transition", ...value });
export const hvacRefrigerantLine = (
  value: Omit<HvacRefrigerantLine, "kind">,
): HvacRefrigerantLine => ({ kind: "hvac-refrigerant-line", ...value });
export const circuit = (value: Omit<Circuit, "kind">): Circuit => ({
  kind: "circuit",
  ...value,
});
export const dimension = (value: Omit<Dimension, "kind">): Dimension => ({
  kind: "dimension",
  ...value,
});

export function distance(from: Point, to: Point) {
  return Math.hypot(to[0] - from[0], to[1] - from[1]);
}

export function wallCabinetSpan(item: WallCabinet, wall: Wall, referenceWall: Wall) {
  const tolerance = 0.001;
  const referenceTouchesStart = Math.min(
    distance(referenceWall.from, wall.from),
    distance(referenceWall.to, wall.from),
  ) < tolerance;
  const referenceTouchesEnd = Math.min(
    distance(referenceWall.from, wall.to),
    distance(referenceWall.to, wall.to),
  ) < tolerance;
  if (referenceTouchesStart === referenceTouchesEnd) return undefined;
  const wallLength = distance(wall.from, wall.to);
  return referenceTouchesStart
    ? [item.offset, item.offset + item.width] as const
    : [wallLength - item.offset - item.width, wallLength - item.offset] as const;
}

export function pointAlong(from: Point, to: Point, offset: number): Point {
  const length = distance(from, to);
  if (length === 0) return from;
  return [
    from[0] + ((to[0] - from[0]) / length) * offset,
    from[1] + ((to[1] - from[1]) / length) * offset,
  ];
}

export function unitNormal(from: Point, to: Point, side: "left" | "right"): Point {
  const length = distance(from, to);
  if (length === 0) return [0, 0];
  const dx = (to[0] - from[0]) / length;
  const dy = (to[1] - from[1]) / length;
  return side === "right" ? [-dy, dx] : [dy, -dx];
}

export function add(point: Point, vector: Point, scale = 1): Point {
  return [point[0] + vector[0] * scale, point[1] + vector[1] * scale];
}

export function formatInches(value: number) {
  const feet = Math.floor(value / 12);
  const inches = Math.round((value - feet * 12) * 10) / 10;
  return feet > 0 ? `${feet}′-${inches}″` : `${inches}″`;
}
