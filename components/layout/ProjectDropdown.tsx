"use client";

import React, { useState, useRef, useEffect } from "react";
import { useEditorStore } from "@/lib/store";

export function ProjectDropdown() {
  const {
    projects,
    activeProjectId,
    setActiveProject,
    createProject,
    getActiveProject,
  } = useEditorStore();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"static" | "dynamic">("static");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const project = getActiveProject();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createProject(name, newMode);
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-editor-text hover:text-editor-accent transition-colors max-w-[160px]"
      >
        <span className="text-editor-accent font-bold text-sm">⬡</span>
        <span className="truncate">
          {project ? project.name : "Select project"}
        </span>
        <span className="text-editor-text-muted text-[10px]">▼</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-editor-panel border border-editor-border rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Project list */}
          <div className="max-h-48 overflow-y-auto">
            {projects.length === 0 ? (
              <div className="px-3 py-2 text-[10px] text-editor-text-muted">
                No projects yet
              </div>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProject(p.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-editor-bg/50 transition-colors ${
                    p.id === activeProjectId
                      ? "text-editor-accent bg-editor-accent/5"
                      : "text-editor-text"
                  }`}
                >
                  <span className="truncate flex-1">{p.name}</span>
                  <span
                    className={`text-[9px] px-1 py-0.5 rounded ${
                      p.mode === "dynamic"
                        ? "bg-purple-900/40 text-purple-300"
                        : "bg-blue-900/40 text-blue-300"
                    }`}
                  >
                    {p.mode}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Divider + New Project */}
          <div className="border-t border-editor-border">
            {creating ? (
              <div className="p-2 space-y-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Project name"
                  autoFocus
                  className="w-full bg-editor-bg border border-editor-border rounded px-2 py-1 text-xs text-editor-text placeholder:text-editor-text-muted/50 focus:outline-none focus:border-editor-accent/50"
                />
                <div className="flex gap-1">
                  {(["static", "dynamic"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setNewMode(m)}
                      className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                        newMode === m
                          ? "bg-editor-accent text-white"
                          : "bg-editor-bg text-editor-text-muted hover:text-editor-text"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                    className="flex-1 text-[10px] py-1 bg-editor-accent hover:bg-editor-accent-hover disabled:opacity-40 text-white rounded transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setCreating(false)}
                    className="text-[10px] py-1 px-2 text-editor-text-muted hover:text-editor-text transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2 text-xs text-editor-accent hover:bg-editor-bg/50 transition-colors"
              >
                + New Project
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
