# MML 20 BUILDS — Complete One-Shot Prompt System
## Paste Prompt A once. Then paste any Build prompt. AI builds it. Done.

---

# ═══════════════════════════════════════════════
# PROMPT A — THE FOUNDATION (paste ONCE per session)
# ═══════════════════════════════════════════════

```
You are building MML (Metaverse Markup Language) experiences for the Otherside metaverse platform. You will write complete, working, single-file MML documents that drop into the mml-starter-project. Every MML document you write MUST follow the rules and patterns below exactly. Do not deviate. Do not guess. Do not use any element or attribute not listed here.

## PROJECT SETUP

git clone https://github.com/mml-io/mml-starter-project.git
cd mml-starter-project && npm install
npm install cannon-es simplex-noise alea seedrandom chroma-js canvas bezier-easing node-fetch express ws

## WHAT MML IS

MML documents are HTML files served over websocket. Server-side JavaScript manipulates DOM elements. Connected clients render those elements as 3D objects in real-time. When you setAttribute() on an m-cube, every connected user sees that cube move/change instantly. It is multiplayer by default. All logic is server-side Node.js. There are NO browser APIs available — no window, no requestAnimationFrame, no document.querySelector returning visual elements. The DOM is a virtual DOM that gets serialized over websocket.

## MML ELEMENT REFERENCE — THIS IS THE COMPLETE SET

### Transform Attributes (every m-* element supports these):
x="0" y="0" z="0"          — position in meters
rx="0" ry="0" rz="0"       — rotation in degrees
sx="1" sy="1" sz="1"       — scale multiplier
visible="true"              — show/hide

### Material Attributes (m-cube, m-sphere, m-cylinder, m-plane):
color="#FF0000"             — hex color
opacity="1"                 — 0.0 to 1.0
metalness="0"               — 0.0 to 1.0
roughness="1"               — 0.0 to 1.0
emissive="#000000"          — emissive color (glow)
emissive-intensity="0"      — glow strength
src="url"                   — texture image URL

### Elements — ONLY these exist:

m-cube: width="1" height="1" depth="1" + material attrs + transform attrs
m-sphere: radius="1" + material attrs + transform attrs
m-cylinder: radius="0.5" height="2" + material attrs + transform attrs
m-plane: width="10" height="10" + material attrs + transform attrs
m-model: src="https://url.glb" + transform attrs — loads GLB/GLTF 3D models
m-character: src="https://url.glb" + transform attrs — rigged character with animations
m-light: type="point|directional|spot" intensity="1" color="#FFFFFF" distance="10" angle="45" + transform attrs
m-label: content="text" font-size="24" color="#FFFFFF" alignment="center" + transform attrs — 3D floating text
m-image: src="https://url.png" width="2" height="2" + transform attrs — displays image as 3D plane
m-video: src="https://url.mp4" width="4" height="2.25" loop="true" + transform attrs
m-prompt: message="Type:" placeholder="..." + transform attrs — captures user text, fires "prompt" event
m-group: + transform attrs — container, transforming group transforms all children
m-attr-anim: attr="ry" start="0" end="360" duration="5000" loop="true" easing="linear" — MUST be child of element it animates

### TAGS THAT DO NOT EXIST — never use these:
m-audio, m-position-probe, m-link, m-interaction, m-chat-probe, m-attr-lerp — these are NOT supported. If you write any of these tags the build will break.

## HOW TO WRITE MML DOCUMENTS

Every MML document is an HTML file. The structure is always:

<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script type="module" src="./your-script.js"></script>
</head>
<body>
  <!-- Static MML elements can go here -->
  <!-- Dynamic elements created by script get appended to body -->
</body>
</html>

In the script file (or inline <script>):

// CREATE elements
const cube = document.createElement("m-cube");
cube.setAttribute("color", "#FF0000");
cube.setAttribute("x", "5");
cube.setAttribute("y", "1");
cube.setAttribute("width", "2");
document.body.appendChild(cube);

// UPDATE elements — this is how you animate EVERYTHING
cube.setAttribute("y", String(newY));
cube.setAttribute("ry", String(newRotation));
cube.setAttribute("color", newColor);

// REMOVE elements
cube.remove();

// GAME LOOP — this drives all animation
setInterval(() => {
  // compute new values from physics/noise/time/API data
  // write new values to element attributes
}, 33); // 33ms = ~30fps — this is the standard update rate

// USER INPUT via m-prompt
const prompt = document.createElement("m-prompt");
prompt.setAttribute("message", "Say something:");
prompt.addEventListener("prompt", (e) => {
  const userText = e.detail.message;
  // respond to user text
});
document.body.appendChild(prompt);

// CHILD ANIMATIONS
const spinner = document.createElement("m-cube");
const anim = document.createElement("m-attr-anim");
anim.setAttribute("attr", "ry");
anim.setAttribute("start", "0");
anim.setAttribute("end", "360");
anim.setAttribute("duration", "3000");
anim.setAttribute("loop", "true");
spinner.appendChild(anim); // anim MUST be child of what it animates
document.body.appendChild(spinner);

// GROUPING — transform parent = transform all children
const group = document.createElement("m-group");
group.setAttribute("y", "5"); // everything in this group is 5m up
group.appendChild(cube1);
group.appendChild(cube2);
document.body.appendChild(group);

## CANNON-ES PHYSICS PATTERN

import * as CANNON from 'cannon-es';

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });

// Create body
const body = new CANNON.Body({
  mass: 1, // 0 = static/immovable
  shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)), // half-extents
  position: new CANNON.Vec3(0, 10, 0),
  material: new CANNON.Material({ friction: 0.5, restitution: 0.3 })
});
world.addBody(body);

// Shapes: CANNON.Box(halfExtents), CANNON.Sphere(radius), CANNON.Cylinder(radiusTop, radiusBottom, height, segments), CANNON.Plane()
// Forces: body.applyForce(vec3, worldPoint), body.applyImpulse(vec3, worldPoint)
// Constraints: new CANNON.PointToPointConstraint(bodyA, pivotA, bodyB, pivotB)
// Collision events: body.addEventListener('collide', (e) => { ... })

// CRITICAL: Convert cannon-es quaternion to MML euler degrees
function quaternionToEulerDegrees(q) {
  const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
  const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
  const rx = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI);
  const sinp = 2 * (q.w * q.y - q.z * q.x);
  const ry = (Math.abs(sinp) >= 1 ? Math.sign(sinp) * 90 : Math.asin(sinp) * (180 / Math.PI));
  const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
  const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
  const rz = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
  return { rx, ry, rz };
}

// Game loop
setInterval(() => {
  world.step(1/30);
  const euler = quaternionToEulerDegrees(body.quaternion);
  mmlElement.setAttribute("x", String(body.position.x));
  mmlElement.setAttribute("y", String(body.position.y));
  mmlElement.setAttribute("z", String(body.position.z));
  mmlElement.setAttribute("rx", String(euler.rx));
  mmlElement.setAttribute("ry", String(euler.ry));
  mmlElement.setAttribute("rz", String(euler.rz));
}, 33);

## SIMPLEX-NOISE PATTERN

import { createNoise2D, createNoise3D } from 'simplex-noise';
import alea from 'alea';

const prng = alea('seed-string'); // deterministic — all users see same thing
const noise2D = createNoise2D(prng);
// noise2D(x, y) returns value from -1 to 1

// Organic motion
setInterval(() => {
  const t = Date.now() * 0.001;
  const val = noise2D(x * 0.1, t * 0.5); // -1 to 1
  element.setAttribute("y", String(baseY + val * amplitude));
}, 33);

// Terrain heightmap
for (let gx = 0; gx < gridSize; gx++) {
  for (let gz = 0; gz < gridSize; gz++) {
    const height = noise2D(gx * 0.15, gz * 0.15) * 5; // scale to meters
  }
}

## NODE-CANVAS + EXPRESS IMAGE SERVING PATTERN

import { createCanvas } from 'canvas';
import express from 'express';

const app = express();
let currentImageBuffer = null;

function renderDashboard(data) {
  const canvas = createCanvas(800, 400);
  const ctx = canvas.getContext('2d');
  // Background
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, 800, 400);
  // Draw chart bars, text, lines — standard Canvas 2D API
  ctx.fillStyle = '#00FF88';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(data.title, 20, 40);
  // ... draw whatever you need
  currentImageBuffer = canvas.toBuffer('image/png');
}

app.get('/dashboard.png', (req, res) => {
  if (!currentImageBuffer) {
    renderDashboard({ title: 'Loading...' });
  }
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-cache');
  res.send(currentImageBuffer);
});
app.listen(3001);

// In MML: display and refresh the image
const screen = document.createElement("m-image");
screen.setAttribute("width", "4");
screen.setAttribute("height", "2");
screen.setAttribute("src", "http://localhost:3001/dashboard.png");
document.body.appendChild(screen);

// Refresh image every N seconds by changing src (cache bust)
setInterval(() => {
  renderDashboard(newData);
  screen.setAttribute("src", "http://localhost:3001/dashboard.png?t=" + Date.now());
}, 5000);

## API FETCH PATTERN

// Node 18+ has native fetch, or use node-fetch
async function fetchData() {
  try {
    const res = await fetch('https://api.example.com/data');
    const json = await res.json();
    return json;
  } catch (err) {
    console.error('API fetch failed:', err);
    return null;
  }
}

// Poll on interval
setInterval(async () => {
  const data = await fetchData();
  if (data) {
    // update MML elements from data
  }
}, 30000);

## FREE 3D MODEL SOURCES

Use GLB files from these CC0/free sources:
- MML Public Assets: https://public.mml.io/ (pre-hosted, use URLs directly)
- Kenney: https://kenney.nl/assets (CC0 — pirate ships, vehicles, nature, buildings, furniture)
- Quaternius: https://quaternius.com (CC0 low-poly character/nature/building packs)
- Poly Pizza: https://poly.pizza (free low-poly)
- Khronos Samples: https://github.com/KhronosGroup/glTF-Sample-Assets (raw GitHub URLs)
- ToxSam CC0: https://github.com/ToxSam/open-source-3D-assets

If you cannot find a specific GLB URL, use m-cube/m-sphere/m-cylinder primitives as stand-ins with appropriate colors and proportions. Label them with comments so models can be swapped in later.

## OUTPUT FORMAT

Always output a COMPLETE, WORKING MML document. Include:
1. The HTML file with all inline scripts OR
2. The HTML file + separate JS module file
3. All npm imports at the top
4. All element creation
5. The full game loop
6. All helper functions
7. Comments explaining each section

Do not truncate. Do not say "// ... add more here". Do not leave placeholder functions. Write every line.
```

