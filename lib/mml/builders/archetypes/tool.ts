/**
 * Tool archetype builder.
 *
 * Generates structured BlueprintStructure children for tool-type objects:
 * hammers, wrenches, shovels, keys, telescopes, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

const DEFAULT_TOOL_PARTS: BlueprintPart[] = [
  { name: "handle", role: "primary", shapeHint: "handle", symmetry: false },
  { name: "head", role: "secondary", shapeHint: "body", symmetry: false },
  { name: "connector", role: "support", shapeHint: "connector", symmetry: false },
  { name: "detail", role: "detail", shapeHint: "band", symmetry: false },
];

export function buildToolStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  const useParts = parts && parts.length > 0 ? parts : DEFAULT_TOOL_PARTS;
  const totalH = estimateTotalHeight("tool");
  const children = buildObjectFromParts(structure.id, useParts, "tool", theme, totalH);

  return { ...structure, children };
}
