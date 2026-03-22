/**
 * Biome-specific AI prompt builder.
 * Generates a system prompt that teaches the AI how to create dense, layered biome environments.
 */

import { ALPHA_RULES, STRUCTURE_FORMAT } from "@/lib/llm/prompts";
import { BIOME_PRESETS, type BiomePreset } from "./presets";

export function buildBiomeSystemPrompt(biomeId: string, customization?: string): string {
  const preset = BIOME_PRESETS.find((b) => b.id === biomeId);
  if (!preset) {
    return buildGenericBiomePrompt();
  }
  return buildPresetBiomePrompt(preset, customization);
}

function buildPresetBiomePrompt(preset: BiomePreset, customization?: string): string {
  return `You are a BIOME ENVIRONMENT GENERATOR for MML Alpha.
You generate dense, detailed, immersive 3D environments — NOT simple scenes with a few objects.

${ALPHA_RULES}
${STRUCTURE_FORMAT}

═══════════════════════════════════════════════════════════════
BIOME: ${preset.name.toUpperCase()}
═══════════════════════════════════════════════════════════════

Description: ${preset.description}
Lighting: ${preset.lightingHint}
${customization ? `User customization: ${customization}` : ""}

## LAYERED COMPOSITION (MANDATORY)

Build the environment in 4 layers. EVERY layer must have objects:

### LAYER 1 — GROUND COVER (y=0 to y=0.3)
Keywords: ${preset.layers.ground.join(", ")}
Place 15-20 ground-level elements scattered across the scene.
Use small scale (sx/sy/sz = 0.3–0.8). Spread across all 9 zones.

### LAYER 2 — MID-LEVEL (y=0 to y=1.5)
Keywords: ${preset.layers.mid.join(", ")}
Place 12-18 medium objects. Mix of clusters and solo placements.
Scale range: 0.5–1.5.

### LAYER 3 — TALL / DOMINANT (y=0, large scale)
Keywords: ${preset.layers.tall.join(", ")}
Place 8-12 large landmark elements. These define the silhouette.
Scale range: 1.0–3.0. Space them to create depth and framing.

### LAYER 4 — ATMOSPHERIC (lights + accents)
Keywords: ${preset.layers.atmospheric.join(", ")}
Place 3-6 lights (point or spot) to match the biome mood.
Add 2-4 emissive accent objects for glow effects.

## ASSET STRATEGY

Use modelTags for EVERY structure. The asset resolver will find the right 3D model.
For Otherside assets, the FIRST modelTag MUST be "otherside".

Preferred Otherside subcategories for this biome:
${preset.othersideSubcats.map((s) => `  - ${s}`).join("\n")}

Preferred GCS categories:
${preset.gcsCategories.map((c) => `  - ${c}`).join("\n")}

Mix assets from BOTH sources. Use "otherside" as first tag for fantasy/alien elements.
Use regular tags for realistic elements (trees, rocks, buildings).

## PLACEMENT RULES

- Use the 9-zone grid: NW, N, NE, W, C, E, SW, S, SE
- Dense center, natural density falloff toward edges
- Create CLUSTERS — groups of 3-5 related objects close together
- Vary rotation (ry) for natural randomness: 0, 45, 90, 135, 180, 225, 270, 315
- Vary scale slightly within each layer for organic feel
- X range: -15 to 15, Z range: -15 to 15

## TARGET: ${preset.density}+ structures total

NEVER add a ground plane or floor. The environment provides one.
NEVER use geometry for objects that should be models — use modelTags instead.

## RETURN FORMAT — strict JSON, no markdown
{
  "type": "NEW_SCENE",
  "blueprint": {
    "type": "scene",
    "intent": { "name": "${preset.name}", "archetype": "environment" },
    "style": { "theme": "fantasy", "detailLevel": "high" },
    "composition": { "focus": "immersion", "symmetry": false },
    "meta": { "title": "${preset.name} Biome", "sceneScale": "large", "seed": "biome1" },
    "budgets": { "maxLights": 8, "maxModels": 200, "maxEntities": 1000 },
    "scene": {
      "rootId": "root",
      "structures": [ ...all structures here... ]
    }
  },
  "explain": {
    "reasoning": ["..."],
    "blueprintSummary": ["${preset.name}: N structures across 4 layers"]
  }
}

Output ONLY the JSON.`;
}

function buildGenericBiomePrompt(): string {
  return `You are a BIOME ENVIRONMENT GENERATOR for MML Alpha.
You generate dense, detailed, immersive 3D environments.

${ALPHA_RULES}
${STRUCTURE_FORMAT}

Generate a rich natural environment with 50+ structures across 4 layers:
1. Ground cover (15-20 small objects at y=0)
2. Mid-level (12-18 medium objects)
3. Tall/dominant (8-12 large landmarks)
4. Atmospheric (3-6 lights + emissive accents)

Use modelTags for all structures. For Otherside assets, first tag must be "otherside".
NEVER add a ground plane or floor.

Return a NEW_SCENE JSON response. No markdown.`;
}
