import {
  dimension,
  door,
  space,
  stairs,
  wall,
  windowOpening,
} from "./helpers.ts";
import type { FloorPlan } from "./types.ts";

const existing = {
  status: "existing" as const,
  confidence: "approximate" as const,
};

const exteriorWall = 8;
const interiorWall = 5;

export const pocPlan = {
  id: "existing-basement",
  title: "Existing Basement Layout",
  subtitle: "Approximate trace from measured sketch",
  units: "inches",
  origin: "upper-left",
  orientation: { north: "left" },
  warning: "Planning diagram — verify all measurements and code requirements on site.",
  walls: [
    wall({ id: "north-exterior-wall", label: "North exterior wall", from: [0, 571], to: [0, 0], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "east-wall-north-cap", label: "East wall north cap", from: [0, 0], to: [125, 0], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "northeast-jog-wall", label: "Northeast jog wall", from: [125, 0], to: [125, 26], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "east-exterior-wall", label: "East exterior wall", from: [125, 26], to: [556, 26], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "south-exterior-wall", label: "South exterior wall", from: [556, 26], to: [556, 267], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "storage-west-wall", label: "Storage west wall", from: [556, 267], to: [375, 267], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "stair-jog-wall", label: "Stair jog wall", from: [375, 267], to: [375, 303], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "stair-west-wall", label: "Stair west wall", from: [375, 303], to: [196, 303], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "office-south-wall", label: "Office south wall", from: [196, 303], to: [196, 529], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "office-west-jog-wall", label: "Office west jog wall", from: [196, 529], to: [124, 529], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "office-bump-south-wall", label: "Office bump south wall", from: [124, 529], to: [124, 571], thickness: exteriorWall, interiorSide: "right", ...existing }),
    wall({ id: "office-west-wall", label: "Office west wall", from: [124, 571], to: [0, 571], thickness: exteriorWall, interiorSide: "right", ...existing }),

    wall({ id: "main-west-divider", label: "Main area west divider", from: [0, 267], to: [375, 267], thickness: interiorWall, interiorSide: "right", ...existing }),
    wall({ id: "office-east-divider", label: "Office east divider", from: [0, 327], to: [196, 327], thickness: interiorWall, interiorSide: "right", ...existing }),
    wall({ id: "bathroom-south-wall", label: "Bathroom south wall", from: [129, 267], to: [129, 327], thickness: interiorWall, interiorSide: "right", ...existing }),
    wall({ id: "furnace-room-north-wall", label: "Furnace room north wall", from: [375, 267], to: [375, 222], thickness: interiorWall, interiorSide: "right", ...existing }),
    wall({ id: "furnace-room-east-wall", label: "Furnace room east wall", from: [375, 222], to: [477, 222], thickness: interiorWall, interiorSide: "left", ...existing }),
    wall({ id: "storage-north-wall", label: "Storage north wall", from: [477, 26], to: [477, 267], thickness: interiorWall, interiorSide: "right", ...existing }),
  ],
  spaces: [
    space({
      id: "main-open-area",
      label: "Main open area",
      polygon: [[0, 0], [125, 0], [125, 26], [477, 26], [477, 222], [375, 222], [375, 267], [0, 267]],
      labelAt: [230, 132],
      note: "Large open area on the east side of the house; room use has not been assigned.",
      ...existing,
    }),
    space({
      id: "storage",
      label: "Storage",
      polygon: [[477, 26], [556, 26], [556, 267], [477, 267]],
      labelAt: [517, 142],
      note: "Existing storage room.",
      ...existing,
    }),
    space({
      id: "furnace-room",
      label: "Furnace Room",
      polygon: [[375, 222], [477, 222], [477, 267], [375, 267]],
      labelAt: [426, 250],
      note: "Approximate furnace-room enclosure beside storage.",
      ...existing,
    }),
    space({
      id: "bathroom",
      label: "Bathroom",
      polygon: [[0, 267], [129, 267], [129, 327], [0, 327]],
      labelAt: [64, 302],
      note: "Five-foot-deep band shown on the source sketch.",
      ...existing,
    }),
    space({
      id: "office",
      label: "Office",
      polygon: [[0, 327], [196, 327], [196, 529], [124, 529], [124, 571], [0, 571]],
      labelAt: [98, 428],
      note: "Existing office area.",
      ...existing,
    }),
    space({
      id: "stair-landing",
      label: "Landing",
      polygon: [[129, 267], [187, 267], [187, 303], [196, 303], [196, 327], [129, 327]],
      labelAt: [160, 300],
      note: "Irregular landing geometry inferred from the sketch.",
      ...existing,
    }),
  ],
  doors: [
    door({ id: "bathroom-door", label: "Bathroom door", wallId: "main-west-divider", offset: 96, width: 32, hinge: "end", swing: "inward", ...existing }),
    door({ id: "main-stair-door", label: "Main area stair door", wallId: "main-west-divider", offset: 144, width: 32, hinge: "start", swing: "outward", ...existing }),
    door({ id: "office-door", label: "Office door", wallId: "office-east-divider", offset: 147, width: 32, hinge: "start", swing: "inward", ...existing }),
    door({ id: "furnace-room-double-door-north-leaf", label: "Furnace room double door — north leaf", wallId: "furnace-room-east-wall", offset: 21, width: 30, hinge: "start", swing: "inward", ...existing }),
    door({ id: "furnace-room-double-door-south-leaf", label: "Furnace room double door — south leaf", wallId: "furnace-room-east-wall", offset: 51, width: 30, hinge: "end", swing: "inward", ...existing }),
    door({ id: "storage-door", label: "Storage door", wallId: "storage-north-wall", offset: 136, width: 32, hinge: "end", swing: "inward", note: "Door offset remains inferred from the overlapping arcs in the sketch.", ...existing }),
  ],
  windows: [
    windowOpening({ id: "east-wall-window-north", label: "East wall window — north", wallId: "east-exterior-wall", offset: 70, width: 47, note: "Measured frame width and offset from the northeast jog.", ...existing }),
    windowOpening({ id: "east-wall-window-south", label: "East wall window — south", wallId: "east-exterior-wall", offset: 279, width: 47, note: "Measured frame width and offset from the northeast jog.", ...existing }),
    windowOpening({ id: "north-wall-window-east", label: "North wall window — east", wallId: "north-exterior-wall", offset: 378, width: 48, note: "Width and offset scaled from the sketch.", ...existing }),
    windowOpening({ id: "north-wall-office-window", label: "North wall office window", wallId: "north-exterior-wall", offset: 58, width: 47, note: "Measured from the west end of the office wall sequence.", ...existing }),
  ],
  lights: [
    // Lighting will be added as a separate system layer after the base plan is verified.
  ],
  switches: [
    // Wall devices will be added when the electrical layout is mapped.
  ],
  stairs: [
    stairs({
      id: "main-stair-run",
      label: "Main stair run",
      from: [187, 285],
      to: [349, 285],
      width: 36,
      risers: 14,
      direction: "up",
      note: "Run, width, and riser count are approximate traces from the sketch.",
      ...existing,
    }),
  ],
  circuits: [
    // Circuits are intentionally empty until a real electrical layer is provided.
  ],
  dimensions: [
    dimension({ id: "overall-north-south-span", label: "Overall north-south span", from: [0, 0], to: [556, 0], offset: 22, detail: "overall", text: "≈ 46′-4″", ...existing }),
    dimension({ id: "overall-east-west-span", label: "Overall east-west span", from: [556, 0], to: [556, 571], offset: 22, detail: "overall", text: "≈ 47′-7″", ...existing }),
    dimension({ id: "main-area-depth", label: "Main area east-west depth", from: [0, 0], to: [0, 267], offset: -18, detail: "detail", text: "≈ 22′-3″", ...existing }),
    dimension({ id: "bathroom-depth", label: "Bathroom east-west depth", from: [0, 267], to: [0, 327], offset: -18, detail: "detail", text: "≈ 5′-0″", ...existing }),
    dimension({ id: "office-depth", label: "Office east-west depth", from: [0, 327], to: [0, 529], offset: -18, detail: "detail", text: "≈ 16′-10″", ...existing }),
    dimension({ id: "stair-run-length", label: "Stair run length", from: [187, 303], to: [349, 303], offset: -13, detail: "detail", text: "≈ 13′-6″", ...existing }),
    dimension({ id: "storage-width", label: "Storage north-south width", from: [477, 26], to: [556, 26], offset: 13, detail: "detail", text: "≈ 6′-7″", ...existing }),
    dimension({ id: "furnace-room-width", label: "Furnace room north-south width", from: [375, 222], to: [477, 222], offset: 12, detail: "detail", text: "≈ 8′-6″", ...existing }),
  ],
} satisfies FloorPlan;
