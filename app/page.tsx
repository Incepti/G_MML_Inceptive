"use client";

import React, { useEffect, useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useEditorStore } from "@/lib/store";
import { ProjectExplorer } from "@/components/explorer/ProjectExplorer";
import { AssetBrowser } from "@/components/explorer/AssetBrowser";
import { InspectorPanel } from "@/components/renderer/InspectorPanel";
import { PromptInput } from "@/components/prompt/PromptInput";
import { MonacoEditorPanel } from "@/components/editor/MonacoEditor";

// SSR-disabled for Three.js
const ThreeViewport = dynamic(
  () =>
    import("@/components/renderer/ThreeViewport").then(
      (m) => m.ThreeViewport
    ),
  { ssr: false, loading: () => <div className="w-full h-full bg-editor-bg flex items-center justify-center text-editor-text-muted text-sm">Loading viewport...</div> }
);

function Titlebar() {
  const { getActiveProject, sandboxReady } = useEditorStore();
  const project = getActiveProject();

  return (
    <div className="h-10 flex items-center px-4 bg-editor-sidebar border-b border-editor-border shrink-0 gap-3">
      <span className="text-editor-accent font-bold text-sm tracking-tight">
        ⬡ GEEZ MML Studio
      </span>
      {project && (
        <>
          <span className="text-editor-border">│</span>
          <span className="text-editor-text text-sm truncate">{project.name}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              project.mode === "dynamic"
                ? "bg-purple-900/40 text-purple-300"
                : "bg-blue-900/40 text-blue-300"
            }`}
          >
            {project.mode}
          </span>
        </>
      )}
      <div className="ml-auto flex items-center gap-3">
        <span
          className={`flex items-center gap-1 text-[10px] ${
            sandboxReady ? "text-green-400" : "text-editor-text-muted"
          }`}
          title={sandboxReady ? "Sandbox ready" : "Sandbox unavailable"}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              sandboxReady ? "bg-green-400" : "bg-editor-border"
            }`}
          />
          {sandboxReady ? "Ready" : "Offline"}
        </span>

        <PublishButton />
      </div>
    </div>
  );
}

function PublishButton() {
  const { getActiveProject } = useEditorStore();

  const handlePublish = async () => {
    const project = getActiveProject();
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
    <button
      onClick={handlePublish}
      className="text-xs px-3 py-1 bg-editor-accent hover:bg-editor-accent-hover text-white rounded transition-colors"
    >
      Export ↓
    </button>
  );
}