---

# ═══════════════════════════════════════════════
# BUILD PROMPTS (paste ONE per build)
# ═══════════════════════════════════════════════

---

### BUILD 1 — FART BOMB 💨

```
Build a complete MML document: FART BOMB

A bomb sits on the ground. Timer fuse with flickering m-light (randomize intensity between 0.2 and 2.0 every 100ms). m-label countdown from 10 to 0.

At zero, detonation:
- cannon-es World with gravity
- 30 smoke cloud m-sphere elements, each with a matching cannon-es Body (mass 0.5, Sphere shape radius 0.3, damping 0.9 for air resistance)
- Apply impulse to each body: direction = random unit vector radiating outward from bomb center (spread in all directions), magnitude = random 5-15
- simplex-noise adds turbulent wobble: each frame, offset each body's rendered position by noise2D(bodyIndex * 0.5, time) * 0.3 on x and z
- Clouds start color="#888888" scale 0.3, over 5 seconds transition to color="#44FF44" scale 2.0 (interpolate both per frame)
- "TOXIC ZONE" m-label starts at bomb y position, rises 0.1 per frame, font-size 48, color="#44FF44"
- Green m-light at bomb position, intensity oscillates sin(time * 3) * 2
- After 20 seconds: remove all clouds, remove label, reset bomb, restart countdown
- Loop forever

Write the complete file. Every line. No placeholders.
```

---

### BUILD 2 — LIVING OCEAN WITH SHIPS 🌊

```
Build a complete MML document: LIVING OCEAN WITH REAL SHIPS

Ocean surface: 20x20 grid (400 m-plane elements, each width=1 height=1). Every frame, set each plane's y from multi-octave simplex noise:
  y = noise2D(gx*0.15 + time*0.3, gz*0.15) * 1.5 + noise2D(gx*0.3 + time*0.5, gz*0.3) * 0.5
Map y to color via chroma-js: chroma.scale(['#001a33', '#0044aa', '#0088ff', '#aaddff']).domain([-2, 2])

Ship: m-model (find a ship GLB from Kenney pirate pack or use stacked m-cubes: hull = wide flat m-cube, mast = tall thin m-cylinder, sail = m-plane). Position ship at x=5, z=5. Each frame sample wave heights at 4 offsets around ship to compute:
  ship y = average of 4 sample heights
  ship rx = atan2(bow_height - stern_height, ship_length) in degrees
  ship rz = atan2(port_height - starboard_height, ship_width) in degrees

Cannonball firing: every 8 seconds, create m-sphere (radius 0.15, color="#333") with cannon-es Body. Initial velocity: forward direction * 15 + upward * 8. Gravity pulls it down = parabolic arc. Track body position to m-sphere attributes. Remove cannonball after 5 seconds or on "hit".

Second ship at x=-8, z=-8. Fires back every 10 seconds. Hit detection: if cannonball m-sphere distance to target ship < 2m → "BOOM" m-label at impact point, target ship rx += 15 then settles back (spring damping), flash red m-light.

Island at x=15, z=0: m-cube (green, 4x1x4) with m-cylinder trees. Lighthouse: m-cylinder tower + m-light type="spot" intensity=2 that rotates ry 1 degree per frame.

Fish: 5 m-sphere (small, color="#ff8800") that follow sine curves, periodically breach above wave surface (y = waveHeight + sin(time*2) * 1.5, only visible when y > waveHeight).

Write the complete file. Every line.
```

