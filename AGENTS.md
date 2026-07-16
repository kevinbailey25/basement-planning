# Basement Planning agent guide

## Purpose

This repository is a local-only, interactive SVG floor-plan viewer. Humans describe plan changes in ordinary language; agents update typed plan data. The browser is a read-only viewer, never a drawing editor.

The current artifact is a proof of concept. Implement only requested plan objects and layers. Do not anticipate HVAC, plumbing, outlets, or other schemas without real requirements.

## Source of truth

- Plan content lives in `lib/plan/poc-plan.ts`.
- Geometry types live in `lib/plan/types.ts`.
- Use constructors from `lib/plan/helpers.ts`.
- `app/BasementPlanner.tsx` is the generic renderer. Do not hard-code a requested plan change into JSX or CSS.
- See `docs/plan-schema.md` for authoring examples and conventions.

## Geometry invariants

- Canonical unit: inches. Decimals are allowed.
- Origin: upper-left. Positive `x` points right; positive `y` points down, matching SVG.
- Compass orientation is plan metadata, not inferred from SVG axes. In the current basement plan, north points left, so screen-right is south, screen-up is east, and screen-down is west.
- Geometry is nominal planning data. Set confidence to `exact`, `approximate`, or `unknown`; never imply unmeasured precision.
- Every object has a stable, descriptive, unique ID. Preserve IDs when moving or resizing an existing object.
- Walls are arbitrary independent segments. Do not introduce rectangle-room helpers.
- Spaces are independent label/area polygons. They never own walls.
- Doors and windows reference a wall by `wallId`, `offset`, and `width`; do not position them independently.
- Wall-mounted devices reference a wall and offset. Store vertical placement in `heightAboveFloor` when useful.
- Circuits model semantic connections. Add explicit waypoints only when cable routing is intentional.
- Stairs use a centerline run (`from` to `to`), total width, riser count, and up/down direction. Do not draw individual treads directly in JSX.
- Construction status (`existing`, `proposed`, `remove`) is independent from system layer visibility.

## Change workflow

1. Read the relevant plan objects and identify them by stable ID.
2. Change plan data with the smallest reasonable patch.
3. Extend the type union, helper, renderer, inspector, validation, legend, and schema guide together only when a genuinely new object type is requested.
4. Run `npm test` after data or renderer changes.
5. For visual or interaction changes, verify the local viewer at desktop/tablet size. Check layer toggles, selection, fit, pan/zoom, and print styles as applicable.

## Visual rules

- Base plan: warm-white paper with charcoal architectural geometry.
- Lighting: amber fixtures and dashed conceptual wiring.
- Proposed work: a dashed amber overlay or another pattern that remains legible without color.
- Print: high contrast, active layers only, controls hidden, warning and legend visible.
- Symbols are simplified planning symbols, not claims of NEC or professional drafting compliance.

## Safety and scope

Always retain the visible warning that measurements and code requirements must be verified on site. Do not present this project as construction, permit, electrical-engineering, plumbing-engineering, or HVAC-engineering documentation.
