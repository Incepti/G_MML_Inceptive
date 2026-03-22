/**
 * Biome presets — static data defining each biome type.
 * Shared between the UI (cards) and the prompt builder (asset hints).
 */

export interface BiomePreset {
  id: string;
  name: string;
  description: string;
  color: string;         // accent color for the card
  icon: string;          // emoji
  layers: {
    ground: string[];    // ground cover keywords
    mid: string[];       // mid-level objects
    tall: string[];      // tall / dominant structures
    atmospheric: string[]; // lighting / ambiance hints
  };
  gcsCategories: string[];       // relevant GCS catalog categories
  othersideSubcats: string[];    // relevant Otherside subcategories
  lightingHint: string;
  density: number;       // target structure count
}

export const BIOME_PRESETS: BiomePreset[] = [
  {
    id: "enchanted_forest",
    name: "Enchanted Forest",
    description: "Dense woodland with magical flora, bioluminescent mushrooms, and ancient trees",
    color: "#2d8a27",
    icon: "🌳",
    layers: {
      ground: ["moss", "grass", "small flowers", "fallen leaves", "ground mushrooms"],
      mid: ["bushes", "ferns", "rocks", "fallen logs", "stumps", "mushroom clusters"],
      tall: ["large trees", "ancient oaks", "twisted vines", "rock formations"],
      atmospheric: ["glowing crystals", "firefly lights", "mist", "canopy shadows"],
    },
    gcsCategories: ["environment", "props"],
    othersideSubcats: ["Mushrooms_Fungi", "Plants", "Flowers", "Moss_Ground", "Trees", "Crystals_Gems"],
    lightingHint: "Dim canopy light filtering through leaves, warm bioluminescent accents from mushrooms and crystals",
    density: 60,
  },
  {
    id: "crystal_cavern",
    name: "Crystal Cavern",
    description: "Underground cave system with towering crystal formations and glowing minerals",
    color: "#6366f1",
    icon: "💎",
    layers: {
      ground: ["small crystals", "pebbles", "mineral deposits", "cave floor rocks"],
      mid: ["crystal clusters", "stalagmites", "rock pillars", "mineral veins"],
      tall: ["massive crystals", "stalactites", "crystal columns", "cave walls"],
      atmospheric: ["crystal glow lights", "ambient cave lighting", "refracted light beams"],
    },
    gcsCategories: ["environment", "props"],
    othersideSubcats: ["Crystals_Gems", "Rocks_Stones", "Moss_Ground", "Structures"],
    lightingHint: "Dark ambient with vibrant crystal glow in blues, purples, and teals. Point lights inside crystal clusters.",
    density: 50,
  },
  {
    id: "volcanic_wastes",
    name: "Volcanic Wastes",
    description: "Scorched landscape with lava flows, obsidian rocks, and smoldering craters",
    color: "#dc2626",
    icon: "🌋",
    layers: {
      ground: ["volcanic rock", "ash ground", "lava cracks", "charred ground"],
      mid: ["obsidian formations", "smoldering rocks", "lava pools", "scorched stumps"],
      tall: ["volcanic pillars", "ruined structures", "lava geysers", "dead trees"],
      atmospheric: ["lava glow", "ember particles", "smoke plumes", "fiery sky light"],
    },
    gcsCategories: ["environment", "props"],
    othersideSubcats: ["Volcanoes_Fire", "Rocks_Stones", "Ruins", "Terrain_Platforms"],
    lightingHint: "Deep orange and red lava glow from below, harsh directional light from above, emissive lava surfaces",
    density: 45,
  },
  {
    id: "arctic_tundra",
    name: "Arctic Tundra",
    description: "Frozen wasteland with ice formations, snow drifts, and crystalline structures",
    color: "#38bdf8",
    icon: "❄️",
    layers: {
      ground: ["snow patches", "ice sheets", "frozen ground", "frost crystals"],
      mid: ["ice boulders", "snow drifts", "frozen bushes", "ice spikes"],
      tall: ["ice pillars", "frozen waterfalls", "snow-covered trees", "glacier walls"],
      atmospheric: ["aurora lights", "blizzard particles", "cold blue ambient", "ice reflections"],
    },
    gcsCategories: ["environment", "props"],
    othersideSubcats: ["Ice_Snow", "Rocks_Stones", "Crystals_Gems", "Terrain_Platforms"],
    lightingHint: "Cool blue-white ambient, soft directional from low sun angle, aurora-colored accent lights",
    density: 45,
  },
  {
    id: "alien_swamp",
    name: "Alien Swamp",
    description: "Otherworldly wetlands with bizarre flora, glowing pools, and strange creatures",
    color: "#a855f7",
    icon: "🐙",
    layers: {
      ground: ["alien moss", "swamp water", "bioluminescent puddles", "strange roots"],
      mid: ["alien plants", "fungal growths", "coral-like structures", "swamp creatures"],
      tall: ["massive alien trees", "tentacle vines", "spore towers", "swamp pillars"],
      atmospheric: ["toxic glow", "floating spores", "eerie mist", "bioluminescent light"],
    },
    gcsCategories: ["environment", "animals"],
    othersideSubcats: ["Creatures", "Mushrooms_Fungi", "Plants", "Flowers", "Shells_Coral", "Moss_Ground"],
    lightingHint: "Eerie purple and green glow from bioluminescent sources, misty ambient, alien atmosphere",
    density: 55,
  },
  {
    id: "ancient_ruins",
    name: "Ancient Ruins",
    description: "Crumbling stone temples overgrown with vegetation, weathered statues and archways",
    color: "#d97706",
    icon: "🏛",
    layers: {
      ground: ["stone tiles", "moss-covered ground", "rubble", "fallen leaves"],
      mid: ["broken columns", "stone blocks", "overgrown walls", "carved stones", "vines"],
      tall: ["temple columns", "archways", "stone towers", "ancient statues", "crumbling walls"],
      atmospheric: ["shaft of golden light", "dust particles", "mystical ambient glow"],
    },
    gcsCategories: ["buildings", "environment", "art_decor", "props"],
    othersideSubcats: ["Ruins", "Rocks_Stones", "Plants", "Moss_Ground", "Structures"],
    lightingHint: "Warm golden light through cracks, dappled shadow patterns, mystical amber accents",
    density: 55,
  },
  {
    id: "coral_reef",
    name: "Coral Reef",
    description: "Vibrant underwater seascape with colorful coral, sea life, and sunlight filtering through water",
    color: "#06b6d4",
    icon: "🐚",
    layers: {
      ground: ["sand bed", "sea grass", "small shells", "pebbles"],
      mid: ["coral formations", "sea anemones", "kelp", "sea urchins", "starfish"],
      tall: ["large coral towers", "kelp forests", "rock arches", "sunken structures"],
      atmospheric: ["caustic light rays", "floating particles", "underwater blue ambient"],
    },
    gcsCategories: ["environment", "animals", "props"],
    othersideSubcats: ["Shells_Coral", "Plants", "Creatures", "Rocks_Stones", "Flowers"],
    lightingHint: "Blue-green caustic light from above, warm coral accent lights, deep ocean ambient",
    density: 60,
  },
  {
    id: "mushroom_kingdom",
    name: "Mushroom Kingdom",
    description: "Fantastical landscape of giant mushrooms, spore clouds, and fungal architecture",
    color: "#e11d48",
    icon: "🍄",
    layers: {
      ground: ["mycelium network", "small mushrooms", "moss", "spore patches"],
      mid: ["medium mushrooms", "fungal shelves", "glowing toadstools", "lichen rocks"],
      tall: ["giant mushrooms", "mushroom trees", "fungal towers", "spore pillars"],
      atmospheric: ["floating spores", "bioluminescent glow", "misty undergrowth"],
    },
    gcsCategories: ["environment", "props"],
    othersideSubcats: ["Mushrooms_Fungi", "Plants", "Moss_Ground", "Flowers", "Crystals_Gems"],
    lightingHint: "Soft bioluminescent glow from mushroom caps, warm amber and cool blue accents, misty diffused light",
    density: 55,
  },
];
