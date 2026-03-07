import type { TrustedAsset } from "@/types/assets";
import { polyhaven } from "./environment-catalog";

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
// APPROVED SOURCES ONLY:
// 1. Poly Haven (polyhaven.com) — CC0, served via /api/models/polyhaven proxy
// 2. Poly Pizza (poly.pizza) — CC0, requires POLY_PIZZA_API_KEY
// 3. Geez Collection (project-specific)
//
// NO other external sources allowed.

export const TRUSTED_ASSETS: TrustedAsset[] = [
  // ── Poly Haven models (verified 2026-03-07) ─────────────────────────────
  // Chairs
  { id: "ph-armchair", name: "Armchair", description: "Upholstered armchair", url: polyhaven("ArmChair_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["chair", "armchair", "seat", "furniture"], source: "polyhaven", validated: true },
  { id: "ph-wooden-chair", name: "Wooden Chair", description: "Simple wooden chair", url: polyhaven("WoodenChair_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["chair", "wooden", "seat", "furniture"], source: "polyhaven", validated: true },
  { id: "ph-school-chair", name: "School Chair", description: "School classroom chair", url: polyhaven("SchoolChair_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["chair", "school", "seat", "furniture"], source: "polyhaven", validated: true },
  { id: "ph-rocking-chair", name: "Rocking Chair", description: "Classic rocking chair", url: polyhaven("Rockingchair_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["chair", "rocking", "seat", "furniture"], source: "polyhaven", validated: true },
  { id: "ph-dining-chair", name: "Dining Chair", description: "Dining room chair", url: polyhaven("dining_chair_02"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["chair", "dining", "seat", "furniture"], source: "polyhaven", validated: true },
  { id: "ph-bar-stool", name: "Bar Stool", description: "Round bar stool", url: polyhaven("bar_chair_round_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["stool", "bar", "seat", "furniture"], source: "polyhaven", validated: true },

  // Tables
  { id: "ph-wooden-table", name: "Wooden Table", description: "Wooden dining table", url: polyhaven("WoodenTable_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["table", "wooden", "dining", "furniture"], source: "polyhaven", validated: true },
  { id: "ph-coffee-table", name: "Coffee Table", description: "Coffee table", url: polyhaven("CoffeeTable_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["table", "coffee", "furniture"], source: "polyhaven", validated: true },
  { id: "ph-school-desk", name: "School Desk", description: "School desk", url: polyhaven("SchoolDesk_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["desk", "school", "table", "furniture"], source: "polyhaven", validated: true },

  // Sofas
  { id: "ph-sofa", name: "Sofa", description: "Living room sofa", url: polyhaven("Sofa_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["sofa", "couch", "furniture", "seating"], source: "polyhaven", validated: true },
  { id: "ph-ottoman", name: "Ottoman", description: "Ottoman footrest", url: polyhaven("Ottoman_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["ottoman", "pouf", "seat", "furniture"], source: "polyhaven", validated: true },

  // Lighting
  { id: "ph-chandelier", name: "Chandelier", description: "Classic chandelier", url: polyhaven("Chandelier_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["chandelier", "light", "ceiling", "lighting"], source: "polyhaven", validated: true },
  { id: "ph-lantern", name: "Lantern", description: "Rustic lantern", url: polyhaven("Lantern_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["lantern", "light", "lamp", "lighting"], source: "polyhaven", validated: true },
  { id: "ph-desk-lamp", name: "Desk Lamp", description: "Articulated desk lamp", url: polyhaven("desk_lamp_arm_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["lamp", "desk", "light", "lighting"], source: "polyhaven", validated: true },
  { id: "ph-candleholders", name: "Candle Holders", description: "Brass candle holders", url: polyhaven("brass_candleholders"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["candle", "holder", "brass", "lighting"], source: "polyhaven", validated: true },

  // Nature
  { id: "ph-boulder", name: "Boulder", description: "Large boulder rock", url: polyhaven("boulder_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["rock", "boulder", "stone", "nature"], source: "polyhaven", validated: true },
  { id: "ph-dead-tree", name: "Dead Tree Trunk", description: "Dead tree trunk", url: polyhaven("dead_tree_trunk"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["tree", "trunk", "dead", "nature"], source: "polyhaven", validated: true },
  { id: "ph-anthurium", name: "Anthurium Plant", description: "Potted anthurium plant", url: polyhaven("anthurium_botany_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["plant", "flower", "nature", "pot"], source: "polyhaven", validated: true },
  { id: "ph-dandelion", name: "Dandelion", description: "Dandelion flower", url: polyhaven("dandelion_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["flower", "dandelion", "nature", "plant"], source: "polyhaven", validated: true },

  // Props
  { id: "ph-barrel", name: "Barrel", description: "Wooden barrel", url: polyhaven("Barrel_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["barrel", "container", "wood", "storage"], source: "polyhaven", validated: true },
  { id: "ph-boombox", name: "Boombox", description: "Retro boombox", url: polyhaven("boombox"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["boombox", "music", "radio", "electronics"], source: "polyhaven", validated: true },
  { id: "ph-television", name: "Television", description: "Television set", url: polyhaven("Television_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["tv", "television", "screen", "electronics"], source: "polyhaven", validated: true },
  { id: "ph-chess-set", name: "Chess Set", description: "Chess set with board", url: polyhaven("chess_set"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["chess", "game", "board-game", "prop"], source: "polyhaven", validated: true },
  { id: "ph-katana", name: "Katana", description: "Antique Japanese katana", url: polyhaven("antique_katana_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["katana", "sword", "weapon", "japanese"], source: "polyhaven", validated: true },
  { id: "ph-cannon", name: "Cannon", description: "Historical cannon", url: polyhaven("cannon_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["cannon", "weapon", "military", "artillery"], source: "polyhaven", validated: true },
  { id: "ph-camera", name: "Camera", description: "Camera", url: polyhaven("Camera_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["camera", "photo", "electronics"], source: "polyhaven", validated: true },

  // Vehicles
  { id: "ph-covered-car", name: "Covered Car", description: "Car with cover", url: polyhaven("covered_car"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["car", "vehicle", "covered", "automobile"], source: "polyhaven", validated: true },
  { id: "ph-coffee-cart", name: "Coffee Cart", description: "Street coffee cart", url: polyhaven("CoffeeCart_01"), license: "CC0", sizeBytes: 0, mimeType: "model/gltf+json", tags: ["cart", "coffee", "vehicle", "street"], source: "polyhaven", validated: true },
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
