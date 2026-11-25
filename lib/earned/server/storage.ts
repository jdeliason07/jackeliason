import "server-only";
import { supabaseAdmin } from "./auth";

/** Private evidence bucket (supabase/migrations/*_earned_storage.sql). Paths: <owner>/<challenge>.jpg */
export const BUCKET = "earned-evidence";

export function evidencePath(ownerId: string, challengeId: string) {
  return `${ownerId}/${challengeId}.jpg`;
}

export async function uploadEvidence(path: string, jpeg: Buffer): Promise<void> {
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`storage upload failed`);
}

export async function downloadEvidence(path: string): Promise<Buffer | null> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function removeEvidence(paths: string[]): Promise<boolean> {
  if (!paths.length) return true;
  const { error } = await supabaseAdmin().storage.from(BUCKET).remove(paths);
  return !error;
}

/** A short-lived signed URL so the owner can view their own evidence. */
export async function signedEvidenceUrl(path: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET).createSignedUrl(path, 60);
  return error ? null : data.signedUrl;
}
