/**
 * MML Generation Dispatcher.
 *
 * Pipeline: Blueprint → Builder → Serializer → MML
 *
 * This module detects object mode vs scene mode, calls the appropriate
 * builder to expand structures with procedural geometry, then passes
 * the fully-built blueprint to the serializer for MML string output.
 *
 * Deterministic pure function — same blueprint → same MML, always.
 */

import type { BlueprintJSON } from "@/types/blueprint";
import { buildObjectStructures } from "@/lib/mml/builders/buildObjectStructures";
import { buildSceneStructures } from "@/lib/mml/builders/buildSceneStructures";
import { serializeScene } from "@/lib/mml/serializer";

/**
 * Generate MML from a BlueprintJSON.
 *
 * 1. Detect mode (object vs scene)
 * 2. Call the appropriate builder to expand structures
 * 3. Serialize the built blueprint to MML string
 */
export function generateMml(blueprint: BlueprintJSON): string {
  // Step 1 — Build: expand structures with procedural geometry
  const built = blueprint.type === "object"
    ? buildObjectStructures(blueprint)
    : buildSceneStructures(blueprint);

  // Step 2 — Serialize: convert built structures to MML string
  return serializeScene(built);
}
