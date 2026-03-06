/**
 * Procedural archetype builders.
 *
 * These are deterministic code-side builders that enhance blueprints
 * AFTER Claude returns them. They add structural detail, enforce
 * grounding, symmetry, and visual quality rules.
 *
 * Claude provides the WHAT (object type, position, rough structure).
 * These builders provide the HOW (detailed geometry, proportions, materials).
 */

import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";

// ─── Material Palettes by Theme ─────────────────────────────────────────────

export interface MaterialPalette {
  stone: string[];
  wood: string[];
  metal: string[];
  accent: string[];
  emissive: string;
  ground: string;
}

export const PALETTES: Record<string, MaterialPalette> = {
  medieval: {
    stone: ["#6B6B6B", "#7A7A7A", "#5C5C5C", "#8B8682"],
    wood: ["#4A3728", "#5C3A1E", "#8B4513", "#DEB887"],
    metal: ["#708090", "#5F6B7A", "#8B8682"],
    accent: ["#8B0000", "#654321", "#2F4F4F"],
    emissive: "#FFA500",
    ground: "#3A3A3A",
  },
  industrial: {
    stone: ["#555555", "#666666", "#4A4A4A"],
    wood: ["#3E2723", "#5D4037"],
    metal: ["#78909C", "#607D8B", "#455A64", "#B0BEC5"],
    accent: ["#FF6F00", "#E65100", "#BF360C"],
    emissive: "#FFAB00",
    ground: "#2D2D2D",
  },
  nature: {
    stone: ["#7A7A7A", "#8B8682", "#696969"],
    wood: ["#4A3728", "#8B4513", "#6B4226"],
    metal: ["#708090"],
    accent: ["#228B22", "#2E8B57", "#32CD32", "#8FBC8F"],
    emissive: "#90EE90",
    ground: "#4A6741",
  },
  scifi: {
    stone: ["#37474F", "#455A64", "#546E7A"],
    wood: ["#263238"],
    metal: ["#B0BEC5", "#CFD8DC", "#90A4AE", "#78909C"],
    accent: ["#00BCD4", "#00E5FF", "#18FFFF"],
    emissive: "#00E5FF",
    ground: "#1A1A2E",
  },
  neutral: {
    stone: ["#6B6B6B", "#7A7A7A", "#5C5C5C"],
    wood: ["#4A3728", "#8B4513", "#DEB887"],
    metal: ["#708090", "#8B8682"],
    accent: ["#A0522D", "#654321"],
    emissive: "#FFA500",
    ground: "#3A3A3A",
  },
};

export function getPalette(theme: string): MaterialPalette {
  return PALETTES[theme] || PALETTES.neutral;
}

function pickColor(colors: string[], index: number): string {
  return colors[index % colors.length];
}

// ─── Showcase Mode (OBJECT only) ────────────────────────────────────────────

/**
 * Add showcase lighting and ground pedestal for single objects.
 * Only applies to "object" type blueprints.
 */