---

### BUILD 3 — LIVE CRYPTO DASHBOARD 📊

```
Build a complete MML document: LIVE CRYPTO DASHBOARD IN 3D

Fetch from CoinGecko every 30 seconds (free, no API key):
  https://api.coingecko.com/api/v3/simple/price?ids=ethereum,apecoin&vs_currencies=usd&include_24hr_change=true

Store price history in an array (keep last 20 data points).

node-canvas (800x400) renders dashboard PNG:
- Background: dark gradient (#0a0a0a to #1a1a2e)
- Title text: "CRYPTO DASHBOARD" white, bold
- For each coin: draw price line chart from history array
  - x axis = time (evenly spaced), y axis = price (auto-scaled)
  - ETH line = blue (#0088ff), APE line = green (#00ff88)
  - Fill area under lines with semi-transparent gradient
- Current prices as large text
- 24hr change as green (positive) or red (negative) text
- Timestamp at bottom

Serve via express on port 3001 at /chart.png.

m-image (width=5, height=2.5) displays the chart, mounted on a "monitor" (m-cube behind it, dark grey, slightly larger). Position at y=2.

3D bar chart next to monitor: 2 m-cube elements (one for ETH, one for APE). Each cube's sy = normalized price (price / 5000 for ETH, price / 5 for APE — adjust as needed so bars are reasonable height). Color matches chart lines. m-label above each bar showing ticker + price.

Price change detection: compare current fetch to previous. If ETH or APE price increased:
- m-light (green, intensity pulses 0→3→0 over 1 second)
- Spawn 20 confetti m-cube elements (random colors, small 0.05 size) at y=5, random x/z spread. Simple gravity: decrease y by 0.05 per frame. Remove when y < 0.
If price decreased:
- m-light (red pulse)
- "REKT" m-label drops from y=5 to y=2 over 2 seconds, then fades (remove after 3s)

Write the complete file. Every line. Include the express server setup alongside the MML document.
```

---

### BUILD 4 — AI ORACLE NPC 🤖

```
Build a complete MML document: AI ORACLE NPC

Scene setup:
- Throne: m-cube (width=2, height=3, depth=1, color="#4a0080") at y=0.5 with m-cube armrests
- Oracle figure: m-cylinder body (radius=0.4, height=1.2, color="#2a0050") at y=2 on throne + m-sphere head (radius=0.3, color="#dda0dd") at y=3
- Crystal ball: m-sphere (radius=0.4, emissive="#8800ff", emissive-intensity=2, opacity=0.8) at y=1.5, z=2 on a m-cylinder pedestal
- Crystal ball m-light: type="point", color="#8800ff", intensity=2, distance=5, positioned inside the ball
- Ambient candles: 4 m-light type="point" color="#ff8800" intensity=0.5 at corners, small m-cylinder + m-cube flame shapes
- m-prompt message="Ask the Oracle..." placeholder="your question"

Keyword response system — 30 patterns with 30 unique responses:

Category FUTURE (keywords: future, predict, destiny, tomorrow, fate, fortune, ahead):
  Responses: "The threads of time weave a tapestry of gold for you...", "I see transformation approaching like a rising tide...", "Three moons hence, what was hidden shall be revealed...", "The stars rearrange themselves in your favor...", "A door you thought closed is merely waiting..."
  Crystal ball color: #8800ff (purple), oracle light: purple

Category WEALTH (keywords: money, rich, wealth, gold, profit, price, token, pnutz, ape):
  Responses: "Fortune favors those who hold with diamond hands...", "The vaults overflow for the patient...", "I see green candles stretching to the heavens...", "Your bags shall multiply tenfold before the next eclipse...", "The oracle sees whales gathering in your waters..."
  Crystal ball color: #ffd700 (gold), oracle light: gold

Category LOVE (keywords: love, heart, romance, relationship, partner, soul):
  Responses: "Two souls orbit each other like binary stars...", "The heart knows what the mind refuses to see...", "Love approaches from an unexpected direction...", "What you seek is also seeking you...", "The oracle sees a connection that transcends the digital realm..."
  Crystal ball color: #ff69b4 (pink), oracle light: pink

Category GUIDANCE (keywords: help, lost, confused, advice, direction, stuck, what should):
  Responses: "The path reveals itself to those who take the first step...", "Confusion is merely wisdom in chrysalis form...", "Look not outward but inward — the answer hums in your code...", "Release what no longer serves you and the way clears...", "The obstacle IS the path, builder..."
  Crystal ball color: #00bfff (cyan), oracle light: cyan

Category DANGER (keywords: warning, danger, risk, careful, fear, worried, bad):
  Responses: "Tread carefully — not all that glitters is NFT gold...", "The oracle senses turbulence but also opportunity within it...", "Guard your seed phrase as a dragon guards its hoard...", "Volatility is the price of participation — stay grounded...", "What you fear has less power than you imagine..."
  Crystal ball color: #ff4444 (red), oracle light: red

Category DEFAULT (no keyword match):
  Responses: "The crystal ball swirls but your question drifts like smoke...", "Ask again, and speak with intention...", "The oracle perceives many things but clarity requires specificity...", "Hmm... the cosmic static is thick today. Try once more...", "Your energy is strong but your question is shrouded..."
  Crystal ball color: #ffffff (white pulse), oracle light: white

On prompt event:
1. "Thinking" phase (2 seconds): crystal ball m-light intensity oscillates rapidly (sin(time*10) * 3), oracle figure rx tilts forward slightly
2. Determine category by checking if any keyword exists in lowercase user text
3. Pick random response from that category
4. Change crystal ball emissive color + m-light color to category color
5. Typewriter effect: m-label positioned above oracle (y=4, font-size=20), start with content="" and add one word every 150ms via setInterval until full response displayed
6. Hold response for 5 seconds
7. Fade: reduce m-label opacity from 1 to 0 over 2 seconds (setAttribute opacity decreasing per frame), then remove label
8. Reset crystal ball to default purple glow
9. Ready for next prompt

Write the complete file. Every line. All 30 responses. All keyword lists.
```

