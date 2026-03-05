"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { useEditorStore } from "@/lib/store";
import { useGenerate } from "@/hooks/useGenerate";
import { ChatMessage } from "./ChatMessage";
import { ProjectDropdown } from "@/components/layout/ProjectDropdown";
import { AssetDrawer } from "@/components/layout/AssetDrawer";
import type { ChatMessage as ChatMessageType } from "@/types/chat";
import { generateMml } from "@/lib/blueprint/generateMml";

// ─── Collapsible Section ─────────────────────────────────────────────────────
function CollapsibleSection({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-editor-border rounded overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-editor-bg/50 transition-colors"
      >
        <span className="text-editor-text-muted/50 text-[10px]">{open ? "▲" : "▼"}</span>
        <span className="text-editor-text font-medium">{title}</span>
        {badge && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-editor-accent/20 text-editor-accent">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div className="px-2.5 py-2 border-t border-editor-border bg-editor-bg/30 text-[11px] text-editor-text-muted">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Blueprint Viewer ────────────────────────────────────────────────────────
function BlueprintViewer() {
  const { currentBlueprint, blueprintOutOfSync } = useEditorStore();

  if (!currentBlueprint) {
    return (
      <div className="text-[10px] text-editor-text-muted/50 py-2">
        No blueprint loaded. Generate a scene to create one.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {blueprintOutOfSync && (
        <div className="text-[10px] px-2 py-1 rounded bg-yellow-900/30 text-yellow-400 border border-yellow-900/50">
          Blueprint out of sync with manual edits
        </div>
      )}
      <div className="space-y-0.5">
        <div><span className="text-editor-text">Title:</span> {currentBlueprint.meta.title}</div>
        <div><span className="text-editor-text">Structures:</span> {currentBlueprint.scene.structures.length}</div>
        <div><span className="text-editor-text">Lights:</span> {currentBlueprint.scene.structures.filter(s => s.type === "light").length}/{currentBlueprint.budgets.maxLights}</div>
        {currentBlueprint.scene.ground && (
          <div><span className="text-editor-text">Ground:</span> {currentBlueprint.scene.ground.width}x{currentBlueprint.scene.ground.height}m</div>
        )}
      </div>
      <details className="text-[10px]">
        <summary className="cursor-pointer text-editor-text-muted hover:text-editor-text">
          Raw JSON
        </summary>
        <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-editor-text-muted/70">
          {JSON.stringify(currentBlueprint, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ─── Validation Issues ──────────────────────────────────────────────────────
function ValidationIssuesPanel() {
  const { validationIssues } = useEditorStore();

  if (validationIssues.length === 0) {
    return <div className="text-[10px] text-green-400">No issues found</div>;
  }

  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      {validationIssues.map((issue, i) => (
        <div
          key={i}
          className={`text-[10px] flex items-start gap-1.5 ${
            issue.severity === "error" ? "text-red-400" : "text-yellow-400"
          }`}
        >
          <span className="shrink-0">{issue.severity === "error" ? "✗" : "⚠"}</span>
          <span>{issue.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Patch Viewer ───────────────────────────────────────────────────────────
function PatchViewer() {
  const { lastAiResponse } = useEditorStore();

  if (!lastAiResponse || lastAiResponse.type !== "PATCH" || !lastAiResponse.patch) {
    return null;
  }

  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      {lastAiResponse.patch.map((op, i) => (
        <div key={i} className="text-[10px] font-mono flex items-start gap-1.5">
          <span className={`shrink-0 font-bold ${
            op.op === "add" ? "text-green-400" : op.op === "remove" ? "text-red-400" : "text-blue-400"
          }`}>
            {op.op.toUpperCase()}
          </span>
          <span className="text-editor-text-muted">{op.path}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Diff Actions ───────────────────────────────────────────────────────────
function DiffActions() {
  const { pendingDiff, acceptDiff, rejectDiff } = useEditorStore();

  if (!pendingDiff) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-editor-accent/10 border-t border-editor-border shrink-0">
      <span className="text-[10px] text-editor-text-muted">AI changes pending</span>
      <div className="ml-auto flex gap-1.5">
        <button
          onClick={acceptDiff}
          className="text-[10px] px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          Accept
        </button>
        <button
          onClick={rejectDiff}
          className="text-[10px] px-2.5 py-1 bg-editor-border hover:bg-editor-text-muted/20 text-editor-text rounded transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ─── Manual Edit Toggle ─────────────────────────────────────────────────────
function ManualEditToggle() {
  const {
    manualEditMode,
    setManualEditMode,
    setBlueprintOutOfSync,
    currentBlueprint,
    resyncFromBlueprint,
  } = useEditorStore();

  const handleResync = () => {
    if (!currentBlueprint) return;
    const mml = generateMml(currentBlueprint);
    resyncFromBlueprint(mml);
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-editor-border shrink-0">
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={manualEditMode}
          onChange={(e) => {
            setManualEditMode(e.target.checked);
            if (e.target.checked) setBlueprintOutOfSync(true);
          }}
          className="w-3 h-3 rounded border-editor-border accent-editor-accent"
        />
        <span className="text-[10px] text-editor-text-muted">Manual Edit</span>
      </label>
      {manualEditMode && currentBlueprint && (
        <button
          onClick={handleResync}
          className="ml-auto text-[10px] text-editor-accent hover:text-editor-accent-hover transition-colors"
          title="Discard manual edits, regenerate from blueprint"
        >
          Re-sync
        </button>
      )}
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────
export function AIAgentPanel() {
  const {
    getActiveProject,
    activeProjectId,
    getChatHistory,
    isGenerating,
    assetDrawerOpen,
    setAssetDrawerOpen,
    lastAiResponse,
    validationIssues,
    currentBlueprint,
  } = useEditorStore();

  const { generate } = useGenerate();
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const project = getActiveProject();
  const messages = getChatHistory();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !activeProjectId || isGenerating) return;
    setInput("");
    await generate(text);
  }, [input, activeProjectId, isGenerating, generate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const showInfoPanels = currentBlueprint || validationIssues.length > 0 || (lastAiResponse?.type === "PATCH");

  return (
    <div className="flex flex-col h-full bg-editor-sidebar relative">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-editor-border shrink-0 gap-2">
        <span className="text-[10px] text-editor-accent uppercase tracking-wider font-semibold">
          AI Scene Architect
        </span>
        <ProjectDropdown />
        <div className="ml-auto flex items-center gap-1">
          {project && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                project.mode === "dynamic"
                  ? "bg-purple-900/40 text-purple-300"
                  : "bg-blue-900/40 text-blue-300"
              }`}
            >
              {project.mode}
            </span>
          )}
          <button
            onClick={() => setAssetDrawerOpen(!assetDrawerOpen)}
            className="p-1.5 text-editor-text-muted hover:text-editor-text rounded transition-colors"
            title="Assets"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Info Panels */}
      {showInfoPanels && (
        <div className="px-2 py-2 space-y-1.5 border-b border-editor-border shrink-0 max-h-[40%] overflow-y-auto">
          <CollapsibleSection title="Blueprint" badge={currentBlueprint ? `${currentBlueprint.scene.structures.length} structs` : undefined}>
            <BlueprintViewer />
          </CollapsibleSection>

          {lastAiResponse?.type === "PATCH" && lastAiResponse.patch && (
            <CollapsibleSection title="Patch" badge={`${lastAiResponse.patch.length} ops`}>
              <PatchViewer />
            </CollapsibleSection>
          )}

          {lastAiResponse?.explain?.reasoning && (
            <CollapsibleSection title="Reasoning">
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {lastAiResponse.explain.reasoning.map((r, i) => (
                  <div key={i} className="text-[10px]">{r}</div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection
            title="Validation"
            badge={validationIssues.length > 0 ? `${validationIssues.length}` : "OK"}
          >
            <ValidationIssuesPanel />
          </CollapsibleSection>
        </div>
      )}

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {!project ? (
          <div className="text-center text-editor-text-muted text-xs mt-8 space-y-2">
            <div className="text-2xl">⬡</div>
            <div>Create or select a project to start</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-editor-text-muted text-xs mt-8 space-y-2">
            <div className="text-2xl opacity-50">AI</div>
            <div>Describe the MML scene you want to build.</div>
            <div className="text-[10px] opacity-60">
              The AI generates a structured blueprint, then derives MML code.
            </div>
          </div>
        ) : (
          messages.map((msg: ChatMessageType) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Diff Actions */}
      <DiffActions />

      {/* Manual Edit Toggle */}
      <ManualEditToggle />

      {/* Chat Input */}
      <div className="border-t border-editor-border p-3 shrink-0">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !project
                ? "Create a project first..."
                : "Describe your scene... (Ctrl+Enter)"
            }
            disabled={!project || isGenerating}
            rows={2}
            className="w-full bg-editor-bg border border-editor-border rounded-lg px-3 py-2 pr-16 text-xs text-editor-text placeholder:text-editor-text-muted/50 resize-none focus:outline-none focus:border-editor-accent/50 disabled:opacity-40"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !project || isGenerating}
            className="absolute right-2 bottom-2 px-3 py-1 bg-editor-accent hover:bg-editor-accent-hover disabled:opacity-30 disabled:hover:bg-editor-accent text-white text-[10px] font-medium rounded transition-colors"
          >
            {isGenerating ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 border border-white/60 border-t-transparent rounded-full animate-spin" />
                ...
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </div>

      {/* Asset Drawer */}
      {assetDrawerOpen && <AssetDrawer />}
    </div>
  );
}
