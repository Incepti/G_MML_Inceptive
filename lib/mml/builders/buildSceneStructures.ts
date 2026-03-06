/**
 * Scene Builder — expands a scene/environment blueprint into detailed structures.
 *
 * Pipeline position: Blueprint → [Builder] → Serializer → MML
 *
 * Responsibilities:
 * - Enhance bare structures (no children/geometry) with procedural geometry
 * - Ensure consistent ground plane
 * - Ensure lighting is present
 * - Enforce grounding
 *
 * Does NOT alter scene semantics — structure positions, zones, and pathways
 * are preserved exactly as the LLM produced them.
 *
 * Deterministic — same blueprint → same output.
 */

import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";
import { buildVehicleStructure } from "./archetypes/vehicle";
import { buildFurnitureStructure } from "./archetypes/furniture";
import { buildStructureStructure } from "./archetypes/structure";
import { buildPropStructure } from "./archetypes/prop";
import { buildCreatureStructure } from "./archetypes/creature";
import { buildMachineStructure } from "./archetypes/machine";
import { buildContainerStructure } from "./archetypes/container";
import { buildNatureStructure } from "./archetypes/nature";
import { buildWeaponStructure } from "./archetypes/weapon";
import { buildToolStructure } from "./archetypes/tool";
import { buildLightingStructure } from "./archetypes/lighting";

/**
 * Expand a scene-mode blueprint's structures with procedural geometry.
 * Returns a new BlueprintJSON with enhanced structures.
 */
export function buildSceneStructures(blueprint: BlueprintJSON): BlueprintJSON {
  const theme = blueprint.style?.theme || "neutral";

  // Enhance each structure based on its type
  let structures = blueprint.scene.structures.map((s) =>
    enhanceSceneStructure(s, theme)
  );

  // Enforce grounding
  structures = enforceGrounding(structures);

  // Ensure lighting exists
  const result = ensureLighting({ ...blueprint, scene: { ...blueprint.scene, structures } });

  return result;
}

// ─── Per-structure enhancement ───────────────────────────────────────────────

/**
 * Maps structure types to their builder archetype for scene contexts.
 */
const TYPE_TO_BUILDER: Record<string, string> = {
  vehicle: "vehicle",
  tower: "tower",
  clockTower: "tower",
  building: "structure",
  room: "structure",
  gate: "structure",
  arch: "structure",
  stair: "structure",
  bridge: "structure",
  wall: "structure",
  fence: "structure",
  door: "structure",
  window: "structure",
  pillar: "structure",
  bench: "furniture",
  table: "furniture",
  chair: "furniture",
  furniture: "furniture",
  creature: "creature",
  machine: "machine",
  barrel: "container",
  crate: "container",
  container: "container",
  tree: "nature",
  rock: "nature",
  water: "nature",
  nature: "nature",
  lamp: "lighting",
  weapon: "weapon",
  tool: "tool",
};

function enhanceSceneStructure(
  s: BlueprintStructure,
  theme: string,
): BlueprintStructure {
  // Skip lights — they don't need geometry
  if (s.type === "light" || s.lightProps) return s;

  // Already has children — recurse to enhance bare descendants
  if (s.children && s.children.length > 0) {
    return {
      ...s,
      children: s.children.map((c) => enhanceSceneStructure(c, theme)),
    };
  }

  // Already has geometry or model — leave it
  if (s.geometry || s.modelSrc) return s;

  // Bare structure — dispatch to the appropriate archetype builder
  const builderType = TYPE_TO_BUILDER[s.type];
  let built: BlueprintStructure;

  switch (builderType) {
    case "vehicle":
      built = buildVehicleStructure(s, undefined, theme); break;
    case "furniture":
      built = buildFurnitureStructure(s, undefined, theme); break;
    case "structure":
    case "tower":
      built = buildStructureStructure(s, undefined, theme); break;
    case "creature":
      built = buildCreatureStructure(s, undefined, theme); break;
    case "machine":
      built = buildMachineStructure(s, undefined, theme); break;
    case "container":
      built = buildContainerStructure(s, undefined, theme); break;
    case "nature":
      built = buildNatureStructure(s, undefined, theme); break;
    case "weapon":
      built = buildWeaponStructure(s, undefined, theme); break;
    case "tool":
      built = buildToolStructure(s, undefined, theme); break;
    case "lighting":
      built = buildLightingStructure(s, undefined, theme); break;
    default:
      built = buildPropStructure(s, undefined, undefined, theme); break;
  }

  // Clear label if builder added children/geometry/model
  if (built.label && (built.children?.length || built.geometry || built.modelSrc)) {
    return { ...built, label: undefined };
  }
  return built;
}

// ─── Lighting fallback ───────────────────────────────────────────────────────

function ensureLighting(blueprint: BlueprintJSON): BlueprintJSON {
  const hasLights = blueprint.scene.structures.some(
    (s) => s.type === "light" || s.lightProps
  );

  if (hasLights) return blueprint;

  // Add default ambient lighting for scenes
  const structures = [
    ...blueprint.scene.structures,
    {
      id: "scene-light-key",
      type: "light" as const,
      transform: { x: 10, y: 15, z: -10, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
      lightProps: { type: "directional" as const, intensity: 1.0, color: "#ffffff" },
    },
    {
      id: "scene-light-fill",
      type: "light" as const,
      transform: { x: -8, y: 10, z: 8, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
      lightProps: { type: "point" as const, intensity: 0.4, color: "#E8E4DF", distance: 40 },
    },
  ];

  return { ...blueprint, scene: { ...blueprint.scene, structures } };
}

// ─── Grounding ───────────────────────────────────────────────────────────────

function enforceGrounding(structures: BlueprintStructure[]): BlueprintStructure[] {
  return structures.map((s) => {
    if (s.type === "light" || s.lightProps) return s;
    if (s.transform.y < 0) return { ...s, transform: { ...s.transform, y: 0 } };
    return s;
  });
}
