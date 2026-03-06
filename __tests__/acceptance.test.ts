/**
 * Acceptance tests — Phase 20 of the architectural upgrade.
 *
 * Covers the full pipeline: classifier → builder → serializer → validator,
 * plus asset search, patch flow, and MML compliance.
 */

import { describe, it, expect } from "vitest";
import { classifyRequest } from "@/lib/classifier";
import { generateMml } from "@/lib/blueprint/generateMml";
import { searchAssets } from "@/lib/mml/assets/assetSearch";
import { applyBlueprintPatch } from "@/lib/blueprint/patch";
import { MML_ALLOWED_TAGS, MML_FORBIDDEN_TAGS } from "@/types/mml";
import type { BlueprintJSON, BlueprintStructure, PatchOperation } from "@/types/blueprint";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTransform(overrides: Partial<BlueprintStructure["transform"]> = {}) {
  return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, ...overrides };
}

function makeStructure(
  id: string,
  type: string,
  overrides: Partial<BlueprintStructure> = {},
): BlueprintStructure {
  return {
    id,
    type: type as BlueprintStructure["type"],
    transform: makeTransform(),
    ...overrides,
  } as BlueprintStructure;
}

function makeObjectBlueprint(
  structures: BlueprintStructure[],
  archetype = "prop",
  theme = "neutral",
): BlueprintJSON {
  return {
    type: "object",
    meta: { title: "test-obj", units: "meters", scaleProfile: "human", sceneScale: "small", seed: "test-seed-42" },
    intent: { name: "test", archetype },
    style: { theme, detailLevel: "medium" },
    scene: { rootId: "root", structures },
  } as BlueprintJSON;
}

function makeSceneBlueprint(
  structures: BlueprintStructure[],
  archetype = "environment",
  theme = "medieval",
): BlueprintJSON {
  return {
    type: "scene",
    meta: { title: "test-scene", units: "meters", scaleProfile: "human", sceneScale: "medium", seed: "scene-seed-99" },
    intent: { name: "test", archetype },
    style: { theme, detailLevel: "medium" },
    scene: { rootId: "root", structures },
  } as BlueprintJSON;
}

