# Basement planning

A local, interactive floor-plan viewer for planning a basement finish. The plan is structured TypeScript data rendered as native SVG, so AI agents can make precise changes without hand-editing drawing markup.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by the development server. Use the layer controls to toggle plan overlays such as HVAC, framing status, ceiling joists, and dimensions. Drag the plan to pan, scroll to zoom, select objects to inspect their data, and use **Print current view** for a print-friendly layout.

## Change the plan

- POC plan data: `lib/plan/poc-plan.ts`
- Types and helpers: `lib/plan/types.ts` and `lib/plan/helpers.ts`
- Validation: `lib/plan/validate.ts`
- Viewer: `app/BasementPlanner.tsx`
- Agent instructions: `AGENTS.md`
- Schema guide: `docs/plan-schema.md`

All dimensions and coordinates are inches. This is a planning aid—not a permit set or a substitute for field verification and applicable building codes.

## Verify

```bash
npm test
npm run lint
```

## GitHub Pages

Pushes to `main` automatically build and deploy the static viewer through the
`Deploy GitHub Pages` workflow. In the repository's **Settings → Pages** screen,
set **Source** to **GitHub Actions** before the first deployment.
