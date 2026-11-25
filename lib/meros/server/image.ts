import "server-only";
import { createHash } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { IMAGE_RULES } from "../config";
import { GameError } from "../service/context";

/**
 * Server-side evidence image handling. The browser's declared type is ignored: the actual bytes are
 * sniffed, decoded, size-checked, auto-rotated, downscaled, and re-encoded as JPEG without any
 * metadata (EXIF, GPS, device). Only the re-encoded image is stored or sent to the AI provider.
 */

export interface ProcessedImage {
  jpeg: Buffer;
  width: number;
  height: number;
  /** SHA-256 of the uploaded bytes: identical-file reuse detection. */
  sha256: string;
  /** 64-bit difference hash (hex): supporting similarity signal only. */
  dhash: string;
}

export function sniffType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function processEvidence(bytes: Buffer): Promise<ProcessedImage> {
  if (bytes.length === 0) throw new GameError("invalid_input", "The photo was empty. Take it again.");
  if (bytes.length > IMAGE_RULES.maxBytes) throw new GameError("invalid_input", "That photo is too large.");
  const type = sniffType(bytes);
  if (!type || !(IMAGE_RULES.acceptedTypes as readonly string[]).includes(type)) {
    throw new GameError("invalid_input", "That file isn't a supported photo.");
  }
  let meta: Metadata;
  try {
    meta = await sharp(bytes, { limitInputPixels: IMAGE_RULES.maxDimension * IMAGE_RULES.maxDimension }).metadata();
  } catch {
    throw new GameError("invalid_input", "That photo couldn't be read. Take it again.");
  }
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if ((meta.pages ?? 1) > 1) throw new GameError("invalid_input", "Animated images aren't accepted.");
  if (Math.min(w, h) < IMAGE_RULES.minDimension) throw new GameError("invalid_input", "That photo is too small to check.");
  if (Math.max(w, h) > IMAGE_RULES.maxDimension) throw new GameError("invalid_input", "That photo is too large.");

  const { data: jpeg, info } = await sharp(bytes)
    .rotate() // apply orientation, then metadata is dropped on output
    .resize({ width: IMAGE_RULES.storedLongEdge, height: IMAGE_RULES.storedLongEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const grey = await sharp(jpeg).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += grey[y * 9 + x] > grey[y * 9 + x + 1] ? "1" : "0";
  const dhash = BigInt(`0b${bits}`).toString(16).padStart(16, "0");

  return {
    jpeg,
    width: info.width,
    height: info.height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    dhash,
  };
}
