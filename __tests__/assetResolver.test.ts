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

// ─── resolveAsset: GCS bucket matching ──────────────────────────────────────

describe("resolveAsset", () => {
  it("resolves 'chair' to a GCS furniture model", () => {
    const chair = resolveAsset(["chair"], "furniture");
    expect(chair).not.toBeNull();
    expect(chair!.modelUrl).toContain("3dmodels_mml");
    expect(chair!.modelUrl).toContain(".glb");
  });

  it("resolves 'tree' to a GCS environment model", () => {
    const tree = resolveAsset(["tree"], "environment");
    expect(tree).not.toBeNull();
    expect(tree!.modelUrl).toContain("3dmodels_mml");
  });

  it("resolves 'car' to a GCS vehicle model", () => {
    const car = resolveAsset(["car"], "vehicle");
    expect(car).not.toBeNull();
    expect(car!.category).toBe("vehicle");
  });

  it("resolves 'barrel' to a GCS prop model", () => {
    const barrel = resolveAsset(["barrel"]);
    expect(barrel).not.toBeNull();
    expect(barrel!.tags).toContain("barrel");
  });

  it("resolves 'fox' to a GCS character model", () => {
    const fox = resolveAsset(["fox"], "character");
    expect(fox).not.toBeNull();
    expect(fox!.category).toBe("character");
  });

  it("resolves 'sofa' to a GCS furniture model", () => {
    const sofa = resolveAsset(["sofa"], "furniture");
    expect(sofa).not.toBeNull();
    expect(sofa!.tags).toContain("sofa");
  });

  it("returns null for generic category terms", () => {
    expect(resolveAsset(["character"])).toBeNull();
    expect(resolveAsset(["animal"])).toBeNull();
  });

  it("falls back to category when no keyword match", () => {
    const result = resolveAsset(["wizard"], "character");
    expect(result).not.toBeNull();
    expect(result!.category).toBe("character");
  });

  it("fuzzy matches partial tags", () => {
    const result = resolveAsset(["sword"]);
    expect(result).not.toBeNull();
  });

  it("all model URLs point to GCS bucket", () => {
    const models = [
      resolveAsset(["chair"], "furniture"),
      resolveAsset(["tree"], "environment"),
      resolveAsset(["car"], "vehicle"),
      resolveAsset(["horse"], "character"),
    ];
    for (const m of models) {
      expect(m).not.toBeNull();
      expect(m!.modelUrl).toMatch(/storage\.googleapis\.com\/3dmodels_mml/);
    }
  });
});

// ─── resolveAssets: blueprint-level ────────────────────────────────────────

describe("resolveAssets", () => {
  it("resolves structures by ID word splitting (tree-1 -> tree)", () => {
    const bp = makeBlueprint([makeStructure("tree-1", "custom")]);
    const result = resolveAssets(bp);
    const tree = result.scene.structures[0];
    expect(tree.modelSrc).toBeDefined();
    expect(tree.modelSrc).toContain("3dmodels_mml");
  });

  it("resolves chair structures from GCS", () => {
    const bp = makeBlueprint(
      [makeStructure("main-object", "furniture")],
      "furniture",
      "chair",
    );
    const result = resolveAssets(bp);
    expect(result.scene.structures[0].modelSrc).toBeDefined();
    expect(result.scene.structures[0].modelSrc).toContain("3dmodels_mml");
  });

  it("intent keywords only apply to primary structure", () => {
    const bp = makeBlueprint(
      [
        makeStructure("main-object", "furniture"),
        makeStructure("tree-1", "nature"),
      ],
      "furniture",
      "chair",
    );
    const result = resolveAssets(bp);
    const main = result.scene.structures.find((s) => s.id === "main-object")!;
    const tree = result.scene.structures.find((s) => s.id === "tree-1")!;

    expect(main.modelSrc).toBeDefined();
    if (tree.modelSrc) {
      expect(tree.modelSrc).not.toMatch(/chair/i);
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
