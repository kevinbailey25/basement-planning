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

## Stairs

Stairs use a centerline from the bottom of the run toward the top when `direction` is `up`. The renderer derives the outline, riser lines, and direction arrow.

```ts
stairs({
  id: "main-stair-run",
  label: "Main stair run",
  from: [207, 282],
  to: [348, 282],
  width: 38,
  risers: 14,
  direction: "up",
  status: "existing",
  confidence: "approximate",
})
```

Keep the run and riser count approximate when they were inferred from a sketch. Verify them on site before using the plan for construction decisions.

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

`validatePlan` checks duplicate IDs, missing wall references, openings beyond wall bounds, missing circuit endpoints, zero-length walls, invalid stairs, and invalid framing assumptions. Run `npm test` before handing off a change.
