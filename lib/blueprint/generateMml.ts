/**
 * MML Generation — sync, client-safe.
 *
 * Pipeline: Blueprint → Local Asset Resolver → Builder → Serializer → MML
 * Deterministic pure function. Uses only local catalogs. No Node.js deps.
 *
 * For the async model-first pipeline, see generateMmlAsync in
 * lib/blueprint/generateMmlAsync.ts (server-only).
 */

import type { BlueprintJSON } from "@/types/blueprint";
import { resolveAssets } from "@/lib/mml/assets/assetResolver";
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
