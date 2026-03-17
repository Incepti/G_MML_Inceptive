"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { DiffEditor } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useEditorStore } from "@/lib/store";

export function DiffViewer() {
  const { pendingDiff, acceptDiff, rejectDiff } = useEditorStore();
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const [closing, setClosing] = useState(false);

  // Reset closing state when a new diff arrives
  useEffect(() => {
    if (pendingDiff) setClosing(false);
  }, [pendingDiff]);

  // Dispose editor before state change to prevent "TextModel disposed" crash
  const safeClose = useCallback((action: () => void) => {
    setClosing(true);
    if (editorRef.current) {
      editorRef.current.dispose();
      editorRef.current = null;
    }
    // Let React unmount the DiffEditor first, then update store
    requestAnimationFrame(() => action());
  }, []);

  const handleMount = useCallback((editor: editor.IStandaloneDiffEditor) => {
    editorRef.current = editor;
  }, []);

  if (!pendingDiff || closing) return null;

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
            onClick={() => safeClose(acceptDiff)}
            className="text-[10px] px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-medium"
          >
            Accept Changes
          </button>
          <button
            onClick={() => safeClose(rejectDiff)}
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
          onMount={handleMount}
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
