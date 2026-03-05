"use client";

import React, { useCallback, useRef, useEffect, useState } from "react";
import { useEditorStore } from "@/lib/store";
import { useGenerate } from "@/hooks/useGenerate";
import { ChatMessage } from "./ChatMessage";
import { ProjectDropdown } from "@/components/layout/ProjectDropdown";
import { AssetDrawer } from "@/components/layout/AssetDrawer";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

export function AIAgentPanel() {
  const {
    getActiveProject,
    activeProjectId,
    getChatHistory,
    isGenerating,
    assetDrawerOpen,
    setAssetDrawerOpen,
  } = useEditorStore();

  const { generate } = useGenerate();
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const project = getActiveProject();
  const messages = getChatHistory();

  // Auto-scroll to bottom on new messages
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

  return (
    <div className="flex flex-col h-full bg-editor-sidebar relative">
      {/* Header */}
      <div className="flex items-center px-3 py-2 border-b border-editor-border shrink-0 gap-2">
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
              The AI will plan, validate, and generate the code.
            </div>
          </div>
        ) : (
          messages.map((msg: ChatMessageType) => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
        <div ref={chatEndRef} />
      </div>

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
