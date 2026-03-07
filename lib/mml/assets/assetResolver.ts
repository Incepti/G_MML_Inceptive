/**
 * Asset Resolver — strict model-first matching from GCS bucket.
 *
 * STRICT RULE: ALWAYS resolve to a 3D model. NEVER fall back to primitives
 * unless the user explicitly requested them.
 *
 * Pipeline position: Blueprint → [Asset Resolver] → Builder → Serializer → MML
 *
 * Source: gs://3dmodels_mml (667 GLB models, 11 categories)
 * Keywords: scripts/Keywords_Models.md (curated per-model keywords)
 *
 * MATCHING PIPELINE (scored):
 * 1. Score every asset against keywords — exact ID match (100), exact tag (20),
 *    ID-contains (10), tag-contains (5), fuzzy (3), plus category bonus (2).
 * 2. Return highest-scoring asset above threshold.
 * 3. If no match, fall back to first model in the structure's category.
 *
 * Deterministic — same inputs → same outputs. No network calls.
 */

import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";
import {
  ENVIRONMENT_CATALOG,
  type EnvironmentAsset,
} from "@/lib/assets/environment-catalog";

// ─── Category classification ────────────────────────────────────────────────

/**
 * Category-level terms. Used ONLY for classification, never as search keywords.
 * Matching on these causes false positives (too broad).
 */
const CATEGORY_TERMS = new Set([
  // asset categories
  "vehicle", "character", "furniture", "structure", "prop",
  "lighting", "environment",
  // semantic category aliases
  "creature", "nature", "machine",
  // style/mood tags (not object-specific)
  "animated", "basic", "pbr",
  // folder names from GCS bucket
  "animals", "art_decor", "buildings", "characters", "city_objects",
  "electronics", "food", "props", "vehicles",
]);

/**
 * Map a structure type (and optional keywords) to an EnvironmentAsset category.
 * Exported so the async resolver can use the same classification.
 */
export function classifyAssetCategory(
  type: string,
  keywords?: string[],
): EnvironmentAsset["category"] {
  const t = type.toLowerCase();

  const TYPE_CATEGORY: Record<string, EnvironmentAsset["category"]> = {
    // vehicles
    vehicle: "vehicle",
    car: "vehicle", truck: "vehicle", bus: "vehicle",
    motorcycle: "vehicle", bicycle: "vehicle", boat: "vehicle",
    ship: "vehicle", airplane: "vehicle", rocket: "vehicle",
    train: "vehicle", spaceship: "vehicle", suv: "vehicle",

    // characters / animals
    creature: "character", horse: "character", fox: "character",
    fish: "character", astronaut: "character", robot: "character",
    duck: "character", dragon: "character", cow: "character",
    deer: "character", wolf: "character", king: "character",
    farmer: "character", adventurer: "character", worker: "character",
    man: "character", woman: "character",

    // furniture
    bench: "furniture", table: "furniture", chair: "furniture",
    sofa: "furniture", couch: "furniture", stool: "furniture",
    ottoman: "furniture", refrigerator: "furniture", fridge: "furniture",
    furniture: "furniture", bed: "furniture", desk: "furniture",
    cabinet: "furniture", shelf: "furniture", nightstand: "furniture",
    chandelier: "furniture", rug: "furniture",

    // structures
    tower: "structure", building: "structure", wall: "structure",
    gate: "structure", bridge: "structure", fence: "structure",
    room: "structure", door: "structure", window: "structure",
    arch: "structure", stair: "structure", roof: "structure",
    pillar: "structure", clockTower: "structure",
    floor: "structure", castle: "structure", house: "structure",
    tent: "structure", hut: "structure",

    // lighting
    lamp: "furniture", lantern: "furniture", light: "furniture",

    // environment / nature
    tree: "environment", rock: "environment", water: "environment",
    nature: "environment", plant: "environment", flower: "environment",
    flowers: "environment", grass: "environment", mountain: "environment",
    bush: "environment", shrub: "environment", fern: "environment",
    boulder: "environment", cliff: "environment",
  };

  if (TYPE_CATEGORY[t]) return TYPE_CATEGORY[t];

  // Check keywords for category hints
  if (keywords) {
    for (const kw of keywords) {
      if (TYPE_CATEGORY[kw.toLowerCase()]) return TYPE_CATEGORY[kw.toLowerCase()];
    }
  }

  return "prop";
}

// ─── Keyword mapping: type → search terms aligned with curated tags ─────────
// Maps structure types to the curated keywords used in the GCS catalog.
// This helps the resolver find the right model even when the structure type
// doesn't exactly match a tag (e.g., "lamp" → also searches "lantern", "light").

