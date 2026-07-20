# Plan authoring schema

Plan files are typed TypeScript. Import small constructors from `lib/plan/helpers.ts`; do not write SVG markup for plan content.

## Coordinates and metadata

Coordinates are `[x, y]` inches from the plan’s upper-left origin. Screen direction and compass direction are independent. Store the relationship on the plan:

```ts
{
  origin: "upper-left",
  orientation: { north: "left" },
}
```

For the current basement, positive `x` points south and positive `y` points west. Every item requires:

```ts
{
  id: "stable-descriptive-id",
  status: "existing" | "proposed" | "remove",
  confidence: "exact" | "approximate" | "unknown",
  label?: "Human-readable name",
  note?: "Field measurement or design context",
}
```

## Walls and spaces

Walls are arbitrary independent segments. `interiorSide` identifies which side of the directed segment faces the space.

```ts
wall({
  id: "north-wall",
  from: [0, 0],
  to: [144, 0],
  thickness: 6,
  interiorSide: "right",
  dimensionSide: "left",
  framingStatus: "needs-framing",
  status: "proposed",
  confidence: "approximate",
})
```

Framing dimensions default to the side opposite `interiorSide`. Set optional `dimensionSide` when a particular wall's annotation is clearer on the other face.

`status` describes the physical construction object; `framingStatus` separately describes whether wall framing is already present:

```ts
framingStatus: "framed" | "needs-framing" | "unknown"
```

Split a wall when one portion is framed and another portion still needs framing. Preserve the existing ID on the segment that still represents the original named run, then give the new segment a stable descriptive ID. Move wall-relative openings to the appropriate segment and update their offsets from that segment's `from` point.

Spaces are optional polygons for labels, fills, and area estimates. They do not own or generate walls.

```ts
space({
  id: "family-room",
  label: "Family room",
  polygon: [[0, 0], [144, 0], [144, 120], [0, 120]],
  labelAt: [72, 60],
  status: "proposed",
  confidence: "approximate",
})
```

## Wall-relative objects

Offsets are measured from the wall’s `from` point toward its `to` point.

```ts
windowOpening({
  id: "north-window",
  wallId: "north-wall",
  offset: 48,
  width: 48,
  heightAboveFloor: 36,
  status: "proposed",
  confidence: "approximate",
})

door({
  id: "entry-door",
  wallId: "south-wall",
  offset: 54,
  width: 36,
  hinge: "end",
  swing: "inward",
  status: "proposed",
  confidence: "approximate",
})

slidingDoor({
  id: "closet-bypass-door",
  wallId: "closet-wall",
  offset: 26,
  width: 72,
  panels: 2,
  operation: "bypass",
  status: "proposed",
  confidence: "approximate",
})
```

Use `slidingDoor` for a two-panel bypass opening. It renders two overlapping parallel leaves and does not imply an accordion or bifold assembly.

Switches use the same wall-relative convention. `heightAboveFloor` is metadata; the primary viewer remains top-down.

Selecting a window, swing door, or sliding door derives a temporary dimension chain from this wall-relative data. The viewer shows the clear wall to the nearest opening, intersecting wall, or wall endpoint on each side plus the selected opening width. Contiguous swing-door leaves are treated as one combined opening. These selection measurements are not stored as separate `Dimension` objects and remain visible in the current-view printout.

The selected opening defaults to the wall's `interiorSide`. An inspector control can switch to the opposite face; only wall junctions that approach or cross the active face stop its measurements. The viewer derives the control labels from adjacent space polygons, falling back to `Exterior` or a compass-side label when no named space applies. Only the active face is drawn and printed.

When the opening's wall ends at a connected collinear wall segment, measurement derivation follows the continuous wall run. A junction on the opposite face does not prematurely stop the active face; the measurement continues until an opening, junction on that face, or the end of the connected run.

## Plumbing

### Water shutoffs

Water valves are wall-mounted devices with an offset to the valve center. `referenceWallId` identifies the wall at the parent wall's `from` point used for the field measurement. The valve and its enclosure retain separate construction statuses.

```ts
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
  status: "existing",
  confidence: "approximate",
})
```

The Plumbing layer's Shutoffs sublayer draws the existing valve as a solid symbol and its proposed recessed enclosure as a dashed outline. The top-down box width is centered on the valve offset; it does not imply a measured enclosure depth. Selecting the valve temporarily dimensions its center from the reference-wall junction. The inspector reports the enclosure's bottom, height, and calculated top above the floor.

### Floor drain rough-ins

Plumbing floor penetrations use an absolute plan center, visible pipe or cap diameter, and protrusion above the concrete floor:

```ts
plumbingDrain({
  id: "bathroom-toilet-drain-rough-in",
  label: "Bathroom toilet drain rough-in",
  fixture: "toilet",
  at: [53, 310.5],
  diameter: 3.5,
  heightAboveFloor: 2.5,
  capStatus: "capped",
  pipeColor: "white",
  status: "existing",
  confidence: "approximate",
})
```