export function addShowcaseSetup(blueprint: BlueprintJSON): BlueprintJSON {
  if (blueprint.type !== "object") return blueprint;

  const structures = [...blueprint.scene.structures];

  // Check if lights already exist
  const hasLights = structures.some((s) => s.type === "light");

  if (!hasLights) {
    // Add a simple 3-light showcase setup
    structures.push(
      {
        id: "showcase-key-light",
        type: "light",
        zone: "N" as const,
        transform: { x: 5, y: 8, z: -5, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
        lightProps: { type: "directional", intensity: 1.2, color: "#ffffff" },
      },
      {
        id: "showcase-fill-light",
        type: "light",
        zone: "W" as const,
        transform: { x: -4, y: 5, z: 3, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
        lightProps: { type: "point", intensity: 0.6, color: "#E8E4DF", distance: 20 },
      },
    );
  }

  // Add small ground pedestal if no ground plane exists
  if (!blueprint.scene.ground) {
    const maxExtent = estimateObjectExtent(structures);
    const pedSize = Math.max(maxExtent * 2.5, 4);
    return {
      ...blueprint,
      scene: {
        ...blueprint.scene,
        ground: {
          type: "plane" as const,
          width: pedSize,
          height: pedSize,
          color: "#2D2D2D",
          y: 0,
        },
        structures,
      },
    };
  }

  return { ...blueprint, scene: { ...blueprint.scene, structures } };
}

function estimateObjectExtent(structures: BlueprintStructure[]): number {
  let maxExtent = 2;
  for (const s of structures) {
    if (s.type === "light") continue;
    const t = s.transform;
    const extent = Math.max(Math.abs(t.x), Math.abs(t.z));
    if (s.geometry) {
      const gw = s.geometry.width || s.geometry.radius || 1;
      const gd = s.geometry.depth || s.geometry.radius || 1;
      maxExtent = Math.max(maxExtent, extent + Math.max(gw, gd));
    } else {
      maxExtent = Math.max(maxExtent, extent + 1);
    }
    if (s.children) {
      maxExtent = Math.max(maxExtent, estimateObjectExtent(s.children));
    }
  }
  return maxExtent;
}

// ─── Archetype Enhancement ──────────────────────────────────────────────────

/**
 * Post-process a blueprint to enhance structures that are too simple.
 * If a structure has no children and no geometry, attempt to expand it
 * based on its type using archetype rules.
 */
export function enhanceBlueprint(blueprint: BlueprintJSON): BlueprintJSON {
  const enhanced = {
    ...blueprint,
    scene: {
      ...blueprint.scene,
      structures: blueprint.scene.structures.map((s) => enhanceStructure(s, blueprint)),
    },
  };
  return enhanced;
}

function enhanceStructure(s: BlueprintStructure, bp: BlueprintJSON): BlueprintStructure {
  // If the structure already has children, enhance them recursively
  if (s.children && s.children.length > 0) {
    return {
      ...s,
      children: s.children.map((c) => enhanceStructure(c, bp)),
    };
  }

  // If structure has geometry (it's a primitive), leave it alone
  if (s.geometry) return s;

  // If structure has a modelSrc, leave it alone
  if (s.modelSrc) return s;

  // If it's a light or label, leave it alone
  if (s.type === "light" || s.lightProps || s.label) return s;

  // Try to expand from archetype
  const expanded = expandArchetype(s, bp);
  return expanded || s;
}

/**
 * Expand a bare structure into a multi-primitive composition
 * based on its type.
 */
function expandArchetype(s: BlueprintStructure, bp: BlueprintJSON): BlueprintStructure | null {
  const palette = getPalette(bp.style?.theme || "neutral");

  switch (s.type) {
    case "tower":
      return buildTowerArchetype(s, palette);
    case "building":
    case "room":
      return buildBuildingArchetype(s, palette);
    case "gate":
      return buildGateArchetype(s, palette);
    case "fence":
      return buildFenceArchetype(s, palette);
    case "bench":
      return buildBenchArchetype(s, palette);
    case "table":
      return buildTableArchetype(s, palette);
    case "chair":
      return buildChairArchetype(s, palette);
    case "barrel":
      return buildBarrelArchetype(s, palette);
    case "tree":
      return buildTreeArchetype(s, palette);
    case "rock":
      return buildRockArchetype(s, palette);
    case "lamp":
      return buildLampArchetype(s, palette);
    case "water":
      return buildWellArchetype(s, palette);
    case "vehicle":
      return buildVehicleArchetype(s, palette);
    case "wall":
      return buildWallArchetype(s, palette);
    case "door":
      return buildDoorArchetype(s, palette);
    case "window":
      return buildWindowArchetype(s, palette);
    case "pillar":
      return buildPillarArchetype(s, palette);
    default:
      return null; // Unknown type, leave as-is
  }
}

// ─── Archetype Builders ─────────────────────────────────────────────────────

function child(id: string, type: string, t: Partial<BlueprintStructure["transform"]>, g: BlueprintStructure["geometry"], m?: BlueprintStructure["material"]): BlueprintStructure {
  return {
    id,
    type: type as BlueprintStructure["type"],
    transform: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, ...t },
    geometry: g,
    material: m,
  };
}

function buildTowerArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-base`, "prop", { y: 1.5 }, { kind: "cube", width: 4, height: 3, depth: 4 }, { color: pickColor(p.stone, 0), roughness: 0.9 }),
      child(`${s.id}-shaft`, "pillar", { y: 8 }, { kind: "cylinder", radius: 1.5, height: 10 }, { color: pickColor(p.stone, 1), roughness: 0.85 }),
      child(`${s.id}-platform`, "floor", { y: 13.5 }, { kind: "cube", width: 5, height: 0.3, depth: 5 }, { color: pickColor(p.stone, 2), metalness: 0.2 }),
      child(`${s.id}-rail-n`, "fence", { y: 14.2, z: -2.4 }, { kind: "cube", width: 5, height: 0.8, depth: 0.08 }, { color: pickColor(p.metal, 0), metalness: 0.7, roughness: 0.3 }),
      child(`${s.id}-rail-s`, "fence", { y: 14.2, z: 2.4 }, { kind: "cube", width: 5, height: 0.8, depth: 0.08 }, { color: pickColor(p.metal, 0), metalness: 0.7 }),
      child(`${s.id}-rail-e`, "fence", { y: 14.2, x: 2.4 }, { kind: "cube", width: 0.08, height: 0.8, depth: 5 }, { color: pickColor(p.metal, 0), metalness: 0.7 }),
      child(`${s.id}-rail-w`, "fence", { y: 14.2, x: -2.4 }, { kind: "cube", width: 0.08, height: 0.8, depth: 5 }, { color: pickColor(p.metal, 0), metalness: 0.7 }),
      {
        id: `${s.id}-spotlight`,
        type: "light",
        transform: { x: 0, y: 15, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
        lightProps: { type: "spot", intensity: 2, color: "#FFFFCC", distance: 30, angle: 45 },
      },
    ],
  };
}

function buildBuildingArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  const w = 6, h = 3, d = 8;
  return {
    ...s,
    children: [
      child(`${s.id}-wall-n`, "wall", { y: h / 2, z: -d / 2 }, { kind: "cube", width: w, height: h, depth: 0.3 }, { color: pickColor(p.stone, 0) }),
      child(`${s.id}-wall-s`, "wall", { y: h / 2, z: d / 2 }, { kind: "cube", width: w, height: h, depth: 0.3 }, { color: pickColor(p.stone, 0) }),
      child(`${s.id}-wall-e`, "wall", { y: h / 2, x: w / 2 }, { kind: "cube", width: 0.3, height: h, depth: d }, { color: pickColor(p.stone, 1) }),
      child(`${s.id}-wall-w`, "wall", { y: h / 2, x: -w / 2 }, { kind: "cube", width: 0.3, height: h, depth: d }, { color: pickColor(p.stone, 1) }),
      child(`${s.id}-roof`, "roof", { y: h + 0.15 }, { kind: "cube", width: w + 1, height: 0.3, depth: d + 1 }, { color: pickColor(p.accent, 0) }),
      child(`${s.id}-door`, "door", { y: 1, z: d / 2 + 0.1 }, { kind: "cube", width: 1, height: 2, depth: 0.15 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-win-1`, "window", { y: 2, x: -1.5, z: -d / 2 - 0.05 }, { kind: "cube", width: 0.8, height: 1, depth: 0.1 }, { color: "#87CEEB", opacity: 0.4 }),
      child(`${s.id}-win-2`, "window", { y: 2, x: 1.5, z: -d / 2 - 0.05 }, { kind: "cube", width: 0.8, height: 1, depth: 0.1 }, { color: "#87CEEB", opacity: 0.4 }),
    ],
  };
}

function buildGateArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-pillar-l`, "pillar", { x: -2, y: 2 }, { kind: "cube", width: 1, height: 4, depth: 1 }, { color: pickColor(p.stone, 0) }),
      child(`${s.id}-pillar-r`, "pillar", { x: 2, y: 2 }, { kind: "cube", width: 1, height: 4, depth: 1 }, { color: pickColor(p.stone, 0) }),
      child(`${s.id}-arch`, "prop", { y: 4.25 }, { kind: "cube", width: 5, height: 0.5, depth: 1 }, { color: pickColor(p.stone, 1) }),
      child(`${s.id}-door-l`, "door", { x: -0.75, y: 1.5 }, { kind: "cube", width: 1.5, height: 3, depth: 0.15 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-door-r`, "door", { x: 0.75, y: 1.5 }, { kind: "cube", width: 1.5, height: 3, depth: 0.15 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-frame`, "prop", { y: 4.6 }, { kind: "cube", width: 6, height: 0.3, depth: 1 }, { color: pickColor(p.stone, 2) }),
    ],
  };
}

function buildFenceArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  const posts: BlueprintStructure[] = [];
  for (let i = 0; i < 5; i++) {
    posts.push(child(`${s.id}-post-${i}`, "prop", { x: i * 2, y: 0.75 }, { kind: "cylinder", radius: 0.05, height: 1.5 }, { color: pickColor(p.wood, 0) }));
  }
  return {
    ...s,
    children: [
      ...posts,
      child(`${s.id}-rail-top`, "prop", { y: 1.3, x: 4 }, { kind: "cube", width: 8, height: 0.06, depth: 0.06 }, { color: pickColor(p.wood, 1) }),
      child(`${s.id}-rail-bot`, "prop", { y: 0.5, x: 4 }, { kind: "cube", width: 8, height: 0.06, depth: 0.06 }, { color: pickColor(p.wood, 1) }),
    ],
  };
}

function buildBenchArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-seat-1`, "prop", { y: 0.42, z: -0.15 }, { kind: "cube", width: 1.2, height: 0.05, depth: 0.15 }, { color: pickColor(p.wood, 2) }),
      child(`${s.id}-seat-2`, "prop", { y: 0.42, z: 0 }, { kind: "cube", width: 1.2, height: 0.05, depth: 0.15 }, { color: pickColor(p.wood, 1) }),
      child(`${s.id}-seat-3`, "prop", { y: 0.42, z: 0.15 }, { kind: "cube", width: 1.2, height: 0.05, depth: 0.15 }, { color: pickColor(p.wood, 2) }),
      child(`${s.id}-leg-l`, "prop", { x: -0.5, y: 0.2 }, { kind: "cube", width: 0.08, height: 0.4, depth: 0.3 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-leg-r`, "prop", { x: 0.5, y: 0.2 }, { kind: "cube", width: 0.08, height: 0.4, depth: 0.3 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-back`, "prop", { y: 0.67, z: -0.2 }, { kind: "cube", width: 1.2, height: 0.5, depth: 0.05 }, { color: pickColor(p.wood, 1) }),
    ],
  };
}

function buildTableArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-top`, "prop", { y: 0.75 }, { kind: "cube", width: 1.2, height: 0.05, depth: 0.6 }, { color: pickColor(p.wood, 1) }),
      child(`${s.id}-leg-1`, "prop", { x: -0.5, y: 0.35, z: -0.22 }, { kind: "cube", width: 0.06, height: 0.7, depth: 0.06 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-leg-2`, "prop", { x: 0.5, y: 0.35, z: -0.22 }, { kind: "cube", width: 0.06, height: 0.7, depth: 0.06 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-leg-3`, "prop", { x: -0.5, y: 0.35, z: 0.22 }, { kind: "cube", width: 0.06, height: 0.7, depth: 0.06 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-leg-4`, "prop", { x: 0.5, y: 0.35, z: 0.22 }, { kind: "cube", width: 0.06, height: 0.7, depth: 0.06 }, { color: pickColor(p.wood, 0) }),
    ],
  };
}

function buildChairArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-seat`, "prop", { y: 0.45 }, { kind: "cube", width: 0.4, height: 0.04, depth: 0.4 }, { color: pickColor(p.wood, 2) }),
      child(`${s.id}-back`, "prop", { y: 0.65, z: -0.18 }, { kind: "cube", width: 0.4, height: 0.4, depth: 0.04 }, { color: pickColor(p.wood, 1) }),
      child(`${s.id}-leg-fl`, "prop", { x: -0.16, y: 0.22, z: 0.16 }, { kind: "cube", width: 0.04, height: 0.45, depth: 0.04 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-leg-fr`, "prop", { x: 0.16, y: 0.22, z: 0.16 }, { kind: "cube", width: 0.04, height: 0.45, depth: 0.04 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-leg-bl`, "prop", { x: -0.16, y: 0.22, z: -0.16 }, { kind: "cube", width: 0.04, height: 0.45, depth: 0.04 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-leg-br`, "prop", { x: 0.16, y: 0.22, z: -0.16 }, { kind: "cube", width: 0.04, height: 0.45, depth: 0.04 }, { color: pickColor(p.wood, 0) }),
    ],
  };
}

function buildBarrelArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-body`, "prop", { y: 0.4 }, { kind: "cylinder", radius: 0.3, height: 0.8 }, { color: pickColor(p.wood, 1) }),
      child(`${s.id}-rim-top`, "prop", { y: 0.8 }, { kind: "cylinder", radius: 0.32, height: 0.04 }, { color: pickColor(p.metal, 0), metalness: 0.6 }),
      child(`${s.id}-rim-bot`, "prop", { y: 0 }, { kind: "cylinder", radius: 0.32, height: 0.04 }, { color: pickColor(p.metal, 0), metalness: 0.6 }),
      child(`${s.id}-band`, "prop", { y: 0.4 }, { kind: "cylinder", radius: 0.33, height: 0.03 }, { color: pickColor(p.metal, 0), metalness: 0.6 }),
    ],
  };
}

function buildTreeArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-trunk`, "prop", { y: 2 }, { kind: "cylinder", radius: 0.3, height: 4 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-canopy-1`, "prop", { y: 5 }, { kind: "sphere", radius: 2.5 }, { color: pickColor(p.accent, 0) }),
      child(`${s.id}-canopy-2`, "prop", { y: 5.5, x: 1 }, { kind: "sphere", radius: 2 }, { color: pickColor(p.accent, 1) }),
      child(`${s.id}-canopy-3`, "prop", { y: 4.5, x: -0.8, z: 0.5 }, { kind: "sphere", radius: 1.8 }, { color: pickColor(p.accent, 2) }),
    ],
  };
}

function buildRockArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-base`, "prop", { y: 0.3 }, { kind: "sphere", radius: 0.8 }, { color: pickColor(p.stone, 0), roughness: 1 }),
      child(`${s.id}-top`, "prop", { y: 0.6, x: 0.1 }, { kind: "sphere", radius: 0.5 }, { color: pickColor(p.stone, 2), roughness: 1 }),
    ],
  };
}

function buildLampArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-base`, "prop", { y: 0.05 }, { kind: "cylinder", radius: 0.15, height: 0.1 }, { color: pickColor(p.stone, 2) }),
      child(`${s.id}-pole`, "prop", { y: 1.75 }, { kind: "cylinder", radius: 0.05, height: 3.5 }, { color: pickColor(p.metal, 0), metalness: 0.7 }),
      child(`${s.id}-arm`, "prop", { y: 3.5, x: 0.3 }, { kind: "cube", width: 0.6, height: 0.05, depth: 0.05 }, { color: pickColor(p.metal, 0), metalness: 0.7 }),
      child(`${s.id}-shade`, "prop", { y: 3.6, x: 0.3 }, { kind: "cylinder", radius: 0.2, height: 0.15 }, { color: "#333333" }),
      child(`${s.id}-bulb`, "prop", { y: 3.45, x: 0.3 }, { kind: "sphere", radius: 0.08 }, { color: "#FFF8E7", emissive: p.emissive, emissiveIntensity: 0.8 }),
    ],
  };
}

function buildWellArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-base`, "prop", { y: 0.4 }, { kind: "cylinder", radius: 0.8, height: 0.8 }, { color: pickColor(p.stone, 0) }),
      child(`${s.id}-rim`, "prop", { y: 0.8 }, { kind: "cylinder", radius: 0.9, height: 0.1 }, { color: pickColor(p.stone, 2) }),
      child(`${s.id}-post-l`, "prop", { x: -0.6, y: 1.15 }, { kind: "cube", width: 0.1, height: 1.5, depth: 0.1 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-post-r`, "prop", { x: 0.6, y: 1.15 }, { kind: "cube", width: 0.1, height: 1.5, depth: 0.1 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-beam`, "prop", { y: 1.9 }, { kind: "cube", width: 1.4, height: 0.08, depth: 0.08 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-bucket`, "prop", { y: 1 }, { kind: "cylinder", radius: 0.15, height: 0.2 }, { color: pickColor(p.metal, 0), metalness: 0.6 }),
    ],
  };
}

function buildVehicleArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      // Chassis
      child(`${s.id}-chassis`, "prop", { y: 0.35 }, { kind: "cube", width: 4, height: 0.3, depth: 1.8 }, { color: pickColor(p.metal, 0), metalness: 0.5 }),
      // Body/cabin
      child(`${s.id}-cabin`, "prop", { y: 0.9, z: -0.1 }, { kind: "cube", width: 2.2, height: 1, depth: 1.6 }, { color: pickColor(p.accent, 0) }),
      // Hood
      child(`${s.id}-hood`, "prop", { y: 0.6, x: 1.2 }, { kind: "cube", width: 1.5, height: 0.2, depth: 1.6 }, { color: pickColor(p.accent, 0) }),
      // Trunk
      child(`${s.id}-trunk`, "prop", { y: 0.55, x: -1.3 }, { kind: "cube", width: 1.2, height: 0.15, depth: 1.6 }, { color: pickColor(p.accent, 0) }),
      // Wheels
      child(`${s.id}-wheel-fl`, "prop", { x: 1.2, y: 0.2, z: 1 }, { kind: "cylinder", radius: 0.3, height: 0.2 }, { color: "#1A1A1A", roughness: 1 }),
      child(`${s.id}-wheel-fr`, "prop", { x: 1.2, y: 0.2, z: -1 }, { kind: "cylinder", radius: 0.3, height: 0.2 }, { color: "#1A1A1A", roughness: 1 }),
      child(`${s.id}-wheel-rl`, "prop", { x: -1.2, y: 0.2, z: 1 }, { kind: "cylinder", radius: 0.3, height: 0.2 }, { color: "#1A1A1A", roughness: 1 }),
      child(`${s.id}-wheel-rr`, "prop", { x: -1.2, y: 0.2, z: -1 }, { kind: "cylinder", radius: 0.3, height: 0.2 }, { color: "#1A1A1A", roughness: 1 }),
      // Windshield
      child(`${s.id}-windshield`, "prop", { y: 1.05, x: 0.6, rx: -15 }, { kind: "cube", width: 0.05, height: 0.7, depth: 1.4 }, { color: "#87CEEB", opacity: 0.4 }),
      // Headlights
      child(`${s.id}-headlight-l`, "prop", { x: 2, y: 0.5, z: 0.6 }, { kind: "sphere", radius: 0.12 }, { color: "#FFF8E7", emissive: "#FFFFFF", emissiveIntensity: 0.5 }),
      child(`${s.id}-headlight-r`, "prop", { x: 2, y: 0.5, z: -0.6 }, { kind: "sphere", radius: 0.12 }, { color: "#FFF8E7", emissive: "#FFFFFF", emissiveIntensity: 0.5 }),
    ],
  };
}

function buildWallArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  // If the structure already has geometry, it's a single-wall primitive — OK
  if (s.geometry) return s;
  return {
    ...s,
    geometry: { kind: "cube", width: 10, height: 4, depth: 0.4 },
    material: { color: pickColor(p.stone, 0), roughness: 0.9 },
  };
}

function buildDoorArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-frame-l`, "prop", { x: -0.55, y: 1.1 }, { kind: "cube", width: 0.1, height: 2.2, depth: 0.1 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-frame-r`, "prop", { x: 0.55, y: 1.1 }, { kind: "cube", width: 0.1, height: 2.2, depth: 0.1 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-frame-top`, "prop", { y: 2.2 }, { kind: "cube", width: 1.2, height: 0.1, depth: 0.1 }, { color: pickColor(p.wood, 0) }),
      child(`${s.id}-panel`, "prop", { y: 1 }, { kind: "cube", width: 1, height: 2, depth: 0.06 }, { color: pickColor(p.wood, 1) }),
      child(`${s.id}-handle`, "prop", { x: 0.35, y: 1 }, { kind: "sphere", radius: 0.04 }, { color: pickColor(p.metal, 0), metalness: 0.8 }),
    ],
  };
}

function buildWindowArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  return {
    ...s,
    children: [
      child(`${s.id}-frame`, "prop", {}, { kind: "cube", width: 0.8, height: 1, depth: 0.06 }, { color: pickColor(p.stone, 2) }),
      child(`${s.id}-glass`, "prop", {}, { kind: "cube", width: 0.7, height: 0.9, depth: 0.02 }, { color: "#87CEEB", opacity: 0.3 }),
    ],
  };
}

function buildPillarArchetype(s: BlueprintStructure, p: MaterialPalette): BlueprintStructure {
  if (s.geometry) return s;
  return {
    ...s,
    geometry: { kind: "cylinder", radius: 0.3, height: 3 },
    material: { color: pickColor(p.stone, 1), roughness: 0.8 },
  };
}

// ─── Grounding Enforcement ──────────────────────────────────────────────────

/**
 * Ensure all top-level structures have y >= 0 (sitting on ground).
 * Fixes floating objects.
 */
export function enforceGrounding(blueprint: BlueprintJSON): BlueprintJSON {
  return {
    ...blueprint,
    scene: {
      ...blueprint.scene,
      structures: blueprint.scene.structures.map((s) => {
        if (s.type === "light" || s.lightProps) return s;
        if (s.transform.y < 0) {
          return { ...s, transform: { ...s.transform, y: 0 } };
        }
        return s;
      }),
    },
  };
}
