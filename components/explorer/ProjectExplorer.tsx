"use client";

import React, { useState } from "react";
import { useEditorStore } from "@/lib/store";

export function ProjectExplorer() {
  const {
    projects,
    activeProjectId,
    activeFileId,
    setActiveProject,
    setActiveFile,
    createProject,
  } = useEditorStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMode, setNewMode] = useState<"static" | "dynamic">("static");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProject(newName.trim(), newMode);
    setNewName("");
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-editor-border shrink-0">
        <span className="text-xs font-semibold text-editor-text-muted uppercase tracking-wider">
          Projects
        </span>
        <button
          onClick={() => setIsCreating(true)}
          className="text-editor-text-muted hover:text-editor-accent transition-colors text-sm"
          title="New Project"
        >
          +
        </button>
      </div>

      {/* New Project Form */}
      {isCreating && (
        <div className="p-2 border-b border-editor-border bg-editor-panel space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setIsCreating(false);
            }}
            placeholder="Project name..."
            className="w-full bg-editor-bg border border-editor-border rounded px-2 py-1 text-xs text-editor-text placeholder:text-editor-text-muted focus:outline-none focus:border-editor-accent"
          />
          <div className="flex gap-2">
            <label className="flex items-center gap-1 cursor-pointer text-xs text-editor-text">
              <input
                type="radio"
                name="mode"
                value="static"
                checked={newMode === "static"}
                onChange={() => setNewMode("static")}
              />
              Static
            </label>
            <label className="flex items-center gap-1 cursor-pointer text-xs text-editor-text">
              <input
                type="radio"
                name="mode"
                value="dynamic"
                checked={newMode === "dynamic"}
                onChange={() => setNewMode("dynamic")}
              />
              Dynamic
            </label>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleCreate}
              className="flex-1 bg-editor-accent text-white rounded py-1 text-xs hover:bg-editor-accent-hover"
            >
              Create
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="flex-1 bg-editor-border text-editor-text rounded py-1 text-xs hover:bg-editor-panel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-4 text-center text-editor-text-muted text-xs">
            No projects yet.
            <br />
            <button
              onClick={() => setIsCreating(true)}
              className="text-editor-accent hover:underline mt-1"
            >
              Create your first project
            </button>
          </div>
        ) : (
          projects.map((project) => {
            const isActive = project.id === activeProjectId;
            return (
              <div key={project.id}>
                {/* Project Row */}
                <button
                  onClick={() => setActiveProject(project.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                    isActive
                      ? "bg-editor-accent/20 text-editor-text"
                      : "text-editor-text-muted hover:bg-editor-panel hover:text-editor-text"
                  }`}
                >
                  <span className="text-[10px] text-editor-text-muted">▶</span>
                  <span className="text-xs font-medium truncate">
                    {project.name}
                  </span>
                  <span
                    className={`ml-auto text-[9px] px-1 rounded ${
                      project.mode === "dynamic"
                        ? "bg-purple-900/40 text-purple-300"
                        : "bg-blue-900/40 text-blue-300"
                    }`}
                  >
                    {project.mode}
                  </span>
                </button>

                {/* File List (only for active project) */}
                {isActive &&
                  project.files.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setActiveFile(file.id)}
                      className={`w-full text-left pl-8 pr-3 py-1.5 flex items-center gap-2 text-xs transition-colors ${
                        file.id === activeFileId
                          ? "bg-editor-accent/10 text-editor-accent"
                          : "text-editor-text-muted hover:text-editor-text hover:bg-editor-panel/50"
                      }`}
                    >
                      <span className="text-[10px]">
                        {file.type === "mml"
                          ? "⬡"
                          : file.type === "js"
                          ? "⚡"
                          : "⌁"}
                      </span>
                      {file.name}
                    </button>
                  ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
