# MML BUILDS — Part 2 (continued from Part 1)

---

### BUILD 16 — L-SYSTEM GROWING FOREST 🌸 (continued)

```
(Continued from Part 1 — paste after Prompt A)

Build a complete MML document: L-SYSTEM GROWING FOREST

Ground: m-plane (width=20, height=20, color="#3a5a2a").

L-System tree generation:
- Axiom: "F"
- Rules: "F" → "FF+[+F-F-F]-[-F+F+F]"
- Iterations: 3
- Interpret: F=draw branch forward, +=turn right 25°, -=turn left 25°, [=push state, ]=pop state

Process L-system string into branch segments: each has startPos, endPos, depth level.
Each branch = m-cylinder:
  - Position at segment midpoint
  - Rotation from direction vector
  - Radius: 0.05 / (depth+1) — thinner deeper branches
  - Height: segment length
  - Color: "#8B4513"
Leaves at tips: m-sphere (radius=0.15, color="#228B22")

Generate 5 trees at random ground positions. Each has slight angle variation for uniqueness.

GROWTH ANIMATION (60 seconds):
- Seconds 0-15: trunk + first branches scale from 0→1
- Seconds 15-30: second-level branches grow
- Seconds 30-45: third-level branches + leaves appear
- Seconds 45-60: fully grown, flowers bloom

Flowers: at 5 random tips per tree. m-sphere (radius=0.08) cycling colors: "#FF69B4", "#FF1493", "#FFD700", "#FF6347". Scale 0→1 during bloom.

Butterflies: 3 m-plane elements (width=0.1, height=0.05, bright colors). Noise-driven bezier flight:
  x = baseX + noise2D(index, time*0.3) * 3
  y = 1.5 + noise2D(index+100, time*0.4) * 1
  z = baseZ + noise2D(index+200, time*0.3) * 3
"Wing flap" = ry oscillates ±30° via sin(time*8).

Fireflies (appear during NIGHT): 8 m-sphere (radius=0.03, emissive="#FFFF00", emissive-intensity=3) with noise-driven slow drift. m-light type="point" color="#FFFF00" intensity oscillates 0↔0.5 (flickering glow).

DAY/NIGHT CYCLE (120 seconds = full day):
- Dawn (0-15s): directional m-light color shifts from "#FF8844" to "#FFFFCC", intensity 0.3→1.5
- Day (15-60s): bright warm light "#FFFFCC" intensity 1.5
- Dusk (60-75s): light shifts to "#FF6633", intensity 1.5→0.3
- Night (75-120s): light color "#222244" intensity 0.1. Fireflies appear. Stars = 20 tiny m-sphere (emissive white, high y=15, spread across sky)

SEASON CYCLE (4 minutes = 4 seasons, each season 60s):
- SPRING: growth animation plays. Green leaves. Flowers bloom.
- SUMMER: fully grown. Bright green. Butterflies active.
- AUTUMN: leaf m-spheres change color via chroma-js: green → "#FF8C00" → "#FF4500" → "#8B0000". Gradual over 60 seconds.
- WINTER: leaf scales shrink to 0 (bare branches). Snow: 30 m-sphere (radius=0.03, color="#FFFFFF") falling slowly (y decreases 0.02/frame, noise drift on x/z, respawn at y=8 when y<0). Ground color changes to "#EEEEEE".

Then spring again — regrow. Full cycle in 4 minutes.

Write the complete file. Every line. Full L-system computation. All seasons. Day/night cycle. Butterflies and fireflies.
```

---

### BUILD 17 — WRECKING BALL DEMOLITION 🎯

