import { NextRequest, NextResponse } from "next/server";

/**
 * Polyhaven GLTF Proxy — rewrites texture URIs to absolute polyhaven CDN URLs.
 *
 * Polyhaven serves .gltf files whose `images[].uri` reference textures at
 * relative paths like `textures/Foo_diff_1k.jpg`. These don't resolve because
 * polyhaven hosts textures under `/Models/jpg/` not `/Models/gltf/.../textures/`.
 *
 * This proxy fetches the gltf, rewrites image URIs to absolute CDN URLs,
 * and returns the modified gltf. The .bin file resolves correctly as-is.
 *
 * GET /api/models/polyhaven/ArmChair_01
 */

const PH_BASE = "https://dl.polyhaven.org/file/ph-assets/Models";
const RESOLUTION = "1k";

// In-memory cache: modelId -> { gltf, timestamp }
const cache = new Map<string, { body: string; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;

  // Validate model ID (alphanumeric + underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid model ID" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return new NextResponse(cached.body, {
      headers: {
        "Content-Type": "model/gltf+json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  try {
    const gltfUrl = `${PH_BASE}/gltf/${RESOLUTION}/${id}/${id}_${RESOLUTION}.gltf`;
    const res = await fetch(gltfUrl);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Polyhaven model "${id}" not found` },
        { status: 404 },
      );
    }

    const gltf = await res.json();

    // Rewrite image URIs: "textures/Foo_diff_1k.jpg" -> absolute CDN URL
    if (Array.isArray(gltf.images)) {
      for (const img of gltf.images) {
        if (img.uri && !img.uri.startsWith("http") && !img.uri.startsWith("data:")) {
          // Extract just the filename from "textures/Foo_diff_1k.jpg"
          const filename = img.uri.split("/").pop();
          img.uri = `${PH_BASE}/jpg/${RESOLUTION}/${id}/${filename}`;
        }
      }
    }

    // Rewrite buffer URIs to absolute (already works but be safe)
    if (Array.isArray(gltf.buffers)) {
      for (const buf of gltf.buffers) {
        if (buf.uri && !buf.uri.startsWith("http") && !buf.uri.startsWith("data:")) {
          buf.uri = `${PH_BASE}/gltf/${RESOLUTION}/${id}/${buf.uri}`;
        }
      }
    }

    const body = JSON.stringify(gltf);

    // Cache it
    cache.set(id, { body, ts: Date.now() });

    return new NextResponse(body, {
      headers: {
        "Content-Type": "model/gltf+json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to proxy polyhaven model" },
      { status: 502 },
    );
  }
}
