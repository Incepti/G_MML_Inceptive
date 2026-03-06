/**
 * Asset Resolver — model-first strategy.
 *
 * Before procedural building, attempts to resolve structures to verified
 * 3D model assets. If a matching model exists, the structure gets a
 * `modelSrc` property. Otherwise, it falls through to the procedural builder.
 *
 * Pipeline position: Blueprint → [Asset Resolver] → Builder → Serializer → MML
 *
 * STRICT MATCHING: Only resolves when a keyword matches an asset tag exactly.
 * If no exact match is found, returns null — the procedural builder handles it.
 * Never returns placeholder or fallback models.
 *
 * Deterministic — same inputs → same outputs. No network calls.
 */

import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";
import {
  ENVIRONMENT_CATALOG,
  type EnvironmentAsset,
} from "@/lib/assets/environment-catalog";
import {
  TRUSTED_ASSETS,
} from "@/lib/assets/trusted-index";

// ─── Keyword mapping: structure type → exact tags to match ──────────────────
// Only maps types that have known matching assets. Keeps matches tight.

const TYPE_SEARCH_TAGS: Record<string, string[]> = {
  lamp: ["lantern"],
  lantern: ["lantern"],
  tree: ["tree"],
  rock: ["rock"],
  barrel: ["barrel"],
  crate: ["crate"],
  truck: ["truck"],
  rocket: ["rocket"],
  horse: ["horse"],
  fox: ["fox"],
  fish: ["fish"],
  robot: ["robot"],
  duck: ["duck"],
  astronaut: ["astronaut"],
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve asset models for a blueprint's structures.
 * Returns a new BlueprintJSON where structures with matching models
 * have their `modelSrc` field populated.
 *
 * Only resolves top-level structures that lack:
 * - existing modelSrc
 * - existing geometry
 * - existing children
 *
 * This is a pre-builder pass. Structures with modelSrc will be serialized
 * as `<m-model>` and skip procedural building entirely.
 */
export function resolveAssets(blueprint: BlueprintJSON): BlueprintJSON {
  const structures = blueprint.scene.structures.map((s) =>
    resolveStructureAsset(s)
  );

  return { ...blueprint, scene: { ...blueprint.scene, structures } };
}

// Tags that are too generic to produce reliable matches.
// These exist on many assets and cause false positives (e.g. "character" → Astronaut).
const BLOCKED_SEARCH_TAGS = new Set([
  "character", "animal", "animated", "prop", "basic", "pbr",
  "environment", "nature", "sci-fi", "medieval", "urban",
]);

/**
 * Attempt to resolve a single structure to a model asset.
 * Uses STRICT exact-tag matching against environment catalog and trusted index.
 *
 * Returns null if no exact match is found. Never returns placeholder models.
 */
export function resolveAsset(
  _archetype: string,
  keywords: string[],
): EnvironmentAsset | null {
  // Filter out blocked generic tags
  const filtered = keywords
    .map((k) => k.toLowerCase())
    .filter((k) => !BLOCKED_SEARCH_TAGS.has(k));

  if (filtered.length === 0) return null;

  // Search environment catalog — exact tag or id match only
  for (const kw of filtered) {
    const match = ENVIRONMENT_CATALOG.find((a) =>
      a.tags.some((t) => t === kw) || a.id === kw
    );
    if (match) return match;
  }

  // Search trusted index — exact tag or id match only
  for (const kw of filtered) {
    const ta = TRUSTED_ASSETS.find((a) =>
      a.tags.some((t) => t === kw) || a.id === kw
    );
    if (ta) {
      return {
        id: ta.id,
        name: ta.name,
        category: mapTagsToCategory(ta.tags),
        modelUrl: ta.url,
        defaultScale: 1,
        tags: ta.tags,
        description: ta.description || ta.name,
      };
    }
  }

  return null;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function resolveStructureAsset(
  s: BlueprintStructure,
): BlueprintStructure {
  // Skip if already has model, geometry, children, light, or label
  if (s.modelSrc || s.geometry || s.children?.length || s.lightProps || s.label) {
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
  }

  const asset = resolveAsset("", keywords);
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

function mapTagsToCategory(tags: string[]): EnvironmentAsset["category"] {
  const tagSet = new Set(tags.map((t) => t.toLowerCase()));
  if (tagSet.has("vehicle") || tagSet.has("car") || tagSet.has("truck")) return "vehicle";
  if (tagSet.has("character") || tagSet.has("animal")) return "character";
  if (tagSet.has("furniture")) return "furniture";
  if (tagSet.has("light") || tagSet.has("lantern")) return "lighting";
  if (tagSet.has("environment")) return "environment";
  return "prop";
}
