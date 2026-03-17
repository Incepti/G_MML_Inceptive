"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { useEditorStore } from "@/lib/store";
import type { MMLRenderer } from "@/lib/renderer/engine";
import { patchMmlTransform } from "@/lib/mml/transformPatch";
import type { Transform9 } from "@/lib/mml/transformPatch";

interface ThreeViewportProps {
  mmlHtml: string;
  isPlayMode?: boolean;
}

export function ThreeViewport({ mmlHtml, isPlayMode = false }: ThreeViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MMLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTransforms = useRef<Map<string, Transform9>>(new Map());
  const transformSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    rendererOptions,
    selectedObjectId,
    transformMode,
    mmlVersion,
    transformPatchVersion,
    setSelectedObjectId,
    setTransformMode,
    setViewportTransformDirty,
    updateBlueprintTransform,
  } = useEditorStore();

  // Track previous transformPatchVersion to detect transform-only updates
  const prevTransformPatchVersion = useRef(transformPatchVersion);

  // Init renderer (scene viewport only — play mode uses a read-only renderer)
  useEffect(() => {
    if (!canvasRef.current) return;

    let renderer: MMLRenderer;

    const initRenderer = async () => {
      const { MMLRenderer } = await import("@/lib/renderer/engine");
      renderer = new MMLRenderer(canvasRef.current!, rendererOptions);
      rendererRef.current = renderer;

      if (!isPlayMode) {
        renderer.setOnSelectionChange((id) => {
          setSelectedObjectId(id);
          // Auto-focus the inspector when an object is selected
          if (id) {
            const s = useEditorStore.getState();
            s.setSidebarTab("inspector");
            s.setInspectorTab("selection");
          }
        });

        // Wire up delete: remove from MML when engine deletes a 3D object
        renderer.setOnDeleteObject((id) => {
          const state = useEditorStore.getState();
          const proj = state.projects.find((p) => p.id === state.activeProjectId);
          const mmlFile = proj?.files.find((f) => f.name === "scene.mml");
          if (!proj || !mmlFile) return;

          // Remove the element from MML text by id
          const mml = mmlFile.content;
          // Match full element (open+close or self-closing) by id
          const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const fullRe = new RegExp(`\\s*<(m-\\w+)([^>]*\\bid="${escaped}"[^>]*)>[\\s\\S]*?<\\/\\1>`, "g");
          const selfRe = new RegExp(`\\s*<m-\\w+[^>]*\\bid="${escaped}"[^>]*\\/>`, "g");
          let patched = mml.replace(fullRe, "");
          patched = patched.replace(selfRe, "");
          if (patched !== mml) {
            state.updateFileContent(proj.id, mmlFile.id, patched);
            // Also remove from blueprint if tracked
            const bp = state.currentBlueprint;
            if (bp) {
              const removeFromStructures = (structures: typeof bp.scene.structures): typeof bp.scene.structures =>
                structures
                  .filter((s) => s.id !== id)
                  .map((s) => s.children?.length ? { ...s, children: removeFromStructures(s.children) } : s);
              state.setBlueprint({
                ...bp,
                scene: { ...bp.scene, structures: removeFromStructures(bp.scene.structures) },
              });
            }
          }
          state.setSelectedObjectId(null);
        });

        renderer.setOnTransformChange((id, transform) => {
          updateBlueprintTransform(id, transform);
          pendingTransforms.current.set(id, transform);

          if (transformSyncTimer.current) clearTimeout(transformSyncTimer.current);
          transformSyncTimer.current = setTimeout(() => {
            if (pendingTransforms.current.size === 0) return;
            const state = useEditorStore.getState();
            const proj = state.projects.find((p) => p.id === state.activeProjectId);
            const mmlFile = proj?.files.find((f) => f.name === "scene.mml");
            if (!proj || !mmlFile) return;

            let patched = mmlFile.content;
            for (const [elemId, t] of pendingTransforms.current) {
              patched = patchMmlTransform(patched, elemId, t);
            }
            pendingTransforms.current.clear();

            // isTransformPatch=true → increments transformPatchVersion so viewports
            // can detect this was a gizmo-only change and skip loadMML
            state.updateFileContent(proj.id, mmlFile.id, patched, true);
            // Clear dirty flag — the patch is already applied to scene.mml
            state.setViewportTransformDirty(false);
          }, 150);
        });
      }

      renderer.start();
    };

    initRenderer().catch(console.error);

    return () => {
      if (transformSyncTimer.current) clearTimeout(transformSyncTimer.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.updateOptions(rendererOptions);
  }, [rendererOptions]);

  useEffect(() => {
    if (!isPlayMode) {
      rendererRef.current?.setTransformMode(transformMode);
    }
  }, [transformMode, isPlayMode]);

  // Load MML — skip when the version bump was caused by a gizmo transform patch
  useEffect(() => {
    if (!mmlHtml.trim()) return;

    // Compare transformPatchVersion: if it changed, this mmlVersion was from a gizmo drag.
    // Three.js already has correct positions — no need to reload.
    const isTransformOnlyUpdate =
      transformPatchVersion !== prevTransformPatchVersion.current;

    prevTransformPatchVersion.current = transformPatchVersion;

    if (isTransformOnlyUpdate) return;

    if (loadDebounceRef.current) clearTimeout(loadDebounceRef.current);

    loadDebounceRef.current = setTimeout(() => {
      if (!rendererRef.current) return;
      setLoading(true);
      setError(null);
      rendererRef.current
        .loadMML(mmlHtml)
        .catch((e) => setError(String(e)))
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (loadDebounceRef.current) clearTimeout(loadDebounceRef.current);
    };
  }, [mmlHtml, mmlVersion, transformPatchVersion]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        rendererRef.current?.resize(width, height);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlayMode) rendererRef.current?.handleClick(e.nativeEvent);
  }, [isPlayMode]);

  useEffect(() => {
    if (isPlayMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key.toLowerCase()) {
        case "w": setTransformMode("translate"); break;
        case "e": setTransformMode("rotate"); break;
        case "r": setTransformMode("scale"); break;
        case "delete":
        case "backspace": {
          // Delete selected object from scene
          rendererRef.current?.deleteSelectedObject();
          break;
        }
        case "escape": {
          rendererRef.current?.deselectObject();
          setSelectedObjectId(null);
          break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setTransformMode, setSelectedObjectId, isPlayMode]);


  const modeBtn = (mode: "translate" | "rotate" | "scale", label: string, key: string) => (
    <button
      key={mode}
      onClick={() => setTransformMode(mode)}
      className={`px-2 py-1 text-xs rounded ${
        transformMode === mode
          ? "bg-blue-600 text-white"
          : "bg-editor-surface text-editor-text-muted hover:bg-editor-surface-hover"
      }`}
      title={`${label} (${key})`}
    >
      {label}
    </button>
  );

  return (
    <div ref={containerRef} className="relative w-full h-full bg-editor-bg">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ display: "block" }}
        onClick={handleCanvasClick}
      />

      {!isPlayMode && (
        <div className="absolute top-2 left-3 flex gap-1">
          {modeBtn("translate", "Move", "W")}
          {modeBtn("rotate", "Rotate", "E")}
          {modeBtn("scale", "Scale", "R")}
        </div>
      )}

      {!isPlayMode && selectedObjectId && (
        <div className="absolute bottom-12 left-3 flex items-center gap-2">
          <div className="text-xs text-blue-300 bg-black/50 px-2 py-1 rounded">
            Selected: <span className="font-mono">{selectedObjectId}</span>
          </div>
          <button
            onClick={() => rendererRef.current?.deleteSelectedObject()}
            className="text-xs bg-red-900/80 hover:bg-red-700 text-red-200 px-2 py-1 rounded transition-colors"
            title="Delete selected object (Del)"
          >
            Delete
          </button>
        </div>
      )}


      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-2 text-white text-sm">
            <span className="animate-spin text-lg">&#x27F3;</span>
            Loading scene...
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-red-900/80 text-red-200 text-xs p-3 rounded border border-red-700">
          <strong>Render Error:</strong> {error}
        </div>
      )}

      <div className="absolute top-2 right-3 text-xs text-editor-text-muted select-none pointer-events-none">
        {isPlayMode ? "Play Preview" : "3D Viewport · Three.js"}
      </div>
    </div>
  );
}
