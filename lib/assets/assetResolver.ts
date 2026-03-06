/**
 * Enhanced Asset Resolver — model-first pipeline with persistent caching.
 *
 * Resolution order (STEP 9 from spec):
 *   1. Local library (ENVIRONMENT_CATALOG + TRUSTED_ASSETS) — sync
 *   2. Database models (model_library table) — async
 *   3. Generated models (text-to-3D API) — async
 *   4. Procedural builder (handled downstream) — sync
 *   5. Primitive fallback (handled downstream) — sync
 *
 * This module provides the async pre-processing step that enriches blueprints
 * with model URLs before the sync pipeline (builder → serializer) runs.
 *
 * The existing sync resolver at lib/mml/assets/assetResolver.ts handles
 * step 1 and remains unchanged. This module wraps it and adds steps 2-3.
 *
 * Determinism: model selection uses fnv1a(seed + structureId) for
 * deterministic picks from the library. Same seed → same model.
 *
 * Scene decomposition: resolves each structure individually.
 * Never generates a single model for the entire scene.
 */

import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";
import type { ModelLibraryEntry } from "@/types/assets";
import {
  resolveAsset as resolveLocalAsset,
  classifyAssetCategory,
} from "@/lib/mml/assets/assetResolver";
import {
  findModels,
  shouldGenerateModel,
  selectModelDeterministic,
  recordModelUsage,
} from "@/lib/assets/assetLibrary";
import {
  generateModel,
  isGenerationAvailable,
} from "@/lib/assets/modelGenerator";

// ─── FNV-1a (duplicated from assetLibrary for standalone use) ───────────────

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// ─── Structure analysis helpers ─────────────────────────────────────────────

/**
 * Check if a structure should be skipped for model resolution.
 */
function shouldSkipResolution(s: BlueprintStructure): boolean {
  // Already has a model URL
  if (s.modelSrc) return true;
  // Has explicit geometry (primitive)
  if (s.geometry) return true;
  // Has children (composite structure)
  if (s.children && s.children.length > 0) return true;
  // Is a light
  if (s.type === "light" || s.lightProps) return true;
  return false;
}

/**
 * Extract search keywords from a structure's type, id, and optional model hints.
 */
function extractKeywords(s: BlueprintStructure): string[] {
  const keywords: string[] = [];

  // Model hints from the blueprint (highest priority)
  if (s.modelTags && s.modelTags.length > 0) {
    keywords.push(...s.modelTags);
  }

  // Structure type
  keywords.push(s.type);

  // Structure id (if different from type)
  if (s.id !== s.type) {
    // Extract meaningful words from composite IDs like "guard-tower-nw"
    const parts = s.id.split(/[-_]/);
    for (const part of parts) {
      if (part.length > 2 && part !== s.type) {
        keywords.push(part);
      }
    }
  }

  return [...new Set(keywords.map((k) => k.toLowerCase()))];
}

/**
 * Determine the category for a structure.
 * Uses the shared classifyAssetCategory from the sync resolver
 * to ensure consistent classification across both pipelines.
 */
function resolveCategory(s: BlueprintStructure): string {
  if (s.modelCategory) return s.modelCategory;
  return classifyAssetCategory(s.type, s.modelTags);
}

// ─── Single structure resolution (async) ────────────────────────────────────

/**
 * Attempt to resolve a single structure to a model URL.
 *
 * Pipeline:
 *   1. Local catalog (sync, via existing resolver)
 *   2. Database model library (async)
 *   3. Text-to-3D generation (async, if enabled and under cache limit)
 *
 * Returns the structure with modelSrc set, or unchanged if no model found.
 */
async function resolveStructureAsync(
  s: BlueprintStructure,
  seed: string,
): Promise<BlueprintStructure> {
  if (shouldSkipResolution(s)) return s;

  const keywords = extractKeywords(s);
  const category = resolveCategory(s);
  const structureSeed = `${seed}:${s.id}`;

  // ── Step 1: Local catalog (ENVIRONMENT_CATALOG + TRUSTED_ASSETS) ──
  // Pass category to enforce strict same-category matching
  const assetCategory = classifyAssetCategory(s.type, s.modelTags);
  const localMatch = resolveLocalAsset(keywords, assetCategory);
  if (localMatch) {
    return {
      ...s,
      modelSrc: localMatch.modelUrl,
      transform: {
        ...s.transform,
        sx: s.transform.sx !== 1 ? s.transform.sx : localMatch.defaultScale,
        sy: s.transform.sy !== 1 ? s.transform.sy : localMatch.defaultScale,
        sz: s.transform.sz !== 1 ? s.transform.sz : localMatch.defaultScale,
      },
    };
  }

  // ── Step 2: Database model library ──
  const primaryName = s.modelTags?.[0] || s.type;
  const dbModels = await findModels({ name: primaryName, category });

  if (dbModels.length > 0) {
    const selected = selectModelDeterministic(dbModels, structureSeed);
    // Fire-and-forget usage tracking (don't block rendering)
    recordModelUsage(selected.id).catch(() => {});
    return {
      ...s,
      modelSrc: selected.modelUrl,
    };
  }

  // ── Step 3: Generate new model (if enabled and under cache limit) ──
  if (isGenerationAvailable()) {
    const canGenerate = await shouldGenerateModel(primaryName);
    if (canGenerate) {
      const generated = await generateModel({
        name: primaryName,
        prompt: keywords.join(", "),
        category,
        tags: keywords,
      });

      if (generated) {
        return {
          ...s,
          modelSrc: generated.modelUrl,
        };
      }
    }
  }

  // Steps 4-5 (procedural builder / primitive fallback) are handled
  // downstream by the existing sync pipeline.
  return s;
}

// ─── Blueprint-level resolution (async) ─────────────────────────────────────

/**
 * Resolve assets for all structures in a blueprint using the full
 * model-first pipeline. This is the async pre-processing step.
 *
 * Each structure is resolved individually (scene decomposition).
 * Structures are processed concurrently for performance.
 *
 * After this step, structures with modelSrc will skip the procedural builder
 * and render directly as <m-model> in the serializer.
 */
export async function resolveAssetsAsync(
  blueprint: BlueprintJSON,
): Promise<BlueprintJSON> {
  const seed = blueprint.meta?.seed || "default-seed";

  // Resolve all structures concurrently
  const resolvedStructures = await Promise.all(
    blueprint.scene.structures.map((s) => resolveStructureAsync(s, seed)),
  );

  return {
    ...blueprint,
    scene: {
      ...blueprint.scene,
      structures: resolvedStructures,
    },
  };
}

/**
 * Resolve assets for a single structure (useful for incremental updates).
 */
export async function resolveStructureAssetAsync(
  structure: BlueprintStructure,
  seed: string,
): Promise<BlueprintStructure> {
  return resolveStructureAsync(structure, seed);
}
