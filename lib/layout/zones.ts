import type { Zone, SceneScale } from "@/types/blueprint";

/** Scene dimensions in meters per scale profile */
export const SCALE_DIMENSIONS: Record<SceneScale, { width: number; depth: number }> = {
  small:  { width: 40, depth: 40 },
  medium: { width: 80, depth: 80 },
  large:  { width: 150, depth: 150 },
};

/** Zone center offsets as fractions of half-extents */
const ZONE_OFFSETS: Record<Zone, { xFrac: number; zFrac: number }> = {
  NW: { xFrac: -0.66, zFrac: -0.66 },
  N:  { xFrac:  0.0,  zFrac: -0.66 },
  NE: { xFrac:  0.66, zFrac: -0.66 },
  W:  { xFrac: -0.66, zFrac:  0.0  },
  C:  { xFrac:  0.0,  zFrac:  0.0  },
  E:  { xFrac:  0.66, zFrac:  0.0  },
  SW: { xFrac: -0.66, zFrac:  0.66 },
  S:  { xFrac:  0.0,  zFrac:  0.66 },
  SE: { xFrac:  0.66, zFrac:  0.66 },
};

/** Deterministic zone rendering order */
export const ZONE_ORDER: Zone[] = ["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"];

/** Get the center coordinate of a zone for a given scene scale */
export function getZoneCenter(zone: Zone, sceneScale: SceneScale): { x: number; z: number } {
  const dim = SCALE_DIMENSIONS[sceneScale];
  const off = ZONE_OFFSETS[zone];
  return {
    x: Math.round(off.xFrac * dim.width / 2),
    z: Math.round(off.zFrac * dim.depth / 2),
  };
}

/** Get the bounding box for a zone */
export function getZoneBounds(zone: Zone, sceneScale: SceneScale): {
  minX: number; maxX: number; minZ: number; maxZ: number;
} {
  const center = getZoneCenter(zone, sceneScale);
  const dim = SCALE_DIMENSIONS[sceneScale];
  const cellW = dim.width / 3;
  const cellD = dim.depth / 3;
  return {
    minX: center.x - cellW / 2,
    maxX: center.x + cellW / 2,
    minZ: center.z - cellD / 2,
    maxZ: center.z + cellD / 2,
  };
}

/** Infer which zone a coordinate falls into */
export function inferZone(x: number, z: number, sceneScale: SceneScale): Zone {
  const dim = SCALE_DIMENSIONS[sceneScale];
  const thirdW = dim.width / 3;
  const thirdD = dim.depth / 3;
  const halfW = dim.width / 2;
  const halfD = dim.depth / 2;

  const col = x < -halfW + thirdW ? "W" : x > halfW - thirdW ? "E" : "";
  const row = z < -halfD + thirdD ? "N" : z > halfD - thirdD ? "S" : "";

  return (row + col || "C") as Zone;
}
