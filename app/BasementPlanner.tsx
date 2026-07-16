"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { add, distance, formatInches, pointAlong, unitNormal } from "../lib/plan/helpers";
import { estimateFraming, wallsNeedingFraming } from "../lib/plan/framing";
import { measureOpening } from "../lib/plan/opening-measurements";
import { pocPlan } from "../lib/plan/poc-plan";
import type { OpeningMeasurement } from "../lib/plan/opening-measurements";
import type { Dimension, Point, SelectablePlanItem, Stairs, Wall, WallSide } from "../lib/plan/types";
import { allPlanItems, validatePlan } from "../lib/plan/validate";

const DEFAULT_VIEW = { x: -42, y: -42, width: 655, height: 665 };
type ToggleKey = "lighting" | "framing" | "dimensions" | "grid";

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
  const openings = [...pocPlan.doors, ...pocPlan.slidingDoors, ...pocPlan.windows]
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
  let angle = (Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
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

function FramingDimensionMark({ wall, onSelect }: { wall: Wall; onSelect: () => void }) {
  const side = wall.dimensionSide ?? (wall.interiorSide === "left" ? "right" : "left");
  const normal = unitNormal(wall.from, wall.to, side);
  const offset = 11;
  const start = add(wall.from, normal, offset);
  const end = add(wall.to, normal, offset);
  const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const labelAt = add(midpoint, normal, 2.8);
  let angle = (Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return (
    <g className="framing-dimension" data-selectable onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <line x1={wall.from[0]} y1={wall.from[1]} x2={start[0]} y2={start[1]} />
      <line x1={wall.to[0]} y1={wall.to[1]} x2={end[0]} y2={end[1]} />
      <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />
      <line x1={start[0] - normal[0] * 2} y1={start[1] - normal[1] * 2} x2={start[0] + normal[0] * 2} y2={start[1] + normal[1] * 2} />
      <line x1={end[0] - normal[0] * 2} y1={end[1] - normal[1] * 2} x2={end[0] + normal[0] * 2} y2={end[1] + normal[1] * 2} />
      <text x={labelAt[0]} y={labelAt[1]} transform={`rotate(${angle} ${labelAt[0]} ${labelAt[1]})`}>≈ {formatInches(distance(wall.from, wall.to))}</text>
    </g>
  );
}

function OpeningDimensionSpan({ wall, side, fromOffset, toOffset, offset, text, width = false }: {
  wall: Wall;
  side: WallSide;
  fromOffset: number;
  toOffset: number;
  offset: number;
  text: string;
  width?: boolean;
}) {
  const normal = unitNormal(wall.from, wall.to, side);
  const from = pointAlong(wall.from, wall.to, fromOffset);
  const to = pointAlong(wall.from, wall.to, toOffset);
  const start = add(from, normal, offset);
  const end = add(to, normal, offset);
  const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const labelAt = add(midpoint, normal, 3.2);
  let angle = (Math.atan2(end[1] - start[1], end[0] - start[0]) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return (
    <g className={`opening-dimension ${width ? "opening-width-dimension" : ""}`}>
      <line x1={from[0]} y1={from[1]} x2={start[0]} y2={start[1]} />
      <line x1={to[0]} y1={to[1]} x2={end[0]} y2={end[1]} />
      <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />
      <line x1={start[0] - normal[0] * 2} y1={start[1] - normal[1] * 2} x2={start[0] + normal[0] * 2} y2={start[1] + normal[1] * 2} />
      <line x1={end[0] - normal[0] * 2} y1={end[1] - normal[1] * 2} x2={end[0] + normal[0] * 2} y2={end[1] + normal[1] * 2} />
      <text x={labelAt[0]} y={labelAt[1]} transform={`rotate(${angle} ${labelAt[0]} ${labelAt[1]})`}>{text}</text>
    </g>
  );
}

function OpeningMeasurementMarks({ measurement }: { measurement: OpeningMeasurement }) {
  const prefix = measurement.confidence === "exact" ? "" : "≈ ";
  const label = (value: number) => `${prefix}${formatInches(value)}`;
  return (
    <g className="selected-opening-dimensions" aria-label={`${measurement.sideLabel} opening measurements`}>
      <OpeningDimensionSpan wall={measurement.wall} side={measurement.side} fromOffset={measurement.beforeBoundary} toOffset={measurement.openingStart} offset={15} text={label(measurement.beforeDistance)} />
      <OpeningDimensionSpan wall={measurement.wall} side={measurement.side} fromOffset={measurement.openingStart} toOffset={measurement.openingEnd} offset={15} text={label(measurement.openingWidth)} width />
      <OpeningDimensionSpan wall={measurement.wall} side={measurement.side} fromOffset={measurement.openingEnd} toOffset={measurement.afterBoundary} offset={15} text={label(measurement.afterDistance)} />
    </g>
  );
}

function FramingSummary({ compact = false }: { compact?: boolean }) {
  const estimate = estimateFraming(pocPlan);
  const wastePercent = Math.round(pocPlan.framing.wasteFactor * 100);
  const linearFeet = estimate.wallLengthInches / 12;
  return (
    <div className={`framing-summary ${compact ? "compact" : ""}`}>
      {!compact && <div className="section-heading"><h2>Framing estimate</h2><span>Rough purchase guide</span></div>}
      <div className="framing-total"><strong>≈ {linearFeet.toFixed(1)} linear ft</strong><span>{estimate.wallCount} straight runs need framing</span></div>
      <dl>
        <div><dt>8-ft 2×4 studs</dt><dd>{estimate.baseStudCount} base · <strong>{estimate.purchaseStudCount} purchase</strong></dd></div>
        <div><dt>8-ft top plate equivalents</dt><dd>{estimate.baseTopPlateBoards} base · <strong>{estimate.purchaseTopPlateBoards} purchase</strong></dd></div>
        <div><dt>8-ft treated bottom plate equivalents</dt><dd>{estimate.baseBottomPlateBoards} base · <strong>{estimate.purchaseBottomPlateBoards} purchase</strong></dd></div>
      </dl>
      <p><strong>Purchase quantities include a {wastePercent}% planning waste allowance.</strong> Base studs assume {pocPlan.framing.studSpacing}″ on center and an ≈ {formatInches(pocPlan.framing.defaultWallHeight)} wall height.</p>
      <p>{estimate.openingCount} openings and {estimate.junctionCount} wall junctions/end conditions need additional framing details that are not included above.</p>
    </div>
  );
}

function StairMark({ item, selected, onSelect }: { item: Stairs; selected: boolean; onSelect: () => void }) {
    const normal = unitNormal(item.from, item.to, "right");
    const halfWidth = item.width / 2;
    const corners = [
      add(item.from, normal, halfWidth),
      add(item.to, normal, halfWidth),
      add(item.to, normal, -halfWidth),
      add(item.from, normal, -halfWidth),
    ];
    const arrowFrom = pointAlong(item.from, item.to, distance(item.from, item.to) * (item.direction === "up" ? 0.2 : 0.8));
    const arrowTo = pointAlong(item.from, item.to, distance(item.from, item.to) * (item.direction === "up" ? 0.8 : 0.2));
    const arrowDirection: Point = [
      (arrowTo[0] - arrowFrom[0]) / distance(arrowFrom, arrowTo),
      (arrowTo[1] - arrowFrom[1]) / distance(arrowFrom, arrowTo),
    ];
    const arrowNormal: Point = [-arrowDirection[1], arrowDirection[0]];
    const arrowLeft = add(add(arrowTo, arrowDirection, -8), arrowNormal, 4);
    const arrowRight = add(add(arrowTo, arrowDirection, -8), arrowNormal, -4);
    return (
      <g data-selectable className={`stair-symbol ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <polygon points={corners.map((point) => point.join(",")).join(" ")} />
        {Array.from({ length: item.risers + 1 }, (_, index) => {
          const point = pointAlong(item.from, item.to, (distance(item.from, item.to) * index) / item.risers);
          const a = add(point, normal, halfWidth);
          const b = add(point, normal, -halfWidth);
          return <line key={index} className="stair-riser" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
        })}
        <line className="stair-arrow" x1={arrowFrom[0]} y1={arrowFrom[1]} x2={arrowTo[0]} y2={arrowTo[1]} />
        <path className="stair-arrow" d={`M ${arrowLeft[0]} ${arrowLeft[1]} L ${arrowTo[0]} ${arrowTo[1]} L ${arrowRight[0]} ${arrowRight[1]}`} />
        <text x={(item.from[0] + item.to[0]) / 2} y={item.from[1] - halfWidth - 5}>{item.direction.toUpperCase()}</text>
      </g>
    );
}

function Inspector({ item, openingMeasurement, onMeasurementSideChange }: {
  item?: SelectablePlanItem;
  openingMeasurement?: OpeningMeasurement;
  onMeasurementSideChange: (side: WallSide) => void;
}) {
  if (!item) return <div className="inspector-empty"><span className="eyebrow">Object inspector</span><p>Select a wall, opening, fixture, switch, wire, space, or dimension to inspect its plan data.</p></div>;
  const rows: Array<[string, string]> = [["ID", item.id], ["Type", item.kind], ["Status", item.status], ["Confidence", item.confidence]];
  const measuredValue = (value: number) => `${openingMeasurement?.confidence === "exact" ? "" : "≈ "}${formatInches(value)}`;
  if (openingMeasurement) {
    const beforeLabel = `${openingMeasurement.beforeDirection[0].toUpperCase()}${openingMeasurement.beforeDirection.slice(1)} clear wall`;
    const afterLabel = `${openingMeasurement.afterDirection[0].toUpperCase()}${openingMeasurement.afterDirection.slice(1)} clear wall`;
    rows.push(
      [beforeLabel, measuredValue(openingMeasurement.beforeDistance)],
      [openingMeasurement.combined ? "Combined opening" : "Opening width", measuredValue(openingMeasurement.openingWidth)],
      [afterLabel, measuredValue(openingMeasurement.afterDistance)],
    );
  } else if ("width" in item) rows.push(["Width", formatInches(item.width)]);
  if ("heightAboveFloor" in item && item.heightAboveFloor != null) rows.push(["Height above floor", formatInches(item.heightAboveFloor)]);
  if (item.kind === "wall") rows.push(["Length", formatInches(distance(item.from, item.to))], ["Thickness", `${item.thickness}″`], ["Framing", item.framingStatus]);
  if (item.kind === "light") rows.push(["Position", `x ${item.at[0]}″ · y ${item.at[1]}″`]);
  if (item.kind === "switch") rows.push(["Wall offset", formatInches(item.offset)]);
  if (item.kind === "sliding-door") rows.push(["Operation", "Two-panel bypass"], ["Panels", String(item.panels)]);
  if (item.kind === "stairs") rows.push(["Run", formatInches(distance(item.from, item.to))], ["Risers", String(item.risers)], ["Direction", item.direction]);
  if (item.kind === "circuit") rows.push(["Connections", String(item.connections.length)]);
  return (
    <div>
      <span className="eyebrow">Selected object</span>
      <h2 className="inspector-title">{item.label ?? item.id}</h2>
      {openingMeasurement && <div className="opening-side-control" aria-label="Measurement side">
        {openingMeasurement.sideOptions.map((option) => <button
          key={option.side}
          type="button"
          aria-pressed={option.side === openingMeasurement.side}
          className={option.side === openingMeasurement.side ? "active" : ""}
          onClick={() => onMeasurementSideChange(option.side)}
        >{option.label}</button>)}
      </div>}
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
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({ lighting: pocPlan.lights.length + pocPlan.switches.length > 0, framing: true, dimensions: true, grid: false });
  const [selectedId, setSelectedId] = useState<string>();
  const [measurementSide, setMeasurementSide] = useState<WallSide>();
  const [view, setView] = useState(DEFAULT_VIEW);
  const drag = useRef<{ x: number; y: number; viewX: number; viewY: number; moved: boolean }>();
  const issues = useMemo(() => validatePlan(pocPlan), []);
  const items = useMemo(() => allPlanItems(pocPlan), []);
  const framingWalls = useMemo(() => wallsNeedingFraming(pocPlan), []);
  const selected = items.find((item) => item.id === selectedId);
  const selectedOpeningMeasurement = useMemo(() => selectedId ? measureOpening(pocPlan, selectedId, measurementSide) : undefined, [selectedId, measurementSide]);
  const selectedOpeningIds = new Set(selectedOpeningMeasurement?.openingIds ?? []);
  const selectItem = (id: string) => {
    setSelectedId(id);
    const opening = [...pocPlan.windows, ...pocPlan.doors, ...pocPlan.slidingDoors].find((item) => item.id === id);
    setMeasurementSide(opening ? getWall(opening.wallId)?.interiorSide : undefined);
  };
  const clearSelection = () => {
    setSelectedId(undefined);
    setMeasurementSide(undefined);
  };
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
      const width = Math.min(1400, Math.max(180, current.width * factor));
      const height = (width / current.width) * current.height;
      return { x: current.x + (current.width - width) * px, y: current.y + (current.height - height) * py, width, height };
    });
  };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest("[data-selectable]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, viewX: view.x, viewY: view.y, moved: false };
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const activeDrag = drag.current;
    if (!activeDrag) return;
    if (Math.hypot(event.clientX - activeDrag.x, event.clientY - activeDrag.y) > 3) activeDrag.moved = true;
    const rect = event.currentTarget.getBoundingClientRect();
    setView((current) => ({ ...current, x: activeDrag.viewX - ((event.clientX - activeDrag.x) / rect.width) * current.width, y: activeDrag.viewY - ((event.clientY - activeDrag.y) / rect.height) * current.height }));
  };
  const onPointerUp = () => {
    const activeDrag = drag.current;
    drag.current = undefined;
    if (activeDrag && !activeDrag.moved) clearSelection();
  };

  return (
    <main className="planner-shell">
      <aside className="control-panel print-hide">
        <div className="brand-block"><div className="brand-mark">BP</div><div><span className="eyebrow">Working plan</span><h1>{pocPlan.title}</h1></div></div>
        <p className="subtitle">{pocPlan.subtitle}</p>
        <section className="panel-section" aria-labelledby="layers-title">
          <div className="section-heading"><h2 id="layers-title">Layers</h2><span>4 controls</span></div>
          <LayerToggle label="Lighting + wiring" detail={pocPlan.lights.length + pocPlan.switches.length > 0 ? `${pocPlan.lights.length} lights · ${pocPlan.switches.length} switches` : "Not mapped yet"} checked={toggles.lighting} onChange={() => toggle("lighting")} color="amber" />
          <LayerToggle label="Framing status" detail={`${framingWalls.length} runs need framing`} checked={toggles.framing} onChange={() => toggle("framing")} color="amber" />
          <LayerToggle label="Dimensions" detail="Overall footprint" checked={toggles.dimensions} onChange={() => toggle("dimensions")} color="slate" />
          <LayerToggle label="12-inch grid" detail="Scale reference" checked={toggles.grid} onChange={() => toggle("grid")} color="blue" />
        </section>
        {toggles.framing && <section className="panel-section"><FramingSummary /></section>}
        <section className="panel-section legend" aria-labelledby="legend-title">
          <div className="section-heading"><h2 id="legend-title">Legend</h2><span>Planning symbols</span></div>
          <div><i className="legend-north">←</i> North</div><div><i className="legend-stairs">↑</i> Stairs up</div><div><i className="legend-window" /> Window</div><div><i className="legend-door" /> Door swing</div><div><i className="legend-sliding-door" /> Bypass doors</div><div><i className="legend-existing" /> Existing wall</div>{toggles.framing && <><div><i className="legend-framed" /> Already framed</div><div><i className="legend-needs-framing" /> Needs framing</div></>}
        </section>
        <section className="panel-section inspector" aria-live="polite"><Inspector item={selected} openingMeasurement={selectedOpeningMeasurement} onMeasurementSideChange={setMeasurementSide} /></section>
        <div className="panel-footer"><button type="button" onClick={() => window.print()} className="print-button">Print current view</button><p>{pocPlan.warning}</p></div>
      </aside>

      <section className="drawing-area">
        <header className="drawing-header"><div><span className="eyebrow">Plan 01 · Existing · Approximate</span><h2>Basement footprint</h2></div><div className="view-controls print-hide" aria-label="View controls"><button type="button" onClick={() => zoom(0.82)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoom(1.22)} aria-label="Zoom out">−</button><button type="button" onClick={() => setView(DEFAULT_VIEW)}>Fit</button></div></header>
        <div className="plan-frame">
          <svg className="floor-plan" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-labelledby="plan-title plan-description" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = undefined; }}>
            <title id="plan-title">{pocPlan.title}</title><desc id="plan-description">Approximate existing basement footprint traced from the supplied measured sketch.</desc>
            <defs><pattern id="grid-small" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeWidth="0.35" /></pattern></defs>
            <rect className="pan-surface" x="-1000" y="-1000" width="2000" height="2000" />
            {toggles.grid && <rect className="plan-grid" x="-1000" y="-1000" width="2000" height="2000" fill="url(#grid-small)" />}
            <g className="north-arrow" aria-label="North points left" transform="translate(550 550)">
              <text x="-20" y="-10">N</text>
              <line x1="0" y1="0" x2="-42" y2="0" />
              <path d="M -42 0 L -32 -6 M -42 0 L -32 6" />
            </g>
            {pocPlan.spaces.map((item) => <g key={item.id} data-selectable onClick={(event) => { event.stopPropagation(); selectItem(item.id); }} className={selectedId === item.id ? "selected" : ""}><polygon className="space-fill" points={item.polygon.map((point) => point.join(",")).join(" ")} /><text className="space-label" x={item.labelAt[0]} y={item.labelAt[1] - 3}>{item.label}</text><text className="space-area" x={item.labelAt[0]} y={item.labelAt[1] + 7}>{item.confidence}</text></g>)}
            {pocPlan.walls.map((item) => <g key={item.id} data-selectable className={selectedId === item.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="wall-hit" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} />{wallSegments(item).map(([from, to]) => { const start = pointAlong(item.from, item.to, from); const end = pointAlong(item.from, item.to, to); return <line key={`${from}-${to}`} className="wall-line" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />; })}</g>)}
            {toggles.framing && <g className="framing-layer">
              {pocPlan.walls.map((item) => <g key={item.id} className={selectedId === item.id ? "selected" : ""}>{wallSegments(item).map(([from, to]) => { const start = pointAlong(item.from, item.to, from); const end = pointAlong(item.from, item.to, to); return <line key={`${from}-${to}`} className={`framing-line ${item.framingStatus}`} x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />; })}</g>)}
            </g>}
            {pocPlan.windows.map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const normal = unitNormal(wall.from, wall.to, wall.interiorSide); return <g key={item.id} data-selectable className={`window-symbol ${selectedOpeningIds.has(item.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line x1={add(start, normal, -2)[0]} y1={add(start, normal, -2)[1]} x2={add(end, normal, -2)[0]} y2={add(end, normal, -2)[1]} /><line x1={add(start, normal, 2)[0]} y1={add(start, normal, 2)[1]} x2={add(end, normal, 2)[0]} y2={add(end, normal, 2)[1]} /><line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /></g>; })}
            {pocPlan.doors.map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const hinge = item.hinge === "start" ? start : end; const closed = item.hinge === "start" ? end : start; let normal = unitNormal(wall.from, wall.to, wall.interiorSide); if (item.swing === "outward") normal = [-normal[0], -normal[1]]; const open = add(hinge, normal, item.width); const cross = (closed[0] - hinge[0]) * (open[1] - hinge[1]) - (closed[1] - hinge[1]) * (open[0] - hinge[0]); return <g key={item.id} data-selectable className={`door-symbol ${selectedOpeningIds.has(item.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="door-hit" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /><line className="door-leaf" x1={hinge[0]} y1={hinge[1]} x2={open[0]} y2={open[1]} /><path className="door-swing" d={`M ${closed[0]} ${closed[1]} A ${item.width} ${item.width} 0 0 ${cross > 0 ? 1 : 0} ${open[0]} ${open[1]}`} /></g>; })}
            {pocPlan.slidingDoors.map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const midpoint = pointAlong(wall.from, wall.to, item.offset + item.width / 2); const normal = unitNormal(wall.from, wall.to, wall.interiorSide); const overlap = 4; const firstEnd = pointAlong(wall.from, wall.to, item.offset + item.width / 2 + overlap); const secondStart = pointAlong(wall.from, wall.to, item.offset + item.width / 2 - overlap); return <g key={item.id} data-selectable aria-label={item.label} className={`sliding-door-symbol ${item.status} ${selectedOpeningIds.has(item.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="sliding-door-hit" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /><line className="sliding-door-panel" x1={add(start, normal, 2)[0]} y1={add(start, normal, 2)[1]} x2={add(firstEnd, normal, 2)[0]} y2={add(firstEnd, normal, 2)[1]} /><line className="sliding-door-panel" x1={add(secondStart, normal, -2)[0]} y1={add(secondStart, normal, -2)[1]} x2={add(end, normal, -2)[0]} y2={add(end, normal, -2)[1]} /><line className="sliding-door-center" x1={add(midpoint, normal, -4)[0]} y1={add(midpoint, normal, -4)[1]} x2={add(midpoint, normal, 4)[0]} y2={add(midpoint, normal, 4)[1]} /></g>; })}
            {pocPlan.stairs.map((item) => <StairMark key={item.id} item={item} selected={item.id === selectedId} onSelect={() => selectItem(item.id)} />)}
            {toggles.lighting && <g className="lighting-layer">
              {pocPlan.circuits.map((item) => <g key={item.id} data-selectable className={selectedId === item.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}>{item.connections.map((connection) => { const points = [getEndpoint(connection.fromId)!, ...(connection.waypoints ?? []), getEndpoint(connection.toId)!]; return <polyline key={`${connection.fromId}-${connection.toId}`} className="wire-run" points={points.map((point) => point.join(",")).join(" ")} />; })}</g>)}
              {pocPlan.lights.map((item) => <g key={item.id} data-selectable className={`light-symbol ${selectedId === item.id ? "selected" : ""}`} transform={`translate(${item.at[0]} ${item.at[1]})`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><circle r="5.2" /><circle r="2.8" /><path d="M -3.7 -3.7 L 3.7 3.7 M 3.7 -3.7 L -3.7 3.7" /></g>)}
              {pocPlan.switches.map((item) => { const point = getWallPoint(item.wallId, item.offset); return <g key={item.id} data-selectable className={`switch-symbol ${selectedId === item.id ? "selected" : ""}`} transform={`translate(${point[0]} ${point[1]})`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><circle r="4.6" /><text y="1.7">S</text></g>; })}
            </g>}
            {toggles.framing && framingWalls.map((wall) => <FramingDimensionMark key={`framing-${wall.id}`} wall={wall} onSelect={() => selectItem(wall.id)} />)}
            {toggles.dimensions && pocPlan.dimensions.map((item) => <DimensionMark key={item.id} item={item} onSelect={() => selectItem(item.id)} />)}
            {selectedOpeningMeasurement && <OpeningMeasurementMarks measurement={selectedOpeningMeasurement} />}
          </svg>
          <div className="plan-hint print-hide">Drag to pan · Scroll to zoom · Select any symbol</div>
        </div>
        <footer className="drawing-footer"><div><strong>{pocPlan.title}</strong><span>{pocPlan.subtitle}</span></div><div className="print-legend"><span>← North</span><span>↑ Stairs up</span><span>═ Window</span><span>◜ Door swing</span><span>⇆ Bypass doors</span>{toggles.framing && <><span>━ Framed</span><span>┅ Needs framing</span></>}</div>{toggles.framing && <div className="print-framing-summary"><FramingSummary compact /></div>}<p>{pocPlan.warning}</p></footer>
        {issues.length > 0 && <div className="validation-error" role="alert">Plan data has {issues.length} validation issue{issues.length === 1 ? "" : "s"}.</div>}
      </section>
    </main>
  );
}
