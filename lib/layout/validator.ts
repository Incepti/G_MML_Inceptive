import type { BlueprintJSON, BlueprintStructure, Zone, SceneScale, ValidationIssue } from "@/types/blueprint";
import { getZoneBounds, inferZone, SCALE_DIMENSIONS } from "./zones";

export interface LayoutValidationResult {
  issues: ValidationIssue[];
  suggestions: string[];
}

export function validateLayout(blueprint: BlueprintJSON): LayoutValidationResult {
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];
  const sceneScale: SceneScale = blueprint.meta.sceneScale || "medium";

  // Check ground plane matches scene scale
  const expectedDim = SCALE_DIMENSIONS[sceneScale];
  if (blueprint.scene.ground) {
    const g = blueprint.scene.ground;
    if (g.width < expectedDim.width * 0.5) {
      issues.push({
        severity: "warn",
        message: `Ground plane (${g.width}x${g.height}) is small for ${sceneScale} scale (expected ~${expectedDim.width}x${expectedDim.depth})`,
      });
    }
  }

  // Validate zone assignments match actual positions
  for (const structure of blueprint.scene.structures) {
    validateStructureZone(structure, sceneScale, issues);
  }

  // Check zone coverage
  const usedZones = new Set<string>();
  for (const s of blueprint.scene.structures) {
    if (s.zone) {
      usedZones.add(s.zone);
    } else {
      usedZones.add(inferZone(s.transform.x, s.transform.z, sceneScale));
    }
  }
  if (blueprint.scene.structures.length >= 10 && usedZones.size < 3) {
    suggestions.push("Consider spreading structures across more zones for a fuller scene.");
  }

  // Validate pathways reference existing structures
  if (blueprint.scene.pathways) {
    const structureIds = new Set(blueprint.scene.structures.map((s) => s.id));
    for (const pathway of blueprint.scene.pathways) {
      if (!structureIds.has(pathway.from)) {
        issues.push({
          severity: "warn",
          message: `Pathway references unknown structure "${pathway.from}"`,
        });
      }
      if (!structureIds.has(pathway.to)) {
        issues.push({
          severity: "warn",
          message: `Pathway references unknown structure "${pathway.to}"`,
        });
      }
    }
  }

  return { issues, suggestions };
}

function validateStructureZone(
  s: BlueprintStructure,
  sceneScale: SceneScale,
  issues: ValidationIssue[]
): void {
  if (!s.zone) return;

  const bounds = getZoneBounds(s.zone as Zone, sceneScale);
  const { x, z } = s.transform;
  const tolerance = 5;

  if (
    x < bounds.minX - tolerance || x > bounds.maxX + tolerance ||
    z < bounds.minZ - tolerance || z > bounds.maxZ + tolerance
  ) {
    issues.push({
      severity: "warn",
      message: `Structure "${s.id}" assigned to zone ${s.zone} but position (${x},${z}) is outside zone bounds`,
      nodeHint: s.id,
    });
  }
}
