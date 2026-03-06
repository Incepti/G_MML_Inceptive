/**
 * Weapon archetype builder.
 *
 * Generates structured BlueprintStructure children for weapon-type objects:
 * swords, shields, axes, bows, guns, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

const SWORD_PARTS: BlueprintPart[] = [
  { name: "blade", role: "primary", shapeHint: "blade", symmetry: false },
  { name: "handle", role: "secondary", shapeHint: "handle", symmetry: false },
  { name: "guard", role: "support", shapeHint: "connector", symmetry: false },
  { name: "pommel", role: "detail", shapeHint: "rim", symmetry: false },
];

const SHIELD_PARTS: BlueprintPart[] = [
  { name: "face", role: "primary", shapeHint: "panel", symmetry: false },
  { name: "rim", role: "secondary", shapeHint: "rim", symmetry: false },
  { name: "boss", role: "detail", shapeHint: "dome", symmetry: false },
  { name: "grip", role: "support", shapeHint: "handle", symmetry: false },
];

const BOW_PARTS: BlueprintPart[] = [
  { name: "limb", role: "primary", shapeHint: "arm", symmetry: false },
  { name: "grip", role: "secondary", shapeHint: "handle", symmetry: false },
  { name: "tips", role: "detail", shapeHint: "spike", symmetry: true },
];

const DEFAULT_WEAPON_PARTS: BlueprintPart[] = [
  { name: "handle", role: "primary", shapeHint: "handle", symmetry: false },
  { name: "blade", role: "secondary", shapeHint: "blade", symmetry: false },
  { name: "guard", role: "support", shapeHint: "connector", symmetry: false },
  { name: "pommel", role: "detail", shapeHint: "rim", symmetry: false },
];

function detectWeaponSubtype(s: BlueprintStructure): BlueprintPart[] {
  const id = s.id.toLowerCase();
  const tags = s.modelTags?.map((t) => t.toLowerCase()) || [];
  const all = [id, ...tags].join(" ");

  if (/\b(sword|dagger|katana|rapier|saber|scimitar|machete)\b/.test(all)) {
    return SWORD_PARTS;
  }
  if (/\b(shield|buckler)\b/.test(all)) {
    return SHIELD_PARTS;
  }
  if (/\b(bow|longbow|crossbow|slingshot)\b/.test(all)) {
    return BOW_PARTS;
  }
  return DEFAULT_WEAPON_PARTS;
}

export function buildWeaponStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  const useParts = parts && parts.length > 0
    ? parts
    : detectWeaponSubtype(structure);
  const totalH = estimateTotalHeight("weapon");
  const children = buildObjectFromParts(structure.id, useParts, "weapon", theme, totalH);

  return { ...structure, children };
}
