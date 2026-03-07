/**
 * Environment Asset Catalog
 *
 * Maps semantic structure types to available 3D model assets.
 * The system ALWAYS prefers 3D models over primitives.
 * Primitives are only used when the user explicitly requests them.
 *
 * APPROVED SOURCES (strict — no other external sources):
 * - Poly Haven (polyhaven.com) — CC0 models, served via /api/models/polyhaven proxy
 * - Poly Pizza (poly.pizza) — CC0 models, requires POLY_PIZZA_API_KEY
 * - Geez Collection IDs 0-5555 (project-specific assets)
 *
 * The polyhaven proxy (/api/models/polyhaven/[id]) rewrites gltf texture URIs
 * to absolute CDN URLs so textures load correctly.
 */

export interface EnvironmentAsset {
  id: string;
  name: string;
  category: "structure" | "prop" | "furniture" | "lighting" | "environment" | "vehicle" | "character";
  modelUrl: string;
  defaultScale: number;
  tags: string[];
  description: string;
}

/**
 * Construct polyhaven model URL via our proxy.
 * The proxy rewrites texture URIs so models render with full textures.
 */
export function polyhaven(id: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  return `${base}/api/models/polyhaven/${id}`;
}

// ─── Polyhaven Verified Assets (all confirmed 2026-03-07) ────────────────────

