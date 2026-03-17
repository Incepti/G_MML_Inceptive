#!/usr/bin/env node
/**
 * Generate otherside-catalog.ts from the Otherside models JSON.
 *
 * Reads:  C:\Users\Admin\Music\Assets_Definer\models.json
 * Writes: lib/assets/otherside-catalog.ts
 *
 * Bucket structure assumed:
 *   Models: https://storage.googleapis.com/3dmodels_mml/otherside/{Category}/{file}.glb
 *   Icons:  https://storage.googleapis.com/3dmodels_mml/otherside/_icons/{Category}/{name}.png
 *
 * Usage: node scripts/generate-otherside-catalog.js
 */

const fs   = require("fs");
const path = require("path");

const ROOT       = path.resolve(__dirname, "..");
const INPUT_JSON = "C:\\Users\\Admin\\Music\\Assets_Definer\\models.json";
const OUTPUT     = path.join(ROOT, "lib", "assets", "otherside-catalog.ts");

const OTHERSIDE_BASE = "https://storage.googleapis.com/3dmodels_mml/OthersideModels";

// ─── Category → EnvironmentAsset.category ────────────────────────────────────
const ASSET_CATEGORY = {
  Creatures:          "character",
  Crystals_Gems:      "prop",
  Decorative_Props:   "prop",
  Flowers:            "environment",
  Ice_Snow:           "environment",
  Moss_Ground:        "environment",
  Mushrooms_Fungi:    "environment",
  Plants:             "environment",
  Rocks_Stones:       "environment",
  Ruins:              "structure",
  Shells_Coral:       "prop",
  Structures:         "structure",
  Terrain_Platforms:  "environment",
  Trees:              "environment",
  Volcanoes_Fire:     "environment",
};

// ─── Biome/prefix → readable tags ────────────────────────────────────────────
const BIOME_TAGS = {
  ACID:  ["acid", "toxic"],
  BIOL:  ["bioluminescent", "organic"],
  CRST:  ["crystal", "gem", "mineral"],
  JNGL:  ["jungle", "tropical"],
  GLCA:  ["glacial", "ice", "frozen"],
  MYCE:  ["mycelium", "fungus"],
  MLLW:  ["marshmallow", "candy"],
  MLTN:  ["molten", "lava", "fire"],
  MYSC:  ["mystic", "magical"],
  XBOG:  ["bog", "swamp"],
  SAND:  ["sand", "desert", "beach"],
  CRMS:  ["crimson", "red"],
  RUIN:  ["ruin", "ancient"],
  Plague:["plague", "blight"],
  Acid:  ["acid", "toxic"],
  KC:    ["kingdom", "magical"],
  MLLW:  ["mallow", "candy"],
};

// Parts to skip when building tags
const SKIP_PARTS = new Set([
  "SM", "SMM",
  "DR", "DRS", "STL", "STS", "HRO",
]);

// Split a PascalCase/CamelCase string into words
function splitCamel(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .split(" ")
    .map(w => w.toLowerCase())
    .filter(Boolean);
}

function buildTags(category, modelName) {
  const tags = new Set();

  // Add otherside source tag
  tags.add("otherside");

  // Add category-derived tags
  const catLower = category.toLowerCase().replace(/_/g, " ");
  catLower.split(" ").forEach(w => tags.add(w));

  // Split model name on underscores
  const parts = modelName.split("_");

  for (const part of parts) {
    if (SKIP_PARTS.has(part)) continue;

    // Numeric-only variants (01A, 02B) → skip
    if (/^\d+[A-Z]?$/.test(part)) continue;

    // Check biome prefixes
    const biomeTags = BIOME_TAGS[part];
    if (biomeTags) {
      biomeTags.forEach(t => tags.add(t));
    }

    // Split camelCase and add each word
    const words = splitCamel(part);
    words.forEach(w => {
      if (w.length > 1) tags.add(w);
    });
  }

  return [...tags];
}

function formatName(rawName) {
  // "SM_BIOL_STL_BrainGrub_01A" → "Brain Grub 01A"
  const parts = rawName.split("_");
  const meaningful = [];
  for (const p of parts) {
    if (SKIP_PARTS.has(p)) continue;
    if (BIOME_TAGS[p]) continue;         // skip biome codes
    meaningful.push(p);
  }
  return meaningful.join(" ");
}

function buildId(category, name) {
  // lowercase, spaces to dashes, deduplicate
  return `otherside-${category.toLowerCase().replace(/_/g, "-")}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const raw    = fs.readFileSync(INPUT_JSON, "utf-8");
const data   = JSON.parse(raw);

const entries = [];

for (const [category, models] of Object.entries(data)) {
  const assetCategory = ASSET_CATEGORY[category] || "prop";

  for (const model of models) {
    const id          = buildId(category, model.name);
    const name        = formatName(model.name);
    const modelUrl    = `${OTHERSIDE_BASE}/${category}/${model.file}`;
    const iconUrl     = `${OTHERSIDE_BASE}/${model.icon}`;
    const tags        = buildTags(category, model.name);
    const description = `${name} (otherside/${category})`;

    entries.push({
      id, name,
      category: assetCategory,
      subcategory: category,
      modelUrl,
      iconUrl,
      defaultScale: 1,
      tags,
      description,
    });
  }
}

// ─── Write TypeScript output ──────────────────────────────────────────────────
const lines = [
  `/**`,
  ` * Otherside Asset Catalog — GCS Bucket (3dmodels_mml/otherside)`,
  ` *`,
  ` * ${entries.length} GLB models across ${Object.keys(data).length} categories.`,
  ` * URL pattern: https://storage.googleapis.com/3dmodels_mml/otherside/{Category}/{file}.glb`,
  ` * Icons:       https://storage.googleapis.com/3dmodels_mml/otherside/_icons/{Category}/{name}.png`,
  ` *`,
  ` * Auto-generated via: node scripts/generate-otherside-catalog.js`,
  ` */`,
  ``,
  `import type { EnvironmentAsset } from "./environment-catalog";`,
  ``,
  `export const OTHERSIDE_BASE = "https://storage.googleapis.com/3dmodels_mml/OthersideModels";`,
  ``,
  `/** All Otherside subcategory names in display order */`,
  `export const OTHERSIDE_SUBCATEGORIES = ${JSON.stringify(Object.keys(data))} as const;`,
  `export type OthersideSubcategory = typeof OTHERSIDE_SUBCATEGORIES[number];`,
  ``,
  `export type OthersideAsset = EnvironmentAsset & {`,
  `  iconUrl: string;`,
  `  subcategory: OthersideSubcategory;`,
  `};`,
  ``,
  `export const OTHERSIDE_CATALOG: OthersideAsset[] = [`,
];

for (const e of entries) {
  lines.push(
    `  { id: ${JSON.stringify(e.id)}, name: ${JSON.stringify(e.name)}, ` +
    `category: ${JSON.stringify(e.category)}, subcategory: ${JSON.stringify(e.subcategory)}, ` +
    `modelUrl: ${JSON.stringify(e.modelUrl)}, iconUrl: ${JSON.stringify(e.iconUrl)}, ` +
    `defaultScale: 1, tags: ${JSON.stringify(e.tags)}, description: ${JSON.stringify(e.description)} },`
  );
}

lines.push(`];`);
lines.push(``);

fs.writeFileSync(OUTPUT, lines.join("\n"), "utf-8");

console.log(`✓ Written ${entries.length} otherside assets to lib/assets/otherside-catalog.ts`);
console.log(`  Categories: ${Object.keys(data).join(", ")}`);
