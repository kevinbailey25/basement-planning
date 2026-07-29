"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { add, distance, formatInches, pointAlong, unitNormal, wallCabinetSpan } from "../lib/plan/helpers";
import { estimateFraming, wallsToAdd } from "../lib/plan/framing";
import { measureOpening } from "../lib/plan/opening-measurements";
import { pocPlan } from "../lib/plan/poc-plan";
import type { OpeningMeasurement } from "../lib/plan/opening-measurements";
import type { AirflowRole, BathroomFixture, CabinetRun, CeilingReceptacle, Circuit, Dimension, Door, ExhaustFan, GasEndpoint, GasLine, HorizontalHvacDuct, HvacDuct, HvacDuctTransition, HvacEquipment, HvacJoistReturn, HvacRefrigerantLine, HvacReturnGrille, HvacWallCavityReturn, HvacWallDuctedReturn, Joist, Light, PlumbingDrain, PlumbingEquipment, Point, RadonPipe, Receptacle, SelectablePlanItem, Soffit, Stairs, Switch, Wall, WallCabinet, WallLight, WallSide, WaterValve } from "../lib/plan/types";
import { allPlanItems, validatePlan } from "../lib/plan/validate";

const DEFAULT_VIEW = { x: -42, y: -42, width: 655, height: 665 };
type ToggleKey = "construction" | "constructionDemolition" | "constructionAdditions" | "soffits" | "builtIns" | "builtInCabinetry" | "builtInBathroomFixtures" | "hvac" | "hvacSupply" | "hvacReturn" | "hvacVenting" | "hvacRefrigerant" | "gas" | "radon" | "plumbing" | "plumbingShutoffs" | "plumbingDrains" | "plumbingEquipment" | "electrical" | "electricalLighting" | "electricalReceptacles" | "electricalPanels" | "electricalLowVoltage" | "joists" | "dimensions";

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
      {!compact && <div className="section-heading"><h2>Additions estimate</h2><span>Wall-framing purchase guide</span></div>}
      <div className="framing-total"><strong>≈ {linearFeet.toFixed(1)} linear ft</strong><span>{estimate.wallCount} straight wall runs to add</span></div>
      <dl>
        <div><dt>8-ft 2×4 studs</dt><dd>{estimate.baseStudCount} base · <strong>{estimate.purchaseStudCount} purchase</strong></dd></div>
        <div><dt>8-ft top plate equivalents</dt><dd>{estimate.baseTopPlateBoards} base · <strong>{estimate.purchaseTopPlateBoards} purchase</strong></dd></div>
        <div><dt>8-ft treated bottom plate equivalents</dt><dd>{estimate.baseBottomPlateBoards} base · <strong>{estimate.purchaseBottomPlateBoards} purchase</strong></dd></div>
      </dl>
      <p><strong>Purchase quantities include a {wastePercent}% planning waste allowance.</strong> Base studs assume {pocPlan.framing.studSpacing}″ on center and an ≈ {formatInches(pocPlan.framing.defaultWallHeight)} wall height.</p>
      <p>{estimate.openingCount} openings and {estimate.junctionCount} wall junctions/end conditions need additional framing details that are not included above. Soffit framing is excluded.</p>
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

