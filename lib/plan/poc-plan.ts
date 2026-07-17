import {
  dimension,
  door,
  joist,
  slidingDoor,
  space,
  stairs,
  wall,
  waterValve,
  windowOpening,
} from "./helpers.ts";
import type { FloorPlan } from "./types.ts";

const existing = {
  status: "existing" as const,
  confidence: "approximate" as const,
};

const exteriorWall = 8;
const interiorWall = 5;
const framed = { framingStatus: "framed" as const };
const needsFraming = { framingStatus: "needs-framing" as const };

const joistWidth = 2.25;
const joistClearGaps = [
  9.5, 9.5, 9.5, 9.5, 7.5, 0, 10, 7.25, 0, 9.75,
  9.5, 8, 15.25, 13.5, 13.75, 12.5, 14.25, 13.5, 13.5, 13.5,
  13.5, 13.5, 13.5, 15, 0, 10.25, 7, 0, 17.5, 13,
  13.5, 13.25, 14, 13.5, 13.5, 13.5, 13.5, 13.5, 13.5, 13.5,
] as const;

const joistNorthEdges = joistClearGaps.reduce<number[]>(
  (edges, gap) => [...edges, edges.at(-1)! + joistWidth + gap],
  [8 / 2 + 9.25],
);

const bathroomMainJoistNumbers = [1, 3, 5, 8, 11] as const;
const officeClearGapsAfterJoistFive = [9.75, 9.5, 9.5, 10, 9.5, 4.75, 12, 16.5, 17] as const;
const officeJoistNorthEdges = officeClearGapsAfterJoistFive.reduce<number[]>(
  (edges, gap) => [...edges, edges.at(-1)! + joistWidth + gap],
  [...joistNorthEdges.slice(0, 5)],
);

function joistRunAt(northEdge: number) {
  const centerX = northEdge + joistWidth / 2;
  const eastEnd = centerX < 125 ? 8 / 2 : 26 + 8 / 2;
  const westEnd = 267 - (centerX < 477 ? 5 / 2 : 8 / 2);
  return { centerX, eastEnd, westEnd };
}

