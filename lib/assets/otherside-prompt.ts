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
    'When the user requests Otherside models, set "otherside" as the FIRST modelTag.',
    "The asset resolver will search the Otherside catalog (NOT the GCS catalog).",
    "",
    "CRITICAL: Do NOT use generic GCS tags for Otherside requests.",
    'Always lead modelTags with "otherside": ["otherside", "<type>", "<biome>"]',
    "",
    "Examples:",
    '  Tree from otherside  → "modelTags": ["otherside", "tree", "jungle"]',
    '  Crystal structure    → "modelTags": ["otherside", "crystal", "gem"]',
    '  Bioluminescent plant → "modelTags": ["otherside", "plant", "bioluminescent"]',
    '  Creature             → "modelTags": ["otherside", "creature", "acid"]',
    "",
    "Available subcategories and sample model names:",
  ];

  for (const subcat of OTHERSIDE_SUBCATEGORIES) {
    const samples = (grouped[subcat] ?? []).slice(0, 4).join(", ");
    lines.push(`  ${subcat.replace(/_/g, " ")}: ${samples}`);
  }

  return lines.join("\n");
}
