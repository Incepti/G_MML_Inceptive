"use client";

import React, { useState, useCallback } from "react";
import { useEditorStore } from "@/lib/store";
import type { GenerateResult } from "@/lib/llm/service";

export function PromptInput() {
  const {
    promptText,
    setPromptText,
    isGenerating,
    setGenerating,
    setGenerationError,
    generationError,
    getActiveProject,
    activeProjectId,
    updateFileContent,
    setValidation,
    addAssetToProject,
    setCompliance,
    strictMode,
  } = useEditorStore();

  const [mode, setMode] = useState<"static" | "dynamic">("static");

  const handleGenerate = useCallback(async () => {
    if (!promptText.trim()) return;
    if (!activeProjectId) return;

    const project = getActiveProject();
    if (!project) return;

    setGenerating(true);
    setGenerationError(null);

    try {
      const mmlFile = project.files.find((f) => f.name === "scene.mml");
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          mode,
          assetManifest: project.assetManifest,
          existingMML: mmlFile?.content,
          projectContext: `Project: ${project.name}, Mode: ${project.mode}`,
          strictMode,
        }),
      });

      const data = (await res.json()) as GenerateResult & {
        error?: string;
        details?: unknown;
      };

      if (!res.ok) {
        const detail =
          data.details ? ` | ${JSON.stringify(data.details)}` : "";
        setGenerationError((data.error || "Generation failed") + detail);
        return;
      }

      // Update MML file
      if (mmlFile && data.mmlHtml) {
        updateFileContent(activeProjectId, mmlFile.id, data.mmlHtml);
      }

      // Update JS file if dynamic
      if (data.jsModule && mode === "dynamic") {
        const jsFile = project.files.find((f) => f.name === "scene.js");
        if (jsFile) {
          updateFileContent(activeProjectId, jsFile.id, data.jsModule);
        }
      }

      // Update validation
      if (data.validationReport) {
        setValidation(data.validationReport);
      }
      if ("compliance" in data || "overallStatus" in data) {
        setCompliance(
          (data as GenerateResult & { compliance?: GenerateResult["compliance"] })
            .compliance || null,
          (data as GenerateResult & { overallStatus?: GenerateResult["overallStatus"] })
            .overallStatus || null
        );
      }

      // Add generated assets to manifest
      if (data.assetManifest) {
        for (const asset of data.assetManifest) {
          addAssetToProject(activeProjectId, asset);
        }
      }
    } catch (e) {
      setGenerationError(String(e));
    } finally {
      setGenerating(false);
    }
  }, [
    promptText,
    mode,
    activeProjectId,
    getActiveProject,
    setGenerating,
    setGenerationError,
    updateFileContent,
    setValidation,
    setCompliance,
    addAssetToProject,
  ]);

  const handleValidate = useCallback(async () => {
    const project = getActiveProject();
    if (!project) return;

    const mmlFile = project.files.find((f) => f.name === "scene.mml");
    const jsFile = project.files.find((f) => f.name === "scene.js");
    if (!mmlFile) return;

    try {
      const res = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mmlHtml: mmlFile.content,
          jsCode: jsFile?.content,
        }),
      });
      const data = await res.json();
      if (data.report) setValidation(data.report);
    } catch (e) {
      console.error("Validation error:", e);
    }
  }, [getActiveProject, setValidation]);

  return (
    <div className="flex flex-col border-t border-editor-border bg-editor-sidebar">
      {/* Error Display */}
      {generationError && (
        <div className="px-3 py-2 bg-red-900/30 border-b border-red-800/50 text-red-300 text-xs">
          {generationError}
        </div>
      )}

      {/* Mode Selector + Actions */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <div className="flex gap-1 bg-editor-bg rounded p-0.5">
          {(["static", "dynamic"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${mode === m
                  ? "bg-editor-accent text-white"
                  : "text-editor-text-muted hover:text-editor-text"
                }`}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          onClick={handleValidate}
          disabled={!activeProjectId}
          className="ml-auto text-xs px-3 py-1 rounded border border-editor-border text-editor-text-muted hover:text-editor-text hover:border-editor-text/30 transition-colors disabled:opacity-40"
        >
          Validate
        </button>
      </div>

      {/* Prompt Area */}
      <div className="flex gap-2 p-3 pt-1">
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleGenerate();
            }
          }}
          placeholder="Describe your MML scene... (Ctrl+Enter to generate)"
          rows={2}
          className="flex-1 bg-editor-bg border border-editor-border rounded px-3 py-2 text-sm text-editor-text placeholder:text-editor-text-muted resize-none focus:outline-none focus:border-editor-accent"
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !promptText.trim() || !activeProjectId}
          className="px-4 py-2 bg-editor-accent hover:bg-editor-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
        >
          {isGenerating ? (
            <span className="flex items-center gap-1">
              <span className="animate-spin">⟳</span>
              Generating...
            </span>
          ) : (
            "Generate ⚡"
          )}
        </button>
      </div>
    </div>
  );
}