const TYPE_SEARCH_TAGS: Record<string, string[]> = {
  // lighting
  lamp: ["lamp", "lantern", "light", "desk lamp", "street lamp"],
  lantern: ["lantern", "lamp", "light", "oil lamp"],
  chandelier: ["chandelier", "hanging light", "ceiling"],
  candle: ["candle", "candlestick", "candleholders"],
  // furniture — chairs
  chair: ["chair", "seating", "armchair", "wooden chair"],
  armchair: ["armchair", "chair", "upholstered"],
  stool: ["stool", "bar stool", "seating"],
  // furniture — tables
  table: ["table", "wooden table", "dining"],
  desk: ["desk", "workspace", "writing"],
  // furniture — seating
  sofa: ["sofa", "couch", "living room"],
  couch: ["couch", "sofa", "living room"],
  ottoman: ["ottoman", "footstool", "upholstered"],
  bench: ["bench", "seating", "outdoor"],
  // furniture — beds
  bed: ["bed", "mattress", "bedroom"],
  // furniture — storage
  cabinet: ["cabinet", "storage", "wooden"],
  shelf: ["shelf", "shelves", "storage"],
  bookshelf: ["bookshelf", "shelves", "wooden"],
  dresser: ["commode", "dresser", "drawer"],
  nightstand: ["nightstand", "bedside table"],
  drawer: ["drawer", "cabinet", "storage"],
  // vehicles
  car: ["car", "automobile", "sedan", "vehicle"],
  truck: ["truck", "pickup truck", "vehicle", "utility"],
  spaceship: ["spaceship", "spacecraft", "sci-fi", "futuristic"],
  ship: ["ship", "boat", "sailing", "naval"],
  boat: ["ship", "boat", "sailing"],
  // characters / animals
  horse: ["horse", "equine", "steed"],
  cow: ["cow", "bovine", "livestock"],
  fox: ["fox", "canine", "wildlife"],
  deer: ["deer", "wildlife", "buck"],
  wolf: ["wolf", "predator", "canine"],
  dog: ["husky", "shiba inu", "dog", "canine"],
  cat: ["cat", "statue", "concrete"],
  astronaut: ["astronaut", "space", "suit"],
  king: ["king", "royalty", "medieval"],
  farmer: ["farmer", "rural", "agricultural"],
  adventurer: ["adventurer", "RPG", "fantasy", "hero"],
  robot: ["mech", "robot", "mechanical"],
  // nature / environment
  tree: ["tree", "trees", "conifer", "pine", "fir", "evergreen"],
  rock: ["rock", "stone", "boulder"],
  boulder: ["boulder", "rock", "large", "stone"],
  plant: ["plant", "potted", "indoor", "houseplant"],
  flower: ["flower", "wildflower", "bloom"],
  flowers: ["flowers", "bloom", "garden", "colorful"],
  grass: ["grass", "ground cover", "lawn"],
  bush: ["bush", "shrub", "foliage"],
  shrub: ["shrub", "bush", "plant"],
  mountain: ["mountain", "peak", "terrain"],
  cliff: ["cliff", "coastal", "rocky"],
  // structures
  house: ["house", "home", "residential", "building", "dwelling"],
  building: ["building", "city", "structure"],
  castle: ["castle", "medieval", "fortress"],
  wall: ["wall", "wooden", "barrier", "stone wall"],
  door: ["door", "entrance", "wooden"],
  gate: ["gate", "iron gate", "entrance"],
  fence: ["fence", "chain link", "barrier"],
  tent: ["tent", "camping", "shelter"],
  hut: ["hut", "shelter", "primitive", "village"],
  stairs: ["stairs", "steps", "staircase"],
  // props — containers
  barrel: ["barrel", "wooden", "container", "storage"],
  crate: ["crate", "wooden", "box", "storage"],
  box: ["box", "cardboard", "crate", "storage"],
  basket: ["basket", "wicker", "container"],
  chest: ["chest", "treasure", "medieval"],
  bucket: ["bucket", "wooden", "rustic"],
  bottle: ["bottle", "glass", "container"],
  // props — electronics
  tv: ["monitor", "screen", "display", "computer"],
  television: ["monitor", "screen", "display"],
  radio: ["boombox", "music", "speaker"],
  boombox: ["boombox", "music", "speaker", "stereo"],
  camera: ["camera", "photo", "vintage"],
  phone: ["phone", "smartphone", "mobile"],
  computer: ["monitor", "screen", "computer"],
  // props — sports
  ball: ["baseball", "football", "sport", "ball"],
  baseball: ["baseball", "bat", "sport"],
  football: ["football", "sport", "ball"],
  // props — food
  cake: ["cake", "dessert", "food", "baked"],
  bread: ["croissant", "pastry", "food", "baked"],
  apple: ["apple", "fruit", "food"],
  // props — weapons
  sword: ["sword", "blade", "medieval", "weapon"],
  katana: ["katana", "japanese sword", "blade"],
  axe: ["axe", "wooden", "chopping", "tool"],
  knife: ["knife", "blade", "cutting"],
  shield: ["shield", "kite", "medieval", "defense"],
  gun: ["pistol", "rifle", "firearm"],
  rifle: ["rifle", "assault", "gun", "firearm"],
  pistol: ["pistol", "gun", "handgun"],
  cannon: ["cannon", "artillery", "medieval"],
  // props — tools
  drill: ["drill", "power tool", "electric"],
  crowbar: ["crowbar", "pry bar", "tool"],
  hammer: ["hammer", "wooden", "mallet"],
  wrench: ["wrench", "ratchet", "pipe wrench"],
  saw: ["handsaw", "saw", "woodworking"],
  shovel: ["spade", "shovel", "garden tool"],
  // props — music
  guitar: ["ukulele", "guitar", "instrument", "music"],
  ukulele: ["ukulele", "instrument", "music"],
  // props — decorative
  vase: ["vase", "ceramic", "brass", "decorative"],
  goblet: ["goblet", "cup", "brass", "drinking"],
  pot: ["pot", "brass", "cooking", "enamel"],
  pan: ["pan", "brass", "cooking"],
  clock: ["clock", "mantel", "grandfather", "time"],
  mirror: ["mirror", "ornate", "wall"],
  frame: ["picture frame", "frame", "wall art"],
  book: ["book", "encyclopedia"],
  chess: ["chess", "board game", "strategy"],
  sign: ["sign", "warning", "chalkboard"],
  rug: ["rug", "carpet", "round", "floor covering"],
  pillow: ["pillow", "throw", "cushion"],
  // statues / decorative figures
  elephant: ["elephant", "carved", "wooden", "figurine"],
  lion: ["lion", "head", "wall mount"],
  bull: ["bull", "bovine", "head"],
  gnome: ["gnome", "garden", "figurine"],
  bust: ["bust", "marble", "statue", "classical"],
  // screen / divider
  screen: ["screen", "divider", "chinese", "panels"],
  divider: ["screen", "divider", "panels"],
  fan: ["fan", "ceiling fan", "ventilation"],
  // household
  toilet: ["toilet", "bathroom", "plumbing"],
  sink: ["sink", "bathroom", "basin"],
  // infrastructure
  ladder: ["ladder", "climbing", "access"],
  ramp: ["ramp", "slope", "incline"],
  pipe: ["pipes", "modular", "industrial"],
  fire_hydrant: ["fire hydrant", "water", "city"],
  dumpster: ["dumpster", "trash", "waste"],
  trash: ["trash can", "garbage", "waste"],
  // sci-fi
  mech: ["mech", "robot", "mechanical", "sci-fi"],
  blaster: ["blaster", "laser gun", "sci-fi"],
  rover: ["rover", "space", "exploration"],
  planet: ["planet", "space", "celestial body"],
  // market / medieval
  market: ["market stall", "bazaar", "shop"],
  inn: ["inn", "fantasy", "tavern"],
  stable: ["stable", "horse", "fantasy", "barn"],
  farm: ["farm", "rural", "agricultural"],
  bonfire: ["bonfire", "fire", "campfire", "flame"],
};

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve asset models for a blueprint's structures.
 * Returns a new BlueprintJSON where structures with matching models
 * have their `modelSrc` field populated.
 */
