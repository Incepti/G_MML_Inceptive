"use client";

import React, { useState } from "react";
import type { ChatMessage as ChatMessageType, ReasoningStep, SceneBlueprint } from "@/types/chat";

function BlueprintDisplay({ blueprint }: { blueprint: SceneBlueprint }) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="border border-editor-accent/30 rounded overflow-hidden bg-editor-accent/5">
      <div className="px-2.5 py-1.5 text-[11px] space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-editor-accent font-semibold">Scene Blueprint</span>
          <button
            onClick={() => setShowJson(!showJson)}
            className="ml-auto text-[10px] text-editor-text-muted hover:text-editor-text"
          >
            {showJson ? "Summary" : "JSON"}
          </button>
        </div>
        {showJson ? (
          <pre className="text-[10px] text-editor-text-muted whitespace-pre-wrap max-h-48 overflow-y-auto">
            {JSON.stringify(blueprint, null, 2)}
          </pre>
        ) : (
          <div className="space-y-0.5 text-editor-text-muted">
            <div><span className="text-editor-text">Environment:</span> {blueprint.environment}</div>
            <div><span className="text-editor-text">Zones:</span> {blueprint.zones?.join(", ") || "none"}</div>
            <div><span className="text-editor-text">Structures:</span> {blueprint.structures?.length || 0} — {blueprint.structures?.map(s => s.type).slice(0, 5).join(", ")}{(blueprint.structures?.length || 0) > 5 ? "..." : ""}</div>
            {blueprint.lighting && <div><span className="text-editor-text">Lighting:</span> {blueprint.lighting}</div>}
            {blueprint.mood && <div><span className="text-editor-text">Mood:</span> {blueprint.mood}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function ReasoningAccordion({ step }: { step: ReasoningStep }) {
  const [open, setOpen] = useState(false);

  const statusIcon =
    step.status === "complete" ? "✓" :
    step.status === "error" ? "✗" :
    "⋯";

  const statusColor =
    step.status === "complete" ? "text-green-400" :
    step.status === "error" ? "text-red-400" :
    "text-yellow-400";

  return (
    <div className="border border-editor-border rounded overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] hover:bg-editor-bg/50 transition-colors"
      >
        <span className={`text-[10px] ${statusColor}`}>{statusIcon}</span>
        <span className="text-editor-text-muted font-medium">{step.title}</span>
        <span className="ml-auto text-editor-text-muted/50 text-[10px]">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div className="px-2.5 py-2 border-t border-editor-border bg-editor-bg/30 text-[11px] text-editor-text-muted whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {step.content || "No details available."}
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-editor-accent/15 border border-editor-accent/20 rounded-lg px-3 py-2 text-xs text-editor-text leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === "system") {
    return (
      <div className="text-center text-[10px] text-editor-text-muted/60 py-1">
        {message.content}
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] space-y-2">
        {/* AI label */}
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-editor-accent/20 text-editor-accent flex items-center justify-center text-[10px] font-bold">
            AI
          </span>
          <span className="text-[10px] text-editor-text-muted">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* Content */}
        {message.content && (
          <div className="text-xs text-editor-text leading-relaxed pl-6">
            {message.content}
          </div>
        )}

        {/* Blueprint */}
        {message.blueprint && (
          <div className="pl-6">
            <BlueprintDisplay blueprint={message.blueprint} />
          </div>
        )}

        {/* Reasoning steps */}
        {message.reasoning && message.reasoning.length > 0 && (
          <div className="pl-6 space-y-1">
            {message.reasoning.map((step, i) => (
              <ReasoningAccordion key={i} step={step} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