/** Extract all MML tags used in an MML string. */
function extractTags(mml: string): string[] {
  const tags = new Set<string>();
  const regex = /<(m-[a-z-]+)/g;
  let match;
  while ((match = regex.exec(mml))) {
    tags.add(match[1]);
  }
  return [...tags];
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. REQUEST CLASSIFIER
// ═════════════════════════════════════════════════════════════════════════════

describe("Request Classifier", () => {
  it("classifies 'create a car' as OBJECT mode with vehicle archetype", () => {
    const result = classifyRequest("create a car");
    expect(result.generationMode).toBe("OBJECT");
    expect(result.archetype).toBe("vehicle");
    expect(result.intentName).toBe("car");
  });

  it("classifies 'build a medieval prison' as SCENE mode", () => {
    const result = classifyRequest("build a medieval prison");
    expect(result.generationMode).toBe("SCENE");
    expect(result.needsEnvironmentCatalog).toBe(true);
  });

  it("classifies 'a sword' as OBJECT mode with weapon archetype", () => {
    const result = classifyRequest("a sword");
    expect(result.generationMode).toBe("OBJECT");
    expect(result.archetype).toBe("weapon");
    expect(result.intentName).toBe("sword");
  });

  it("classifies 'generate a forest clearing' as SCENE mode", () => {
    const result = classifyRequest("generate a forest clearing");
    expect(result.generationMode).toBe("SCENE");
  });

  it("classifies short ambiguous prompts as OBJECT by default", () => {
    const result = classifyRequest("a shiny thing");
    expect(result.generationMode).toBe("OBJECT");
  });

  it("returns intentName and archetype fields", () => {
    const result = classifyRequest("make a wooden chair");
    expect(result.intentName).toBeDefined();
    expect(result.archetype).toBeDefined();
    expect(result.intentType).toBe(result.archetype); // backwards compat alias
  });

  it("classifies scene override patterns correctly", () => {
    const result = classifyRequest("create a house with trees around");
    expect(result.generationMode).toBe("SCENE");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. OBJECT MODE — FULL PIPELINE
// ═════════════════════════════════════════════════════════════════════════════

describe("Object Mode Pipeline", () => {
  it("generates valid MML from a vehicle blueprint", () => {
    const bp = makeObjectBlueprint(
      [makeStructure("my-car", "vehicle")],
      "vehicle",
    );
    const mml = generateMml(bp);

    expect(mml).toContain("<m-group");
    expect(mml).toContain("</m-group>");

    // Must only use allowed tags
    const tags = extractTags(mml);
    for (const tag of tags) {
      expect(MML_ALLOWED_TAGS).toContain(tag);
    }
  });

  it("generates showcase lights for object mode", () => {
    const bp = makeObjectBlueprint(
      [makeStructure("barrel-1", "prop")],
      "container",
    );
    const mml = generateMml(bp);
    expect(mml).toContain("m-light");
  });

  it("generates ground plane for object mode", () => {
    const bp = makeObjectBlueprint(
      [makeStructure("my-rock", "prop")],
      "nature",
    );
    const mml = generateMml(bp);
    expect(mml).toContain("ground");
  });

  it("is deterministic — same input produces same output", () => {
    const bp = makeObjectBlueprint(
      [makeStructure("test-obj", "prop")],
      "prop",
    );
    const mml1 = generateMml(bp);
    const mml2 = generateMml(bp);
    expect(mml1).toBe(mml2);
  });

  it("preserves existing modelSrc on structures", () => {
    const bp = makeObjectBlueprint([
      makeStructure("my-model", "prop", {
        modelSrc: "https://example.com/model.glb",
      }),
    ]);
    const mml = generateMml(bp);
    expect(mml).toContain("https://example.com/model.glb");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. SCENE MODE — FULL PIPELINE
// ═════════════════════════════════════════════════════════════════════════════

describe("Scene Mode Pipeline", () => {
  it("generates valid MML from a scene with multiple structures", () => {
    const bp = makeSceneBlueprint([
      makeStructure("tower-1", "tower", { transform: makeTransform({ y: 0, x: -5 }) }),
      makeStructure("building-1", "building", { transform: makeTransform({ y: 0, x: 5 }) }),
      makeStructure("tree-1", "tree", { transform: makeTransform({ y: 0, z: 3 }) }),
    ]);
    const mml = generateMml(bp);

    expect(mml).toContain("<m-group");
    const tags = extractTags(mml);
    for (const tag of tags) {
      expect(MML_ALLOWED_TAGS).toContain(tag);
    }
  });

  it("never contains forbidden tags", () => {
    const bp = makeSceneBlueprint([
      makeStructure("building-1", "building"),
      makeStructure("main-light", "light", {
        lightProps: { type: "point", intensity: 1, color: "#ffffff" },
      } as Partial<BlueprintStructure>),
    ]);
    const mml = generateMml(bp);

    for (const forbidden of MML_FORBIDDEN_TAGS) {
      expect(mml).not.toContain(`<${forbidden}`);
    }
  });

  it("serializes all lights from the blueprint faithfully", () => {
    // The light cap (8) is enforced at LLM generation time, not in the serializer.
    // The serializer should faithfully render whatever the blueprint contains.
    const lights: BlueprintStructure[] = [];
    for (let i = 0; i < 3; i++) {
      lights.push(makeStructure(`light-${i}`, "light", {
        lightProps: { type: "point", intensity: 1, color: "#fff" },
      } as Partial<BlueprintStructure>));
    }
    const bp = makeSceneBlueprint(lights);
    const mml = generateMml(bp);

    const lightMatches = mml.match(/<m-light/g) || [];
    expect(lightMatches.length).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. MML COMPLIANCE
// ═════════════════════════════════════════════════════════════════════════════

describe("MML Alpha Compliance", () => {
  it("uses only the 13 allowed MML tags", () => {
    const bp = makeSceneBlueprint([
      makeStructure("wall-n", "wall", {
        geometry: { kind: "cube", width: 10, height: 3, depth: 0.3 },
        material: { color: "#6B6B6B" },
      } as Partial<BlueprintStructure>),
      makeStructure("floor", "floor", {
        geometry: { kind: "plane", width: 10, height: 10 },
        material: { color: "#333" },
      } as Partial<BlueprintStructure>),
      makeStructure("key-light", "light", {
        lightProps: { type: "directional", intensity: 1.5, color: "#fff" },
      } as Partial<BlueprintStructure>),
    ]);
    const mml = generateMml(bp);
    const tags = extractTags(mml);
    for (const tag of tags) {
      expect(MML_ALLOWED_TAGS).toContain(tag);
    }
  });

  it("serializes light types correctly (point, directional, spot)", () => {
    const bp = makeSceneBlueprint([
      makeStructure("l1", "light", {
        lightProps: { type: "point", intensity: 1, color: "#fff", distance: 10 },
      } as Partial<BlueprintStructure>),
      makeStructure("l2", "light", {
        lightProps: { type: "directional", intensity: 1.2, color: "#fff" },
      } as Partial<BlueprintStructure>),
      makeStructure("l3", "light", {
        lightProps: { type: "spot", intensity: 0.8, color: "#fff" },
      } as Partial<BlueprintStructure>),
    ]);
    const mml = generateMml(bp);

    expect(mml).toContain('type="point"');
    expect(mml).toContain('type="directional"');
    expect(mml).toContain('type="spot"');
    // Must never use "spotlight" — Alpha uses "spot"
    expect(mml).not.toContain('type="spotlight"');
  });

  it("never outputs forbidden attributes", () => {
    const bp = makeObjectBlueprint([
      makeStructure("test-cube", "prop", {
        geometry: { kind: "cube", width: 1, height: 1, depth: 1 },
        material: { color: "#ff0000" },
      } as Partial<BlueprintStructure>),
    ]);
    const mml = generateMml(bp);

    expect(mml).not.toContain("cast-shadows");
    expect(mml).not.toContain("receive-shadows");
    expect(mml).not.toContain("penumbra");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. ASSET SEARCH
// ═════════════════════════════════════════════════════════════════════════════

describe("Asset Search", () => {
  it("finds assets by keyword", () => {
    const results = searchAssets({ keywords: ["lantern"], maxResults: 5 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("lantern");
  });

  it("returns empty for nonsense keywords", () => {
    const results = searchAssets({ keywords: ["xyznonexistent123"], maxResults: 5 });
    expect(results).toHaveLength(0);
  });

  it("respects category filter", () => {
    const results = searchAssets({ keywords: ["fox"], category: "vehicle", maxResults: 5 });
    // Fox is a creature, not a vehicle — should not match
    for (const r of results) {
      expect(r.category).toBe("vehicle");
    }
  });

  it("filters out category-level terms from keywords", () => {
    // "vehicle" and "character" are category terms, not search terms
    const results = searchAssets({ keywords: ["vehicle"], maxResults: 5 });
    expect(results).toHaveLength(0);
  });

  it("deduplicates results by modelUrl", () => {
    const results = searchAssets({ keywords: ["fox", "animal"], maxResults: 20 });
    const urls = results.map((r) => r.modelUrl);
    const unique = new Set(urls);
    expect(urls.length).toBe(unique.size);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. PATCH FLOW
// ═════════════════════════════════════════════════════════════════════════════

describe("Blueprint Patch Flow", () => {
  it("applies a valid position patch", () => {
    const bp = makeObjectBlueprint([
      makeStructure("obj-1", "prop", {
        geometry: { kind: "cube", width: 1, height: 1, depth: 1 },
      } as Partial<BlueprintStructure>),
    ]);

    const patch: PatchOperation[] = [
      { op: "replace", path: "/scene/structures/0/transform/x", value: 5 },
      { op: "replace", path: "/scene/structures/0/transform/y", value: 2 },
    ];

    const result = applyBlueprintPatch(bp, patch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blueprint.scene.structures[0].transform.x).toBe(5);
      expect(result.blueprint.scene.structures[0].transform.y).toBe(2);
    }
  });

  it("rejects empty patch array", () => {
    const bp = makeObjectBlueprint([makeStructure("obj-1", "prop")]);
    const result = applyBlueprintPatch(bp, []);
    expect(result.ok).toBe(false);
  });

  it("adds a new structure via patch", () => {
    const bp = makeSceneBlueprint([makeStructure("existing", "prop")]);

    const newStruct: BlueprintStructure = makeStructure("new-tree", "tree", {
      transform: makeTransform({ x: 3, z: -2 }),
    });

    const patch: PatchOperation[] = [
      { op: "add", path: "/scene/structures/-", value: newStruct },
    ];

    const result = applyBlueprintPatch(bp, patch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blueprint.scene.structures).toHaveLength(2);
      expect(result.blueprint.scene.structures[1].id).toBe("new-tree");
    }
  });

  it("removes a structure via patch", () => {
    const bp = makeSceneBlueprint([
      makeStructure("keep", "prop"),
      makeStructure("remove-me", "prop"),
    ]);

    const patch: PatchOperation[] = [
      { op: "remove", path: "/scene/structures/1" },
    ];

    const result = applyBlueprintPatch(bp, patch);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blueprint.scene.structures).toHaveLength(1);
      expect(result.blueprint.scene.structures[0].id).toBe("keep");
    }
  });

  it("does not mutate the original blueprint", () => {
    const bp = makeObjectBlueprint([
      makeStructure("obj-1", "prop", {
        geometry: { kind: "cube", width: 1, height: 1, depth: 1 },
      } as Partial<BlueprintStructure>),
    ]);
    const originalX = bp.scene.structures[0].transform.x;

    applyBlueprintPatch(bp, [
      { op: "replace", path: "/scene/structures/0/transform/x", value: 99 },
    ]);

    expect(bp.scene.structures[0].transform.x).toBe(originalX);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. ARCHETYPE BUILDERS
// ═════════════════════════════════════════════════════════════════════════════

describe("Archetype Builders", () => {
  const archetypes = [
    { archetype: "vehicle", type: "vehicle" },
    { archetype: "furniture", type: "furniture" },
    { archetype: "structure", type: "building" },
    { archetype: "creature", type: "creature" },
    { archetype: "machine", type: "machine" },
    { archetype: "container", type: "barrel" },
    { archetype: "nature", type: "tree" },
    { archetype: "weapon", type: "weapon" },
    { archetype: "tool", type: "tool" },
    { archetype: "lighting", type: "lamp" },
    { archetype: "prop", type: "prop" },
  ];

  for (const { archetype, type } of archetypes) {
    it(`${archetype} builder produces valid MML`, () => {
      const bp = makeObjectBlueprint(
        [makeStructure(`test-${type}`, type)],
        archetype,
      );
      const mml = generateMml(bp);

      expect(mml).toBeTruthy();
      expect(mml).toContain("<m-group");

      const tags = extractTags(mml);
      for (const tag of tags) {
        expect(MML_ALLOWED_TAGS).toContain(tag);
      }
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. DETERMINISM
// ═════════════════════════════════════════════════════════════════════════════

describe("Determinism", () => {
  it("identical blueprints produce identical MML across 10 runs", () => {
    const bp = makeSceneBlueprint([
      makeStructure("tower", "tower", { transform: makeTransform({ x: -5 }) }),
      makeStructure("tree", "tree", { transform: makeTransform({ z: 3 }) }),
      makeStructure("lamp", "light", {
        lightProps: { type: "point", intensity: 1, color: "#FFA500" },
      } as Partial<BlueprintStructure>),
    ]);

    const first = generateMml(bp);
    for (let i = 0; i < 10; i++) {
      expect(generateMml(bp)).toBe(first);
    }
  });
});