The `at` point is the pipe center. Preserve the field references to bathroom-facing wall surfaces in `note`, including whether the measurement is exact or approximate. Use `fixture: "unknown"` instead of guessing from pipe diameter, cap color, or location. The Plumbing layer's Drains sublayer controls these objects independently from Shutoffs.

## Lighting and circuits

Ceiling fixtures use absolute plan coordinates. Circuits reference stable fixture/device IDs and represent connectivity rather than an exact cable route.

```ts
light({
  id: "light-ne",
  at: [108, 30],
  fixture: "recessed",
  diameter: 6,
  status: "proposed",
  confidence: "approximate",
})

circuit({
  id: "lighting-circuit-a",
  layer: "lighting",
  connections: [
    { fromId: "entry-switch", toId: "light-se" },
    {
      fromId: "light-se",
      toId: "light-ne",
      waypoints: [[132, 90], [132, 30]],
    },
  ],
  status: "proposed",
  confidence: "approximate",
})
```

Omit `waypoints` for a direct conceptual run. Add them only when the route itself is meaningful.

## HVAC equipment

HVAC equipment uses an absolute plan center, an outer plan footprint, and a clockwise SVG rotation in degrees. Use the outermost physical envelope so the footprint remains useful for clearance planning. Equipment height is optional when it has not yet been measured.

```ts
hvacEquipment({
  id: "existing-furnace",
  label: "Existing furnace",
  equipmentType: "furnace",
  center: [408.5, 247],
  width: 18,
  depth: 30,
  rotation: 0,
  status: "existing",
  confidence: "approximate",
})
```

Preserve field references in `note`, especially when a footprint is derived from wall clearances. HVAC footprints are planning constraints, not equipment specifications or mechanical-design documentation.

Horizontal HVAC ducts use a plan centerline plus their measured outer width. Their vertical placement is stored as a duct height and underside height above the floor. Vertical ducts use a plan footprint and bottom/top elevations:

```ts
horizontalHvacDuct({
  id: "main-return-ceiling-trunk",
  label: "Main return ceiling trunk",
  airflowRole: "return",
  shape: "rectangular",
  from: [392.5, 250],
  to: [84.5, 250],
  width: 24,
  height: 10,
  bottomAboveFloor: 81,
  status: "existing",
  confidence: "approximate",
})

verticalHvacDuct({
  id: "furnace-return-vertical-trunk",
  label: "Furnace return vertical trunk",
  airflowRole: "return",
  shape: "rectangular",
  center: [392.5, 250],
  width: 12,
  depth: 24,
  rotation: 0,
  bottomAboveFloor: 0,
  topAboveFloor: 91,
  status: "existing",
  confidence: "approximate",
})
```

Round horizontal ducts use their measured outer diameter instead of rectangular width and height:

```ts
horizontalHvacDuct({
  id: "north-bay-upper-floor-supply-08",
  label: "North bay upper-floor supply — 8 inch round",
  airflowRole: "supply",
  shape: "round",
  from: [8.625, 209.5],
  to: [8.625, 4],
  diameter: 8,
  bottomAboveFloor: 93,
  status: "existing",
  confidence: "approximate",
})
```

Split horizontal runs at bends, branches, size changes, meaningful elevation changes, and transitions between visible and concealed work. `airflowRole` is independent from construction `status`; use `unknown` rather than inferring supply or return from duct size. Use `exhaust` for a verified HVAC venting run that is neither supply nor return:

```ts
horizontalHvacDuct({
  id: "joists-33-34-east-wall-exhaust-10",
  label: "Furnace Room east-wall exhaust — approximately 10 inch round",
  airflowRole: "exhaust",
  shape: "round",
  from: [424.25, 256.5],
  to: [424.25, 22],
  diameter: 10,
  bottomAboveFloor: 91,
  status: "existing",
  confidence: "approximate",
})
```

Refrigerant lines are HVAC services, but they are not air ducts. Store their top-down route independently, including intentional wall and exterior waypoints. Use the measured offset below the joist bottoms instead of inventing an absolute elevation when only that relationship is known:

```ts
hvacRefrigerantLine({
  id: "furnace-to-south-exterior-refrigerant-line",
  label: "Furnace to south exterior refrigerant line",
  from: [408.5, 247],
  waypoints: [[477, 243], [552, 243]],
  to: [560, 243],
  wallPenetrationBelowJoists: 4,
  support: "joist-underside",
  exteriorTurn: "up",
  status: "existing",
  confidence: "approximate",
})
```

The route may be deliberately conceptual through an equipment room when only the downstream obstruction matters. Record that limitation in `note`; do not imply measured fittings, line-set size, or exterior routing.

Returns formed by sheet-metal panning across joist bays use an explicit plan footprint and stable joist references. This keeps observed panning distinct from an ordinary freestanding rectangular duct:

```ts
hvacJoistReturn({
  id: "joists-23-25-west-wall-panned-return",
  label: "Joists 23–25 west-wall panned return",
  polygon: [[291.75, 238], [322.5, 238], [322.5, 264.5], [291.75, 264.5]],
  joistIds: ["main-ceiling-joist-23", "main-ceiling-joist-24", "main-ceiling-joist-25"],
  status: "existing",
  confidence: "approximate",
})
```

