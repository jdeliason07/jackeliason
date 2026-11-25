import "server-only";
import { NextResponse } from "next/server";
import { GameError } from "../service/context";
import { BUCKET } from "./storage";

export { BUCKET };

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** Maps errors to safe responses. Unexpected errors are logged without payloads or secrets. */
export function errorResponse(error: unknown) {
  if (error instanceof GameError) {
    return json({ error: { code: error.code, message: error.message, details: safeDetails(error.details) } }, error.status);
  }
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message.slice(0, 200) : "unknown";
  console.error(`[meros] ${name}: ${message}`);
  return json({ error: { code: "server_error", message: "Something went wrong on the server. Nothing was saved twice; try again." } }, 500);
}

function safeDetails(details: unknown) {
  if (!details || typeof details !== "object") return undefined;
  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return undefined;
  }
}
