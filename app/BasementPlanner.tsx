"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { add, distance, formatInches, pointAlong, unitNormal } from "../lib/plan/helpers";
import { pocPlan } from "../lib/plan/poc-plan";
import type { Dimension, Point, SelectablePlanItem, Wall } from "../lib/plan/types";
import { allPlanItems, validatePlan } from "../lib/plan/validate";

const DEFAULT_VIEW = { x: -34, y: -34, width: 214, height: 188 };
type ToggleKey = "lighting" | "dimensions" | "grid";

function getWall(wallId: string) {
  return pocPlan.walls.find((item) => item.id === wallId);
}

function getWallPoint(wallId: string, offset: number): Point {
  const wall = getWall(wallId);
  return wall ? pointAlong(wall.from, wall.to, offset) : [0, 0];
}

function getEndpoint(id: string): Point | undefined {
  const fixture = pocPlan.lights.find((item) => item.id === id);
  if (fixture) return fixture.at;
  const item = pocPlan.switches.find((candidate) => candidate.id === id);
  return item ? getWallPoint(item.wallId, item.offset) : undefined;
}

function wallSegments(wall: Wall) {
  const openings = [...pocPlan.doors, ...pocPlan.windows]
    .filter((item) => item.wallId === wall.id)
    .sort((a, b) => a.offset - b.offset);
  const segments: Array<[number, number]> = [];
  let cursor = 0;
  for (const opening of openings) {
    if (opening.offset > cursor) segments.push([cursor, opening.offset]);
    cursor = Math.max(cursor, opening.offset + opening.width);
  }
  const length = distance(wall.from, wall.to);
  if (cursor < length) segments.push([cursor, length]);
  return segments;
}