export const pocPlan = {
  id: "existing-basement",
  title: "Existing Basement Layout",
  subtitle: "Approximate trace from measured sketch",
  units: "inches",
  origin: "upper-left",
  orientation: { north: "left" },
  warning: "Planning diagram — verify all measurements and code requirements on site.",
  framing: {
    defaultWallHeight: 96,
    studSpacing: 16,
    studSize: "2x4",
    topPlateCount: 1,
    bottomPlateCount: 1,
    bottomPlateTreated: true,
    wasteFactor: 0.1,
    stockLength: 96,
  },
  walls: [
    wall({ id: "north-exterior-wall", label: "North exterior wall", from: [0, 571], to: [0, 0], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "east-wall-north-cap", label: "East wall north cap", from: [0, 0], to: [125, 0], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "northeast-jog-wall", label: "Northeast jog wall", from: [125, 0], to: [125, 26], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "east-exterior-wall", label: "East exterior wall", from: [125, 26], to: [556, 26], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "south-exterior-wall", label: "South exterior wall", from: [556, 26], to: [556, 267], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "storage-west-wall", label: "Storage west wall", from: [556, 267], to: [477, 267], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "furnace-room-south-wall", label: "Furnace room south wall", from: [477, 267], to: [375, 267], thickness: interiorWall, interiorSide: "right", ...existing, ...framed }),
    wall({ id: "stair-jog-wall", label: "Finished stair jog wall", from: [375, 267], to: [375, 303], thickness: exteriorWall, interiorSide: "right", ...existing, ...framed }),
    wall({ id: "stair-west-wall", label: "Finished stair wall", from: [375, 303], to: [196, 303], thickness: exteriorWall, interiorSide: "right", ...existing, ...framed }),
    wall({ id: "finished-landing-office-jog-wall", label: "Finished landing wall beside Office", from: [196, 303], to: [196, 327], thickness: exteriorWall, interiorSide: "right", ...existing, ...framed }),
    wall({ id: "office-south-wall", label: "Office south wall", from: [196, 327], to: [196, 529], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "office-west-jog-wall", label: "Office west jog wall", from: [196, 529], to: [124, 529], thickness: exteriorWall, interiorSide: "right", dimensionSide: "right", ...existing, ...needsFraming }),
    wall({ id: "office-bump-south-wall", label: "Office bump south wall", from: [124, 529], to: [124, 571], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "office-west-wall", label: "Office west wall", from: [124, 571], to: [0, 571], thickness: exteriorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({
      id: "office-closet-divider-wall",
      label: "Office closet divider wall",
      from: [124, 529],
      to: [0, 529],
      thickness: interiorWall,
      interiorSide: "right",
      dimensionSide: "right",
      framingStatus: "needs-framing",
      status: "proposed",
      confidence: "approximate",
      note: "Continues the office-west-jog-wall north to form an approximately 3-foot-6-inch-deep closet.",
    }),

    wall({ id: "main-west-divider", label: "Main area west divider", from: [0, 267], to: [375, 267], thickness: interiorWall, interiorSide: "right", ...existing, ...framed }),
    wall({ id: "office-east-divider", label: "Finished bathroom and landing wall", from: [0, 327], to: [196, 327], thickness: interiorWall, interiorSide: "right", ...existing, ...framed }),
    wall({ id: "bathroom-south-wall", label: "Finished bathroom and landing wall", from: [129, 267], to: [129, 327], thickness: interiorWall, interiorSide: "right", ...existing, ...framed }),
    wall({ id: "furnace-room-north-wall", label: "Furnace room north wall", from: [375, 267], to: [375, 222], thickness: interiorWall, interiorSide: "right", ...existing, ...framed }),
    wall({ id: "furnace-room-east-wall", label: "Furnace room east wall", from: [375, 222], to: [477, 222], thickness: interiorWall, interiorSide: "left", ...existing, ...framed }),
    wall({ id: "storage-north-wall", label: "Storage north wall needing framing", from: [477, 26], to: [477, 222], thickness: interiorWall, interiorSide: "right", ...existing, ...needsFraming }),
    wall({ id: "furnace-room-storage-wall", label: "Finished Furnace Room storage wall", from: [477, 222], to: [477, 267], thickness: interiorWall, interiorSide: "right", ...existing, ...framed }),
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
      polygon: [[0, 327], [196, 327], [196, 529], [0, 529]],
      labelAt: [98, 428],
      note: "Office area after the proposed closet is enclosed.",
      status: "proposed",
      confidence: "approximate",
    }),
    space({
      id: "office-closet",
      label: "Closet",
      polygon: [[0, 529], [124, 529], [124, 571], [0, 571]],
      labelAt: [62, 541],
      note: "Approximately 10 feet 4 inches wide by 3 feet 6 inches deep; verify dimensions on site.",
      status: "proposed",
      confidence: "approximate",
    }),
    space({
      id: "stair-landing",
      label: "Landing",
      polygon: [[129, 267], [187, 267], [187, 303], [196, 303], [196, 327], [129, 327]],
      labelAt: [160, 300],
      note: "Irregular landing geometry inferred from the sketch.",
      ...existing,
    }),
    space({
      id: "under-stair-storage",
      label: "Stair Storage",
      polygon: [[268, 267], [375, 267], [375, 303], [268, 303]],
      labelAt: [321.5, 285],
      note: "Approximate accessible storage footprint beneath the upper half of the stair run.",
      ...existing,
    }),
  ],
  doors: [
    door({ id: "bathroom-door", label: "Bathroom door", wallId: "main-west-divider", offset: 96, width: 32, hinge: "end", swing: "inward", ...existing, status: "proposed" }),
    door({ id: "main-stair-door", label: "Main area stair door", wallId: "main-west-divider", offset: 144, width: 32, hinge: "end", swing: "outward", ...existing, status: "proposed" }),
    door({ id: "under-stair-storage-door", label: "Under-stair storage door", wallId: "main-west-divider", offset: 340, width: 32, hinge: "end", swing: "outward", status: "proposed", confidence: "exact" }),
    door({ id: "office-door", label: "Office door", wallId: "office-east-divider", offset: 147, width: 32, hinge: "end", swing: "inward", ...existing }),
    door({ id: "furnace-room-double-door-north-leaf", label: "Furnace room double door — north leaf", wallId: "furnace-room-east-wall", offset: 21, width: 30, hinge: "start", swing: "inward", ...existing }),
    door({ id: "furnace-room-double-door-south-leaf", label: "Furnace room double door — south leaf", wallId: "furnace-room-east-wall", offset: 51, width: 30, hinge: "end", swing: "inward", ...existing }),
    door({ id: "storage-door", label: "Storage door", wallId: "storage-north-wall", offset: 136, width: 32, hinge: "end", swing: "inward", note: "Door offset remains inferred from the overlapping arcs in the sketch.", ...existing, status: "proposed" }),
  ],
  slidingDoors: [
    slidingDoor({
      id: "office-closet-sliding-door",
      label: "Office closet bypass doors",
      wallId: "office-closet-divider-wall",
      offset: 26,
      width: 72,
      panels: 2,
      operation: "bypass",
      note: "Centered two-panel bypass sliding doors; not accordion-style folding doors.",
      status: "proposed",
      confidence: "approximate",
    }),
  ],
  windows: [
    windowOpening({ id: "east-wall-window-north", label: "East wall window — north", wallId: "east-exterior-wall", offset: 70, width: 47, note: "Measured frame width and offset from the northeast jog.", ...existing }),
    windowOpening({ id: "east-wall-window-south", label: "East wall window — south", wallId: "east-exterior-wall", offset: 279, width: 47, note: "Measured frame width and offset from the northeast jog.", ...existing }),
    windowOpening({ id: "north-wall-window-east", label: "North wall window — east", wallId: "north-exterior-wall", offset: 378, width: 48, note: "Width and offset scaled from the sketch.", ...existing }),
    windowOpening({ id: "north-wall-office-window", label: "North wall office window", wallId: "north-exterior-wall", offset: 112, width: 47, note: "Placed approximately 112 inches east of the office-west-wall junction.", ...existing }),
  ],
  lights: [
    // Lighting will be added as a separate system layer after the base plan is verified.
  ],
  switches: [
    // Wall devices will be added when the electrical layout is mapped.
  ],
  waterValves: [
    waterValve({
      id: "main-water-valve",
      label: "Main Water Valve",
      wallId: "office-west-jog-wall",
      offset: 54,
      referenceWallId: "office-south-wall",
      valveType: "main-water",
      enclosureWidth: 14,
      enclosureBottomAboveFloor: 20,
      enclosureHeight: 14,
      enclosureStatus: "proposed",
      labelDistance: 34,
      dimensionSide: "right",
      dimensionDistance: 48,
      note: "Existing valve; approximate proposed recessed enclosure centered between studs. Verify all dimensions and enclosure requirements on site.",
      ...existing,
    }),
    waterValve({
      id: "sprinkler-water-valve",
      label: "Sprinkler Water Valve",
      wallId: "office-west-wall",
      offset: 48,
      referenceWallId: "office-bump-south-wall",
      valveType: "sprinkler-water",
      enclosureWidth: 14,
      enclosureBottomAboveFloor: 20,
      enclosureHeight: 24,
      enclosureStatus: "proposed",
      labelDistance: 18,
      dimensionSide: "left",
      dimensionDistance: 27,
      note: "Existing sprinkler shutoff; approximate proposed recessed enclosure centered between studs. Verify all dimensions and enclosure requirements on site.",
      ...existing,
    }),
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
      planBreakOffset: 81,
      note: "Run, width, riser count, and midpoint plan break are approximate traces from the sketch.",
      ...existing,
    }),
  ],
  joists: [
    ...joistNorthEdges.map((northEdge, index) => {
      const number = index + 1;
      const { centerX, eastEnd, westEnd } = joistRunAt(northEdge);
      const alignmentNote = number === 17
        ? "Approximately aligns with the left edge of east-wall-window-north."
        : number === 32
          ? "Approximately aligns with the left edge of east-wall-window-south."
          : undefined;
      return joist({
        id: `main-ceiling-joist-${String(number).padStart(2, "0")}`,
        label: `Main ceiling joist ${number}`,
        number,
        from: [centerX, eastEnd],
        to: [centerX, westEnd],
        width: joistWidth,
        note: number === 1
          ? "North edge measured approximately 9.25 inches from the interior face of north-exterior-wall."
          : alignmentNote,
        ...existing,
      });
    }),
    ...bathroomMainJoistNumbers.map((mainNumber) => {
      const northEdge = joistNorthEdges[mainNumber - 1];
      const centerX = northEdge + joistWidth / 2;
      return joist({
        id: `bathroom-ceiling-joist-${String(mainNumber).padStart(2, "0")}`,
        label: `Bathroom ceiling joist at main ${mainNumber}`,
        number: mainNumber,
        from: [centerX, 267 + interiorWall / 2],
        to: [centerX, 327 - interiorWall / 2],
        width: joistWidth,
        note: mainNumber === 1
          ? "Aligned to main joists 1, 3, 5, 8, and 11. Main positions 2, 4, 6, 7, 9, 10, and 12 are absent in the Bathroom."
          : mainNumber === 11
            ? "Main positions 9 and 10 are absent at the cold-air intake; framing resumes here at main position 11."
            : `Aligned with main ceiling joist ${mainNumber}.`,
        ...existing,
      });
    }),
    ...officeJoistNorthEdges.map((northEdge, index) => {
      const number = index + 1;
      const centerX = northEdge + joistWidth / 2;
      return joist({
        id: `office-ceiling-joist-${String(number).padStart(2, "0")}`,
        label: `Office ceiling joist ${number}`,
        number,
        from: [centerX, 327 + interiorWall / 2],
        to: [centerX, centerX < 124 ? 571 - exteriorWall / 2 : 529 - exteriorWall / 2],
        width: joistWidth,
        note: number <= 5 ? `Aligned with main ceiling joist ${number}.` : undefined,
        ...existing,
      });
    }),
  ],
  circuits: [
    // Circuits are intentionally empty until a real electrical layer is provided.
  ],
  dimensions: [
    dimension({ id: "overall-north-south-span", label: "Overall north-south span", from: [0, 0], to: [556, 0], offset: 22, detail: "overall", text: "≈ 46′-4″", ...existing }),
    dimension({ id: "overall-east-west-span", label: "Overall east-west span", from: [556, 0], to: [556, 571], offset: 22, detail: "overall", text: "≈ 47′-7″", ...existing }),
  ],
} satisfies FloorPlan;
