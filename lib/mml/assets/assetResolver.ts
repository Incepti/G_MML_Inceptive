/**
 * Asset Resolver — model-first strategy.
 *
 * Before procedural building, attempts to resolve structures to verified
 * 3D model assets. If a matching model exists, the structure gets a
 * `modelSrc` property. Otherwise, it falls through to the procedural builder.
 *
 * Pipeline position: Blueprint → [Asset Resolver] → Builder → Serializer → MML
 *
 * Deterministic — same inputs → same outputs. No network calls.
 */

import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";
import {
  searchEnvironmentAssets,
  type EnvironmentAsset,
} from "@/lib/assets/environment-catalog";
import {
  searchTrustedAssets,
} from "@/lib/assets/trusted-index";

// ─── Keyword mapping: archetype + structure type → search terms ─────────────

const ARCHETYPE_SEARCH_TERMS: Record<string, string[]> = {
  vehicle: ["vehicle", "truck", "car"],
  creature: ["character", "animal"],
  nature: ["tree", "plant"],
  lighting: ["lantern", "light", "lamp"],
  container: ["bottle", "container", "barrel"],
  machine: ["robot", "machine"],
};

const TYPE_SEARCH_TERMS: Record<string, string[]> = {
  lamp: ["lantern", "light"],
  tree: ["tree", "plant"],
  rock: ["rock", "stone"],
  barrel: ["barrel", "container"],
  crate: ["crate", "box"],
  vehicle: ["vehicle", "truck", "car"],
  sign: ["sign"],
  bench: ["bench"],
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
  const archetype = blueprint.intent?.archetype || "";

  const structures = blueprint.scene.structures.map((s) =>
    resolveStructureAsset(s, archetype)
  );

  return { ...blueprint, scene: { ...blueprint.scene, structures } };
}

/**
 * Attempt to resolve a single structure to a model asset.
 * Searches environment catalog and trusted index by type, id, and archetype.
 */
export function resolveAsset(
  archetype: string,
  keywords: string[],
): EnvironmentAsset | null {
  // Search environment catalog (verified assets with semantic tags)
  for (const keyword of keywords) {
    const results = searchEnvironmentAssets(keyword);
    if (results && results.length > 0) {
      return results[0];
    }
  }

  // Search trusted index (broader asset library)
  for (const keyword of keywords) {
    const { assets } = searchTrustedAssets(keyword, 1, 1);
    if (assets.length > 0) {
      // Convert TrustedAsset to EnvironmentAsset format
      const ta = assets[0];
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
  archetype: string,
): BlueprintStructure {
  // Skip if already has model, geometry, children, light, or label
  if (s.modelSrc || s.geometry || s.children?.length || s.lightProps || s.label) {
    return s;
  }
  if (s.type === "light") return s;

  // Build search keywords from structure type, id, and archetype
  const keywords: string[] = [];

  // Add type-specific terms
  if (TYPE_SEARCH_TERMS[s.type]) {
    keywords.push(...TYPE_SEARCH_TERMS[s.type]);
  }
  keywords.push(s.type);
  keywords.push(s.id);

  // Add archetype-specific terms
  if (ARCHETYPE_SEARCH_TERMS[archetype]) {
    keywords.push(...ARCHETYPE_SEARCH_TERMS[archetype]);
  }

  const asset = resolveAsset(archetype, keywords);
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
