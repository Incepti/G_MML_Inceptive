"use client";

import React, { useEffect, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useEditorStore } from "@/lib/store";
import { LogsPanel } from "@/components/logs/LogsPanel";
import { ResizeHandle } from "@/components/layout/ResizeHandle";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { MonacoEditorPanel } from "@/components/editor/MonacoEditor";
import { DiffViewer } from "@/components/editor/DiffViewer";
import { AssetLibrary } from "@/components/explorer/AssetLibrary";
import type { EnvironmentAsset } from "@/lib/assets/environment-catalog";

const ThreeViewport = dynamic(
  () => import("@/components/renderer/ThreeViewport").then((m) => m.ThreeViewport),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-editor-bg flex items-center justify-center text-editor-text-muted text-sm">
        Loading viewport...
      </div>
    ),
  }
);

// ─── Titlebar ────────────────────────────────────────────────────────────────
function Titlebar() {
  const { getActiveProject, sandboxReady, setSettingsOpen } = useEditorStore();
  const project = getActiveProject();

  const handlePublish = async () => {
    if (!project) return;
    const mmlFile = project.files.find((f) => f.name === "scene.mml");
    const jsFile  = project.files.find((f) => f.name === "scene.js");
    const res = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        type: project.mode,
        mmlHtml: mmlFile?.content || "",
        jsModule: jsFile?.content,
        assetManifest: project.assetManifest,
      }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = project.mode === "static" ? `${project.name}.html` : `${project.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="h-10 flex items-center px-4 bg-editor-sidebar border-b border-editor-border shrink-0 gap-3">
      <span className="text-editor-accent font-bold text-sm tracking-tight">⬡ GEEZ MML Studio</span>
      <div className="ml-auto flex items-center gap-3">
        <span className={`flex items-center gap-1 text-[10px] ${sandboxReady ? "text-green-400" : "text-editor-text-muted"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sandboxReady ? "bg-green-400" : "bg-editor-border"}`} />
          {sandboxReady ? "Ready" : "Offline"}
        </span>
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-editor-text-muted hover:text-editor-text transition-colors"
          title="Settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        <button
          onClick={handlePublish}
          className="text-xs px-3 py-1 bg-editor-accent hover:bg-editor-accent-hover text-white rounded transition-colors"
        >
          Export
        </button>
      </div>
    </div>
  );
}

// ─── Library Panel ───────────────────────────────────────────────────────────
function LibraryPanel() {
  const handleInsertAsset = useCallback((asset: EnvironmentAsset) => {
    const snippet = `<m-model id="${asset.id}" src="${asset.modelUrl}" x="0" y="0" z="0" sx="${asset.defaultScale}" sy="${asset.defaultScale}" sz="${asset.defaultScale}"></m-model>`;
    const state = useEditorStore.getState();
    const proj  = state.projects.find((p) => p.id === state.activeProjectId);
    const mml   = proj?.files.find((f) => f.name === "scene.mml");
    if (!proj || !mml) { navigator.clipboard.writeText(snippet).catch(() => {}); return; }
    const base     = mml.content;
    const closeIdx = base.lastIndexOf("</m-group>");
    const next     = closeIdx !== -1
      ? base.slice(0, closeIdx) + "  " + snippet + "\n" + base.slice(closeIdx)
      : base + "\n" + snippet;
    state.updateFileContent(proj.id, mml.id, next);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <AssetLibrary onInsertAsset={handleInsertAsset} />
    </div>
  );
}

// ─── Viewport Panel ──────────────────────────────────────────────────────────
function ViewportPanel() {
  const mml = useEditorStore((s) => {
    const proj = s.projects.find((p) => p.id === s.activeProjectId);
    return proj?.files.find((f) => f.name === "scene.mml")?.content || "";
  });
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <ThreeViewport mmlHtml={mml} />
    </div>
  );
}

// ─── Code Editor Panel ───────────────────────────────────────────────────────
function CodeEditorPanel() {
  const { activeFileId, updateFileContent, setValidation, lastValidation, addLog } = useEditorStore();
  const file    = useEditorStore((s) => {
    const proj = s.projects.find((p) => p.id === s.activeProjectId);
    return proj?.files.find((f) => f.id === s.activeFileId) || null;
  });
  const project = useEditorStore((s) => s.projects.find((p) => p.id === s.activeProjectId) || null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((value: string) => {
    if (!project || !file) return;
    updateFileContent(project.id, file.id, value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const mmlFile = project.files.find((f) => f.name === "scene.mml");
      const jsFile  = project.files.find((f) => f.name === "scene.js");
      const mmlContent = file.name === "scene.mml" ? value : mmlFile?.content;
      const jsContent  = file.name === "scene.js"  ? value : jsFile?.content;
      if (!mmlContent) return;
      try {
        const res  = await fetch("/api/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mmlHtml: mmlContent, jsCode: jsContent }) });
        const data = await res.json();
        if (data.report) {
          setValidation(data.report);
          addLog({ type: "validation", message: `Auto-validation: ${data.report.valid ? "PASS" : "FAIL"} (${data.report.errors?.length || 0} errors)` });
        }
      } catch { /* silent */ }
    }, 1000);
  }, [project, file, updateFileContent, setValidation, addLog]);

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-editor-bg text-editor-text-muted text-sm">
        <div className="text-center"><div className="text-4xl opacity-30 mb-2">⬡</div><div className="text-xs">Select a project to start editing</div></div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden", position: "relative" }}>
      <div className="flex items-center bg-editor-sidebar border-b border-editor-border shrink-0">
        {project?.files.map((f) => (
          <button
            key={f.id}
            onClick={() => useEditorStore.getState().setActiveFile(f.id)}
            className={`px-3 py-1.5 text-xs flex items-center gap-1.5 border-r border-editor-border transition-colors ${f.id === activeFileId ? "bg-editor-bg text-editor-text" : "text-editor-text-muted hover:text-editor-text"}`}
          >
            <span className="text-[10px]">{f.type === "mml" ? "⬡" : f.type === "js" ? "⚡" : "⌁"}</span>
            {f.name}
          </button>
        ))}
        {lastValidation && file.type === "mml" && (
          <span className={`ml-auto mr-2 text-[10px] px-2 py-0.5 rounded ${lastValidation.valid ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"}`}>
            {lastValidation.valid ? "✓ Valid" : `✗ ${lastValidation.errors.length} error${lastValidation.errors.length !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        <MonacoEditorPanel key={activeFileId} value={file.content} language={file.type === "mml" ? "html" : "javascript"} onChange={handleChange} errors={lastValidation?.errors || []} />
      </div>
      <DiffViewer />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function StudioPage() {
  const [mounted, setMounted] = useState(false);
  const { panelSizes } = useEditorStore();

  // Refs to measure containers during resize
  const centerRef    = useRef<HTMLDivElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Library ↔ Viewport  (px) — use getState() to avoid stale closure during drag
  const handleLibraryResize = useCallback((delta: number) => {
    const { panelSizes: ps, setPanelSizes: sps } = useEditorStore.getState();
    sps({ libraryWidth: Math.max(200, Math.min(600, ps.libraryWidth + delta)) });
  }, []);

  // Top row ↔ Bottom row  (%)
  const handleVerticalResize = useCallback((delta: number) => {
    if (!centerRef.current) return;
    const height = centerRef.current.clientHeight;
    const { panelSizes: ps, setPanelSizes: sps } = useEditorStore.getState();
    sps({ topRowPercent: Math.max(15, Math.min(85, ps.topRowPercent + (delta / height) * 100)) });
  }, []);

  // Code ↔ Logs  (%)
  const handleBottomHorizontalResize = useCallback((delta: number) => {
    if (!bottomRef.current) return;
    const width = bottomRef.current.clientWidth;
    const { panelSizes: ps, setPanelSizes: sps } = useEditorStore.getState();
    sps({ editorPercent: Math.max(20, Math.min(80, ps.editorPercent + (delta / width) * 100)) });
  }, []);

  // Right sidebar  (px)
  const handleSidebarResize = useCallback((delta: number) => {
    const { panelSizes: ps, setPanelSizes: sps } = useEditorStore.getState();
    sps({ sidebarWidth: Math.max(240, Math.min(600, ps.sidebarWidth - delta)) });
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-editor-bg">
        <span className="text-editor-accent text-sm font-bold tracking-tight animate-pulse">⬡ GEEZ MML Studio</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Titlebar />

      {/* ── Workspace ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ── Library (left) ── */}
        <div style={{ width: panelSizes.libraryWidth, minWidth: panelSizes.libraryWidth, flexShrink: 0, overflow: "hidden", borderRight: "1px solid var(--editor-border, #223052)" }}>
          <LibraryPanel />
        </div>

        <ResizeHandle direction="vertical" onResize={handleLibraryResize} />

        {/* ── Centre column: Viewport + Code/Logs ── */}
        <div ref={centerRef} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>

          {/* Viewport */}
          <div style={{ flex: `0 0 ${panelSizes.topRowPercent}%`, minHeight: 0, overflow: "hidden" }}>
            <ViewportPanel />
          </div>

          <ResizeHandle direction="horizontal" onResize={handleVerticalResize} />

          {/* Code + Logs */}
          <div ref={bottomRef} style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0, borderTop: "1px solid var(--editor-border, #223052)" }}>
            <div style={{ width: `${panelSizes.editorPercent}%`, minWidth: 0, overflow: "hidden", borderRight: "1px solid var(--editor-border, #223052)" }}>
              <CodeEditorPanel />
            </div>
            <ResizeHandle direction="vertical" onResize={handleBottomHorizontalResize} />
            <div style={{ flex: 1, overflow: "hidden", minWidth: 0 }}>
              <LogsPanel />
            </div>
          </div>
        </div>

        <ResizeHandle direction="vertical" onResize={handleSidebarResize} />

        {/* ── Right Sidebar ── */}
        <div style={{ width: panelSizes.sidebarWidth, minWidth: panelSizes.sidebarWidth, flexShrink: 0, overflow: "hidden" }}>
          <RightSidebar />
        </div>
      </div>

      <SettingsModal />
    </div>
  );
}
