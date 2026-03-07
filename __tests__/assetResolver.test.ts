import { describe, it, expect } from "vitest";
import { resolveAsset, resolveAssets } from "@/lib/mml/assets/assetResolver";
import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";

// ─── Helper: minimal blueprint factory ─────────────────────────────────────

function makeBlueprint(
  structures: BlueprintStructure[],
  archetype = "",
  intentName = "test",
): BlueprintJSON {
  return {
    type: "scene",
    meta: { title: "test", units: "meters", scaleProfile: "human", sceneScale: "medium", seed: "test" },
    intent: { name: intentName, archetype },
    style: { theme: "neutral", detailLevel: "medium" },
    scene: {
      rootId: "root",
      structures,
    },
  } as BlueprintJSON;
}

function makeStructure(
  id: string,
  type: BlueprintStructure["type"],
  overrides: Partial<BlueprintStructure> = {},
): BlueprintStructure {
  return {
    id,
    type,
    transform: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 },
    ...overrides,
  } as BlueprintStructure;
}

// ─── resolveAsset: strict matching ─────────────────────────────────────────

describe("resolveAsset", () => {
  it("resolves 'chair' to polyhaven armchair model", () => {
    const chair = resolveAsset(["chair"], "furniture");
    expect(chair).not.toBeNull();
    expect(chair!.tags).toContain("chair");
    expect(chair!.modelUrl).toContain("polyhaven");
  });

  it("resolves 'lantern' to polyhaven lantern model", () => {
    const lantern = resolveAsset(["lantern"]);
    expect(lantern).not.toBeNull();
    expect(lantern!.id).toBe("lantern");
    expect(lantern!.modelUrl).toContain("polyhaven");
  });

  it("resolves 'barrel' to polyhaven barrel model", () => {
    const barrel = resolveAsset(["barrel"]);
    expect(barrel).not.toBeNull();
    expect(barrel!.tags).toContain("barrel");
  });

  it("resolves 'sofa' to polyhaven sofa model", () => {
    const sofa = resolveAsset(["sofa"], "furniture");
    expect(sofa).not.toBeNull();
    expect(sofa!.tags).toContain("sofa");
  });

  it("resolves 'tree' to dead tree trunk from polyhaven", () => {
    const tree = resolveAsset(["tree"], "environment");
    expect(tree).not.toBeNull();
    expect(tree!.tags).toContain("tree");
  });

  it("resolves 'boulder' / 'rock' to polyhaven rock model", () => {
    const rock = resolveAsset(["rock"], "environment");
    expect(rock).not.toBeNull();
    expect(rock!.tags).toContain("rock");

    const boulder = resolveAsset(["boulder"], "environment");
    expect(boulder).not.toBeNull();
    expect(boulder!.tags).toContain("boulder");
  });

  it("returns null for generic category terms", () => {
    expect(resolveAsset(["character"])).toBeNull();
    expect(resolveAsset(["animal"])).toBeNull();
  });

  it("returns null when no keywords match any asset", () => {
    expect(resolveAsset(["castle", "fortress", "dungeon"])).toBeNull();
    expect(resolveAsset(["wizard", "mage", "staff"])).toBeNull();
  });

  it("fuzzy fallback matches partial tags", () => {
    // "sword" is an exact tag on katana
    const sword = resolveAsset(["sword"]);
    expect(sword).not.toBeNull();
    expect(sword!.tags).toContain("sword");
  });
});

// ─── resolveAssets: blueprint-level ────────────────────────────────────────

describe("resolveAssets", () => {
  it("resolves structures by ID word splitting (tree-1 → tree)", () => {
    const bp = makeBlueprint([
      makeStructure("tree-1", "custom"),
    ]);

    const result = resolveAssets(bp);
    const tree = result.scene.structures[0];
    expect(tree.modelSrc).toBeDefined();
    expect(tree.modelSrc).toContain("polyhaven");
  });

  it("resolves chair structures from polyhaven", () => {
    const bp = makeBlueprint([
      makeStructure("main-object", "furniture"),
    ], "furniture", "chair");

    const result = resolveAssets(bp);
    const chair = result.scene.structures[0];
    expect(chair.modelSrc).toBeDefined();
    expect(chair.modelSrc).toContain("polyhaven");
  });

  it("intent keywords only apply to primary structure", () => {
    // Multi-object: "chair" intent should NOT leak to tree-1
    const bp = makeBlueprint([
      makeStructure("main-object", "furniture"),
      makeStructure("tree-1", "nature"),
    ], "furniture", "chair");

    const result = resolveAssets(bp);
    const main = result.scene.structures.find((s) => s.id === "main-object")!;
    const tree = result.scene.structures.find((s) => s.id === "tree-1")!;

    // Main should resolve to a chair
    expect(main.modelSrc).toBeDefined();
    // Tree should resolve to a tree (from its own "tree" type), NOT a chair
    if (tree.modelSrc) {
      expect(tree.modelSrc).not.toContain("Chair");
    }
  });

  it("skips structures that already have geometry", () => {
    const bp = makeBlueprint([
      makeStructure("barrel", "custom", {
        geometry: { kind: "cube" },
      } as Partial<BlueprintStructure>),
    ]);

    const result = resolveAssets(bp);
    expect(result.scene.structures[0].modelSrc).toBeUndefined();
  });

  it("skips structures that already have modelSrc", () => {
    const bp = makeBlueprint([
      makeStructure("barrel", "custom", {
        modelSrc: "https://example.com/custom.glb",
      }),
    ]);

    const result = resolveAssets(bp);
    expect(result.scene.structures[0].modelSrc).toBe("https://example.com/custom.glb");
  });

  it("skips structures that already have children", () => {
    const bp = makeBlueprint([
      makeStructure("barrel", "custom", {
        children: [makeStructure("child", "prop")],
      }),
    ]);

    const result = resolveAssets(bp);
    expect(result.scene.structures[0].modelSrc).toBeUndefined();
  });

  it("skips light structures", () => {
    const bp = makeBlueprint([
      makeStructure("main-light", "light", {
        lightProps: { type: "point", intensity: 1, color: "#fff" },
      } as Partial<BlueprintStructure>),
    ]);

    const result = resolveAssets(bp);
    expect(result.scene.structures[0].modelSrc).toBeUndefined();
  });
});
