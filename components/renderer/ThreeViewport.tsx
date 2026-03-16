"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { useEditorStore } from "@/lib/store";
import type { MMLRenderer } from "@/lib/renderer/engine";
import { generateMml } from "@/lib/blueprint/generateMml";

interface ThreeViewportProps {
  mmlHtml: string;
}

type Transform9 = { x: number; y: number; z: number; rx: number; ry: number; rz: number; sx: number; sy: number; sz: number };

/**
 * Patch the transform attributes of a single element (by id) inside an MML string.
 * Only writes non-default values (x=0, y=0, z=0, rx=0, ry=0, rz=0, sx=1, sy=1, sz=1 are omitted).
 * Operates on the raw string so it works regardless of whether a blueprint exists.
 */
function patchMmlTransform(mml: string, id: string, t: Transform9): string {
  const idStr = `id="${id}"`;
  const pos = mml.indexOf(idStr);
  if (pos === -1) return mml;

  // Walk back to find the opening '<'
  let start = pos;
  while (start > 0 && mml[start] !== "<") start--;

  // Walk forward to find the closing '>'
  let end = pos;
  while (end < mml.length && mml[end] !== ">") end++;

  let tag = mml.slice(start, end + 1);

  // Strip all existing transform attrs
  for (const attr of ["x", "y", "z", "rx", "ry", "rz", "sx", "sy", "sz"]) {
    tag = tag.replace(new RegExp(`\\s+${attr}="[^"]*"`, "g"), "");
  }

  // Build replacement attr string (skip defaults)
  let ins = "";
  if (t.x !== 0) ins += ` x="${+t.x.toFixed(3)}"`;
  if (t.y !== 0) ins += ` y="${+t.y.toFixed(3)}"`;
  if (t.z !== 0) ins += ` z="${+t.z.toFixed(3)}"`;
  if (t.rx !== 0) ins += ` rx="${+t.rx.toFixed(1)}"`;
  if (t.ry !== 0) ins += ` ry="${+t.ry.toFixed(1)}"`;
  if (t.rz !== 0) ins += ` rz="${+t.rz.toFixed(1)}"`;
  if (Math.abs(t.sx - 1) > 0.0001) ins += ` sx="${+t.sx.toFixed(4)}"`;
  if (Math.abs(t.sy - 1) > 0.0001) ins += ` sy="${+t.sy.toFixed(4)}"`;
  if (Math.abs(t.sz - 1) > 0.0001) ins += ` sz="${+t.sz.toFixed(4)}"`;

  // Inject before closing >
  const patched = tag.slice(0, -1) + ins + ">";
  return mml.slice(0, start) + patched + mml.slice(end + 1);
}

export function ThreeViewport({ mmlHtml }: ThreeViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MMLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Accumulates gizmo transforms (fires every animation frame during drag).
  // Flushed to the MML file 150 ms after the last change.
  const pendingTransforms = useRef<Map<string, Transform9>>(new Map());
  const transformSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    rendererOptions,
    selectedObjectId,
    transformMode,
    viewportTransformDirty,
    currentBlueprint,
    setSelectedObjectId,
    setTransformMode,
    setViewportTransformDirty,
    updateBlueprintTransform,
    resyncFromBlueprint,
  } = useEditorStore();

  // Init renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    let renderer: MMLRenderer;

    const initRenderer = async () => {
      const { MMLRenderer } = await import("@/lib/renderer/engine");
      renderer = new MMLRenderer(canvasRef.current!, rendererOptions);
      rendererRef.current = renderer;

      // Wire selection callback
      renderer.setOnSelectionChange((id) => {
        setSelectedObjectId(id);
      });

      // Wire transform change callback.
      // updateBlueprintTransform only works when an AI-generated blueprint exists.
      // We ALSO patch the raw MML string directly so library-inserted models
      // (which have no blueprint) keep their positions after being moved.
      renderer.setOnTransformChange((id, transform) => {
        updateBlueprintTransform(id, transform);

        // Accumulate — the gizmo fires on every animation frame while dragging
        pendingTransforms.current.set(id, transform);

        // Debounce: write positions to MML file 150ms after drag stops
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
          state.updateFileContent(proj.id, mmlFile.id, patched);
        }, 150);
      });

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

  // Update renderer options
  useEffect(() => {
    rendererRef.current?.updateOptions(rendererOptions);
  }, [rendererOptions]);

  // Sync transform mode to renderer
  useEffect(() => {
    rendererRef.current?.setTransformMode(transformMode);
  }, [transformMode]);

  // Load MML when it changes — debounced so rapid keystrokes don't trigger
  // a full scene rebuild on every character typed in the code editor.
  useEffect(() => {
    if (!mmlHtml.trim()) return;

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
  }, [mmlHtml]);

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

  // Click handler for object picking
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    rendererRef.current?.handleClick(e.nativeEvent);
  }, []);

  // Keyboard shortcuts for transform modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if canvas is focused or no input is focused
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "w": setTransformMode("translate"); break;
        case "e": setTransformMode("rotate"); break;
        case "r": setTransformMode("scale"); break;
        case "escape": {
          rendererRef.current?.deselectObject();
          setSelectedObjectId(null);
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setTransformMode, setSelectedObjectId]);

  // "Update MML" — regenerate from modified blueprint
  const handleUpdateMml = useCallback(() => {
    if (!currentBlueprint) return;
    const newMml = generateMml(currentBlueprint);
    resyncFromBlueprint(newMml);
    setViewportTransformDirty(false);
  }, [currentBlueprint, resyncFromBlueprint, setViewportTransformDirty]);

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

      {/* Transform mode toolbar */}
      <div className="absolute top-2 left-3 flex gap-1">
        {modeBtn("translate", "Move", "W")}
        {modeBtn("rotate", "Rotate", "E")}
        {modeBtn("scale", "Scale", "R")}
      </div>

      {/* Selected object indicator */}
      {selectedObjectId && (
        <div className="absolute bottom-12 left-3 text-xs text-blue-300 bg-black/50 px-2 py-1 rounded">
          Selected: <span className="font-mono">{selectedObjectId}</span>
        </div>
      )}

      {/* Update MML button (when transforms are dirty) */}
      {viewportTransformDirty && (
        <button
          onClick={handleUpdateMml}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded shadow-lg"
        >
          Update MML
        </button>
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

      {/* Viewport label */}
      <div className="absolute top-2 right-3 text-xs text-editor-text-muted select-none pointer-events-none">
        3D Viewport · Three.js
      </div>
    </div>
  );
}
