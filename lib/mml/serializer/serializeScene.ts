/**
 * Scene-level MML serialization.
 *
 * Pure deterministic function: BlueprintJSON → MML string.
 * Handles zone grouping, pathway rendering, and ground plane.
 * Delegates individual structure rendering to serializeStructure.
 *
 * Same input → same output, always.
 */

import type { BlueprintJSON, BlueprintStructure, Zone } from "@/types/blueprint";
import { ZONE_ORDER } from "@/lib/layout/zones";
import { renderStructure, esc, n } from "./serializeStructure";

export function serializeScene(blueprint: BlueprintJSON): string {
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

  // Group structures by zone (if zones are used)
  const zoned = new Map<Zone, BlueprintStructure[]>();
  const unzoned: BlueprintStructure[] = [];

  for (const structure of blueprint.scene.structures) {
    if (structure.zone) {
      const list = zoned.get(structure.zone as Zone) || [];
      list.push(structure);
      zoned.set(structure.zone as Zone, list);
    } else {
      unzoned.push(structure);
    }
  }

  // Render zoned structures in deterministic order
  for (const zoneName of ZONE_ORDER) {
    const structures = zoned.get(zoneName);
    if (!structures || structures.length === 0) continue;
    lines.push(`  <m-group id="zone-${zoneName.toLowerCase()}">`);
    for (const structure of structures) {
      renderStructure(structure, 2, lines);
    }
    lines.push(`  </m-group>`);
  }

  // Render unzoned structures at top level
  for (const structure of unzoned) {
    renderStructure(structure, 1, lines);
  }

  // Render pathways as connecting ground planes
  if (blueprint.scene.pathways) {
    const structureMap = new Map(blueprint.scene.structures.map((s) => [s.id, s]));
    for (const pathway of blueprint.scene.pathways) {
      const fromS = structureMap.get(pathway.from);
      const toS = structureMap.get(pathway.to);
      if (!fromS || !toS) continue;

      const dx = toS.transform.x - fromS.transform.x;
      const dz = toS.transform.z - fromS.transform.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      if (length < 0.1) continue;
      const midX = (fromS.transform.x + toS.transform.x) / 2;
      const midZ = (fromS.transform.z + toS.transform.z) / 2;
      const angle = Math.atan2(dx, dz) * (180 / Math.PI);
      const color = pathway.material?.color || "#5C5C5C";
      const width = pathway.width || 2;

      lines.push(
        `  <m-plane id="path-${esc(pathway.from)}-to-${esc(pathway.to)}" ` +
        `width="${n(width)}" height="${n(length)}" ` +
        `x="${n(midX)}" y="0.02" z="${n(midZ)}" ` +
        `rx="-90" ry="${n(angle)}" color="${esc(color)}"></m-plane>`
      );
    }
  }

  lines.push(`</m-group>`);
  return lines.join("\n");
}
