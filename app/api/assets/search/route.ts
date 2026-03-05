import { NextRequest, NextResponse } from "next/server";
import { searchRegistryAssets } from "@/database/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const category = searchParams.get("category") || "";
  const pageSize = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
  );

  const { assets, total } = await searchRegistryAssets({
    query: q,
    category,
    page,
    pageSize,
  });

  return NextResponse.json(
    {
      assets: assets.map((a: any) => ({
        id: a.id,
        name: a.name,
        category: a.category,
        source: a.source,
        license: a.license,
        localUrl: a.local_url,
        previewUrl: a.preview_url || undefined,
        polyCount: a.poly_count || undefined,
        sizeBytes: a.size_bytes || undefined,
        mimeType: a.mime_type || undefined,
        createdAt: a.created_at,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    { status: 200 }
  );
}
