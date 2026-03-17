"use client";

import React, { useCallback, useRef } from "react";

interface ResizeHandleProps {
  direction: "vertical" | "horizontal";
  onResize: (delta: number) => void;
}

export function ResizeHandle({ direction, onResize }: ResizeHandleProps) {
  const isDragging = useRef(false);
  const startPos = useRef(0);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize; // always fresh without re-subscribing

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startPos.current = direction === "vertical" ? e.clientX : e.clientY;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const current = direction === "vertical" ? ev.clientX : ev.clientY;
        const delta = current - startPos.current;
        startPos.current = current;
        onResizeRef.current(delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = direction === "vertical" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction]
  );

  const isVertical = direction === "vertical";

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        flexShrink: 0,
        position: "relative",
        zIndex: 10,
        // Visible bar
        ...(isVertical
          ? { width: "5px", cursor: "col-resize" }
          : { height: "5px", cursor: "row-resize" }),
        background: "#1a2240",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#3a4a7a"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#1a2240"; }}
    >
      {/* Wide invisible hit area — 12px centred on the 5px bar */}
      <div
        style={{
          position: "absolute",
          ...(isVertical
            ? { top: 0, bottom: 0, left: "-4px", right: "-4px" }
            : { left: 0, right: 0, top: "-4px", bottom: "-4px" }),
          cursor: isVertical ? "col-resize" : "row-resize",
        }}
      />
      {/* Centre grip dots */}
      <div style={{
        position: "absolute",
        ...(isVertical
          ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", gap: "3px" }
          : { left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "row", gap: "3px" }),
        pointerEvents: "none",
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: "3px", height: "3px", borderRadius: "50%",
            background: "rgba(120,140,200,0.4)",
          }} />
        ))}
      </div>
    </div>
  );
}
