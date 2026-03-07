#!/usr/bin/env node
/**
 * Generate environment-catalog.ts from GCS bucket listing + curated keywords.
 *
 * Reads:
 *   - scripts/gcs_catalog.json  (667 model entries from bucket listing)
 *   - scripts/Keywords_Models.md (curated keyword file from GCS)
 *
 * Writes:
 *   - lib/assets/environment-catalog.ts
 *
 * Usage:  node scripts/generate-catalog.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CATALOG_JSON = path.join(__dirname, "gcs_catalog.json");
const KEYWORDS_MD = path.join(__dirname, "Keywords_Models.md");
const OUTPUT = path.join(ROOT, "lib", "assets", "environment-catalog.ts");

// ─── Folder → EnvironmentAsset category mapping ─────────────────────────────
const FOLDER_CATEGORY = {
  animals: "character",
  art_decor: "prop",
  buildings: "structure",
  characters: "character",
  city_objects: "prop",
  electronics: "prop",
  environment: "environment",
  food: "prop",
  furniture: "furniture",
  props: "prop",
  vehicles: "vehicle",
};

// ─── Parse Keywords_Models.md ────────────────────────────────────────────────

function parseKeywordsMd(mdText) {
  // Returns Map<modelId, string[]> where string[] is the curated keyword list.
  // The .md alternates: model_pattern line, blank, keywords line, blank.

  const keywordMap = new Map();
  const lines = mdText.split(/\r?\n/);

  // Skip everything before the first section header or separator
  let started = false;
  const skipLine = (l) => {
    const t = l.trim();
    if (!started) {
      if (t.startsWith("##") || t.startsWith("---")) {
        started = true;
      }
      return true; // skip everything before first header
    }
    return (
      t === "" ||
      t.startsWith("#") ||
      t.startsWith("---") ||
      t === "Model" ||
      t === "Keywords" ||
      t.startsWith("That covers all") ||
      t.startsWith("Here")
    );
  };

  // Collect non-skip lines in order — they alternate: model_pattern, keywords
  const contentLines = [];
  for (const line of lines) {
    if (!skipLine(line)) {
      contentLines.push(line.trim());
    }
  }

  // Process pairs: [model_pattern, keywords_csv]
  for (let i = 0; i + 1 < contentLines.length; i += 2) {
    const modelPattern = contentLines[i];
    const keywordsCsv = contentLines[i + 1];

    // Parse keywords — split on comma, trim, lowercase, filter empty
    const keywords = keywordsCsv
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length > 0);

    // Expand model pattern to individual model IDs
    const modelIds = expandModelPattern(modelPattern);
    for (const id of modelIds) {
      // Merge if already exists (some models appear in multiple sections)
      const existing = keywordMap.get(id) || [];
      const merged = [...new Set([...existing, ...keywords])];
      keywordMap.set(id, merged);
    }
  }

  return keywordMap;
}

/**
 * Expand a model pattern string into individual model IDs.
 *
 * Handles:
 *   "cow"                           → ["cow"]
 *   "brass_vase_01/02"              → ["brass_vase_01", "brass_vase_02"]
 *   "big_building / large_building" → ["big_building", "large_building"]
 *   "house / house variants"        → ["house", "house_*"] (wildcard)
 *   "blasters (b–n)"               → ["blaster_b" ... "blaster_n"] (range)
 *   "pickup items (crate/health/...)" → ["pickup_crate", "pickup_health", ...]
 *   "sungka_board/02"               → ["sungka_board", "sungka_board_02"]
 */
