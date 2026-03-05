import { NextRequest, NextResponse } from "next/server";
import { uploadAsset } from "@/lib/assets/storage";
import { upsertRegistryAsset } from "@/database/client";

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_MIME_TYPES = new Set([
  "model/gltf-binary",
  "model/gltf+json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]);

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Failed to parse form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided (field: file)" }, { status: 400 });
  }

  // MIME validation
  const mimeType = file.type.split(";")[0].toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      {
        error: `Unsupported file type: ${mimeType}`,
        allowed: Array.from(ALLOWED_MIME_TYPES),
      },
      { status: 415 }
    );
  }

  // Size validation
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `File too large: ${file.size} bytes. Max: ${MAX_SIZE} bytes` },
      { status: 413 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const asset = await uploadAsset({
      buffer,
      originalName: file.name,
      mimeType,
      sizeBytes: file.size,
    });
    asset.license = "user-provided";

    const now = new Date().toISOString();
    await upsertRegistryAsset({
      id: asset.id,
      name: asset.name,
      category: "upload",
      source: "upload",
      license: "user-provided",
      local_url: asset.url,
      source_url: null,
      preview_url: asset.previewUrl || null,
      poly_count: null,
      mime_type: asset.mimeType,
      size_bytes: asset.sizeBytes,
      created_at: now,
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (e) {
    console.error("[/api/assets/upload] Error:", e);
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 }
    );
  }
}
