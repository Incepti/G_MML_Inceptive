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

  // ── Furniture (Khronos, verified 2026-03-06) ────────────────────────────
  {
    id: "chair",
    name: "Chair",
    category: "furniture",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb",
    defaultScale: 1,
    tags: ["chair", "seat", "furniture", "interior"],
    description: "Fabric chair — use for seating in interior scenes",
  },
  {
    id: "chair-ornate",
    name: "Ornate Chair",
    category: "furniture",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ChairDamaskPurplegold/glTF-Binary/ChairDamaskPurplegold.glb",
    defaultScale: 1,
    tags: ["chair", "throne", "ornate", "furniture", "royal", "interior"],
    description: "Ornate damask chair — use for royal/fancy interiors",
  },
  {
    id: "sofa",
    name: "Velvet Sofa",
    category: "furniture",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb",
    defaultScale: 1,
    tags: ["sofa", "couch", "furniture", "interior", "seating"],
    description: "Velvet sofa — use for living rooms and lounge areas",
  },
  {
    id: "sofa-leather",
    name: "Leather Sofa",
    category: "furniture",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenWoodLeatherSofa/glTF-Binary/SheenWoodLeatherSofa.glb",
    defaultScale: 1,
    tags: ["sofa", "couch", "leather", "furniture", "interior", "seating"],
    description: "Wood and leather sofa — use in offices, dens, or rustic interiors",
  },
  {
    id: "pouf",
    name: "Silk Pouf",
    category: "furniture",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SpecularSilkPouf/glTF-Binary/SpecularSilkPouf.glb",
    defaultScale: 1,
    tags: ["pouf", "ottoman", "stool", "seat", "furniture", "interior"],
    description: "Silk pouf/ottoman — use as accent seating or footrest",
  },

  // ── Vehicles (Khronos, verified 2026-03-06) ─────────────────────────────
  {
    id: "car",
    name: "Concept Car",
    category: "vehicle",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb",
    defaultScale: 1,
    tags: ["car", "automobile", "vehicle", "modern"],
    description: "Concept car — use for roads, garages, or urban scenes",
  },

  // ── Nature / Organic (Khronos, verified 2026-03-06) ─────────────────────
  {
    id: "plant",
    name: "Potted Plant",
    category: "environment",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DiffuseTransmissionPlant/glTF-Binary/DiffuseTransmissionPlant.glb",
    defaultScale: 1,
    tags: ["plant", "pot", "flower", "nature", "interior", "decoration"],
    description: "Potted plant — use for interior decoration or garden scenes",
  },
  {
    id: "flowers",
    name: "Vase with Flowers",
    category: "environment",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlassVaseFlowers/glTF-Binary/GlassVaseFlowers.glb",
    defaultScale: 1,
    tags: ["flowers", "vase", "bouquet", "decoration", "nature", "interior"],
    description: "Glass vase with flowers — use as table centerpiece or decoration",
  },
  {
    id: "dragon",
    name: "Dragon",
    category: "character",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DragonAttenuation/glTF-Binary/DragonAttenuation.glb",
    defaultScale: 1,
    tags: ["dragon", "creature", "fantasy", "monster"],
    description: "Crystal dragon figure — use in fantasy/medieval scenes",
  },

  // ── Lighting / Lamps (Khronos, verified 2026-03-06) ─────────────────────
  {
    id: "lamp",
    name: "Iridescence Lamp",
    category: "lighting",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/IridescenceLamp/glTF-Binary/IridescenceLamp.glb",
    defaultScale: 1,
    tags: ["lamp", "light", "interior", "decoration", "table-lamp"],
    description: "Table lamp — use for interior lighting props",
  },
  {
    id: "barn-lamp",
    name: "Barn Lamp",
    category: "lighting",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AnisotropyBarnLamp/glTF-Binary/AnisotropyBarnLamp.glb",
    defaultScale: 1,
    tags: ["lamp", "barn", "rustic", "industrial", "lighting", "wall-lamp"],
    description: "Industrial barn lamp — use for rustic/industrial scenes",
  },
  {
    id: "candle-holder",
    name: "Hurricane Candle Holder",
    category: "lighting",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlassHurricaneCandleHolder/glTF-Binary/GlassHurricaneCandleHolder.glb",
    defaultScale: 1,
    tags: ["candle", "holder", "glass", "lighting", "decoration"],
    description: "Glass hurricane candle holder — use for ambient/rustic lighting",
  },

  // ── Props (Khronos, verified 2026-03-06) ────────────────────────────────
  {
    id: "watch",
    name: "Chronograph Watch",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ChronographWatch/glTF-Binary/ChronographWatch.glb",
    defaultScale: 15,
    tags: ["watch", "clock", "accessory", "prop", "luxury"],
    description: "Chronograph wristwatch — use as table prop or accessory",
  },
  {
    id: "shoe",
    name: "Shoe",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb",
    defaultScale: 8,
    tags: ["shoe", "sneaker", "footwear", "clothing", "prop"],
    description: "Sneaker shoe — use in stores, closets, or as decoration",
  },
  {
    id: "dish-olives",
    name: "Dish with Olives",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/IridescentDishWithOlives/glTF-Binary/IridescentDishWithOlives.glb",
    defaultScale: 3,
    tags: ["dish", "plate", "food", "olives", "prop", "tableware"],
    description: "Iridescent dish with olives — use as table food prop",
  },
  {
    id: "teacup",
    name: "Teacup",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DiffuseTransmissionTeacup/glTF-Binary/DiffuseTransmissionTeacup.glb",
    defaultScale: 5,
    tags: ["cup", "teacup", "tea", "mug", "tableware", "prop"],
    description: "Porcelain teacup — use as table prop in cafes or kitchens",
  },
  {
    id: "pot-coals",
    name: "Pot of Coals",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/PotOfCoals/glTF-Binary/PotOfCoals.glb",
    defaultScale: 1,
    tags: ["pot", "fire", "coals", "brazier", "campfire", "prop"],
    description: "Pot of hot coals — use for fire pits, medieval camps, warming areas",
  },
  {
    id: "skull",
    name: "Skull",
    category: "prop",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ScatteringSkull/glTF-Binary/ScatteringSkull.glb",
    defaultScale: 3,
    tags: ["skull", "bone", "skeleton", "horror", "prop", "decoration"],
    description: "Translucent skull — use in spooky, horror, or fantasy scenes",
  },
  {
    id: "refrigerator",
    name: "Commercial Refrigerator",
    category: "furniture",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CommercialRefrigerator/glTF-Binary/CommercialRefrigerator.glb",
    defaultScale: 1,
    tags: ["refrigerator", "fridge", "appliance", "kitchen", "furniture", "commercial"],
    description: "Commercial refrigerator — use in kitchens, restaurants, or stores",
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
