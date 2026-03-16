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

// SSR-disabled for Three.js
const ThreeViewport = dynamic(
  () =>
    import("@/components/renderer/ThreeViewport").then(
      (m) => m.ThreeViewport
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-editor-bg flex items-center justify-center text-editor-text-muted text-sm">
        Loading viewport...
      </div>
    ),
  }
);

// ─── Titlebar ──────────────────────────────────────────────────────────────
function Titlebar() {
  const { getActiveProject, sandboxReady, setSettingsOpen } = useEditorStore();
  const project = getActiveProject();

  const handlePublish = async () => {
    if (!project) return;
    const mmlFile = project.files.find((f) => f.name === "scene.mml");
    const jsFile = project.files.find((f) => f.name === "scene.js");

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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        project.mode === "static"
          ? `${project.name}.html`
          : `${project.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="h-10 flex items-center px-4 bg-editor-sidebar border-b border-editor-border shrink-0 gap-3">
      <span className="text-editor-accent font-bold text-sm tracking-tight">
        ⬡ GEEZ MML Studio
      </span>

      <div className="ml-auto flex items-center gap-3">
        <span
          className={`flex items-center gap-1 text-[10px] ${
            sandboxReady ? "text-green-400" : "text-editor-text-muted"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              sandboxReady ? "bg-green-400" : "bg-editor-border"
            }`}
          />
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

// ─── Scene Editor Panel (top-left) ────────────────────────────────────────
function SceneEditorPanel() {
  const [leftTab, setLeftTab] = useState<"scene" | "library">("scene");

  // Reactive Zustand selector — re-renders whenever MML content changes
  const mml = useEditorStore((s) => {
    const project = s.projects.find((p) => p.id === s.activeProjectId);
    return project?.files.find((f) => f.name === "scene.mml")?.content || "";
  });

  const handleInsertAsset = useCallback((asset: EnvironmentAsset) => {
    const snippet = `<m-model id="${asset.id}" src="${asset.modelUrl}" x="0" y="0" z="0" sx="${asset.defaultScale}" sy="${asset.defaultScale}" sz="${asset.defaultScale}"></m-model>`;

    // Always read from the store directly — the render-time closure for
    // mmlFile.content can be stale after viewport gizmo moves.
    const state = useEditorStore.getState();
    const freshProject = state.projects.find((p) => p.id === state.activeProjectId);
    const freshMmlFile = freshProject?.files.find((f) => f.name === "scene.mml");

    if (!freshProject || !freshMmlFile) {
      navigator.clipboard.writeText(snippet).catch(() => {});
      return;
    }

    const base = freshMmlFile.content;
    const closeIdx = base.lastIndexOf("</m-group>");
    const newContent = closeIdx !== -1
      ? base.slice(0, closeIdx) + "  " + snippet + "\n" + base.slice(closeIdx)
      : base + "\n" + snippet;
    state.updateFileContent(freshProject.id, freshMmlFile.id, newContent);
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-editor-border">
        {(["scene", "library"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setLeftTab(tab)}
            className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${
              leftTab === tab
                ? "border-editor-accent text-editor-accent"
                : "border-transparent text-editor-text-muted hover:text-editor-text"
            }`}
          >
            {tab === "scene" ? "Scene" : "Library"}
          </button>
        ))}
      </div>

      {/* Content — ThreeViewport always mounted (never unmount = no renderer re-init) */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`w-full h-full ${leftTab === "scene" ? "block" : "hidden"}`}>
          <ThreeViewport mmlHtml={mml} />
        </div>
        {leftTab === "library" && (
          <div className="w-full h-full overflow-hidden">
            <AssetLibrary onInsertAsset={handleInsertAsset} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Play Viewer Panel (top-right) ────────────────────────────────────────
function PlayViewerPanel() {
  // Reactive selector — updates whenever MML changes
  const mml = useEditorStore((s) => {
    const project = s.projects.find((p) => p.id === s.activeProjectId);
    return project?.files.find((f) => f.name === "scene.mml")?.content || "";
  });

  // Debounce play viewport updates so it doesn't compete with the scene viewport
  const [debouncedMml, setDebouncedMml] = useState(mml);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedMml(mml), 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [mml]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center px-3 py-1 border-b border-editor-border shrink-0">
        <span className="text-[10px] text-editor-text-muted uppercase tracking-wider font-semibold">
          Play
        </span>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ThreeViewport mmlHtml={debouncedMml} isPlayMode={true} />
      </div>
    </div>
  );
}

// ─── Code Editor Panel (bottom-left) ──────────────────────────────────────
function CodeEditorPanel() {
  const { activeFileId, updateFileContent, setValidation, lastValidation, addLog } = useEditorStore();

  // Reactive selectors — re-render when file content changes (e.g. from gizmo patch)
  const file = useEditorStore((s) => {
    const project = s.projects.find((p) => p.id === s.activeProjectId);
    return project?.files.find((f) => f.id === s.activeFileId) || null;
  });
  const project = useEditorStore((s) =>
    s.projects.find((p) => p.id === s.activeProjectId) || null
  );
  const validateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (value: string) => {
      if (!project || !file) return;
      updateFileContent(project.id, file.id, value);

      // Auto-validate after 1s
      if (validateTimeoutRef.current) clearTimeout(validateTimeoutRef.current);
      validateTimeoutRef.current = setTimeout(async () => {
        const mmlFile = project.files.find((f) => f.name === "scene.mml");
        const jsFile = project.files.find((f) => f.name === "scene.js");
        const mmlContent =
          file.name === "scene.mml" ? value : mmlFile?.content;
        const jsContent = file.name === "scene.js" ? value : jsFile?.content;
        if (!mmlContent) return;

        try {
          const res = await fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mmlHtml: mmlContent, jsCode: jsContent }),
          });
          const data = await res.json();
          if (data.report) {
            setValidation(data.report);
            addLog({
              type: "validation",
              message: `Auto-validation: ${data.report.valid ? "PASS" : "FAIL"} (${data.report.errors?.length || 0} errors)`,
            });
          }
        } catch {
          // Silent fail
        }
      }, 1000);
    },
    [project, file, updateFileContent, setValidation, addLog]
  );

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-editor-bg text-editor-text-muted text-sm">
        <div className="text-center space-y-2">
          <div className="text-4xl opacity-30">⬡</div>
          <div className="text-xs">Select a project to start editing</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden relative">
      {/* File Tabs */}
      <div className="flex items-center bg-editor-sidebar border-b border-editor-border shrink-0">
        {project?.files.map((f) => (
          <button
            key={f.id}
            onClick={() => useEditorStore.getState().setActiveFile(f.id)}
            className={`px-3 py-1.5 text-xs flex items-center gap-1.5 border-r border-editor-border transition-colors ${
              f.id === activeFileId
                ? "bg-editor-bg text-editor-text"
                : "text-editor-text-muted hover:text-editor-text"
            }`}
          >
            <span className="text-[10px]">
              {f.type === "mml" ? "⬡" : f.type === "js" ? "⚡" : "⌁"}
            </span>
            {f.name}
          </button>
        ))}
        {lastValidation && file.type === "mml" && (
          <span
            className={`ml-auto mr-2 text-[10px] px-2 py-0.5 rounded ${
              lastValidation.valid
                ? "bg-green-900/40 text-green-400"
                : "bg-red-900/40 text-red-400"
            }`}
          >
            {lastValidation.valid
              ? "✓ Valid"
              : `✗ ${lastValidation.errors.length} error${lastValidation.errors.length !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {/* Monaco */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditorPanel
          key={activeFileId}
          value={file.content}
          language={file.type === "mml" ? "html" : "javascript"}
          onChange={handleChange}
          errors={lastValidation?.errors || []}
        />
      </div>

      {/* Diff Overlay */}
      <DiffViewer />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function StudioPage() {
  const [mounted, setMounted] = useState(false);
  const { panelSizes, setPanelSizes } = useEditorStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Top row: horizontal split between Scene Editor and Play Viewer
  const handleTopHorizontalResize = useCallback(
    (delta: number) => {
      const container = document.querySelector(".studio-top-row");
      if (!container) return;
      const totalWidth = container.clientWidth;
      const percentDelta = (delta / totalWidth) * 100;
      setPanelSizes({
        viewerPercent: Math.max(25, Math.min(75, panelSizes.viewerPercent + percentDelta)),
      });
    },
    [panelSizes.viewerPercent, setPanelSizes]
  );

  // Vertical split between top row and bottom row
  const handleVerticalResize = useCallback(
    (delta: number) => {
      const container = document.querySelector(".studio-main");
      if (!container) return;
      const totalHeight = container.clientHeight;
      const percentDelta = (delta / totalHeight) * 100;
      setPanelSizes({
        topRowPercent: Math.max(25, Math.min(75, panelSizes.topRowPercent + percentDelta)),
      });
    },
    [panelSizes.topRowPercent, setPanelSizes]
  );

  // Bottom row: horizontal split between Code Editor and Debug Logs
  const handleBottomHorizontalResize = useCallback(
    (delta: number) => {
      const container = document.querySelector(".studio-bottom-row");
      if (!container) return;
      const totalWidth = container.clientWidth;
      const percentDelta = (delta / totalWidth) * 100;
      setPanelSizes({
        editorPercent: Math.max(25, Math.min(75, panelSizes.editorPercent + percentDelta)),
      });
    },
    [panelSizes.editorPercent, setPanelSizes]
  );

  // Sidebar width resize
  const handleSidebarResize = useCallback(
    (delta: number) => {
      setPanelSizes({
        sidebarWidth: Math.max(250, Math.min(500, panelSizes.sidebarWidth - delta)),
      });
    },
    [panelSizes.sidebarWidth, setPanelSizes]
  );

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-editor-bg">
        <span className="text-editor-accent text-sm font-bold tracking-tight animate-pulse">
          ⬡ GEEZ MML Studio
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Titlebar />

      <div className="flex flex-1 overflow-hidden">
        {/* Main 2x2 grid */}
        <div className="flex-1 flex flex-col overflow-hidden studio-main">
          {/* Top row: Scene Editor | Play Viewer */}
          <div
            className="flex overflow-hidden studio-top-row"
            style={{ height: `${panelSizes.topRowPercent}%` }}
          >
            <div
              className="overflow-hidden border-r border-editor-border"
              style={{ width: `${panelSizes.viewerPercent}%` }}
            >
              <SceneEditorPanel />
            </div>
            <ResizeHandle direction="vertical" onResize={handleTopHorizontalResize} />
            <div className="flex-1 overflow-hidden">
              <PlayViewerPanel />
            </div>
          </div>

          <ResizeHandle direction="horizontal" onResize={handleVerticalResize} />

          {/* Bottom row: Code Editor | Debug Logs */}
          <div className="flex-1 flex overflow-hidden studio-bottom-row border-t border-editor-border">
            <div
              className="overflow-hidden border-r border-editor-border"
              style={{ width: `${panelSizes.editorPercent}%` }}
            >
              <CodeEditorPanel />
            </div>
            <ResizeHandle direction="vertical" onResize={handleBottomHorizontalResize} />
            <div className="flex-1 overflow-hidden">
              <LogsPanel />
            </div>
          </div>
        </div>

        <ResizeHandle direction="vertical" onResize={handleSidebarResize} />

        {/* Right Sidebar */}
        <div
          style={{ width: panelSizes.sidebarWidth }}
          className="shrink-0 overflow-hidden"
        >
          <RightSidebar />
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal />
    </div>
  );
}
