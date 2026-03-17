"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ENVIRONMENT_CATALOG, type EnvironmentAsset } from "@/lib/assets/environment-catalog";
import {
  OTHERSIDE_CATALOG,
  OTHERSIDE_SUBCATEGORIES,
  type OthersideAsset,
} from "@/lib/assets/otherside-catalog";

interface AssetLibraryProps {
  onInsertAsset: (asset: EnvironmentAsset) => void;
}

// ─── GCS categories ──────────────────────────────────────────────────────────
const GCS_CATEGORIES = [
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

// Otherside subcategory display icons
const OTHERSIDE_ICONS: Record<string, string> = {
  Creatures:         "🐙",
  Crystals_Gems:     "💎",
  Decorative_Props:  "✨",
  Flowers:           "🌸",
  Ice_Snow:          "❄️",
  Moss_Ground:       "🟢",
  Mushrooms_Fungi:   "🍄",
  Plants:            "🌿",
  Rocks_Stones:      "🪨",
  Ruins:             "🏚",
  Shells_Coral:      "🐚",
  Structures:        "🏗",
  Terrain_Platforms: "⛰️",
  Trees:             "🌳",
  Volcanoes_Fire:    "🌋",
};

function getAssetFolder(asset: EnvironmentAsset): string {
  const parts = asset.modelUrl.split("/");
  return parts[parts.length - 2] || "";
}

// ─── ModelPreview (GCS assets — model-viewer on hover) ───────────────────────
function ModelPreview({ asset, isHovered }: { asset: EnvironmentAsset; isHovered: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isHovered) {
      timerRef.current = setTimeout(() => setFailed(true), 10000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [asset.id, isHovered]);

  const folder = getAssetFolder(asset);
  const icon = CATEGORY_ICONS[folder] || CATEGORY_ICONS[asset.category] || "⬡";

  if (!isHovered || failed) {
    return (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#121a33",
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
      {/* @ts-ignore */}
      <model-viewer
        src={asset.modelUrl}
        auto-rotate
        auto-rotate-delay="0"
        rotation-per-second="30deg"
        style={{
          width: "100%", height: "100%", background: "transparent",
          opacity: loaded ? 1 : 0, transition: "opacity 0.25s",
        }}
        onLoad={() => { setLoaded(true); if (timerRef.current) clearTimeout(timerRef.current); }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

// ─── OthersidePreview (always shows PNG icon — no model-viewer) ──────────────
function OthersidePreview({ asset }: { asset: OthersideAsset }) {
  const [imgFailed, setImgFailed] = useState(false);
  const fallback = OTHERSIDE_ICONS[asset.subcategory] || "⬡";

  if (imgFailed) {
    return (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0d0f1e",
      }}>
        <span style={{ fontSize: "22px" }}>{fallback}</span>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", background: "#0d0f1e", overflow: "hidden" }}>
      <img
        src={asset.iconUrl}
        alt={asset.name}
        onError={() => setImgFailed(true)}
        style={{
          width: "100%", height: "100%",
          objectFit: "contain",
          imageRendering: "auto",
        }}
      />
    </div>
  );
}

// ─── AssetCard (GCS) ─────────────────────────────────────────────────────────
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

// ─── OthersideCard ────────────────────────────────────────────────────────────
function OthersideCard({ asset, onInsert }: { asset: OthersideAsset; onInsert: (a: EnvironmentAsset) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onInsert(asset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${asset.name} — click to insert`}
      style={{
        position: "relative",
        background: hovered ? "#1a1a2e" : "#0f0f1e",
        border: `1px solid ${hovered ? "#a855f7" : "#2a1a4a"}`,
        borderRadius: "6px", overflow: "hidden", cursor: "pointer",
        transition: "all 0.12s",
        transform: hovered ? "translateY(-1px)" : "none",
        boxShadow: hovered ? "0 2px 12px rgba(168,85,247,0.2)" : "none",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ height: "72px", flexShrink: 0, overflow: "hidden" }}>
        <OthersidePreview asset={asset} />
      </div>
      <div style={{
        padding: "4px 6px 5px",
        borderTop: `1px solid ${hovered ? "#a855f7" : "#2a1a4a"}`,
        background: hovered ? "#1a1a2e" : "#0c0c1c",
        transition: "background 0.12s",
      }}>
        <div style={{
          fontSize: "10px", fontWeight: 500,
          color: hovered ? "#c084fc" : "#e6e6ff",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}>
          {asset.name}
        </div>
        <div style={{ fontSize: "9px", color: "#7070aa", marginTop: "1px" }}>
          {asset.subcategory.replace(/_/g, " ")}
        </div>
      </div>
      {hovered && (
        <div style={{
          position: "absolute", top: "4px", right: "4px",
          background: "#a855f7", color: "#fff",
          borderRadius: "3px", padding: "1px 5px",
          fontSize: "9px", fontWeight: 700, pointerEvents: "none",
        }}>
          + Add
        </div>
      )}
    </div>
  );
}

// ─── AssetLibrary ─────────────────────────────────────────────────────────────
const PAGE_SIZE = 24;
type LibraryTab = "otherside" | "gcs";

export function AssetLibrary({ onInsertAsset }: AssetLibraryProps) {
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("otherside");
  const [activeCategory, setActiveCategory] = useState("all");
  const [othersideSubcat, setOthersideSubcat] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [libraryTab, activeCategory, othersideSubcat, search]);

  // ─── Filtered assets ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (libraryTab === "otherside") {
      let assets: OthersideAsset[] = OTHERSIDE_CATALOG;
      if (othersideSubcat !== "all") {
        assets = assets.filter((a) => a.subcategory === othersideSubcat);
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        assets = assets.filter((a) =>
          a.name.toLowerCase().includes(q) ||
          a.subcategory.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return assets;
    }

    // GCS tab
    let assets = ENVIRONMENT_CATALOG;
    if (activeCategory !== "all") {
      assets = assets.filter((a) => {
        const folder = getAssetFolder(a);
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
  }, [libraryTab, activeCategory, othersideSubcat, search]);

  const shown = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);
  const hasMore = page * PAGE_SIZE < filtered.length;

  // Counts for GCS folder tabs
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: ENVIRONMENT_CATALOG.length };
    for (const a of ENVIRONMENT_CATALOG) {
      const folder = getAssetFolder(a);
      if (folder) counts[folder] = (counts[folder] || 0) + 1;
      if (a.category === "prop" || a.category === "structure") {
        counts["props"] = (counts["props"] || 0) + 1;
      }
    }
    return counts;
  }, []);

  // Counts for Otherside subcategory tabs
  const othersideCounts = useMemo(() => {
    const counts: Record<string, number> = { all: OTHERSIDE_CATALOG.length };
    for (const a of OTHERSIDE_CATALOG) {
      counts[a.subcategory] = (counts[a.subcategory] || 0) + 1;
    }
    return counts;
  }, []);

  const totalCount = libraryTab === "otherside" ? OTHERSIDE_CATALOG.length : ENVIRONMENT_CATALOG.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#0a0a18" }}>
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

      {/* ── Top library switcher ── */}
      <div style={{
        display: "flex", gap: "0", flexShrink: 0,
        borderBottom: "1px solid #1a1a3a",
      }}>
        <button
          onClick={() => setLibraryTab("otherside")}
          style={{
            flex: 1, padding: "7px 4px", cursor: "pointer", fontFamily: "inherit",
            border: "none", borderBottom: libraryTab === "otherside" ? "2px solid #a855f7" : "2px solid transparent",
            background: libraryTab === "otherside" ? "#12103a" : "#0a0a18",
            color: libraryTab === "otherside" ? "#c084fc" : "#6060a0",
            fontSize: "10px", fontWeight: libraryTab === "otherside" ? 700 : 400,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            transition: "all 0.1s",
          }}
        >
          <span style={{ fontSize: "11px" }}>✦</span>
          Otherside
          <span style={{
            fontSize: "8px", background: "#2a1a4a", color: "#a855f7",
            borderRadius: "3px", padding: "0 4px",
          }}>
            {OTHERSIDE_CATALOG.length}
          </span>
        </button>
        <button
          onClick={() => setLibraryTab("gcs")}
          style={{
            flex: 1, padding: "7px 4px", cursor: "pointer", fontFamily: "inherit",
            border: "none", borderBottom: libraryTab === "gcs" ? "2px solid #14b8a6" : "2px solid transparent",
            background: libraryTab === "gcs" ? "#0d1326" : "#0a0a18",
            color: libraryTab === "gcs" ? "#14b8a6" : "#6060a0",
            fontSize: "10px", fontWeight: libraryTab === "gcs" ? 700 : 400,
            display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            transition: "all 0.1s",
          }}
        >
          <span style={{ fontSize: "11px" }}>⬡</span>
          GCS Models
          <span style={{
            fontSize: "8px", background: "#0d2030", color: "#14b8a6",
            borderRadius: "3px", padding: "0 4px",
          }}>
            {ENVIRONMENT_CATALOG.length}
          </span>
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: "7px 8px", borderBottom: "1px solid #1a1a3a", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: libraryTab === "otherside" ? "#100e2a" : "#121a33",
          border: `1px solid ${libraryTab === "otherside" ? "#2a1a4a" : "#223052"}`,
          borderRadius: "5px", padding: "4px 8px",
        }}>
          <span style={{ fontSize: "11px", color: "#8a80c4" }}>⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${totalCount} models…`}
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

      {/* ── Subcategory/category filter ── */}
      {libraryTab === "otherside" ? (
        <div style={{
          display: "flex", flexDirection: "column", gap: "2px", padding: "8px 8px",
          borderBottom: "1px solid #1a1a3a", flexShrink: 0,
          maxHeight: "160px", overflowY: "auto",
        }}>
          <div style={{ fontSize: "9px", color: "#7070aa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
            Categories
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            <button
              onClick={() => setOthersideSubcat("all")}
              style={{
                padding: "5px 10px", borderRadius: "6px", cursor: "pointer",
                border: othersideSubcat === "all" ? "1px solid #a855f7" : "1px solid #2a1a4a",
                background: othersideSubcat === "all" ? "rgba(168,85,247,0.2)" : "#100e2a",
                color: othersideSubcat === "all" ? "#c084fc" : "#7070aa",
                fontSize: "11px", fontWeight: othersideSubcat === "all" ? 600 : 400,
                fontFamily: "inherit", whiteSpace: "nowrap",
                display: "inline-flex", alignItems: "center", gap: "4px",
                transition: "all 0.12s",
              }}
            >
              ⊞ All
              <span style={{
                fontSize: "9px", background: othersideSubcat === "all" ? "rgba(168,85,247,0.25)" : "#1a1a3a",
                borderRadius: "4px", padding: "1px 5px", color: "inherit",
              }}>
                {OTHERSIDE_CATALOG.length}
              </span>
            </button>
            {OTHERSIDE_SUBCATEGORIES.map((subcat) => {
              const active = othersideSubcat === subcat;
              const count = othersideCounts[subcat] ?? 0;
              return (
                <button
                  key={subcat}
                  onClick={() => setOthersideSubcat(subcat)}
                  style={{
                    padding: "5px 10px", borderRadius: "6px", cursor: "pointer",
                    border: active ? "1px solid #a855f7" : "1px solid #2a1a4a",
                    background: active ? "rgba(168,85,247,0.2)" : "#100e2a",
                    color: active ? "#c084fc" : "#7070aa",
                    fontSize: "11px", fontWeight: active ? 600 : 400,
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    transition: "all 0.12s",
                  }}
                >
                  {OTHERSIDE_ICONS[subcat] || "⬡"} {subcat.replace(/_/g, " ")}
                  <span style={{
                    fontSize: "9px",
                    background: active ? "rgba(168,85,247,0.25)" : "#1a1a3a",
                    borderRadius: "4px", padding: "1px 5px", color: "inherit",
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{
          display: "flex", flexDirection: "column", gap: "2px", padding: "8px 8px",
          borderBottom: "1px solid #223052", flexShrink: 0,
          maxHeight: "160px", overflowY: "auto",
        }}>
          <div style={{ fontSize: "9px", color: "#8aa0c4", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
            Categories
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {GCS_CATEGORIES.map((cat) => {
              const count = folderCounts[cat.id] ?? 0;
              if (count === 0 && cat.id !== "all") return null;
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: "5px 10px", borderRadius: "6px", cursor: "pointer",
                    border: active ? "1px solid #14b8a6" : "1px solid #223052",
                    background: active ? "rgba(20,184,166,0.2)" : "#0d1326",
                    color: active ? "#14b8a6" : "#8aa0c4",
                    fontSize: "11px", fontWeight: active ? 600 : 400,
                    fontFamily: "inherit", whiteSpace: "nowrap",
                    display: "inline-flex", alignItems: "center", gap: "4px",
                    transition: "all 0.12s",
                  }}
                >
                  {cat.icon} {cat.label}
                  <span style={{
                    fontSize: "9px",
                    background: active ? "rgba(20,184,166,0.25)" : "#121a33",
                    borderRadius: "4px", padding: "1px 5px", color: "inherit",
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Result count ── */}
      <div style={{ padding: "3px 9px 2px", fontSize: "9px", color: libraryTab === "otherside" ? "#7070aa" : "#8aa0c4", flexShrink: 0 }}>
        {search
          ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search}"`
          : `${filtered.length} models`}
      </div>

      {/* ── Grid ── */}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "5px" }}>
              {libraryTab === "otherside"
                ? (shown as OthersideAsset[]).map((asset) => (
                    <OthersideCard key={asset.id} asset={asset} onInsert={onInsertAsset} />
                  ))
                : shown.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} onInsert={onInsertAsset} />
                  ))
              }
            </div>
            {hasMore && (
              <div style={{ textAlign: "center", paddingTop: "8px" }}>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  style={{
                    padding: "5px 16px",
                    background: libraryTab === "otherside" ? "#100e2a" : "#0d1326",
                    border: `1px solid ${libraryTab === "otherside" ? "#2a1a4a" : "#223052"}`,
                    borderRadius: "5px", fontSize: "10px",
                    color: libraryTab === "otherside" ? "#7070aa" : "#8aa0c4",
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
