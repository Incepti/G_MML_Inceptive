/**
 * Object Builder — expands a single-object blueprint into detailed structures.
 *
 * Pipeline position: Blueprint → [Builder] → Serializer → MML
 *
 * Responsibilities:
 * - Dispatch to archetype-specific builders (vehicle, furniture, structure, prop)
 * - Build geometry from parts[] if present
 * - Add showcase setup (lights + ground) for object mode
 * - Enforce grounding (no floating objects)
 *
 * Deterministic — same blueprint → same output.
 */

import type { BlueprintJSON, BlueprintStructure, BlueprintPart } from "@/types/blueprint";
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
 * Expand an object-mode blueprint's structures with procedural geometry.
 * Returns a new BlueprintJSON with enhanced structures.
 */
export function buildObjectStructures(blueprint: BlueprintJSON): BlueprintJSON {
  const archetype = blueprint.intent?.archetype || "prop";
  const theme = blueprint.style?.theme || "neutral";
  const parts = blueprint.parts;

  // Identify primary structure — it uses the blueprint archetype.
  // Secondary structures use their own type for builder dispatch.
  const primaryId = findPrimaryStructureId(blueprint.scene.structures);

  let structures = blueprint.scene.structures.map((s) => {
    // Skip lights — they don't need geometry
    if (s.type === "light" || s.lightProps) return s;

    const isPrimary = s.id === primaryId;
    // Dispatch to archetype-specific builder
    const built = dispatchBuilder(s, parts, archetype, theme, isPrimary);

    // Clear label if builder added children/geometry/model — prevents
    // the serializer from rendering an m-label instead of the geometry.
    if (built.label && (built.children?.length || built.geometry || built.modelSrc)) {
      return { ...built, label: undefined };
    }
    return built;
  });

  // Enforce grounding
  structures = enforceGrounding(structures);

  // Add showcase lights + ground if missing
  const result = addShowcase({ ...blueprint, scene: { ...blueprint.scene, structures } });

  return result;
}

// ─── Primary structure detection ────────────────────────────────────────────

function findPrimaryStructureId(structures: BlueprintStructure[]): string | null {
  const mainById = structures.find((s) =>
    /main|primary/i.test(s.id) && s.type !== "light"
  );
  if (mainById) return mainById.id;

  const first = structures.find((s) => s.type !== "light" && !s.lightProps);
  return first?.id ?? null;
}

// ─── Type-to-builder mapping (for secondary structures) ──────────────────────

/**
 * Maps specific structure types to their builder archetype.
 * Used for secondary structures so they get the correct builder
 * instead of inheriting the blueprint-level archetype.
 * e.g. a "tree" in a furniture blueprint should use nature builder, not furniture.
 */
const TYPE_TO_BUILDER: Record<string, string> = {
  vehicle: "vehicle",
  tower: "tower", clockTower: "tower",
  building: "structure", room: "structure", gate: "structure",
  arch: "structure", stair: "structure", bridge: "structure",
  wall: "structure", fence: "structure", door: "structure",
  window: "structure", pillar: "structure",
  bench: "furniture", table: "furniture", chair: "furniture",
  furniture: "furniture",
  creature: "creature",
  machine: "machine",
  barrel: "container", crate: "container", container: "container",
  tree: "nature", rock: "nature", water: "nature", nature: "nature",
  lamp: "lighting",
  weapon: "weapon",
  tool: "tool",
};

// ─── Archetype dispatcher ────────────────────────────────────────────────────

function dispatchBuilder(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  archetype: string,
  theme: string,
  isPrimary: boolean,
): BlueprintStructure {
  // Already fully built — leave it
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  // For secondary structures, use their own type to pick the builder.
  // This prevents a "tree" in a furniture blueprint from getting chair primitives.
  const effectiveArchetype = isPrimary
    ? archetype
    : (TYPE_TO_BUILDER[structure.type] || archetype);

  switch (effectiveArchetype) {
    case "vehicle":
      return buildVehicleStructure(structure, parts, theme);
    case "furniture":
      return buildFurnitureStructure(structure, parts, theme);
    case "structure":
    case "tower":
      return buildStructureStructure(structure, parts, theme);
    case "creature":
      return buildCreatureStructure(structure, parts, theme);
    case "machine":
      return buildMachineStructure(structure, parts, theme);
    case "container":
      return buildContainerStructure(structure, parts, theme);
    case "nature":
      return buildNatureStructure(structure, parts, theme);
    case "weapon":
      return buildWeaponStructure(structure, parts, theme);
    case "tool":
      return buildToolStructure(structure, parts, theme);
    case "lighting":
      return buildLightingStructure(structure, parts, theme);
    default:
      return buildPropStructure(structure, parts, effectiveArchetype, theme);
  }
}

// ─── Showcase setup ──────────────────────────────────────────────────────────

function addShowcase(blueprint: BlueprintJSON): BlueprintJSON {
  const structures = [...blueprint.scene.structures];
  const hasLights = structures.some((s) => s.type === "light" || s.lightProps);

  if (!hasLights) {
    structures.push(
      {
        id: "showcase-key",
        type: "light",
        transform: { x: 5, y: 8, z: -5, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
        lightProps: { type: "directional", intensity: 1.2, color: "#ffffff" },
      },
      {
        id: "showcase-fill",
        type: "light",
        transform: { x: -4, y: 5, z: 3, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
        lightProps: { type: "point", intensity: 0.5, color: "#E8E4DF", distance: 20 },
      },
    );
  }

  if (!blueprint.scene.ground) {
    return {
      ...blueprint,
      scene: {
        ...blueprint.scene,
        ground: { type: "plane" as const, width: 8, height: 8, color: "#2D2D2D", y: 0 },
        structures,
      },
    };
  }

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
