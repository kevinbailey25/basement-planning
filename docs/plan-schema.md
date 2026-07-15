# Plan authoring schema

Plan files are typed TypeScript. Import small constructors from `lib/plan/helpers.ts`; do not write SVG markup for plan content.

## Coordinates and metadata

Coordinates are `[x, y]` inches from the plan’s upper-left origin. Every item requires:

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
  status: "proposed",
  confidence: "approximate",
})
```

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
```

Switches use the same wall-relative convention. `heightAboveFloor` is metadata; the primary viewer remains top-down.

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

## Dimensions

Dimensions are explicit annotations. Overall dimensions are displayed by default; detail dimensions require the fixture-spacing control.

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

## Validation

`validatePlan` checks duplicate IDs, missing wall references, openings beyond wall bounds, missing circuit endpoints, and zero-length walls. Run `npm test` before handing off a change.
