import { v4 as uuidv4 } from "uuid";
import type { AssetManifestEntry, TrustedAsset } from "@/types/assets";
import { validateExternalURL } from "./storage";

export function trustedAssetToManifestEntry(
  asset: TrustedAsset
): AssetManifestEntry {
  return {
    id: asset.id,
    url: asset.url,
    source: "trusted-index",
    validated: asset.validated,
    validatedAt: new Date().toISOString(),
    sizeBytes: asset.sizeBytes,
    mimeType: asset.mimeType,
    name: asset.name,
    license: asset.license,
    previewUrl: asset.previewUrl,
  };
}

export async function validateAndAddExternalAsset(
  url: string,
  name?: string
): Promise<AssetManifestEntry | null> {
  const result = await validateExternalURL(url);

  if (!result.valid) return null;

  return {
    id: uuidv4(),
    url,
    source: "external-validated",
    validated: true,
    validatedAt: new Date().toISOString(),
    sizeBytes: result.sizeBytes,
    mimeType: result.mimeType,
    name: name || url.split("/").pop() || "asset",
  };
}

export function deduplicateManifest(
  manifest: AssetManifestEntry[]
): AssetManifestEntry[] {
  const seen = new Set<string>();
  return manifest.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}

export function filterManifestByMML(
  manifest: AssetManifestEntry[],
  mmlHtml: string
): AssetManifestEntry[] {
  return manifest.filter((entry) => mmlHtml.includes(entry.url));
}
