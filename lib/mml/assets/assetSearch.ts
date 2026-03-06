/**
 * Semantic Asset Search — keyword-based search across all asset sources.
 *
 * Provides a unified search interface over:
 * - Local environment catalog (ENVIRONMENT_CATALOG)
 * - Trusted asset index (TRUSTED_ASSETS)
 *
 * Scoring is based on tag overlap, category match, and exact keyword hits.
 * Results are ranked by score, category-gated, and deduplicated.
 *
 * Deterministic — same inputs → same outputs.
 */

import type { AssetCategory, AssetSearchMatch, AssetSearchOptions } from "./assetTypes";
import {
  ENVIRONMENT_CATALOG,
  type EnvironmentAsset,
} from "@/lib/assets/environment-catalog";
import { TRUSTED_ASSETS } from "@/lib/assets/trusted-index";
import { classifyAssetCategory } from "./assetResolver";

/** Category-level terms that should NOT be used as search keywords. */
const CATEGORY_TERMS = new Set([
  "vehicle", "character", "furniture", "structure", "prop",
  "lighting", "environment", "animal", "creature", "nature",
  "plant", "machine", "animated", "basic", "pbr",
]);

/**
 * Search all local asset sources for matches.
 *
 * Scores each asset by keyword overlap and category relevance.
 * Returns results sorted by score descending.
 */
export function searchAssets(opts: AssetSearchOptions): AssetSearchMatch[] {
  const { keywords, category, maxResults = 10, minScore = 0.1 } = opts;

  // Filter out category-level terms from keywords
  const searchTerms = keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 1 && !CATEGORY_TERMS.has(k));

  if (searchTerms.length === 0) return [];

  const results: AssetSearchMatch[] = [];

  // Search environment catalog
  for (const asset of ENVIRONMENT_CATALOG) {
    if (category && asset.category !== category) continue;
    const score = scoreAsset(asset.tags, asset.id, asset.name, searchTerms);
    if (score >= minScore) {
      results.push({
        id: asset.id,
        name: asset.name,
        category: asset.category as AssetCategory,
        modelUrl: asset.modelUrl,
        scale: asset.defaultScale,
        tags: asset.tags,
        source: "environment-catalog",
        score,
      });
    }
  }

  // Search trusted index
  for (const asset of TRUSTED_ASSETS) {
    const assetCat = classifyAssetCategory(
      asset.tags[0] || "prop",
      asset.tags,
    );
    if (category && assetCat !== category) continue;
    const score = scoreAsset(asset.tags, asset.id, asset.name, searchTerms);
    if (score >= minScore) {
      results.push({
        id: asset.id,
        name: asset.name,
        category: assetCat as AssetCategory,
        modelUrl: asset.url,
        scale: 1,
        tags: asset.tags,
        source: "trusted-index",
        score,
      });
    }
  }

  // Sort by score descending, deduplicate by model URL
  results.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const deduped: AssetSearchMatch[] = [];
  for (const r of results) {
    if (!seen.has(r.modelUrl)) {
      seen.add(r.modelUrl);
      deduped.push(r);
    }
    if (deduped.length >= maxResults) break;
  }

  return deduped;
}

/**
 * Score an asset against search terms.
 * Higher = better match.
 */
function scoreAsset(
  tags: string[],
  id: string,
  name: string,
  searchTerms: string[],
): number {
  let score = 0;
  const lowerTags = tags.map((t) => t.toLowerCase());
  const lowerId = id.toLowerCase();
  const lowerName = name.toLowerCase();

  for (const term of searchTerms) {
    // Exact tag match (strongest signal)
    if (lowerTags.includes(term)) {
      score += 1.0;
    }
    // ID exact match
    else if (lowerId === term) {
      score += 0.9;
    }
    // Name contains term
    else if (lowerName.includes(term)) {
      score += 0.6;
    }
    // Tag contains term (substring)
    else if (lowerTags.some((t) => t.includes(term))) {
      score += 0.3;
    }
    // Term contains a tag (reverse substring)
    else if (lowerTags.some((t) => term.includes(t) && t.length > 2)) {
      score += 0.2;
    }
  }

  // Normalize by number of search terms
  return searchTerms.length > 0 ? score / searchTerms.length : 0;
}
