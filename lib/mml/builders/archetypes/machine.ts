/**
 * Machine archetype builder.
 *
 * Generates structured BlueprintStructure children for machine-type objects:
 * robots, engines, generators, computers, clocks, etc.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { BlueprintStructure, BlueprintPart } from "@/types/blueprint";
import { buildObjectFromParts, estimateTotalHeight } from "@/lib/blueprint/procedural";

/** Default parts for a generic machine. */
const MACHINE_PARTS: BlueprintPart[] = [
  { name: "core", role: "primary", shapeHint: "core", symmetry: false },
  { name: "housing", role: "secondary", shapeHint: "shell", symmetry: false },
  { name: "supports", role: "support", shapeHint: "strut", symmetry: true },
  { name: "vents", role: "detail", shapeHint: "grille", symmetry: false },
  { name: "panels", role: "detail", shapeHint: "panel", symmetry: true },
];

/** Robot/mech parts (humanoid-ish machines). */
const ROBOT_PARTS: BlueprintPart[] = [
  { name: "torso", role: "primary", shapeHint: "core", symmetry: false },
  { name: "head", role: "secondary", shapeHint: "head", symmetry: false },
  { name: "arms", role: "support", shapeHint: "arm", symmetry: true },
  { name: "legs", role: "support", shapeHint: "leg", symmetry: true },
  { name: "visor", role: "detail", shapeHint: "window", symmetry: false },
  { name: "shoulder-plates", role: "detail", shapeHint: "panel", symmetry: true },
];

/** Engine/generator parts (stationary machines). */
const ENGINE_PARTS: BlueprintPart[] = [
  { name: "block", role: "primary", shapeHint: "body", symmetry: false },
  { name: "cylinder-heads", role: "secondary", shapeHint: "cap", symmetry: true },
  { name: "base-plate", role: "support", shapeHint: "base", symmetry: false },
  { name: "pipes", role: "detail", shapeHint: "bar", symmetry: true },
  { name: "exhaust", role: "detail", shapeHint: "shaft", symmetry: false },
  { name: "gauges", role: "detail", shapeHint: "rim", symmetry: false },
];

/** Console/terminal/computer parts. */
const CONSOLE_PARTS: BlueprintPart[] = [
  { name: "body", role: "primary", shapeHint: "body", symmetry: false },
  { name: "screen", role: "secondary", shapeHint: "panel", symmetry: false },
  { name: "base", role: "support", shapeHint: "base", symmetry: false },
  { name: "buttons", role: "detail", shapeHint: "rim", symmetry: false },
  { name: "frame", role: "detail", shapeHint: "trim", symmetry: false },
];

/** Detect machine sub-type for better part selection. */
function detectMachineSubtype(s: BlueprintStructure): BlueprintPart[] {
  const id = s.id.toLowerCase();
  const tags = s.modelTags?.map((t) => t.toLowerCase()) || [];
  const all = [id, ...tags].join(" ");

  if (/\b(robot|android|mech|golem|automaton|droid)\b/.test(all)) {
    return ROBOT_PARTS;
  }
  if (/\b(engine|motor|generator|turbine|pump|compressor)\b/.test(all)) {
    return ENGINE_PARTS;
  }
  if (/\b(computer|terminal|console|arcade|tv|television|radio|monitor|screen)\b/.test(all)) {
    return CONSOLE_PARTS;
  }
  return MACHINE_PARTS;
}

/**
 * Build a machine structure with children.
 * If the structure already has children or geometry, returns it unchanged.
 */
export function buildMachineStructure(
  structure: BlueprintStructure,
  parts: BlueprintPart[] | undefined,
  theme: string,
): BlueprintStructure {
  if (structure.children?.length || structure.geometry || structure.modelSrc) {
    return structure;
  }

  const useParts = parts && parts.length > 0
    ? parts
    : detectMachineSubtype(structure);
  const totalH = estimateTotalHeight("machine");
  const children = buildObjectFromParts(structure.id, useParts, "machine", theme, totalH);

  return { ...structure, children };
}
