/**
 * Structure archetype builder.
 *
 * Generates structured BlueprintStructure children for architectural objects:
 * buildings, walls, gates, bridges, towers, arches, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

/** Enhanced default parts for a building-type structure. */
const BUILDING_PARTS: BlueprintPart[] = [
  { name: "foundation", role: "primary", shapeHint: "foundation", symmetry: false },
  { name: "walls", role: "primary", shapeHint: "body", symmetry: false },
  { name: "roof", role: "secondary", shapeHint: "roof", symmetry: false },
  { name: "door", role: "secondary", shapeHint: "opening", symmetry: false },
  { name: "windows", role: "detail", shapeHint: "window", symmetry: true },
  { name: "trim", role: "detail", shapeHint: "trim", symmetry: false },
  { name: "columns", role: "support", shapeHint: "pillar", symmetry: true },
];

/** Enhanced default parts for a tower. */
const TOWER_PARTS: BlueprintPart[] = [
  { name: "base", role: "primary", shapeHint: "base", symmetry: false },
  { name: "shaft", role: "primary", shapeHint: "shaft", symmetry: false },
  { name: "platform", role: "secondary", shapeHint: "platform", symmetry: false },
  { name: "cap", role: "secondary", shapeHint: "cap", symmetry: false },
  { name: "rails", role: "detail", shapeHint: "bar", symmetry: false },
  { name: "windows", role: "detail", shapeHint: "window", symmetry: true },
];

/** Maps structure types to their specific part lists. */
const TYPE_PARTS: Record<string, BlueprintPart[]> = {
  building: BUILDING_PARTS,
  room: BUILDING_PARTS,
  tower: TOWER_PARTS,
  clockTower: TOWER_PARTS,
  gate: [
    { name: "pillars", role: "primary", shapeHint: "pillar", symmetry: true },
    { name: "arch", role: "secondary", shapeHint: "dome", symmetry: false },
    { name: "door", role: "secondary", shapeHint: "door", symmetry: false },
    { name: "trim", role: "detail", shapeHint: "trim", symmetry: false },
  ],
  wall: [
    { name: "wall-body", role: "primary", shapeHint: "body", symmetry: false },
    { name: "capstone", role: "detail", shapeHint: "trim", symmetry: false },
  ],
  fence: [
    { name: "rail-top", role: "primary", shapeHint: "bar", symmetry: false },
    { name: "rail-bottom", role: "secondary", shapeHint: "bar", symmetry: false },
    { name: "posts", role: "support", shapeHint: "post", symmetry: true },
  ],
  bridge: [
    { name: "deck", role: "primary", shapeHint: "platform", symmetry: false },
    { name: "supports", role: "support", shapeHint: "pillar", symmetry: true },
    { name: "railings", role: "detail", shapeHint: "bar", symmetry: true },
  ],
  arch: [
    { name: "pillars", role: "primary", shapeHint: "pillar", symmetry: true },
    { name: "keystone", role: "secondary", shapeHint: "dome", symmetry: false },
    { name: "trim", role: "detail", shapeHint: "trim", symmetry: false },
  ],
  stair: [
    { name: "base", role: "primary", shapeHint: "foundation", symmetry: false },
    { name: "steps", role: "secondary", shapeHint: "platform", symmetry: false },
    { name: "railing", role: "detail", shapeHint: "bar", symmetry: true },
  ],
};

/**
 * Build a structure-archetype object with children.
 * Dispatches to type-specific part lists for better visual results.
 */
export function buildStructureStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  // Use LLM parts if provided, otherwise look up type-specific parts
  const useParts = parts && parts.length > 0
    ? parts
    : TYPE_PARTS[structure.type] || BUILDING_PARTS;

  const archetype = structure.type === "tower" || structure.type === "clockTower" ? "tower" : "structure";
  const totalH = estimateTotalHeight(archetype);
  const children = buildObjectFromParts(structure.id, useParts, archetype, theme, totalH);

  return { ...structure, children };
}