function expandModelPattern(pattern) {
  const ids = [];

  // Handle parenthetical items: "pickup items (crate/health/jar/key_card/sphere/thunder)"
  const parenItemsMatch = pattern.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenItemsMatch) {
    let prefix = parenItemsMatch[1].trim().replace(/\s+items?$/i, "");
    const inner = parenItemsMatch[2];

    // Try both plural and singular prefix: "blasters" → also try "blaster"
    const prefixes = [prefix];
    if (prefix.endsWith("s") && prefix.length > 3) {
      prefixes.push(prefix.slice(0, -1));
    }

    // Check for letter range like "b–n" (en-dash) or "b-n"
    const rangeMatch = inner.match(/^([a-z])[\u2013\-]([a-z])$/i);
    if (rangeMatch) {
      const start = rangeMatch[1].toLowerCase().charCodeAt(0);
      const end = rangeMatch[2].toLowerCase().charCodeAt(0);
      for (const p of prefixes) {
        for (let c = start; c <= end; c++) {
          ids.push(`${p}_${String.fromCharCode(c)}`);
        }
      }
      return ids;
    }

    // Otherwise split by "/" for listed items
    const items = inner.split("/").map((s) => s.trim());
    for (const p of prefixes) {
      for (const item of items) {
        ids.push(`${p}_${item}`);
      }
    }
    return ids;
  }

  // Split by " / " (space-slash-space) to get top-level alternatives
  const parts = pattern.split(/\s+\/\s+/);

  // Compute prefix from first part for implicit-prefix variants
  // e.g., "enemy_flying / large / small" → prefix "enemy_"
  const firstTrimmed = parts[0].trim();
  const lastUnderFirst = firstTrimmed.lastIndexOf("_");
  const firstPartBase =
    lastUnderFirst >= 0 ? firstTrimmed.substring(0, lastUnderFirst + 1) : null;

  for (const part of parts) {
    const trimmed = part.trim();

    // Handle "variants" keyword — becomes a wildcard prefix
    if (/\bvariants?\b/i.test(trimmed)) {
      let prefix = trimmed.replace(/\s*variants?\s*/i, "").trim();
      // If prefix is empty, inherit from first part: "market_stalls / compact / variants"
      if (!prefix && firstTrimmed) prefix = firstTrimmed;
      if (prefix) ids.push(prefix + "_*"); // wildcard marker
      continue;
    }

    // Handle en-dash numeric ranges: "moon_rock_01–07", "namaqualand_boulder_02–06"
    const enDashRange = trimmed.match(
      /^(.+?)_(\d+)[\u2013\-](\d+)$/
    );
    if (enDashRange) {
      const base = enDashRange[1];
      const start = parseInt(enDashRange[2], 10);
      const end = parseInt(enDashRange[3], 10);
      const padLen = enDashRange[2].length;
      for (let n = start; n <= end; n++) {
        ids.push(`${base}_${String(n).padStart(padLen, "0")}`);
      }
      continue;
    }

    // Handle inline slash variants (no spaces around /): "brass_vase_01/02"
    if (trimmed.includes("/") && !trimmed.includes(" ")) {
      const firstSlash = trimmed.indexOf("/");
      const beforeSlash = trimmed.substring(0, firstSlash);
      const suffixes = trimmed
        .substring(firstSlash + 1)
        .split("/")
        .map((s) => s.trim())
        .filter((s) => s);

      // Check if beforeSlash ends with a short numeric suffix (_01, _02)
      const lastUnder = beforeSlash.lastIndexOf("_");
      const lastSegment =
        lastUnder >= 0 ? beforeSlash.substring(lastUnder + 1) : "";
      const isNumbered = /^\d{1,3}$/.test(lastSegment);

      if (isNumbered && lastUnder >= 0) {
        // "brass_vase_01/02" → base "brass_vase", suffixes 01, 02
        const base = beforeSlash.substring(0, lastUnder);
        ids.push(beforeSlash);
        for (const suffix of suffixes) {
          ids.push(`${base}_${suffix}`);
        }
      } else {
        // "sungka_board/02" → "sungka_board", "sungka_board_02"
        ids.push(beforeSlash);
        for (const suffix of suffixes) {
          ids.push(`${beforeSlash}_${suffix}`);
        }
      }
      continue;
    }

    // For short single-word parts in multi-part patterns, generate IDs with
    // multiple prefix strategies to cover naming variations:
    //   "solar_panel / ground"    → solar_panel_ground (full prefix)
    //   "enemy_flying / large"    → enemy_large (first-word prefix)
    if (parts.length > 1 && !trimmed.includes("_") && trimmed.length < 15) {
      // Full first part as prefix: "solar_panel" + "_" + "ground"
      ids.push(firstTrimmed + "_" + trimmed);
      // First-word prefix if different: "enemy_" + "large"
      if (firstPartBase && firstPartBase !== firstTrimmed + "_") {
        ids.push(firstPartBase + trimmed);
      }
    }

    // Plain model ID
    ids.push(trimmed);
  }

  return ids;
}