function HvacReturnGrilleMark({ item, selected, onSelect }: { item: HvacReturnGrille; selected: boolean; onSelect: () => void }) {
  const x = item.center[0] - item.width / 2;
  const y = item.center[1] - item.length / 2;
  const slatOffsets = [-0.3, -0.1, 0.1, 0.3];
  return (
    <g
      data-selectable
      aria-label={item.label}
      className={`hvac-return-grille-symbol ${item.status} ${selected ? "selected" : ""}`}
      transform={`rotate(${item.rotation} ${item.center[0]} ${item.center[1]})`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      <rect className="hvac-return-grille-hit" x={x} y={y} width={item.width} height={item.length} />
      <rect className="hvac-return-grille-face" x={x} y={y} width={item.width} height={item.length} />
      {slatOffsets.map((offset) => (
        <line
          key={offset}
          className="hvac-return-grille-slat"
          x1={item.center[0] + item.width * offset}
          y1={y + 1}
          x2={item.center[0] + item.width * offset}
          y2={y + item.length - 1}
        />
      ))}
      <text className="hvac-duct-label hvac-return-grille-label" x={item.center[0]} y={y - 2}>RETURN</text>
    </g>
  );
}

function HvacWallCavityReturnMark({ item, selected, onSelect }: { item: HvacWallCavityReturn; selected: boolean; onSelect: () => void }) {
  const wall = getWall(item.wallId);
  if (!wall) return null;
  const normal = unitNormal(wall.from, wall.to, item.grilleSide);
  const routePoints = item.connectionRoute.map((point) => point.join(",")).join(" ");
  const bootPoints = item.upperBootPolygon.map((point) => point.join(",")).join(" ");
  const grilleStart = add(pointAlong(wall.from, wall.to, item.grilleCenterOffset - item.grilleWidth / 2), normal, wall.thickness / 2 + 2.2);
  const grilleEnd = add(pointAlong(wall.from, wall.to, item.grilleCenterOffset + item.grilleWidth / 2), normal, wall.thickness / 2 + 2.2);
  const grilleCenter = add(pointAlong(wall.from, wall.to, item.grilleCenterOffset), normal, wall.thickness / 2 + 8);
  const studMarks = item.preservedStudOffsets.map((offset) => {
    const center = pointAlong(wall.from, wall.to, offset);
    return [add(center, normal, -wall.thickness / 2), add(center, normal, wall.thickness / 2)] as const;
  });
  return (
    <g data-selectable aria-label={item.label} className={`hvac-wall-cavity-return-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polyline className="hvac-wall-return-hit" points={routePoints} />
      <polygon className="hvac-wall-return-hit" points={bootPoints} />
      <polyline className="hvac-wall-return-route" points={routePoints} />
      <polygon className="hvac-wall-return-boot" points={bootPoints} />
      {item.cavitySpans.map(([fromOffset, toOffset]) => {
        const inset = 1.5;
        const start = pointAlong(wall.from, wall.to, fromOffset + inset);
        const end = pointAlong(wall.from, wall.to, toOffset - inset);
        return <line key={`${fromOffset}-${toOffset}`} className="hvac-wall-return-cavity" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} strokeWidth={Math.max(2, wall.thickness - 1)} />;
      })}
      {studMarks.map(([start, end], index) => <line key={item.preservedStudOffsets[index]} className="hvac-wall-return-preserved-stud" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />)}
      <line className="hvac-wall-return-grille-outline" x1={grilleStart[0]} y1={grilleStart[1]} x2={grilleEnd[0]} y2={grilleEnd[1]} />
      <line className="hvac-wall-return-grille" x1={grilleStart[0]} y1={grilleStart[1]} x2={grilleEnd[0]} y2={grilleEnd[1]} />
      <text className="hvac-duct-label hvac-wall-return-label" x={grilleCenter[0]} y={grilleCenter[1]}>LOW RETURN</text>
    </g>
  );
}

function HvacWallDuctedReturnMark({ item, selected, onSelect }: { item: HvacWallDuctedReturn; selected: boolean; onSelect: () => void }) {
  const wall = getWall(item.wallId);
  if (!wall) return null;
  const normal = unitNormal(wall.from, wall.to, item.grilleSide);
  const routePoints = item.connectionRoute.map((point) => point.join(",")).join(" ");
  const bootPoints = item.upperBootPolygon.map((point) => point.join(",")).join(" ");
  const [fromOffset, toOffset] = item.wallSpan;
  const ductStart = pointAlong(wall.from, wall.to, fromOffset + 1.5);
  const ductEnd = pointAlong(wall.from, wall.to, toOffset - 1.5);
  const grilleStart = add(pointAlong(wall.from, wall.to, item.grilleCenterOffset - item.grilleWidth / 2), normal, wall.thickness / 2 + 2.2);
  const grilleEnd = add(pointAlong(wall.from, wall.to, item.grilleCenterOffset + item.grilleWidth / 2), normal, wall.thickness / 2 + 2.2);
  const grilleCenter = add(pointAlong(wall.from, wall.to, item.grilleCenterOffset), normal, wall.thickness / 2 + 8);
  return (
    <g data-selectable aria-label={item.label} className={`hvac-wall-ducted-return-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polyline className="hvac-wall-return-hit" points={routePoints} />
      <polygon className="hvac-wall-return-hit" points={bootPoints} />
      <polyline className="hvac-wall-return-route" points={routePoints} />
      <polygon className="hvac-wall-return-boot" points={bootPoints} />
      <line className="hvac-wall-return-duct" x1={ductStart[0]} y1={ductStart[1]} x2={ductEnd[0]} y2={ductEnd[1]} strokeWidth={Math.max(2, wall.thickness - 1)} />
      <line className="hvac-wall-return-grille-outline" x1={grilleStart[0]} y1={grilleStart[1]} x2={grilleEnd[0]} y2={grilleEnd[1]} />
      <line className="hvac-wall-return-grille" x1={grilleStart[0]} y1={grilleStart[1]} x2={grilleEnd[0]} y2={grilleEnd[1]} />
      <text className="hvac-duct-label hvac-wall-return-label" x={grilleCenter[0]} y={grilleCenter[1]}>SEALED RETURN</text>
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

function WallCabinetMark({ item, selected, onSelect }: { item: WallCabinet; selected: boolean; onSelect: () => void }) {
  const wall = getWall(item.wallId)!;
  const referenceWall = getWall(item.referenceWallId)!;
  const [startOffset, endOffset] = wallCabinetSpan(item, wall, referenceWall)!;
  const start = pointAlong(wall.from, wall.to, startOffset);
  const end = pointAlong(wall.from, wall.to, endOffset);
  const midpoint = pointAlong(wall.from, wall.to, (startOffset + endOffset) / 2);
  const normal = unitNormal(wall.from, wall.to, wall.interiorSide);
  const halfWallDepth = wall.thickness / 2;
  const interiorStart = add(start, normal, halfWallDepth);
  const interiorEnd = add(end, normal, halfWallDepth);
  const corners = [interiorStart, interiorEnd, add(end, normal, -halfWallDepth), add(start, normal, -halfWallDepth)];
  const labelAt = midpoint;
  const label = item.cabinetType === "breaker-panel" ? (item.id.includes("west") ? "P1" : "P2") : "NET";
  return (
    <g data-selectable aria-label={item.label} className={`wall-cabinet-symbol ${item.cabinetType} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polygon className="wall-cabinet-hit" points={corners.map((point) => point.join(",")).join(" ")} />
      <polygon className="wall-cabinet-footprint" points={corners.map((point) => point.join(",")).join(" ")} />
      <line className="wall-cabinet-face" x1={interiorStart[0]} y1={interiorStart[1]} x2={interiorEnd[0]} y2={interiorEnd[1]} />
      <text className="wall-cabinet-label" x={labelAt[0]} y={labelAt[1]}>{label}</text>
    </g>
  );
}

function CabinetRunMark({ item, selected, onSelect }: { item: CabinetRun; selected: boolean; onSelect: () => void }) {
  const wall = getWall(item.wallId)!;
  const normal = unitNormal(wall.from, wall.to, wall.interiorSide);
  const wallInset = wall.thickness / 2;
  const footprint = (offset: number, width: number, depth: number): Point[] => {
    const start = add(pointAlong(wall.from, wall.to, offset), normal, wallInset);
    const end = add(pointAlong(wall.from, wall.to, offset + width), normal, wallInset);
    return [start, end, add(end, normal, depth), add(start, normal, depth)];
  };
  const countertop = footprint(item.countertopOffset, item.countertopWidth, item.countertopDepth);
  const base = footprint(item.offset, item.width, item.baseDepth);
  const upper = footprint(item.offset, item.width, item.upperDepth);
  const labelAt = add(pointAlong(wall.from, wall.to, item.offset + item.width / 2), normal, item.baseDepth + wallInset - 3);
  const points = (polygon: readonly Point[]) => polygon.map((point) => point.join(",")).join(" ");
  return (
    <g data-selectable aria-label={item.label} className={`cabinet-run-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polygon className="cabinet-run-hit" points={points(countertop)} />
      <polygon className="cabinet-countertop-footprint" points={points(countertop)} />
      <polygon className="cabinet-base-footprint" points={points(base)} />
      <polygon className="cabinet-upper-footprint" points={points(upper)} />
      <text className="cabinet-run-label" x={labelAt[0]} y={labelAt[1]}>CABINETS · COUNTER</text>
    </g>
  );
}

function BathroomFixtureMark({ item, selected, onSelect }: { item: BathroomFixture; selected: boolean; onSelect: () => void }) {
  const drain = pocPlan.plumbingDrains.find((candidate) => candidate.id === item.drainId);
  const radians = (-item.rotation * Math.PI) / 180;
  const localPoint = (point: Point) => [
    (point[0] - item.center[0]) * Math.cos(radians) - (point[1] - item.center[1]) * Math.sin(radians),
    (point[0] - item.center[0]) * Math.sin(radians) + (point[1] - item.center[1]) * Math.cos(radians),
  ] as const;
  const drainLocal = drain ? localPoint(drain.at) : undefined;
  const sinkLocal = item.sinkCenter ? localPoint(item.sinkCenter) : [0, -1] as const;
  return (
    <g
      data-selectable
      aria-label={item.label}
      className={`bathroom-fixture-symbol ${item.fixtureType} ${item.status} ${selected ? "selected" : ""}`}
      transform={`translate(${item.center[0]} ${item.center[1]}) rotate(${item.rotation})`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      <rect className="bathroom-fixture-hit" x={-item.width / 2 - 3} y={-item.depth / 2 - 3} width={item.width + 6} height={item.depth + 6} rx="2" />
      <rect className="bathroom-fixture-footprint" x={-item.width / 2} y={-item.depth / 2} width={item.width} height={item.depth} rx="1.5" />
      {item.fixtureType === "tub-shower" && <>
        <rect className="bathroom-fixture-detail" x={-item.width / 2 + 3} y={-item.depth / 2 + 3} width={item.width - 6} height={item.depth - 6} rx="5" />
        <path className="bathroom-fixture-detail" d={`M ${-item.width / 2 + 5} ${-item.depth / 2 + 10} H ${item.width / 2 - 5}`} />
      </>}
      {item.fixtureType === "toilet" && <>
        <rect className="bathroom-fixture-detail bathroom-toilet-tank" x={-item.width / 2 + 1.5} y={item.depth / 2 - 7} width={item.width - 3} height="6" rx="1" />
        <ellipse className="bathroom-fixture-detail" cx="0" cy="-2.5" rx={item.width * 0.34} ry={item.depth * 0.31} />
        <ellipse className="bathroom-fixture-detail" cx="0" cy="-2.5" rx={item.width * 0.22} ry={item.depth * 0.21} />
      </>}
      {item.fixtureType === "vanity" && <>
        <line className="bathroom-fixture-detail" x1={-item.width / 2} y1={item.depth / 2 - 3} x2={item.width / 2} y2={item.depth / 2 - 3} />
        <ellipse className="bathroom-fixture-detail bathroom-vanity-basin" cx={sinkLocal[0]} cy={sinkLocal[1]} rx={Math.min(8, item.width * 0.28)} ry={Math.min(5.5, item.depth * 0.3)} />
        <circle className="bathroom-fixture-detail" cx={sinkLocal[0]} cy={sinkLocal[1]} r="1" />
      </>}
      {drainLocal && <circle className="bathroom-fixture-drain" cx={drainLocal[0]} cy={drainLocal[1]} r="1.6" />}
    </g>
  );
}

function switchSymbolPosition(item: Switch) {
  const wall = getWall(item.wallId)!;
  const baseWallAt = pointAlong(wall.from, wall.to, item.offset);
  const wallLength = distance(wall.from, wall.to);
  const tangent: Point = wallLength === 0 ? [0, 0] : [
    (wall.to[0] - wall.from[0]) / wallLength,
    (wall.to[1] - wall.from[1]) / wallLength,
  ];
  const gangShift = item.gangIndex != null && item.gangCount != null
    // Spread gang symbols for plan readability; both controls retain the same box offset.
    ? (item.gangIndex - (item.gangCount + 1) / 2) * 8
    : 0;
  const wallAt = add(baseWallAt, tangent, gangShift);
  const normal = unitNormal(wall.from, wall.to, item.wallSide ?? wall.interiorSide);
  const controlOutset = item.controlIndex != null && item.controlCount != null
    // Stack combination-device controls away from the wall for plan readability.
    ? (item.controlIndex - 1) * 10
    : 0;
  return { wallAt, at: add(wallAt, normal, wall.thickness / 2 + 5 + controlOutset) };
}

function wallLightSymbolPosition(item: WallLight) {
  const wall = getWall(item.wallId)!;
  const wallAt = pointAlong(wall.from, wall.to, item.offset);
  const normal = unitNormal(wall.from, wall.to, item.wallSide ?? wall.interiorSide);
  return { wallAt, at: add(wallAt, normal, wall.thickness / 2 + 8) };
}

function electricalEndpoint(itemId: string): Point | undefined {
  const fixture = pocPlan.lights.find((item) => item.id === itemId);
  if (fixture) return fixture.at;
  const wallFixture = pocPlan.wallLights.find((item) => item.id === itemId);
  if (wallFixture) return wallLightSymbolPosition(wallFixture).at;
  const fan = pocPlan.exhaustFans.find((item) => item.id === itemId);
  if (fan) return fan.at;
  const device = pocPlan.switches.find((item) => item.id === itemId);
  return device ? switchSymbolPosition(device).at : undefined;
}

function LightingGroupMark({ item, selected, onSelect }: { item: Circuit; selected: boolean; onSelect: () => void }) {
  return (
    <g data-selectable aria-label={item.label} className={`lighting-group-symbol ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      {item.connections.map((connection, index) => {
        const from = electricalEndpoint(connection.fromId);
        const to = electricalEndpoint(connection.toId);
        if (!from || !to) return null;
        const points = [from, ...(connection.waypoints ?? []), to].map((point) => point.join(",")).join(" ");
        const connectsTwoControls =
          pocPlan.switches.some((switchItem) => switchItem.id === connection.fromId) &&
          pocPlan.switches.some((switchItem) => switchItem.id === connection.toId);
        return <polyline
          key={`${connection.fromId}-${connection.toId}-${index}`}
          className={`lighting-control-line ${connectsTwoControls ? "switch-pair-line" : ""}`}
          points={points}
        />;
      })}
    </g>
  );
}

function LightMark({ item, selected, onSelect }: { item: Light; selected: boolean; onSelect: () => void }) {
  if (item.fixture === "under-cabinet" && item.to) {
    return (
      <g data-selectable aria-label={item.label} className={`light-symbol under-cabinet ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
        <line className="light-linear-hit" x1={item.at[0]} y1={item.at[1]} x2={item.to[0]} y2={item.to[1]} />
        <line className="light-under-cabinet" x1={item.at[0]} y1={item.at[1]} x2={item.to[0]} y2={item.to[1]} />
      </g>
    );
  }
  return (
    <g data-selectable aria-label={item.label} className={`light-symbol ${item.fixture} ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <circle className="light-hit" cx={item.at[0]} cy={item.at[1]} r="9" />
      {item.fixture === "surface"
        ? <rect className="light-surface" x={item.at[0] - 7} y={item.at[1] - 3.5} width="14" height="7" rx="1.5" />
        : <circle className="light-ring" cx={item.at[0]} cy={item.at[1]} r="5" />}
      <path className="light-cross" d={`M ${item.at[0] - 3.4} ${item.at[1] - 3.4} L ${item.at[0] + 3.4} ${item.at[1] + 3.4} M ${item.at[0] + 3.4} ${item.at[1] - 3.4} L ${item.at[0] - 3.4} ${item.at[1] + 3.4}`} />
    </g>
  );
}

function WallLightMark({ item, selected, onSelect }: { item: WallLight; selected: boolean; onSelect: () => void }) {
  const { wallAt, at } = wallLightSymbolPosition(item);
  return (
    <g data-selectable aria-label={item.label} className={`wall-light-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <circle className="wall-light-hit" cx={at[0]} cy={at[1]} r="9" />
      <line className="wall-light-leader" x1={wallAt[0]} y1={wallAt[1]} x2={at[0]} y2={at[1]} />
      <path className="wall-light-sconce" d={`M ${at[0] - 5} ${at[1] + 2.5} Q ${at[0]} ${at[1] - 5.5} ${at[0] + 5} ${at[1] + 2.5} Z`} />
      <path className="wall-light-rays" d={`M ${at[0] - 4} ${at[1] + 5} L ${at[0] - 6} ${at[1] + 7} M ${at[0]} ${at[1] + 5.5} L ${at[0]} ${at[1] + 8} M ${at[0] + 4} ${at[1] + 5} L ${at[0] + 6} ${at[1] + 7}`} />
    </g>
  );
}

function ExhaustFanMark({ item, selected, onSelect }: { item: ExhaustFan; selected: boolean; onSelect: () => void }) {
  const [x, y] = item.at;
  return (
    <g data-selectable aria-label={item.label} className={`exhaust-fan-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <circle className="exhaust-fan-hit" cx={x} cy={y} r="10" />
      <rect className="exhaust-fan-housing" x={x - 6} y={y - 6} width="12" height="12" rx="1.5" />
      <circle className="exhaust-fan-ring" cx={x} cy={y} r="4" />
      <path className="exhaust-fan-blades" d={`M ${x} ${y - 1} L ${x + 3} ${y - 3} M ${x + 1} ${y} L ${x + 3} ${y + 3} M ${x} ${y + 1} L ${x - 3} ${y + 3} M ${x - 1} ${y} L ${x - 3} ${y - 3}`} />
      <circle className="exhaust-fan-hub" cx={x} cy={y} r="1.1" />
    </g>
  );
}

function SwitchMark({ item, selected, onSelect }: { item: Switch; selected: boolean; onSelect: () => void }) {
  const { wallAt, at } = switchSymbolPosition(item);
  const symbol = item.controlType === "dimmer" ? "D" : item.controlType === "timer" ? "T" : item.controlType === "humidity-sensor" ? "H" : "S";
  const combinationControl = item.controlIndex != null && item.controlCount != null;
  return (
    <g data-selectable aria-label={item.label} className={`switch-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <circle className="switch-hit" cx={at[0]} cy={at[1]} r={combinationControl ? 4.5 : 9} />
      <line className="receptacle-stem switch-leader" x1={wallAt[0]} y1={wallAt[1]} x2={at[0]} y2={at[1]} />
      <circle className="switch-ring" cx={at[0]} cy={at[1]} r={combinationControl ? 4 : 5} />
      <text className="switch-label" x={at[0]} y={at[1]}>{symbol}</text>
    </g>
  );
}

function ReceptacleMark({ item, selected, onSelect }: { item: Receptacle; selected: boolean; onSelect: () => void }) {
  const wall = getWall(item.wallId)!;
  const wallAt = pointAlong(wall.from, wall.to, item.offset);
  const normal = unitNormal(wall.from, wall.to, item.wallSide ?? wall.interiorSide);
  const symbolAt = add(wallAt, normal, wall.thickness / 2 + 5);
  return (
    <g data-selectable aria-label={item.label} className={`receptacle-symbol ${item.receptacleType} ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <circle className="receptacle-hit" cx={symbolAt[0]} cy={symbolAt[1]} r="9" />
      <line className="receptacle-stem" x1={wallAt[0]} y1={wallAt[1]} x2={symbolAt[0]} y2={symbolAt[1]} />
      <circle className="receptacle-ring" cx={symbolAt[0]} cy={symbolAt[1]} r="4" />
      <line className="receptacle-slot" x1={symbolAt[0] - 1.3} y1={symbolAt[1] - 2} x2={symbolAt[0] - 1.3} y2={symbolAt[1] + 2} />
      <line className="receptacle-slot" x1={symbolAt[0] + 1.3} y1={symbolAt[1] - 2} x2={symbolAt[0] + 1.3} y2={symbolAt[1] + 2} />
      {item.receptacleType === "gfci" && <text className="receptacle-label" x={symbolAt[0]} y={symbolAt[1] - 6}>GFCI</text>}
    </g>
  );
}

function CeilingReceptacleMark({ item, selected, onSelect }: { item: CeilingReceptacle; selected: boolean; onSelect: () => void }) {
  return (
    <g data-selectable aria-label={item.label} className={`ceiling-receptacle-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <circle className="ceiling-receptacle-hit" cx={item.at[0]} cy={item.at[1]} r="9" />
      <circle className="ceiling-receptacle-ring" cx={item.at[0]} cy={item.at[1]} r="5" />
      <line className="ceiling-receptacle-slot" x1={item.at[0] - 1.5} y1={item.at[1] - 2.2} x2={item.at[0] - 1.5} y2={item.at[1] + 2.2} />
      <line className="ceiling-receptacle-slot" x1={item.at[0] + 1.5} y1={item.at[1] - 2.2} x2={item.at[0] + 1.5} y2={item.at[1] + 2.2} />
    </g>
  );
}

function RadonPipeMark({ item, selected, onSelect }: { item: RadonPipe; selected: boolean; onSelect: () => void }) {
  const points = [item.from, ...item.waypoints, item.to];
  const pointsText = points.map((point) => point.join(",")).join(" ");
  const southRunStart = item.waypoints[1] ?? item.from;
  const southRunEnd = item.waypoints[2] ?? item.to;
  const labelAt = pointAlong(southRunStart, southRunEnd, distance(southRunStart, southRunEnd) / 2);
  const westRise = item.waypoints[1] ?? item.from;
  return (
    <g data-selectable aria-label={item.label} className={`radon-pipe-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polyline className="radon-pipe-hit" points={pointsText} />
      <polyline className="radon-pipe-outline" points={pointsText} strokeWidth={item.diameter + 1.6} />
      <polyline className="radon-pipe-body" points={pointsText} strokeWidth={item.diameter} />
      <polyline className="radon-pipe-centerline" points={pointsText} />
      <circle className="radon-pipe-floor" cx={item.from[0]} cy={item.from[1]} r={item.diameter / 2} />
      <circle className="radon-pipe-rise" cx={westRise[0]} cy={westRise[1]} r={item.diameter / 2} />
      <circle className="radon-pipe-exit" cx={item.to[0]} cy={item.to[1]} r="3.5" />
      <text className="radon-pipe-label" x={labelAt[0]} y={labelAt[1] - 4}>RADON ↑</text>
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

function PlumbingEquipmentMark({ item, selected, onSelect }: { item: PlumbingEquipment; selected: boolean; onSelect: () => void }) {
  const radius = item.diameter / 2;
  return (
    <g data-selectable aria-label={item.label} className={`plumbing-equipment-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <circle className="plumbing-equipment-hit" cx={item.center[0]} cy={item.center[1]} r={radius + 5} />
      <circle className="plumbing-equipment-footprint" cx={item.center[0]} cy={item.center[1]} r={radius} />
      <path className="plumbing-equipment-tank" d={`M ${item.center[0] - radius * 0.72} ${item.center[1] - radius * 0.55} A ${radius * 0.88} ${radius * 0.55} 0 0 0 ${item.center[0] + radius * 0.72} ${item.center[1] - radius * 0.55}`} />
      <text className="plumbing-equipment-label" x={item.center[0]} y={item.center[1] + 2}>WH</text>
    </g>
  );
}

function gasLinePoints(item: GasLine): readonly Point[] {
  return [item.from, ...(item.waypoints ?? []), item.to];
}

function gasLineLength(item: GasLine) {
  const points = gasLinePoints(item);
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

function gasLineMidpoint(item: GasLine): Point {
  const points = gasLinePoints(item);
  const midpointOffset = gasLineLength(item) / 2;
  let traversed = 0;
  for (let index = 1; index < points.length; index += 1) {
    const segmentLength = distance(points[index - 1], points[index]);
    if (traversed + segmentLength >= midpointOffset) return pointAlong(points[index - 1], points[index], midpointOffset - traversed);
    traversed += segmentLength;
  }
  return item.to;
}

function GasEndpointMark({ at, endpoint }: { at: Point; endpoint?: GasEndpoint }) {
  if (!endpoint || endpoint === "none") return null;
  const label = endpoint === "rise" ? "↑" : endpoint === "drop" ? "↓" : endpoint === "service-entry" ? "S" : endpoint === "wall-termination" ? "CAP" : "APPL";
  return <g className={`gas-endpoint ${endpoint}`}><circle cx={at[0]} cy={at[1]} r="3.3" /><text x={at[0]} y={at[1] + 1.35}>{label}</text></g>;
}

function GasLineMark({ item, selected, onSelect }: { item: GasLine; selected: boolean; onSelect: () => void }) {
  const points = gasLinePoints(item);
  const pointsText = points.map((point) => point.join(",")).join(" ");
  const midpoint = gasLineMidpoint(item);
  return (
    <g data-selectable aria-label={item.label} className={`gas-line-symbol ${item.status} ${selected ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
      <polyline className="gas-line-hit" points={pointsText} />
      <polyline className="gas-line-casing" points={pointsText} />
      <polyline className="gas-line-centerline" points={pointsText} />
      <text className="gas-line-label" x={midpoint[0]} y={midpoint[1] - 3}>GAS</text>
      <GasEndpointMark at={item.from} endpoint={item.fromEndpoint} />
      <GasEndpointMark at={item.to} endpoint={item.toEndpoint} />
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

function DoorMark({ item, selected, highlightAddition = false, demolition = false, onSelect }: {
  item: Door;
  selected: boolean;
  highlightAddition?: boolean;
  demolition?: boolean;
  onSelect: () => void;
}) {
  const wall = getWall(item.wallId)!;
  const start = pointAlong(wall.from, wall.to, item.offset);
  const end = pointAlong(wall.from, wall.to, item.offset + item.width);
  const hinge = item.hinge === "start" ? start : end;
  const closed = item.hinge === "start" ? end : start;
  let normal = unitNormal(wall.from, wall.to, wall.interiorSide);
  if (item.swing === "outward") normal = [-normal[0], -normal[1]];
  const open = add(hinge, normal, item.width);
  const cross = (closed[0] - hinge[0]) * (open[1] - hinge[1]) - (closed[1] - hinge[1]) * (open[0] - hinge[0]);
  return (
    <g
      data-selectable
      aria-label={item.label}
      className={`door-symbol ${item.status} ${highlightAddition ? "scope-addition" : ""} ${demolition ? "scope-demolition" : ""} ${selected ? "selected" : ""}`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      <line className="door-hit" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />
      <line className="door-leaf" x1={hinge[0]} y1={hinge[1]} x2={open[0]} y2={open[1]} />
      <path className="door-swing" d={`M ${closed[0]} ${closed[1]} A ${item.width} ${item.width} 0 0 ${cross > 0 ? 1 : 0} ${open[0]} ${open[1]}`} />
    </g>
  );
}

function SoffitMark({ item, selected, highlightAddition, onSelect }: {
  item: Soffit;
  selected: boolean;
  highlightAddition: boolean;
  onSelect: () => void;
}) {
  return (
    <g
      data-selectable
      aria-label={item.label}
      className={`soffit-symbol ${highlightAddition ? "scope-addition" : ""} ${selected ? "selected" : ""}`}
      onClick={(event) => { event.stopPropagation(); onSelect(); }}
    >
      <polygon className="soffit-hit" points={item.polygon.map((point) => point.join(",")).join(" ")} />
      <polygon className="soffit-outline" points={item.polygon.map((point) => point.join(",")).join(" ")} />
      <text className="soffit-label" x={(item.polygon[0][0] + item.polygon[2][0]) / 2} y={(item.polygon[0][1] + item.polygon[2][1]) / 2}>SOFFIT · BOTTOM TBD</text>
    </g>
  );
}

function Inspector({ item, openingMeasurement, onMeasurementSideChange }: {
  item?: SelectablePlanItem;
  openingMeasurement?: OpeningMeasurement;
  onMeasurementSideChange: (side: WallSide) => void;
}) {
  if (!item) return <div className="inspector-empty"><span className="eyebrow">Object inspector</span><p>Select a wall, opening, equipment item, space, or dimension to inspect its plan data.</p></div>;
  const scopeLabel = item.status === "existing" ? "Retain" : item.status === "proposed" ? "Add" : "Demolish";
  const rows: Array<[string, string]> = [["ID", item.id], ["Type", item.kind], ["Construction scope", scopeLabel], ["Confidence", item.confidence]];
  const measuredValue = (value: number) => `${openingMeasurement?.confidence === "exact" ? "" : "≈ "}${formatInches(value)}`;
  if (openingMeasurement) {
    const beforeLabel = `${openingMeasurement.beforeDirection[0].toUpperCase()}${openingMeasurement.beforeDirection.slice(1)} clear wall`;
    const afterLabel = `${openingMeasurement.afterDirection[0].toUpperCase()}${openingMeasurement.afterDirection.slice(1)} clear wall`;
    rows.push(
      [beforeLabel, measuredValue(openingMeasurement.beforeDistance)],
      [openingMeasurement.combined ? "Combined opening" : "Opening width", measuredValue(openingMeasurement.openingWidth)],
      [afterLabel, measuredValue(openingMeasurement.afterDistance)],
    );
  } else if ("width" in item) rows.push(["Width", item.kind === "joist" ? `≈ ${item.width}″` : item.kind === "wall-cabinet" || item.kind === "cabinet-run" || item.kind === "bathroom-fixture" ? `≈ ${formatInches(item.width)}` : formatInches(item.width)]);
  if ("heightAboveFloor" in item && item.heightAboveFloor != null) rows.push(["Height above floor", formatInches(item.heightAboveFloor)]);
  if (item.kind === "wall") rows.push(["Length", formatInches(distance(item.from, item.to))], ["Thickness", `${item.thickness}″`]);
  if (item.kind === "door") rows.push(["Door height", item.height == null ? "Unknown — verify on site" : formatInches(item.height)]);
  if (item.kind === "soffit") rows.push(
    ["Plan length", formatInches(distance(item.polygon[0], item.polygon[1]))],
    ["Plan width", formatInches(distance(item.polygon[1], item.polygon[2]))],
    ["Bottom elevation", item.bottomAboveFloor == null ? "Unknown — verify on site" : formatInches(item.bottomAboveFloor)],
  );
  if (item.kind === "light") rows.push(
    ["Fixture", item.fixture === "under-cabinet" ? "Under-cabinet linear" : item.fixture === "surface" ? "Surface-mounted" : "Recessed"],
    ["Position", `x ${item.at[0]}″ · y ${item.at[1]}″`],
  );
  if (item.kind === "light" && item.fixture === "under-cabinet" && item.to) rows.push(
    ["End position", `x ${item.to[0]}″ · y ${item.to[1]}″`],
    ["Run length", formatInches(distance(item.at, item.to))],
  );
  if (item.kind === "wall-light") rows.push(
    ["Fixture", "Wall-mounted sconce"],
    ["Wall", getWall(item.wallId)?.label ?? item.wallId],
    ["Offset", formatInches(item.offset)],
    ["Wall face", item.wallSide ?? getWall(item.wallId)?.interiorSide ?? "Unknown"],
  );
  if (item.kind === "exhaust-fan") rows.push(
    ["Equipment", "Ceiling exhaust fan"],
    ["Position", `x ${item.at[0]}″ · y ${item.at[1]}″`],
    ["HVAC duct", item.hvacDuctId],
  );
  if (item.kind === "switch") rows.push(
    ["Control", item.controlType === "dimmer" ? "Dimmer" : item.controlType === "timer" ? "Timer" : item.controlType === "humidity-sensor" ? "Humidity sensor" : "Standard switch"],
    ["Wall offset", formatInches(item.offset)],
    ["Wall face", item.wallSide ?? getWall(item.wallId)?.interiorSide ?? "Unknown"],
  );
  if (item.kind === "switch" && item.gangIndex != null && item.gangCount != null) rows.push(["Gang position", `${item.gangIndex} of ${item.gangCount}`]);
  if (item.kind === "switch" && item.controlIndex != null && item.controlCount != null) rows.push(["Control within gang", `${item.controlIndex} of ${item.controlCount}`]);
  if (item.kind === "receptacle") rows.push(
    ["Receptacle", item.receptacleType === "gfci" ? "GFCI device" : "Standard duplex"],
    ["Wall offset", formatInches(item.offset)],
    ["Wall face", item.wallSide ?? getWall(item.wallId)?.interiorSide ?? "Unknown"],
  );
  if (item.kind === "ceiling-receptacle") rows.push(
    ["Receptacle", "Standard ceiling-mounted duplex"],
    ["Position", `x ${item.at[0]}″ · y ${item.at[1]}″`],
    ["Mounted in", pocPlan.soffits.find((soffit) => soffit.id === item.soffitId)?.label ?? item.soffitId],
  );
  if (item.kind === "wall-cabinet") {
    const referenceWall = getWall(item.referenceWallId);
    rows.push(
      ["Cabinet", item.cabinetType === "breaker-panel" ? "Breaker panel" : "Low-voltage networking"],
      [`Near edge from ${referenceWall?.label ?? item.referenceWallId}`, `≈ ${formatInches(item.offset)}`],
      ["Bottom", `≈ ${formatInches(item.bottomAboveFloor)} above floor`],
      ["Height", `≈ ${formatInches(item.height)}`],
      ["Top", `≈ ${formatInches(item.bottomAboveFloor + item.height)} above floor`],
    );
  }
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
  if (item.kind === "plumbing-equipment") {
    rows.push(
      ["Equipment", "Cylindrical water heater"],
      ["Plan diameter", `≈ ${formatInches(item.diameter)}`],
      ["Equipment height", `≈ ${formatInches(item.height)}`],
      ["Plan center", `x ${item.center[0]}″ · y ${item.center[1]}″`],
    );
  }
  if (item.kind === "bathroom-fixture") {
    const fixture = item.fixtureType === "tub-shower" ? "Alcove tub/shower" : item.fixtureType === "toilet" ? "Toilet" : "Composite vanity with sink";
    rows.push(
      ["Fixture", fixture],
      ["Footprint", `≈ ${formatInches(item.width)} × ${formatInches(item.depth)}`],
      ["Plan center", `x ${item.center[0]}″ · y ${item.center[1]}″`],
      ["Rotation", `${item.rotation}°`],
      ["Mapped drain", item.drainId],
    );
    if (item.sinkCenter) rows.push(["Sink center", `x ${item.sinkCenter[0]}″ · y ${item.sinkCenter[1]}″`]);
  }
  if (item.kind === "gas-line") {
    rows.push(
      ["Service", "Natural gas"],
      ["Plan run", `≈ ${formatInches(gasLineLength(item))}`],
      ["Placement", item.placement.replaceAll("-", " ")],
    );
    if (item.heightAboveFloor != null) rows.push(["Height", `≈ ${formatInches(item.heightAboveFloor)} above floor`]);
    if (item.offsetBelowJoists != null) rows.push(["Below joists", `≈ ${formatInches(item.offsetBelowJoists)}`]);
    if (item.fromEndpoint && item.fromEndpoint !== "none") rows.push(["Start condition", item.fromEndpoint.replaceAll("-", " ")]);
    if (item.toEndpoint && item.toEndpoint !== "none") rows.push(["End condition", item.toEndpoint.replaceAll("-", " ")]);
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
  if (item.kind === "radon-pipe") {
    rows.push(
      ["Service", "Radon mitigation"],
      ["Diameter", `≈ ${formatInches(item.diameter)}`],
      ["Initial vertical rise", `≈ ${formatInches(item.verticalRiseAboveFloor)} above floor`],
      ["Diagonal ends", `≈ ${formatInches(item.diagonalEndAboveFloor)} above floor`],
      ["West run bottom", `≈ ${formatInches(item.westRunBottomAboveFloor)} above floor`],
      ["Under-joist clearance", `≈ ${formatInches(item.offsetBelowJoists)}`],
      ["Exterior turn", item.exteriorTurn],
    );
  }
  if (item.kind === "cabinet-run") rows.push(
    ["Lower cabinets", `≈ ${formatInches(item.width)} wide × ${formatInches(item.baseDepth)} deep`],
    ["Countertop", `≈ ${formatInches(item.countertopWidth)} wide × ${formatInches(item.countertopDepth)} deep`],
    ["Counter height", `≈ ${formatInches(item.countertopHeight)} above floor`],
    ["Upper cabinets", `≈ ${formatInches(item.width)} wide × ${formatInches(item.upperDepth)} deep`],
    ["Upper cabinet bottom", `≈ ${formatInches(item.upperBottomAboveFloor)} above floor`],
    ["Upper cabinet top", `≈ ${formatInches(item.upperBottomAboveFloor + item.upperHeight)} above floor`],
  );
  if (item.kind === "hvac-return-grille") {
    rows.push(
      ["Airflow", item.airflowRole],
      ["Terminal", "Ceiling return grille"],
      ["Source", item.sourceReturnId],
      ["Face", `≈ ${formatInches(item.width)} × ${formatInches(item.length)}`],
      ["Plan center", `x ${item.center[0]}″ · y ${item.center[1]}″`],
      ["Rotation", `${item.rotation}°`],
      ["Review", "HVAC approval required"],
    );
  }
  if (item.kind === "hvac-wall-cavity-return") {
    rows.push(
      ["Airflow", item.airflowRole],
      ["Construction", "Two wall-cavity chases"],
      ["Source", item.sourceDuctId],
      ["Wall", item.wallId],
      ["Nominal modules", item.cavitySpans.map(([from, to]) => `${formatInches(from)}–${formatInches(to)}`).join(" · ")],
      ["Preserved studs", item.preservedStudOffsets.map(formatInches).join(" · ")],
      ["Chase span", `${formatInches(item.chaseBottomAboveFloor)}–${formatInches(item.chaseTopAboveFloor)} above floor`],
      ["Grille face", `≈ ${formatInches(item.grilleWidth)} × ${formatInches(item.grilleHeight)}`],
      ["Grille bottom", `≈ ${formatInches(item.grilleBottomAboveFloor)} above floor`],
      ["Grille side", item.grilleSide],
      ["Upper fitting", "Conceptual · size TBD"],
    );
  }
  if (item.kind === "hvac-wall-ducted-return") {
    rows.push(
      ["Airflow", item.airflowRole],
      ["Construction", "Dedicated sealed sheet-metal wall drop"],
      ["Source", item.sourceDuctId],
      ["Wall", item.wallId],
      ["Planned wall module", `${formatInches(item.wallSpan[0])}–${formatInches(item.wallSpan[1])}`],
      ["Chase span", `${formatInches(item.chaseBottomAboveFloor)}–${formatInches(item.chaseTopAboveFloor)} above floor`],
      ["Grille face", `≈ ${formatInches(item.grilleWidth)} × ${formatInches(item.grilleHeight)}`],
      ["Grille bottom", `≈ ${formatInches(item.grilleBottomAboveFloor)} above floor`],
      ["Grille side", item.grilleSide],
      ["Upper fitting", "Conceptual · size TBD"],
      ["Review", "HVAC approval required"],
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
  if (item.kind === "circuit") rows.push(
    ["Diagram", item.layer === "ventilation-control" ? "Fan control relationship — not cable routing" : "Lighting control group — not cable routing"],
    ["Connections", String(item.connections.length)],
  );
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

function LayerToggle({ label, detail, checked, onChange, color }: { label: string; detail: string; checked: boolean; onChange: () => void; color: "amber" | "slate" | "blue" | "cyan" | "gas" | "green" | "plum" }) {
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
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({ construction: false, constructionDemolition: true, constructionAdditions: true, soffits: false, builtIns: false, builtInCabinetry: true, builtInBathroomFixtures: true, hvac: false, hvacSupply: true, hvacReturn: true, hvacVenting: true, hvacRefrigerant: true, gas: false, radon: false, plumbing: false, plumbingShutoffs: true, plumbingDrains: true, plumbingEquipment: true, electrical: false, electricalLighting: true, electricalReceptacles: true, electricalPanels: true, electricalLowVoltage: true, joists: false, dimensions: false });
  const [selectedId, setSelectedId] = useState<string>();
  const [measurementSide, setMeasurementSide] = useState<WallSide>();
  const [view, setView] = useState(DEFAULT_VIEW);
  const drag = useRef<{ x: number; y: number; viewX: number; viewY: number; moved: boolean }>();
  const issues = useMemo(() => validatePlan(pocPlan), []);
  const items = useMemo(() => allPlanItems(pocPlan), []);
  const additionWalls = useMemo(() => wallsToAdd(pocPlan), []);
  const demolitionCount = useMemo(() => allPlanItems(pocPlan).filter((item) => item.status === "remove").length, []);
  const returnItemCount = pocPlan.hvacDucts.filter((item) => item.airflowRole === "return").length + pocPlan.hvacJoistReturns.length + pocPlan.hvacReturnGrilles.length + pocPlan.hvacWallCavityReturns.length + pocPlan.hvacWallDuctedReturns.length + pocPlan.hvacDuctTransitions.filter((item) => item.airflowRole === "return").length;
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
          <div className="section-heading"><h2 id="layers-title">Layers</h2><span>10 controls</span></div>
          <LayerToggle label="Construction scope" detail={`${demolitionCount} demo · ${additionWalls.length} wall runs to add`} checked={toggles.construction} onChange={() => toggle("construction")} color="amber" />
          <label className="sub-toggle"><input type="checkbox" checked={toggles.constructionDemolition} disabled={!toggles.construction} onChange={() => toggle("constructionDemolition")} /> Demolition · {demolitionCount} objects</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.constructionAdditions} disabled={!toggles.construction} onChange={() => toggle("constructionAdditions")} /> Additions · {additionWalls.length} wall runs</label>
          <LayerToggle label="Soffit" detail={`${pocPlan.soffits.length} proposed enclosure`} checked={toggles.soffits} onChange={() => toggle("soffits")} color="slate" />
          <LayerToggle label="Built-ins & fixtures" detail={`${pocPlan.cabinetRuns.length} cabinet run · ${pocPlan.bathroomFixtures.length} bathroom fixtures`} checked={toggles.builtIns} onChange={() => toggle("builtIns")} color="plum" />
          <label className="sub-toggle"><input type="checkbox" checked={toggles.builtInCabinetry} disabled={!toggles.builtIns} onChange={() => toggle("builtInCabinetry")} /> Cabinetry · {pocPlan.cabinetRuns.length} conceptual run</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.builtInBathroomFixtures} disabled={!toggles.builtIns} onChange={() => toggle("builtInBathroomFixtures")} /> Bathroom fixtures · {pocPlan.bathroomFixtures.length} proposed</label>
          <LayerToggle label="HVAC" detail={`${pocPlan.hvacEquipment.length} equipment · ${pocPlan.hvacDucts.length + pocPlan.hvacJoistReturns.length + pocPlan.hvacReturnGrilles.length + pocPlan.hvacWallCavityReturns.length + pocPlan.hvacWallDuctedReturns.length + pocPlan.hvacDuctTransitions.length + pocPlan.hvacRefrigerantLines.length} runs/fittings`} checked={toggles.hvac} onChange={() => toggle("hvac")} color="blue" />
          <label className="sub-toggle"><input type="checkbox" checked={toggles.hvacSupply} disabled={!toggles.hvac} onChange={() => toggle("hvacSupply")} /> Supply · {supplyItemCount} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.hvacReturn} disabled={!toggles.hvac} onChange={() => toggle("hvacReturn")} /> Return · {returnItemCount} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.hvacVenting} disabled={!toggles.hvac} onChange={() => toggle("hvacVenting")} /> Venting · {ventingItemCount} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.hvacRefrigerant} disabled={!toggles.hvac} onChange={() => toggle("hvacRefrigerant")} /> Refrigerant · {pocPlan.hvacRefrigerantLines.length} mapped</label>
          <LayerToggle label="Natural gas" detail={`${pocPlan.gasLines.length} approximate runs`} checked={toggles.gas} onChange={() => toggle("gas")} color="gas" />
          <LayerToggle label="Radon" detail={`${pocPlan.radonPipes.length} approximate existing route`} checked={toggles.radon} onChange={() => toggle("radon")} color="green" />
          <LayerToggle label="Plumbing" detail={`${pocPlan.waterValves.length + pocPlan.plumbingDrains.length + pocPlan.plumbingEquipment.length} mapped items`} checked={toggles.plumbing} onChange={() => toggle("plumbing")} color="cyan" />
          <label className="sub-toggle"><input type="checkbox" checked={toggles.plumbingShutoffs} disabled={!toggles.plumbing} onChange={() => toggle("plumbingShutoffs")} /> Shutoffs · {pocPlan.waterValves.length} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.plumbingDrains} disabled={!toggles.plumbing} onChange={() => toggle("plumbingDrains")} /> Drains · {pocPlan.plumbingDrains.length} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.plumbingEquipment} disabled={!toggles.plumbing} onChange={() => toggle("plumbingEquipment")} /> Equipment · {pocPlan.plumbingEquipment.length} mapped</label>
          <LayerToggle label="Electrical" detail={`${pocPlan.lights.length + pocPlan.wallLights.length} lights · ${pocPlan.exhaustFans.length} fan · ${pocPlan.receptacles.length + pocPlan.ceilingReceptacles.length} receptacles · ${pocPlan.wallCabinets.length} cabinets`} checked={toggles.electrical} onChange={() => toggle("electrical")} color="amber" />
          <label className="sub-toggle"><input type="checkbox" checked={toggles.electricalLighting} disabled={!toggles.electrical} onChange={() => toggle("electricalLighting")} /> Lighting &amp; fans · {pocPlan.lights.length + pocPlan.wallLights.length} lights · {pocPlan.exhaustFans.length} fan</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.electricalReceptacles} disabled={!toggles.electrical} onChange={() => toggle("electricalReceptacles")} /> Receptacles · {pocPlan.receptacles.length + pocPlan.ceilingReceptacles.length} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.electricalPanels} disabled={!toggles.electrical} onChange={() => toggle("electricalPanels")} /> Panels · {pocPlan.wallCabinets.filter((item) => item.cabinetType === "breaker-panel").length} mapped</label>
          <label className="sub-toggle"><input type="checkbox" checked={toggles.electricalLowVoltage} disabled={!toggles.electrical} onChange={() => toggle("electricalLowVoltage")} /> Low voltage · {pocPlan.wallCabinets.filter((item) => item.cabinetType === "networking").length} mapped</label>
          <LayerToggle label="Ceiling joists" detail={`${pocPlan.joists.length} joists · 3 measured groups`} checked={toggles.joists} onChange={() => toggle("joists")} color="slate" />
          <LayerToggle label="Dimensions" detail="Overall footprint" checked={toggles.dimensions} onChange={() => toggle("dimensions")} color="slate" />
        </section>
        {toggles.construction && toggles.constructionAdditions && <section className="panel-section"><FramingSummary /></section>}
        <section className="panel-section legend" aria-labelledby="legend-title">
          <div className="section-heading"><h2 id="legend-title">Legend</h2><span>Planning symbols</span></div>
          <div><i className="legend-north">←</i> North</div><div><i className="legend-stairs">↑</i> Stairs up</div><div><i className="legend-window" /> Window</div><div><i className="legend-door" /> Door swing</div><div><i className="legend-sliding-door" /> Bypass doors</div>{toggles.soffits && <div><i className="legend-soffit" /> Overhead soffit</div>}{toggles.construction && toggles.constructionDemolition && <div><i className="legend-demolition" /> Demolish</div>}{toggles.construction && toggles.constructionAdditions && <div><i className="legend-addition" /> Add</div>}{toggles.hvac && <div><i className="legend-hvac-equipment">F</i> HVAC equipment</div>}{toggles.hvac && toggles.hvacSupply && <div><i className="legend-supply-duct" /> Supply duct</div>}{toggles.hvac && toggles.hvacReturn && <div><i className="legend-return-duct" /> Return duct</div>}{toggles.hvac && toggles.hvacReturn && <div><i className="legend-panned-return" /> Panned joist return</div>}{toggles.hvac && toggles.hvacReturn && <div><i className="legend-return-grille" /> Return grille</div>}{toggles.hvac && toggles.hvacReturn && <div><i className="legend-wall-return" /> Wall return</div>}{toggles.hvac && toggles.hvacVenting && <div><i className="legend-exhaust-duct" /> HVAC vent</div>}{toggles.hvac && toggles.hvacRefrigerant && <div><i className="legend-refrigerant-line" /> Refrigerant</div>}{toggles.gas && <div><i className="legend-gas-line" /> Natural gas</div>}{toggles.radon && <div><i className="legend-radon-pipe" /> Radon pipe</div>}{toggles.joists && <div><i className="legend-joist" /> Ceiling joist</div>}{toggles.plumbing && toggles.plumbingShutoffs && <div><i className="legend-water-valve">×</i> Water shutoff</div>}{toggles.plumbing && toggles.plumbingDrains && <div><i className="legend-plumbing-drain" /> Drain rough-in</div>}{toggles.plumbing && toggles.plumbingEquipment && <div><i className="legend-water-heater">WH</i> Water heater</div>}{toggles.electrical && toggles.electricalLighting && <div><i className="legend-light">×</i> Recessed light + schematic control</div>}{toggles.electrical && toggles.electricalLighting && <div><i className="legend-surface-light">×</i> Surface-mounted light</div>}{toggles.electrical && toggles.electricalLighting && <div><i className="legend-wall-light">⌂</i> Wall-mounted light</div>}{toggles.electrical && toggles.electricalLighting && <div><i className="legend-under-cabinet" /> Under-cabinet light</div>}{toggles.electrical && toggles.electricalLighting && <div><i className="legend-dimmer">D</i> Dimmer control</div>}{toggles.electrical && toggles.electricalLighting && <div><i className="legend-exhaust-fan">F</i> Exhaust fan + control</div>}{toggles.electrical && toggles.electricalReceptacles && <div><i className="legend-receptacle">Ⅱ</i> Wall duplex receptacle</div>}{toggles.electrical && toggles.electricalReceptacles && <div><i className="legend-ceiling-receptacle">Ⅱ</i> Ceiling duplex receptacle</div>}{toggles.electrical && toggles.electricalPanels && <div><i className="legend-electrical-panel">P</i> Breaker panel</div>}{toggles.electrical && toggles.electricalLowVoltage && <div><i className="legend-network-cabinet">NET</i> Networking</div>}
          {toggles.builtIns && toggles.builtInCabinetry && <div><i className="legend-cabinetry" /> Cabinets + counter</div>}
          {toggles.builtIns && toggles.builtInBathroomFixtures && <div><i className="legend-bathroom-fixture" /> Bathroom fixture footprint</div>}
        </section>
        <section className="panel-section inspector" aria-live="polite"><Inspector item={selected} openingMeasurement={selectedOpeningMeasurement} onMeasurementSideChange={setMeasurementSide} /></section>
        <div className="panel-footer"><button type="button" onClick={() => window.print()} className="print-button">Print current view</button><p>{pocPlan.warning}</p></div>
      </aside>

      <section className="drawing-area">
        <header className="drawing-header"><div><span className="eyebrow">Plan 01 · Final layout · Approximate</span><h2>Basement footprint</h2></div><div className="view-controls print-hide" aria-label="View controls"><button type="button" onClick={() => zoom(0.82)} aria-label="Zoom in">+</button><button type="button" onClick={() => zoom(1.22)} aria-label="Zoom out">−</button><button type="button" onClick={() => setView(DEFAULT_VIEW)}>Fit</button></div></header>
        <div className="plan-frame">
          <svg className="floor-plan" viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="img" aria-labelledby="plan-title plan-description" onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { drag.current = undefined; }}>
            <title id="plan-title">{pocPlan.title}</title><desc id="plan-description">Approximate final basement layout with optional construction-scope and system overlays.</desc>
            <defs><pattern id="panned-return" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgb(85 121 133 / 12%)" /><line x1="0" y1="0" x2="0" y2="6" stroke="#557985" strokeWidth="0.7" /></pattern></defs>
            <rect className="pan-surface" x="-1000" y="-1000" width="2000" height="2000" />
            <g className="north-arrow" aria-label="North points left" transform="translate(550 550)">
              <text x="-20" y="-10">N</text>
              <line x1="0" y1="0" x2="-42" y2="0" />
              <path d="M -42 0 L -32 -6 M -42 0 L -32 6" />
            </g>
            {pocPlan.spaces.map((item) => <g key={item.id} data-selectable onClick={(event) => { event.stopPropagation(); selectItem(item.id); }} className={selectedId === item.id ? "selected" : ""}><polygon className="space-fill" points={item.polygon.map((point) => point.join(",")).join(" ")} /></g>)}
            {toggles.soffits && <g className="soffit-layer">{pocPlan.soffits.map((item) => <SoffitMark key={item.id} item={item} selected={selectedId === item.id} highlightAddition={toggles.construction && toggles.constructionAdditions && item.status === "proposed"} onSelect={() => selectItem(item.id)} />)}</g>}
            {toggles.joists && <g className="joist-layer">{pocPlan.joists.map((item) => <JoistMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}</g>}
            <g className="space-label-layer">{pocPlan.spaces.map((item) => <g key={item.id}><text className="space-label" x={item.labelAt[0]} y={item.labelAt[1] - 3}>{item.label}</text><text className="space-area" x={item.labelAt[0]} y={item.labelAt[1] + 7}>{item.confidence}</text></g>)}</g>
            {pocPlan.walls.filter((item) => item.status !== "remove").map((item) => <g key={item.id} data-selectable className={selectedId === item.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="wall-hit" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} />{wallSegments(item).map(([from, to]) => { const start = pointAlong(item.from, item.to, from); const end = pointAlong(item.from, item.to, to); return <line key={`${from}-${to}`} className="wall-line" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />; })}</g>)}
            {toggles.construction && toggles.constructionAdditions && <g className="construction-additions-layer">{additionWalls.map((item) => <g key={item.id} data-selectable className={selectedId === item.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}>{wallSegments(item).map(([from, to]) => { const start = pointAlong(item.from, item.to, from); const end = pointAlong(item.from, item.to, to); return <line key={`${from}-${to}`} className="scope-wall addition" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />; })}</g>)}</g>}
            {toggles.construction && toggles.constructionDemolition && <g className="construction-demolition-layer">{pocPlan.walls.filter((item) => item.status === "remove").map((item) => <g key={item.id} data-selectable className={selectedId === item.id ? "selected" : ""} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="wall-hit" x1={item.from[0]} y1={item.from[1]} x2={item.to[0]} y2={item.to[1]} />{wallSegments(item).map(([from, to]) => { const start = pointAlong(item.from, item.to, from); const end = pointAlong(item.from, item.to, to); return <line key={`${from}-${to}`} className="scope-wall demolition" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} />; })}</g>)}</g>}
            {toggles.builtIns && toggles.builtInCabinetry && <g className="cabinetry-layer">{pocPlan.cabinetRuns.map((item) => <CabinetRunMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}</g>}
            {toggles.builtIns && toggles.builtInBathroomFixtures && <g className="bathroom-fixtures-layer">{pocPlan.bathroomFixtures.map((item) => <BathroomFixtureMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}</g>}
            {toggles.hvac && <g className="hvac-layer">
              {toggles.hvacReturn && pocPlan.hvacJoistReturns.map((item) => <HvacJoistReturnMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {pocPlan.hvacDuctTransitions.filter((item) => item.airflowRole === "unknown" || (item.airflowRole === "return" ? toggles.hvacReturn : item.airflowRole === "exhaust" ? toggles.hvacVenting : toggles.hvacSupply)).map((item) => <HvacDuctTransitionMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {pocPlan.hvacDucts.filter((item) => item.airflowRole === "unknown" || (item.airflowRole === "return" ? toggles.hvacReturn : item.airflowRole === "exhaust" ? toggles.hvacVenting : toggles.hvacSupply)).map((item) => <HvacDuctMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.hvacReturn && pocPlan.hvacWallCavityReturns.map((item) => <HvacWallCavityReturnMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.hvacReturn && pocPlan.hvacWallDuctedReturns.map((item) => <HvacWallDuctedReturnMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.hvacReturn && pocPlan.hvacReturnGrilles.map((item) => <HvacReturnGrilleMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.hvacRefrigerant && pocPlan.hvacRefrigerantLines.map((item) => <HvacRefrigerantLineMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {pocPlan.hvacEquipment.map((item) => <HvacEquipmentMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
            </g>}
            {toggles.gas && <g className="gas-layer">{pocPlan.gasLines.map((item) => <GasLineMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}</g>}
            {toggles.radon && <g className="radon-layer">{pocPlan.radonPipes.map((item) => <RadonPipeMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}</g>}
            {pocPlan.windows.filter((item) => item.status !== "remove" && getWall(item.wallId)?.status !== "remove").map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const normal = unitNormal(wall.from, wall.to, wall.interiorSide); return <g key={item.id} data-selectable className={`window-symbol ${toggles.construction && toggles.constructionAdditions && item.status === "proposed" ? "scope-addition" : ""} ${selectedOpeningIds.has(item.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line x1={add(start, normal, -2)[0]} y1={add(start, normal, -2)[1]} x2={add(end, normal, -2)[0]} y2={add(end, normal, -2)[1]} /><line x1={add(start, normal, 2)[0]} y1={add(start, normal, 2)[1]} x2={add(end, normal, 2)[0]} y2={add(end, normal, 2)[1]} /><line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /></g>; })}
            {pocPlan.doors.filter((item) => item.status !== "remove" && getWall(item.wallId)?.status !== "remove").map((item) => <DoorMark key={item.id} item={item} selected={selectedOpeningIds.has(item.id)} highlightAddition={toggles.construction && toggles.constructionAdditions && item.status === "proposed"} onSelect={() => selectItem(item.id)} />)}
            {toggles.construction && toggles.constructionDemolition && pocPlan.doors.filter((item) => item.status === "remove").map((item) => <DoorMark key={item.id} item={item} selected={selectedOpeningIds.has(item.id)} demolition onSelect={() => selectItem(item.id)} />)}
            {pocPlan.slidingDoors.filter((item) => item.status !== "remove" && getWall(item.wallId)?.status !== "remove").map((item) => { const wall = getWall(item.wallId)!; const start = pointAlong(wall.from, wall.to, item.offset); const end = pointAlong(wall.from, wall.to, item.offset + item.width); const midpoint = pointAlong(wall.from, wall.to, item.offset + item.width / 2); const normal = unitNormal(wall.from, wall.to, wall.interiorSide); const overlap = 4; const firstEnd = pointAlong(wall.from, wall.to, item.offset + item.width / 2 + overlap); const secondStart = pointAlong(wall.from, wall.to, item.offset + item.width / 2 - overlap); return <g key={item.id} data-selectable aria-label={item.label} className={`sliding-door-symbol ${toggles.construction && toggles.constructionAdditions && item.status === "proposed" ? "scope-addition" : ""} ${selectedOpeningIds.has(item.id) ? "selected" : ""}`} onClick={(event) => { event.stopPropagation(); selectItem(item.id); }}><line className="sliding-door-hit" x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} /><line className="sliding-door-panel" x1={add(start, normal, 2)[0]} y1={add(start, normal, 2)[1]} x2={add(firstEnd, normal, 2)[0]} y2={add(firstEnd, normal, 2)[1]} /><line className="sliding-door-panel" x1={add(secondStart, normal, -2)[0]} y1={add(secondStart, normal, -2)[1]} x2={add(end, normal, -2)[0]} y2={add(end, normal, -2)[1]} /><line className="sliding-door-center" x1={add(midpoint, normal, -4)[0]} y1={add(midpoint, normal, -4)[1]} x2={add(midpoint, normal, 4)[0]} y2={add(midpoint, normal, 4)[1]} /></g>; })}
            {toggles.plumbing && <g className="plumbing-layer">
              {toggles.plumbingShutoffs && pocPlan.waterValves.map((item) => <WaterValveMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.plumbingDrains && pocPlan.plumbingDrains.map((item) => <PlumbingDrainMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.plumbingEquipment && pocPlan.plumbingEquipment.map((item) => <PlumbingEquipmentMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
            </g>}
            {toggles.electrical && <g className="electrical-layer">
              {toggles.electricalLighting && pocPlan.circuits.map((item) => <LightingGroupMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.electricalLighting && pocPlan.lights.map((item) => <LightMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.electricalLighting && pocPlan.wallLights.map((item) => <WallLightMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.electricalLighting && pocPlan.exhaustFans.map((item) => <ExhaustFanMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.electricalLighting && pocPlan.switches.map((item) => <SwitchMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.electricalReceptacles && pocPlan.receptacles.map((item) => <ReceptacleMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {toggles.electricalReceptacles && pocPlan.ceilingReceptacles.map((item) => <CeilingReceptacleMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
              {pocPlan.wallCabinets.filter((item) => (item.cabinetType === "breaker-panel" ? toggles.electricalPanels : toggles.electricalLowVoltage)).map((item) => <WallCabinetMark key={item.id} item={item} selected={selectedId === item.id} onSelect={() => selectItem(item.id)} />)}
            </g>}
            {pocPlan.stairs.map((item) => <StairMark key={item.id} item={item} selected={item.id === selectedId} onSelect={() => selectItem(item.id)} />)}
            {toggles.construction && toggles.constructionAdditions && additionWalls.map((wall) => <FramingDimensionMark key={`addition-${wall.id}`} wall={wall} onSelect={() => selectItem(wall.id)} />)}
            {toggles.dimensions && pocPlan.dimensions.map((item) => <DimensionMark key={item.id} item={item} onSelect={() => selectItem(item.id)} />)}
            {selectedOpeningMeasurement && <OpeningMeasurementMarks measurement={selectedOpeningMeasurement} />}
            {toggles.plumbing && toggles.plumbingShutoffs && selected?.kind === "water-valve" && <WaterValveDimensionMark item={selected} />}
          </svg>
          <div className="plan-hint print-hide">Drag to pan · Scroll to zoom · Select any symbol</div>
        </div>
        <footer className="drawing-footer">
          <div><strong>{pocPlan.title}</strong><span>{pocPlan.subtitle}</span></div>
          <div className="print-legend">
            <span>← North</span><span>↑ Stairs up</span><span>═ Window</span><span>◜ Door swing</span><span>⇆ Bypass doors</span>
            {toggles.soffits && <span>┄ Overhead soffit</span>}
            {toggles.builtIns && toggles.builtInCabinetry && <span>▤ Cabinets + counter</span>}
            {toggles.builtIns && toggles.builtInBathroomFixtures && <span>▱ Bathroom fixtures</span>}
            {toggles.construction && toggles.constructionDemolition && <span>╳ Demolish</span>}
            {toggles.construction && toggles.constructionAdditions && <span>┄ Add</span>}
            {toggles.hvac && <span>▣ HVAC equipment</span>}
            {toggles.hvac && toggles.hvacSupply && <span>▭ Supply duct</span>}
            {toggles.hvac && toggles.hvacReturn && <span>▭ Return duct</span>}
            {toggles.hvac && toggles.hvacReturn && <span>▧ Panned return</span>}
            {toggles.hvac && toggles.hvacReturn && <span>▦ Return grille</span>}
            {toggles.hvac && toggles.hvacReturn && <span>▥ Wall return</span>}
            {toggles.gas && <span>═ GAS</span>}
            {toggles.radon && <span>═ RADON ↑</span>}
            {toggles.joists && <span>│ Ceiling joist</span>}
            {toggles.plumbing && toggles.plumbingShutoffs && <span>⊗ Water shutoff</span>}
            {toggles.plumbing && toggles.plumbingDrains && <span>⊙ Drain rough-in</span>}
            {toggles.plumbing && toggles.plumbingEquipment && <span>◯ Water heater</span>}
            {toggles.electrical && toggles.electricalLighting && <span>⊗ Recessed light · ▭ Surface light · ⌂ Wall light · ━ Under-cabinet light · Ⓓ Dimmer · ◉ Exhaust fan · ┄ schematic control</span>}
            {toggles.electrical && toggles.electricalReceptacles && <span>◉ Wall duplex · ⊙ Ceiling duplex</span>}
            {toggles.electrical && toggles.electricalPanels && <span>▣ Breaker panel</span>}
            {toggles.electrical && toggles.electricalLowVoltage && <span>▤ Networking</span>}
          </div>
          {toggles.construction && toggles.constructionAdditions && <div className="print-framing-summary"><FramingSummary compact /></div>}
          <p>{pocPlan.warning}</p>
        </footer>
        {issues.length > 0 && <div className="validation-error" role="alert">Plan data has {issues.length} validation issue{issues.length === 1 ? "" : "s"}.</div>}
      </section>
    </main>
  );
}
