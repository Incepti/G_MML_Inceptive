"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useEditorStore } from "@/lib/store";
import type { RegistryAsset } from "@/types/assets";

export function AssetBrowser() {
  const {
    assetSearchQuery,
    setAssetSearchQuery,
    activeProjectId,
    addAssetToProject,
  } = useEditorStore();

  const [assets, setAssets] = useState<RegistryAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestName, setIngestName] = useState("");
  const [ingestCategory, setIngestCategory] = useState("props");
  const [ingestLicense, setIngestLicense] = useState("CC0");
  const [ingestSource, setIngestSource] = useState("poly.pizza");
  const [ingestPolyCount, setIngestPolyCount] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestSuccess, setIngestSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string, cat: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/assets/search?q=${encodeURIComponent(q)}&pageSize=30&category=${encodeURIComponent(cat)}`
      );
      const data = await res.json();
      setAssets(data.assets || []);
      setTotal(data.total || 0);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(assetSearchQuery, category), 300);
    return () => clearTimeout(timer);
  }, [assetSearchQuery, category, search]);

  useEffect(() => {
    search("", category);
  }, [search, category]);

  const handleAddToProject = (asset: RegistryAsset) => {
    if (!activeProjectId) return;
    addAssetToProject(activeProjectId, {
      id: asset.id,
      url: asset.localUrl,
      source: "registry",
      validated: true,
      validatedAt: new Date().toISOString(),
      sizeBytes: asset.sizeBytes ?? 0,
      mimeType: asset.mimeType || "model/gltf-binary",
      name: asset.name,
      license: asset.license,
      previewUrl: asset.previewUrl,
    });
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setUploadError(data.error || "Upload failed");
        return;
      }

      // Add to project manifest
      if (activeProjectId && data.asset) {
        addAssetToProject(activeProjectId, data.asset);
      }
    } catch (e) {
      setUploadError(String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleIngest = async () => {
    if (!ingestUrl.trim() || !ingestName.trim()) return;
    setIngesting(true);
    setIngestError(null);
    setIngestSuccess(null);

    try {
      const res = await fetch("/api/assets/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: ingestUrl.trim(),
          name: ingestName.trim(),
          category: ingestCategory,
          license: ingestLicense,
          source: ingestSource,
          polyCount: ingestPolyCount ? Number(ingestPolyCount) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setIngestError(data.error || "Ingestion failed");
        return;
      }

      setIngestSuccess(`Ingested: ${data.asset?.name || ingestName}`);
      setIngestUrl("");
      setIngestName("");
      setIngestPolyCount("");
      search(assetSearchQuery, category);
    } catch (e) {
      setIngestError(String(e));
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2 border-b border-editor-border shrink-0">
        <div className="flex gap-2">
          <input
            value={assetSearchQuery}
            onChange={(e) => setAssetSearchQuery(e.target.value)}
            placeholder="Search internal assets..."
            className="flex-1 bg-editor-bg border border-editor-border rounded px-2 py-1.5 text-xs text-editor-text placeholder:text-editor-text-muted focus:outline-none focus:border-editor-accent"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-editor-bg border border-editor-border rounded px-2 py-1.5 text-xs text-editor-text"
          >
            {[
              "all",
              "environment",
              "architecture",
              "props",
              "vehicles",
              "characters",
              "nature",
              "furniture",
              "vfx",
              "misc",
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Upload */}
      <div className="p-2 border-b border-editor-border shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-1.5 text-xs border border-dashed border-editor-border rounded text-editor-text-muted hover:border-editor-accent hover:text-editor-accent transition-colors disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "↑ Upload GLB / Texture"}
        </button>
        {uploadError && (
          <div className="mt-1 text-xs text-red-400">{uploadError}</div>
        )}
      </div>

      {/* Ingest */}
      <div className="p-2 border-b border-editor-border shrink-0 space-y-2">
        <div className="text-[10px] text-editor-text-muted uppercase tracking-wider font-semibold">
          Ingest External GLB
        </div>
        <input
          value={ingestUrl}
          onChange={(e) => setIngestUrl(e.target.value)}
          placeholder="Direct .glb URL (approved sources)"
          className="w-full bg-editor-bg border border-editor-border rounded px-2 py-1.5 text-xs text-editor-text placeholder:text-editor-text-muted focus:outline-none focus:border-editor-accent"
        />
        <input
          value={ingestName}
          onChange={(e) => setIngestName(e.target.value)}
          placeholder="Asset name"
          className="w-full bg-editor-bg border border-editor-border rounded px-2 py-1.5 text-xs text-editor-text placeholder:text-editor-text-muted focus:outline-none focus:border-editor-accent"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={ingestCategory}
            onChange={(e) => setIngestCategory(e.target.value)}
            className="bg-editor-bg border border-editor-border rounded px-2 py-1.5 text-xs text-editor-text"
          >
            {[
              "environment",
              "architecture",
              "props",
              "vehicles",
              "characters",
              "nature",
              "furniture",
              "vfx",
              "misc",
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={ingestLicense}
            onChange={(e) => setIngestLicense(e.target.value)}
            className="bg-editor-bg border border-editor-border rounded px-2 py-1.5 text-xs text-editor-text"
          >
            {["CC0", "CC BY 4.0", "MIT", "Custom", "Unknown"].map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={ingestSource}
            onChange={(e) => setIngestSource(e.target.value)}
            placeholder="Source (poly.pizza / kenney / quaternius)"
            className="bg-editor-bg border border-editor-border rounded px-2 py-1.5 text-xs text-editor-text placeholder:text-editor-text-muted focus:outline-none focus:border-editor-accent"
          />
          <input
            value={ingestPolyCount}
            onChange={(e) => setIngestPolyCount(e.target.value)}
            placeholder="Poly count (optional)"
            className="bg-editor-bg border border-editor-border rounded px-2 py-1.5 text-xs text-editor-text placeholder:text-editor-text-muted focus:outline-none focus:border-editor-accent"
          />
        </div>
        <button
          onClick={handleIngest}
          disabled={ingesting || !ingestUrl.trim() || !ingestName.trim()}
          className="w-full py-1.5 text-xs border border-editor-border rounded text-editor-text hover:border-editor-accent hover:text-editor-accent transition-colors disabled:opacity-50"
        >
          {ingesting ? "Ingesting..." : "Ingest Asset"}
        </button>
        {ingestError && (
          <div className="text-xs text-red-400">{ingestError}</div>
        )}
        {ingestSuccess && (
          <div className="text-xs text-green-400">{ingestSuccess}</div>
        )}
      </div>

      {/* Asset Grid */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-center text-editor-text-muted text-xs py-8">
            Loading...
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center text-editor-text-muted text-xs py-8">
            No assets found
          </div>
        ) : (
          <>
            <div className="text-[10px] text-editor-text-muted mb-2">
              {total} internal assets
            </div>
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="flex gap-2 p-2 bg-editor-panel rounded border border-editor-border hover:border-editor-accent/50 transition-colors group"
              >
                {/* Preview */}
                <div className="w-10 h-10 bg-editor-bg rounded overflow-hidden shrink-0">
                  {asset.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.previewUrl}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-editor-text-muted text-xs">
                      ⬡
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-editor-text truncate">
                    {asset.name}
                  </div>
                  <div className="text-[10px] text-editor-text-muted">
                    {(asset.sizeBytes ? asset.sizeBytes / 1024 : 0).toFixed(0)}KB · {asset.license} · {asset.category}
                  </div>
                  {asset.polyCount !== undefined && (
                    <div className="text-[10px] text-editor-text-muted">
                      {asset.polyCount.toLocaleString()} polys
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    <span className="text-[9px] px-1 bg-editor-border rounded text-editor-text-muted">
                      {asset.source}
                    </span>
                  </div>
                </div>

                {/* Add Button */}
                <button
                  onClick={() => handleAddToProject(asset)}
                  disabled={!activeProjectId}
                  title={
                    activeProjectId
                      ? "Add to project manifest"
                      : "Select a project first"
                  }
                  className="shrink-0 self-start opacity-0 group-hover:opacity-100 transition-opacity text-editor-accent hover:text-white text-xs bg-editor-accent/10 hover:bg-editor-accent px-2 py-1 rounded disabled:opacity-30"
                >
                  +
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
