/**
 * Nature archetype builder.
 *
 * Generates structured BlueprintStructure children for nature-type objects:
 * trees, rocks, bushes, flowers, mushrooms, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

const TREE_PARTS: BlueprintPart[] = [
  { name: "trunk", role: "primary", shapeHint: "trunk", symmetry: false },
  { name: "canopy", role: "secondary", shapeHint: "canopy", symmetry: false },
  { name: "base", role: "support", shapeHint: "base", symmetry: false },
];

const ROCK_PARTS: BlueprintPart[] = [
  { name: "body", role: "primary", shapeHint: "body", symmetry: false },
  { name: "top", role: "secondary", shapeHint: "dome", symmetry: false },
];

const BUSH_PARTS: BlueprintPart[] = [
  { name: "foliage", role: "primary", shapeHint: "canopy", symmetry: false },
  { name: "base", role: "support", shapeHint: "base", symmetry: false },
];

const MUSHROOM_PARTS: BlueprintPart[] = [
  { name: "stem", role: "primary", shapeHint: "shaft", symmetry: false },
  { name: "cap", role: "secondary", shapeHint: "dome", symmetry: false },
  { name: "base", role: "support", shapeHint: "stand", symmetry: false },
];

function detectNatureSubtype(s: BlueprintStructure): BlueprintPart[] {
  const id = s.id.toLowerCase();
  const tags = s.modelTags?.map((t) => t.toLowerCase()) || [];
  const all = [id, s.type, ...tags].join(" ");

  if (/\b(tree|palm|pine|oak|birch|willow|maple|cedar)\b/.test(all)) {
    return TREE_PARTS;
  }
  if (/\b(rock|boulder|stone|pebble|crystal|gem|stalagmite)\b/.test(all)) {
    return ROCK_PARTS;
  }
  if (/\b(bush|shrub|hedge|flower|fern|vine|grass)\b/.test(all)) {
    return BUSH_PARTS;
  }
  if (/\b(mushroom|fungus|toadstool)\b/.test(all)) {
    return MUSHROOM_PARTS;
  }
  return TREE_PARTS;
}

export function buildNatureStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  const useParts = parts && parts.length > 0
    ? parts
    : detectNatureSubtype(structure);
  const totalH = estimateTotalHeight("nature");
  const children = buildObjectFromParts(structure.id, useParts, "nature", theme, totalH);

  return { ...structure, children };
}
