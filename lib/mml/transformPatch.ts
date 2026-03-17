/**
 * Shared MML transform utilities — used by both the viewport gizmo and the
 * inspector panel so they stay in sync without code duplication.
 */

export interface Transform9 {
  x: number; y: number; z: number;
  rx: number; ry: number; rz: number;
  sx: number; sy: number; sz: number;
}

/**
 * Patch the transform attributes of one tagged element inside MML text.
 * Finds the element by its id attribute, strips existing position/rotation/scale
 * attrs, and writes back only non-default values.
 * Returns the original string unchanged if the id is not found.
 */
export function patchMmlTransform(mml: string, id: string, t: Transform9): string {
  const idStr = `id="${id}"`;
  const pos = mml.indexOf(idStr);
  if (pos === -1) return mml;

  let start = pos;
  while (start > 0 && mml[start] !== "<") start--;

  let end = pos;
  while (end < mml.length && mml[end] !== ">") end++;

  let tag = mml.slice(start, end + 1);

  for (const attr of ["x", "y", "z", "rx", "ry", "rz", "sx", "sy", "sz"]) {
    tag = tag.replace(new RegExp(`\\s+${attr}="[^"]*"`, "g"), "");
  }

  let ins = "";
  if (t.x !== 0)                       ins += ` x="${+t.x.toFixed(3)}"`;
  if (t.y !== 0)                       ins += ` y="${+t.y.toFixed(3)}"`;
  if (t.z !== 0)                       ins += ` z="${+t.z.toFixed(3)}"`;
  if (t.rx !== 0)                      ins += ` rx="${+t.rx.toFixed(1)}"`;
  if (t.ry !== 0)                      ins += ` ry="${+t.ry.toFixed(1)}"`;
  if (t.rz !== 0)                      ins += ` rz="${+t.rz.toFixed(1)}"`;
  if (Math.abs(t.sx - 1) > 0.0001)    ins += ` sx="${+t.sx.toFixed(4)}"`;
  if (Math.abs(t.sy - 1) > 0.0001)    ins += ` sy="${+t.sy.toFixed(4)}"`;
  if (Math.abs(t.sz - 1) > 0.0001)    ins += ` sz="${+t.sz.toFixed(4)}"`;

  const patched = tag.slice(0, -1) + ins + ">";
  return mml.slice(0, start) + patched + mml.slice(end + 1);
}

/**
 * Read the current transform of an element in MML text by id.
 * Returns null if the element is not found.
 */
export function getMmlElementTransform(mml: string, id: string): Transform9 | null {
  const idStr = `id="${id}"`;
  const pos = mml.indexOf(idStr);
  if (pos === -1) return null;

  let start = pos;
  while (start > 0 && mml[start] !== "<") start--;

  let end = pos;
  while (end < mml.length && mml[end] !== ">") end++;

  const tag = mml.slice(start, end + 1);

  const getAttr = (name: string, def = 0): number => {
    const m = tag.match(new RegExp(`\\b${name}="([^"]+)"`));
    if (!m) return def;
    const v = parseFloat(m[1]);
    return isNaN(v) ? def : v;
  };

  return {
    x:  getAttr("x"),
    y:  getAttr("y"),
    z:  getAttr("z"),
    rx: getAttr("rx"),
    ry: getAttr("ry"),
    rz: getAttr("rz"),
    sx: getAttr("sx", 1),
    sy: getAttr("sy", 1),
    sz: getAttr("sz", 1),
  };
}

/**
 * Read the src attribute of an element in MML text by id.
 * Returns empty string if not found.
 */
export function getMmlElementSrc(mml: string, id: string): string {
  const idStr = `id="${id}"`;
  const pos = mml.indexOf(idStr);
  if (pos === -1) return "";

  let start = pos;
  while (start > 0 && mml[start] !== "<") start--;

  let end = pos;
  while (end < mml.length && mml[end] !== ">") end++;

  const tag = mml.slice(start, end + 1);
  const m = tag.match(/\bsrc="([^"]+)"/);
  return m ? m[1] : "";
}

/**
 * Read the tag name (e.g. "m-model", "m-cube") of an element in MML by id.
 */
export function getMmlElementTag(mml: string, id: string): string {
  const idStr = `id="${id}"`;
  const pos = mml.indexOf(idStr);
  if (pos === -1) return "";

  let start = pos;
  while (start > 0 && mml[start] !== "<") start--;

  const after = mml.slice(start + 1);
  const m = after.match(/^(m-\w+)/);
  return m ? m[1] : "";
}