const POLYHAVEN_ASSETS: EnvironmentAsset[] = [
  // ── Chairs ────────────────────────────────────────────────────────────────
  { id: "armchair", name: "Armchair", category: "furniture", modelUrl: polyhaven("ArmChair_01"), defaultScale: 1, tags: ["chair", "armchair", "seat", "furniture", "interior"], description: "Upholstered armchair" },
  { id: "wooden-chair", name: "Wooden Chair", category: "furniture", modelUrl: polyhaven("WoodenChair_01"), defaultScale: 1, tags: ["chair", "wooden", "seat", "furniture", "interior"], description: "Simple wooden chair" },
  { id: "school-chair", name: "School Chair", category: "furniture", modelUrl: polyhaven("SchoolChair_01"), defaultScale: 1, tags: ["chair", "school", "seat", "furniture"], description: "School/classroom chair" },
  { id: "barber-chair", name: "Barber Chair", category: "furniture", modelUrl: polyhaven("BarberShopChair_01"), defaultScale: 1, tags: ["chair", "barber", "seat", "furniture"], description: "Barber shop chair" },
  { id: "green-chair", name: "Green Chair", category: "furniture", modelUrl: polyhaven("GreenChair_01"), defaultScale: 1, tags: ["chair", "green", "seat", "furniture", "modern"], description: "Modern green accent chair" },
  { id: "rocking-chair", name: "Rocking Chair", category: "furniture", modelUrl: polyhaven("Rockingchair_01"), defaultScale: 1, tags: ["chair", "rocking", "seat", "furniture", "porch"], description: "Classic rocking chair" },
  { id: "dining-chair", name: "Dining Chair", category: "furniture", modelUrl: polyhaven("dining_chair_02"), defaultScale: 1, tags: ["chair", "dining", "seat", "furniture"], description: "Dining room chair" },
  { id: "bar-chair", name: "Bar Stool", category: "furniture", modelUrl: polyhaven("bar_chair_round_01"), defaultScale: 1, tags: ["stool", "bar", "seat", "furniture"], description: "Round bar stool" },
  { id: "chinese-armchair", name: "Chinese Armchair", category: "furniture", modelUrl: polyhaven("chinese_armchair"), defaultScale: 1, tags: ["chair", "armchair", "chinese", "oriental", "furniture"], description: "Traditional Chinese armchair" },
  { id: "chinese-stool", name: "Chinese Stool", category: "furniture", modelUrl: polyhaven("chinese_stool"), defaultScale: 1, tags: ["stool", "chinese", "oriental", "seat", "furniture"], description: "Traditional Chinese stool" },

  // ── Tables ────────────────────────────────────────────────────────────────
  { id: "wooden-table", name: "Wooden Table", category: "furniture", modelUrl: polyhaven("WoodenTable_01"), defaultScale: 1, tags: ["table", "wooden", "furniture", "dining"], description: "Wooden dining table" },
  { id: "wooden-table-2", name: "Wooden Table (alt)", category: "furniture", modelUrl: polyhaven("WoodenTable_02"), defaultScale: 1, tags: ["table", "wooden", "furniture"], description: "Alternative wooden table" },
  { id: "wooden-table-3", name: "Wooden Table (rustic)", category: "furniture", modelUrl: polyhaven("WoodenTable_03"), defaultScale: 1, tags: ["table", "wooden", "furniture", "rustic"], description: "Rustic wooden table" },
  { id: "coffee-table", name: "Coffee Table", category: "furniture", modelUrl: polyhaven("CoffeeTable_01"), defaultScale: 1, tags: ["table", "coffee", "furniture", "interior", "living-room"], description: "Coffee table" },
  { id: "coffee-table-round", name: "Round Coffee Table", category: "furniture", modelUrl: polyhaven("coffee_table_round_01"), defaultScale: 1, tags: ["table", "coffee", "round", "furniture"], description: "Round coffee table" },
  { id: "school-desk", name: "School Desk", category: "furniture", modelUrl: polyhaven("SchoolDesk_01"), defaultScale: 1, tags: ["desk", "school", "table", "furniture"], description: "School desk" },
  { id: "chinese-tea-table", name: "Chinese Tea Table", category: "furniture", modelUrl: polyhaven("chinese_tea_table"), defaultScale: 1, tags: ["table", "tea", "chinese", "oriental", "furniture"], description: "Traditional Chinese tea table" },
  { id: "chinese-console", name: "Chinese Console Table", category: "furniture", modelUrl: polyhaven("chinese_console_table"), defaultScale: 1, tags: ["table", "console", "chinese", "oriental", "furniture"], description: "Chinese console/entry table" },

  // ── Sofas & Seating ───────────────────────────────────────────────────────
  { id: "sofa", name: "Sofa", category: "furniture", modelUrl: polyhaven("Sofa_01"), defaultScale: 1, tags: ["sofa", "couch", "furniture", "seating", "interior"], description: "Living room sofa" },
  { id: "chinese-sofa", name: "Chinese Sofa", category: "furniture", modelUrl: polyhaven("chinese_sofa"), defaultScale: 1, tags: ["sofa", "couch", "chinese", "oriental", "furniture"], description: "Traditional Chinese sofa" },
  { id: "ottoman", name: "Ottoman", category: "furniture", modelUrl: polyhaven("Ottoman_01"), defaultScale: 1, tags: ["ottoman", "pouf", "seat", "furniture"], description: "Ottoman footrest" },

  // ── Beds & Bedroom ────────────────────────────────────────────────────────
  { id: "gothic-bed", name: "Gothic Bed", category: "furniture", modelUrl: polyhaven("GothicBed_01"), defaultScale: 1, tags: ["bed", "gothic", "bedroom", "furniture"], description: "Gothic-style bed" },
  { id: "nightstand", name: "Nightstand", category: "furniture", modelUrl: polyhaven("ClassicNightstand_01"), defaultScale: 1, tags: ["nightstand", "bedside", "table", "bedroom", "furniture"], description: "Classic nightstand" },

  // ── Cabinets & Storage ────────────────────────────────────────────────────
  { id: "gothic-cabinet", name: "Gothic Cabinet", category: "furniture", modelUrl: polyhaven("GothicCabinet_01"), defaultScale: 1, tags: ["cabinet", "gothic", "storage", "furniture"], description: "Gothic-style cabinet" },
  { id: "gothic-commode", name: "Gothic Commode", category: "furniture", modelUrl: polyhaven("GothicCommode_01"), defaultScale: 1, tags: ["commode", "dresser", "gothic", "furniture"], description: "Gothic commode/dresser" },
  { id: "chinese-cabinet", name: "Chinese Cabinet", category: "furniture", modelUrl: polyhaven("chinese_cabinet"), defaultScale: 1, tags: ["cabinet", "chinese", "oriental", "storage", "furniture"], description: "Traditional Chinese cabinet" },
  { id: "chinese-commode", name: "Chinese Commode", category: "furniture", modelUrl: polyhaven("chinese_commode"), defaultScale: 1, tags: ["commode", "chinese", "oriental", "furniture"], description: "Chinese commode" },
  { id: "shelf", name: "Shelf", category: "furniture", modelUrl: polyhaven("Shelf_01"), defaultScale: 1, tags: ["shelf", "storage", "furniture", "interior"], description: "Wall shelf unit" },
  { id: "console", name: "Classic Console", category: "furniture", modelUrl: polyhaven("ClassicConsole_01"), defaultScale: 1, tags: ["console", "table", "furniture", "classic"], description: "Classic console/sideboard" },

  // ── Decorative & Screens ──────────────────────────────────────────────────
  { id: "chinese-screen", name: "Chinese Screen Panels", category: "furniture", modelUrl: polyhaven("chinese_screen_panels"), defaultScale: 1, tags: ["screen", "divider", "chinese", "oriental", "decoration", "furniture"], description: "Chinese room divider panels" },

  // ── Lighting ──────────────────────────────────────────────────────────────
  { id: "chandelier", name: "Chandelier", category: "lighting", modelUrl: polyhaven("Chandelier_01"), defaultScale: 1, tags: ["chandelier", "light", "ceiling", "lighting", "interior"], description: "Classic chandelier" },
  { id: "chandelier-2", name: "Chandelier (ornate)", category: "lighting", modelUrl: polyhaven("Chandelier_02"), defaultScale: 1, tags: ["chandelier", "light", "ceiling", "ornate", "lighting"], description: "Ornate chandelier" },
  { id: "chandelier-3", name: "Chandelier (simple)", category: "lighting", modelUrl: polyhaven("Chandelier_03"), defaultScale: 1, tags: ["chandelier", "light", "ceiling", "modern", "lighting"], description: "Simple chandelier" },
  { id: "chinese-chandelier", name: "Chinese Chandelier", category: "lighting", modelUrl: polyhaven("chinese_chandelier"), defaultScale: 1, tags: ["chandelier", "chinese", "oriental", "light", "lighting"], description: "Chinese-style chandelier" },
  { id: "lantern", name: "Lantern", category: "lighting", modelUrl: polyhaven("Lantern_01"), defaultScale: 1, tags: ["lantern", "light", "lamp", "lighting", "rustic"], description: "Rustic lantern" },
  { id: "desk-lamp", name: "Desk Lamp", category: "lighting", modelUrl: polyhaven("desk_lamp_arm_01"), defaultScale: 1, tags: ["lamp", "desk", "light", "lighting", "office"], description: "Articulated desk lamp" },
  { id: "diya-lantern", name: "Diya Lantern", category: "lighting", modelUrl: polyhaven("brass_diya_lantern"), defaultScale: 1, tags: ["lantern", "lamp", "brass", "lighting", "indian"], description: "Brass diya oil lantern" },
  { id: "candleholders", name: "Candle Holders", category: "lighting", modelUrl: polyhaven("brass_candleholders"), defaultScale: 1, tags: ["candle", "holder", "brass", "lighting", "decoration"], description: "Brass candle holders" },
  { id: "ceiling-fan", name: "Ceiling Fan", category: "lighting", modelUrl: polyhaven("ceiling_fan"), defaultScale: 1, tags: ["fan", "ceiling", "interior", "prop"], description: "Ceiling fan" },

  // ── Containers / Barrels ──────────────────────────────────────────────────
  { id: "barrel", name: "Barrel", category: "prop", modelUrl: polyhaven("Barrel_01"), defaultScale: 1, tags: ["barrel", "container", "wood", "storage"], description: "Wooden barrel" },
  { id: "barrel-2", name: "Barrel (alt)", category: "prop", modelUrl: polyhaven("Barrel_02"), defaultScale: 1, tags: ["barrel", "container", "wood", "storage"], description: "Alternate wooden barrel" },
  { id: "barrel-3", name: "Barrel (small)", category: "prop", modelUrl: polyhaven("barrel_03"), defaultScale: 1, tags: ["barrel", "container", "wood", "storage"], description: "Small barrel" },
  { id: "barrel-stove", name: "Barrel Stove", category: "prop", modelUrl: polyhaven("barrel_stove"), defaultScale: 1, tags: ["barrel", "stove", "fire", "heating"], description: "Barrel wood stove" },
  { id: "cardboard-box", name: "Cardboard Box", category: "prop", modelUrl: polyhaven("cardboard_box_01"), defaultScale: 1, tags: ["box", "cardboard", "container", "crate", "storage"], description: "Cardboard shipping box" },

  // ── Nature / Environment ──────────────────────────────────────────────────
  { id: "boulder", name: "Boulder", category: "environment", modelUrl: polyhaven("boulder_01"), defaultScale: 1, tags: ["rock", "boulder", "stone", "nature", "environment"], description: "Large boulder rock" },
  { id: "coast-rocks", name: "Coast Rocks", category: "environment", modelUrl: polyhaven("coast_rocks_01"), defaultScale: 1, tags: ["rock", "coast", "stone", "nature", "beach"], description: "Coastal rock formation" },
  { id: "coast-land-rocks", name: "Coastal Land Rocks", category: "environment", modelUrl: polyhaven("coast_land_rocks_02"), defaultScale: 1, tags: ["rock", "cliff", "terrain", "nature", "coast"], description: "Coastal terrain rocks" },
  { id: "dead-tree", name: "Dead Tree Trunk", category: "environment", modelUrl: polyhaven("dead_tree_trunk"), defaultScale: 1, tags: ["tree", "trunk", "dead", "nature", "wood"], description: "Dead tree trunk" },
  { id: "dead-tree-2", name: "Dead Tree Trunk (alt)", category: "environment", modelUrl: polyhaven("dead_tree_trunk_02"), defaultScale: 1, tags: ["tree", "trunk", "dead", "nature", "wood"], description: "Alternate dead tree trunk" },
  { id: "quiver-trunk", name: "Quiver Tree Trunk", category: "environment", modelUrl: polyhaven("dead_quiver_trunk"), defaultScale: 1, tags: ["tree", "trunk", "quiver", "nature", "desert"], description: "Dead quiver tree trunk" },
  { id: "plant-anthurium", name: "Anthurium Plant", category: "environment", modelUrl: polyhaven("anthurium_botany_01"), defaultScale: 1, tags: ["plant", "flower", "nature", "interior", "pot"], description: "Anthurium potted plant" },
  { id: "plant-calathea", name: "Calathea Plant", category: "environment", modelUrl: polyhaven("calathea_orbifolia_01"), defaultScale: 1, tags: ["plant", "leaf", "nature", "interior", "pot"], description: "Calathea orbifolia plant" },
  { id: "dandelion", name: "Dandelion", category: "environment", modelUrl: polyhaven("dandelion_01"), defaultScale: 1, tags: ["flower", "dandelion", "nature", "plant", "grass"], description: "Dandelion flower" },

  // ── Vehicles ──────────────────────────────────────────────────────────────
  { id: "covered-car", name: "Covered Car", category: "vehicle", modelUrl: polyhaven("covered_car"), defaultScale: 1, tags: ["car", "vehicle", "covered", "automobile"], description: "Car with cover" },
  { id: "coffee-cart", name: "Coffee Cart", category: "vehicle", modelUrl: polyhaven("CoffeeCart_01"), defaultScale: 1, tags: ["cart", "coffee", "vehicle", "street", "vendor"], description: "Street coffee cart" },
  { id: "road-barrier", name: "Road Barrier", category: "prop", modelUrl: polyhaven("concrete_road_barrier"), defaultScale: 1, tags: ["barrier", "road", "concrete", "urban", "traffic"], description: "Concrete road barrier" },

  // ── Weapons ───────────────────────────────────────────────────────────────
  { id: "katana", name: "Katana", category: "prop", modelUrl: polyhaven("antique_katana_01"), defaultScale: 1, tags: ["katana", "sword", "weapon", "japanese", "blade"], description: "Antique Japanese katana" },
  { id: "cannon", name: "Cannon", category: "prop", modelUrl: polyhaven("cannon_01"), defaultScale: 1, tags: ["cannon", "weapon", "military", "artillery"], description: "Historical cannon" },

  // ── Tools ─────────────────────────────────────────────────────────────────
  { id: "crowbar", name: "Crowbar", category: "prop", modelUrl: polyhaven("crowbar_01"), defaultScale: 1, tags: ["crowbar", "tool", "metal"], description: "Steel crowbar" },
  { id: "bolt-cutters", name: "Bolt Cutters", category: "prop", modelUrl: polyhaven("bolt_cutters_01"), defaultScale: 1, tags: ["bolt-cutters", "tool", "metal"], description: "Bolt cutters" },
  { id: "drill", name: "Drill", category: "prop", modelUrl: polyhaven("Drill_01"), defaultScale: 1, tags: ["drill", "tool", "power-tool"], description: "Power drill" },

  // ── Electronics / Appliances ──────────────────────────────────────────────
  { id: "boombox", name: "Boombox", category: "prop", modelUrl: polyhaven("boombox"), defaultScale: 1, tags: ["boombox", "music", "radio", "electronics", "retro"], description: "Retro boombox" },
  { id: "television", name: "Television", category: "prop", modelUrl: polyhaven("Television_01"), defaultScale: 1, tags: ["tv", "television", "screen", "electronics"], description: "Television set" },
  { id: "cassette-player", name: "Cassette Player", category: "prop", modelUrl: polyhaven("cassette_player"), defaultScale: 1, tags: ["cassette", "player", "music", "retro", "electronics"], description: "Retro cassette player" },
  { id: "cash-register", name: "Cash Register", category: "prop", modelUrl: polyhaven("CashRegister_01"), defaultScale: 1, tags: ["register", "cash", "shop", "electronics"], description: "Vintage cash register" },
  { id: "camera", name: "Camera", category: "prop", modelUrl: polyhaven("Camera_01"), defaultScale: 1, tags: ["camera", "photo", "prop", "electronics"], description: "Camera" },

  // ── Decorative / Vases ────────────────────────────────────────────────────
  { id: "ceramic-vase", name: "Ceramic Vase", category: "prop", modelUrl: polyhaven("ceramic_vase_01"), defaultScale: 1, tags: ["vase", "ceramic", "decoration", "interior"], description: "Ceramic vase" },
  { id: "brass-vase", name: "Brass Vase", category: "prop", modelUrl: polyhaven("brass_vase_01"), defaultScale: 1, tags: ["vase", "brass", "decoration", "metal"], description: "Brass vase" },
  { id: "antique-vase", name: "Antique Ceramic Vase", category: "prop", modelUrl: polyhaven("antique_ceramic_vase_01"), defaultScale: 1, tags: ["vase", "antique", "ceramic", "decoration"], description: "Antique ceramic vase" },
  { id: "brass-goblets", name: "Brass Goblets", category: "prop", modelUrl: polyhaven("brass_goblets"), defaultScale: 1, tags: ["goblet", "cup", "brass", "medieval", "tableware"], description: "Brass drinking goblets" },
  { id: "brass-pot", name: "Brass Pot", category: "prop", modelUrl: polyhaven("brass_pot_01"), defaultScale: 1, tags: ["pot", "brass", "cooking", "kitchen"], description: "Brass cooking pot" },
  { id: "brass-pan", name: "Brass Pan", category: "prop", modelUrl: polyhaven("brass_pan_01"), defaultScale: 1, tags: ["pan", "brass", "cooking", "kitchen"], description: "Brass cooking pan" },

  // ── Sculptures / Statues ──────────────────────────────────────────────────
  { id: "elephant-statue", name: "Wooden Elephant", category: "prop", modelUrl: polyhaven("carved_wooden_elephant"), defaultScale: 1, tags: ["elephant", "statue", "wooden", "decoration", "animal"], description: "Carved wooden elephant" },
  { id: "cat-statue", name: "Cat Statue", category: "prop", modelUrl: polyhaven("concrete_cat_statue"), defaultScale: 1, tags: ["cat", "statue", "concrete", "decoration", "animal"], description: "Concrete cat statue" },
  { id: "bull-head", name: "Bull Head", category: "prop", modelUrl: polyhaven("bull_head"), defaultScale: 1, tags: ["bull", "head", "trophy", "animal", "decoration"], description: "Bull head wall mount" },

  // ── Sports / Games ────────────────────────────────────────────────────────
  { id: "chess-set", name: "Chess Set", category: "prop", modelUrl: polyhaven("chess_set"), defaultScale: 1, tags: ["chess", "game", "board-game", "prop"], description: "Chess set with board and pieces" },
  { id: "baseball", name: "Baseball", category: "prop", modelUrl: polyhaven("baseball_01"), defaultScale: 3, tags: ["baseball", "ball", "sport"], description: "Baseball" },
  { id: "baseball-bat", name: "Baseball Bat", category: "prop", modelUrl: polyhaven("baseball_bat"), defaultScale: 1, tags: ["bat", "baseball", "sport", "weapon"], description: "Baseball bat" },
  { id: "football", name: "Football", category: "prop", modelUrl: polyhaven("dirty_football"), defaultScale: 3, tags: ["football", "soccer", "ball", "sport"], description: "Football/soccer ball" },
  { id: "american-football", name: "American Football", category: "prop", modelUrl: polyhaven("american_football"), defaultScale: 3, tags: ["football", "american", "ball", "sport"], description: "American football" },
  { id: "dartboard", name: "Dartboard", category: "prop", modelUrl: polyhaven("dartboard"), defaultScale: 1, tags: ["dartboard", "darts", "game", "pub"], description: "Pub dartboard" },

  // ── Food ──────────────────────────────────────────────────────────────────
  { id: "croissant", name: "Croissant", category: "prop", modelUrl: polyhaven("croissant"), defaultScale: 5, tags: ["croissant", "food", "bread", "pastry", "bakery"], description: "Croissant pastry" },
  { id: "carrot-cake", name: "Carrot Cake", category: "prop", modelUrl: polyhaven("carrot_cake"), defaultScale: 3, tags: ["cake", "food", "dessert", "pastry"], description: "Slice of carrot cake" },

  // ── Books / Media ─────────────────────────────────────────────────────────
  { id: "books", name: "Encyclopedia Set", category: "prop", modelUrl: polyhaven("book_encyclopedia_set_01"), defaultScale: 1, tags: ["book", "books", "library", "shelf", "education"], description: "Set of encyclopedia books" },
  { id: "ukulele", name: "Ukulele", category: "prop", modelUrl: polyhaven("Ukulele_01"), defaultScale: 1, tags: ["ukulele", "guitar", "music", "instrument"], description: "Ukulele" },
  { id: "megaphone", name: "Megaphone", category: "prop", modelUrl: polyhaven("Megaphone_01"), defaultScale: 1, tags: ["megaphone", "speaker", "announcement", "prop"], description: "Megaphone/bullhorn" },

  // ── Signs ─────────────────────────────────────────────────────────────────
  { id: "wet-floor-sign", name: "Wet Floor Sign", category: "prop", modelUrl: polyhaven("WetFloorSign_01"), defaultScale: 1, tags: ["sign", "warning", "floor", "safety"], description: "Wet floor warning sign" },
];

