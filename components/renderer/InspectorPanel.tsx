"use client";

import React from "react";
import * as THREE from "three";
import { useEditorStore } from "@/lib/store";
import type { ValidationReport } from "@/types/mml";

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

export function InspectorPanel() {
  const {
    inspectorTab,
    setInspectorTab,
    lastValidation,
    getActiveProject,
    complianceScore,
    overallStatus,
  } = useEditorStore();
  const project = getActiveProject();

  const tabs = [
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
