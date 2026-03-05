"use client";

import React from "react";
import { useEditorStore } from "@/lib/store";
import { AssetBrowser } from "@/components/explorer/AssetBrowser";

export function AssetDrawer() {
  const { setAssetDrawerOpen } = useEditorStore();

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-editor-sidebar">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-editor-border shrink-0">
        <span className="text-xs font-semibold text-editor-text">Assets</span>
        <button
          onClick={() => setAssetDrawerOpen(false)}
          className="text-editor-text-muted hover:text-editor-text text-sm transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Asset Browser */}
      <div className="flex-1 overflow-hidden">
        <AssetBrowser />
      </div>
    </div>
  );
}
