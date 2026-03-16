"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ENVIRONMENT_CATALOG, type EnvironmentAsset } from "@/lib/assets/environment-catalog";

interface AssetLibraryProps {
  onInsertAsset: (asset: EnvironmentAsset) => void;
}

// GCS folder-based categories (mapped from modelUrl path, not EnvironmentAsset.category)
const CATEGORIES = [
  { id: "all",          label: "All",         icon: "⊞" },
  { id: "animals",      label: "Animals",     icon: "🐾" },
  { id: "art_decor",    label: "Decor",       icon: "🏺" },
  { id: "buildings",    label: "Buildings",   icon: "🏛" },
  { id: "characters",   label: "Characters",  icon: "👤" },
  { id: "city_objects", label: "City",        icon: "🚦" },
  { id: "electronics",  label: "Electronics", icon: "💻" },
  { id: "furniture",    label: "Furniture",   icon: "🪑" },
  { id: "lighting",     label: "Lighting",    icon: "💡" },
  { id: "environment",  label: "Nature",      icon: "🌿" },
  { id: "vehicles",     label: "Vehicles",    icon: "🚗" },
  { id: "props",        label: "Props",       icon: "📦" },
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  animals: "🐾", art_decor: "🏺", buildings: "🏛", characters: "👤",
  city_objects: "🚦", electronics: "💻", furniture: "🪑", lighting: "💡",
  environment: "🌿", vehicles: "🚗", props: "📦", prop: "📦",
  structure: "🏗", vehicle: "🚗", character: "👤",
};

function getAssetFolder(asset: EnvironmentAsset): string {
  // Extract folder from URL: .../3dmodels_mml/{folder}/{file}.glb
  const parts = asset.modelUrl.split("/");
  return parts[parts.length - 2] || "";
}

