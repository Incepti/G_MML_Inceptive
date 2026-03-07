/**
 * Asset Resolver — strict model-first matching from GCS bucket.
 *
 * STRICT RULE: ALWAYS resolve to a 3D model. NEVER fall back to primitives
 * unless the user explicitly requested them.
 *
 * Pipeline position: Blueprint → [Asset Resolver] → Builder → Serializer → MML
 *
 * Source: gs://3dmodels_mml (667 GLB models, 11 categories)
 *
 * MATCHING PIPELINE:
 * 1. Exact tag match within category
 * 2. Exact tag match ignoring category
 * 3. Fuzzy partial match
 * 4. Category fallback (pick first model in the structure's category)
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
 * Matching on these causes false positives (e.g. "vehicle" → RocketShip).
 */
const CATEGORY_TERMS = new Set([
  // asset categories
  "vehicle", "character", "furniture", "structure", "prop",
  "lighting", "environment",
  // semantic category aliases
  "animal", "creature", "nature", "plant", "machine",
  // style/mood tags (not object-specific)
  "animated", "basic", "pbr", "sci-fi", "medieval", "urban",
  "retro", "vintage", "modern", "fantasy", "realistic",
  // spatial
  "space", "forest", "aquatic", "indoor", "outdoor",
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
    train: "vehicle",

    // characters / animals
    creature: "character", horse: "character", fox: "character",
    fish: "character", astronaut: "character", robot: "character",
    duck: "character", dragon: "character",

    // furniture
    bench: "furniture", table: "furniture", chair: "furniture",
    sofa: "furniture", couch: "furniture", stool: "furniture",
    ottoman: "furniture", refrigerator: "furniture", fridge: "furniture",
    furniture: "furniture",

    // structures
    tower: "structure", building: "structure", wall: "structure",
    gate: "structure", bridge: "structure", fence: "structure",
    room: "structure", door: "structure", window: "structure",
    arch: "structure", stair: "structure", roof: "structure",
    pillar: "structure", clockTower: "structure",
    floor: "structure",

    // lighting
    lamp: "lighting", lantern: "lighting", light: "lighting",

    // environment / nature
    tree: "environment", rock: "environment", water: "environment",
    nature: "environment", plant: "environment", flower: "environment",
    flowers: "environment",
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

// ─── Keyword mapping: type → specific object tags ───────────────────────────
// Only maps types that have known matching assets. Keeps matches tight.

const TYPE_SEARCH_TAGS: Record<string, string[]> = {
  // lighting
  lamp: ["lamp", "lantern", "light"],
  lantern: ["lantern", "lamp"],
  chandelier: ["chandelier", "light", "ceiling"],
  candle: ["candle", "holder"],
  // furniture — chairs
  chair: ["chair", "seat", "armchair"],
  armchair: ["armchair", "chair"],
  stool: ["stool", "bar", "seat"],
  // furniture — tables
  table: ["table", "wooden", "dining"],
  desk: ["desk", "table", "school"],
  // furniture — seating
  sofa: ["sofa", "couch"],
  couch: ["sofa", "couch"],
  ottoman: ["ottoman", "pouf"],
  bench: ["bench", "seat"],
  // furniture — storage
  cabinet: ["cabinet", "storage"],
  shelf: ["shelf", "storage"],
  dresser: ["commode", "dresser"],
  bed: ["bed", "bedroom"],
  nightstand: ["nightstand", "bedside"],
  // vehicles
  car: ["car", "automobile", "vehicle"],
  cart: ["cart", "coffee"],
  truck: ["truck", "vehicle"],
  // nature / environment
  tree: ["tree", "trunk"],
  rock: ["rock", "boulder", "stone"],
  boulder: ["boulder", "rock", "stone"],
  plant: ["plant", "flower"],
  flower: ["flower", "dandelion", "plant"],
  flowers: ["flower", "dandelion", "plant"],
  // props — containers
  barrel: ["barrel", "container"],
  crate: ["box", "cardboard", "crate"],
  box: ["box", "cardboard", "crate"],
  // props — electronics
  tv: ["tv", "television"],
  television: ["tv", "television"],
  radio: ["boombox", "radio"],
  boombox: ["boombox", "music"],
  camera: ["camera", "photo"],
  // props — sports
  ball: ["baseball", "football", "ball"],
  baseball: ["baseball", "bat", "sport"],
  football: ["football", "sport"],
  // props — food
  cake: ["cake", "food"],
  bread: ["croissant", "bread", "food"],
  // props — weapons
  sword: ["katana", "sword", "blade"],
  katana: ["katana", "sword"],
  cannon: ["cannon", "artillery"],
  // props — tools
  drill: ["drill", "tool"],
  crowbar: ["crowbar", "tool"],
  // props — music
  guitar: ["ukulele", "guitar", "instrument"],
  ukulele: ["ukulele", "instrument"],
  // props — decorative
  vase: ["vase", "ceramic", "brass"],
  goblet: ["goblet", "cup", "brass"],
  pot: ["pot", "brass", "cooking"],
  pan: ["pan", "brass", "cooking"],
  book: ["book", "library"],
  books: ["book", "library"],
  chess: ["chess", "game"],
  sign: ["sign", "warning"],
  // statues
  elephant: ["elephant", "statue"],
  cat: ["cat", "statue"],
  bull: ["bull", "head"],
  // screen / divider
  screen: ["screen", "divider"],
  divider: ["screen", "divider"],
  fan: ["fan", "ceiling"],
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
 * Resolve keywords to a model asset from the GCS catalog.
 *
 * STRICT: Always tries to return a model. Pipeline:
 * 1. Exact tag match within category
 * 2. Exact tag match ignoring category
 * 3. Fuzzy partial tag match
 * 4. Category fallback (first model in category)
 *
 * Only returns null if keywords are empty.
 */
export function resolveAsset(
  keywords: string[],
  category?: EnvironmentAsset["category"],
): EnvironmentAsset | null {
  // Filter out category-level terms — they must never be used as search keywords
  const filtered = keywords
    .map((k) => k.toLowerCase())
    .filter((k) => !CATEGORY_TERMS.has(k) && k.length > 1);

  if (filtered.length === 0) return null;

  // 1. Exact tag/id match, category-gated
  for (const kw of filtered) {
    const match = ENVIRONMENT_CATALOG.find((a) =>
      (category == null || a.category === category) &&
      (a.tags.some((t) => t === kw) || a.id === kw)
    );
    if (match) return match;
  }

  // 2. Exact tag/id match, ignoring category
  for (const kw of filtered) {
    const match = ENVIRONMENT_CATALOG.find((a) =>
      a.tags.some((t) => t === kw) || a.id === kw
    );
    if (match) return match;
  }

  // 3. Fuzzy partial tag match
  for (const kw of filtered) {
    const match = ENVIRONMENT_CATALOG.find((a) =>
      a.tags.some((t) => t.includes(kw) || kw.includes(t))
    );
    if (match) return match;
  }

  // 4. Category fallback — pick first model in the category
  if (category) {
    const fallback = ENVIRONMENT_CATALOG.find((a) => a.category === category);
    if (fallback) return fallback;
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
  archetype = "",
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

