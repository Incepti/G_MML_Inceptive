import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";

/**
 * Deterministic pure function: BlueprintJSON → MML string.
 * Same blueprint always produces identical MML output.
 */
export function generateMml(blueprint: BlueprintJSON): string {
  const lines: string[] = [];
  const rootId = blueprint.scene.rootId || "root";

  lines.push(`<m-group id="${esc(rootId)}">`);

  // Ground plane (only if explicitly specified)
  if (blueprint.scene.ground) {
    const g = blueprint.scene.ground;
    lines.push(
      `  <m-plane id="ground" width="${n(g.width)}" height="${n(g.height)}" color="${esc(g.color)}" y="${n(g.y)}" rx="-90"></m-plane>`
    );
  }

  // Structures in order
  for (const structure of blueprint.scene.structures) {
    renderStructure(structure, 1, lines);
  }

  lines.push(`</m-group>`);
  return lines.join("\n");
}

function renderStructure(
  s: BlueprintStructure,
  indent: number,
  lines: string[]
): void {
  const pad = "  ".repeat(indent);

  // Light structures get rendered as m-light
  if (s.type === "light" && s.lightProps) {
    const lp = s.lightProps;
    const t = s.transform;
    const attrs = [
      `id="${esc(s.id)}"`,
      `type="${esc(lp.type)}"`,
      `color="${esc(lp.color)}"`,
      `intensity="${n(lp.intensity)}"`,
      ...posAttrs(t),
    ];
    if (lp.distance != null) attrs.push(`distance="${n(lp.distance)}"`);
    if (lp.angle != null) attrs.push(`angle="${n(lp.angle)}"`);
    lines.push(`${pad}<m-light ${attrs.join(" ")}></m-light>`);
    return;
  }

  // Model reference
  if (s.modelSrc) {
    const t = s.transform;
    const attrs = [
      `id="${esc(s.id)}"`,
      `src="${esc(s.modelSrc)}"`,
      ...transformAttrs(t),
    ];
    lines.push(`${pad}<m-model ${attrs.join(" ")}></m-model>`);
    return;
  }

  // Label
  if (s.label && !s.geometry) {
    const t = s.transform;
    const attrs = [
      `id="${esc(s.id)}"`,
      `content="${esc(s.label)}"`,
      ...posAttrs(t),
    ];
    if (s.material?.color) attrs.push(`color="${esc(s.material.color)}"`);
    lines.push(`${pad}<m-label ${attrs.join(" ")}></m-label>`);
    return;
  }

  // Geometry primitive or group
  const hasChildren = s.children && s.children.length > 0;
  const hasGeometry = !!s.geometry;

  if (hasGeometry && !hasChildren) {
    // Single primitive
    lines.push(`${pad}${renderPrimitive(s)}`);
    return;
  }

  if (hasGeometry && hasChildren) {
    // Group with own geometry + children
    const t = s.transform;
    lines.push(`${pad}<m-group id="${esc(s.id)}" ${transformAttrs(t).join(" ")}>`);
    // Render own geometry as a child with no transform offset
    const selfGeo = { ...s, id: `${s.id}-body`, children: undefined, transform: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 } } as BlueprintStructure;
    lines.push(`${pad}  ${renderPrimitive(selfGeo)}`);
    for (const child of s.children!) {
      renderStructure(child, indent + 1, lines);
    }
    lines.push(`${pad}</m-group>`);
    return;
  }

  // Group container (no own geometry, just children)
  if (hasChildren) {
    const t = s.transform;
    lines.push(`${pad}<m-group id="${esc(s.id)}" ${transformAttrs(t).join(" ")}>`);
    for (const child of s.children!) {
      renderStructure(child, indent + 1, lines);
    }
    lines.push(`${pad}</m-group>`);
    return;
  }

  // Fallback: empty group
  const t = s.transform;
  lines.push(`${pad}<m-group id="${esc(s.id)}" ${transformAttrs(t).join(" ")}></m-group>`);
}

function renderPrimitive(s: BlueprintStructure): string {
  if (!s.geometry) return `<m-group id="${esc(s.id)}"></m-group>`;

  const g = s.geometry;
  const m = s.material;
  const t = s.transform;
  const tag = kindToTag(g.kind);

  const attrs: string[] = [`id="${esc(s.id)}"`, ...transformAttrs(t)];

  // Geometry attributes
  if (g.kind === "cube") {
    if (g.width != null) attrs.push(`width="${n(g.width)}"`);
    if (g.height != null) attrs.push(`height="${n(g.height)}"`);
    if (g.depth != null) attrs.push(`depth="${n(g.depth)}"`);
  } else if (g.kind === "cylinder") {
    if (g.radius != null) attrs.push(`radius="${n(g.radius)}"`);
    if (g.height != null) attrs.push(`height="${n(g.height)}"`);
  } else if (g.kind === "sphere") {
    if (g.radius != null) attrs.push(`radius="${n(g.radius)}"`);
  } else if (g.kind === "plane") {
    if (g.width != null) attrs.push(`width="${n(g.width)}"`);
    if (g.height != null) attrs.push(`height="${n(g.height)}"`);
  }

  // Material attributes
  if (m) {
    attrs.push(`color="${esc(m.color)}"`);
    if (m.opacity != null) attrs.push(`opacity="${n(m.opacity)}"`);
    if (m.metalness != null) attrs.push(`metalness="${n(m.metalness)}"`);
    if (m.roughness != null) attrs.push(`roughness="${n(m.roughness)}"`);
    if (m.emissive) attrs.push(`emissive="${esc(m.emissive)}"`);
    if (m.emissiveIntensity != null) attrs.push(`emissive-intensity="${n(m.emissiveIntensity)}"`);
  }

  return `<${tag} ${attrs.join(" ")}></${tag}>`;
}

function kindToTag(kind: string): string {
  switch (kind) {
    case "cube": return "m-cube";
    case "cylinder": return "m-cylinder";
    case "sphere": return "m-sphere";
    case "plane": return "m-plane";
    default: return "m-cube";
  }
}

function transformAttrs(t: BlueprintStructure["transform"]): string[] {
  const attrs: string[] = [];
  if (t.x !== 0) attrs.push(`x="${n(t.x)}"`);
  if (t.y !== 0) attrs.push(`y="${n(t.y)}"`);
  if (t.z !== 0) attrs.push(`z="${n(t.z)}"`);
  if (t.rx !== 0) attrs.push(`rx="${n(t.rx)}"`);
  if (t.ry !== 0) attrs.push(`ry="${n(t.ry)}"`);
  if (t.rz !== 0) attrs.push(`rz="${n(t.rz)}"`);
  if (t.sx !== 1) attrs.push(`sx="${n(t.sx)}"`);
  if (t.sy !== 1) attrs.push(`sy="${n(t.sy)}"`);
  if (t.sz !== 1) attrs.push(`sz="${n(t.sz)}"`);
  return attrs;
}

function posAttrs(t: BlueprintStructure["transform"]): string[] {
  const attrs: string[] = [];
  if (t.x !== 0) attrs.push(`x="${n(t.x)}"`);
  if (t.y !== 0) attrs.push(`y="${n(t.y)}"`);
  if (t.z !== 0) attrs.push(`z="${n(t.z)}"`);
  return attrs;
}

/** Stringify number, stripping trailing zeros */
function n(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

/** Escape HTML attribute values */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