function DimensionMark({ item, onSelect }: { item: Dimension; onSelect: () => void }) {
  const normal = unitNormal(item.from, item.to, "left");
  const start = add(item.from, normal, item.offset);
  const end = add(item.to, normal, item.offset);
  const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const labelAt = add(midpoint, normal, 3.2);
  const angle = (Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI;
  return (
    <g className="dimension-mark" data-selectable onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <line x1={item.from[0]} y1={item.from[1]} x2={start[0]} y2={start[1]} />
      <line x1={item.to[0]} y1={item.to[1]} x2={end[0]} y2={end[1]} />
      <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />
      <line x1={start[0] - normal[0] * 2} y1={start[1] - normal[1] * 2} x2={start[0] + normal[0] * 2} y2={start[1] + normal[1] * 2} />
      <line x1={end[0] - normal[0] * 2} y1={end[1] - normal[1] * 2} x2={end[0] + normal[0] * 2} y2={end[1] + normal[1] * 2} />
      <text x={labelAt[0]} y={labelAt[1]} transform={`rotate(${angle} ${labelAt[0]} ${labelAt[1]})`}>{item.text}</text>
    </g>
  );
}

function Inspector({ item }: { item?: SelectablePlanItem }) {
  if (!item) return <div className="inspector-empty"><span className="eyebrow">Object inspector</span><p>Select a wall, opening, fixture, switch, wire, space, or dimension to inspect its plan data.</p></div>;
  const rows: Array<[string, string]> = [["ID", item.id], ["Type", item.kind], ["Status", item.status], ["Confidence", item.confidence]];
  if ("width" in item) rows.push(["Width", formatInches(item.width)]);
  if ("heightAboveFloor" in item && item.heightAboveFloor != null) rows.push(["Height above floor", formatInches(item.heightAboveFloor)]);
  if (item.kind === "wall") rows.push(["Length", formatInches(distance(item.from, item.to))], ["Thickness", `${item.thickness}″`]);
  if (item.kind === "light") rows.push(["Position", `x ${item.at[0]}″ · y ${item.at[1]}″`]);
  if (item.kind === "switch") rows.push(["Wall offset", formatInches(item.offset)]);
  if (item.kind === "circuit") rows.push(["Connections", String(item.connections.length)]);
  return (
    <div>
      <span className="eyebrow">Selected object</span>
      <h2 className="inspector-title">{item.label ?? item.id}</h2>
      <dl className="inspector-grid">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {item.note && <p className="inspector-note">{item.note}</p>}
    </div>
  );
}

function LayerToggle({ label, detail, checked, onChange, color }: { label: string; detail: string; checked: boolean; onChange: () => void; color: "amber" | "slate" | "blue" }) {
  return (
    <label className="layer-toggle">
      <span className={`layer-dot ${color}`} />
      <span className="layer-copy"><strong>{label}</strong><small>{detail}</small></span>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="toggle-track" aria-hidden="true"><span /></span>
    </label>
  );
}

export function BasementPlanner() {
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({ lighting: true, dimensions: true, grid: false });
  const [showDetails, setShowDetails] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [view, setView] = useState(DEFAULT_VIEW);
  const drag = useRef<{ x: number; y: number; viewX: number; viewY: number }>();
  const issues = useMemo(() => validatePlan(pocPlan), []);
  const items = useMemo(() => allPlanItems(pocPlan), []);
  const selected = items.find((item) => item.id === selectedId);
  const toggle = (key: ToggleKey) => setToggles((current) => ({ ...current, [key]: !current[key] }));
  const zoom = (factor: number) => setView((current) => {
    const width = current.width * factor;
    const height = current.height * factor;
    return { x: current.x + (current.width - width) / 2, y: current.y + (current.height - height) / 2, width, height };
  });
  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const factor = event.deltaY > 0 ? 1.12 : 0.89;
    setView((current) => {
      const width = Math.min(500, Math.max(65, current.width * factor));
      const height = (width / current.width) * current.height;
      return { x: current.x + (current.width - width) * px, y: current.y + (current.height - height) * py, width, height };
    });
  };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest("[data-selectable]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y };
    setSelectedId(undefined);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setView((current) => ({ ...current, x: drag.current!.viewX - ((event.clientX - drag.current!.x) / rect.width) * current.width, y: drag.current!.viewY - ((event.clientY - drag.current!.y) / rect.height) * current.height }));
  };

  return (
    <main className="planner-shell">
      <aside className="control-panel print-hide">
        <div className="brand-block"><div className="brand-mark">BP</div><div><span className="eyebrow">Working plan</span><h1>{pocPlan.title}</h1></div></div>
        <p className="subtitle">{pocPlan.subtitle}</p>
        <section className="panel-section" aria-labelledby="layers-title">
          <div className="section-heading"><h2 id="layers-title">Layers</h2><span>3 controls</span></div>
          <LayerToggle label="Lighting + wiring" detail="4 cans · 1 switch" checked={toggles.lighting} onChange={() => toggle("lighting")} color="amber" />
          <LayerToggle label="Dimensions" detail={showDetails ? "Overall + detail" : "Overall only"} checked={toggles.dimensions} onChange={() => toggle("dimensions")} color="slate" />
          {toggles.dimensions && <label className="sub-toggle"><input type="checkbox" checked={showDetails} onChange={(event) => setShowDetails(event.target.checked)} /> Show fixture spacing</label>}
          <LayerToggle label="12-inch grid" detail="Scale reference" checked={toggles.grid} onChange={() => toggle("grid")} color="blue" />
        </section>
        <section className="panel-section legend" aria-labelledby="legend-title">
          <div className="section-heading"><h2 id="legend-title">Legend</h2><span>Planning symbols</span></div>
          <div><i className="legend-light" /> Recessed light</div><div><i className="legend-switch">S</i> Wall switch</div><div><i className="legend-wire" /> Conceptual wiring</div><div><i className="legend-proposed" /> Proposed work</div>
        </section>
        <section className="panel-section inspector" aria-live="polite"><Inspector item={selected} /></section>
        <div className="panel-footer"><button type="button" onClick={() => window.print()} className="print-button">Print current view</button><p>{pocPlan.warning}</p></div>
      </aside>

      <section className="drawing-area">
        <header className="drawing-header"><div><span className="eyebrow">Plan 01 · Proposed</span><h2>Room + lighting layout</h2></div><div className="view-controls print-hide" aria-label="View controls"><button type="button" onClick={() => zoom(0.82)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoom(1.22)} aria-label="Zoom out">−</button><button type="button" onClick={() => setView(DEFAULT_VIEW)}>Fit</button></div></header>
        <div className="plan-frame">
          <svg className="floor-plan" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-labelledby="plan-title plan-description" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = undefined; }} onPointerCancel={() => { drag.current = undefined; }}>
            <title id="plan-title">Proposed 12 by 10 foot room lighting plan</title><desc id="plan-description">A room with a north window, south entry door, four recessed lights, a wall switch, and conceptual wiring.</desc>
            <defs><pattern id="grid-small" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="0.35" /></pattern></defs>
            <rect className="pan-surface" x="-1000" y="-1000" width="2000" height="2000" />
            {toggles.grid && <rect className="plan-grid" x="-1000" y="-1000" width="2000" height="2000" fill="url(#grid-small)" />}
            {pocPlan.spaces.map((item) => <g key={item.id} data-selectable onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }} className={selectedId === item.id ? "selected" : ""}><polygon className="space-fill" points={item.polygon.map((point) => point.join(",")).join(" ")} /><text className="space-label" x={item.labelAt[0]} y={item.labelAt[1] - 2}>{item.label}</text><text className="space-area" x={item.labelAt[0]} y={item.labelAt[1] + 5}>≈ 120 sq ft</text></g>)}
            {pocPlan.walls.map((item) => <g key={item.id} data-selectable className={selectedId === item.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }}><line className="wall-hit" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} />{wallSegments(item).map(([from, to]) => { const start = pointAlong(item.from, item.to, from); const end = pointAlong(item.from, item.to, to); return <g key={`${from}-${to}`}><line className="wall-line" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /><line className="proposed-line" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /></g>; })}</g>)}
            {pocPlan.windows.map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const normal = unitNormal(wall.from, wall.to, wall.interiorSide); return <g key={item.id} data-selectable className={`window-symbol ${selectedId === item.id ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }}><line x1={add(start, normal, -2)[0]} y1={add(start, normal, -2)[1]} x2={add(end, normal, -2)[0]} y2={add(end, normal, -2)[1]} /><line x1={add(start, normal, 2)[0]} y1={add(start, normal, 2)[1]} x2={add(end, normal, 2)[0]} y2={add(end, normal, 2)[1]} /><line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /></g>; })}
            {pocPlan.doors.map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const hinge = item.hinge === "start" ? start : end; const closed = item.hinge === "start" ? end : start; let normal = unitNormal(wall.from, wall.to, wall.interiorSide); if (item.swing === "outward") normal = [-normal[0], -normal[1]]; const open = add(hinge, normal, item.width); const cross = (closed[0] - hinge[0]) * (open[1] - hinge[1]) - (closed[1] - hinge[1]) * (open[0] - hinge[0]); return <g key={item.id} data-selectable className={`door-symbol ${selectedId === item.id ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }}><line className="door-leaf" x1={hinge[0]} y1={hinge[1]} x2={open[0]} y2={open[1]} /><path className="door-swing" d={`M ${closed[0]} ${closed[1]} A ${item.width} ${item.width} 0 0 ${cross > 0 ? 1 : 0} ${open[0]} ${open[1]}`} /></g>; })}
            {toggles.lighting && <g className="lighting-layer">
              {pocPlan.circuits.map((item) => <g key={item.id} data-selectable className={selectedId === item.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }}>{item.connections.map((connection) => { const points = [getEndpoint(connection.fromId)!, ...(connection.waypoints ?? []), getEndpoint(connection.toId)!]; return <polyline key={`${connection.fromId}-${connection.toId}`} className="wire-run" points={points.map((point) => point.join(",")).join(" ")} />; })}</g>)}
              {pocPlan.lights.map((item) => <g key={item.id} data-selectable className={`light-symbol ${selectedId === item.id ? "selected" : ""}`} transform={`translate(${item.at[0]} ${item.at[1]})`} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }}><circle r="5.2" /><circle r="2.8" /><path d="M -3.7 -3.7 L 3.7 3.7 M 3.7 -3.7 L -3.7 3.7" /></g>)}
              {pocPlan.switches.map((item) => { const point = getWallPoint(item.wallId, item.offset); return <g key={item.id} data-selectable className={`switch-symbol ${selectedId === item.id ? "selected" : ""}`} transform={`translate(${point[0]} ${point[1]})`} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }}><circle r="4.6" /><text y="1.7">S</text></g>; })}
            </g>}
            {toggles.dimensions && pocPlan.dimensions.filter((item) => item.detail === "overall" || showDetails).map((item) => <DimensionMark key={item.id} item={item} onSelect={() => setSelectedId(item.id)} />)}
          </svg>
          <div className="plan-hint print-hide">Drag to pan · Scroll to zoom · Select any symbol</div>
        </div>
        <footer className="drawing-footer"><div><strong>{pocPlan.title}</strong><span>{pocPlan.subtitle}</span></div><div className="print-legend"><span>○⊗ Recessed light</span><span>ⓢ Switch</span><span>--- Conceptual wire</span></div><p>{pocPlan.warning}</p></footer>
        {issues.length > 0 && <div className="validation-error" role="alert">Plan data has {issues.length} validation issue{issues.length === 1 ? "" : "s"}.</div>}
      </section>
    </main>
  );
}