// ─── Build the catalog ──────────────────────────────────────────────────────

function buildCatalog() {
  const gcsCatalog = JSON.parse(fs.readFileSync(CATALOG_JSON, "utf-8"));
  const mdText = fs.readFileSync(KEYWORDS_MD, "utf-8");
  const keywordMap = parseKeywordsMd(mdText);

  // Build a quick lookup of all model IDs in gcs_catalog
  const modelIndex = new Map();
  for (const entry of gcsCatalog) {
    modelIndex.set(entry.id, entry);
  }

  // Expand wildcard entries in keywordMap
  const expandedMap = new Map();
  for (const [pattern, keywords] of keywordMap) {
    if (pattern.endsWith("_*")) {
      const prefix = pattern.slice(0, -2); // Remove "_*"
      for (const entry of gcsCatalog) {
        if (entry.id === prefix || entry.id.startsWith(prefix + "_")) {
          const existing = expandedMap.get(entry.id) || [];
          expandedMap.set(entry.id, [...new Set([...existing, ...keywords])]);
        }
      }
    } else {
      const existing = expandedMap.get(pattern) || [];
      expandedMap.set(pattern, [...new Set([...existing, ...keywords])]);
    }
  }

  // For models that don't have direct keyword matches, try fallbacks:
  // 1. Strip hash suffix: "large_building_01191" → "large_building"
  // 2. Add _01 suffix: "painted_wooden_cabinet" → "painted_wooden_cabinet_01"
  // 3. Strip trailing 's': "mountains" → "mountain", "rocks" → "rock"
  for (const entry of gcsCatalog) {
    if (expandedMap.has(entry.id)) continue;
    // Try stripping trailing hash suffix
    const baseId = entry.id.replace(/_[a-f0-9]{4,}$/, "");
    if (baseId !== entry.id && expandedMap.has(baseId)) {
      expandedMap.set(entry.id, [...expandedMap.get(baseId)]);
      continue;
    }
    // Try adding _01 suffix (some .md entries list _01 but bucket uses base name)
    const withSuffix = entry.id + "_01";
    if (expandedMap.has(withSuffix)) {
      expandedMap.set(entry.id, [...expandedMap.get(withSuffix)]);
      continue;
    }
    // Try singular form: "mountains" → "mountain", "bushes" → "bush" won't work
    // but "rocks" → "rock" would
    if (entry.id.endsWith("s") && entry.id.length > 3) {
      const singular = entry.id.slice(0, -1);
      if (expandedMap.has(singular)) {
        expandedMap.set(entry.id, [...expandedMap.get(singular)]);
        continue;
      }
    }
  }

  // Generate catalog entries
  let matched = 0;
  let unmatched = 0;
  const unmatchedIds = [];

  const entries = [];

  for (const entry of gcsCatalog) {
    const category = FOLDER_CATEGORY[entry.folder] || "prop";
    const curatedKeywords = expandedMap.get(entry.id);

    let tags;
    if (curatedKeywords && curatedKeywords.length > 0) {
      // Use curated keywords + also split multi-word keywords into individual words
      const allTags = new Set();
      for (const kw of curatedKeywords) {
        allTags.add(kw);
        // Also add individual words from multi-word keywords (3+ chars)
        if (kw.includes(" ")) {
          for (const word of kw.split(/\s+/)) {
            if (word.length > 2) {
              allTags.add(word);
            }
          }
        }
      }
      // Also add the model ID itself and folder name
      allTags.add(entry.id);
      allTags.add(entry.folder);
      tags = [...allTags];
      matched++;
    } else {
      // Fallback: split filename into words (auto-tags)
      const words = entry.id
        .split(/[_\-]+/)
        .filter((w) => w.length > 1 && !/^\d+$/.test(w));
      tags = [...new Set([...words, entry.folder])];
      unmatched++;
      unmatchedIds.push(entry.id);
    }

    // Pretty name from ID
    const name = entry.id
      .split(/[_\-]+/)
      .filter((w) => !/^\d+$/.test(w))
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    entries.push({
      id: entry.id,
      name,
      category,
      modelUrl: entry.url,
      defaultScale: 1,
      tags,
      description: `${name} (${entry.folder})`,
    });
  }

  console.log(
    `Catalog: ${entries.length} models, ${matched} with curated keywords, ${unmatched} with auto-tags`
  );
  if (unmatchedIds.length > 0) {
    console.log(`Unmatched models (auto-tags only):`);
    for (const id of unmatchedIds) {
      console.log(`  - ${id}`);
    }
  }

  return entries;
}