---

### BUILD 5 — PROCEDURAL TERRAIN + WEATHER 🌋

```
Build a complete MML document: PROCEDURAL TERRAIN + WEATHER SYSTEM

Terrain generation:
- 15x15 grid of m-cube elements (width=1, depth=1)
- Height from simplex noise: y = noise2D(gx*0.2, gz*0.2) * 4 + noise2D(gx*0.5, gz*0.5) * 1.5
- Height of each cube = max(0.2, abs(height)): set height attribute
- Color via chroma-js: chroma.scale(['#228B22','#8B7355','#A0A0A0','#FFFFFF']).domain([-2, 0, 3, 5])
- Store all grid elements and their heights in an array for reference

Trees: place at positions where terrain height is between 0 and 2 (forest zone). For each valid position (skip some randomly for natural spacing — use seeded random):
- Trunk: m-cylinder (radius=0.08, height=0.6, color="#8B4513")
- Canopy: m-sphere (radius=0.3, color="#228B22")
- Position: on top of terrain cube at that grid position

Rocks: place at positions where height > 2.5:
- m-cube (width=0.3, height=0.3, depth=0.3, color="#888888", rx/ry/rz=random rotation)

Minimap: node-canvas (200x200) renders top-down view:
- Each grid cell = colored pixel matching terrain color
- Green dots for trees, grey dots for rocks
- Serve via express, display as m-image (width=2, height=2) floating at y=10 above terrain center

Weather state machine — cycles every 45 seconds through: CLEAR → CLOUDY → RAIN → STORM → CLEAR

CLEAR state:
- Directional m-light: color="#FFFFCC", intensity=1.5
- No particles

CLOUDY state:
- Light dims: color="#CCCCCC", intensity=0.8
- Spawn 10 cloud m-sphere elements (radius=1.5, color="#AAAAAA", opacity=0.6) at y=8
- Clouds drift via noise: x += noise2D(cloudIndex, time) * 0.02 per frame

RAIN state:
- Light dims more: color="#888899", intensity=0.4
- Keep clouds
- Spawn 50 raindrop m-cylinder elements (radius=0.02, height=0.3, color="#4488FF")
- Raindrops: y decreases by 0.3 per frame. When y < terrain height at their x/z → reset to y=8 with random x/z

STORM state:
- Light: color="#444466", intensity=0.2 baseline
- Every 2-3 seconds: lightning flash = m-light intensity spikes to 5.0 for 100ms then back to 0.2
- Spawn "CRACK" m-label at random position, remove after 500ms
- Terrain m-group slight shake: parent group rx oscillates +-0.5 degrees

Transition between states: when switching, clean up old state's particles, spawn new state's elements.

Write the complete file. Every line. All weather states fully implemented.
```

---

### BUILD 6 — PHYSICS CASINO 🎰

```
Build a complete MML document: PHYSICS CASINO

Casino floor: m-plane (width=20, height=20, color="#1a472a") — green felt. m-light type="point" above each game (warm color, intensity=1).

SLOT MACHINE (x=-4, z=0):
- Cabinet: m-cube (width=2, height=3, depth=1, color="#cc0000") as body
- 3 reel displays: 3 m-image elements (each width=0.5, height=0.5) side by side
- node-canvas renders each reel: 6 symbols drawn as colored shapes/text on 100x100 canvas:
  symbols = ["🍒", "7️⃣", "💎", "🍋", "⭐", "🎰"] — draw as colored text or colored rectangles with letter
- "SPIN" m-label below machine
- On spin (auto-spin every 10 seconds): 
  - Rapid image updates for 2 seconds (change symbol offset every 100ms = blur effect)
  - Each reel stops at random symbol 0.5s apart (reel 1 stops, then reel 2, then reel 3)
  - If all 3 match: "JACKPOT!" m-label (font-size=60, color="#FFD700") + cannon-es confetti explosion (30 m-cube elements, mass=0.1, random colors, impulse upward+outward, gravity pulls them down)
  - Clean up confetti after 5 seconds

DICE TABLE (x=4, z=0):
- Table surface: m-cube (width=3, height=1, depth=2, color="#1a472a") with m-cube legs
- 2 dice: m-cube elements (width=0.3, color="#FFFFFF")
- cannon-es rigid bodies: Box shape, mass=1, friction=0.8, restitution=0.3
- Roll every 12 seconds: apply random torque (angularVelocity random Vec3 * 10) + throw impulse (upward + forward)
- Track position and quaternion→euler→rx/ry/rz to MML attributes
- Dice settle on table surface (table = cannon-es static Plane body at y=1)
- Result: sum of two random 1-6 values (physics is visual, result is random)
- m-label shows result: "Rolled: X + Y = Z"

ROULETTE (x=0, z=-5):
- Wheel: m-cylinder (radius=1.5, height=0.1, color="#2a0000") — rotates ry continuously, decelerating
- Ball: m-sphere (radius=0.08, color="#FFFFFF") — starts at edge, spirals inward as wheel slows
  - Ball position: parametric spiral (radius decreases over time, angle increases, y stays on wheel surface)
  - When wheel nearly stopped: ball settles at random position
- m-label announces result: random number 0-36 + "RED"/"BLACK"

Scoreboard: node-canvas (400x200) renders:
- "CASINO ROYALE" header
- Slot wins/losses count
- Dice roll history (last 5)
- Total "chips" running count
Serve via express → m-image (width=3, height=1.5) mounted on wall (m-cube backing)

Write the complete file. Every line. All three games fully functional.
```

---

### BUILD 7 — GEEZ BATTLE ROYALE 🦍

