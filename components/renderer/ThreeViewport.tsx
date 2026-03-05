"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { useEditorStore } from "@/lib/store";
import type { MMLRenderer } from "@/lib/renderer/engine";

interface ThreeViewportProps {
  mmlHtml: string;
}

export function ThreeViewport({ mmlHtml }: ThreeViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<MMLRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { rendererOptions } = useEditorStore();

  // Init renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    let renderer: MMLRenderer;

    const initRenderer = async () => {
      const { MMLRenderer } = await import("@/lib/renderer/engine");
      renderer = new MMLRenderer(canvasRef.current!, rendererOptions);
      rendererRef.current = renderer;
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

  return (
    <div ref={containerRef} className="relative w-full h-full bg-editor-bg">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ display: "block" }}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="flex items-center gap-2 text-white text-sm">
            <span className="animate-spin text-lg">⟳</span>
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
