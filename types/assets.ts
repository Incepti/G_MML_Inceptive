export type AssetSource =
  | "trusted-index"
  | "upload"
  | "external-validated"
  | "geez-public"
  | "registry";

export interface AssetManifestEntry {
  id: string;
  url: string;
  source: AssetSource;
  validated: boolean;
  validatedAt?: string;
  sizeBytes: number;
  mimeType: string;
  name: string;
  license?: string;
  previewUrl?: string;
  checksum?: string;
}

export interface TrustedAsset {
  id: string;
  name: string;
  description?: string;
  url: string;
  previewUrl?: string;
  license: string;
  sizeBytes: number;
  mimeType: string;
  tags: string[];
  source: "khronos" | "modelviewer" | "mml-io" | "geez-public" | "community";
  validated: boolean;
}

export interface RegistryAsset {
  id: string;
  name: string;
  category: string;
  source: string;
  license: string;
  localUrl: string;
  previewUrl?: string;
  polyCount?: number;
  sizeBytes?: number;
  mimeType?: string;
  createdAt?: string;
}

export interface AssetSearchResult {
  assets: RegistryAsset[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UploadResult {
  success: boolean;
  asset?: AssetManifestEntry;
  error?: string;
}
