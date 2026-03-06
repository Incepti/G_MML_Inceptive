import type { TrustedAsset } from "@/types/assets";

// ─── Geez Collection ───────────────────────────────────────────────────────
// Official Geez/Otherside GLB assets hosted on Google Cloud Storage.
// ID range: 0 to 5555  (inclusive)
// URL pattern: https://storage.googleapis.com/geez-public/GLB_MML/{ID}.glb
export const GEEZ_BASE_URL = "https://storage.googleapis.com/geez-public/GLB_MML";
export const GEEZ_ID_MIN = 0;
export const GEEZ_ID_MAX = 5555;

export function isValidGeezId(id: number): boolean {
  return Number.isInteger(id) && id >= GEEZ_ID_MIN && id <= GEEZ_ID_MAX;
}

export function getGeezUrl(id: number): string {
  if (!isValidGeezId(id)) {
    throw new RangeError(`Geez ID must be 0–5555, got ${id}`);
  }
  return `${GEEZ_BASE_URL}/${id}.glb`;
}

export function getGeezAsset(id: number): TrustedAsset {
  return {
    id: `geez-${id}`,
    name: `Geez #${id}`,
    description: `Official Geez/Otherside model #${id}`,
    url: getGeezUrl(id),
    license: "Geez/Otherside",
    sizeBytes: 0,
    mimeType: "model/gltf-binary",
    tags: ["geez", "otherside", "character", "official"],
    source: "geez-public",
    validated: true,
  };
}

// ─── Trusted Asset Index ───────────────────────────────────────────────────
// These are verified, pre-validated public GLB assets from trusted sources.
// URLs have been confirmed as of project creation.
// Add new entries here as they are verified.

