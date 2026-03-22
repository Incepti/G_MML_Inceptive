"use client";

import { useState } from "react";
import { BIOME_PRESETS, type BiomePreset } from "@/lib/biome/presets";
import { useEditorStore } from "@/lib/store";

function BiomeCard({
  preset,
  selected,
  onSelect,
}: {
  preset: BiomePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "12px",
        borderRadius: "10px",
        cursor: "pointer",
        border: selected
          ? `2px solid ${preset.color}`
          : `1px solid ${hovered ? "#333" : "#1a1a2e"}`,
        background: selected
          ? `${preset.color}15`
          : hovered
          ? "#141428"
          : "#0d0d1e",
        transition: "all 0.15s",
        textAlign: "left",
        fontFamily: "inherit",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "22px" }}>{preset.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: selected ? preset.color : "#e6e6ff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {preset.name}
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "#7070aa",
              marginTop: "2px",
              lineHeight: 1.3,
            }}
          >
            ~{preset.density} objects
          </div>
        </div>
        {selected && (
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: preset.color,
              flexShrink: 0,
            }}
          />
        )}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "#8080b0",
          lineHeight: 1.4,
        }}
      >
        {preset.description}
      </div>
      <div
        style={{
          display: "flex",
          gap: "4px",
          flexWrap: "wrap",
        }}
      >
        {preset.othersideSubcats.slice(0, 3).map((s) => (
          <span
            key={s}
            style={{
              fontSize: "9px",
              padding: "1px 6px",
              borderRadius: "4px",
              background: `${preset.color}20`,
              color: preset.color,
              border: `1px solid ${preset.color}30`,
            }}
          >
            {s.replace(/_/g, " ")}
          </span>
        ))}
      </div>
    </button>
  );
}

export function BiomePanel() {
  const [selectedBiome, setSelectedBiome] = useState<string | null>(null);
  const [customization, setCustomization] = useState("");
  const [generating, setGenerating] = useState(false);

  const preset = BIOME_PRESETS.find((b) => b.id === selectedBiome);

  const handleGenerate = async () => {
    if (!selectedBiome || generating) return;

    setGenerating(true);

    const state = useEditorStore.getState();
    const proj = state.projects.find((p) => p.id === state.activeProjectId);
    if (!proj) {
      setGenerating(false);
      return;
    }

    const biomePrefix = `[BIOME:${selectedBiome}]`;
    const message = customization.trim()
      ? `${biomePrefix} ${customization.trim()}`
      : `${biomePrefix} Generate a dense ${preset?.name || selectedBiome} biome`;

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "NEW_SCENE",
          userMessage: message,
          projectMode: proj.mode,
        }),
      });

      const data = await res.json();

      if (data.type === "ERROR") {
        state.addLog({ type: "error", message: `Biome generation failed: ${data.error}` });
      } else if (data.type === "NEW_SCENE") {
        if (data.blueprint) {
          state.setBlueprint(data.blueprint);
        }
        if (data.generatedMml) {
          const mmlFile = proj.files.find((f) => f.name === "scene.mml");
          if (mmlFile) {
            state.updateFileContent(proj.id, mmlFile.id, data.generatedMml);
          }
        }
        state.addLog({
          type: "ai",
          message: `Biome generated: ${preset?.name || selectedBiome} (${data.blueprint?.scene?.structures?.length || 0} structures)`,
        });
      }
    } catch (err) {
      state.addLog({ type: "error", message: `Biome generation error: ${err}` });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "#0a0a18",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px 10px",
          borderBottom: "1px solid #1a1a3a",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "16px" }}>🌍</span>
        <span
          style={{ fontSize: "13px", fontWeight: 700, color: "#e6e6ff" }}
        >
          Biome Generator
        </span>
        <span
          style={{
            fontSize: "9px",
            padding: "2px 6px",
            borderRadius: "4px",
            background: "rgba(168,85,247,0.15)",
            color: "#a855f7",
            border: "1px solid rgba(168,85,247,0.3)",
            fontWeight: 600,
          }}
        >
          BETA
        </span>
      </div>

      {/* Biome Grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            fontSize: "10px",
            color: "#7070aa",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Select Biome
        </div>

        {BIOME_PRESETS.map((preset) => (
          <BiomeCard
            key={preset.id}
            preset={preset}
            selected={selectedBiome === preset.id}
            onSelect={() =>
              setSelectedBiome(selectedBiome === preset.id ? null : preset.id)
            }
          />
        ))}
      </div>

      {/* Bottom: Customization + Generate */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid #1a1a3a",
          padding: "10px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <input
          value={customization}
          onChange={(e) => setCustomization(e.target.value)}
          placeholder="Customize... (e.g. add a river, make it night)"
          disabled={!selectedBiome}
          style={{
            width: "100%",
            padding: "8px 10px",
            borderRadius: "6px",
            border: "1px solid #2a1a4a",
            background: "#100e2a",
            color: "#e6e6ff",
            fontSize: "11px",
            fontFamily: "inherit",
            outline: "none",
            opacity: selectedBiome ? 1 : 0.5,
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={!selectedBiome || generating}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            cursor: selectedBiome && !generating ? "pointer" : "not-allowed",
            background:
              selectedBiome && !generating
                ? preset?.color || "#a855f7"
                : "#1a1a3a",
            color: selectedBiome && !generating ? "#fff" : "#555",
            fontSize: "13px",
            fontWeight: 700,
            fontFamily: "inherit",
            transition: "all 0.15s",
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating
            ? "Generating biome..."
            : selectedBiome
            ? `Generate ${preset?.name || "Biome"}`
            : "Select a biome"}
        </button>
      </div>
    </div>
  );
}
