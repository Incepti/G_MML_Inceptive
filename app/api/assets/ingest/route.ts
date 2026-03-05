import { NextRequest, NextResponse } from "next/server";
import { uploadAsset } from "@/lib/assets/storage";
import { upsertRegistryAsset } from "@/database/client";

function isApprovedSource(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    if (host.endsWith("poly.pizza")) return true;
    if (host.endsWith("kenney.nl")) return true;
    if (host.endsWith("quaternius.com")) return true;
    if (host.endsWith("polyhaven.com")) return true;
    if (host.endsWith("3dwarehouse.sketchup.com")) return true;
    if (host.endsWith("a23d.co")) return true;
    if (host.endsWith("free3d.com")) return true;

    return false;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sourceUrl, name, category, license, source, polyCount } = body || {};
  if (!sourceUrl || !name || !category || !license) {
    return NextResponse.json(
      { error: "Missing required fields: sourceUrl, name, category, license" },
      { status: 400 }
    );
  }

  if (!isApprovedSource(sourceUrl)) {
    return NextResponse.json(
      { error: "Source not approved for ingestion" },
      { status: 400 }
    );
  }

  if (!sourceUrl.endsWith(".glb")) {
    return NextResponse.json(
      { error: "Source URL must be a direct .glb link" },
      { status: 400 }
    );
  }

  try {
    const head = await fetch(sourceUrl, { method: "HEAD" });
    if (!head.ok) {
      return NextResponse.json(
        { error: "Source URL not publicly accessible" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Source URL not publicly accessible" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to download source asset" },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());

    const asset = await uploadAsset({
      buffer,
      originalName: `${name}.glb`,
      mimeType: "model/gltf-binary",
      sizeBytes: buffer.byteLength,
    });

    const now = new Date().toISOString();
    await upsertRegistryAsset({
      id: asset.id,
      name,
      category,
      source: source || "ingested",
      license,
      local_url: asset.url,
      source_url: sourceUrl,
      preview_url: asset.previewUrl || null,
      poly_count: typeof polyCount === "number" ? polyCount : null,
      mime_type: asset.mimeType,
      size_bytes: asset.sizeBytes,
      created_at: now,
    });

    return NextResponse.json(
      {
        success: true,
        asset: {
          id: asset.id,
          name,
          category,
          source: source || "ingested",
          license,
          localUrl: asset.url,
          previewUrl: asset.previewUrl,
          polyCount: typeof polyCount === "number" ? polyCount : undefined,
          sizeBytes: asset.sizeBytes,
          mimeType: asset.mimeType,
          createdAt: now,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Ingestion failed", detail: String(e) },
      { status: 500 }
    );
  }
}
