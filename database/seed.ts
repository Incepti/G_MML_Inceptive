import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env
import { v4 as uuidv4 } from "uuid";
import { runMigrations } from "./schema";
import {
  createProject,
  upsertFile,
  upsertAsset,
  saveVersion,
} from "./client";

const now = new Date().toISOString();

// ─── Example 1: Static Scene ───────────────────────────────────────────────
const staticProject = {
  id: "example-static-001",
  name: "Example: Space Station Alpha",
  description:
    "Static MML scene using m-cylinder, m-label, m-attr-anim. No JavaScript — pure declarative MML.",
  mode: "static",
  created_at: now,
  updated_at: now,
};

const staticMML = `<m-group>
  <m-cylinder
    radius="10"
    height="0.3"
    color="#1a1a2e"
    receive-shadows="true"
    y="0"
  ></m-cylinder>

  <m-group y="3">
    <m-attr-anim
      attr="ry"
      start="0"
      end="360"
      duration="8000"
      loop="true"
      easing="linear"
    ></m-attr-anim>
    <m-cube width="5" height="0.15" depth="0.4" color="#6a6aaa" cast-shadows="true"></m-cube>
    <m-cube width="0.4" height="0.15" depth="5" color="#6a6aaa" cast-shadows="true"></m-cube>
  </m-group>

  <m-cylinder radius="0.2" height="5" color="#334466" x="4" z="4" cast-shadows="true">
    <m-attr-anim attr="emissive-intensity" start="0" end="1.5" duration="2000" loop="true" ping-pong="true" easing="easeInOut"></m-attr-anim>
  </m-cylinder>
  <m-cylinder radius="0.2" height="5" color="#334466" x="-4" z="4" cast-shadows="true">
    <m-attr-anim attr="emissive-intensity" start="0" end="1.5" duration="2500" loop="true" ping-pong="true" easing="easeInOut"></m-attr-anim>
  </m-cylinder>
  <m-cylinder radius="0.2" height="5" color="#334466" x="4" z="-4" cast-shadows="true">
    <m-attr-anim attr="emissive-intensity" start="0" end="1.5" duration="2000" loop="true" ping-pong="true" easing="easeInOut"></m-attr-anim>
  </m-cylinder>
  <m-cylinder radius="0.2" height="5" color="#334466" x="-4" z="-4" cast-shadows="true">
    <m-attr-anim attr="emissive-intensity" start="0" end="1.5" duration="2500" loop="true" ping-pong="true" easing="easeInOut"></m-attr-anim>
  </m-cylinder>

  <m-model
    src="https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb"
    x="0" y="0" z="0"
    cast-shadows="true"
  ></m-model>

  <m-label
    content="SPACE STATION ALPHA"
    font-size="18"
    color="#00aaff"
    alignment="center"
    y="7"
  ></m-label>

  <m-light type="directional" x="5" y="10" z="5" color="#fff5e0" intensity="1.2" cast-shadows="true"></m-light>
  <m-light type="point" x="0" y="4" z="0" color="#4477ff" intensity="1.0" distance="20"></m-light>
  <m-light type="point" x="0" y="0.5" z="0" color="#ff4400" intensity="0.4" distance="8"></m-light>
</m-group>`;

// ─── Example 2: Dynamic Scene ──────────────────────────────────────────────
const dynamicProject = {
  id: "example-dynamic-001",
  name: "Example: Orbiting Spheres",
  description:
    "Dynamic MML scene with deterministic tick-driven animation. Spheres orbit a central cube.",
  mode: "dynamic",
  created_at: now,
  updated_at: now,
};

const dynamicMML = `<m-group>
  <m-light type="point" x="0" y="5" z="0" color="#ffffff" intensity="1.5" distance="20"></m-light>
  <m-light type="directional" x="5" y="10" z="5" color="#aabbff" intensity="0.6"></m-light>
</m-group>`;

