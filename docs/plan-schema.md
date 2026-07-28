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

For architectural geometry, construction status is a fixed scope classification rather than progress tracking: `existing` means retain, `proposed` means add, and `remove` means demolish. The default viewer shows the final layout (`existing` + `proposed`) and hides `remove`. The Construction scope overlay can reveal demolition and highlight additions without replacing the final plan.

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
  status: "proposed",
  confidence: "approximate",
})
```

Addition dimensions default to the side opposite `interiorSide`. Set optional `dimensionSide` when a particular wall's annotation is clearer on the other face.

Split a wall when portions have different construction scope. Preserve the existing ID on the segment that still represents the original named run, then give the new segment a stable descriptive ID. Move wall-relative openings to the appropriate segment and update their offsets from that segment's `from` point.

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

## Soffits

Soffits are optional overhead architectural footprints. They are hidden by default and shown by the independent Soffit layer:

```ts
soffit({
  id: "main-supply-return-soffit",
  label: "Combined supply and return trunk soffit",
  polygon: [[0, 186], [375, 186], [375, 267], [0, 267]],
  status: "proposed",
  confidence: "approximate",
  note: "Bottom elevation and framing details are unknown; verify on site.",
})
```

Use `bottomAboveFloor` only when the underside elevation has been measured. Omitting it records an unknown elevation. The top-down footprint does not imply a framing direction, attachment method, or material estimate.

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
  height: 80,
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

Use `slidingDoor` for a two-panel bypass opening. It renders two overlapping parallel leaves and does not imply an accordion or bifold assembly. Swing-door `height` is optional; omit it when the door or rough-opening height is unknown and preserve the verification requirement in `note`.

Switches use the same wall-relative convention. `heightAboveFloor` is metadata; the primary viewer remains top-down. Switches and receptacles normally render on the parent wall's `interiorSide`; set `wallSide` to `left` or `right` only when the device belongs on the opposite face of a shared partition. Use `controlType` to distinguish a standard switch, dimmer, timer, or humidity sensor. When multiple controls share one physical box, give each the same wall and offset plus one-based `gangIndex` and matching `gangCount`; the renderer separates their symbols without pretending they are different boxes. For a combination device containing multiple controls in one gang, also set one-based `controlIndex` and matching `controlCount` on those controls.

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

### Plumbing equipment

Freestanding plumbing equipment uses an absolute center and a simple outer footprint. A cylindrical water heater stores its approximate plan diameter and measured or estimated height:

```ts
plumbingEquipment({
  id: "furnace-room-water-heater",
  label: "Existing water heater",
  equipmentType: "water-heater",
  shape: "cylinder",
  center: [464, 254],
  diameter: 20,
  height: 59,
  status: "existing",
  confidence: "approximate",
})
```

When the exact tank diameter is not important or has not been measured, use a deliberately approximate symbol footprint and say so in `note`. Do not present the footprint as an equipment specification. The Plumbing layer's Equipment sublayer controls these objects independently from Shutoffs and Drains.

## Natural gas

Natural-gas routing is its own optional layer. Each object is an independent plan-centerline run, split at branches, meaningful elevation changes, wall penetrations, and appliance connections:

```ts
gasLine({
  id: "gas-main-room-south-run",
  label: "Gas main south beside return trunk",
  from: [20, 236],
  to: [335.25, 236],
  placement: "below-joists",
  offsetBelowJoists: 5,
  status: "existing",
  confidence: "approximate",
})
```

`placement` is `joist-bay`, `below-joists`, `equipment-room`, or `unknown`. Store `heightAboveFloor` only when an absolute elevation is useful and actually known; use `offsetBelowJoists` when that measured relationship is the better reference. `fromEndpoint` and `toEndpoint` may mark a `service-entry`, `wall-termination`, `rise`, `drop`, or `appliance` connection. These markers document observed topology and vertical transitions without inventing fitting geometry.

Pipe diameter is intentionally absent from this proof-of-concept schema. The rendered line is a planning symbol, not a claim about pipe size, capacity, materials, pressure, code compliance, or installation requirements. Preserve uncertain concealed routing and inaccessible elevations in `note` and use `approximate` or `unknown` confidence.

## Electrical control groups

Ceiling fixtures use absolute plan coordinates. Use `fixture: "recessed"` for an in-ceiling fixture and `fixture: "surface"` for a surface-mounted fixture below the ceiling plane. Use `fixture: "under-cabinet"` with `at` and `to` endpoints for a conceptual linear run beneath upper cabinets; point fixtures must omit `to`. Lighting connections reference stable fixture and switch IDs. They show which lights form a control group and which switch operates that group; they never represent cable routing or fixture wiring order.

```ts
light({
  id: "light-ne",
  at: [108, 30],
  fixture: "recessed",
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

An electrically controlled exhaust fan is a separate endpoint from its HVAC duct. Place it at the indoor fan housing, reference the mapped exhaust duct, and connect a timer or humidity-sensor control with a `ventilation-control` circuit:

```ts
exhaustFan({
  id: "bathroom-ceiling-exhaust-fan",
  at: [10.75, 312],
  mounting: "ceiling",
  hvacDuctId: "bathroom-north-wall-exhaust-fan-04",
  status: "proposed",
  confidence: "approximate",
})

wallSwitch({
  id: "bathroom-entry-exhaust-fan-timer",
  wallId: "bathroom-entry-wall",
  offset: 90,
  controlType: "timer",
  gangIndex: 2,
  gangCount: 2,
  status: "proposed",
  confidence: "approximate",
})

circuit({
  id: "bathroom-exhaust-fan-control-group",
  layer: "ventilation-control",
  connections: [
    { fromId: "bathroom-entry-exhaust-fan-timer", toId: "bathroom-ceiling-exhaust-fan" },
  ],
  status: "proposed",
  confidence: "approximate",
})
```

The fan coordinate must match an endpoint of its referenced exhaust-air duct. The electrical symbol identifies the controlled fan housing; it does not duplicate the duct, exterior cap, airflow design, or mechanical approval. Omit `waypoints` for a direct schematic connection. Add them only to keep the control diagram legible. The viewer renders lighting and ventilation-control connections whenever the Lighting & fans sublayer is active.

## Receptacles

Receptacles are wall-relative objects. `offset` measures to the device center from the wall's `from` point, and the symbol appears on the wall's stored interior side:

```ts
receptacle({
  id: "office-east-wall-receptacle",
  label: "Office east wall receptacle",
  wallId: "office-east-divider",
  offset: 42,
  receptacleType: "standard",
  status: "proposed",
  confidence: "approximate",
})
```

Use `standard` for an ordinary duplex receptacle and `gfci` only when the GFCI device and its reset controls are located at that receptacle. Store `heightAboveFloor` when a vertical relationship is intentional, such as a counter-height device; omit it when the mounting height remains undecided. The Receptacles sublayer records device locations, not branch-circuit grouping, cable routing, load calculations, or code approval.

## Cabinet runs

Use `cabinetRun` for a conceptual wall-relative bank of lower cabinets, a countertop, and upper cabinets. It intentionally records the architectural footprint and useful elevations without implying individual modules, door styles, finishes, hardware, appliances, plumbing, or electrical work:

```ts
cabinetRun({
  id: "main-open-area-east-wall-cabinet-run",
  label: "Main open area dry-storage cabinets",
  wallId: "east-wall-north-cap",
  offset: 2.5,
  width: 120,
  baseDepth: 24,
  countertopOffset: 0,
  countertopWidth: 125,
  countertopDepth: 25.5,
  countertopHeight: 36,
  upperDepth: 12,
  upperBottomAboveFloor: 54,
  upperHeight: 36,
  status: "proposed",
  confidence: "approximate",
})
```

`offset` and `width` locate both cabinet banks along the stored wall direction. The countertop has its own offset and width because it may span end fillers or extend beyond the cabinet boxes. Depths project from the wall's interior face. Elevations remain nominal planning data and must be verified on site.

## Bathroom fixtures

Use `bathroomFixture` for a proposed tub/shower, toilet, or composite vanity footprint. These objects describe what occupies the finished room and appear under **Built-ins & fixtures → Bathroom fixtures**. Their measured or inferred floor penetrations remain independent objects under **Plumbing → Drains**:

```ts
bathroomFixture({
  id: "bathroom-west-wall-vanity",
  label: "Bathroom west-wall vanity",
  fixtureType: "vanity",
  center: [101.5, 316],
  width: 50,
  depth: 22,
  rotation: 0,
  drainId: "bathroom-sink-drain-rough-in",
  sinkCenter: [94.5, 315],
  status: "proposed",
  confidence: "approximate",
})
```

`center`, `width`, `depth`, and `rotation` define only the nominal top-down footprint. A `vanity` is one composite object containing the base cabinet, countertop, and sink symbol; do not duplicate it as a cabinet run. Its required `sinkCenter` preserves the basin location when the surrounding countertop footprint changes. `drainId` preserves the evidence behind the placement without claiming that the selected fixture will connect without adjustment. Do not use these rough footprints as clearance, waterproofing, accessibility, product-selection, or code-compliance documentation.

## Electrical and low-voltage cabinets

Recessed breaker panels and networking cabinets are wall-mounted cabinets. `offset` is the distance from the junction with `referenceWallId` to the cabinet's nearer edge, so field measurements remain readable even when the parent wall's stored direction is reversed:

```ts
wallCabinet({
  id: "south-wall-west-electrical-panel",
  label: "West electrical panel",
  cabinetType: "breaker-panel",
  wallId: "south-exterior-wall",
  referenceWallId: "storage-west-wall",
  offset: 12,
  width: 15.25,
  bottomAboveFloor: 45,
  height: 27,
  status: "existing",
  confidence: "approximate",
})
```

The reference wall must meet one endpoint of the mounting wall. The viewer derives the top-down span from that junction and renders only a shallow planning symbol; cabinet depth and stud framing are not implied. The Electrical layer's Panels and Low voltage sublayers control breaker panels and networking cabinets independently.

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
  label: "Utility Room east-wall exhaust — approximately 10 inch round",
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

A ceiling grille opening into a mapped panned return is a separate selectable object. Keep its proposed face dimensions and position independent from the existing chase so the drawing does not imply that cutting the opening has already been approved:

```ts
hvacReturnGrille({
  id: "office-east-ceiling-return-grille-hvac-review",
  label: "Office east ceiling return grille — HVAC review",
  sourceReturnId: "north-trunk-bathroom-office-panned-return",
  mounting: "ceiling",
  center: [91, 349],
  width: 8,
  length: 12,
  rotation: 0,
  status: "proposed",
  confidence: "approximate",
})
```

The source must identify an existing panned-return object. Notes should require inspection of the chase connection, sealing, framing, prohibited-space isolation, available supply airflow, grille free area, noise, and closed-door pressure balance. A grille face is not authorization to cut a joist or simply open the ceiling finish and panning.

Returns that intentionally use framed wall cavities require a separate wall-cavity return object. `cavitySpans` records nominal framing modules along the referenced wall; it does not claim that the entire module width is open. Keep intervening framing explicit with `preservedStudOffsets`. `connectionRoute` and `upperBootPolygon` show the known top-down topology while allowing the fitting size to remain undetermined:

```ts
hvacWallCavityReturn({
  id: "example-two-bay-low-wall-return",
  label: "Example two-bay low-wall return",
  sourceDuctId: "example-return-ceiling-trunk",
  wallId: "example-divider-wall",
  cavitySpans: [[48, 64], [64, 80]],
  preservedStudOffsets: [64],
  connectionRoute: [[84.5, 250], [82.5, 250], [82.5, 258]],
  upperBootPolygon: [[48, 258], [84.5, 258], [84.5, 264.5], [48, 264.5]],
  chaseBottomAboveFloor: 0,
  chaseTopAboveFloor: 96,
  grilleSide: "left",
  grilleCenterOffset: 64,
  grilleWidth: 30,
  grilleHeight: 8,
  grilleBottomAboveFloor: 2,
  status: "proposed",
  confidence: "approximate",
})
```

The grille dimensions describe its visible face. A continuous surface grille may cover multiple backing openings while a stud remains behind it, so its nominal face area is not the same as its effective free area. Wall-cavity returns must identify a return-air source duct, remain within their parent wall, and carry notes requiring verification of airflow sizing, cavity preparation and sealing, top-plate penetrations, fireblocking, structural framing, and grille compatibility. Do not present nominal framing modules as finished duct dimensions.

Use a ducted wall return when the drop must remain isolated from the surrounding wall or mechanical room. `wallSpan` is the nominal planning allocation, while `connectionRoute` and `upperBootPolygon` describe the conceptual overhead connection:

```ts
hvacWallDuctedReturn({
  id: "example-sealed-low-wall-return",
  label: "Example sealed low-wall return",
  sourceDuctId: "example-return-ceiling-trunk",
  wallId: "example-mechanical-room-wall",
  wallSpan: [30, 45],
  connectionRoute: [[362, 238], [362, 228.5], [372.5, 228.5]],
  upperBootPolygon: [[372.5, 222], [377.5, 222], [377.5, 237], [372.5, 237]],
  chaseBottomAboveFloor: 0,
  chaseTopAboveFloor: 96,
  grilleSide: "left",
  grilleCenterOffset: 37.5,
  grilleWidth: 14,
  grilleHeight: 8,
  grilleBottomAboveFloor: 2,
  status: "proposed",
  confidence: "approximate",
})
```

The drop is dedicated sealed sheet metal; the stud cavity is not the airway. A mechanical-room-facing side must have no opening or leakage path. Treat the wall allocation, boot, duct, and grille dimensions as diagrammatic until the HVAC designer confirms airflow, static pressure, equipment instructions, return-opening restrictions, room separation, and worst-case combustion safety on site.

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

## Radon pipes

Radon mitigation pipes are independent routed services. Store the top-down route as a floor penetration, ordered waypoints, and an exterior endpoint. The route may contain projected vertical and diagonal transitions; document measured elevations separately instead of implying that every polyline segment lies at one height:

```ts
radonPipe({
  id: "utility-room-floor-to-south-exterior-radon-pipe",
  label: "Utility Room radon pipe to south exterior",
  from: [467.5, 229.5],
  waypoints: [[472.5, 229.5], [472.5, 257.5], [548, 257.5], [552, 261.5]],
  to: [560, 269.5],
  diameter: 5,
  verticalRiseAboveFloor: 33,
  diagonalEndAboveFloor: 45,
  westRunBottomAboveFloor: 61,
  offsetBelowJoists: 13,
  exteriorTurn: "up",
  status: "existing",
  confidence: "approximate",
});
```

Relative field measurements are edge-to-edge. Convert them to nominal centerline coordinates by adding half the pipe diameter. Use `offsetBelowJoists` for the measured clearance from the pipe top to the joist bottoms. Keep approximate concealed bends and the exterior termination in `note`, and verify the route on site.

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

General dimensions are explicit annotations. The current plan uses these only for the overall footprint. Construction scope → Additions derives gross wall-run dimensions directly from every proposed wall; doors, sliding doors, and windows do not shorten those framing dimensions.

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

`estimateFraming` in `lib/plan/framing.ts` totals only walls whose construction status is `proposed`. It reports gross linear footage, base studs at the configured on-center spacing, one standard top plate, one treated bottom plate, and 8-foot stock equivalents. Purchase quantities add the configured planning waste allowance and round up.

Openings and wall junctions are counted but their extra king studs, trimmers, headers, and backing are not automatically added. Soffit framing is excluded. The viewer explicitly flags those details for on-site verification instead of inventing an assembly.

## Validation

`validatePlan` checks duplicate IDs, missing wall references, openings beyond wall bounds, soffit footprints and known elevations, bathroom-fixture footprints and drain references, water-valve enclosure bounds and reference junctions, plumbing equipment footprints, usable gas-line geometry and placement measurements, missing circuit endpoints, zero-length walls, invalid stairs, and invalid framing assumptions. Run `npm test` before handing off a change.
