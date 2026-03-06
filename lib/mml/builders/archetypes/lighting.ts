/**
 * Lighting archetype builder.
 *
 * Generates structured BlueprintStructure children for lighting-type objects:
 * lamps, chandeliers, lanterns, torches, candles, streetlights, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

const DEFAULT_LIGHTING_PARTS: BlueprintPart[] = [
  { name: "base", role: "primary", shapeHint: "stand", symmetry: false },
  { name: "pole", role: "primary", shapeHint: "pole", symmetry: false },
  { name: "shade", role: "secondary", shapeHint: "cap", symmetry: false },
  { name: "bulb", role: "detail", shapeHint: "light", symmetry: false },
];

export function buildLightingStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }
  // Skip actual light elements (they have lightProps and render as m-light)
  if (structure.lightProps || structure.type === "light") {
    return structure;
  }

  const useParts = parts && parts.length > 0 ? parts : DEFAULT_LIGHTING_PARTS;
  const totalH = estimateTotalHeight("lighting");
  const children = buildObjectFromParts(structure.id, useParts, "lighting", theme, totalH);

  return { ...structure, children };
}