const dynamicJS = `let tick = 0;
const ORBIT_RADIUS = 3;
const SPHERE_COUNT = 5;
const COLOURS = ['#ff6b35', '#6b35ff', '#35ff6b', '#ff3566', '#35b5ff'];

const center = document.createElement('m-cube');
center.setAttribute('width', '0.5');
center.setAttribute('height', '0.5');
center.setAttribute('depth', '0.5');
center.setAttribute('color', '#ffffff');
center.setAttribute('emissive', '#aaaaff');
center.setAttribute('emissive-intensity', '0.8');
center.setAttribute('y', '1');
document.body.appendChild(center);

const spheres = [];
for (let i = 0; i < SPHERE_COUNT; i++) {
  const sphere = document.createElement('m-sphere');
  sphere.setAttribute('radius', '0.3');
  sphere.setAttribute('color', COLOURS[i]);
  sphere.setAttribute('cast-shadows', 'true');
  sphere.setAttribute('metalness', '0.3');
  sphere.setAttribute('roughness', '0.6');
  document.body.appendChild(sphere);
  spheres.push({ el: sphere, phaseOffset: (i / SPHERE_COUNT) * Math.PI * 2 });
}

const label = document.createElement('m-label');
label.setAttribute('content', 'ORBITING SPHERES');
label.setAttribute('font-size', '16');
label.setAttribute('color', '#ffffff');
label.setAttribute('alignment', 'center');
label.setAttribute('y', '6');
document.body.appendChild(label);

setInterval(function() {
  tick++;
  const angle = tick * 0.02;
  for (let i = 0; i < spheres.length; i++) {
    const s = spheres[i];
    const a = angle + s.phaseOffset;
    const x = Math.cos(a) * ORBIT_RADIUS;
    const z = Math.sin(a) * ORBIT_RADIUS;
    const y = 1 + Math.sin(a * 2) * 0.5;
    s.el.setAttribute('x', x.toFixed(3));
    s.el.setAttribute('y', y.toFixed(3));
    s.el.setAttribute('z', z.toFixed(3));
  }
}, 33);`;

// ─── Example 3: Interactive Oracle NPC ────────────────────────────────────
const interactiveProject = {
  id: "example-interactive-001",
  name: "Example: Oracle NPC",
  description:
    "Interactive MML scene with m-prompt user input and dynamic label response.",
  mode: "dynamic",
  created_at: now,
  updated_at: now,
};

const interactiveMML = `<m-group>
  <m-cylinder radius="1" height="0.8" color="#3a2a5e" y="0" cast-shadows="true" receive-shadows="true"></m-cylinder>
  <m-light type="spot" x="0" y="6" z="0" color="#cc88ff" intensity="2" angle="30" cast-shadows="true"></m-light>
  <m-light type="directional" x="-5" y="8" z="3" color="#664488" intensity="0.4"></m-light>
</m-group>`;

const interactiveJS = `let tick = 0;

const oracle = document.createElement('m-sphere');
oracle.setAttribute('radius', '0.7');
oracle.setAttribute('color', '#9955ff');
oracle.setAttribute('emissive', '#6622cc');
oracle.setAttribute('emissive-intensity', '0.5');
oracle.setAttribute('metalness', '0.2');
oracle.setAttribute('roughness', '0.5');
oracle.setAttribute('y', '2');
document.body.appendChild(oracle);

const nameLabel = document.createElement('m-label');
nameLabel.setAttribute('content', 'ORACLE');
nameLabel.setAttribute('font-size', '14');
nameLabel.setAttribute('color', '#cc88ff');
nameLabel.setAttribute('alignment', 'center');
nameLabel.setAttribute('y', '3.5');
document.body.appendChild(nameLabel);

const responseLabel = document.createElement('m-label');
responseLabel.setAttribute('content', 'Ask me anything...');
responseLabel.setAttribute('font-size', '12');
responseLabel.setAttribute('color', '#ffffff');
responseLabel.setAttribute('alignment', 'center');
responseLabel.setAttribute('y', '5');
document.body.appendChild(responseLabel);

const prompt = document.createElement('m-prompt');
prompt.setAttribute('message', 'What do you seek?');
prompt.setAttribute('placeholder', 'Type your question...');
prompt.setAttribute('x', '0');
prompt.setAttribute('y', '0.5');
prompt.setAttribute('z', '2');
document.body.appendChild(prompt);

const RESPONSES = [
  'The answer lies within.',
  'Seek and you shall find.',
  'All paths lead to truth.',
  'The stars hold your answer.',
  'Look to the horizon.',
];

prompt.addEventListener('prompt', function(e) {
  const text = e.detail.message || '';
  const idx = text.length % RESPONSES.length;
  responseLabel.setAttribute('content', '"' + RESPONSES[idx] + '"');
  oracle.setAttribute('emissive-intensity', '2');
});

setInterval(function() {
  tick++;
  const pulse = 0.5 + Math.sin(tick * 0.05) * 0.3;
  oracle.setAttribute('emissive-intensity', pulse.toFixed(3));
  const y = 2 + Math.sin(tick * 0.03) * 0.2;
  oracle.setAttribute('y', y.toFixed(3));
}, 33);`;

