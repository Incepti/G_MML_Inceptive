/**
 * Prompt builder for Otherside models — injected when user mentions "otherside".
 * Keep in sync with otherside-catalog.ts (auto-generated).
 */

import { OTHERSIDE_CATALOG, OTHERSIDE_SUBCATEGORIES } from "./otherside-catalog";

export function buildOthersideCatalogPrompt(): string {
  const grouped: Record<string, string[]> = {};
  for (const a of OTHERSIDE_CATALOG) {
    (grouped[a.subcategory] ??= []).push(a.name);
  }

  const lines: string[] = [
    `## OTHERSIDE MODELS — ${OTHERSIDE_CATALOG.length} fantasy/alien GLB models`,
    "",
    "██ MANDATORY RULE: When the user mentions 'otherside', ALL models MUST use the Otherside catalog. ██",
    '██ The FIRST modelTag MUST be exactly "otherside". Without this, the resolver CANNOT find Otherside models. ██',
    "",
    "NEVER use generic GCS tags (like 'tree', 'rock') for Otherside requests.",
    "NEVER mix GCS and Otherside models when the user asks for Otherside.",
    'EVERY structure that needs a model MUST have modelTags starting with "otherside".',
    "",
    'Format: "modelTags": ["otherside", "<specific-name>", "<biome-or-style>"]',
    "",
    "Examples:",
    '  "add a tree from otherside"      → "modelTags": ["otherside", "tree", "jungle"]',
    '  "add otherside crystal"           → "modelTags": ["otherside", "crystal", "gem"]',
    '  "bioluminescent plant otherside"  → "modelTags": ["otherside", "plant", "bioluminescent"]',
    '  "otherside creature"              → "modelTags": ["otherside", "creature", "acid"]',
    "",
    "Available subcategories and sample model names:",
  ];

  for (const subcat of OTHERSIDE_SUBCATEGORIES) {
    const samples = (grouped[subcat] ?? []).slice(0, 4).join(", ");
    lines.push(`  ${subcat.replace(/_/g, " ")}: ${samples}`);
  }

  return lines.join("\n");
}
