/**
 * Universal Procedural Builder.
 *
 * Generates geometry from blueprint.parts + blueprint.intent.archetype.
 * NO hardcoded named-object templates. Works from broad archetype strategies
 * and generic part-to-geometry mapping.
 *
 * Pipeline:
 *   blueprint.parts → part role/shapeHint mapping → geometry strategy → children
 */

import type { BlueprintJSON, BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import {
  prim,
  repeatedBars,
  repeatedSupports,
  symmetricPair,
  perimeterWalls,
  layeredMass,
  grille,
  trimEdges,
  calcProportions,
} from "./geometry-helpers";

// ─── Material Palettes ──────────────────────────────────────────────────────

export interface MaterialPalette {
  primary: string[];
  secondary: string[];
  metal: string[];
  accent: string[];
  emissive: string;
  ground: string;
}

const PALETTES: Record<string, MaterialPalette> = {
  medieval: { primary: ["#6B6B6B", "#7A7A7A", "#5C5C5C"], secondary: ["#4A3728", "#5C3A1E", "#8B4513"], metal: ["#708090", "#5F6B7A"], accent: ["#8B0000", "#654321"], emissive: "#FFA500", ground: "#3A3A3A" },
  industrial: { primary: ["#555555", "#666666", "#4A4A4A"], secondary: ["#3E2723", "#5D4037"], metal: ["#78909C", "#607D8B", "#455A64"], accent: ["#FF6F00", "#E65100"], emissive: "#FFAB00", ground: "#2D2D2D" },
  nature: { primary: ["#7A7A7A", "#8B8682"], secondary: ["#4A3728", "#8B4513"], metal: ["#708090"], accent: ["#228B22", "#2E8B57", "#32CD32"], emissive: "#90EE90", ground: "#4A6741" },
  scifi: { primary: ["#37474F", "#455A64", "#546E7A"], secondary: ["#263238"], metal: ["#B0BEC5", "#CFD8DC", "#90A4AE"], accent: ["#00BCD4", "#00E5FF"], emissive: "#00E5FF", ground: "#1A1A2E" },
  organic: { primary: ["#8B7355", "#A0522D", "#6B4226"], secondary: ["#228B22", "#2E8B57"], metal: ["#708090"], accent: ["#DAA520", "#CD853F"], emissive: "#FFD700", ground: "#3A3A2E" },
  neutral: { primary: ["#6B6B6B", "#7A7A7A", "#5C5C5C"], secondary: ["#4A3728", "#8B4513", "#DEB887"], metal: ["#708090", "#8B8682"], accent: ["#A0522D", "#654321"], emissive: "#FFA500", ground: "#3A3A3A" },
};

function getPalette(theme: string): MaterialPalette {
  return PALETTES[theme] || PALETTES.neutral;
}

function pick(colors: string[], i: number): string {
  return colors[i % colors.length];
}

// ─── Part role → geometry mapping ───────────────────────────────────────────

interface ShapeSpec {
  kind: "cube" | "cylinder" | "sphere";
  /** Fraction of total dimensions */
  wFrac: number;
  hFrac: number;
  dFrac: number;
  /** y position as fraction of total height */
  yFrac: number;
}

const SHAPE_HINT_MAP: Record<string, Partial<ShapeSpec>> = {
  // Bodies / masses
  body: { kind: "cube", wFrac: 0.8, hFrac: 0.4, dFrac: 0.7, yFrac: 0.3 },
  core: { kind: "cube", wFrac: 0.6, hFrac: 0.5, dFrac: 0.6, yFrac: 0.35 },
  shell: { kind: "cube", wFrac: 0.9, hFrac: 0.35, dFrac: 0.8, yFrac: 0.25 },
  hull: { kind: "cube", wFrac: 0.95, hFrac: 0.3, dFrac: 0.7, yFrac: 0.2 },
  torso: { kind: "cube", wFrac: 0.5, hFrac: 0.35, dFrac: 0.4, yFrac: 0.45 },
  chassis: { kind: "cube", wFrac: 0.9, hFrac: 0.15, dFrac: 0.7, yFrac: 0.1 },
  frame: { kind: "cube", wFrac: 0.85, hFrac: 0.08, dFrac: 0.7, yFrac: 0.1 },
  base: { kind: "cube", wFrac: 0.8, hFrac: 0.12, dFrac: 0.8, yFrac: 0.06 },
  platform: { kind: "cube", wFrac: 0.9, hFrac: 0.06, dFrac: 0.9, yFrac: 0.85 },
  foundation: { kind: "cube", wFrac: 1.0, hFrac: 0.1, dFrac: 1.0, yFrac: 0.05 },
  // Upper sections
  cabin: { kind: "cube", wFrac: 0.5, hFrac: 0.3, dFrac: 0.5, yFrac: 0.55 },
  roof: { kind: "cube", wFrac: 1.05, hFrac: 0.08, dFrac: 1.05, yFrac: 0.92 },
  cap: { kind: "cylinder", wFrac: 0.6, hFrac: 0.15, dFrac: 0.6, yFrac: 0.9 },
  dome: { kind: "sphere", wFrac: 0.7, hFrac: 0.35, dFrac: 0.7, yFrac: 0.85 },
  top: { kind: "cube", wFrac: 0.7, hFrac: 0.12, dFrac: 0.7, yFrac: 0.88 },
  head: { kind: "sphere", wFrac: 0.3, hFrac: 0.2, dFrac: 0.3, yFrac: 0.85 },
  // Vertical
  shaft: { kind: "cylinder", wFrac: 0.3, hFrac: 0.6, dFrac: 0.3, yFrac: 0.45 },
  tower: { kind: "cylinder", wFrac: 0.35, hFrac: 0.7, dFrac: 0.35, yFrac: 0.45 },
  pillar: { kind: "cylinder", wFrac: 0.1, hFrac: 0.7, dFrac: 0.1, yFrac: 0.35 },
  pole: { kind: "cylinder", wFrac: 0.05, hFrac: 0.8, dFrac: 0.05, yFrac: 0.4 },
  handle: { kind: "cylinder", wFrac: 0.08, hFrac: 0.5, dFrac: 0.08, yFrac: 0.25 },
  trunk: { kind: "cylinder", wFrac: 0.15, hFrac: 0.5, dFrac: 0.15, yFrac: 0.25 },
  // Supports
  leg: { kind: "cube", wFrac: 0.06, hFrac: 0.3, dFrac: 0.06, yFrac: 0.15 },
  wheel: { kind: "cylinder", wFrac: 0.15, hFrac: 0.08, dFrac: 0.15, yFrac: 0.08 },
  stand: { kind: "cylinder", wFrac: 0.2, hFrac: 0.06, dFrac: 0.2, yFrac: 0.03 },
  strut: { kind: "cube", wFrac: 0.04, hFrac: 0.25, dFrac: 0.04, yFrac: 0.15 },
  support: { kind: "cube", wFrac: 0.08, hFrac: 0.25, dFrac: 0.08, yFrac: 0.12 },
  // Appendages
  arm: { kind: "cube", wFrac: 0.12, hFrac: 0.3, dFrac: 0.08, yFrac: 0.55 },
  wing: { kind: "cube", wFrac: 0.6, hFrac: 0.04, dFrac: 0.3, yFrac: 0.55 },
  tail: { kind: "cube", wFrac: 0.1, hFrac: 0.08, dFrac: 0.4, yFrac: 0.4 },
  fin: { kind: "cube", wFrac: 0.02, hFrac: 0.15, dFrac: 0.2, yFrac: 0.6 },
  blade: { kind: "cube", wFrac: 0.06, hFrac: 0.5, dFrac: 0.15, yFrac: 0.6 },
  // Openings / surfaces
  panel: { kind: "cube", wFrac: 0.35, hFrac: 0.25, dFrac: 0.02, yFrac: 0.5 },
  window: { kind: "cube", wFrac: 0.2, hFrac: 0.2, dFrac: 0.02, yFrac: 0.6 },
  opening: { kind: "cube", wFrac: 0.25, hFrac: 0.35, dFrac: 0.04, yFrac: 0.4 },
  door: { kind: "cube", wFrac: 0.2, hFrac: 0.4, dFrac: 0.04, yFrac: 0.2 },
  surface: { kind: "cube", wFrac: 0.7, hFrac: 0.03, dFrac: 0.5, yFrac: 0.45 },
  seat: { kind: "cube", wFrac: 0.6, hFrac: 0.04, dFrac: 0.5, yFrac: 0.35 },
  // Details
  grille: { kind: "cube", wFrac: 0.4, hFrac: 0.15, dFrac: 0.02, yFrac: 0.2 },
  light: { kind: "sphere", wFrac: 0.08, hFrac: 0.08, dFrac: 0.08, yFrac: 0.4 },
  bar: { kind: "cube", wFrac: 0.03, hFrac: 0.3, dFrac: 0.03, yFrac: 0.5 },
  trim: { kind: "cube", wFrac: 0.9, hFrac: 0.02, dFrac: 0.04, yFrac: 0.5 },
  rim: { kind: "cylinder", wFrac: 0.55, hFrac: 0.03, dFrac: 0.55, yFrac: 0.5 },
  band: { kind: "cylinder", wFrac: 0.52, hFrac: 0.02, dFrac: 0.52, yFrac: 0.5 },
  connector: { kind: "cube", wFrac: 0.1, hFrac: 0.1, dFrac: 0.1, yFrac: 0.5 },
  canopy: { kind: "sphere", wFrac: 0.7, hFrac: 0.5, dFrac: 0.7, yFrac: 0.8 },
  // Fallback
  box: { kind: "cube", wFrac: 0.5, hFrac: 0.3, dFrac: 0.5, yFrac: 0.3 },
};

function resolveShapeSpec(hint: string): ShapeSpec {
  // Try exact match, then prefix match
  const normalized = hint.toLowerCase().replace(/[^a-z]/g, "");
  const exact = SHAPE_HINT_MAP[normalized];
  if (exact) return { kind: "cube", wFrac: 0.5, hFrac: 0.3, dFrac: 0.5, yFrac: 0.3, ...exact };

  // Try finding a matching key
  for (const [key, spec] of Object.entries(SHAPE_HINT_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { kind: "cube", wFrac: 0.5, hFrac: 0.3, dFrac: 0.5, yFrac: 0.3, ...spec };
    }
  }

  // Default fallback
  return { kind: "cube", wFrac: 0.5, hFrac: 0.3, dFrac: 0.5, yFrac: 0.3 };
}

// ─── Universal Object Builder ───────────────────────────────────────────────

/**
 * Build an object from its parts description + archetype.
 * Returns children structures to be added to the main object group.
 */
export function buildObjectFromParts(
  objectId: string,
  parts: BlueprintPart[],
  archetype: string,
  theme: string,
  totalHeight: number,
): BlueprintStructure[] {
  const palette = getPalette(theme);
  const proportions = calcProportions(archetype, totalHeight);
  const { totalW, totalH, totalD } = proportions;

  const children: BlueprintStructure[] = [];
  let colorIndex = 0;

  // Sort parts by role priority: primary first, then secondary, support, detail
  const rolePriority: Record<string, number> = { primary: 0, secondary: 1, support: 2, detail: 3 };
  const sorted = [...parts].sort((a, b) => (rolePriority[a.role] || 3) - (rolePriority[b.role] || 3));

  for (const part of sorted) {
    const spec = resolveShapeSpec(part.shapeHint);
    const partId = `${objectId}-${part.name.replace(/\s+/g, "-").toLowerCase()}`;

    // Choose material by role
    const mat = materialForRole(part.role, palette, colorIndex);
    colorIndex++;

    // Calculate absolute dimensions from fractions
    const w = spec.wFrac * totalW;
    const h = spec.hFrac * totalH;
    const d = spec.dFrac * totalD;
    const yPos = spec.yFrac * totalH;

    if (part.symmetry) {
      // Symmetric pair: offset along x
      const xOff = totalW * 0.35;
      const geo = buildGeo(spec.kind, w, h, d);
      children.push(...symmetricPair(partId, xOff, { y: yPos }, geo, mat));
    } else if (part.role === "support" && isRepeatedSupport(part.shapeHint)) {
      // Generate 4 supports in rectangle pattern
      const xOff = totalW * 0.35;
      const zOff = totalD * 0.35;
      const geo = buildGeo(spec.kind, w, h, d);
      children.push(...repeatedSupports(partId, [
        { x: -xOff, z: -zOff },
        { x: xOff, z: -zOff },
        { x: -xOff, z: zOff },
        { x: xOff, z: zOff },
      ], geo, mat));
    } else if (part.role === "detail" && isRepeatedDetail(part.shapeHint)) {
      // Generate detail cluster (bars, slats, ribs)
      const detailCount = getDetailCount(part.shapeHint);
      const spacing = totalW * 0.8 / (detailCount + 1);
      const startX = -totalW * 0.4 + spacing;
      children.push(...repeatedBars(
        partId, detailCount, "x", spacing, startX,
        buildGeo(spec.kind, w, h, d), mat, { y: yPos },
      ));
    } else {
      // Single part
      const geo = buildGeo(spec.kind, w, h, d);
      children.push(prim(partId, { y: yPos }, geo, mat));
    }
  }

  // If we got too few children, add trim/detail pass
  if (children.length < 4) {
    const trimMat = { color: pick(palette.metal, 0), metalness: 0.5 };
    children.push(...trimEdges(
      `${objectId}-trim`, totalW * 0.5, totalD * 0.5, 0.03, trimMat,
      { y: totalH * 0.5 },
    ));
  }

  return children;
}

function buildGeo(kind: "cube" | "cylinder" | "sphere", w: number, h: number, d: number) {
  const rw = round(w);
  const rh = round(h);
  const rd = round(d);
  if (kind === "cylinder") {
    return { kind: "cylinder" as const, radius: round(Math.max(rw, rd) / 2), height: rh };
  }
  if (kind === "sphere") {
    return { kind: "sphere" as const, radius: round(Math.max(rw, rh, rd) / 2) };
  }
  return { kind: "cube" as const, width: rw, height: rh, depth: rd };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function materialForRole(role: string, p: MaterialPalette, idx: number): { color: string; metalness?: number; roughness?: number; opacity?: number; emissive?: string; emissiveIntensity?: number } {
  switch (role) {
    case "primary": return { color: pick(p.primary, idx), roughness: 0.8 };
    case "secondary": return { color: pick(p.secondary, idx), roughness: 0.7 };
    case "support": return { color: pick(p.secondary, idx + 1), roughness: 0.9 };
    case "detail": return { color: pick(p.metal, idx), metalness: 0.5, roughness: 0.4 };
    default: return { color: pick(p.primary, idx) };
  }
}

function isRepeatedSupport(hint: string): boolean {
  return /\b(leg|wheel|post|strut|support|foot|stand)\b/i.test(hint);
}

function isRepeatedDetail(hint: string): boolean {
  return /\b(bar|rib|slat|grille|stripe|panel|rail|fin|spoke)\b/i.test(hint);
}

function getDetailCount(hint: string): number {
  if (/\b(spoke|rib|slat)\b/i.test(hint)) return 6;
  if (/\b(bar|rail)\b/i.test(hint)) return 4;
  return 3;
}

// ─── Archetype Build Strategies ─────────────────────────────────────────────

/**
 * Infer default parts from archetype when LLM didn't provide parts.
 * This is the fallback — ideally LLM provides the parts list.
 */
export function inferPartsFromArchetype(archetype: string): BlueprintPart[] {
  const strategies: Record<string, BlueprintPart[]> = {
    vehicle: [
      { name: "chassis", role: "primary", shapeHint: "chassis", symmetry: false },
      { name: "cabin", role: "secondary", shapeHint: "cabin", symmetry: false },
      { name: "hood", role: "secondary", shapeHint: "panel", symmetry: false },
      { name: "wheels", role: "support", shapeHint: "wheel", symmetry: true },
      { name: "windshield", role: "detail", shapeHint: "window", symmetry: false },
      { name: "headlights", role: "detail", shapeHint: "light", symmetry: true },
    ],
    furniture: [
      { name: "frame", role: "primary", shapeHint: "frame", symmetry: false },
      { name: "surface", role: "secondary", shapeHint: "surface", symmetry: false },
      { name: "legs", role: "support", shapeHint: "leg", symmetry: true },
      { name: "back", role: "secondary", shapeHint: "panel", symmetry: false },
      { name: "trim", role: "detail", shapeHint: "trim", symmetry: false },
    ],
    structure: [
      { name: "foundation", role: "primary", shapeHint: "foundation", symmetry: false },
      { name: "walls", role: "primary", shapeHint: "body", symmetry: false },
      { name: "roof", role: "secondary", shapeHint: "roof", symmetry: false },
      { name: "door", role: "secondary", shapeHint: "opening", symmetry: false },
      { name: "windows", role: "detail", shapeHint: "window", symmetry: true },
      { name: "trim", role: "detail", shapeHint: "trim", symmetry: false },
    ],
    tower: [
      { name: "base", role: "primary", shapeHint: "base", symmetry: false },
      { name: "shaft", role: "primary", shapeHint: "shaft", symmetry: false },
      { name: "platform", role: "secondary", shapeHint: "platform", symmetry: false },
      { name: "cap", role: "secondary", shapeHint: "cap", symmetry: false },
      { name: "rails", role: "detail", shapeHint: "bar", symmetry: false },
    ],
    tool: [
      { name: "handle", role: "primary", shapeHint: "handle", symmetry: false },
      { name: "head", role: "secondary", shapeHint: "body", symmetry: false },
      { name: "connector", role: "support", shapeHint: "connector", symmetry: false },
      { name: "detail", role: "detail", shapeHint: "band", symmetry: false },
    ],
    weapon: [
      { name: "handle", role: "primary", shapeHint: "handle", symmetry: false },
      { name: "blade", role: "secondary", shapeHint: "blade", symmetry: false },
      { name: "guard", role: "support", shapeHint: "connector", symmetry: false },
      { name: "pommel", role: "detail", shapeHint: "rim", symmetry: false },
    ],
    creature: [
      { name: "torso", role: "primary", shapeHint: "torso", symmetry: false },
      { name: "head", role: "secondary", shapeHint: "head", symmetry: false },
      { name: "limbs", role: "support", shapeHint: "arm", symmetry: true },
      { name: "legs", role: "support", shapeHint: "leg", symmetry: true },
      { name: "tail", role: "detail", shapeHint: "tail", symmetry: false },
    ],
    machine: [
      { name: "core", role: "primary", shapeHint: "core", symmetry: false },
      { name: "housing", role: "secondary", shapeHint: "shell", symmetry: false },
      { name: "supports", role: "support", shapeHint: "strut", symmetry: true },
      { name: "vents", role: "detail", shapeHint: "grille", symmetry: false },
      { name: "panels", role: "detail", shapeHint: "panel", symmetry: true },
    ],
    container: [
      { name: "body", role: "primary", shapeHint: "body", symmetry: false },
      { name: "rim", role: "secondary", shapeHint: "rim", symmetry: false },
      { name: "base", role: "support", shapeHint: "stand", symmetry: false },
      { name: "bands", role: "detail", shapeHint: "band", symmetry: false },
    ],
    nature: [
      { name: "trunk", role: "primary", shapeHint: "trunk", symmetry: false },
      { name: "canopy", role: "secondary", shapeHint: "canopy", symmetry: false },
      { name: "base", role: "support", shapeHint: "base", symmetry: false },
    ],
    lighting: [
      { name: "base", role: "primary", shapeHint: "stand", symmetry: false },
      { name: "pole", role: "primary", shapeHint: "pole", symmetry: false },
      { name: "shade", role: "secondary", shapeHint: "cap", symmetry: false },
      { name: "bulb", role: "detail", shapeHint: "light", symmetry: false },
    ],
    prop: [
      { name: "body", role: "primary", shapeHint: "body", symmetry: false },
      { name: "base", role: "support", shapeHint: "base", symmetry: false },
      { name: "detail", role: "detail", shapeHint: "trim", symmetry: false },
    ],
    abstract: [
      { name: "core", role: "primary", shapeHint: "core", symmetry: false },
      { name: "shell", role: "secondary", shapeHint: "shell", symmetry: false },
      { name: "arms", role: "detail", shapeHint: "arm", symmetry: true },
      { name: "base", role: "support", shapeHint: "stand", symmetry: false },
    ],
  };

  return strategies[archetype] || strategies.prop;
}

// ─── Total height estimation by archetype ───────────────────────────────────

export function estimateTotalHeight(archetype: string): number {
  const heights: Record<string, number> = {
    vehicle: 1.8,
    furniture: 1.0,
    structure: 4.0,
    tower: 12.0,
    tool: 1.2,
    weapon: 1.5,
    creature: 2.0,
    machine: 2.0,
    container: 1.0,
    nature: 5.0,
    lighting: 3.5,
    prop: 1.5,
    abstract: 2.0,
  };
  return heights[archetype] || 2.0;
}

// ─── Showcase Wrapper ───────────────────────────────────────────────────────

/**
 * Wrap an object blueprint with showcase presentation:
 * - neutral ground
 * - key + fill lights
 * - no clutter
 */
export function addShowcaseSetup(blueprint: BlueprintJSON): BlueprintJSON {
  if (blueprint.type !== "object") return blueprint;

  const structures = [...blueprint.scene.structures];
  const hasLights = structures.some((s) => s.type === "light" || s.lightProps);

  if (!hasLights) {
    structures.push(
      {
        id: "showcase-key",
        type: "light",
        transform: { x: 5, y: 8, z: -5, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
        lightProps: { type: "directional", intensity: 1.2, color: "#ffffff" },
      },
      {
        id: "showcase-fill",
        type: "light",
        transform: { x: -4, y: 5, z: 3, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
        lightProps: { type: "point", intensity: 0.5, color: "#E8E4DF", distance: 20 },
      },
    );
  }

  // Ground plane intentionally omitted — the renderer environment provides one.

  return { ...blueprint, scene: { ...blueprint.scene, structures } };
}

// ─── Scene Layout Strategies ────────────────────────────────────────────────

/**
 * Infer scene layout parts from archetype.
 * Used when the LLM returns scene structures but some lack children.
 */
export function inferSceneParts(sceneArchetype: string): Record<string, BlueprintPart[]> {
  const common: Record<string, BlueprintPart[]> = {
    boundary: [
      { name: "wall", role: "primary", shapeHint: "body", symmetry: false },
    ],
    building: [
      { name: "walls", role: "primary", shapeHint: "body", symmetry: false },
      { name: "roof", role: "secondary", shapeHint: "roof", symmetry: false },
      { name: "door", role: "secondary", shapeHint: "opening", symmetry: false },
      { name: "windows", role: "detail", shapeHint: "window", symmetry: true },
    ],
    tower: [
      { name: "base", role: "primary", shapeHint: "base", symmetry: false },
      { name: "shaft", role: "primary", shapeHint: "shaft", symmetry: false },
      { name: "platform", role: "secondary", shapeHint: "platform", symmetry: false },
      { name: "rails", role: "detail", shapeHint: "bar", symmetry: false },
    ],
    prop: [
      { name: "body", role: "primary", shapeHint: "body", symmetry: false },
      { name: "base", role: "support", shapeHint: "base", symmetry: false },
    ],
  };

  // Map scene archetypes to structure families
  const _unused = sceneArchetype; // archetype is available for future refinement
  return common;
}

// ─── Enhance Blueprint (entry point) ────────────────────────────────────────

/**
 * Post-process a blueprint:
 * - If it has parts[], use them to build geometry
 * - If structures lack children, expand them using archetype strategies
 * - Enforce grounding
 */
export function enhanceBlueprint(blueprint: BlueprintJSON): BlueprintJSON {
  const archetype = blueprint.intent?.archetype || "custom";
  const theme = blueprint.style?.theme || "neutral";
  const parts = blueprint.parts;

  let structures = [...blueprint.scene.structures];

  // If blueprint has a parts list and a single main object, build it from parts
  if (blueprint.type === "object" && parts && parts.length > 0) {
    const mainObj = structures.find((s) => !s.lightProps && s.type !== "light");
    if (mainObj && (!mainObj.children || mainObj.children.length === 0) && !mainObj.geometry) {
      const totalH = estimateTotalHeight(archetype);
      const children = buildObjectFromParts(mainObj.id, parts, archetype, theme, totalH);
      structures = structures.map((s) =>
        s.id === mainObj.id ? { ...s, children } : s
      );
    }
  }

  // Enhance any bare structures (no children, no geometry, no model)
  structures = structures.map((s) => enhanceStructure(s, archetype, theme));

  // Enforce grounding
  structures = structures.map((s) => {
    if (s.type === "light" || s.lightProps) return s;
    if (s.transform.y < 0) return { ...s, transform: { ...s.transform, y: 0 } };
    return s;
  });

  return { ...blueprint, scene: { ...blueprint.scene, structures } };
}

function enhanceStructure(s: BlueprintStructure, archetype: string, theme: string): BlueprintStructure {
  // Recurse into children
  if (s.children && s.children.length > 0) {
    return { ...s, children: s.children.map((c) => enhanceStructure(c, archetype, theme)) };
  }

  // Already has geometry, model, light, or label — leave it
  if (s.geometry || s.modelSrc || s.lightProps || s.label || s.type === "light") return s;

  // Bare structure — infer parts from its type as an archetype hint
  const typeArchetype = inferArchetypeFromType(s.type);
  const parts = inferPartsFromArchetype(typeArchetype);
  const totalH = estimateTotalHeight(typeArchetype);
  const children = buildObjectFromParts(s.id, parts, typeArchetype, theme, totalH);

  if (children.length > 0) {
    return { ...s, children };
  }

  return s;
}

function inferArchetypeFromType(type: string): string {
  const map: Record<string, string> = {
    vehicle: "vehicle",
    tower: "tower",
    clockTower: "tower",
    building: "structure",
    room: "structure",
    gate: "structure",
    wall: "prop",
    fence: "prop",
    door: "prop",
    window: "prop",
    bench: "furniture",
    table: "furniture",
    chair: "furniture",
    barrel: "container",
    crate: "container",
    tree: "nature",
    rock: "nature",
    lamp: "lighting",
    sign: "prop",
    pillar: "prop",
    arch: "structure",
    stair: "structure",
    bridge: "structure",
    water: "nature",
    prop: "prop",
    custom: "prop",
    roof: "prop",
    floor: "prop",
    light: "lighting",
  };
  return map[type] || "prop";
}