```
Build a complete MML document: GEEZ BATTLE ROYALE ARENA

Arena: m-cylinder (radius=6, height=0.2, color="#4a4a4a") as floor. m-cylinder ring ropes (radius=6.2, height=0.05, color="#ff0000") at y=0.5, y=1.0, y=1.5 (3 ropes). Corner posts: 4 m-cylinder (radius=0.1, height=2, color="#888888") at compass points on ring edge.

Fighter A: m-cube body (width=0.6, height=1.0, depth=0.3, color="#FF4444") + m-sphere head (radius=0.2, color="#FF6666") at y offset. Group together in m-group. Start at x=-3, z=0.
Fighter B: same structure, color="#4444FF" / "#6666FF". Start at x=3, z=0.

Both fighters have cannon-es Bodies (Box shape, mass=5).

State machine (runs at 30fps, shared timer):

APPROACH (2 seconds):
- Both fighters move toward center: interpolate x toward 0 at speed 0.05/frame
- Both face each other (ry toward opponent)

ATTACK (0.5 seconds):
- Random attacker (A or B). Attacker lunges forward: x changes 0.3/frame toward opponent
- Attacker group tilts forward: rx = 15

HIT_CHECK (instant):
- 70% chance hit, 30% chance miss (seeded random)
- If hit: defender loses 15-25 HP (random). Flash defender red (color → #FF0000 for 200ms then back)
- If miss: attacker stumbles (rx = -10 briefly)

KNOCKBACK (1 second):
- If hit: cannon-es impulse on defender body: direction = away from attacker, magnitude = 8 + (damage * 0.3)
- Track physics body position to MML group attributes for realistic knockback
- If defender near edge (distance from center > 5): bonus knockback, teetering

RECOVER (1.5 seconds):
- Both return to ready positions (interpolate back toward starting x)
- Reset rotations to neutral

Health system:
- Fighter A HP: starts 100. Fighter B HP: starts 100.
- Health bars: node-canvas (400x60) renders two colored bars (red/blue), percentage fill. Serve via express → m-image (width=4, height=0.5) floating above arena at y=4.
- Update health bar image after each hit.

KO sequence (when any HP ≤ 0):
- Loser: remove from cannon-es control. Animate: ry spins 720 degrees over 2 seconds, y drops to -1 (falls through floor). Color flashes.
- Winner: stays in place. "VICTORY" m-label above winner (font-size=48, color="#FFD700"), scales up.
- "KNOCKOUT!" m-label center arena (font-size=72, color="#FF0000")
- 8 spectator m-cubes around ring edge: all jump (y oscillates 0→0.5→0 three times)
- Crowd "OHHH!" m-label fades in/out

Scoreboard: m-label tracking "Fighter A: X wins | Fighter B: Y wins"

After 5 seconds: reset both fighters to full HP, starting positions. New round begins. Loop forever.

Write the complete file. Every line. Full state machine. Full health bar rendering.
```

---

### BUILD 8 — FLIGHT TRACKER GLOBE 🌍

```
Build a complete MML document: LIVE FLIGHT TRACKER GLOBE

Globe: m-sphere (radius=3, color="#1a3a5c") at y=4. Globe stand: m-cylinder (radius=0.3, height=3, color="#444444") below it.

Globe rotates slowly: ry increases 0.1 per frame.

Approximate continents: place flat m-plane shapes (green, small, positioned on globe surface at approximate lat/lon of landmasses) OR use a simple node-canvas texture of world map served as m-image mapped conceptually (just have the globe be blue with the image as reference).

Fetch from OpenSky Network API every 60 seconds (free, no key):
  https://opensky-network.org/api/states/all?lamin=25&lamax=55&lomin=-130&lomax=50
(Filter to North America/Europe region to limit results)

Take first 40 planes from response. Each plane has: callsign (index 1), longitude (index 5), latitude (index 6), altitude (index 7), velocity (index 9), heading (index 10).

Convert lat/lon to 3D position on globe surface:
  const R = 3.1; // slightly above globe radius
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const px = R * Math.cos(latRad) * Math.cos(lonRad);
  const py = R * Math.sin(latRad);
  const pz = R * Math.cos(latRad) * Math.sin(lonRad);

IMPORTANT: these positions must account for globe's own rotation (ry offset), so subtract globe's current ry from each plane's lonRad calculation, OR parent all planes inside the globe's m-group so they rotate with it.

Each plane: m-cube (width=0.1, height=0.02, depth=0.05, color="#FF8800") — flat rectangle representing airplane. Position from conversion above. ry = heading from API data.

Trail: for each plane, keep last 3 positions. Place tiny m-sphere (radius=0.02, color="#FF8800", opacity=0.3/0.2/0.1) at previous positions = fading trail.

Callsign labels: m-label (font-size=6, color="#FFFFFF") near each plane showing callsign. Only show for first 10 planes to reduce clutter.

Cloud layer: m-sphere (radius=3.3, color="#FFFFFF", opacity=0.15) surrounding globe — subtle cloud shell.

Info panel: m-label at bottom showing "Tracking X flights | Last updated: [time]"

Handle API errors: if fetch fails, show "SIGNAL LOST" m-label in red. Retry in 30 seconds. Keep showing last known positions.

Write the complete file. Every line. Full API integration with error handling.
```

---

### BUILD 9 — TORNADO DESTRUCTION 🌪️

```
Build a complete MML document: TORNADO DESTRUCTION

Landscape: m-plane (width=40, height=40, color="#4a7a3a") as ground.

Scatter 25 debris objects on the ground:
- 5 "cars": m-cube (width=0.8, height=0.4, depth=0.4, color="#cc4444")
- 5 "houses": m-cube (width=1.2, height=1.0, depth=1.0, color="#cc9966")
- 5 "trees": m-cylinder (radius=0.1, height=0.8, color="#8B4513") + m-sphere (radius=0.3, color="#228B22")
- 10 "misc debris": m-cube (random small sizes 0.1-0.3, random dark colors)
All placed at random x/z positions within +-15, y on ground. Each has cannon-es Body (mass based on type: car=5, house=10, tree=2, misc=0.5).

Tornado funnel visual:
- 8 rings stacked vertically (y=0.5 to y=8, spacing 1m apart)
- Each ring = 8 m-sphere elements (radius=0.15, color="#666666", opacity=0.7) arranged in circle
- Lower rings: larger circle radius (2m). Upper rings: smaller (0.3m). Linear interpolation.
- Each ring rotates at different speed: lower=slow, upper=fast. Track angle per ring, increment per frame.
- simplex-noise adds position jitter to each sphere: offset x/z by noise2D(sphereIndex, time) * 0.3

Tornado movement: tornado center x/z moves slowly across landscape. Path: x = sin(time * 0.1) * 10, z = time * 0.5 - 15 (sweeps across). Each frame update all funnel sphere positions relative to moving center.

Vortex force field: every frame, for each debris cannon-es body:
- Calculate distance to tornado center (xz plane only)
- If distance < 8m (capture radius):
  - Disable default gravity on this body
  - Radial pull: force toward tornado center, magnitude = 30 / (distance + 0.5)
  - Tangential spin: force perpendicular to radial direction, magnitude = 20
  - Upward lift: force y = 15 - body.position.y * 1.5 (lifts objects up, stabilizes at certain height)
  - Turbulence: add noise-based force offset on x/y/z, magnitude 5
  - Apply combined force via body.applyForce()
- If distance >= 8m: re-enable normal gravity, let debris fall/rest

Dust ring at base: 15 m-sphere (radius=0.1, color="#aa9966", opacity=0.5) expanding outward from tornado base in a ring, respawning at center.

Lightning: every 4-6 seconds (random): m-light at tornado top, intensity 0→8→0 over 150ms. "CRACK" m-label briefly.

Ground: darken ground m-plane color behind the tornado path (can't change individual sections, so leave as is or place dark m-plane strips behind tornado).

Write the complete file. Every line. Full vortex physics. Full funnel visual.
```