// ─── Generate TypeScript ────────────────────────────────────────────────────

function generateTs(entries) {
  const lines = [];

  lines.push(`/**
 * Environment Asset Catalog — GCS Bucket (3dmodels_mml)
 *
 * ${entries.length} verified GLB models across 11 categories.
 * Source: gs://3dmodels_mml — Inceptive Studio GCS bucket.
 * Keywords: scripts/Keywords_Models.md (curated per-model keywords)
 *
 * STRICT RULE: ALWAYS use 3D models from this catalog.
 * NEVER fall back to primitives unless user explicitly requests them.
 * NO other external model sources allowed.
 *
 * URL pattern: https://storage.googleapis.com/3dmodels_mml/{category}/{file}.glb
 * Auto-generated via: node scripts/generate-catalog.js
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

export const GCS_BASE = "https://storage.googleapis.com/3dmodels_mml";

const GCS_ASSETS: EnvironmentAsset[] = [`);

  for (const e of entries) {
    const tagsStr = e.tags.map((t) => JSON.stringify(t)).join(",");
    lines.push(
      `  { id: ${JSON.stringify(e.id)}, name: ${JSON.stringify(e.name)}, category: ${JSON.stringify(e.category)}, modelUrl: ${JSON.stringify(e.modelUrl)}, defaultScale: ${e.defaultScale}, tags: [${tagsStr}], description: ${JSON.stringify(e.description)} },`
    );
  }

  lines.push(`];

export const ENVIRONMENT_CATALOG: EnvironmentAsset[] = GCS_ASSETS;

/** Lookup by exact ID */
export function findAssetById(id: string): EnvironmentAsset | undefined {
  return ENVIRONMENT_CATALOG.find((a) => a.id === id);
}

/** All assets in a given category */
export function findAssetsByCategory(
  cat: EnvironmentAsset["category"],
): EnvironmentAsset[] {
  return ENVIRONMENT_CATALOG.filter((a) => a.category === cat);
}

/** Build a prompt-friendly catalog summary for the LLM */
export function buildEnvironmentCatalogPrompt(): string {
  const grouped: Record<string, EnvironmentAsset[]> = {};
  for (const a of ENVIRONMENT_CATALOG) {
    (grouped[a.category] ??= []).push(a);
  }
  const lines: string[] = ["Available 3D models (GCS bucket):"];
  for (const [cat, assets] of Object.entries(grouped)) {
    lines.push(\`\\n[\${cat}] (\${assets.length} models):\`);
    for (const a of assets) {
      lines.push(\`  - \${a.id}: \${a.tags.slice(0, 6).join(", ")}\`);
    }
  }
  return lines.join("\\n");
}
`);

  return lines.join("\n");
}

// ─── Main ───────────────────────────────────────────────────────────────────

const entries = buildCatalog();
const tsContent = generateTs(entries);
fs.writeFileSync(OUTPUT, tsContent, "utf-8");
console.log(`Written: ${OUTPUT} (${entries.length} entries)`);
