"use client";

import React from "react";
import { useEditorStore } from "@/lib/store";
import { AIAgentPanel } from "@/components/chat/AIAgentPanel";
import { InspectorPanel } from "@/components/renderer/InspectorPanel";
import { BiomePanel } from "@/components/biome/BiomePanel";

const TABS: Array<{ id: "inspector" | "agent" | "biome"; label: string }> = [
  { id: "inspector", label: "Inspector" },
  { id: "agent", label: "Agent" },
  { id: "biome", label: "Biomes" },
];

export function RightSidebar() {
  const { sidebarTab, setSidebarTab } = useEditorStore();

  return (
    <div className="flex flex-col h-full bg-editor-sidebar border-l border-editor-border">
      {/* Tab Bar */}
      <div className="flex border-b border-editor-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSidebarTab(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              sidebarTab === tab.id
                ? "text-editor-accent border-b-2 border-editor-accent"
                : "text-editor-text-muted hover:text-editor-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {sidebarTab === "inspector" && <InspectorPanel />}
        {sidebarTab === "agent" && <AIAgentPanel />}
        {sidebarTab === "biome" && <BiomePanel />}
      </div>
    </div>
  );
}
