/**
 * Reusable deterministic geometry helpers.
 *
 * These generate BlueprintStructure children for common patterns:
 * repeated bars, legs, panels, trim strips, frame patterns, etc.
 *
 * All helpers are pure functions — same inputs → same outputs.
 */

import type { BlueprintStructure, Geometry, Material } from "@/types/blueprint";

// ─── Primitive factory ──────────────────────────────────────────────────────

const T0 = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 };

export function prim(
  id: string,
  t: Partial<BlueprintStructure["transform"]>,
  geo: Geometry,
  mat?: Partial<Material>,
): BlueprintStructure {
  return {
    id,
    type: "prop",
    transform: { ...T0, ...t },
    geometry: geo,
    material: mat ? { color: "#888888", ...mat } : undefined,
  };
}

// ─── Repeated elements ──────────────────────────────────────────────────────

/** Generate N bars along an axis. */
export function repeatedBars(
  prefix: string,
  count: number,
  axis: "x" | "z",
  spacing: number,
  startOffset: number,
  barGeo: Geometry,
  mat: Partial<Material>,
  baseTransform?: Partial<BlueprintStructure["transform"]>,
): BlueprintStructure[] {
  const result: BlueprintStructure[] = [];
  for (let i = 0; i < count; i++) {
    const pos = startOffset + i * spacing;
    result.push(prim(
      `${prefix}-${i}`,
      { ...baseTransform, [axis]: pos },
      barGeo,
      mat,
    ));
  }
  return result;
}

/** Generate N supports (legs, posts, pillars) in a grid or line. */
export function repeatedSupports(
  prefix: string,
  positions: Array<{ x: number; z: number }>,
  supportGeo: Geometry,
  mat: Partial<Material>,
  baseY?: number,
): BlueprintStructure[] {
  const yOff = baseY ?? (supportGeo.height ? supportGeo.height / 2 : 0);
  return positions.map((pos, i) =>
    prim(`${prefix}-${i}`, { x: pos.x, y: yOff, z: pos.z }, supportGeo, mat)
  );
}

/** Generate symmetric pairs along the x-axis. */
export function symmetricPair(
  prefix: string,
  xOffset: number,
  t: Partial<BlueprintStructure["transform"]>,
  geo: Geometry,
  mat: Partial<Material>,
): BlueprintStructure[] {
  return [
    prim(`${prefix}-l`, { ...t, x: -xOffset }, geo, mat),
    prim(`${prefix}-r`, { ...t, x: xOffset }, geo, mat),
  ];
}

/** Generate repeated panels along an axis (for wall segments, siding, etc.) */
export function repeatedPanels(
  prefix: string,
  count: number,
  axis: "x" | "z",
  spacing: number,
  startOffset: number,
  panelGeo: Geometry,
  mat: Partial<Material>,
  baseTransform?: Partial<BlueprintStructure["transform"]>,
): BlueprintStructure[] {
  return repeatedBars(prefix, count, axis, spacing, startOffset, panelGeo, mat, baseTransform);
}

// ─── Frame helpers ──────────────────────────────────────────────────────────

/** Generate a rectangular frame (4 edges) */
export function rectFrame(
  prefix: string,
  width: number,
  height: number,
  barThickness: number,
  mat: Partial<Material>,
  baseTransform?: Partial<BlueprintStructure["transform"]>,
): BlueprintStructure[] {
  const hw = width / 2;
  const hh = height / 2;
  const bt = barThickness;
  const base = baseTransform || {};
  return [
    prim(`${prefix}-top`, { ...base, y: (base.y || 0) + hh }, { kind: "cube", width, height: bt, depth: bt }, mat),
    prim(`${prefix}-bot`, { ...base, y: (base.y || 0) - hh }, { kind: "cube", width, height: bt, depth: bt }, mat),
    prim(`${prefix}-left`, { ...base, x: (base.x || 0) - hw }, { kind: "cube", width: bt, height, depth: bt }, mat),
    prim(`${prefix}-right`, { ...base, x: (base.x || 0) + hw }, { kind: "cube", width: bt, height, depth: bt }, mat),
  ];
}

/** Generate a perimeter of 4 walls */
export function perimeterWalls(
  prefix: string,
  width: number,
  depth: number,
  height: number,
  thickness: number,
  mat: Partial<Material>,
  yBase?: number,
): BlueprintStructure[] {
  const y = (yBase || 0) + height / 2;
  const hw = width / 2;
  const hd = depth / 2;
  return [
    prim(`${prefix}-n`, { y, z: -hd }, { kind: "cube", width, height, depth: thickness }, mat),
    prim(`${prefix}-s`, { y, z: hd }, { kind: "cube", width, height, depth: thickness }, mat),
    prim(`${prefix}-e`, { y, x: hw }, { kind: "cube", width: thickness, height, depth }, mat),
    prim(`${prefix}-w`, { y, x: -hw }, { kind: "cube", width: thickness, height, depth }, mat),
  ];
}

