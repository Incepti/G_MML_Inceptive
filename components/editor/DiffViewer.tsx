"use client";

import React, { useCallback, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { useEditorStore } from "@/lib/store";

/**
 * DiffViewer — shows a side-by-side Monaco diff when the AI generates changes.
 *
 * IMPORTANT: We never conditionally unmount the DiffEditor component.
 * Monaco's DiffEditor crashes ("TextModel got disposed before DiffEditorWidget
 * model got reset") when React unmounts it because its internal cleanup order
 * is broken. Instead we keep the overlay hidden via CSS and only show it when
 * there's a pending diff.
 */
export function DiffViewer() {
  const pendingDiff = useEditorStore((s) => s.pendingDiff);
  const acceptDiff = useEditorStore((s) => s.acceptDiff);
  const rejectDiff = useEditorStore((s) => s.rejectDiff);

  // Snapshot the diff content so Monaco doesn't receive undefined props
  const lastDiff = useRef<{ oldMml: string; newMml: string }>({ oldMml: "", newMml: "" });
  if (pendingDiff) {
    lastDiff.current = pendingDiff;
  }

  const visible = !!pendingDiff;

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col bg-editor-bg"
      style={{ display: visible ? "flex" : "none" }}
    >
      {/* Diff Header */}
      <div className="flex items-center px-3 py-1.5 border-b border-editor-border shrink-0 gap-2 bg-editor-sidebar">
        <span className="text-[10px] text-editor-accent uppercase tracking-wider font-semibold">
          Code Diff
        </span>
        <span className="text-[10px] text-editor-text-muted">
          Review AI changes before applying
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={acceptDiff}
            className="text-[10px] px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-medium"
          >
            Accept Changes
          </button>
          <button
            onClick={rejectDiff}
            className="text-[10px] px-3 py-1 bg-editor-border hover:bg-red-900/40 text-editor-text rounded transition-colors"
          >
            Reject
          </button>
        </div>
      </div>

      {/* Diff Editor — always mounted, never unmounted */}
      <div className="flex-1 overflow-hidden">
        <DiffEditor
          height="100%"
          language="html"
          original={lastDiff.current.oldMml}
          modified={lastDiff.current.newMml}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            readOnly: true,
            renderSideBySide: true,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
          }}
        />
      </div>
    </div>
  );
}