// ─── ModelPreview ───────────────────────────────────────────────────────────
function ModelPreview({ asset, isHovered }: { asset: EnvironmentAsset; isHovered: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Only start timeout when hovered (model-viewer only loads on hover)
    if (isHovered) {
      timerRef.current = setTimeout(() => setFailed(true), 10000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [asset.id, isHovered]);

  const folder = getAssetFolder(asset);
  const icon = CATEGORY_ICONS[folder] || CATEGORY_ICONS[asset.category] || "⬡";

  // Show icon when not hovered or failed
  if (!isHovered || failed) {
    return (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "#121a33", gap: "3px",
      }}>
        <span style={{ fontSize: "22px" }}>{icon}</span>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0a0f1f" }}>
      {!loaded && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: "14px", zIndex: 1, color: "#8aa0c4",
        }}>
          <span className="geez-lib-spin">↻</span>
        </div>
      )}
      {/* @ts-ignore — model-viewer is a custom element loaded via CDN */}
      <model-viewer
        src={asset.modelUrl}
        auto-rotate
        auto-rotate-delay="0"
        rotation-per-second="30deg"
        style={{
          width: "100%", height: "100%", background: "transparent",
          opacity: loaded ? 1 : 0, transition: "opacity 0.25s",
        }}
        onLoad={() => {
          setLoaded(true);
          if (timerRef.current) clearTimeout(timerRef.current);
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ─── AssetCard ───────────────────────────────────────────────────────────────
function AssetCard({ asset, onInsert }: { asset: EnvironmentAsset; onInsert: (a: EnvironmentAsset) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onInsert(asset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${asset.name} — click to insert`}
      style={{
        position: "relative",
        background: hovered ? "#1a2240" : "#121a33",
        border: `1px solid ${hovered ? "#14b8a6" : "#223052"}`,
        borderRadius: "6px", overflow: "hidden", cursor: "pointer",
        transition: "all 0.12s",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "0 2px 10px rgba(20,184,166,0.15)" : "none",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ height: "72px", flexShrink: 0, overflow: "hidden" }}>
        <ModelPreview asset={asset} isHovered={hovered} />
      </div>
      <div style={{
        padding: "4px 6px 5px",
        borderTop: `1px solid ${hovered ? "#14b8a6" : "#223052"}`,
        background: hovered ? "#1a2240" : "#0d1326",
        transition: "background 0.12s",
      }}>
        <div style={{
          fontSize: "10px", fontWeight: 500,
          color: hovered ? "#14b8a6" : "#e6f1ff",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}>
          {asset.name}
        </div>
        <div style={{ fontSize: "9px", color: "#8aa0c4", marginTop: "1px", textTransform: "capitalize" }}>
          {getAssetFolder(asset).replace(/_/g, " ")}
        </div>
      </div>
      {hovered && (
        <div style={{
          position: "absolute", top: "4px", right: "4px",
          background: "#14b8a6", color: "#0a0f1f",
          borderRadius: "3px", padding: "1px 5px",
          fontSize: "9px", fontWeight: 700, pointerEvents: "none",
        }}>
          + Add
        </div>
      )}
    </div>
  );
}

// ─── AssetLibrary ────────────────────────────────────────────────────────────
const PAGE_SIZE = 24;

export function AssetLibrary({ onInsertAsset }: AssetLibraryProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let assets = ENVIRONMENT_CATALOG;
    if (activeCategory !== "all") {
      assets = assets.filter((a) => {
        const folder = getAssetFolder(a);
        // "props" tab matches both "props" folder and prop/structure category
        if (activeCategory === "props") {
          return folder === "props" || a.category === "prop" || a.category === "structure";
        }
        return folder === activeCategory || a.category === activeCategory;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      assets = assets.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        a.description.toLowerCase().includes(q)
      );
    }
    return assets;
  }, [activeCategory, search]);

  useEffect(() => { setPage(1); }, [activeCategory, search]);

  const shown = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = page * PAGE_SIZE < filtered.length;

  // Count per folder
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ENVIRONMENT_CATALOG.length };
    for (const a of ENVIRONMENT_CATALOG) {
      const folder = getAssetFolder(a);
      if (folder) counts[folder] = (counts[folder] || 0) + 1;
      // props tab also counts prop/structure category items not in "props" folder
      if (a.category === "prop" || a.category === "structure") {
        counts["props"] = (counts["props"] || 0) + 1;
      }
    }
    return counts;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#0a0f1f" }}>
      <style>{`
        .geez-lib-spin {
          animation: geez-lib-rotate 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes geez-lib-rotate {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* Search */}
      <div style={{ padding: "7px 8px", borderBottom: "1px solid #223052", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: "#121a33", border: "1px solid #223052",
          borderRadius: "5px", padding: "4px 8px",
        }}>
          <span style={{ fontSize: "11px", color: "#8aa0c4" }}>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${ENVIRONMENT_CATALOG.length} models…`}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: "11px", color: "#e6f1ff", fontFamily: "inherit",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#8aa0c4", fontSize: "11px", padding: 0, lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div style={{
        display: "flex", gap: "3px", padding: "5px 7px",
        overflowX: "auto", flexShrink: 0,
        borderBottom: "1px solid #223052",
        scrollbarWidth: "none",
      }}>
        {CATEGORIES.map((cat) => {
          const count = folderCounts[cat.id] ?? 0;
          if (count === 0 && cat.id !== "all") return null;
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flexShrink: 0, padding: "2px 7px", borderRadius: "4px", cursor: "pointer",
                border: active ? "1px solid #14b8a6" : "1px solid #223052",
                background: active ? "rgba(20,184,166,0.12)" : "#0d1326",
                color: active ? "#14b8a6" : "#8aa0c4",
                fontSize: "10px", fontWeight: active ? 600 : 400,
                fontFamily: "inherit", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: "3px",
                transition: "all 0.1s",
              }}
            >
              <span style={{ fontSize: "10px" }}>{cat.icon}</span>
              {cat.label}
              <span style={{
                fontSize: "8px", opacity: 0.7,
                background: active ? "rgba(20,184,166,0.15)" : "#121a33",
                borderRadius: "3px", padding: "0 3px",
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Result count */}
      <div style={{ padding: "3px 9px 2px", fontSize: "9px", color: "#8aa0c4", flexShrink: 0 }}>
        {search
          ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search}"`
          : `${filtered.length} models`}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "5px 7px 10px" }}>
        {filtered.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", height: "80px", gap: "6px",
            color: "#8aa0c4", fontSize: "11px",
          }}>
            <span style={{ fontSize: "18px" }}>⌕</span>
            No results for &ldquo;{search}&rdquo;
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
              {shown.map((asset) => (
                <AssetCard key={asset.id} asset={asset} onInsert={onInsertAsset} />
              ))}
            </div>
            {hasMore && (
              <div style={{ textAlign: "center", paddingTop: "8px" }}>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    padding: "5px 16px",
                    background: "#0d1326", border: "1px solid #223052",
                    borderRadius: "5px", fontSize: "10px", color: "#8aa0c4",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Load more ({filtered.length - shown.length} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AssetLibrary;