export const TRUSTED_ASSETS: TrustedAsset[] = [
  // ── Khronos glTF-Sample-Assets (verified 2026-03-05) ─────────────────
  { id: "khronos-avocado", name: "Avocado", description: "Photorealistic avocado with PBR materials", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Avocado/glTF-Binary/Avocado.glb", license: "CC0", sizeBytes: 1051604, mimeType: "model/gltf-binary", tags: ["food", "organic", "pbr"], source: "khronos", validated: true },
  { id: "khronos-boombox", name: "BoomBox", description: "Retro boombox with PBR textures", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoomBox/glTF-Binary/BoomBox.glb", license: "CC0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["music", "electronics", "retro", "prop"], source: "khronos", validated: true },
  { id: "khronos-duck", name: "Duck", description: "Classic rubber duck test model", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb", license: "CC0", sizeBytes: 170896, mimeType: "model/gltf-binary", tags: ["duck", "animal", "toy"], source: "khronos", validated: true },
  { id: "khronos-antique-camera", name: "Antique Camera", description: "Detailed antique camera with PBR", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AntiqueCamera/glTF-Binary/AntiqueCamera.glb", license: "CC BY 4.0", sizeBytes: 6116076, mimeType: "model/gltf-binary", tags: ["camera", "antique", "prop", "detailed"], source: "khronos", validated: true },
  { id: "khronos-corset", name: "Corset", description: "Victorian corset with detailed materials", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Corset/glTF-Binary/Corset.glb", license: "CC0", sizeBytes: 3000000, mimeType: "model/gltf-binary", tags: ["clothing", "fashion", "victorian"], source: "khronos", validated: true },
  { id: "khronos-lantern", name: "Lantern", description: "Old-style lantern with emissive light", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb", license: "CC0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["lantern", "light", "prop", "medieval"], source: "khronos", validated: true },
  { id: "khronos-water-bottle", name: "Water Bottle", description: "Water bottle with transmission material", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/WaterBottle/glTF-Binary/WaterBottle.glb", license: "CC0", sizeBytes: 3016156, mimeType: "model/gltf-binary", tags: ["bottle", "container", "glass", "transparent"], source: "khronos", validated: true },
  { id: "khronos-damaged-helmet", name: "Damaged Helmet", description: "High-quality damaged sci-fi helmet", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb", license: "CC BY 4.0", sizeBytes: 3416116, mimeType: "model/gltf-binary", tags: ["sci-fi", "helmet", "pbr", "damaged"], source: "khronos", validated: true },
  { id: "khronos-fox", name: "Fox", description: "Animated fox with multiple animations", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb", license: "CC BY 4.0", sizeBytes: 820284, mimeType: "model/gltf-binary", tags: ["animal", "fox", "animated", "character"], source: "khronos", validated: true },
  { id: "khronos-cesium-milk-truck", name: "Cesium Milk Truck", description: "Animated milk delivery truck", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb", license: "CC BY 4.0", sizeBytes: 966220, mimeType: "model/gltf-binary", tags: ["vehicle", "truck", "animated"], source: "khronos", validated: true },
  { id: "khronos-cesium-man", name: "Cesium Man", description: "Animated walking humanoid", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb", license: "CC BY 4.0", sizeBytes: 500000, mimeType: "model/gltf-binary", tags: ["character", "humanoid", "animated", "walking"], source: "khronos", validated: true },
  { id: "khronos-box-animated", name: "Animated Box", description: "Simple box with scale animation", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BoxAnimated/glTF-Binary/BoxAnimated.glb", license: "CC0", sizeBytes: 5000, mimeType: "model/gltf-binary", tags: ["primitive", "cube", "animated", "basic"], source: "khronos", validated: true },
  { id: "khronos-brainstem", name: "BrainStem", description: "Animated robot with complex skeleton", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BrainStem/glTF-Binary/BrainStem.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["robot", "character", "animated", "sci-fi"], source: "khronos", validated: true },
  { id: "khronos-barramundi-fish", name: "Barramundi Fish", description: "Detailed fish model with PBR", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/BarramundiFish/glTF-Binary/BarramundiFish.glb", license: "CC BY 4.0", sizeBytes: 1000000, mimeType: "model/gltf-binary", tags: ["fish", "animal", "aquatic", "nature"], source: "khronos", validated: true },

  // ── Khronos furniture (verified 2026-03-06) ─────────────────────────────
  { id: "khronos-sheen-chair", name: "Chair", description: "Fabric sheen chair", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["chair", "seat", "furniture", "interior"], source: "khronos", validated: true },
  { id: "khronos-chair-ornate", name: "Ornate Chair", description: "Damask purple-gold ornate chair", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ChairDamaskPurplegold/glTF-Binary/ChairDamaskPurplegold.glb", license: "CC BY 4.0", sizeBytes: 3000000, mimeType: "model/gltf-binary", tags: ["chair", "throne", "ornate", "furniture", "royal"], source: "khronos", validated: true },
  { id: "khronos-sofa-velvet", name: "Velvet Sofa", description: "Glamorous velvet sofa", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb", license: "CC BY 4.0", sizeBytes: 3000000, mimeType: "model/gltf-binary", tags: ["sofa", "couch", "furniture", "interior", "seating"], source: "khronos", validated: true },
  { id: "khronos-sofa-leather", name: "Leather Sofa", description: "Wood and leather sofa", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenWoodLeatherSofa/glTF-Binary/SheenWoodLeatherSofa.glb", license: "CC BY 4.0", sizeBytes: 3000000, mimeType: "model/gltf-binary", tags: ["sofa", "couch", "leather", "furniture", "interior"], source: "khronos", validated: true },
  { id: "khronos-pouf", name: "Silk Pouf", description: "Specular silk pouf ottoman", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SpecularSilkPouf/glTF-Binary/SpecularSilkPouf.glb", license: "CC BY 4.0", sizeBytes: 1000000, mimeType: "model/gltf-binary", tags: ["pouf", "ottoman", "stool", "seat", "furniture"], source: "khronos", validated: true },
  { id: "khronos-refrigerator", name: "Commercial Refrigerator", description: "Commercial display refrigerator", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CommercialRefrigerator/glTF-Binary/CommercialRefrigerator.glb", license: "CC BY 4.0", sizeBytes: 5000000, mimeType: "model/gltf-binary", tags: ["refrigerator", "fridge", "appliance", "kitchen", "furniture"], source: "khronos", validated: true },

  // ── Khronos vehicles, nature, lighting, props (verified 2026-03-06) ────
  { id: "khronos-car", name: "Concept Car", description: "Modern concept car", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb", license: "CC BY 4.0", sizeBytes: 4000000, mimeType: "model/gltf-binary", tags: ["car", "automobile", "vehicle", "modern"], source: "khronos", validated: true },
  { id: "khronos-plant", name: "Potted Plant", description: "Indoor potted plant with translucent leaves", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DiffuseTransmissionPlant/glTF-Binary/DiffuseTransmissionPlant.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["plant", "pot", "flower", "nature", "interior"], source: "khronos", validated: true },
  { id: "khronos-flowers", name: "Vase with Flowers", description: "Glass vase with flower bouquet", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlassVaseFlowers/glTF-Binary/GlassVaseFlowers.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["flowers", "vase", "bouquet", "decoration", "nature"], source: "khronos", validated: true },
  { id: "khronos-dragon", name: "Dragon", description: "Crystal dragon figurine", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DragonAttenuation/glTF-Binary/DragonAttenuation.glb", license: "CC BY 4.0", sizeBytes: 5000000, mimeType: "model/gltf-binary", tags: ["dragon", "creature", "fantasy", "monster"], source: "khronos", validated: true },
  { id: "khronos-lamp", name: "Iridescence Lamp", description: "Table lamp with iridescent shade", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/IridescenceLamp/glTF-Binary/IridescenceLamp.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["lamp", "light", "interior", "table-lamp"], source: "khronos", validated: true },
  { id: "khronos-barn-lamp", name: "Barn Lamp", description: "Industrial barn lamp fixture", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/AnisotropyBarnLamp/glTF-Binary/AnisotropyBarnLamp.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["lamp", "barn", "rustic", "industrial", "lighting"], source: "khronos", validated: true },
  { id: "khronos-candle-holder", name: "Hurricane Candle Holder", description: "Glass hurricane candle holder", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/GlassHurricaneCandleHolder/glTF-Binary/GlassHurricaneCandleHolder.glb", license: "CC BY 4.0", sizeBytes: 1500000, mimeType: "model/gltf-binary", tags: ["candle", "holder", "glass", "lighting", "decoration"], source: "khronos", validated: true },
  { id: "khronos-watch", name: "Chronograph Watch", description: "Detailed chronograph wristwatch", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ChronographWatch/glTF-Binary/ChronographWatch.glb", license: "CC BY 4.0", sizeBytes: 3000000, mimeType: "model/gltf-binary", tags: ["watch", "clock", "accessory", "luxury", "prop"], source: "khronos", validated: true },
  { id: "khronos-shoe", name: "Shoe", description: "Sneaker with material variants", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/MaterialsVariantsShoe/glTF-Binary/MaterialsVariantsShoe.glb", license: "CC BY 4.0", sizeBytes: 4000000, mimeType: "model/gltf-binary", tags: ["shoe", "sneaker", "footwear", "clothing", "prop"], source: "khronos", validated: true },
  { id: "khronos-dish-olives", name: "Dish with Olives", description: "Iridescent dish with olives", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/IridescentDishWithOlives/glTF-Binary/IridescentDishWithOlives.glb", license: "CC BY 4.0", sizeBytes: 1500000, mimeType: "model/gltf-binary", tags: ["dish", "plate", "food", "olives", "tableware", "prop"], source: "khronos", validated: true },
  { id: "khronos-teacup", name: "Teacup", description: "Porcelain teacup with saucer", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DiffuseTransmissionTeacup/glTF-Binary/DiffuseTransmissionTeacup.glb", license: "CC BY 4.0", sizeBytes: 1000000, mimeType: "model/gltf-binary", tags: ["cup", "teacup", "tea", "mug", "tableware", "prop"], source: "khronos", validated: true },
  { id: "khronos-pot-coals", name: "Pot of Coals", description: "Pot of glowing hot coals", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/PotOfCoals/glTF-Binary/PotOfCoals.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["pot", "fire", "coals", "brazier", "campfire", "prop"], source: "khronos", validated: true },
  { id: "khronos-skull", name: "Skull", description: "Translucent scattering skull", url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ScatteringSkull/glTF-Binary/ScatteringSkull.glb", license: "CC BY 4.0", sizeBytes: 3000000, mimeType: "model/gltf-binary", tags: ["skull", "bone", "skeleton", "horror", "prop"], source: "khronos", validated: true },

  // ── Google model-viewer CDN (verified 2026-03-05) ─────────────────────
  { id: "mv-astronaut", name: "Astronaut", description: "Animated astronaut character", url: "https://modelviewer.dev/shared-assets/models/Astronaut.glb", license: "CC BY 4.0", sizeBytes: 3032764, mimeType: "model/gltf-binary", tags: ["astronaut", "character", "animated", "space", "sci-fi"], source: "modelviewer", validated: true },
  { id: "mv-robot", name: "Robot Expressive", description: "Animated robot with expressions", url: "https://modelviewer.dev/shared-assets/models/RobotExpressive.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["robot", "character", "animated", "expressive"], source: "modelviewer", validated: true },
  { id: "mv-horse", name: "Horse", description: "Animated galloping horse", url: "https://modelviewer.dev/shared-assets/models/Horse.glb", license: "CC BY 4.0", sizeBytes: 2000000, mimeType: "model/gltf-binary", tags: ["horse", "animal", "animated"], source: "modelviewer", validated: true },
  { id: "mv-neil-armstrong", name: "Neil Armstrong", description: "Neil Armstrong astronaut figure", url: "https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb", license: "CC BY 4.0", sizeBytes: 3000000, mimeType: "model/gltf-binary", tags: ["astronaut", "character", "historical", "space"], source: "modelviewer", validated: true },
  { id: "mv-rocket-ship", name: "Rocket Ship", description: "Stylized rocket ship", url: "https://modelviewer.dev/shared-assets/models/RocketShip.glb", license: "CC BY 4.0", sizeBytes: 500000, mimeType: "model/gltf-binary", tags: ["rocket", "vehicle", "space", "sci-fi"], source: "modelviewer", validated: true },
  { id: "mv-shishkebab", name: "Shish Kebab", description: "Low-poly shish kebab food prop", url: "https://modelviewer.dev/shared-assets/models/shishkebab.glb", license: "CC BY 4.0", sizeBytes: 300000, mimeType: "model/gltf-binary", tags: ["food", "prop", "low-poly"], source: "modelviewer", validated: true },
  { id: "mv-coffeemat", name: "Coffee Machine", description: "Coffee vending machine", url: "https://modelviewer.dev/shared-assets/models/coffeemat.glb", license: "CC BY 4.0", sizeBytes: 500000, mimeType: "model/gltf-binary", tags: ["machine", "coffee", "prop", "electronics"], source: "modelviewer", validated: true },
  { id: "mv-sphere", name: "Sphere", description: "Simple PBR sphere", url: "https://modelviewer.dev/shared-assets/models/sphere.glb", license: "CC0", sizeBytes: 50000, mimeType: "model/gltf-binary", tags: ["primitive", "sphere", "basic"], source: "modelviewer", validated: true },

  // ── public.mml.io (MML ecosystem, verified 2026-03-05) ────────────────
  { id: "mml-duck", name: "MML Duck", description: "Duck model from MML official assets", url: "https://public.mml.io/duck.glb", license: "CC0", sizeBytes: 170000, mimeType: "model/gltf-binary", tags: ["duck", "animal", "mml"], source: "mml-io", validated: true },
  { id: "mml-speaker", name: "Speaker", description: "Speaker/audio prop from MML", url: "https://public.mml.io/speaker.glb", license: "CC0", sizeBytes: 200000, mimeType: "model/gltf-binary", tags: ["speaker", "audio", "prop", "electronics"], source: "mml-io", validated: true },
];

export function searchTrustedAssets(
  query: string,
  page = 1,
  pageSize = 20
): { assets: TrustedAsset[]; total: number } {
  const q = query.toLowerCase().trim();

  // ── Geez ID lookup: "geez 42", "geez #42", "#42", "geez42" ────────────
  const geezMatch = q.match(/^(?:geez\s*#?)?(\d+)$/) || q.match(/^geez\s*#?(\d+)$/);
  if (geezMatch) {
    const id = parseInt(geezMatch[1], 10);
    if (isValidGeezId(id)) {
      return { assets: [getGeezAsset(id)], total: 1 };
    }
  }

  // ── "geez" alone → return a sample spread across the range ─────────────
  if (q === "geez" || q === "geez-public" || q === "otherside") {
    const samples = [0, 100, 500, 1000, 2000, 3000, 4000, 5000, 5555].map(getGeezAsset);
    const start = (page - 1) * pageSize;
    return { assets: samples.slice(start, start + pageSize), total: samples.length };
  }

  const filtered = q
    ? TRUSTED_ASSETS.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description?.toLowerCase().includes(q) ?? false) ||
          a.tags.some((t) => t.toLowerCase().includes(q)) ||
          a.source.toLowerCase().includes(q)
      )
    : TRUSTED_ASSETS;

  const start = (page - 1) * pageSize;
  const assets = filtered.slice(start, start + pageSize);

  return { assets, total: filtered.length };
}

export function getTrustedAssetById(id: string): TrustedAsset | null {
  return TRUSTED_ASSETS.find((a) => a.id === id) ?? null;
}