// ─── Asset Manifest ──────────────────────────────────────────────────────
const duckAsset = {
  id: "khronos-duck",
  project_id: "example-static-001",
  url: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb",
  source: "trusted-index",
  validated: true,
  validated_at: now,
  size_bytes: 170896,
  mime_type: "model/gltf-binary",
  name: "Duck",
  license: "CC0",
  preview_url: null,
  checksum: null,
  created_at: now,
};

// ─── Seed ──────────────────────────────────────────────────────────────────
async function seed() {
  console.log("Running migrations...");
  await runMigrations();

  console.log("Seeding database...");

  // ── Static project ──
  await createProject(staticProject);
  await upsertFile({
    id: uuidv4(),
    project_id: staticProject.id,
    name: "scene.mml",
    type: "mml",
    content: staticMML,
    updated_at: now,
  });
  await upsertAsset(duckAsset);
  await saveVersion({
    id: uuidv4(),
    project_id: staticProject.id,
    version: 1,
    snapshot: JSON.stringify({ mml: staticMML }),
    note: "Initial scene — m-cylinder, m-label, m-attr-anim",
    created_at: now,
  });

  // ── Dynamic project ──
  await createProject(dynamicProject);
  await upsertFile({
    id: uuidv4(),
    project_id: dynamicProject.id,
    name: "scene.mml",
    type: "mml",
    content: dynamicMML,
    updated_at: now,
  });
  await upsertFile({
    id: uuidv4(),
    project_id: dynamicProject.id,
    name: "scene.js",
    type: "js",
    content: dynamicJS,
    updated_at: now,
  });
  await saveVersion({
    id: uuidv4(),
    project_id: dynamicProject.id,
    version: 1,
    snapshot: JSON.stringify({ mml: dynamicMML, js: dynamicJS }),
    note: "Initial orbit scene — document.createElement pattern, 33ms tick",
    created_at: now,
  });

  // ── Interactive project ──
  await createProject(interactiveProject);
  await upsertFile({
    id: uuidv4(),
    project_id: interactiveProject.id,
    name: "scene.mml",
    type: "mml",
    content: interactiveMML,
    updated_at: now,
  });
  await upsertFile({
    id: uuidv4(),
    project_id: interactiveProject.id,
    name: "scene.js",
    type: "js",
    content: interactiveJS,
    updated_at: now,
  });
  await saveVersion({
    id: uuidv4(),
    project_id: interactiveProject.id,
    version: 1,
    snapshot: JSON.stringify({ mml: interactiveMML, js: interactiveJS }),
    note: "Oracle NPC — m-prompt, addEventListener, dynamic label",
    created_at: now,
  });

  console.log("Database seeded successfully.");
  console.log(`  - Project: ${staticProject.name}`);
  console.log(`  - Project: ${dynamicProject.name}`);
  console.log(`  - Project: ${interactiveProject.name}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
