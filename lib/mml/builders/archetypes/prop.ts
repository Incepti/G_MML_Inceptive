/**
 * Prop / generic archetype builder.
 *
 * Handles all archetypes that don't have a dedicated builder:
 * tool, weapon, creature, machine, container, nature, lighting, prop, abstract.
 *
 * Delegates to procedural.ts's inferPartsFromArchetype for type-appropriate
 * part lists, then builds geometry via buildObjectFromParts.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import {
  buildObjectFromParts,
  inferPartsFromArchetype,
  estimateTotalHeight,
} from "@/lib/blueprint/procedural";

/**
 * Maps BlueprintStructure types to procedural archetypes.
 * Used when no explicit archetype is provided.
 */
const TYPE_TO_ARCHETYPE: Record<string, string> = {
  barrel: "container",
  crate: "container",
  tree: "nature",
  rock: "nature",
  lamp: "lighting",
  sign: "prop",
  pillar: "prop",
  bench: "furniture",
  table: "furniture",
  chair: "furniture",
  prop: "prop",
  custom: "prop",
  roof: "prop",
  floor: "prop",
  door: "prop",
  window: "prop",
  water: "nature",
  light: "lighting",
};

/**
 * Build a generic/prop structure with children.
 * If the structure already has children or geometry, returns it unchanged.
 */
export function buildPropStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  archetype: string | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }
  if (structure.lightProps || structure.label || structure.type === "light") {
    return structure;
  }

  const resolvedArchetype = archetype || TYPE_TO_ARCHETYPE[structure.type] || "prop";
  const useParts = parts && parts.length > 0 ? parts : inferPartsFromArchetype(resolvedArchetype);
  const totalH = estimateTotalHeight(resolvedArchetype);
  const children = buildObjectFromParts(structure.id, useParts, resolvedArchetype, theme, totalH);

  if (children.length > 0) {
    return { ...structure, children };
  }

  return structure;
}