// ─── Full catalog ───────────────────────────────────────────────────────────

export const ENVIRONMENT_CATALOG: EnvironmentAsset[] = [...POLYHAVEN_ASSETS];

// ─── Lookup helpers ─────────────────────────────────────────────────────────

export function getEnvironmentAsset(id: string): EnvironmentAsset | undefined {
  return ENVIRONMENT_CATALOG.find((a) => a.id === id);
}

export function getAssetsByCategory(category: EnvironmentAsset["category"]): EnvironmentAsset[] {
  return ENVIRONMENT_CATALOG.filter((a) => a.category === category);
}

export function getAssetsByTag(tag: string): EnvironmentAsset[] {
  return ENVIRONMENT_CATALOG.filter((a) => a.tags.includes(tag.toLowerCase()));
}

export function searchEnvironmentAssets(query: string): EnvironmentAsset[] {
  const q = query.toLowerCase();
  return ENVIRONMENT_CATALOG.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.tags.some((t) => t.includes(q)) ||
      a.category.includes(q)
  );
}

/**
 * Build a formatted catalog string for inclusion in AI prompts.
 */
export function buildEnvironmentCatalogPrompt(): string {
  const lines: string[] = [
    "ENVIRONMENT ASSET CATALOG (verified 3D models — ALWAYS use these over primitives):",
    "Source: Poly Haven (polyhaven.com) — CC0 licensed",
    "",
  ];

  const byCategory = new Map<string, EnvironmentAsset[]>();
  for (const asset of ENVIRONMENT_CATALOG) {
    const cat = asset.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(asset);
  }

  for (const [category, assets] of byCategory) {
    lines.push(`  ${category.toUpperCase()}:`);
    for (const a of assets) {
      lines.push(`    - ${a.name} [${a.tags.join(", ")}]: ${a.modelUrl}`);
      lines.push(`      scale: ${a.defaultScale}, ${a.description}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
