/**
 * Furniture archetype builder.
 *
 * Generates structured BlueprintStructure children for furniture-type objects:
 * chairs, tables, desks, beds, shelves, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

/** Enhanced default parts for furniture when LLM provides none. */
const FURNITURE_PARTS: BlueprintPart[] = [
  { name: "frame", role: "primary", shapeHint: "frame", symmetry: false },
  { name: "surface", role: "secondary", shapeHint: "surface", symmetry: false },
  { name: "backrest", role: "secondary", shapeHint: "panel", symmetry: false },
  { name: "legs", role: "support", shapeHint: "leg", symmetry: true },
  { name: "rear-legs", role: "support", shapeHint: "leg", symmetry: true },
  { name: "cross-bar", role: "detail", shapeHint: "bar", symmetry: false },
  { name: "trim", role: "detail", shapeHint: "trim", symmetry: false },
];

/**
 * Build a furniture structure with children.
 * If the structure already has children or geometry, returns it unchanged.
 */
export function buildFurnitureStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  const useParts = parts && parts.length > 0 ? parts : FURNITURE_PARTS;
  const totalH = estimateTotalHeight("furniture");
  const children = buildObjectFromParts(structure.id, useParts, "furniture", theme, totalH);

  return { ...structure, children };
}