export function resolveAssets(blueprint: BlueprintJSON): BlueprintJSON {
  // Extract intent hints — the user's request name (e.g. "chair", "dragon")
  const intentName = blueprint.intent?.name?.toLowerCase() || "";
  const archetype = blueprint.intent?.archetype?.toLowerCase() || "";

  // Identify the primary structure — intent keywords only apply to it.
  // For multi-object prompts ("chair + tree"), injecting "chair" into tree's
  // keywords causes cross-contamination.
  const primaryId = findPrimaryStructureId(blueprint.scene.structures);

  const structures = blueprint.scene.structures.map((s) =>
    resolveStructureAsset(
      s,
      s.id === primaryId ? intentName : "",
      s.id === primaryId ? archetype : "",
    )
  );

  return { ...blueprint, scene: { ...blueprint.scene, structures } };
}

/**
 * Resolve keywords to a model asset from the GCS catalog using scoring.
 *
 * STRICT: Always tries to return a model. Scoring pipeline:
 * - Exact ID match: +100
 * - Exact tag match: +20
 * - ID contains keyword: +10
 * - Multi-word tag contains keyword: +5
 * - Fuzzy (keyword contains tag): +3
 * - Category match bonus: +2
 *
 * Returns the highest-scoring asset, or category fallback, or null.
 */