// ─── Massing helpers ────────────────────────────────────────────────────────

/** Create a layered mass — a primary form with a slightly offset trim layer. */
export function layeredMass(
  prefix: string,
  mainGeo: Geometry,
  trimGeo: Geometry,
  mainMat: Partial<Material>,
  trimMat: Partial<Material>,
  mainTransform?: Partial<BlueprintStructure["transform"]>,
  trimOffset?: Partial<BlueprintStructure["transform"]>,
): BlueprintStructure[] {
  return [
    prim(`${prefix}-main`, mainTransform || {}, mainGeo, mainMat),
    prim(`${prefix}-trim`, trimOffset || { y: (mainGeo.height || 1) * 0.48 }, trimGeo, trimMat),
  ];
}

// ─── Proportion calculator ──────────────────────────────────────────────────

/**
 * Calculate proportional dimensions from a total bounding size.
 * Returns fractions of the total for use by build strategies.
 */
export interface Proportions {
  totalW: number;
  totalH: number;
  totalD: number;
}

export function calcProportions(
  archetype: string,
  totalH: number,
): Proportions {
  // Default proportions — roughly 1:1:1 aspect
  const ratios: Record<string, { w: number; d: number }> = {
    vehicle: { w: 2.2, d: 1 },
    furniture: { w: 1.5, d: 0.8 },
    structure: { w: 1.2, d: 1.2 },
    tower: { w: 0.4, d: 0.4 },
    tool: { w: 0.3, d: 0.2 },
    weapon: { w: 0.15, d: 0.1 },
    creature: { w: 0.8, d: 0.6 },
    machine: { w: 1.2, d: 1 },
    container: { w: 0.6, d: 0.6 },
    prop: { w: 1, d: 1 },
    nature: { w: 1, d: 1 },
    lighting: { w: 0.3, d: 0.3 },
  };

  const r = ratios[archetype] || { w: 1, d: 1 };
  return {
    totalW: totalH * r.w,
    totalH,
    totalD: totalH * r.d,
  };
}

// ─── Grille / slat detail ───────────────────────────────────────────────────

/** Generate a grille or slat pattern (e.g. for radiators, vents, fences). */
export function grille(
  prefix: string,
  width: number,
  height: number,
  slats: number,
  axis: "horizontal" | "vertical",
  mat: Partial<Material>,
  baseTransform?: Partial<BlueprintStructure["transform"]>,
): BlueprintStructure[] {
  const result: BlueprintStructure[] = [];
  const base = baseTransform || {};
  const by = base.y || 0;
  const bx = base.x || 0;

  if (axis === "vertical") {
    const spacing = width / (slats + 1);
    const startX = bx - width / 2 + spacing;
    for (let i = 0; i < slats; i++) {
      result.push(prim(
        `${prefix}-${i}`,
        { ...base, x: startX + i * spacing, y: by },
        { kind: "cube", width: 0.03, height, depth: 0.03 },
        mat,
      ));
    }
  } else {
    const spacing = height / (slats + 1);
    const startY = by - height / 2 + spacing;
    for (let i = 0; i < slats; i++) {
      result.push(prim(
        `${prefix}-${i}`,
        { ...base, y: startY + i * spacing },
        { kind: "cube", width, height: 0.03, depth: 0.03 },
        mat,
      ));
    }
  }
  return result;
}

/** Generate trim edges around a flat surface. */
export function trimEdges(
  prefix: string,
  width: number,
  depth: number,
  thickness: number,
  mat: Partial<Material>,
  baseTransform?: Partial<BlueprintStructure["transform"]>,
): BlueprintStructure[] {
  const base = baseTransform || {};
  const y = base.y || 0;
  const hw = width / 2;
  const hd = depth / 2;
  return [
    prim(`${prefix}-fn`, { ...base, y, z: -hd }, { kind: "cube", width, height: thickness, depth: thickness }, mat),
    prim(`${prefix}-fs`, { ...base, y, z: hd }, { kind: "cube", width, height: thickness, depth: thickness }, mat),
    prim(`${prefix}-fe`, { ...base, y, x: hw }, { kind: "cube", width: thickness, height: thickness, depth }, mat),
    prim(`${prefix}-fw`, { ...base, y, x: -hw }, { kind: "cube", width: thickness, height: thickness, depth }, mat),
  ];
}
