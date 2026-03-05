import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  getProject,
  updateProject,
  deleteProject,
  upsertFile,
  getVersionCount,
  saveVersion,
} from "@/database/client";

const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  files: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(["mml", "js", "css"]),
        content: z.string(),
      })
    )
    .optional(),
  saveVersion: z.boolean().default(false),
  versionNote: z.string().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await getProject(params.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  try {
    const project = await getProject(params.id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Update project metadata
    const updates: Record<string, string> = { updated_at: now };
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      updates.description = parsed.data.description;
    await updateProject(params.id, updates);

    // Upsert files
    if (parsed.data.files) {
      for (const file of parsed.data.files) {
        await upsertFile({
          ...file,
          project_id: params.id,
          updated_at: now,
        });
      }
    }

    // Save version if requested
    if (parsed.data.saveVersion) {
      const vCount = await getVersionCount(params.id);
      const updatedProject = await getProject(params.id);
      await saveVersion({
        id: uuidv4(),
        project_id: params.id,
        version: vCount + 1,
        snapshot: JSON.stringify({
          files: updatedProject!.files,
          manifest: updatedProject!.manifest,
        }),
        note: parsed.data.versionNote || "",
        created_at: now,
      });
    }

    const updatedProject = await getProject(params.id);
    return NextResponse.json({ project: updatedProject }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await deleteProject(params.id);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