```
Build a complete MML document: WRECKING BALL DEMOLITION

Crane: m-group at x=-5:
- Base: m-cube (width=2, height=1, depth=2, color="#FFCC00")
- Arm: m-cube (width=0.3, height=0.3, depth=8, color="#FFCC00") at y=6, angled slightly (rx=-5)
- Cabin: m-cube (width=1, height=1, depth=1, color="#333333") at y=5
- Cable: m-cylinder (radius=0.02, height=4, color="#888888") hanging from arm tip

Wrecking ball: m-sphere (radius=0.6, color="#333333", metalness=1, roughness=0.2) at cable end.

Pendulum physics with cannon-es:
- Pivot point: cannon-es static Body at arm tip position
- Ball: cannon-es Body (mass=50, Sphere shape radius 0.6)
- PointToPointConstraint connecting pivot to ball (cable length = 4m)
- Apply initial sideways impulse to start swinging. Let pendulum physics do the rest.
- Damping on ball body: 0.01 (very low — keeps swinging)
- Each swing gets a small impulse boost to maintain energy (apply lateral force at top of swing)

Cable visual: update m-cylinder position and rotation each frame to connect pivot point to ball position. Midpoint of the two = cylinder position. Direction vector = cylinder rotation.

Building: grid of m-cube blocks:
- 6 wide × 8 tall × 2 deep = 96 blocks
- Each block: m-cube (width=0.5, height=0.5, depth=0.5)
- Colors: alternate "#cc9966" (brick) and "#999999" (concrete) rows
- Each block = cannon-es Body (mass=2, Box shape, friction=0.7, restitution=0.1)
- Stacked with slight random offset (±0.01) for natural look
- Position building at x=2 (in path of ball swing)

Ground: cannon-es static Plane + m-plane visual (color="#555555", width=20)

Impact:
- Ball swings into building → cannon-es collision events trigger
- Blocks fly off based on physics impulse from ball impact
- Track ALL 96 block positions + rotations from cannon-es each frame
- Blocks tumble, bounce, pile up realistically

Dust burst: on first major collision (detect via collision event), spawn 15 m-sphere (color="#AA9966", opacity=0.5, small radius) at impact point. Expand outward (position += random direction * 0.1/frame). Fade opacity. Remove after 2 seconds.

"WRECKED" m-label appears after building collapsed (detect: if most blocks are below original y by >1m). Counter: "Blocks displaced: X" based on how many blocks moved significantly from start position.

Cycle: after 10 seconds post-collapse, remove all blocks and physics bodies. Generate NEW random building (vary dimensions: width 4-8, height 6-10, depth 1-3). Reposition ball. Apply new swing impulse. Demolish again.

Write the complete file. Every line. Full 96-block building. Full pendulum physics. Full collision response.
```

---

### BUILD 18 — BLOCKCHAIN EVENT VISUALIZER 📡

```
Build a complete MML document: BLOCKCHAIN EVENT VISUALIZER

Scene:
- Ground: m-plane (width=15, height=15, color="#0a0a1a")
- Portal: m-group at x=-5 containing: m-cylinder ring (radius=1.5, height=0.1, color="#8800ff", emissive="#8800ff", emissive-intensity=2) standing vertically (rx=90) + m-light (type="point", color="#8800ff", intensity=2)
- Collection zone: m-cube platform (width=3, height=0.1, depth=3, color="#1a1a3a") at x=5

Blockchain data fetch:
Poll ApeChain public RPC every 15 seconds. Use JSON-RPC call:
  POST to https://rpc.apechain.com/http (or appropriate ApeChain RPC endpoint)
  Body: {"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest", true],"id":1}
  Parse response for transactions in the latest block.

Alternative if RPC is complex: use a public block explorer API or simply simulate realistic transaction data with random generation (random amounts, random addresses) that looks authentic. Label it "SIMULATED" if simulating. Provide the real RPC implementation as commented code ready to swap in.

For each transaction detected (or simulated):

Token spawn sequence:
1. Create token m-group at portal position containing:
   - m-cube (width=0.3, height=0.3, depth=0.05, color="#FFD700") as token shape
   - m-label (font-size=6, content=shortAmount) below token
2. cannon-es Body: mass proportional to transaction value (0.5-5), initial position at portal
3. Apply impulse: direction toward collection zone (x=5) with upward arc component. Magnitude = 5 + random(0,5). Upward = 3 + random(0,3).
4. Token flies in parabolic arc, lands in collection zone, bounces, settles
5. Track physics body → MML attributes each frame

Visual scaling by transaction size:
- Small tx (<1 value): scale 0.5, color="#C0C0C0" (silver)
- Medium tx (1-100): scale 1.0, color="#FFD700" (gold)
- Large tx (100-1000): scale 1.5, color="#FFD700", emissive="#FFD700"
- WHALE tx (>1000): scale 2.5, color="#FF4400", emissive="#FF4400", emissive-intensity=3
  - "🐋 WHALE ALERT" m-label (font-size=36, color="#FF4400") scales up at portal. Flash m-light red.
  - Explosion particles at portal: 20 m-sphere (small, random colors), cannon-es impulse burst

Special event types (if detectable):
- Staking events: green glow on token (emissive="#00FF88")
- Burns: red fire particles (5 m-sphere, color="#FF4400", orbiting token as it flies, shrinking)

Collection zone: as tokens pile up, the pile grows naturally via cannon-es stacking.

Scoreboard: node-canvas (500x250) renders:
- "APECHAIN LIVE" header
- "Block: #XXXXX"
- "Transactions this session: XX"
- "Total value: XX.XX"
- "Largest tx: XX.XX 🐋" (if whale detected)
- Running bar chart of tx count per block (last 10 blocks)
Serve via express → m-image (width=3, height=1.5) floating at y=3.

Activity breathing: portal m-light intensity scales with recent activity. Many txs = bright pulse. Few txs = dim steady glow. Specifically: intensity = 1 + (recentTxCount / 5), capped at 5.

Cleanup: when collection zone has >50 tokens, remove oldest ones (FIFO). Keep scene performant.

Write the complete file. Every line. Full RPC integration (with simulated fallback). Full physics arcs. Full whale detection.
```

