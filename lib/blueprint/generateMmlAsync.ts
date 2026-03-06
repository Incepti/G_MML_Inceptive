/**
 * MML Generation — async, server-only (model-first pipeline).
 *
 * Pipeline: Blueprint → Full Asset Resolver → Builder → Serializer → MML
 * Checks DB model library, generates new models if needed, then
 * falls through to the sync pipeline for remaining structures.
 *
 * SERVER-ONLY: imports Node.js modules (sharp, database).
 * Do NOT import this from client components.
 */

import type { BlueprintJSON } from "@/types/blueprint";
import { resolveAssets } from "@/lib/mml/assets/assetResolver";
import { resolveAssetsAsync } from "@/lib/assets/assetResolver";
import { buildObjectStructures } from "@/lib/mml/builders/buildObjectStructures";
import { buildSceneStructures } from "@/lib/mml/builders/buildSceneStructures";
import { serializeScene } from "@/lib/mml/serializer/serializeScene";

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
