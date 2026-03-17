"use client";

import React, { useState, useCallback } from "react";
import * as THREE from "three";
import { useEditorStore } from "@/lib/store";
import type { ValidationReport } from "@/types/mml";
import type { BlueprintJSON } from "@/types/blueprint";
import {
  patchMmlTransform,
  getMmlElementTransform,
  getMmlElementSrc,
  getMmlElementTag,
  type Transform9,
} from "@/lib/mml/transformPatch";

function ValidationResults({ report }: { report: ValidationReport }) {
  if (report.valid && report.errors.length === 0 && report.warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-900/30 rounded border border-green-700 text-green-300 text-sm">
        <span>✓</span>
        <span>Valid MML Alpha</span>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs">
      {report.errors.map((e, i) => (
        <div
          key={i}
          className="flex gap-2 p-2 bg-red-900/30 rounded border border-red-800/50 text-red-300"
        >
          <span className="shrink-0">✗</span>
          <span>
            {e.line ? `[L${e.line}] ` : ""}
            {e.tag ? `<${e.tag}> ` : ""}
            {e.message}
          </span>
        </div>
      ))}
      {report.warnings.map((w, i) => (
        <div
          key={i}
          className="flex gap-2 p-2 bg-yellow-900/30 rounded border border-yellow-800/50 text-yellow-300"
        >
          <span className="shrink-0">⚠</span>
          <span>
            {w.tag ? `<${w.tag}> ` : ""}
            {w.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function SceneStats({ report }: { report: ValidationReport }) {
  const { stats } = report;
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {[
        ["Models", stats.modelCount, 60],
        ["Lights", stats.lightCount, 6],
        ["Physics", stats.physicsCount, 100],
        ["Particles", stats.particleCount, 400],
        ["Intervals", stats.intervalCount, 10],
      ].map(([label, count, max]) => (
        <div key={label as string} className="bg-editor-panel rounded p-2 border border-editor-border">
          <div className="text-editor-text-muted">{label as string}</div>
          <div className={`font-mono font-bold ${Number(count) > Number(max) * 0.8 ? "text-yellow-400" : "text-editor-text"}`}>
            {count as number}
            <span className="text-editor-text-muted font-normal">/{max as number}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const TONE_MAPPING_OPTIONS: Array<{ label: string; value: THREE.ToneMapping }> = [
  { label: "None", value: THREE.NoToneMapping },
  { label: "Linear", value: THREE.LinearToneMapping },
  { label: "Reinhard", value: THREE.ReinhardToneMapping },
  { label: "Cineon", value: THREE.CineonToneMapping },
  { label: "ACES Filmic", value: THREE.ACESFilmicToneMapping },
];

function RendererControls() {
  const { rendererOptions, updateRendererOptions, strictMode, setStrictMode } =
    useEditorStore();

  return (
    <div className="space-y-3 text-xs">
      <div className="text-editor-text-muted uppercase tracking-wider text-[10px] font-semibold">
        Editor Enhancements
      </div>
      <div className="text-[10px] text-yellow-500 bg-yellow-900/20 p-2 rounded">
        These affect preview only — not exported MML
      </div>

      {[
        ["Shadows", "shadowsEnabled"] as const,
        ["SSAO", "ssaoEnabled"] as const,
        ["Bloom", "bloomEnabled"] as const,
        ["HDRI Environment", "hdriEnabled"] as const,
        ["Strict MML Mode", "strictMMLMode"] as const,
      ].map(([label, key]) => (
        <label key={key} className="flex items-center justify-between cursor-pointer">
          <span className="text-editor-text">{label}</span>
          <button
            onClick={() =>
              updateRendererOptions({ [key]: !rendererOptions[key] })
            }
            className={`relative w-9 h-5 rounded-full transition-colors ${
              rendererOptions[key] ? "bg-editor-accent" : "bg-editor-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                rendererOptions[key] ? "left-4" : "left-0.5"
              }`}
            />
          </button>
        </label>
      ))}

      <label className="flex items-center justify-between cursor-pointer">
        <span className="text-editor-text">Strict Enforcement</span>
        <button
          onClick={() => setStrictMode(!strictMode)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            strictMode ? "bg-editor-accent" : "bg-editor-border"
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
              strictMode ? "left-4" : "left-0.5"
            }`}
          />
        </button>
      </label>

      <div>
        <label className="text-editor-text-muted mb-1 block">Tone Mapping</label>
        <select
          value={rendererOptions.toneMapping}
          onChange={(e) =>
            updateRendererOptions({
              toneMapping: parseInt(e.target.value) as THREE.ToneMapping,
            })
          }
          className="w-full bg-editor-panel border border-editor-border text-editor-text rounded px-2 py-1 text-xs"
        >
          {TONE_MAPPING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-editor-text-muted mb-1 flex justify-between">
          <span>Exposure</span>
          <span>{rendererOptions.toneMappingExposure.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="4"
          step="0.01"
          value={rendererOptions.toneMappingExposure}
          onChange={(e) =>
            updateRendererOptions({
              toneMappingExposure: parseFloat(e.target.value),
            })
          }
          className="w-full accent-editor-accent"
        />
      </div>
    </div>
  );
}

function CompliancePanel({
  score,
  status,
}: {
  score: ReturnType<typeof useEditorStore.getState>["complianceScore"];
  status: ReturnType<typeof useEditorStore.getState>["overallStatus"];
}) {
  if (!score) {
    return (
      <div className="text-editor-text-muted text-xs text-center py-8">
        No compliance score yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] text-editor-text-muted uppercase tracking-wider font-semibold">
        Compliance
      </div>
      <div
        className={`text-xs px-2 py-1 rounded border ${
          status === "ACCEPTED"
            ? "bg-green-900/30 border-green-800/50 text-green-300"
            : "bg-red-900/30 border-red-800/50 text-red-300"
        }`}
      >
        Overall: {status || "UNKNOWN"}
      </div>
      {(
        Object.entries(score) as Array<[keyof typeof score, "Pass" | "Fail"]>
      ).map(([k, v]) => (
        <div
          key={k}
          className="flex items-center justify-between text-xs bg-editor-panel rounded p-2 border border-editor-border"
        >
          <span className="text-editor-text-muted">{k}</span>
          <span className={v === "Pass" ? "text-green-400" : "text-red-400"}>
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}

function findStructure(
  structures: BlueprintJSON["scene"]["structures"],
  id: string,
): BlueprintJSON["scene"]["structures"][number] | null {
  for (const s of structures) {
    if (s.id === id) return s;
    if (s.children?.length) {
      const found = findStructure(s.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ── Axis colours matching UE5 convention ──────────────────────────────────────
const AXIS_COLOR = { X: "#f25b5b", Y: "#6abf6a", Z: "#5b8ef2" } as const;

function AxisLabel({ axis }: { axis: "X" | "Y" | "Z" }) {
  return (
    <span style={{
      color: AXIS_COLOR[axis],
      fontSize: "10px", fontWeight: 700,
      width: "13px", textAlign: "center", flexShrink: 0,
      letterSpacing: "-0.5px",
    }}>
      {axis}
    </span>
  );
}

function TransformField({
  axis,
  value,
  step = 0.1,
  onChange,
}: {
  axis: "X" | "Y" | "Z";
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const [localVal, setLocalVal] = React.useState(String(+value.toFixed(4)));

  // Sync when external value changes (e.g. from gizmo)
  React.useEffect(() => {
    setLocalVal(String(+value.toFixed(4)));
  }, [value]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <AxisLabel axis={axis} />
      <div style={{
        flex: 1,
        background: "#0d1122",
        border: "1px solid #1e2d50",
        borderRadius: "4px",
        display: "flex", alignItems: "center",
      }}>
        <input
          type="number"
          step={step}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) { onChange(v); setLocalVal(String(+v.toFixed(4))); }
            else setLocalVal(String(+value.toFixed(4)));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontSize: "11px", color: "#e6f1ff", fontFamily: "monospace",
            padding: "2px 6px", minWidth: 0,
          }}
        />
      </div>
    </div>
  );
}

function TransformSection({
  label,
  values,
  steps,
  onChange,
  lockToggle,
}: {
  label: string;
  values: [number, number, number];
  steps?: [number, number, number];
  onChange: (axis: "x" | "y" | "z", v: number) => void;
  lockToggle?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "4px",
      }}>
        <span style={{ fontSize: "9px", color: "#8aa0c4", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
          {label}
        </span>
        {lockToggle}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <TransformField axis="X" value={values[0]} step={steps?.[0]} onChange={(v) => onChange("x", v)} />
        <TransformField axis="Y" value={values[1]} step={steps?.[1]} onChange={(v) => onChange("y", v)} />
        <TransformField axis="Z" value={values[2]} step={steps?.[2]} onChange={(v) => onChange("z", v)} />
      </div>
    </div>
  );
}

function SelectionProperties() {
  const [uniformScale, setUniformScale] = useState(true);

  const {
    selectedObjectId,
    currentBlueprint,
    updateBlueprintTransform,
  } = useEditorStore();

  // ── Determine if object is blueprint-tracked or library-inserted ───────────
  const structure = selectedObjectId && currentBlueprint
    ? findStructure(currentBlueprint.scene.structures, selectedObjectId)
    : null;

  // Read current MML for either fallback or library objects
  const currentMml = useEditorStore((s) => {
    const proj = s.projects.find((p) => p.id === s.activeProjectId);
    return proj?.files.find((f) => f.name === "scene.mml")?.content ?? "";
  });

  const mmlTransform = selectedObjectId
    ? getMmlElementTransform(currentMml, selectedObjectId)
    : null;
  const mmlSrc = selectedObjectId ? getMmlElementSrc(currentMml, selectedObjectId) : "";
  const mmlTag = selectedObjectId ? getMmlElementTag(currentMml, selectedObjectId) : "";

  if (!selectedObjectId) {
    return (
      <div style={{ padding: "32px 12px", textAlign: "center", color: "#8aa0c4", fontSize: "11px" }}>
        <div style={{ fontSize: "22px", marginBottom: "8px", opacity: 0.4 }}>⊹</div>
        Click an object in the viewport to select it
      </div>
    );
  }

  if (!mmlTransform) {
    return (
      <div style={{ padding: "20px 12px", textAlign: "center", color: "#8aa0c4", fontSize: "11px" }}>
        <div style={{ color: "#f87171", marginBottom: "4px" }}>⚠</div>
        Object &quot;{selectedObjectId}&quot; not found in scene
      </div>
    );
  }

  // Use blueprint transform if available (more accurate, includes current in-memory state)
  const t: Transform9 = structure?.transform ?? mmlTransform;

  // ── Write transform back to both blueprint (if applicable) and MML ─────────
  const applyTransform = useCallback((newT: Transform9) => {
    // 1. Update in-memory blueprint (for blueprint objects)
    if (structure) {
      updateBlueprintTransform(selectedObjectId, newT);
    }
    // 2. Patch scene.mml directly (works for all objects)
    const state = useEditorStore.getState();
    const proj = state.projects.find((p) => p.id === state.activeProjectId);
    const mmlFile = proj?.files.find((f) => f.name === "scene.mml");
    if (proj && mmlFile) {
      const patched = patchMmlTransform(mmlFile.content, selectedObjectId, newT);
      state.updateFileContent(proj.id, mmlFile.id, patched, true);
    }
  }, [selectedObjectId, structure, updateBlueprintTransform]);

  const handlePosition = useCallback((axis: "x" | "y" | "z", v: number) => {
    applyTransform({ ...t, [axis]: v });
  }, [t, applyTransform]);

  const handleRotation = useCallback((axis: "x" | "y" | "z", v: number) => {
    const map: Record<string, string> = { x: "rx", y: "ry", z: "rz" };
    applyTransform({ ...t, [map[axis]]: v });
  }, [t, applyTransform]);

  const handleScale = useCallback((axis: "x" | "y" | "z", v: number) => {
    if (uniformScale) {
      // Uniform: change all axes proportionally from the changed axis
      const refAxis = axis === "x" ? t.sx : axis === "y" ? t.sy : t.sz;
      const ratio = refAxis !== 0 ? v / refAxis : 1;
      applyTransform({ ...t, sx: t.sx * ratio, sy: t.sy * ratio, sz: t.sz * ratio });
    } else {
      const map: Record<string, string> = { x: "sx", y: "sy", z: "sz" };
      applyTransform({ ...t, [map[axis]]: v });
    }
  }, [t, applyTransform, uniformScale]);

  const displaySrc = mmlSrc
    ? mmlSrc.split("/").pop() ?? mmlSrc
    : structure?.geometry
    ? `${structure.geometry.kind} (primitive)`
    : "—";

  return (
    <div style={{ padding: "8px", fontSize: "12px" }}>
      {/* Header */}
      <div style={{
        background: "#0d1326",
        border: "1px solid #1e2d50",
        borderRadius: "6px",
        padding: "8px 10px",
        marginBottom: "10px",
      }}>
        <div style={{ fontWeight: 600, color: "#e6f1ff", fontSize: "12px", marginBottom: "2px" }}>
          {selectedObjectId}
        </div>
        <div style={{ color: "#8aa0c4", fontSize: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <span style={{
            background: "#152040", color: "#60a5fa",
            padding: "1px 6px", borderRadius: "3px", fontSize: "9px",
          }}>
            {mmlTag || structure?.type || "element"}
          </span>
          {!structure && (
            <span style={{
              background: "#2a1a4a", color: "#c084fc",
              padding: "1px 6px", borderRadius: "3px", fontSize: "9px",
            }}>
              library
            </span>
          )}
        </div>
        {displaySrc !== "—" && (
          <div style={{
            color: "#6070a0", fontSize: "9px", marginTop: "4px",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }} title={mmlSrc}>
            {displaySrc}
          </div>
        )}
      </div>

      {/* Position */}
      <TransformSection
        label="Location"
        values={[t.x, t.y, t.z]}
        steps={[0.1, 0.1, 0.1]}
        onChange={handlePosition}
      />

      {/* Rotation */}
      <TransformSection
        label="Rotation"
        values={[t.rx, t.ry, t.rz]}
        steps={[1, 1, 1]}
        onChange={handleRotation}
      />

      {/* Scale with uniform lock */}
      <TransformSection
        label="Scale"
        values={[t.sx, t.sy, t.sz]}
        steps={[0.01, 0.01, 0.01]}
        onChange={handleScale}
        lockToggle={
          <button
            onClick={() => setUniformScale((v) => !v)}
            title={uniformScale ? "Uniform scale (click to unlock)" : "Non-uniform scale (click to lock)"}
            style={{
              background: uniformScale ? "rgba(96,165,250,0.15)" : "transparent",
              border: `1px solid ${uniformScale ? "#3b82f6" : "#1e2d50"}`,
              borderRadius: "3px",
              padding: "1px 5px",
              cursor: "pointer",
              color: uniformScale ? "#60a5fa" : "#8aa0c4",
              fontSize: "9px",
              display: "flex", alignItems: "center", gap: "3px",
            }}
          >
            {uniformScale ? "🔒 Lock" : "🔓 Free"}
          </button>
        }
      />

      {/* Material (blueprint objects only) */}
      {structure?.material && (
        <div style={{ marginTop: "8px" }}>
          <div style={{ fontSize: "9px", color: "#8aa0c4", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "6px" }}>
            Material
          </div>
          <div style={{
            background: "#0d1326", border: "1px solid #1e2d50",
            borderRadius: "4px", padding: "8px",
          }}>
            {structure.material.color && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span style={{ color: "#8aa0c4", fontSize: "10px", width: "44px" }}>Color</span>
                <div style={{
                  width: "14px", height: "14px", borderRadius: "3px",
                  background: structure.material.color,
                  border: "1px solid rgba(255,255,255,0.1)",
                  flexShrink: 0,
                }} />
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#e6f1ff" }}>
                  {structure.material.color}
                </span>
              </div>
            )}
            {structure.material.opacity !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#8aa0c4", fontSize: "10px", width: "44px" }}>Opacity</span>
                <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#e6f1ff" }}>
                  {structure.material.opacity}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function InspectorPanel() {
  const {
    inspectorTab,
    setInspectorTab,
    lastValidation,
    getActiveProject,
    complianceScore,
    overallStatus,
    selectedObjectId,
  } = useEditorStore();
  const project = getActiveProject();

  const tabs = [
    { id: "selection" as const, label: "Selection" },
    { id: "validation" as const, label: "Validation" },
    { id: "properties" as const, label: "Renderer" },
    { id: "manifest" as const, label: "Assets" },
  ];

  return (
    <div className="flex flex-col h-full bg-editor-sidebar border-l border-editor-border">
      {/* Tab Bar */}
      <div className="flex border-b border-editor-border shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setInspectorTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              inspectorTab === tab.id
                ? "text-editor-accent border-b-2 border-editor-accent"
                : "text-editor-text-muted hover:text-editor-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {inspectorTab === "validation" && (
          <>
            {lastValidation ? (
              <>
                <SceneStats report={lastValidation} />
                <ValidationResults report={lastValidation} />
                <CompliancePanel score={complianceScore} status={overallStatus} />
              </>
            ) : (
              <div className="text-editor-text-muted text-xs text-center py-8">
                Edit MML to see validation results
              </div>
            )}
          </>
        )}

        {inspectorTab === "selection" && <SelectionProperties />}

        {inspectorTab === "properties" && <RendererControls />}

        {inspectorTab === "manifest" && (
          <div className="space-y-2">
            <div className="text-editor-text-muted text-[10px] uppercase tracking-wider font-semibold">
              Asset Manifest
            </div>
            {project?.assetManifest.length === 0 ? (
              <div className="text-editor-text-muted text-xs text-center py-8">
                No assets in this project
              </div>
            ) : (
              project?.assetManifest.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-editor-panel rounded p-2 border border-editor-border text-xs"
                >
                  <div className="text-editor-text font-medium truncate">
                    {asset.name}
                  </div>
                  <div className="text-editor-text-muted truncate text-[10px]">
                    {asset.url}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        asset.validated
                          ? "bg-green-900/40 text-green-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {asset.validated ? "✓ validated" : "✗ unvalidated"}
                    </span>
                    <span className="text-editor-text-muted">
                      {(asset.sizeBytes / 1024).toFixed(1)}KB
                    </span>
                    <span className="text-editor-text-muted">{asset.source}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
