import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateMML } from "@/lib/mml/validator";

const ValidateSchema = z.object({
  mmlHtml: z.string().min(1),
  jsCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ValidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const report = validateMML(parsed.data.mmlHtml, parsed.data.jsCode);

  return NextResponse.json({ report }, { status: 200 });
}
