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

export function ThreeViewport({ mmlHtml }: ThreeViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MMLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

      // Wire transform change callback
      renderer.setOnTransformChange((id, transform) => {
        updateBlueprintTransform(id, transform);
      });

      renderer.start();
    };

    initRenderer().catch(console.error);

    return () => {
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

  // Load MML when it changes
  useEffect(() => {
    if (!rendererRef.current || !mmlHtml.trim()) return;

    setLoading(true);
    setError(null);

    rendererRef.current
      .loadMML(mmlHtml)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
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