---

### BUILD 10 — BEAT-SYNCED STAGE 🎵

```
Build a complete MML document: BEAT-SYNCED MUSIC STAGE

Stage structure:
- Platform: m-cube (width=10, height=0.5, depth=6, color="#1a1a1a") at y=0.25
- Speaker stacks (4 total): m-cube (width=1, height=1.5, depth=1, color="#222222") at corners of stage
- Truss overhead: m-cylinder elements forming rectangular frame at y=5 (4 horizontal bars)
- DJ booth: m-cube (width=2, height=1, depth=1, color="#333333") center-back of stage
- Giant screen: m-plane (width=6, height=3, color="#000000") behind DJ booth at y=3.5
- "INCEPTIVE" m-label on screen (font-size=36, color="#00FF88")

Stage lights: 6 m-light elements:
- 2 type="spot" (red, blue) on front truss, pointing down at stage
- 2 type="spot" (green, purple) on back truss
- 2 type="point" (white) inside speaker stacks

Floor tiles: 4x3 grid of m-plane elements on stage surface (width=2, height=1.5 each) — these flash colors on beats.

Crowd: 20 m-sphere "heads" (radius=0.2, color="#ffccaa") in 4 rows of 5, placed in front of stage at z=5, spaced 1m apart.

Beat map — 60 seconds, then loops. Array of events:
[
  {t:0, type:"bass"}, {t:250, type:"hihat"}, {t:500, type:"bass"}, {t:750, type:"hihat"},
  {t:1000, type:"snare"}, {t:1250, type:"hihat"}, {t:1500, type:"bass"}, {t:1750, type:"hihat"},
  ...repeat this basic pattern with variations...
  {t:15000, type:"buildup_start"},
  {t:19000, type:"drop"},
  {t:19000, type:"bass"}, {t:19250, type:"bass"}, {t:19500, type:"bass"}, {t:19750, type:"snare"},
  ...intense pattern after drop...
  {t:30000, type:"breakdown"}, // quiet section
  {t:35000, type:"buildup_start"},
  {t:39000, type:"drop"},
  ...second drop pattern...
  {t:55000, type:"outro"},
]
Generate at least 120 beat events across 60 seconds covering bass, snare, hihat, buildup_start, drop, breakdown, outro.

Beat response system (runs in game loop, check elapsed time against beat map):

"bass": 
- Speaker stacks: sy pulses 1.0→1.3→1.0 over 200ms
- Random floor tile changes to random bright color for 200ms
- Stage m-light intensity spikes
- Crowd front row: y += 0.15 for 150ms then back

"snare":
- ALL lights flash white (color="#FFFFFF") for 50ms then back to original
- Screen flashes white

"hihat":
- One random spot light rotates ry by 30 degrees

"buildup_start":
- Over 4 seconds: all lights gradually increase intensity from 0.5 to 3.0
- Floor tiles cycle colors faster and faster
- Crowd starts bouncing (y oscillation increases)

"drop":
- ALL lights change to random bright colors simultaneously
- All speakers pulse sy to 1.5
- Confetti: spawn 40 m-cube (tiny, random colors) at y=6, cannon-es impulse outward+down
- ALL crowd spheres jump y += 0.4
- Screen m-label changes to "🔥🔥🔥" briefly

"breakdown":
- Lights dim to 0.3 intensity, cool blue colors
- Crowd stops bouncing
- Screen shows "INCEPTIVE PRESENTS" fading in (opacity 0→1)

"outro":
- Slow fade all lights
- Screen: "INCEPTIVE STUDIO" m-label

Clean up confetti after each drop (remove after 4 seconds). Track playhead time, loop back to 0 at 60000ms.

Write the complete file. Every line. Full 120+ event beat map. All responses implemented.
```

---

### BUILD 11 — JENGA TOWER 🏗️

```
Build a complete MML document: JENGA TOWER WITH REAL PHYSICS

Tower: 18 layers × 3 blocks per layer = 54 blocks total.
Each block: m-cube (width=0.75, height=0.25, depth=0.25, color="#deb887") — wood colored.
cannon-es Body per block: Box shape matching dimensions, mass=1, friction=0.8, restitution=0.1.

Stack layout:
- Even layers (0, 2, 4...): 3 blocks side by side along X axis (z offset between blocks)
- Odd layers (1, 3, 5...): 3 blocks side by side along Z axis (x offset between blocks)
- Each layer at y = layerIndex * 0.25 + 0.125

Ground: cannon-es static Plane body + m-plane visual.

Game loop at 30fps: step physics, update all 54 block positions and rotations from cannon-es bodies.

Pull sequence: every 6 seconds, pick a random block that is NOT in the top 2 layers:
- Apply slow force pulling it outward (away from tower center on x or z depending on layer orientation)
- Force magnitude = 3, applied over 1.5 seconds
- If block slides out cleanly and tower stands: "STILL STANDING!" m-label (font-size=36, color="#00FF00") for 2 seconds
- Track pull count on m-label: "Blocks pulled: X"

Collapse detection: if any block above layer 3 falls below its original y by more than 0.5m, or if horizontal spread of top-layer blocks exceeds 2m → tower has collapsed.

Collapse response:
- "TIMBER!" m-label (font-size=72, color="#FF4444")
- Let physics play out naturally for 5 seconds — all 54 blocks tumble, bounce, settle independently
- Dust burst: 20 m-sphere (tiny, grey, opacity=0.5) expand outward from tower base, fade out
- After 5 seconds: "Survived X pulls!" m-label

Rebuild: after 8 seconds total, remove all block MML elements, remove all cannon-es bodies. Recreate the full 54-block tower from scratch. Reset pull counter. Begin again.

Write the complete file. Every line. Full 54-block setup. Full physics. Full collapse detection.
```

---

### BUILD 12 — LIVE MINIMAP RADAR 📡

