/**
 * Pre-build script: reads the Knowledge Book markdown and outputs a TS constant.
 * Run via: node scripts/bundle-knowledge.js
 */
const fs = require("fs");
const path = require("path");

const INPUT = path.join(
  __dirname,
  "..",
  "Knowledge Book",
  "INSTRUCTION & KNOWLEDGE REFERENCE.md"
);
const OUTPUT = path.join(__dirname, "..", "lib", "mml", "knowledge-content.ts");

let content = "";
if (fs.existsSync(INPUT)) {
  content = fs.readFileSync(INPUT, "utf8");
  console.log(`Bundled knowledge book (${content.length} chars)`);
} else {
  console.warn("Knowledge book not found at:", INPUT);
}

const escaped = content.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

const ts = `// AUTO-GENERATED — do not edit. Run: node scripts/bundle-knowledge.js
export const KNOWLEDGE_REFERENCE = \`${escaped}\`;
`;

fs.writeFileSync(OUTPUT, ts, "utf8");
console.log("Wrote", OUTPUT);
