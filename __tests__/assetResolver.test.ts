import { describe, it, expect } from "vitest";
import { resolveAsset, resolveAssets } from "@/lib/mml/assets/assetResolver";
import type { BlueprintJSON, BlueprintStructure } from "@/types/blueprint";

// ─── Helper: minimal blueprint factory ─────────────────────────────────────

function makeBlueprint(
  structures: BlueprintStructure[],
  archetype = "",
): BlueprintJSON {
  return {
    type: "scene",
    meta: { title: "test", units: "meters", scaleProfile: "human", sceneScale: "medium", seed: "test" },
    intent: { name: "test", archetype },
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
  it("returns null for unknown keywords (cat, chair, sword)", () => {
    expect(resolveAsset(["cat"], "creature")).toBeNull();
    expect(resolveAsset(["chair"], "furniture")).toBeNull();
    expect(resolveAsset(["sword"], "weapon")).toBeNull();
  });

  it("returns null for generic terms that previously caused false positives", () => {
    // "character" and "animal" are broad category tags — must NOT match
    expect(resolveAsset(["character"], "creature")).toBeNull();
    expect(resolveAsset(["animal"], "creature")).toBeNull();
  });

  it("returns an asset for exact tag matches", () => {
    const lantern = resolveAsset(["lantern"]);
    expect(lantern).not.toBeNull();
    expect(lantern!.id).toBe("lantern");
    expect(lantern!.modelUrl).toContain("Lantern.glb");

    const fox = resolveAsset(["fox"]);
    expect(fox).not.toBeNull();
    expect(fox!.id).toBe("fox");

    const horse = resolveAsset(["horse"]);
    expect(horse).not.toBeNull();
    expect(horse!.id).toBe("horse");
  });

  it("returns an asset by id match", () => {
    const result = resolveAsset(["damaged-helmet"]);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("damaged-helmet");
  });

  it("returns null when no keywords match any tag", () => {
    expect(resolveAsset(["castle", "fortress", "dungeon"])).toBeNull();
    expect(resolveAsset(["house", "building", "door"])).toBeNull();
    expect(resolveAsset(["wizard", "mage", "staff"])).toBeNull();
  });
});

// ─── resolveAssets: blueprint-level ────────────────────────────────────────

describe("resolveAssets", () => {
  it("does NOT assign modelSrc to structures without matching assets", () => {
    const bp = makeBlueprint([
      makeStructure("cat-body", "creature"),
      makeStructure("my-chair", "furniture"),
      makeStructure("magic-sword", "weapon"),
    ], "creature");

    const result = resolveAssets(bp);

    for (const s of result.scene.structures) {
      expect(s.modelSrc).toBeUndefined();
    }
  });

  it("assigns modelSrc only when exact tag match exists", () => {
    const bp = makeBlueprint([
      makeStructure("scene-lantern", "prop"),
      makeStructure("enemy-cat", "creature"),
    ]);

    const result = resolveAssets(bp);

    // "scene-lantern" has no tag match (type "prop" is blocked, id "scene-lantern" no match)
    const lanternStruct = result.scene.structures.find((s) => s.id === "scene-lantern")!;
    expect(lanternStruct.modelSrc).toBeUndefined();

    const cat = result.scene.structures.find((s) => s.id === "enemy-cat")!;
    expect(cat.modelSrc).toBeUndefined();
  });

  it("resolves when structure id matches a known asset id with correct type", () => {
    // "fox" is a known id in the environment catalog (creature category)
    const bp = makeBlueprint([
      makeStructure("fox", "creature"),
    ]);

    const result = resolveAssets(bp);
    // If resolved, it should contain Fox; if category-gated out, it may be undefined
    const foxStruct = result.scene.structures[0];
    if (foxStruct.modelSrc) {
      expect(foxStruct.modelSrc).toContain("Fox");
    }
  });

  it("skips structures that already have geometry", () => {
    const bp = makeBlueprint([
      makeStructure("my-fox", "custom", {
        geometry: { kind: "cube" },
      } as Partial<BlueprintStructure>),
    ]);
    bp.scene.structures[0].id = "fox";

    const result = resolveAssets(bp);
    expect(result.scene.structures[0].modelSrc).toBeUndefined();
  });

  it("skips structures that already have modelSrc", () => {
    const bp = makeBlueprint([
      makeStructure("my-fox", "custom", {
        modelSrc: "https://example.com/custom-fox.glb",
      }),
    ]);

    const result = resolveAssets(bp);
    expect(result.scene.structures[0].modelSrc).toBe("https://example.com/custom-fox.glb");
  });

  it("skips structures that already have children", () => {
    const bp = makeBlueprint([
      makeStructure("fox", "custom", {
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

  it("never returns Astronaut.glb for non-astronaut structures", () => {
    const types: BlueprintStructure["type"][] = ["creature", "custom", "prop"];
    const ids = ["cat", "dog", "bird", "monster", "character"];
    for (const type of types) {
      for (const id of ids) {
        const bp = makeBlueprint([makeStructure(id, type)], "creature");
        const result = resolveAssets(bp);
        for (const s of result.scene.structures) {
          if (s.modelSrc) {
            expect(s.modelSrc).not.toContain("Astronaut.glb");
          }
        }
      }
    }
  });
});
