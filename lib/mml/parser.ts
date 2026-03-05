import { parse, DefaultTreeAdapterMap } from "parse5";
import type { MMLNode, MMLTag, ParsedMML } from "@/types/mml";
import { MML_ALLOWED_TAGS } from "@/types/mml";

type P5Node = DefaultTreeAdapterMap["childNode"];
type P5Element = DefaultTreeAdapterMap["element"];

function isElement(node: P5Node): node is P5Element {
  return node.nodeName !== "#text" && node.nodeName !== "#comment";
}

function extractMMLNodes(node: P5Node, depth = 0): MMLNode[] {
  if (!isElement(node)) return [];

  const tag = node.nodeName.toLowerCase();
  const isMMLTag = (MML_ALLOWED_TAGS as readonly string[]).includes(tag);

  if (isMMLTag) {
    const attrs: Record<string, string> = {};
    for (const attr of node.attrs) {
      attrs[attr.name] = attr.value;
    }

    const children: MMLNode[] = [];
    if ("childNodes" in node) {
      for (const child of node.childNodes) {
        children.push(...extractMMLNodes(child as P5Node, depth + 1));
      }
    }

    const mmlNode: MMLNode = {
      tag: tag as MMLTag,
      attributes: attrs,
      children,
      line: (node.sourceCodeLocation as { startLine?: number } | undefined)
        ?.startLine,
      column: (node.sourceCodeLocation as { startCol?: number } | undefined)
        ?.startCol,
    };
    return [mmlNode];
  }

  // Descend into non-MML nodes (html, body, div wrappers, etc.)
  const results: MMLNode[] = [];
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      results.push(...extractMMLNodes(child as P5Node, depth + 1));
    }
  }
  return results;
}

export function parseMML(html: string): ParsedMML {
  const document = parse(html, {
    sourceCodeLocationInfo: true,
  } as Parameters<typeof parse>[1]) as any;

  const nodes: MMLNode[] = [];

  for (const child of document.childNodes) {
    nodes.push(...extractMMLNodes(child as P5Node));
  }

  return { nodes, raw: html };
}

export function serializeMMLNode(node: MMLNode, indent = 0): string {
  const pad = "  ".repeat(indent);
  const attrs = Object.entries(node.attributes)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");

  const attrStr = attrs ? ` ${attrs}` : "";

  if (node.children.length === 0) {
    return `${pad}<${node.tag}${attrStr}></${node.tag}>`;
  }

  const childrenStr = node.children
    .map((c) => serializeMMLNode(c, indent + 1))
    .join("\n");
  return `${pad}<${node.tag}${attrStr}>\n${childrenStr}\n${pad}</${node.tag}>`;
}

export function serializeMML(nodes: MMLNode[]): string {
  return nodes.map((n) => serializeMMLNode(n, 0)).join("\n");
}
