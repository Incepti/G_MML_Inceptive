"use client";

import React from "react";
import { useEditorStore } from "@/lib/store";
import * as THREE from "three";

export function SettingsModal() {
  const {
    settingsOpen,
    setSettingsOpen,
    rendererOptions,
    updateRendererOptions,
    strictMode,
    setStrictMode,
  } = useEditorStore();

  if (!settingsOpen) return null;

  const toggles = [
    { key: "shadowsEnabled" as const, label: "Shadows" },
    { key: "ssaoEnabled" as const, label: "SSAO" },
    { key: "bloomEnabled" as const, label: "Bloom" },
    { key: "hdriEnabled" as const, label: "HDRI Environment" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setSettingsOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-editor-panel border border-editor-border rounded-xl shadow-2xl w-96 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-editor-border">
          <span className="text-sm font-semibold text-editor-text">
            Settings
          </span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-editor-text-muted hover:text-editor-text text-sm"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Renderer section */}
          <div>
            <h3 className="text-xs font-semibold text-editor-text-muted uppercase tracking-wider mb-3">
              Renderer (Preview Only)
            </h3>
            <div className="space-y-3">
              {toggles.map((t) => (
                <div
                  key={t.key}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-editor-text">{t.label}</span>
                  <button
                    onClick={() =>
                      updateRendererOptions({
                        [t.key]: !rendererOptions[t.key],
                      })
                    }
                    className={`w-9 h-5 rounded-full transition-colors relative ${
                      rendererOptions[t.key]
                        ? "bg-editor-accent"
                        : "bg-editor-border"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        rendererOptions[t.key]
                          ? "translate-x-4"
                          : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              ))}

              {/* Strict mode */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-editor-text">
                  Strict MML Mode
                </span>
                <button
                  onClick={() => setStrictMode(!strictMode)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    strictMode ? "bg-editor-accent" : "bg-editor-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      strictMode ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Tone mapping */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-editor-text">Tone Mapping</span>
                <select
                  value={rendererOptions.toneMapping}
                  onChange={(e) =>
                    updateRendererOptions({
                      toneMapping: parseInt(e.target.value) as THREE.ToneMapping,
                    })
                  }
                  className="bg-editor-bg border border-editor-border rounded px-2 py-1 text-xs text-editor-text"
                >
                  <option value={THREE.NoToneMapping}>None</option>
                  <option value={THREE.LinearToneMapping}>Linear</option>
                  <option value={THREE.ReinhardToneMapping}>Reinhard</option>
                  <option value={THREE.CineonToneMapping}>Cineon</option>
                  <option value={THREE.ACESFilmicToneMapping}>
                    ACES Filmic
                  </option>
                </select>
              </div>

              {/* Exposure */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-editor-text">
                  Exposure ({rendererOptions.toneMappingExposure.toFixed(2)})
                </span>
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
                  className="w-24"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
