import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { listProjects, createProject, upsertFile } from "@/database/client";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  mode: z.enum(["static", "dynamic"]).default("static"),
});

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const project = {
    id: uuidv4(),
    name: parsed.data.name,
    description: parsed.data.description || null,
    mode: parsed.data.mode,
    created_at: now,
    updated_at: now,
  };

  try {
    await createProject(project);

    // Create default MML file
    await upsertFile({
      id: uuidv4(),
      project_id: project.id,
      name: "scene.mml",
      type: "mml",
      content: `<m-group>\n  <!-- Your MML scene goes here -->\n  <m-cube color="#7c3aed" y="1"></m-cube>\n</m-group>`,
      updated_at: now,
    });

    if (parsed.data.mode === "dynamic") {
      await upsertFile({
        id: uuidv4(),
        project_id: project.id,
        name: "scene.js",
        type: "js",
        content: `// Dynamic MML script\n// Use tick counter for deterministic animation\n// Available: createElement, setAttribute, appendChild, removeChild, setInterval\n\nsetInterval(function() {\n  // Your animation logic here\n}, 16);\n`,
        updated_at: now,
      });
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
