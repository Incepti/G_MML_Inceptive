import { parseMML, serializeMML } from "./parser";
import type { MMLNode } from "@/types/mml";
import { MML_ALLOWED_TAGS, MML_CAPS } from "@/types/mml";
import type { ValidationIssue } from "@/types/blueprint";

const ALLOWED_TAGS_SET = new Set<string>(MML_ALLOWED_TAGS);

const FORBIDDEN_ATTRS = new Set([
  "cast-shadows", "receive-shadows", "penumbra", "shadow",
  "align", "text", "onclick", "onmouseenter", "onmouseleave",
  "oncollisionstart", "oncollisionmove", "oncollisionend",
]);

const VALID_LIGHT_TYPES = new Set(["point", "directional", "spot"]);

const ANIM_ALLOWED_ATTRS = new Set([
  "attr", "start", "end", "duration", "loop", "easing", "ping-pong",
]);

const ANIM_REMAP: Record<string, string> = {
  "to": "end",
  "dur": "duration",
  "values": "end",
  "repeat": "loop",
};

/**
 * Validate and auto-fix MML Alpha compliance.
 * Returns the fixed MML string and a list of issues found.
 */
export function validateAndFixMml(
  mml: string,
  lastValidMml?: string
): {
  fixedMml: string;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  if (!mml || mml.trim().length === 0) {
    return {
      fixedMml: lastValidMml || "<m-group id=\"root\"></m-group>",
      issues: [{ severity: "error", message: "Empty MML input" }],
    };
  }

  let nodes: MMLNode[];
  try {
    const parsed = parseMML(mml);
    nodes = parsed.nodes;
  } catch (e) {
    issues.push({ severity: "error", message: `Parse failure: ${e}` });
    return {
      fixedMml: lastValidMml || mml,
      issues,
    };
  }

  // Fix nodes in place
  let lightCount = 0;
  const fixedNodes = nodes
    .map((node) => fixNode(node, null, issues, { lightCount: 0 }))
    .filter((n): n is MMLNode => n !== null);

  // Count lights in fixed tree
  lightCount = countLights(fixedNodes);
  if (lightCount > MML_CAPS.MAX_LIGHTS) {
    issues.push({
      severity: "warn",
      message: `Light count ${lightCount} exceeds cap ${MML_CAPS.MAX_LIGHTS}. Removing extras.`,
    });
    trimLights(fixedNodes, MML_CAPS.MAX_LIGHTS);
  }

  // Count models
  const modelCount = countModels(fixedNodes);
  if (modelCount > MML_CAPS.MAX_MODELS) {
    issues.push({
      severity: "warn",
      message: `Model count ${modelCount} exceeds cap ${MML_CAPS.MAX_MODELS}.`,
    });
  }

  // Ensure root m-group
  if (fixedNodes.length === 0) {
    return {
      fixedMml: "<m-group id=\"root\"></m-group>",
      issues: [...issues, { severity: "warn", message: "No valid nodes found, created empty root." }],
    };
  }

  if (fixedNodes.length === 1 && fixedNodes[0].tag === "m-group") {
    // Good — already wrapped
  } else if (fixedNodes.length > 1 || fixedNodes[0].tag !== "m-group") {
    // Wrap in root m-group
    const root: MMLNode = {
      tag: "m-group",
      attributes: { id: "root" },
      children: fixedNodes,
    };
    issues.push({ severity: "warn", message: "Wrapped in root <m-group>." });
    return { fixedMml: serializeMML([root]), issues };
  }

  return { fixedMml: serializeMML(fixedNodes), issues };
}

function fixNode(
  node: MMLNode,
  parent: MMLNode | null,
  issues: ValidationIssue[],
  counters: { lightCount: number }
): MMLNode | null {
  // Remove unsupported tags entirely
  if (!ALLOWED_TAGS_SET.has(node.tag)) {
    issues.push({
      severity: "error",
      message: `Removed unsupported tag <${node.tag}>`,
      nodeHint: node.attributes["id"],
    });
    return null;
  }

  const fixedAttrs: Record<string, string> = {};

  for (const [attr, value] of Object.entries(node.attributes)) {
    // Remove forbidden attributes
    if (FORBIDDEN_ATTRS.has(attr)) {
      issues.push({
        severity: "warn",
        message: `Removed forbidden attribute '${attr}' from <${node.tag}>`,
        nodeHint: node.attributes["id"],
      });
      continue;
    }

    // m-label: text= → content=
    if (node.tag === "m-label" && attr === "text") {
      issues.push({
        severity: "warn",
        message: `Renamed 'text' to 'content' on <m-label>`,
        nodeHint: node.attributes["id"],
      });
      fixedAttrs["content"] = value;
      continue;
    }

    // m-attr-anim: remap bad attrs
    if (node.tag === "m-attr-anim") {
      if (ANIM_REMAP[attr]) {
        issues.push({
          severity: "warn",
          message: `Renamed '${attr}' to '${ANIM_REMAP[attr]}' on <m-attr-anim>`,
        });
        fixedAttrs[ANIM_REMAP[attr]] = value;
        continue;
      }
      if (!ANIM_ALLOWED_ATTRS.has(attr)) {
        issues.push({
          severity: "warn",
          message: `Removed unknown attribute '${attr}' from <m-attr-anim>`,
        });
        continue;
      }
    }

    fixedAttrs[attr] = value;
  }

  // m-attr-anim: ensure start default
  if (node.tag === "m-attr-anim" && !fixedAttrs["start"]) {
    fixedAttrs["start"] = "0";
  }

  // m-light: validate type
  if (node.tag === "m-light") {
    if (!fixedAttrs["type"] || !VALID_LIGHT_TYPES.has(fixedAttrs["type"])) {
      issues.push({
        severity: "warn",
        message: `Fixed invalid m-light type '${fixedAttrs["type"] || "missing"}' → 'point'`,
      });
      fixedAttrs["type"] = "point";
    }
  }

  // Recurse children
  const fixedChildren = node.children
    .map((child) => fixNode(child, node, issues, counters))
    .filter((n): n is MMLNode => n !== null);

  return {
    tag: node.tag,
    attributes: fixedAttrs,
    children: fixedChildren,
    line: node.line,
    column: node.column,
  };
}

function countLights(nodes: MMLNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.tag === "m-light") count++;
    count += countLights(node.children);
  }
  return count;
}

function countModels(nodes: MMLNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.tag === "m-model" || node.tag === "m-character") count++;
    count += countModels(node.children);
  }
  return count;
}

function trimLights(nodes: MMLNode[], max: number): void {
  let remaining = max;

  function trim(nodeList: MMLNode[]): void {
    for (let i = nodeList.length - 1; i >= 0; i--) {
      const node = nodeList[i];
      if (node.tag === "m-light") {
        if (remaining <= 0) {
          nodeList.splice(i, 1);
        } else {
          remaining--;
        }
      } else {
        trim(node.children);
      }
    }
  }

  // Count from front, remove from back
  remaining = max;
  function countAndTrim(nodeList: MMLNode[]): void {
    for (let i = 0; i < nodeList.length; i++) {
      const node = nodeList[i];
      if (node.tag === "m-light") {
        if (remaining > 0) {
          remaining--;
        } else {
          nodeList.splice(i, 1);
          i--;
        }
      } else {
        countAndTrim(node.children);
      }
    }
  }

  countAndTrim(nodes);
}
