"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { add, distance, formatInches, pointAlong, unitNormal } from "../lib/plan/helpers";
import { estimateFraming, wallsNeedingFraming } from "../lib/plan/framing";
import { measureOpening } from "../lib/plan/opening-measurements";
import { pocPlan } from "../lib/plan/poc-plan";
import type { OpeningMeasurement } from "../lib/plan/opening-measurements";
import type { AirflowRole, Dimension, HorizontalHvacDuct, HvacDuct, HvacDuctTransition, HvacEquipment, HvacJoistReturn, HvacRefrigerantLine, Joist, PlumbingDrain, Point, SelectablePlanItem, Stairs, Wall, WallSide, WaterValve } from "../lib/plan/types";
import { allPlanItems, validatePlan } from "../lib/plan/validate";

const DEFAULT_VIEW = { x: -42, y: -42, width: 655, height: 665 };
type ToggleKey = "hvac" | "hvacSupply" | "hvacReturn" | "hvacVenting" | "hvacRefrigerant" | "plumbing" | "plumbingShutoffs" | "plumbingDrains" | "framing" | "joists" | "dimensions";

function getWall(wallId: string) {
  return pocPlan.walls.find((item) => item.id === wallId);
}

function getWallPoint(wallId: string, offset: number): Point {
  const wall = getWall(wallId);
  return wall ? pointAlong(wall.from, wall.to, offset) : [0, 0];
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
  const runLength = distance(item.from, item.to);
  const visibleRunLength = item.planBreakOffset ?? runLength;
  const renderedTo = pointAlong(item.from, item.to, visibleRunLength);
  const runDirection: Point = [(item.to[0] - item.from[0]) / runLength, (item.to[1] - item.from[1]) / runLength];
  const normal = unitNormal(item.from, item.to, "right");
  const halfWidth = item.width / 2;
  const sideAStart = add(item.from, normal, halfWidth);
  const sideAEnd = add(renderedTo, normal, halfWidth);
  const sideBEnd = add(renderedTo, normal, -halfWidth);
  const sideBStart = add(item.from, normal, -halfWidth);
  const corners = [sideAStart, sideAEnd, sideBEnd, sideBStart];
  const arrowFrom = pointAlong(item.from, item.to, visibleRunLength * (item.direction === "up" ? 0.18 : 0.75));
  const arrowTo = pointAlong(item.from, item.to, visibleRunLength * (item.direction === "up" ? 0.75 : 0.18));
  const arrowDirection: Point = [
    (arrowTo[0] - arrowFrom[0]) / distance(arrowFrom, arrowTo),
    (arrowTo[1] - arrowFrom[1]) / distance(arrowFrom, arrowTo),
  ];
  const arrowNormal: Point = [-arrowDirection[1], arrowDirection[0]];
  const arrowLeft = add(add(arrowTo, arrowDirection, -8), arrowNormal, 4);
  const arrowRight = add(add(arrowTo, arrowDirection, -8), arrowNormal, -4);
  const labelAt = add(pointAlong(item.from, item.to, visibleRunLength / 2), normal, -halfWidth - 5);
  const breakPoints = item.planBreakOffset == null ? [] : [
    sideAEnd,
    add(add(renderedTo, normal, halfWidth / 3), runDirection, -4),
    add(add(renderedTo, normal, -halfWidth / 3), runDirection, 4),
    sideBEnd,
  ];
  return (
    <g data-selectable aria-label={item.label} className={`stair-symbol ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polygon className={item.planBreakOffset == null ? "stair-footprint" : "stair-footprint stair-footprint-broken"} points={corners.map((point) => point.join(",")).join(" ")} />
      {item.planBreakOffset != null && <path className="stair-outline" d={`M ${sideAEnd[0]} ${sideAEnd[1]} L ${sideAStart[0]} ${sideAStart[1]} L ${sideBStart[0]} ${sideBStart[1]} L ${sideBEnd[0]} ${sideBEnd[1]}`} />}
      {Array.from({ length: item.risers + 1 }, (_, index) => {
        const offset = (runLength * index) / item.risers;
        if (offset > visibleRunLength + 0.001) return null;
        const point = pointAlong(item.from, item.to, offset);
        const a = add(point, normal, halfWidth);
        const b = add(point, normal, -halfWidth);
        return <line key={index} className="stair-riser" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />;
      })}
      <line className="stair-arrow" x1={arrowFrom[0]} y1={arrowFrom[1]} x2={arrowTo[0]} y2={arrowTo[1]} />
      <path className="stair-arrow" d={`M ${arrowLeft[0]} ${arrowLeft[1]} L ${arrowTo[0]} ${arrowTo[1]} L ${arrowRight[0]} ${arrowRight[1]}`} />
      {breakPoints.length > 0 && <><polyline className="stair-break-mask" points={breakPoints.map((point) => point.join(",")).join(" ")} /><polyline className="stair-break" points={breakPoints.map((point) => point.join(",")).join(" ")} /></>}
      <text x={labelAt[0]} y={labelAt[1]}>{item.direction.toUpperCase()}</text>
    </g>
  );
}

function JoistMark({ item, selected, onSelect }: { item: Joist; selected: boolean; onSelect: () => void }) {
  return (
    <g
      data-selectable
      aria-label={item.label}
      className={`joist-symbol ${selected ? "selected" : ""}`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      <line className="joist-hit" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} />
      <line className="joist-board" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} strokeWidth={item.width} />
    </g>
  );
}

function HvacEquipmentMark({ item, selected, onSelect }: { item: HvacEquipment; selected: boolean; onSelect: () => void }) {
  const hitPadding = 4;
  return (
    <g
      data-selectable
      aria-label={item.label}
      className={`hvac-equipment-symbol ${item.status} ${selected ? "selected" : ""}`}
      transform={`translate(${item.center[0]} ${item.center[1]}) rotate(${item.rotation})`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      <rect className="hvac-equipment-hit" x={-item.width / 2 - hitPadding} y={-item.depth / 2 - hitPadding} width={item.width + hitPadding * 2} height={item.depth + hitPadding * 2} />
      <rect className="hvac-equipment-footprint" x={-item.width / 2} y={-item.depth / 2} width={item.width} height={item.depth} />
      <path className="hvac-equipment-centerline" d={`M ${-item.width / 2} 0 H ${item.width / 2} M 0 ${-item.depth / 2} V ${item.depth / 2}`} />
      <text className="hvac-equipment-label" x="0" y="1.5">FURN.</text>
    </g>
  );
}

function hvacDuctPoints(item: HorizontalHvacDuct): readonly Point[] {
  return [item.from, ...(item.waypoints ?? []), item.to];
}

function hvacDuctLength(item: HorizontalHvacDuct) {
  const points = hvacDuctPoints(item);
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

function hvacDuctPlanWidth(item: HorizontalHvacDuct) {
  return item.shape === "round" ? item.diameter : item.width;
}

function airflowLabel(role: AirflowRole, vertical = false) {
  const label = role === "supply" ? "SUPPLY" : role === "return" ? "RETURN" : role === "exhaust" ? "EXHAUST" : "UNKNOWN";
  return vertical ? `${label[0]} ↑` : label;
}

function hvacDuctMidpoint(item: HorizontalHvacDuct): Point {
  const points = hvacDuctPoints(item);
  const midpointOffset = hvacDuctLength(item) / 2;
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = distance(points[index - 1], points[index]);
    if (traversed + segmentLength >= midpointOffset) {
      return pointAlong(points[index - 1], points[index], midpointOffset - traversed);
    }
    traversed += segmentLength;
  }
  return item.to;
}

function HvacDuctMark({ item, selected, onSelect }: { item: HvacDuct; selected: boolean; onSelect: () => void }) {
  const className = `hvac-duct-symbol ${item.airflowRole} ${item.status} ${selected ? "selected" : ""}`;
  if (item.orientation === "vertical") {
    return (
      <g data-selectable aria-label={item.label} className={className} transform={`translate(${item.center[0]} ${item.center[1]}) rotate(${item.rotation})`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <rect className="hvac-duct-hit" x={-item.width / 2 - 4} y={-item.depth / 2 - 4} width={item.width + 8} height={item.depth + 8} />
        <rect className="hvac-duct-footprint" x={-item.width / 2} y={-item.depth / 2} width={item.width} height={item.depth} />
        <path className="hvac-duct-centerline" d={`M ${-item.width / 2} 0 H ${item.width / 2} M 0 ${-item.depth / 2} V ${item.depth / 2}`} />
        <text className="hvac-duct-label" x="0" y="1.6">{airflowLabel(item.airflowRole, true)}</text>
      </g>
    );
  }
  const planWidth = hvacDuctPlanWidth(item);
  if (item.waypoints && item.waypoints.length > 0) {
    const points = hvacDuctPoints(item);
    const pointsText = points.map((point) => point.join(",")).join(" ");
    const midpoint = hvacDuctMidpoint(item);
    return (
      <g data-selectable aria-label={item.label} className={className} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <polyline className="hvac-duct-hit" points={pointsText} strokeWidth={planWidth + 8} />
        <polyline className="hvac-duct-band-outline" points={pointsText} strokeWidth={planWidth + (selected ? 3.6 : 2.2)} strokeLinejoin={item.bendStyle === "round" ? "round" : "miter"} />
        <polyline className="hvac-duct-band" points={pointsText} strokeWidth={planWidth} strokeLinejoin={item.bendStyle === "round" ? "round" : "miter"} />
        <polyline className="hvac-duct-centerline" points={pointsText} />
        <text className="hvac-duct-label" x={midpoint[0]} y={midpoint[1] - 2}>{airflowLabel(item.airflowRole)}</text>
      </g>
    );
  }
  const normal = unitNormal(item.from, item.to, "right");
  const halfWidth = planWidth / 2;
  const corners = [
    add(item.from, normal, halfWidth),
    add(item.to, normal, halfWidth),
    add(item.to, normal, -halfWidth),
    add(item.from, normal, -halfWidth),
  ];
  const midpoint: Point = [(item.from[0] + item.to[0]) / 2, (item.from[1] + item.to[1]) / 2];
  let angle = (Math.atan2(item.to[1] - item.from[1], item.to[0] - item.from[0]) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return (
    <g data-selectable aria-label={item.label} className={className} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <line className="hvac-duct-hit" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} strokeWidth={planWidth + 8} />
      <polygon className="hvac-duct-footprint" points={corners.map((point) => point.join(",")).join(" ")} />
      <line className="hvac-duct-centerline" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} />
      <text className="hvac-duct-label" x={midpoint[0]} y={midpoint[1] - 2} transform={`rotate(${angle} ${midpoint[0]} ${midpoint[1] - 2})`}>{airflowLabel(item.airflowRole)}</text>
    </g>
  );
}

function HvacDuctTransitionMark({ item, selected, onSelect }: { item: HvacDuctTransition; selected: boolean; onSelect: () => void }) {
  const center = item.polygon.reduce<Point>((sum, point) => [sum[0] + point[0] / item.polygon.length, sum[1] + point[1] / item.polygon.length], [0, 0]);
  return (
    <g data-selectable aria-label={item.label} className={`hvac-transition-symbol ${item.airflowRole} ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polygon className="hvac-transition-hit" points={item.polygon.map((point) => point.join(",")).join(" ")} />
      <polygon className="hvac-transition-footprint" points={item.polygon.map((point) => point.join(",")).join(" ")} />
      <text className="hvac-duct-label" x={center[0]} y={center[1] + 1.5}>{item.fromWidth}→{item.toWidth}</text>
    </g>
  );
}

function HvacJoistReturnMark({ item, selected, onSelect }: { item: HvacJoistReturn; selected: boolean; onSelect: () => void }) {
  const points = item.polygon.map((point) => point.join(",")).join(" ");
  return (
    <g data-selectable aria-label={item.label} className={`hvac-joist-return-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polygon className="hvac-joist-return-hit" points={points} />
      <polygon className="hvac-joist-return-footprint" points={points} />
    </g>
  );
}

function HvacRefrigerantLineMark({ item, selected, onSelect }: { item: HvacRefrigerantLine; selected: boolean; onSelect: () => void }) {
  const points = [item.from, ...(item.waypoints ?? []), item.to];
  const pointsText = points.map((point) => point.join(",")).join(" ");
  const storageRunStart = item.waypoints?.[0] ?? item.from;
  const storageRunEnd = item.waypoints?.[1] ?? item.to;
  const midpoint = pointAlong(storageRunStart, storageRunEnd, distance(storageRunStart, storageRunEnd) / 2);
  return (
    <g data-selectable aria-label={item.label} className={`hvac-refrigerant-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polyline className="hvac-refrigerant-hit" points={pointsText} />
      <polyline className="hvac-refrigerant-casing" points={pointsText} />
      <polyline className="hvac-refrigerant-centerline" points={pointsText} />
      <circle className="hvac-refrigerant-rise" cx={item.to[0]} cy={item.to[1]} r="3.5" />
      <text className="hvac-refrigerant-label" x={midpoint[0]} y={midpoint[1] - 3}>REFRIG. ↑</text>
    </g>
  );
}

function WaterValveMark({ item, selected, onSelect }: { item: WaterValve; selected: boolean; onSelect: () => void }) {
  const wall = getWall(item.wallId)!;
  const normal = unitNormal(wall.from, wall.to, wall.interiorSide);
  const center = pointAlong(wall.from, wall.to, item.offset);
  const boxStart = pointAlong(wall.from, wall.to, item.offset - item.enclosureWidth / 2);
  const boxEnd = pointAlong(wall.from, wall.to, item.offset + item.enclosureWidth / 2);
  const boxCorners = [
    add(boxStart, normal, 1),
    add(boxEnd, normal, 1),
    add(boxEnd, normal, 9),
    add(boxStart, normal, 9),
  ];
  const leaderEnd = add(center, normal, item.labelDistance - 5);
  const labelAt = add(center, normal, item.labelDistance);
  const shortLabel = item.valveType === "main-water" ? "Main Water" : "Sprinkler";
  return (
    <g data-selectable aria-label={item.label} className={`water-valve-symbol ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polygon className={`valve-enclosure ${item.enclosureStatus}`} points={boxCorners.map((point) => point.join(",")).join(" ")} />
      <line className="valve-hit" x1={boxStart[0]} y1={boxStart[1]} x2={boxEnd[0]} y2={boxEnd[1]} />
      <circle className="valve-body" cx={center[0]} cy={center[1]} r="4" />
      <path className="valve-handle" d={`M ${center[0] - 3} ${center[1] - 3} L ${center[0] + 3} ${center[1] + 3} M ${center[0] + 3} ${center[1] - 3} L ${center[0] - 3} ${center[1] + 3}`} />
      <line className="valve-leader" x1={center[0]} y1={center[1]} x2={leaderEnd[0]} y2={leaderEnd[1]} />
      <text className="valve-label" x={labelAt[0]} y={labelAt[1]}>{shortLabel}</text>
    </g>
  );
}

function PlumbingDrainMark({ item, selected, onSelect }: { item: PlumbingDrain; selected: boolean; onSelect: () => void }) {
  const radius = item.diameter / 2;
  const label = item.fixture === "tub-shower" ? "TUB" : item.fixture === "toilet" ? "WC" : item.fixture === "sink" ? "SINK" : "?";
  const capMark = radius * 0.55;
  return (
    <g data-selectable aria-label={item.label} className={`plumbing-drain-symbol ${item.pipeColor} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <circle className="plumbing-drain-hit" cx={item.at[0]} cy={item.at[1]} r={Math.max(radius + 5, 7)} />
      <circle className="plumbing-drain-footprint" cx={item.at[0]} cy={item.at[1]} r={radius} />
      <path className="plumbing-drain-cap" d={`M ${item.at[0] - capMark} ${item.at[1] - capMark} L ${item.at[0] + capMark} ${item.at[1] + capMark} M ${item.at[0] + capMark} ${item.at[1] - capMark} L ${item.at[0] - capMark} ${item.at[1] + capMark}`} />
      <line className="plumbing-drain-leader" x1={item.at[0]} y1={item.at[1] - radius} x2={item.at[0]} y2={item.at[1] - 5} />
      <text className="plumbing-drain-label" x={item.at[0]} y={item.at[1] - 7}>{label}</text>
    </g>
  );
}

function WaterValveDimensionMark({ item }: { item: WaterValve }) {
  const wall = getWall(item.wallId)!;
  const normal = unitNormal(wall.from, wall.to, item.dimensionSide);
  const center = pointAlong(wall.from, wall.to, item.offset);
  const start = add(wall.from, normal, item.dimensionDistance);
  const end = add(center, normal, item.dimensionDistance);
  const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const labelAt = add(midpoint, normal, 3.2);
  return (
    <g className="water-valve-dimension" aria-label={`${item.label} center placement`}>
      <line x1={wall.from[0]} y1={wall.from[1]} x2={start[0]} y2={start[1]} />
      <line x1={center[0]} y1={center[1]} x2={end[0]} y2={end[1]} />
      <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />
      <line x1={start[0] - normal[0] * 2} y1={start[1] - normal[1] * 2} x2={start[0] + normal[0] * 2} y2={start[1] + normal[1] * 2} />
      <line x1={end[0] - normal[0] * 2} y1={end[1] - normal[1] * 2} x2={end[0] + normal[0] * 2} y2={end[1] + normal[1] * 2} />
      <text x={labelAt[0]} y={labelAt[1]}>≈ {formatInches(item.offset)} to center</text>
    </g>
  );
}

function Inspector({ item, openingMeasurement, onMeasurementSideChange }: {
  item?: SelectablePlanItem;
  openingMeasurement?: OpeningMeasurement;
  onMeasurementSideChange: (side: WallSide) => void;
}) {
  if (!item) return <div className="inspector-empty"><span className="eyebrow">Object inspector</span><p>Select a wall, opening, equipment item, space, or dimension to inspect its plan data.</p></div>;
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
  } else if ("width" in item) rows.push(["Width", item.kind === "joist" ? `≈ ${item.width}″` : formatInches(item.width)]);
  if ("heightAboveFloor" in item && item.heightAboveFloor != null) rows.push(["Height above floor", formatInches(item.heightAboveFloor)]);
  if (item.kind === "wall") rows.push(["Length", formatInches(distance(item.from, item.to))], ["Thickness", `${item.thickness}″`], ["Framing", item.framingStatus]);
  if (item.kind === "light") rows.push(["Position", `x ${item.at[0]}″ · y ${item.at[1]}″`]);
  if (item.kind === "switch") rows.push(["Wall offset", formatInches(item.offset)]);
  if (item.kind === "water-valve") {
    const referenceWall = getWall(item.referenceWallId);
    rows.push(
      ["Valve", item.valveType === "main-water" ? "Main water" : "Sprinkler water"],
      [`Center from ${referenceWall?.label ?? item.referenceWallId}`, `≈ ${formatInches(item.offset)}`],
      ["Enclosure width", `≈ ${formatInches(item.enclosureWidth)}`],
      ["Box bottom", `≈ ${formatInches(item.enclosureBottomAboveFloor)} above floor`],
      ["Box height", `≈ ${formatInches(item.enclosureHeight)}`],
      ["Box top", `≈ ${formatInches(item.enclosureBottomAboveFloor + item.enclosureHeight)} above floor`],
      ["Enclosure", item.enclosureStatus],
    );
  }
  if (item.kind === "plumbing-drain") {
    const fixture = item.fixture === "tub-shower" ? "Tub/shower" : item.fixture[0].toUpperCase() + item.fixture.slice(1);
    rows.push(
      ["Fixture", fixture],
      ["Diameter", `≈ ${formatInches(item.diameter)}`],
      ["Cap", item.capStatus],
      ["Pipe color", item.pipeColor],
      ["Plan center", `x ${item.at[0]}″ · y ${item.at[1]}″`],
    );
  }
  if (item.kind === "sliding-door") rows.push(["Operation", "Two-panel bypass"], ["Panels", String(item.panels)]);
  if (item.kind === "stairs") {
    rows.push(["Run", formatInches(distance(item.from, item.to))], ["Risers", String(item.risers)], ["Direction", item.direction]);
    if (item.planBreakOffset != null) rows.push(["Plan break", formatInches(item.planBreakOffset)]);
  }
  if (item.kind === "joist") rows.push(["Joist number", String(item.number)], ["Run", `≈ ${formatInches(distance(item.from, item.to))}`]);
  if (item.kind === "hvac-equipment") {
    rows.push(
      ["Equipment", item.equipmentType === "furnace" ? "Furnace" : item.equipmentType],
      ["Depth", `≈ ${formatInches(item.depth)}`],
      ["Plan center", `x ${item.center[0]}″ · y ${item.center[1]}″`],
      ["Rotation", `${item.rotation}°`],
    );
    if (item.height != null) rows.push(["Equipment height", `≈ ${formatInches(item.height)}`]);
  }
  if (item.kind === "hvac-duct") {
    rows.push(["Airflow", item.airflowRole], ["Orientation", item.orientation], ["Shape", item.shape]);
    if (item.orientation === "horizontal") {
      rows.push(["Run", `≈ ${formatInches(hvacDuctLength(item))}`]);
      if (item.shape === "round") {
        rows.push(
          ["Diameter", `≈ ${formatInches(item.diameter)}`],
          ["Underside", `≈ ${formatInches(item.bottomAboveFloor)} above floor`],
          ["Top", `≈ ${formatInches(item.bottomAboveFloor + item.diameter)} above floor`],
        );
      } else {
        rows.push(
          ["Duct height", `≈ ${formatInches(item.height)}`],
          ["Underside", `≈ ${formatInches(item.bottomAboveFloor)} above floor`],
          ["Top", `≈ ${formatInches(item.bottomAboveFloor + item.height)} above floor`],
        );
      }
    } else {
      rows.push(
        ["Plan depth", `≈ ${formatInches(item.depth)}`],
        ["Bottom", `≈ ${formatInches(item.bottomAboveFloor)} above floor`],
        ["Top", `≈ ${formatInches(item.topAboveFloor)} above floor`],
        ["Vertical span", `≈ ${formatInches(item.topAboveFloor - item.bottomAboveFloor)}`],
      );
    }
  }
  if (item.kind === "hvac-duct-transition") {
    rows.push(
      ["Airflow", item.airflowRole],
      ["Shape", item.shape],
      ["Width change", `≈ ${formatInches(item.fromWidth)} → ${formatInches(item.toWidth)}`],
      ["Fixed edge", item.fixedEdge],
      ["Duct height", `≈ ${formatInches(item.height)}`],
      ["Underside", `≈ ${formatInches(item.bottomAboveFloor)} above floor`],
      ["Top", `≈ ${formatInches(item.bottomAboveFloor + item.height)} above floor`],
    );
  }
  if (item.kind === "hvac-joist-return") {
    rows.push(
      ["Airflow", item.airflowRole],
      ["Construction", "Panned joist return"],
      ["Footprint vertices", String(item.polygon.length)],
      ["Framing references", String(item.joistIds.length)],
    );
  }
  if (item.kind === "hvac-refrigerant-line") {
    rows.push(
      ["Service", "Refrigerant line"],
      ["Wall penetration", `≈ ${formatInches(item.wallPenetrationBelowJoists)} below joists`],
      ["Main support", "Joist underside"],
      ["Exterior turn", item.exteriorTurn],
    );
  }
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
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({ hvac: false, hvacSupply: true, hvacReturn: true, hvacVenting: true, hvacRefrigerant: true, plumbing: false, plumbingShutoffs: true, plumbingDrains: true, framing: false, joists: false, dimensions: false });
  const [selectedId, setSelectedId] = useState<string>();
  const [measurementSide, setMeasurementSide] = useState<WallSide>();
  const [view, setView] = useState(DEFAULT_VIEW);
  const drag = useRef<{ x: number; y: number; viewX: number; viewY: number; moved: boolean }>();
  const issues = useMemo(() => validatePlan(pocPlan), []);
  const items = useMemo(() => allPlanItems(pocPlan), []);
  const framingWalls = useMemo(() => wallsNeedingFraming(pocPlan), []);
  const returnItemCount = pocPlan.hvacDucts.filter((item) => item.airflowRole === "return").length + pocPlan.hvacJoistReturns.length + pocPlan.hvacDuctTransitions.filter((item) => item.airflowRole === "return").length;
  const supplyItemCount = pocPlan.hvacDucts.filter((item) => item.airflowRole === "supply").length + pocPlan.hvacDuctTransitions.filter((item) => item.airflowRole === "supply").length;
  const ventingItemCount = pocPlan.hvacDucts.filter((item) => item.airflowRole === "exhaust").length + pocPlan.hvacDuctTransitions.filter((item) => item.airflowRole === "exhaust").length;
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
          <div className="section-heading"><h2 id="layers-title">Layers</h2><span>5 controls</span></div>
          <LayerToggle label="HVAC" detail={`${pocPlan.hvacEquipment.length} equipment · ${pocPlan.hvacDucts.length + pocPlan.hvacJoistReturns.length + pocPlan.hvacDuctTransitions.length + pocPlan.hvacRefrigerantLines.length} runs/fittings`} checked={toggles.hvac} onChange={() => toggle("hvac")} color="blue" />
          <label className="sub-toggle"><input type="checkbox" checked={toggles.hvacSupply} disabled={!toggles.hvac} onChange={() => toggle("hvacSupply")} /> Supply · {supplyItemCount} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.hvacReturn} disabled={!toggles.hvac} onChange={() => toggle("hvacReturn")} /> Return · {returnItemCount} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.hvacVenting} disabled={!toggles.hvac} onChange={() => toggle("hvacVenting")} /> Venting · {ventingItemCount} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.hvacRefrigerant} disabled={!toggles.hvac} onChange={() => toggle("hvacRefrigerant")} /> Refrigerant · {pocPlan.hvacRefrigerantLines.length} mapped</label>
          <LayerToggle label="Plumbing" detail={`${pocPlan.waterValves.length + pocPlan.plumbingDrains.length} mapped items`} checked={toggles.plumbing} onChange={() => toggle("plumbing")} color="blue" />
          <label className="sub-toggle"><input type="checkbox" checked={toggles.plumbingShutoffs} disabled={!toggles.plumbing} onChange={() => toggle("plumbingShutoffs")} /> Shutoffs · {pocPlan.waterValves.length} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.plumbingDrains} disabled={!toggles.plumbing} onChange={() => toggle("plumbingDrains")} /> Drains · {pocPlan.plumbingDrains.length} mapped</label>
          <LayerToggle label="Framing status" detail={`${framingWalls.length} runs need framing`} checked={toggles.framing} onChange={() => toggle("framing")} color="amber" />
          <LayerToggle label="Ceiling joists" detail={`${pocPlan.joists.length} joists · 3 measured groups`} checked={toggles.joists} onChange={() => toggle("joists")} color="slate" />
          <LayerToggle label="Dimensions" detail="Overall footprint" checked={toggles.dimensions} onChange={() => toggle("dimensions")} color="slate" />
        </section>
        {toggles.framing && <section className="panel-section"><FramingSummary /></section>}
        <section className="panel-section legend" aria-labelledby="legend-title">
          <div className="section-heading"><h2 id="legend-title">Legend</h2><span>Planning symbols</span></div>
          <div><i className="legend-north">←</i> North</div><div><i className="legend-stairs">↑</i> Stairs up</div><div><i className="legend-window" /> Window</div><div><i className="legend-door" /> Door swing</div><div><i className="legend-sliding-door" /> Bypass doors</div>{toggles.hvac && <div><i className="legend-hvac-equipment">F</i> HVAC equipment</div>}{toggles.hvac && toggles.hvacSupply && <div><i className="legend-supply-duct" /> Supply duct</div>}{toggles.hvac && toggles.hvacReturn && <div><i className="legend-return-duct" /> Return duct</div>}{toggles.hvac && toggles.hvacReturn && <div><i className="legend-panned-return" /> Panned joist return</div>}{toggles.hvac && toggles.hvacVenting && <div><i className="legend-exhaust-duct" /> HVAC vent</div>}{toggles.hvac && toggles.hvacRefrigerant && <div><i className="legend-refrigerant-line" /> Refrigerant</div>}{toggles.joists && <div><i className="legend-joist" /> Ceiling joist</div>}{toggles.plumbing && toggles.plumbingShutoffs && <div><i className="legend-water-valve">×</i> Water shutoff</div>}{toggles.plumbing && toggles.plumbingDrains && <div><i className="legend-plumbing-drain" /> Drain rough-in</div>}<div><i className="legend-existing" /> Existing wall</div><div><i className="legend-proposed" /> Proposed work</div>{toggles.framing && <><div><i className="legend-framed" /> Already framed</div><div><i className="legend-needs-framing" /> Needs framing</div></>}
        </section>
        <section className="panel-section inspector" aria-live="polite"><Inspector item={selected} openingMeasurement={selectedOpeningMeasurement} onMeasurementSideChange={setMeasurementSide} /></section>
        <div className="panel-footer"><button type="button" onClick={() => window.print()} className="print-button">Print current view</button><p>{pocPlan.warning}</p></div>
      </aside>

      <section className="drawing-area">
        <header className="drawing-header"><div><span className="eyebrow">Plan 01 · Existing · Approximate</span><h2>Basement footprint</h2></div><div className="view-controls print-hide" aria-label="View controls"><button type="button" onClick={() => zoom(0.82)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoom(1.22)} aria-label="Zoom out">−</button><button type="button" onClick={() => setView(DEFAULT_VIEW)}>Fit</button></div></header>
        <div className="plan-frame">
          <svg className="floor-plan" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-labelledby="plan-title plan-description" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = undefined; }}>
            <title id="plan-title">{pocPlan.title}</title><desc id="plan-description">Approximate existing basement footprint traced from the supplied measured sketch.</desc>
            <defs><pattern id="panned-return" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgb(73 124 137 / 12%)" /><line x1="0" y1="0" x2="0" y2="6" stroke="#5d98a8" strokeWidth="0.7" /></pattern></defs>
            <rect className="pan-surface" x="-1000" y="-1000" width="2000" height="2000" />
            <g className="north-arrow" aria-label="North points left" transform="translate(550 550)">
              <text x="-20" y="-10">N</text>
              <line x1="0" y1="0" x2="-42" y2="0" />
              <path d="M -42 0 L -32 -6 M -42 0 L -32 6" />
            </g>
            {pocPlan.spaces.map((item) => <g key={item.id} data-selectable onClick={(event) => { event.stopPropagation(); selectItem(item.id); }} className={selectedId === item.id ? "selected" : ""}><polygon className="space-fill" points={item.polygon.map((point) => point.join(",")).join(" ")} /></g>)}
            {toggles.joists && <g className="joist-layer">{pocPlan.joists.map((item) => <JoistMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}</g>}
            <g className="space-label-layer">{pocPlan.spaces.map((item) => <g key={item.id}><text className="space-label" x={item.labelAt[0]} y={item.labelAt[1] - 3}>{item.label}</text><text className="space-area" x={item.labelAt[0]} y={item.labelAt[1] + 7}>{item.confidence}</text></g>)}</g>
            {pocPlan.walls.map((item) => <g key={item.id} data-selectable className={selectedId === item.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="wall-hit" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} />{wallSegments(item).map(([from, to]) => { const start = pointAlong(item.from, item.to, from); const end = pointAlong(item.from, item.to, to); return <line key={`${from}-${to}`} className="wall-line" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />; })}</g>)}
            {toggles.hvac && <g className="hvac-layer">
              {toggles.hvacReturn && pocPlan.hvacJoistReturns.map((item) => <HvacJoistReturnMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {pocPlan.hvacDuctTransitions.filter((item) => item.airflowRole === "unknown" || (item.airflowRole === "return" ? toggles.hvacReturn : item.airflowRole === "exhaust" ? toggles.hvacVenting : toggles.hvacSupply)).map((item) => <HvacDuctTransitionMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {pocPlan.hvacDucts.filter((item) => item.airflowRole === "unknown" || (item.airflowRole === "return" ? toggles.hvacReturn : item.airflowRole === "exhaust" ? toggles.hvacVenting : toggles.hvacSupply)).map((item) => <HvacDuctMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.hvacRefrigerant && pocPlan.hvacRefrigerantLines.map((item) => <HvacRefrigerantLineMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {pocPlan.hvacEquipment.map((item) => <HvacEquipmentMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
            </g>}
            {toggles.framing && <g className="framing-layer">
              {pocPlan.walls.map((item) => <g key={item.id} className={selectedId === item.id ? "selected" : ""}>{wallSegments(item).map(([from, to]) => { const start = pointAlong(item.from, item.to, from); const end = pointAlong(item.from, item.to, to); return <line key={`${from}-${to}`} className={`framing-line ${item.framingStatus}`} x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />; })}</g>)}
            </g>}
            {pocPlan.windows.map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const normal = unitNormal(wall.from, wall.to, wall.interiorSide); return <g key={item.id} data-selectable className={`window-symbol ${selectedOpeningIds.has(item.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line x1={add(start, normal, -2)[0]} y1={add(start, normal, -2)[1]} x2={add(end, normal, -2)[0]} y2={add(end, normal, -2)[1]} /><line x1={add(start, normal, 2)[0]} y1={add(start, normal, 2)[1]} x2={add(end, normal, 2)[0]} y2={add(end, normal, 2)[1]} /><line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /></g>; })}
            {pocPlan.doors.map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const hinge = item.hinge === "start" ? start : end; const closed = item.hinge === "start" ? end : start; let normal = unitNormal(wall.from, wall.to, wall.interiorSide); if (item.swing === "outward") normal = [-normal[0], -normal[1]]; const open = add(hinge, normal, item.width); const cross = (closed[0] - hinge[0]) * (open[1] - hinge[1]) - (closed[1] - hinge[1]) * (open[0] - hinge[0]); return <g key={item.id} data-selectable className={`door-symbol ${item.status} ${selectedOpeningIds.has(item.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="door-hit" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /><line className="door-leaf" x1={hinge[0]} y1={hinge[1]} x2={open[0]} y2={open[1]} /><path className="door-swing" d={`M ${closed[0]} ${closed[1]} A ${item.width} ${item.width} 0 0 ${cross > 0 ? 1 : 0} ${open[0]} ${open[1]}`} /></g>; })}
            {pocPlan.slidingDoors.map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const midpoint = pointAlong(wall.from, wall.to, item.offset + item.width / 2); const normal = unitNormal(wall.from, wall.to, wall.interiorSide); const overlap = 4; const firstEnd = pointAlong(wall.from, wall.to, item.offset + item.width / 2 + overlap); const secondStart = pointAlong(wall.from, wall.to, item.offset + item.width / 2 - overlap); return <g key={item.id} data-selectable aria-label={item.label} className={`sliding-door-symbol ${item.status} ${selectedOpeningIds.has(item.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="sliding-door-hit" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /><line className="sliding-door-panel" x1={add(start, normal, 2)[0]} y1={add(start, normal, 2)[1]} x2={add(firstEnd, normal, 2)[0]} y2={add(firstEnd, normal, 2)[1]} /><line className="sliding-door-panel" x1={add(secondStart, normal, -2)[0]} y1={add(secondStart, normal, -2)[1]} x2={add(end, normal, -2)[0]} y2={add(end, normal, -2)[1]} /><line className="sliding-door-center" x1={add(midpoint, normal, -4)[0]} y1={add(midpoint, normal, -4)[1]} x2={add(midpoint, normal, 4)[0]} y2={add(midpoint, normal, 4)[1]} /></g>; })}
            {toggles.plumbing && <g className="plumbing-layer">
              {toggles.plumbingShutoffs && pocPlan.waterValves.map((item) => <WaterValveMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.plumbingDrains && pocPlan.plumbingDrains.map((item) => <PlumbingDrainMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
            </g>}
            {pocPlan.stairs.map((item) => <StairMark key={item.id} item={item} selected={item.id === selectedId} onSelect={() => selectItem(item.id)} />)}
            {toggles.framing && framingWalls.map((wall) => <FramingDimensionMark key={`framing-${wall.id}`} wall={wall} onSelect={() => selectItem(wall.id)} />)}
            {toggles.dimensions && pocPlan.dimensions.map((item) => <DimensionMark key={item.id} item={item} onSelect={() => selectItem(item.id)} />)}
            {selectedOpeningMeasurement && <OpeningMeasurementMarks measurement={selectedOpeningMeasurement} />}
            {toggles.plumbing && toggles.plumbingShutoffs && selected?.kind === "water-valve" && <WaterValveDimensionMark item={selected} />}
          </svg>
          <div className="plan-hint print-hide">Drag to pan · Scroll to zoom · Select any symbol</div>
        </div>
        <footer className="drawing-footer"><div><strong>{pocPlan.title}</strong><span>{pocPlan.subtitle}</span></div><div className="print-legend"><span>← North</span><span>↑ Stairs up</span><span>═ Window</span><span>◜ Door swing</span><span>⇆ Bypass doors</span>{toggles.hvac && <span>▣ HVAC equipment</span>}{toggles.hvac && toggles.hvacSupply && <span>▭ Supply duct</span>}{toggles.hvac && toggles.hvacReturn && <span>▭ Return duct</span>}{toggles.hvac && toggles.hvacReturn && <span>▧ Panned return</span>}{toggles.joists && <span>│ Ceiling joist</span>}{toggles.plumbing && toggles.plumbingShutoffs && <span>⊗ Water shutoff</span>}{toggles.plumbing && toggles.plumbingDrains && <span>⊙ Drain rough-in</span>}<span>┄ Proposed work</span>{toggles.framing && <><span>━ Framed</span><span>┅ Needs framing</span></>}</div>{toggles.framing && <div className="print-framing-summary"><FramingSummary compact /></div>}<p>{pocPlan.warning}</p></footer>
        {issues.length > 0 && <div className="validation-error" role="alert">Plan data has {issues.length} validation issue{issues.length === 1 ? "" : "s"}.</div>}
      </section>
    </main>
  );
}