```
Build a complete MML document: LIVE MINIMAP RADAR

Radar station:
- Base: m-cube (width=2, height=1, depth=2, color="#333333") at y=0.5
- Screen mount: m-cube (width=1.5, height=1.5, depth=0.1, color="#222222") at y=1.75, tilted rx=-20 (angled toward viewer)
- Radar display: m-image (width=1.4, height=1.4) on the screen surface
- Antenna: m-cylinder (radius=0.05, height=2, color="#888888") on top of base + m-plane (width=0.5, height=0.1, color="#AAAAAA") as dish — antenna group rotates ry continuously, 3 degrees per frame

Radar image (node-canvas 400x400, served via express):
- Background: dark green (#001a00)
- Distance rings: 3 concentric circles (strokeStyle="#003300", lineWidth=1) — drawArc
- Crosshairs: horizontal + vertical lines through center (#003300)
- Sweep line: bright green line (#00FF44) from center to edge at current sweep angle. Sweep angle increases 6 degrees per render (matches antenna rotation)
- Trail: draw previous 30 degrees of sweep as gradient from green to transparent (fading trail behind sweep)
- Blips: 5-10 simulated "contacts" at random positions on radar. Draw as bright green dots (#00FF88, radius=4px). Blips slowly drift (random walk each frame by 1-2px).
- Text overlay: "RADAR ACTIVE" top-left, current sweep angle bottom-right
- Border: thin green rectangle outline

Update radar image every 200ms (5fps is fine for radar look). Sweep line and blips update each render. m-image refreshes with cache-bust URL.

Ambient effects:
- m-light (type="point", color="#00FF44", intensity=0.5) inside screen — green glow
- "SCANNING..." m-label below radar that blinks (toggle visible every 1 second)
- Small m-sphere (color="#00FF00", emissive="#00FF00") as indicator light on base — blinks

Write the complete file. Every line. Full canvas radar rendering. Full antenna sync.
```

---

### BUILD 13 — GENERATIVE ART GALLERY 🎨

```
Build a complete MML document: GENERATIVE ART GALLERY

Gallery room:
- Floor: m-plane (width=16, height=12, color="#2a2a2a")
- Walls: 4 m-cube elements forming walls (thin depth=0.1, tall height=4, long width matching room). color="#3a3a3a"
- Ceiling: m-plane at y=4 (color="#2a2a2a", flipped)
- 8 spot lights along ceiling (m-light type="spot", intensity=1, warm white) pointing down at painting positions

10 painting frames along walls:
- Each frame: m-cube backing (width=1.6, height=1.2, depth=0.05, color="#8B7355") as frame
- m-image (width=1.5, height=1.1) on front of frame — displays generated art
- m-label below each frame: title text (font-size=10)

Art generation (node-canvas 600x440 per painting, 10 canvases):

Generation algorithm — 5 different styles, 2 paintings each:

Style 1 — FLOW FIELD: simplex-noise flow field. 2000 particles, each follows noise gradient. Trail = colored line segments. chroma-js palette from random seed. Creates organic swirling patterns.

Style 2 — NOISE GRADIENT: direct noise-to-color mapping. For each pixel (sample every 4px for speed), compute noise2D(x*0.01, y*0.01) → map to chroma-js gradient. Layered with different frequencies = rich color fields.

Style 3 — GEOMETRIC: randomly placed circles, rectangles, triangles with noise-influenced colors and positions. Overlap creates depth. Semi-transparent fills.

Style 4 — GRID DISTORTION: regular grid of circles/squares where position is offset by noise, size varies by noise, color from chroma palette.

Style 5 — LINE ART: parallel lines across canvas with y-offset per line influenced by noise. Different colors per line group. Creates topographic/wave effect.

Serve all 10 images via express (/art/0.png through /art/9.png).

Regeneration: every 90 seconds, regenerate all 10 paintings with new random seeds. Update m-image src with cache-bust. New titles generated from word lists: adjective + noun (e.g., "Chromatic Whisper", "Digital Entropy", "Prismatic Drift").

Title word lists:
  adjectives = ["Chromatic", "Digital", "Prismatic", "Ethereal", "Quantum", "Nebular", "Fractal", "Synthetic", "Harmonic", "Lucid"]
  nouns = ["Whisper", "Entropy", "Drift", "Echo", "Pulse", "Bloom", "Cascade", "Mirage", "Nexus", "Vortex"]

m-prompt in gallery center: message="Influence the art:" placeholder="more blue, geometric, chaotic..."
On prompt event: parse keywords:
- Color words (blue, red, warm, cool, dark, bright): shift chroma-js palette toward that direction
- Style words (geometric, organic, lines, circles, chaotic, calm): weight style probabilities
- Apply as parameters on next regeneration cycle
- Show "Art evolving..." m-label briefly

Write the complete file. Every line. All 5 generation styles fully coded. Full prompt interaction.
```

---

### BUILD 14 — ROCKET LAUNCH 🚀

```
Build a complete MML document: ROCKET LAUNCH WITH REAL THRUST PHYSICS

Launch pad: m-cube (width=4, height=0.3, depth=4, color="#555555") as platform. m-cylinder supports underneath. m-cube tower/gantry next to pad (tall, thin structure with horizontal arms).

Rocket: m-group containing:
- Body: m-cylinder (radius=0.3, height=3, color="#FFFFFF")
- Nose cone: m-sphere (radius=0.3, color="#FF4444") at top, squished sy=1.5
- Fins: 4 m-cube (thin, triangular approximation — width=0.5, height=0.4, depth=0.05, color="#444444") at base
- Booster section: m-cylinder (radius=0.35, height=1, color="#CCCCCC") at bottom

Rocket physics (NOT cannon-es — custom simulation for accuracy):
  State variables: altitude=0, velocity=0, mass=1000, fuel=800, thrust=15000, drag_coefficient=0.001
  
  Simulation at 30fps:
    if (fuel > 0 && engineOn):
      fuel -= fuelBurnRate (5 per frame)
      mass = dryMass + fuel  (200 + fuel)
      thrust_force = thrust
    else:
      thrust_force = 0
    
    gravity_force = mass * 9.82
    drag_force = drag_coefficient * velocity * velocity * sign(velocity)
    net_force = thrust_force - gravity_force - drag_force
    acceleration = net_force / mass
    velocity += acceleration * dt  (dt = 1/30)
    altitude += velocity * dt
    
    rocket_group.setAttribute("y", String(altitude + 2)) // +2 for pad height

COUNTDOWN SEQUENCE (choreography):
T-10 to T-0: m-label countdown (font-size=48, color="#FF4444") updates every second. "T-10", "T-9"... "T-1"... "IGNITION"
At T-3: exhaust starts (see below)
At T-0: engineOn = true, thrust begins

EXHAUST VISUALS:
- 15 m-sphere exhaust particles below rocket (color="#FF8800", emissive="#FF4400")
- Each particle: random x/z offset within 0.3m of center, y = rocket_y - 1.5 - random(0, 2)
- simplex-noise drives x/z wobble per particle
- Particles scale: sx/sy/sz pulse randomly 0.1-0.5
- As rocket rises, exhaust particles stay near rocket base (relative positions)

SMOKE TRAIL:
- Every 0.5 seconds while engine burns: spawn m-sphere (color="#AAAAAA", opacity=0.6, radius=0.5) at rocket's current y position
- Trail spheres stay in place (don't move with rocket)
- Trail spheres slowly expand (scale increases 0.02/frame) and fade (opacity decreases 0.005/frame)
- Remove when opacity < 0.05

STAGE SEPARATION (when altitude > 200):
- Booster m-group detaches: start independent y simulation (velocity at separation, no thrust, gravity pulls back down)
- Booster tumbles: rx and rz increase per frame
- Main rocket continues with reduced mass (dryMass=200, no fuel section)
- "STAGE SEPARATION" m-label briefly

TELEMETRY DASHBOARD (node-canvas 600x300 via express):
- Dark background with green text/lines (mission control aesthetic)
- Altitude: numeric display + vertical bar chart
- Velocity: numeric display + line trace
- G-Force: numeric display (acceleration / 9.82)
- Fuel: percentage bar (green→yellow→red as depletes)
- Mission time: seconds since T-0
- Status text: "PRE-LAUNCH" → "POWERED FLIGHT" → "STAGE SEP" → "COAST"
Serve at /telemetry.png, update every 200ms. m-image (width=4, height=2) as floating screen at ground level.

"GO GO GO!" m-label and crowd cheering labels at various milestones (altitude 50, 100, 200).

After rocket reaches altitude 500 (or 60 seconds): "MISSION COMPLETE" sequence. Reset everything. Countdown restarts.

Write the complete file. Every line. Full physics simulation. Full telemetry. Full choreography.
```

