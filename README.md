# ⬡ GEEZ MML Studio

A production-ready, AI-powered **MML Alpha editor** with strict validation,
Three.js live preview, deterministic dynamic sandbox, and verified asset management.

---

## Features

| Feature | Details |
|---|---|
| **MML Parser & Validator** | Strict Alpha compliance — rejected tags, banned JS, cap enforcement |
| **AI Generation** | Prompt → valid MML via GPT-4o (or any OpenAI-compatible LLM) |
| **Three.js Viewport** | Live 3D preview with GLTF loading, shadow, SSAO, Bloom controls |
| **Dynamic Sandbox** | Node.js VM sandbox with deterministic tick-based animation |
| **Asset Browser** | 13+ verified Khronos/ModelViewer GLBs, upload your own |
| **Monaco Editor** | MML-aware completions, error gutter markers, snippet templates |
| **Project System** | Multi-file, versioning, rollback, export |
| **Publishing** | Static HTML export or dynamic Node.js ZIP package |

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

> **Note:** `vm2` is required for the sandbox runtime. Install separately if needed:
> ```bash
> npm install vm2
> ```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

```env
# Minimum required for local dev (no generation):
DATABASE_PATH=./database/geez.db
WS_PORT=3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Add this to enable AI generation:
OPENAI_API_KEY=sk-your-key-here
LLM_MODEL=gpt-4o
```

### 3. Seed the Database

```bash
npm run db:seed
```

This creates two example projects:
- **Forest Clearing** — Static scene with Duck GLB, lights, primitives
- **Orbiting Spheres** — Dynamic scene with tick-based animation

### 4. Run the App

```bash
npm run dev
```

This starts:
- **Next.js** on `http://localhost:3000`
- **WebSocket Sandbox Server** on `ws://localhost:3001`

Open [http://localhost:3000](http://localhost:3000).

---

## API Keys

### OpenAI (for AI generation)

| Variable | Where to get it |
|---|---|
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `LLM_MODEL` | `gpt-4o` (recommended), `gpt-4-turbo`, `gpt-3.5-turbo` |

### Using Azure OpenAI

```env
OPENAI_API_KEY=your-azure-key
LLM_BASE_URL=https://your-resource.openai.azure.com/
LLM_MODEL=gpt-4o  # your deployment name
```

### Using Local Ollama (no API key needed)

```env
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3:8b
OPENAI_API_KEY=ollama  # required but not used
```

### S3/R2 Storage (optional — uses local by default)

| Variable | Purpose |
|---|---|
| `AWS_BUCKET_NAME` | Your S3/R2 bucket name |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `S3_ENDPOINT` | For R2: `https://<id>.r2.cloudflarestorage.com` |
| `S3_PUBLIC_URL` | CDN URL for public access |

---

## Project Structure

```
geez-mml-studio/
├── app/
│   ├── api/
│   │   ├── generate/route.ts      # Prompt → MML (LLM + validation)
│   │   ├── validate/route.ts      # MML validation endpoint
│   │   ├── assets/
│   │   │   ├── search/route.ts    # Trusted asset search
│   │   │   └── upload/route.ts    # File upload
│   │   ├── projects/route.ts      # Project CRUD
│   │   ├── projects/[id]/route.ts # Single project
│   │   └── publish/route.ts       # Export HTML / ZIP
│   ├── page.tsx                   # Main studio layout
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── editor/MonacoEditor.tsx    # Monaco + MML completions
│   ├── explorer/
│   │   ├── ProjectExplorer.tsx    # Project/file tree
│   │   └── AssetBrowser.tsx       # Asset search + upload
│   ├── renderer/
│   │   ├── ThreeViewport.tsx      # Three.js canvas
│   │   └── InspectorPanel.tsx     # Validation + renderer controls
│   └── prompt/PromptInput.tsx     # AI prompt + validate button
├── lib/
│   ├── store.ts                   # Zustand state management
│   ├── mml/
│   │   ├── parser.ts              # HTML → MMLNode tree (parse5)
│   │   └── validator.ts           # MML Alpha strict validator
│   ├── renderer/engine.ts         # Three.js MML scene builder
│   ├── sandbox/runtime.js         # Node.js VM sandbox
│   ├── llm/
│   │   ├── service.ts             # OpenAI generation service
│   │   └── rules.ts               # Hardcoded MML ruleset
│   └── assets/
│       ├── trusted-index.ts       # 13+ verified GLB assets
│       ├── storage.ts             # S3/local upload
│       └── manifest.ts            # Asset manifest helpers
├── server/index.js                # WebSocket sandbox server
├── database/
│   ├── client.js                  # better-sqlite3 wrapper
│   ├── schema.js                  # Table definitions
│   └── seed.js                    # Example projects + assets
├── types/
│   ├── mml.ts                     # MML types + caps
│   ├── project.ts                 # Project types
│   └── assets.ts                  # Asset types
└── public/uploads/                # Local asset storage
```

---

## MML Alpha Rules (Enforced)

### Allowed Tags

```
m-group   m-model   m-light   m-plane
m-sphere  m-cube    m-image   m-video
```

### Asset URL Policy

- **Never fabricated** — all URLs must come from the trusted asset index or uploaded files
- **HEAD-validated** before use
- **Fallback to primitives** if no valid asset exists

### Dynamic Script Rules

```
✗ window, document, fetch, XMLHttpRequest
✗ Math.random(), Date.now(), new Date()
✗ setTimeout, require(), import, eval()
✓ tick counter (deterministic integer)
✓ setInterval (max 10)
✓ createElement, setAttribute, appendChild, removeChild
```

### Caps

| Resource | Limit |
|---|---|
| Models | 100 |
| Lights | 20 |
| Physics objects | 50 |
| Particles | 500 |
| Dynamic intervals | 10 |

---

## Production Deployment

### Vercel

```bash
vercel deploy
```

Set all environment variables in Vercel dashboard.

> **Note:** The WebSocket server (`server/index.js`) cannot run on Vercel serverless.
> Deploy it separately on Railway, Render, or a VPS.

### Docker (full stack)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
EXPOSE 3000 3001
CMD ["npm", "start"]
```

### WebSocket Server (separate process)

```bash
node server/index.js
```

Or with PM2:

```bash
pm2 start server/index.js --name geez-ws-server
```

---

## License

MIT — Build whatever you want.
