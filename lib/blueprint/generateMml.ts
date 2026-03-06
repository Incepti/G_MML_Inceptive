/**
 * MML Generation Dispatcher.
 *
 * Two entry points:
 *
 * 1. `generateMml(blueprint)` — SYNC
 *    Pipeline: Blueprint → Local Asset Resolver → Builder → Serializer → MML
 *    Deterministic pure function. Uses only local catalogs.
 *
 * 2. `generateMmlAsync(blueprint)` — ASYNC (model-first)
 *    Pipeline: Blueprint → Full Asset Resolver → Builder → Serializer → MML
 *    Checks DB model library, generates new models if needed, then
 *    falls through to the sync pipeline for remaining structures.
 *
 * Both produce the same MML output for structures with modelSrc.
 * The async version just resolves more structures to models.
 */

import type { BlueprintJSON } from "@/types/blueprint";
import { resolveAssets } from "@/lib/mml/assets/assetResolver";
import { resolveAssetsAsync } from "@/lib/assets/assetResolver";
import { buildObjectStructures } from "@/lib/mml/builders/buildObjectStructures";
import { buildSceneStructures } from "@/lib/mml/builders/buildSceneStructures";
import { serializeScene } from "@/lib/mml/serializer/serializeScene";

/**
 * Generate MML from a BlueprintJSON (sync).
 *
 * Uses only local catalogs (ENVIRONMENT_CATALOG + TRUSTED_ASSETS).
 * Deterministic — same blueprint → same MML, always.
 */
export function generateMml(blueprint: BlueprintJSON): string {
  // Step 1 — Asset resolution: local catalog matching only
  const resolved = resolveAssets(blueprint);

  // Step 2 — Build: expand remaining bare structures with procedural geometry
  const built = resolved.type === "object"
    ? buildObjectStructures(resolved)
    : buildSceneStructures(resolved);

  // Step 3 — Serialize: convert built structures to MML string
  return serializeScene(built);
}

/**
 * Generate MML from a BlueprintJSON (async, model-first).
 *
 * Full pipeline:
 *   1. Async asset resolver (DB library + model generation + local catalog)
 *   2. Sync local resolver (catches anything async missed)
 *   3. Procedural builder (expands remaining bare structures)
 *   4. Serializer (MML string output)
 *
 * Models are prioritized over primitives. Generated models are cached
 * in the model library for reuse across sessions.
 */
export async function generateMmlAsync(blueprint: BlueprintJSON): Promise<string> {
  // Step 1 — Async asset resolution: DB + generation + local catalog
  const asyncResolved = await resolveAssetsAsync(blueprint);

  // Step 2 — Sync local resolution: catch any remaining matches
  const resolved = resolveAssets(asyncResolved);

  // Step 3 — Build: expand remaining bare structures with procedural geometry
  const built = resolved.type === "object"
    ? buildObjectStructures(resolved)
    : buildSceneStructures(resolved);

  // Step 4 — Serialize: convert built structures to MML string
  return serializeScene(built);
}
