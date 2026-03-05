import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import type { AssetManifestEntry } from "@/types/assets";

// ─── Storage Configuration ─────────────────────────────────────────────────
const USE_S3 = !!(process.env.AWS_BUCKET_NAME && process.env.AWS_REGION);
const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const LOCAL_PUBLIC_PATH = "/uploads";

const s3Client = USE_S3
  ? new S3Client({
      region: process.env.AWS_REGION!,
      endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: !!process.env.S3_ENDPOINT, // for R2/MinIO
    })
  : null;

// ─── Allowed MIME Types ────────────────────────────────────────────────────
const ALLOWED_MIME_TYPES = new Set([
  "model/gltf-binary",
  "model/gltf+json",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ─── URL Validator ─────────────────────────────────────────────────────────
export async function validateExternalURL(
  url: string
): Promise<{ valid: boolean; sizeBytes: number; mimeType: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { valid: false, sizeBytes: 0, mimeType: "" };
    }

    const sizeBytes = parseInt(res.headers.get("content-length") || "0", 10);
    const mimeType = res.headers.get("content-type")?.split(";")[0] || "";

    return { valid: true, sizeBytes, mimeType };
  } catch {
    return { valid: false, sizeBytes: 0, mimeType: "" };
  }
}

// ─── Generate Thumbnail ────────────────────────────────────────────────────
async function generateThumbnail(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await sharp(inputPath).resize(256, 256, { fit: "cover" }).toFile(outputPath);
}

// ─── Upload to S3 ──────────────────────────────────────────────────────────
async function uploadToS3(
  fileBuffer: Buffer,
  key: string,
  mimeType: string
): Promise<string> {
  if (!s3Client) throw new Error("S3 not configured");

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  const baseUrl =
    process.env.S3_PUBLIC_URL ||
    `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com`;
  return `${baseUrl}/${key}`;
}

// ─── Upload to Local ──────────────────────────────────────────────────────
function uploadToLocal(
  fileBuffer: Buffer,
  filename: string
): string {
  if (process.env.VERCEL) {
    throw new Error("Local file uploads are not supported on Vercel. Configure S3/R2 storage.");
  }
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  const filePath = path.join(LOCAL_UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, fileBuffer);
  return `${LOCAL_PUBLIC_PATH}/${filename}`;
}

// ─── Main Upload Function ──────────────────────────────────────────────────
export interface UploadInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export async function uploadAsset(
  input: UploadInput
): Promise<AssetManifestEntry> {
  // Validate MIME type
  const normalizedMime = input.mimeType.toLowerCase().split(";")[0];
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new Error(
      `Unsupported file type: ${input.mimeType}. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(", ")}`
    );
  }

  // Validate file size
  if (input.sizeBytes > MAX_FILE_SIZE) {
    throw new Error(
      `File too large: ${input.sizeBytes} bytes. Max: ${MAX_FILE_SIZE} bytes`
    );
  }

  const id = uuidv4();
  const ext = path.extname(input.originalName) || ".bin";
  const filename = `${id}${ext}`;
  const name = path.basename(input.originalName, ext);

  let assetUrl: string;
  let previewUrl: string | undefined;

  if (USE_S3 && s3Client) {
    assetUrl = await uploadToS3(input.buffer, `assets/${filename}`, normalizedMime);

    // Generate thumbnail for images
    if (normalizedMime.startsWith("image/")) {
      const thumbBuffer = await sharp(input.buffer)
        .resize(256, 256, { fit: "cover" })
        .png()
        .toBuffer();
      previewUrl = await uploadToS3(
        thumbBuffer,
        `thumbnails/${id}.png`,
        "image/png"
      );
    }
  } else {
    assetUrl = uploadToLocal(input.buffer, filename);

    // Generate thumbnail for images locally
    if (normalizedMime.startsWith("image/")) {
      const thumbPath = path.join(LOCAL_UPLOAD_DIR, "thumbnails", `${id}.png`);
      const tempPath = path.join(LOCAL_UPLOAD_DIR, filename);
      try {
        await generateThumbnail(tempPath, thumbPath);
        previewUrl = `${LOCAL_PUBLIC_PATH}/thumbnails/${id}.png`;
      } catch {
        // Thumbnail generation failed, skip
      }
    }
  }

  return {
    id,
    url: assetUrl,
    source: "upload",
    validated: true,
    validatedAt: new Date().toISOString(),
    sizeBytes: input.sizeBytes,
    mimeType: normalizedMime,
    name,
    previewUrl,
  };
}
