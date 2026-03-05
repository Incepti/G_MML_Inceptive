import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const SandboxSchema = z.object({
  jsCode: z.string().min(1),
  mmlBase: z.string().optional().default(""),
  ticks: z.number().int().min(1).max(300).optional().default(30),
  seedString: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SandboxSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    // Dynamic require to avoid bundling vm2 on client
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createSandbox } = require("@/lib/sandbox/runtime");

    const { sandboxAPI, advanceTicks, serializeState } = createSandbox(null, {
      seedString: parsed.data.seedString,
    });

    // Use Node.js vm2 to run the user script in the sandbox
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NodeVM } = require("vm2");
    const vm = new NodeVM({
      console: "redirect",
      sandbox: sandboxAPI,
      require: {
        external: ["cannon-es", "simplex-noise", "alea", "seedrandom", "chroma-js"],
        builtin: [],
      },
      eval: false,
      wasm: false,
      timeout: 1000,
    });

    vm.run(parsed.data.jsCode, "mml-dynamic.js");

    // Advance ticks synchronously
    advanceTicks(parsed.data.ticks);

    const mml = serializeState();
    const combined = parsed.data.mmlBase
      ? `${parsed.data.mmlBase}\n${mml}`
      : mml;

    return NextResponse.json({ mml: combined }, { status: 200 });
  } catch (e: any) {
    console.error("[/api/sandbox] Error:", e);
    return NextResponse.json(
      { error: "Sandbox execution failed", detail: e?.message || String(e) },
      { status: 500 }
    );
  }
}
