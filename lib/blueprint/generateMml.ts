/**
 * MML Generation Dispatcher.
 *
 * Pipeline: Blueprint → Asset Resolver → Builder → Serializer → MML
 *
 * 1. Asset Resolver: attempts to match structures to verified 3D models
 * 2. Builder: expands remaining bare structures with procedural geometry
 * 3. Serializer: converts fully-built structures to MML string
 *
 * Deterministic pure function — same blueprint → same MML, always.
 */

import type { BlueprintJSON } from "@/types/blueprint";
import { resolveAssets } from "@/lib/mml/assets/assetResolver";
import { buildObjectStructures } from "@/lib/mml/builders/buildObjectStructures";
import { buildSceneStructures } from "@/lib/mml/builders/buildSceneStructures";
import { serializeScene } from "@/lib/mml/serializer/serializeScene";

/**
 * Generate MML from a BlueprintJSON.
 *
 * 1. Resolve assets (model-first strategy)
 * 2. Build: expand remaining structures with procedural geometry
 * 3. Serialize: convert to MML string
 */
export function generateMml(blueprint: BlueprintJSON): string {
  // Step 1 — Asset resolution: match structures to verified models
  const resolved = resolveAssets(blueprint);

  // Step 2 — Build: expand remaining bare structures with procedural geometry
  const built = resolved.type === "object"
    ? buildObjectStructures(resolved)
    : buildSceneStructures(resolved);

  // Step 3 — Serialize: convert built structures to MML string
  return serializeScene(built);
}