---

### BUILD 15 — PIRATE SHIP BATTLE 🏴‍☠️

```
Build a complete MML document: PIRATE SHIP BATTLE

Ocean: same as Build 2 — 20x20 grid of m-plane tiles with simplex-noise wave heights and chroma-js colors. Copy that exact ocean implementation.

Ship A (player — red flag): m-group at x=6, z=0 containing:
- Hull: m-cube (width=1, height=0.5, depth=3, color="#8B4513")
- Deck: m-cube (width=0.9, height=0.05, depth=2.8, color="#A0522D") at y=0.25
- Mast: m-cylinder (radius=0.05, height=2, color="#8B4513") at y=0.5
- Sail: m-plane (width=1, height=1.2, color="#FFFFEE") at y=1.2 on mast
- Flag: m-plane (width=0.3, height=0.2, color="#FF0000") at mast top
- 3 cannon positions: m-cylinder (radius=0.05, height=0.3, color="#333333", rx=90) on starboard side

Ship B (enemy — blue flag): same structure, color="#2244AA" hull, blue flag. Start at x=-6, z=0.

Both ships bob on waves (sample wave heights at ship position, compute y/rx/rz — same as Build 2).

Ship movement: both ships follow circular paths around center. Ship A: angle increases 0.3 deg/frame, radius=6. Ship B: angle increases 0.25 deg/frame, radius=7 (slightly wider orbit, opposite direction). x = radius * cos(angle), z = radius * sin(angle). ry = angle + 90 (face direction of travel).

BATTLE CHOREOGRAPHY (state machine):

SAILING (5 seconds): ships circle, closing distance.

BROADSIDE_A (Ship A fires):
- 4 cannonball m-sphere (radius=0.08, color="#222222") spawn at Ship A cannon positions
- cannon-es bodies: initial velocity = direction toward Ship B * 12 + upward * 5
- Parabolic arcs tracked to m-sphere positions
- "FIRE!" m-label at Ship A briefly

FLIGHT (2 seconds): cannonballs in air. Track positions.

HIT_CHECK:
- For each cannonball: if distance to Ship B center < 2m → HIT
- Hit: "BOOM!" m-label at impact. Ship B rocks violently (rx += 20 over 200ms, spring back). Flash m-light red. Ship B HP -= 20.
- Miss: cannonball splashes into ocean (y drops below wave, remove with splash = brief white m-sphere expansion)
- Remove all cannonballs

SAILING_2 (5 seconds): ships continue circling.

BROADSIDE_B (Ship B fires): same as A but from Ship B toward Ship A. Ship A takes damage on hit.

Repeat cycle.

Health: both ships start 100 HP. Track via m-label above each ship: "HP: XX"

SINKING (when HP ≤ 0):
- Losing ship: rx tilts 30 degrees (listing). y decreases 0.01/frame (sinking below waves). ry spins slowly.
- Crew overboard: spawn 3 m-sphere (skin color, small) bobbing on waves near sinking ship
- "SHE'S GOING DOWN!" m-label
- Treasure: m-cube (color="#FFD700", width=0.3) floats up from sinking position, bobs on waves
- Winner: "VICTORY!" m-label. "ARRR!" m-label.
- Debris: 10 m-cube (small, wood color) scatter on wave surface, bob with noise

After 10 seconds: reset both ships to full HP, starting positions. New battle.

Write the complete file. Every line. Full ocean. Full ship combat. Full sinking sequence.
```

---

### BUILD 16 — L-SYSTEM GROWING FOREST 🌸

```
Build a complete MML document: L-SYSTEM GROWING FOREST

Ground: m-plane (width=20, height=20, color="#3a5a2a").

L-System tree generation:
- Axiom: "F"
- Rules: "F" → "FF+[+F-F-F]-[-F+F+F]"
- Iterations: 3 (produces complex branching)
- Interpret string: F=draw branch forward, +=turn right 25°, -=turn left 25°, [=push state, ]=pop state

Implementation:
- Process L-system string to generate array of branch segments, each with: startPos, endPos, depth (iteration level)
- Each branch = m-cylinder element:
  - Position: midpoint of start/end
  - Rotation: calculated from direction vector (atan2 for ry, acos for rx)
  - Radius: 0.05 / (depth+1) (thinner at higher iterations)
  - Height: segment length
  - Color: "#8B4513" (brown)
- Leaves at branch tips: m-sphere (radius=0.15, color="#228B22")

Generate 5 trees at random positions on the ground. Each tree uses slightly different random angle variation (±5° on the 25° base angle) for variety.

GROWTH ANIMATION (60 seconds per tree lifecycle):
- All branches start at scale 0
- Over 60 seconds, progressively reveal branches:
  - Seconds 0-15: trunk and first-level branches grow (sx/sy/sz 0→1)
  - Seconds 15-30: second-level branches grow
  - Seconds 30-45: third-level branches + leaves appear (scale 0→1)
  - Seconds 45-60: fully grown, flowers bloom

Flowers: at 5 random branch-tip positions per tree, m-sphere (radius=0.08) with colors cycling through: "#FF69B4", "#FF1493", "#FFD700", "#FF6347". Scale from 0 to 1 during bloom phase.

Butterflies: 3 m-plane elements (width=0.1, height=0.05, color=random bright). Flight path: bezier-like curves driven by noise:
  x = baseX + noise2D(butterflyIndex, time * 0.3) * 3
  y = 1.5 + noise2D(butterflyIndex + 100, time * 0.4) * 1
  