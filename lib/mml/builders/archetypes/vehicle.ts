/**
 * Vehicle archetype builder.
 *
 * Generates structured BlueprintStructure children for vehicle-type objects:
 * cars, trucks, boats, planes, motorcycles, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

/** Enhanced default parts for a vehicle when LLM provides none. */
const VEHICLE_PARTS: BlueprintPart[] = [
  { name: "chassis", role: "primary", shapeHint: "chassis", symmetry: false },
  { name: "cabin", role: "secondary", shapeHint: "cabin", symmetry: false },
  { name: "hood", role: "secondary", shapeHint: "panel", symmetry: false },
  { name: "wheels", role: "support", shapeHint: "wheel", symmetry: true },
  { name: "rear-wheels", role: "support", shapeHint: "wheel", symmetry: true },
  { name: "windshield", role: "detail", shapeHint: "window", symmetry: false },
  { name: "headlights", role: "detail", shapeHint: "light", symmetry: true },
  { name: "bumper-front", role: "detail", shapeHint: "bar", symmetry: false },
  { name: "grille", role: "detail", shapeHint: "grille", symmetry: false },
];

/**
 * Build a vehicle structure with children.
 * If the structure already has children or geometry, returns it unchanged.
 */
export function buildVehicleStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  const useParts = parts && parts.length > 0 ? parts : VEHICLE_PARTS;
  const totalH = estimateTotalHeight("vehicle");
  const children = buildObjectFromParts(structure.id, useParts, "vehicle", theme, totalH);

  return { ...structure, children };
}