---

### BUILD 19 — PROCEDURAL DUNGEON GENERATOR 🏰

```
Build a complete MML document: PROCEDURAL DUNGEON GENERATOR

Dungeon generation via Binary Space Partition (BSP):
1. Start with rectangle (0,0 to 30,30) — dungeon bounds
2. Recursively split: pick random horizontal or vertical line, divide space. Minimum room size = 4x4. Recurse 4 levels.
3. Within each leaf partition: carve a room (random size within partition, minimum 3x3, 1-cell margin from partition edge)
4. Connect rooms: for each split, connect the two child rooms with a corridor (1-cell wide path between room centers)
5. Store dungeon as 2D grid (30x30): 0=wall, 1=floor, 2=door, 3=corridor

Render dungeon in 3D:
- Each wall cell: m-cube (width=1, height=2, depth=1, color="#555555") at grid position
- Floor cells: m-plane (width=1, height=1, color="#3a3a2a") at y=0
- Door cells: m-cube (width=0.8, height=1.8, depth=0.1, color="#8B4513") — positioned in wall gap
- Corridor cells: m-plane floor (color="#4a4a3a", slightly different shade)

Torches: place every 4th wall cell adjacent to a floor cell:
- m-cylinder (radius=0.03, height=0.3, color="#8B4513") sticking out from wall at y=1.5
- m-light (type="point", color="#FF8800", intensity=0.8, distance=3) at torch tip
- Flame: m-cube (width=0.05, height=0.1, depth=0.05, color="#FF4400", emissive="#FF4400") with y oscillation via noise (flickering)

Treasure chests: place 3 randomly in rooms (not corridors):
- m-cube (width=0.4, height=0.3, depth=0.3, color="#8B7355") as chest body
- m-cube (width=0.4, height=0.05, depth=0.3, color="#FFD700") as gold lid
- m-light (type="point", color="#FFD700", intensity=0.3, distance=2) — subtle gold glow

Monsters: place 4 in rooms (one per large room):
- m-sphere head (radius=0.2, color="#44FF44", emissive="#44FF44", emissive-intensity=0.5) + m-cylinder body (radius=0.15, height=0.5, color="#336633") grouped
- m-light (type="point", color="#44FF44", intensity=0.3) — eerie green glow

Hero: m-group containing m-sphere head (radius=0.15, color="#FFD700") + m-cylinder body (radius=0.1, height=0.4, color="#4488FF"):
- A* pathfinding: hero auto-navigates from starting room to each treasure/exit
- A* implementation: grid-based, 4-directional, manhattan heuristic, avoid wall cells
- Hero moves 1 cell per 0.3 seconds (smooth interpolation between cells over the 300ms)
- Path: visit rooms in order, collect treasures, reach final room

Hero-Monster encounter: when hero enters cell adjacent to monster:
- Both stop for 2 seconds
- Flash m-lights rapidly (battle effect)
- Monster "defeated": scale monster to 0 over 1 second, remove
- "SLAIN!" m-label briefly
- Hero continues

Minimap: node-canvas (300x300) renders top-down dungeon view:
- Wall cells: dark grey pixels
- Floor cells: light pixels
- Hero position: bright yellow dot
- Monsters: green dots
- Treasure: gold dots
- Explored vs unexplored: cells hero has visited = bright, unvisited = dimmer
Serve via express → m-image (width=3, height=3) floating above dungeon at y=10.

REGENERATION: every 2 minutes (or when hero collects all treasure):
- "GENERATING NEW DUNGEON..." m-label
- Remove all dungeon elements
- Run BSP again with new random seed
- Rebuild all walls, floors, torches, chests, monsters
- Reset hero to new starting position
- Update minimap

Write the complete file. Every line. Full BSP implementation. Full A* pathfinding. Full minimap rendering.
```

