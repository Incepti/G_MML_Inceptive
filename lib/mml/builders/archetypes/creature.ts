/**
 * Creature archetype builder.
 *
 * Generates structured BlueprintStructure children for creature-type objects:
 * animals, monsters, characters, NPCs, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

/** Default parts for a generic creature when LLM provides none. */
const CREATURE_PARTS: BlueprintPart[] = [
  { name: "torso", role: "primary", shapeHint: "torso", symmetry: false },
  { name: "head", role: "secondary", shapeHint: "head", symmetry: false },
  { name: "arms", role: "support", shapeHint: "arm", symmetry: true },
  { name: "legs", role: "support", shapeHint: "leg", symmetry: true },
  { name: "tail", role: "detail", shapeHint: "tail", symmetry: false },
];

/** Quadruped parts (for animals like dogs, cats, horses). */
const QUADRUPED_PARTS: BlueprintPart[] = [
  { name: "body", role: "primary", shapeHint: "body", symmetry: false },
  { name: "head", role: "secondary", shapeHint: "head", symmetry: false },
  { name: "front-legs", role: "support", shapeHint: "leg", symmetry: true },
  { name: "rear-legs", role: "support", shapeHint: "leg", symmetry: true },
  { name: "tail", role: "detail", shapeHint: "tail", symmetry: false },
  { name: "ears", role: "detail", shapeHint: "fin", symmetry: true },
];

/** Bird/winged creature parts. */
const WINGED_PARTS: BlueprintPart[] = [
  { name: "body", role: "primary", shapeHint: "body", symmetry: false },
  { name: "head", role: "secondary", shapeHint: "head", symmetry: false },
  { name: "wings", role: "support", shapeHint: "wing", symmetry: true },
  { name: "legs", role: "support", shapeHint: "leg", symmetry: true },
  { name: "tail", role: "detail", shapeHint: "fin", symmetry: false },
  { name: "beak", role: "detail", shapeHint: "spike", symmetry: false },
];

/** Fish/aquatic creature parts. */
const AQUATIC_PARTS: BlueprintPart[] = [
  { name: "body", role: "primary", shapeHint: "hull", symmetry: false },
  { name: "head", role: "secondary", shapeHint: "head", symmetry: false },
  { name: "dorsal-fin", role: "detail", shapeHint: "fin", symmetry: false },
  { name: "side-fins", role: "support", shapeHint: "fin", symmetry: true },
  { name: "tail-fin", role: "detail", shapeHint: "fin", symmetry: false },
];

/** Detect creature sub-type from structure id/type for better part selection. */
function detectCreatureSubtype(s: BlueprintStructure): BlueprintPart[] {
  const id = s.id.toLowerCase();
  const tags = s.modelTags?.map((t) => t.toLowerCase()) || [];
  const all = [id, ...tags].join(" ");

  if (/\b(bird|eagle|hawk|owl|parrot|crow|raven|pigeon|falcon)\b/.test(all)) {
    return WINGED_PARTS;
  }
  if (/\b(dragon|bat|griffin|pegasus|phoenix)\b/.test(all)) {
    return WINGED_PARTS;
  }
  if (/\b(fish|shark|whale|dolphin|octopus|squid|jellyfish|ray)\b/.test(all)) {
    return AQUATIC_PARTS;
  }
  if (/\b(horse|dog|cat|wolf|bear|deer|fox|rabbit|cow|pig|sheep|goat|lion|tiger|elephant)\b/.test(all)) {
    return QUADRUPED_PARTS;
  }
  if (/\b(spider|scorpion|crab|ant|beetle|insect)\b/.test(all)) {
    return QUADRUPED_PARTS;
  }
  return CREATURE_PARTS;
}

/**
 * Build a creature structure with children.
 * If the structure already has children or geometry, returns it unchanged.
 */
export function buildCreatureStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  const useParts = parts && parts.length > 0
    ? parts
    : detectCreatureSubtype(structure);
  const totalH = estimateTotalHeight("creature");
  const children = buildObjectFromParts(structure.id, useParts, "creature", theme, totalH);

  return { ...structure, children };
}