function Sidebar() {
  const { sidebarTab, setSidebarTab } = useEditorStore();

  return (
    <div className="w-56 flex flex-col bg-editor-sidebar border-r border-editor-border">
      {/* Tab Switcher */}
      <div className="flex border-b border-editor-border shrink-0">
        {(["explorer", "assets"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSidebarTab(tab)}
            className={`flex-1 py-2 text-xs transition-colors capitalize ${
              sidebarTab === tab
                ? "text-editor-accent border-b-2 border-editor-accent"
                : "text-editor-text-muted hover:text-editor-text"
            }`}
          >
            {tab === "explorer" ? "Projects" : "Assets"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {sidebarTab === "explorer" ? (
          <ProjectExplorer />
        ) : (
          <AssetBrowser />
        )}
      </div>
    </div>
  );
}

function EditorPanel() {
  const {
    getActiveFile,
    getActiveProject,
    activeFileId,
    updateFileContent,
    setValidation,
    lastValidation,
    generationError,
    complianceScore,
    overallStatus,
  } = useEditorStore();

  const file = getActiveFile();
  const project = getActiveProject();
  const validateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(
    (value: string) => {
      if (!project || !file) return;
      updateFileContent(project.id, file.id, value);

      // Auto-validate after 1s of inactivity
      if (validateTimeoutRef.current)
        clearTimeout(validateTimeoutRef.current);
      validateTimeoutRef.current = setTimeout(async () => {
        const mmlFile = project.files.find((f) => f.name === "scene.mml");
        const jsFile = project.files.find((f) => f.name === "scene.js");
        const mmlContent = file.name === "scene.mml" ? value : mmlFile?.content;
        const jsContent = file.name === "scene.js" ? value : jsFile?.content;
        if (!mmlContent) return;

        try {
          const res = await fetch("/api/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mmlHtml: mmlContent, jsCode: jsContent }),
          });
          const data = await res.json();
          if (data.report) setValidation(data.report);
        } catch {
          // Silent fail
        }
      }, 1000);
    },
    [project, file, updateFileContent, setValidation]
  );

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-editor-bg text-editor-text-muted text-sm">
        <div className="text-center space-y-2">
          <div className="text-4xl">⬡</div>
          <div>Select a project to start editing</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* File Tab */}
      <div className="flex items-center px-3 py-1.5 bg-editor-sidebar border-b border-editor-border shrink-0 gap-2">
        <span className="text-xs text-editor-text-muted">
          {file.type === "mml" ? "⬡" : file.type === "js" ? "⚡" : "⌁"}
        </span>
        <span className="text-xs text-editor-text">{file.name}</span>
        {lastValidation && file.type === "mml" && (
          <span
            className={`ml-auto text-[10px] px-2 py-0.5 rounded ${
              lastValidation.valid
                ? "bg-green-900/40 text-green-400"
                : "bg-red-900/40 text-red-400"
            }`}
          >
            {lastValidation.valid
              ? `✓ Valid`
              : `✗ ${lastValidation.errors.length} error${lastValidation.errors.length !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditorPanel
          key={activeFileId}
          value={file.content}
          language={file.type === "mml" ? "html" : "javascript"}
          onChange={handleChange}
          errors={lastValidation?.errors || []}
        />
      </div>

      {/* Debug Panel */}
      <div className="h-44 border-t border-editor-border bg-editor-sidebar">
        <div className="flex items-center justify-between px-3 py-2 border-b border-editor-border">
          <span className="text-xs font-semibold text-editor-text-muted uppercase tracking-wider">
            Debug
          </span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded ${
              overallStatus === "ACCEPTED"
                ? "bg-green-900/40 text-green-300"
                : overallStatus === "REJECTED"
                ? "bg-red-900/40 text-red-300"
                : "bg-editor-border text-editor-text-muted"
            }`}
          >
            {overallStatus || "UNKNOWN"}
          </span>
        </div>
        <div className="p-3 text-xs overflow-y-auto h-[calc(100%-36px)] space-y-2">
          {generationError && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-300 rounded p-2">
              {generationError}
            </div>
          )}
          {complianceScore && (
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(complianceScore).map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between bg-editor-panel border border-editor-border rounded px-2 py-1"
                >
                  <span className="text-editor-text-muted">{k}</span>
                  <span className={v === "Pass" ? "text-green-400" : "text-red-400"}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!generationError && !complianceScore && (
            <div className="text-editor-text-muted">
              No debug output yet. Run Validate or Generate to see details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewportPanel() {
  const { getActiveProject } = useEditorStore();
  const project = getActiveProject();
  const mmlFile = project?.files.find((f) => f.name === "scene.mml");
  const mml = mmlFile?.content || "";

  return (
    <div className="flex flex-col" style={{ width: "42%" }}>
      <div className="flex-1 overflow-hidden">
        <ThreeViewport mmlHtml={mml} />
      </div>
      <div style={{ height: "220px" }}>
        <InspectorPanel />
      </div>
    </div>
  );
}

export default function StudioPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
      {/* Titlebar */}
      <Titlebar />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar />

        {/* Center: Editor */}
        <EditorPanel />

        {/* Right: Viewport + Inspector */}
        <ViewportPanel />
      </div>

      {/* Bottom: Prompt */}
      <PromptInput />
    </div>
  );
}