The polygon records only the observed or reasonably inferred plan projection. Describe uncertain wall, floor, or concealed continuations in `note`; do not invent an elevation or terminal grille. Every `joistIds` entry must reference an existing joist.

A constant-size horizontal duct may include intentional waypoints. Set `bendStyle: "round"` when a measured elbow has a curved outside corner:

```ts
horizontalHvacDuct({
  id: "main-supply-ceiling-trunk-24",
  label: "Main supply ceiling trunk — 24 inch",
  airflowRole: "supply",
  shape: "rectangular",
  from: [412.25, 219.5],
  waypoints: [[412.25, 207.5]],
  to: [161.5, 207.5],
  bendStyle: "round",
  width: 24,
  height: 8,
  bottomAboveFloor: 83,
  status: "existing",
  confidence: "approximate",
})
```

Asymmetric expansions and reductions use a measured four-point footprint so one fixed edge and one angled edge remain explicit:

```ts
hvacDuctTransition({
  id: "main-supply-reduction-24-to-20",
  label: "Main supply reduction — 24 to 20 inch",
  airflowRole: "supply",
  shape: "rectangular",
  polygon: [[161.5, 219.5], [161.5, 195.5], [150, 199.5], [150, 219.5]],
  fromWidth: 24,
  toWidth: 20,
  height: 8,
  bottomAboveFloor: 83,
  fixedEdge: "west",
  status: "existing",
  confidence: "approximate",
})
```

## Stairs

Stairs use a centerline from the bottom of the run toward the top when `direction` is `up`. The renderer derives the outline, riser lines, and direction arrow. Set `planBreakOffset` to an optional distance from `from` when the floor plan should stop the visible lower stair run at a conventional zigzag break; this can clarify that the remaining footprint is accessible beneath the upper stairs.

```ts
stairs({
  id: "main-stair-run",
  label: "Main stair run",
  from: [207, 282],
  to: [348, 282],
  width: 38,
  risers: 14,
  direction: "up",
  planBreakOffset: 70,
  status: "existing",
  confidence: "approximate",
})
```

Keep the run and riser count approximate when they were inferred from a sketch. Verify them on site before using the plan for construction decisions.

## Ceiling joists

Ceiling joists use a centerline run and measured board width. Keep each joist independent so irregular clear gaps and doubled joists remain visible. Compass direction comes from plan metadata; in the current plan, an east-west joist appears vertical on screen.

```ts
joist({
  id: "main-ceiling-joist-01",
  label: "Main ceiling joist 1",
  number: 1,
  from: [14.375, 4],
  to: [14.375, 264.5],
  width: 2.25,
  status: "existing",
  confidence: "approximate",
})
```

Record field spacing as clear edge-to-edge gaps. Convert the measured north edge to a centerline by adding half the joist width. Prefix IDs by measured area when separate joist runs have different spacing. The `main-` set stops at the nominal east face of the load-bearing `main-west-divider` and its collinear continuation. The `bathroom-` set contains only aligned main positions 1, 3, 5, 8, and 11; positions 9 and 10 are absent at the cold-air intake. The `office-` set numbers its own 14 joists, with the first five aligned to the corresponding main joists. Office joists within the closet footprint continue through the closet to `office-west-wall`; joists beyond the closet jog stop at `office-west-jog-wall`. Verify bearing, intake framing, and concealed conditions on site.

## Dimensions

General dimensions are explicit annotations. The current plan uses these only for the overall footprint. The Framing status layer derives gross wall-run dimensions directly from every wall marked `needs-framing`; doors, sliding doors, and windows do not shorten those framing dimensions.

```ts
dimension({
  id: "room-width",
  from: [0, 0],
  to: [144, 0],
  offset: 19,
  detail: "overall",
  text: "≈ 12′-0″",
  status: "proposed",
  confidence: "approximate",
})
```

## Framing estimate

The plan stores visible planning assumptions independently from wall geometry:

```ts
framing: {
  defaultWallHeight: 96,
  studSpacing: 16,
  studSize: "2x4",
  topPlateCount: 1,
  bottomPlateCount: 1,
  bottomPlateTreated: true,
  wasteFactor: 0.1,
  stockLength: 96,
}
```

`estimateFraming` in `lib/plan/framing.ts` totals only walls marked `needs-framing`. It reports gross linear footage, base studs at the configured on-center spacing, one standard top plate, one treated bottom plate, and 8-foot stock equivalents. Purchase quantities add the configured planning waste allowance and round up.

Openings and wall junctions are counted but their extra king studs, trimmers, headers, and backing are not automatically added. The viewer explicitly flags those framing details for on-site verification instead of inventing an assembly.

## Validation

`validatePlan` checks duplicate IDs, missing wall references, openings beyond wall bounds, water-valve enclosure bounds and reference junctions, missing circuit endpoints, zero-length walls, invalid stairs, and invalid framing assumptions. Run `npm test` before handing off a change.
