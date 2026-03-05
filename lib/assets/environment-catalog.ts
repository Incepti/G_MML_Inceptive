/**
 * Environment Asset Catalog
 *
 * Maps semantic structure types to available 3D model assets.
 * The AI should prefer using m-model with these assets over building
 * structures from primitives when a matching asset exists.
 *
 * Sources:
 * - Khronos glTF-Sample-Assets (verified)
 * - Google model-viewer CDN (verified)
 * - Geez Collection IDs 0-5555 (available but contents vary)
 *
 * When no model asset is available, the AI falls back to primitive
 * composition (cubes, cylinders, spheres) as defined in the
 * composition rules.
 */

export interface EnvironmentAsset {
  id: string;
  name: string;
  category: "structure" | "prop" | "furniture" | "lighting" | "environment" | "vehicle" | "character";
  modelUrl: string;
  defaultScale: number;
  tags: string[];
  description: string;
}

// ─── Verified Assets (known models from trusted sources) ────────────────────
const VERIFIED_ENVIRONMENT_ASSETS: EnvironmentAsset[] = [
  // Khronos models
  {
    id: "lantern",
    name: "Lantern",
    category: "lighting",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb",
    defaultScale: 1,
    tags: ["lantern", "light", "medieval", "prop"],
    description: "Old-style lantern with emissive light — use for medieval/rustic scenes",
  },
  {
    id: "water-bottle",
    name: "Water Bottle",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/WaterBottle/glTF-Binary/WaterBottle.glb",
    defaultScale: 3,
    tags: ["bottle", "container", "glass", "prop"],
    description: "Water bottle — use as table prop or container",
  },
  {
    id: "damaged-helmet",
    name: "Damaged Helmet",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
    defaultScale: 1,
    tags: ["helmet", "sci-fi", "prop", "armor"],
    description: "Sci-fi damaged helmet — use as prop in military/sci-fi scenes",
  },
  {
    id: "antique-camera",
    name: "Antique Camera",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueCamera/glTF-Binary/AntiqueCamera.glb",
    defaultScale: 1,
    tags: ["camera", "antique", "prop", "vintage"],
    description: "Vintage camera — use as decorative prop",
  },
  {
    id: "boombox",
    name: "BoomBox",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoomBox/glTF-Binary/BoomBox.glb",
    defaultScale: 50,
    tags: ["music", "electronics", "retro", "prop"],
    description: "Retro boombox — use in urban/street scenes",
  },
  // Model Viewer assets
  {
    id: "astronaut",
    name: "Astronaut",
    category: "character",
    modelUrl: "https://modelviewer.dev/shared-assets/models/Astronaut.glb",
    defaultScale: 1,
    tags: ["astronaut", "character", "space", "sci-fi"],
    description: "Animated astronaut figure — use as character in sci-fi scenes",
  },
  {
    id: "robot",
    name: "Robot Expressive",
    category: "character",
    modelUrl: "https://modelviewer.dev/shared-assets/models/RobotExpressive.glb",
    defaultScale: 1,
    tags: ["robot", "character", "animated", "sci-fi"],
    description: "Expressive robot character — use as NPC or decoration",
  },
  {
    id: "horse",
    name: "Horse",
    category: "character",
    modelUrl: "https://modelviewer.dev/shared-assets/models/Horse.glb",
    defaultScale: 0.01,
    tags: ["horse", "animal", "nature", "character"],
    description: "Horse model — use in stables, farms, medieval scenes",
  },
  {
    id: "rocket-ship",
    name: "Rocket Ship",
    category: "vehicle",
    modelUrl: "https://modelviewer.dev/shared-assets/models/RocketShip.glb",
    defaultScale: 1,
    tags: ["rocket", "vehicle", "space", "sci-fi"],
    description: "Rocket ship — use in space/sci-fi scenes",
  },
  {
    id: "milk-truck",
    name: "Milk Truck",
    category: "vehicle",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb",
    defaultScale: 1,
    tags: ["truck", "vehicle", "urban", "delivery"],
    description: "Delivery truck — use in street/urban scenes",
  },
  {
    id: "fox",
    name: "Fox",
    category: "character",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb",
    defaultScale: 0.02,
    tags: ["fox", "animal", "nature", "forest"],
    description: "Animated fox — use in forest/nature scenes",
  },
  {
    id: "fish",
    name: "Barramundi Fish",
    category: "character",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BarramundiFish/glTF-Binary/BarramundiFish.glb",
    defaultScale: 5,
    tags: ["fish", "animal", "aquatic", "nature"],
    description: "Fish model — use in water/aquatic scenes",
  },
];

// ─── Full catalog ───────────────────────────────────────────────────────────

export const ENVIRONMENT_CATALOG: EnvironmentAsset[] = [...VERIFIED_ENVIRONMENT_ASSETS];

// ─── Lookup helpers ─────────────────────────────────────────────────────────

export function getEnvironmentAsset(id: string): EnvironmentAsset | undefined {
  return ENVIRONMENT_CATALOG.find((a) => a.id === id);
}

export function getAssetsByCategory(category: EnvironmentAsset["category"]): EnvironmentAsset[] {
  return ENVIRONMENT_CATALOG.filter((a) => a.category === category);
}

export function getAssetsByTag(tag: string): EnvironmentAsset[] {
  return ENVIRONMENT_CATALOG.filter((a) => a.tags.includes(tag.toLowerCase()));
}

export function searchEnvironmentAssets(query: string): EnvironmentAsset[] {
  const q = query.toLowerCase();
  return ENVIRONMENT_CATALOG.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some((t) => t.includes(q)) ||
      a.category.includes(q)
  );
}

/**
 * Build a formatted catalog string for inclusion in AI prompts.
 * Lists all available environment assets with their URLs and descriptions.
 */
export function buildEnvironmentCatalogPrompt(): string {
  const lines: string[] = [
    "ENVIRONMENT ASSET CATALOG (verified 3D models — use m-model with these URLs):",
    "",
  ];

  const byCategory = new Map<string, EnvironmentAsset[]>();
  for (const asset of ENVIRONMENT_CATALOG) {
    const cat = asset.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(asset);
  }

  for (const [category, assets] of byCategory) {
    lines.push(`  ${category.toUpperCase()}:`);
    for (const a of assets) {
      lines.push(`    - ${a.name} [${a.tags.join(", ")}]: ${a.modelUrl}`);
      lines.push(`      scale: ${a.defaultScale}, ${a.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
