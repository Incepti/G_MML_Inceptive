"use client";

import React, { useState, useRef, useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import type { LogEntry } from "@/types/chat";

const TYPE_COLORS: Record<LogEntry["type"], string> = {
  info: "text-green-400",
  warning: "text-yellow-400",
  error: "text-red-400",
  ai: "text-blue-400",
  validation: "text-purple-400",
  render: "text-cyan-400",
};

const TYPE_LABELS: Record<LogEntry["type"], string> = {
  info: "INFO",
  warning: "WARN",
  error: "ERR",
  ai: "AI",
  validation: "VAL",
  render: "RENDER",
};

type FilterType = "all" | LogEntry["type"];

export function LogsPanel() {
  const { logs, clearLogs } = useEditorStore();
  const [filter, setFilter] = useState<FilterType>("all");
  const listRef = useRef<HTMLDivElement>(null);

  const filtered =
    filter === "all" ? logs : logs.filter((l) => l.type === filter);

  // Auto-scroll on new logs
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [logs.length]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "All" },
    { key: "ai", label: "AI" },
    { key: "validation", label: "Validation" },
    { key: "error", label: "Errors" },
    { key: "render", label: "Render" },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-editor-sidebar">
      {/* Header */}
      <div className="flex items-center px-3 py-1.5 border-b border-editor-border shrink-0 gap-2">
        <span className="text-[10px] text-editor-text-muted uppercase tracking-wider font-semibold">
          Debug Logs
        </span>

        {/* Filters */}
        <div className="flex gap-1 ml-3">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                filter === f.key
                  ? "bg-editor-accent/20 text-editor-accent"
                  : "text-editor-text-muted hover:text-editor-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          onClick={clearLogs}
          className="ml-auto text-[10px] text-editor-text-muted hover:text-editor-text transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Log entries */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-1 font-mono">
        {filtered.length === 0 ? (
          <div className="text-[10px] text-editor-text-muted/50 py-2">
            No logs yet.
          </div>
        ) : (
          filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 py-0.5 text-[11px] leading-relaxed"
            >
              <span className="text-editor-text-muted/40 shrink-0 w-16">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`shrink-0 w-10 font-semibold ${
                  TYPE_COLORS[entry.type]
                }`}
              >
                [{TYPE_LABELS[entry.type]}]
              </span>
              <span className="text-editor-text-muted">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
