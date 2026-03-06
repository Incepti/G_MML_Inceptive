/**
 * Asset type definitions — centralized for the MML asset pipeline.
 *
 * Re-exports core types from types/assets.ts and adds
 * pipeline-specific types used by the resolver and search modules.
 */

export type {
  AssetSource,
  AssetManifestEntry,
  TrustedAsset,
  RegistryAsset,
  AssetSearchResult,
  ModelLibraryEntry,
  ModelLibrarySource,
  ModelProvider,
} from "@/types/assets";

/** Categories used by the asset resolver for category-gated matching. */
export type AssetCategory =
  | "vehicle"
  | "character"
  | "furniture"
  | "structure"
  | "prop"
  | "lighting"
  | "environment";

/** Result from the asset search pipeline. */
export interface AssetSearchMatch {
  id: string;
  name: string;
  category: AssetCategory;
  modelUrl: string;
  scale: number;
  tags: string[];
  source: string;
  score: number;
}

/** Options for asset search queries. */
export interface AssetSearchOptions {
  keywords: string[];
  category?: AssetCategory;
  maxResults?: number;
  minScore?: number;
}
