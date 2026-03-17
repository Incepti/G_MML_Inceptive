"use client";

import React, { useState } from "react";
import { useEditorStore } from "@/lib/store";

export function ProjectLauncher() {
  const { projects, createProject, setActiveProject } = useEditorStore();
  const [tab, setTab] = useState<"open" | "create">(projects.length > 0 ? "open" : "create");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"static" | "dynamic">("static");

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createProject(trimmed, mode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at center, #0d1326 0%, #080c1a 70%)",
    }}>
      {/* Card */}
      <div style={{
        width: "100%", maxWidth: "540px",
        background: "#0f1629",
        border: "1px solid #1e2d50",
        borderRadius: "16px",
        overflow: "hidden",
        boxShadow: "0 25px 60px rgba(0,0,0,0.5), 0 0 80px rgba(99,102,241,0.08)",
      }}>
        {/* Header */}
        <div style={{
          padding: "32px 32px 20px",
          textAlign: "center",
          borderBottom: "1px solid #1e2d50",
        }}>
          <div style={{
            fontSize: "28px", marginBottom: "6px", opacity: 0.8,
            filter: "drop-shadow(0 0 8px rgba(99,102,241,0.4))",
          }}>
            ⬡
          </div>
          <h1 style={{
            fontSize: "20px", fontWeight: 700, color: "#e6f1ff",
            letterSpacing: "-0.02em", margin: "0 0 4px",
          }}>
            GEEZ MML Studio
          </h1>
          <p style={{ fontSize: "12px", color: "#6070a0", margin: 0 }}>
            Build 3D metaverse scenes with AI
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid #1e2d50",
        }}>
          {(["open", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "10px", border: "none", cursor: "pointer",
                fontSize: "12px", fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.08em",
                background: tab === t ? "#151d36" : "transparent",
                color: tab === t ? "#60a5fa" : "#6070a0",
                borderBottom: tab === t ? "2px solid #60a5fa" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {t === "open" ? `Open Project (${projects.length})` : "New Project"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "20px 28px 28px", minHeight: "260px" }}>
          {tab === "create" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Name */}
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#8aa0c4", fontWeight: 600, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="My Awesome Scene"
                  autoFocus
                  style={{
                    width: "100%", padding: "10px 14px",
                    background: "#0a0f1e", border: "1px solid #1e2d50",
                    borderRadius: "8px", color: "#e6f1ff", fontSize: "14px",
                    outline: "none", transition: "border-color 0.15s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
                  onBlur={(e) => (e.target.style.borderColor = "#1e2d50")}
                />
              </div>

              {/* Mode */}
              <div>
                <label style={{ display: "block", fontSize: "11px", color: "#8aa0c4", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Scene Mode
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["static", "dynamic"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      style={{
                        flex: 1, padding: "14px 12px",
                        background: mode === m ? "rgba(59,130,246,0.1)" : "#0a0f1e",
                        border: `1.5px solid ${mode === m ? "#3b82f6" : "#1e2d50"}`,
                        borderRadius: "10px", cursor: "pointer",
                        transition: "all 0.15s",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: "13px", fontWeight: 600, color: mode === m ? "#60a5fa" : "#e6f1ff", marginBottom: "3px" }}>
                        {m === "static" ? "Static" : "Dynamic"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#6070a0", lineHeight: "1.4" }}>
                        {m === "static"
                          ? "MML markup only — models, lights, animations"
                          : "MML + JavaScript — scripted behavior, interactivity"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Create Button */}
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                style={{
                  width: "100%", padding: "12px",
                  background: name.trim() ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "#1e2d50",
                  border: "none", borderRadius: "8px", cursor: name.trim() ? "pointer" : "default",
                  color: name.trim() ? "#fff" : "#6070a0",
                  fontSize: "14px", fontWeight: 600,
                  transition: "all 0.15s",
                  opacity: name.trim() ? 1 : 0.6,
                  marginTop: "4px",
                }}
              >
                Create Project
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {projects.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#6070a0", fontSize: "13px" }}>
                  <div style={{ fontSize: "32px", opacity: 0.3, marginBottom: "12px" }}>⬡</div>
                  <div>No projects yet</div>
                  <button
                    onClick={() => setTab("create")}
                    style={{
                      marginTop: "12px", padding: "8px 20px",
                      background: "rgba(59,130,246,0.15)", border: "1px solid #3b82f6",
                      borderRadius: "6px", color: "#60a5fa", fontSize: "12px",
                      cursor: "pointer", fontWeight: 600,
                    }}
                  >
                    Create your first project
                  </button>
                </div>
              ) : (
                <>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveProject(p.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: "14px",
                        width: "100%", padding: "14px 16px",
                        background: "#0a0f1e", border: "1px solid #1e2d50",
                        borderRadius: "10px", cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#3b82f6";
                        e.currentTarget.style.background = "rgba(59,130,246,0.05)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#1e2d50";
                        e.currentTarget.style.background = "#0a0f1e";
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: "40px", height: "40px", borderRadius: "10px",
                        background: "linear-gradient(135deg, #1e2d50, #152040)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "16px", flexShrink: 0,
                      }}>
                        {p.mode === "dynamic" ? "⚡" : "⬡"}
                      </div>

                      {/* Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#e6f1ff", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.name}
                        </div>
                        <div style={{ display: "flex", gap: "8px", fontSize: "10px", color: "#6070a0" }}>
                          <span style={{
                            background: p.mode === "dynamic" ? "#1a2040" : "#152040",
                            color: p.mode === "dynamic" ? "#fbbf24" : "#60a5fa",
                            padding: "1px 6px", borderRadius: "3px",
                          }}>
                            {p.mode}
                          </span>
                          <span>{p.files.length} file{p.files.length !== 1 ? "s" : ""}</span>
                          <span>{formatDate(p.updatedAt)}</span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div style={{ color: "#3b82f6", fontSize: "16px", flexShrink: 0 }}>
                        →
                      </div>
                    </button>
                  ))}

                  {/* Quick create at bottom */}
                  <button
                    onClick={() => setTab("create")}
                    style={{
                      width: "100%", padding: "10px",
                      background: "transparent", border: "1px dashed #1e2d50",
                      borderRadius: "10px", cursor: "pointer",
                      color: "#6070a0", fontSize: "12px",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#3b82f6";
                      e.currentTarget.style.color = "#60a5fa";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#1e2d50";
                      e.currentTarget.style.color = "#6070a0";
                    }}
                  >
                    + New Project
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
