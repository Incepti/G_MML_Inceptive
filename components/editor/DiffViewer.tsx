"use client";

import React, { useEffect, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { useEditorStore } from "@/lib/store";

export function DiffViewer() {
  const { pendingDiff, acceptDiff, rejectDiff } = useEditorStore();

  if (!pendingDiff) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-editor-bg">
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

      {/* Diff Editor */}
      <div className="flex-1 overflow-hidden">
        <DiffEditor
          height="100%"
          language="html"
          original={pendingDiff.oldMml}
          modified={pendingDiff.newMml}
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
