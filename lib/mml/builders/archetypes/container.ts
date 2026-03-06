/**
 * Container archetype builder.
 *
 * Generates structured BlueprintStructure children for container-type objects:
 * barrels, crates, chests, boxes, urns, pots, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

/** Default parts for a generic container. */
const CONTAINER_PARTS: BlueprintPart[] = [
  { name: "body", role: "primary", shapeHint: "body", symmetry: false },
  { name: "rim", role: "secondary", shapeHint: "rim", symmetry: false },
  { name: "base", role: "support", shapeHint: "stand", symmetry: false },
  { name: "bands", role: "detail", shapeHint: "band", symmetry: false },
];

/** Barrel-specific parts (cylindrical containers). */
const BARREL_PARTS: BlueprintPart[] = [
  { name: "body", role: "primary", shapeHint: "shaft", symmetry: false },
  { name: "top-rim", role: "secondary", shapeHint: "rim", symmetry: false },
  { name: "bottom-rim", role: "support", shapeHint: "rim", symmetry: false },
  { name: "bands", role: "detail", shapeHint: "band", symmetry: false },
];

/** Chest/box parts (rectangular containers). */
const CHEST_PARTS: BlueprintPart[] = [
  { name: "body", role: "primary", shapeHint: "body", symmetry: false },
  { name: "lid", role: "secondary", shapeHint: "cap", symmetry: false },
  { name: "base", role: "support", shapeHint: "base", symmetry: false },
  { name: "latch", role: "detail", shapeHint: "connector", symmetry: false },
  { name: "hinges", role: "detail", shapeHint: "connector", symmetry: true },
];

function detectContainerSubtype(s: BlueprintStructure): BlueprintPart[] {
  const id = s.id.toLowerCase();
  const tags = s.modelTags?.map((t) => t.toLowerCase()) || [];
  const all = [id, ...tags].join(" ");

  if (/\b(barrel|keg|drum|cask|vat|tank)\b/.test(all)) {
    return BARREL_PARTS;
  }
  if (/\b(chest|trunk|coffer|strongbox|safe|toolbox)\b/.test(all)) {
    return CHEST_PARTS;
  }
  return CONTAINER_PARTS;
}

export function buildContainerStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  const useParts = parts && parts.length > 0
    ? parts
    : detectContainerSubtype(structure);
  const totalH = estimateTotalHeight("container");
  const children = buildObjectFromParts(structure.id, useParts, "container", theme, totalH);

  return { ...structure, children };
}