export function resolveAsset(
  keywords: string[],
  category?: EnvironmentAsset["category"],
): EnvironmentAsset | null {
  // Filter out category-level terms — they must never be used as search keywords
  const filtered = keywords
    .map((k) => k.toLowerCase())
    .filter((k) => !CATEGORY_TERMS.has(k) && k.length > 1);

  if (filtered.length === 0) {
    // Category fallback
    if (category) {
      return ENVIRONMENT_CATALOG.find((a) => a.category === category) || null;
    }
    return null;
  }

  let bestMatch: EnvironmentAsset | null = null;
  let bestScore = 0;

  for (const asset of ENVIRONMENT_CATALOG) {
    let score = 0;

    // Category match bonus
    if (category == null || asset.category === category) {
      score += 2;
    }

    for (const kw of filtered) {
      // Exact ID match — strongest signal
      if (asset.id === kw) {
        score += 100;
        continue;
      }
      // Exact tag match
      if (asset.tags.some((t) => t === kw)) {
        score += 20;
        continue;
      }
      // ID contains keyword (e.g., "chair" in "wooden_chair_01")
      if (asset.id.includes(kw)) {
        score += 10;
        continue;
      }
      // Multi-word tag contains keyword (e.g., "coffee" in "coffee table")
      if (asset.tags.some((t) => t.includes(" ") && t.includes(kw))) {
        score += 5;
        continue;
      }
      // Fuzzy: keyword contains a tag (tag is substring of keyword)
      if (asset.tags.some((t) => t.length > 2 && kw.includes(t) && kw !== t)) {
        score += 3;
        continue;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = asset;
    }
  }

  // Minimum threshold: at least one real match beyond just category bonus
  if (bestScore > 2) return bestMatch;

  // Category fallback — pick first model in the category
  if (category) {
    return ENVIRONMENT_CATALOG.find((a) => a.category === category) || null;
  }

  return null;
}

// ─── Primary structure detection ─────────────────────────────────────────────

/**
 * Identify the "primary" structure in a blueprint — the one that matches
 * the user's intent. Intent keywords (from blueprint.intent.name) should
 * only be injected for this structure to avoid cross-contamination in
 * multi-object prompts (e.g. "chair + tree").
 */
function findPrimaryStructureId(structures: BlueprintStructure[]): string | null {
  // Explicit "main" or "primary" id
  const mainById = structures.find((s) =>
    /main|primary/i.test(s.id) && s.type !== "light"
  );
  if (mainById) return mainById.id;

  // First non-light structure (common for single-object prompts)
  const first = structures.find((s) => s.type !== "light" && !s.lightProps);
  return first?.id ?? null;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function resolveStructureAsset(
  s: BlueprintStructure,
  intentName = "",
  _archetype = "",
): BlueprintStructure {
  // Skip if already has model, geometry, children, or light
  if (s.modelSrc || s.geometry || s.children?.length || s.lightProps) {
    return s;
  }
  if (s.type === "light") return s;

  // Build search keywords — only exact, tight matches
  const keywords: string[] = [];

  // Add type-specific tags (known mappings only)
  if (TYPE_SEARCH_TAGS[s.type]) {
    keywords.push(...TYPE_SEARCH_TAGS[s.type]);
  }

  // Add the structure's own type and id as potential exact-match terms
  keywords.push(s.type);
  if (s.id !== s.type) {
    keywords.push(s.id);
    // Split id words: "tree-1" → ["tree"], "coffee-table-2" → ["coffee", "table"]
    const idWords = s.id.split(/[\s\-_]+/).filter((w) => w.length > 2 && !/^\d+$/.test(w));
    keywords.push(...idWords);
  }

  // Add modelTags if provided by the blueprint
  if (s.modelTags && s.modelTags.length > 0) {
    keywords.push(...s.modelTags);
  }

  // Add intent name as keyword — "create a chair" → intent.name = "chair"
  // This is critical for object mode where structures have generic ids
  if (intentName) {
    keywords.push(intentName);
    // Also add words from multi-word intents (e.g. "wooden chair" → ["wooden", "chair"])
    const intentWords = intentName.split(/[\s-_]+/).filter((w) => w.length > 2);
    keywords.push(...intentWords);
    // Add search tags for intent words too
    for (const word of intentWords) {
      if (TYPE_SEARCH_TAGS[word]) {
        keywords.push(...TYPE_SEARCH_TAGS[word]);
      }
    }
  }

  // Classify category — gates which assets can match
  const category = classifyAssetCategory(s.type, s.modelTags);

  const asset = resolveAsset(keywords, category);
  if (asset) {
    const scale = asset.defaultScale;
    return {
      ...s,
      modelSrc: asset.modelUrl,
      transform: {
        ...s.transform,
        sx: s.transform.sx !== 1 ? s.transform.sx : scale,
        sy: s.transform.sy !== 1 ? s.transform.sy : scale,
        sz: s.transform.sz !== 1 ? s.transform.sz : scale,
      },
    };
  }

  return s;
}
