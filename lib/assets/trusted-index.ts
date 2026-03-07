import type { TrustedAsset } from "@/types/assets";
import { ENVIRONMENT_CATALOG, GCS_BASE } from "./environment-catalog";

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
// 1. GCS Bucket (gs://3dmodels_mml) — 667 GLB models, 11 categories
// 2. Geez Collection (IDs 0-5555) — project-specific assets
//
// NO other external sources allowed. No polyhaven, no poly.pizza, no Khronos.

// Build trusted assets from the environment catalog (all from GCS bucket)
export const TRUSTED_ASSETS: TrustedAsset[] = ENVIRONMENT_CATALOG.map((a) => ({
  id: `gcs-${a.id}`,
  name: a.name,
  description: a.description,
  url: a.modelUrl,
  license: "Proprietary",
  sizeBytes: 0,
  mimeType: "model/gltf-binary",
  tags: a.tags,
  source: "gcs-bucket" as TrustedAsset["source"],
  validated: true,
}));

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