---

### BUILD 20 — GEEZ HEIST: THE MOVIE 🦍

```
Build a complete MML document: GEEZ HEIST — THE MOVIE

This is a 3-minute looping animated film using ALL techniques: physics, noise, image generation, API data, choreography. Every action is driven by a master timeline.

CAST (all built from primitives since we need 4 distinct characters):
- Geez #1 "Boss": m-group with m-sphere head (radius=0.25, color="#8B4513"), m-cylinder body (radius=0.2, height=0.8, color="#333333"), m-label "BOSS" above
- Geez #2 "Tech": same structure, body color="#004488", label "TECH"
- Geez #3 "Muscle": slightly larger body (radius=0.25, height=0.9), color="#880000", label "MUSCLE"  
- Geez #4 "Driver": body color="#448800", label "DRIVER"

SETS:
- Bank exterior: m-cube building (width=8, height=5, depth=6, color="#CCCCBB") + m-cube columns (4 tall thin cubes at front) + m-label "APECHAIN NATIONAL BANK" (font-size=20)
- Vault interior: m-cube walls forming room (4 walls, dark grey), m-cylinder vault door (radius=1.5, height=0.2, color="#888888", metalness=1)
- Street: m-plane (width=30, height=8, color="#333333")
- Getaway truck: m-group with m-cube body (width=1.5, height=1, depth=3, color="#2a2a2a") + m-cube cabin (width=1.3, height=0.8, depth=1, color="#333333")
- Police car: m-group with m-cube body (width=1, height=0.6, depth=2, color="#FFFFFF") + m-light (type="point", color="#FF0000") + m-light (type="point", color="#0000FF")
- Money bags: m-sphere (radius=0.2, color="#8B7355") with "$" m-label on each
- Alarm light: m-light (type="point", color="#FF0000") on bank exterior
- Laser grid: thin m-cylinder (radius=0.01, height=3, color="#FF0000", emissive="#FF0000", emissive-intensity=3) horizontal beams in vault

MASTER TIMELINE — all actions keyed to elapsed milliseconds:

ACT 1 — THE SETUP (0ms - 40000ms):
  0ms: Night scene. Directional m-light: color="#222244", intensity=0.2. Street lamps: 3 m-light point yellow.
  0-5000ms: 4 Geez characters walk in from x=-15. Move x += 0.05/frame. Group together.
  5000ms: Characters stop at x=-2 near bank. Boss head nods (ry oscillates briefly).
  5000-8000ms: "The plan is simple..." m-label from Boss. Typewriter reveal.
  8000-10000ms: Characters spread into positions. Tech goes to side wall. Muscle to front door. Driver to truck (parked at x=-8).
  10000-15000ms: Tech "hacks": flash m-light near side wall. Small m-cube "laptop" appears. Blinking m-light green.
  15000-18000ms: Alarm light turns off (was pulsing). "Security disabled" m-label from Tech.
  18000-20000ms: Muscle approaches door. Door m-cube slides open (x += 0.1/frame). 
  20000-22000ms: Boss and Tech enter. "GO GO GO" m-label from Boss.
  22000-25000ms: Dramatic pause. Interior lights switch on (m-light intensity 0→1).
  25000-30000ms: Approach vault. Vault door visible. "That's a big door..." m-label from Muscle.
  30000-35000ms: Tech works on vault. Sparks = flickering m-light orange near door. "Almost..." label.
  35000-38000ms: VAULT OPENS. Door ry rotates 90 degrees over 3 seconds. Golden m-light spills out from inside.
  38000-40000ms: All three stare inside. "Jackpot." m-label from Boss.

ACT 2 — THE HEIST (40000ms - 90000ms):
  40000-45000ms: Interior of vault revealed: 10 money bag m-spheres stacked on m-cube shelves. Golden m-light warm glow.
  45000-50000ms: Boss and Muscle start grabbing bags. Each bag: detach from shelf, position follows character (offset by 0.3 on x).
  50000-60000ms: LASER GRID SEQUENCE. 5 horizontal red m-cylinder lasers across corridor. Tech must pass through.
    Tech character moves through laser field: choreographed z movement with y dips (ducking under high lasers) and y jumps (jumping over low lasers). Precise timing:
    52000ms: duck (y drops to 0.3) under laser at y=1.5
    54000ms: stand (y=1.0)
    55000ms: jump (y=1.8) over laser at y=0.5
    57000ms: duck again
    59000ms: through! "Piece of cake" m-label from Tech
  60000-65000ms: All characters have bags (2 each = 6 bags collected). Head for exit.
  65000ms: ALARM TRIGGERS. Red m-light starts pulsing rapidly (intensity oscillates 0↔3 at 5Hz). "🚨 ALARM!" m-label flashing. Siren = alternating red/white m-light.
  65000-70000ms: "RUN!" m-label from Boss. All characters sprint toward exit (x changes at 0.15/frame).
  70000-80000ms: Characters exit building. Night scene. Sprint to truck. Driver starts truck (truck m-light turns on).
  80000-90000ms: MONEY TOSS. Each character throws money bags into truck bed:
    cannon-es: 6 money bag bodies, each gets impulse toward truck (arc trajectory). Bags bounce in truck bed. Physics settles.
    "Get in!" m-label from Driver.
  
ACT 3 — THE ESCAPE (90000ms - 140000ms):
  90000-92000ms: All characters jump into truck (positions snap to truck group, become children of truck m-group).
  92000-95000ms: Truck accelerates. z increases: start slow (0.02/frame), accelerate (0.05, 0.1, 0.15/frame).
  95000ms: POLICE CAR appears from z=-15. Siren lights: red m-light and blue m-light alternate every 500ms. Chasing.
  95000-120000ms: CHASE SEQUENCE:
    Truck weaves: z increases at 0.15/frame. x oscillates via sin(time) * 2 (weaving between lanes).
    Police car follows: same z speed but slightly faster (0.16), x tracks toward truck x with delay.
    Smoke trail behind truck: every 500ms spawn m-sphere (grey, opacity=0.6) at truck position. Spheres stay in place, expand, fade. Remove after 3 seconds.
    Obstacle m-cubes (random colors, representing other cars) placed along road. Both vehicles weave around them.
    105000ms: "They're gaining!" m-label from Tech
    110000ms: Truck sharp turn (x jumps 3m). Police overshoots. Gap widens.
    115000ms: "We're losing them!" m-label from Driver
    120000ms: Police car falls behind (reduce speed to 0.1). Siren fades (light intensity decreases).

  120000-140000ms: ESCAPE SUCCESS
    120000ms: Truck slows. "We made it." m-label from Boss.
    125000ms: Scene transition: directional m-light shifts to party colors. New location = "Club" (m-cube building with neon m-light: pink, blue alternating).
    130000ms: Truck stops. Characters exit (detach from truck group, position in front of club).
    135000ms: Characters line up. Power pose.

ACT 4 — THE FLEX (140000ms - 180000ms):
  140000-145000ms: MONEY RAIN. 30 money bag m-spheres spawn at y=10, random x/z spread ±5m. cannon-es gravity pulls them down. Bags bounce on ground. Physical and satisfying.
  145000-150000ms: PNutz token rain alongside: 20 m-cube (width=0.2, color="#FFD700") with "P" m-label on each. Also fall with physics.
  150000-155000ms: WANTED POSTER. node-canvas renders a "WANTED" poster (400x500):
    - "WANTED" header in red bold
    - "GEEZ GANG" subheader
    - Draw 4 circles representing character faces (colored to match)
    - "REWARD: 1,000,000 PNutz"
    - "ARMED AND DANGEROUS"
    Serve via express → m-image (width=2, height=2.5) on m-cube billboard backing.
  
  155000-160000ms: LIVE DATA. Fetch real APE price from CoinGecko:
    https://api.coingecko.com/api/v3/simple/price?ids=apecoin&vs_currencies=usd
    Display on m-label: "APE PRICE: $X.XX" (font-size=24, color="#00FF88")
    If fetch fails, show "PRICE: PRICELESS"

  160000-170000ms: FINALE TEXT SEQUENCE:
    160000ms: "GEEZ ON APE" m-label (font-size=60, color="#FFD700") at y=5, scales up (sx/sy/sz 0.1→2.0 over 3 seconds)
    163000ms: "NEVER CAUGHT" m-label (font-size=48, color="#FF4444") below first label, same scale-up
    166000ms: "INCEPTIVE STUDIO" m-label (font-size=36, color="#00FF88") at bottom

  170000-178000ms: FIREWORKS. 5 firework bursts staggered 1.5 seconds apart:
    Each burst: cannon-es — 20 m-cube particles (tiny, random bright colors) at y=8+random(0,4), x=random(-5,5).
    Impulse: radial outward in sphere pattern, magnitude 3-5. Gravity pulls down.
    Matching m-light flash at burst center (random color, intensity 5→0 over 1 second).
    
  178000ms: All labels fade (opacity 1→0). Lights dim. Scene clears.

  180000ms: LOOP. Reset everything to initial state. All characters back at starting position. All elements removed and recreated. Timer resets to 0. Movie plays again.

TECHNICAL:
- Master clock: const startTime = Date.now(). Each frame: elapsed = Date.now() - startTime. Modulo 180000 for looping.
- Phase detection: series of if/else on elapsed ranges to determine current action
- All character movements: store character m-groups in variables, update x/y/z/ry via setAttribute per frame
- cannon-es world for all physics moments (money toss, money rain, fireworks). Step physics only during relevant phases. Reset world between loops.
- simplex-noise for smoke trail drift
- node-canvas for wanted poster
- express for serving poster image
- API fetch for live price (cache result, only fetch once per loop cycle)

Write the COMPLETE file. Every single line. Every millisecond-keyed action. All 4 acts. All physics. The wanted poster rendering. The API call. The fireworks. No shortcuts. No placeholders. No "// add more here". This is THE build.
```

---

## BUILD ORDER FOR YOUR DEV

| Priority | Build | Why First |
|----------|-------|-----------|
| 1 | #1 Fart Bomb | Simplest — proves cannon-es + noise + MML pattern works |
| 2 | #11 Jenga Tower | Pure physics — proves cannon-es stacking + collision |
| 3 | #10 Beat Stage | Pure choreography — proves timed event system |
| 4 | #13 Art Gallery | Proves node-canvas → express → m-image pipeline |
| 5 | #3 Crypto Dashboard | Proves API fetch + image gen combo |
| 6 | #2 Living Ocean | Complex noise system |
| 7 | #9 Tornado | Complex physics force fields |
| 8 | #7 Geez Battle | State machine + physics + image gen |
| 9 | #14 Rocket Launch | Custom physics simulation |
| 10 | #19 Dungeon | BSP + A* + everything |
| 11-19 | Remaining builds | Mix and match based on interest |
| 20 | #20 Geez Heist | LAST — combines everything learned from 1-19 |
