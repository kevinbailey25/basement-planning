import {
  circuit,
  dimension,
  door,
  light,
  space,
  wall,
  wallSwitch,
  windowOpening,
} from "./helpers.ts";
import type { FloorPlan } from "./types.ts";

const proposed = { status: "proposed" as const, confidence: "approximate" as const };

export const pocPlan = {
  id: "poc-bedroom",
  title: "Basement Planning POC",
  subtitle: "Single-room lighting study",
  units: "inches",
  origin: "upper-left",
  warning: "Planning diagram — verify all measurements and code requirements on site.",
  walls: [
    wall({ id: "north-wall", label: "North wall", from: [0, 0], to: [144, 0], thickness: 6, interiorSide: "right", ...proposed }),
    wall({ id: "east-wall", label: "East wall", from: [144, 0], to: [144, 120], thickness: 6, interiorSide: "right", ...proposed }),
    wall({ id: "south-wall", label: "South wall", from: [144, 120], to: [0, 120], thickness: 6, interiorSide: "right", ...proposed }),
    wall({ id: "west-wall", label: "West wall", from: [0, 120], to: [0, 0], thickness: 6, interiorSide: "right", ...proposed }),
  ],
  spaces: [
    space({
      id: "demo-room",
      label: "Demo room",
      polygon: [[0, 0], [144, 0], [144, 120], [0, 120]],
      labelAt: [72, 62],
      note: "Approximately 120 sq ft of finished interior area.",
      ...proposed,
    }),
  ],
  doors: [
    door({
      id: "entry-door",
      label: "36-inch entry door",
      wallId: "south-wall",
      offset: 54,
      width: 36,
      hinge: "end",
      swing: "inward",
      ...proposed,
    }),
  ],
  windows: [
    windowOpening({
      id: "north-window",
      label: "48-inch window",
      wallId: "north-wall",
      offset: 48,
      width: 48,
      heightAboveFloor: 36,
      note: "Sill height is a placeholder for the POC.",
      ...proposed,
    }),
  ],
  lights: [
    light({ id: "light-nw", label: "Northwest recessed light", at: [36, 30], fixture: "recessed", diameter: 6, ...proposed }),
    light({ id: "light-ne", label: "Northeast recessed light", at: [108, 30], fixture: "recessed", diameter: 6, ...proposed }),
    light({ id: "light-sw", label: "Southwest recessed light", at: [36, 90], fixture: "recessed", diameter: 6, ...proposed }),
    light({ id: "light-se", label: "Southeast recessed light", at: [108, 90], fixture: "recessed", diameter: 6, ...proposed }),
  ],
  switches: [
    wallSwitch({
      id: "entry-switch",
      label: "Entry light switch",
      wallId: "south-wall",
      offset: 48,
      heightAboveFloor: 48,
      note: "Six inches to the right of the door opening.",
      ...proposed,
    }),
  ],
  circuits: [
    circuit({
      id: "lighting-circuit-a",
      label: "Lighting circuit A",
      layer: "lighting",
      connections: [
        { fromId: "entry-switch", toId: "light-se" },
        { fromId: "light-se", toId: "light-ne" },
        { fromId: "light-ne", toId: "light-nw" },
        { fromId: "light-nw", toId: "light-sw" },
      ],
      note: "Conceptual topology; dashed runs are not exact cable routing.",
      ...proposed,
    }),
  ],
  dimensions: [
    dimension({ id: "room-width", label: "Overall room width", from: [0, 0], to: [144, 0], offset: 19, detail: "overall", text: "≈ 12′-0″", ...proposed }),
    dimension({ id: "room-depth", label: "Overall room depth", from: [144, 0], to: [144, 120], offset: 19, detail: "overall", text: "≈ 10′-0″", ...proposed }),
    dimension({ id: "light-spacing-horizontal", label: "Horizontal light spacing", from: [36, 30], to: [108, 30], offset: -11, detail: "detail", text: "6′-0″", ...proposed }),
    dimension({ id: "light-spacing-vertical", label: "Vertical light spacing", from: [108, 30], to: [108, 90], offset: -11, detail: "detail", text: "5′-0″", ...proposed }),
  ],
} satisfies FloorPlan;
