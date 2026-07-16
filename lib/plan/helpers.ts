import type {
  Circuit,
  Dimension,
  Door,
  Light,
  Point,
  Space,
  Stairs,
  Switch,
  Wall,
  WindowOpening,
} from "./types.ts";

export const wall = (value: Omit<Wall, "kind">): Wall => ({ kind: "wall", ...value });
export const space = (value: Omit<Space, "kind">): Space => ({ kind: "space", ...value });
export const door = (value: Omit<Door, "kind">): Door => ({ kind: "door", ...value });
export const windowOpening = (
  value: Omit<WindowOpening, "kind">,
): WindowOpening => ({ kind: "window", ...value });
export const light = (value: Omit<Light, "kind">): Light => ({ kind: "light", ...value });
export const wallSwitch = (value: Omit<Switch, "kind">): Switch => ({
  kind: "switch",
  ...value,
});
export const stairs = (value: Omit<Stairs, "kind">): Stairs => ({
  kind: "stairs",
  ...value,
});
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
