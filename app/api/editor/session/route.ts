import {
  clientAddress,
  fromThisSite,
  missingSettings,
  newSession,
  passwordMatches,
  recordFailure,
  SESSION_COOKIE,
  sessionCookie,
  signedIn,
  tooManyAttempts,
} from "@/lib/editor/session";
import { cookies } from "next/headers";

/** Is the editor set up, and is this browser signed in? */
export async function GET() {
  return Response.json({ configured: missingSettings().length === 0, signedIn: await signedIn() });
}

/** Sign in with the editor password. */
export async function POST(request: Request) {
  if (!fromThisSite(request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  const missing = missingSettings();
  if (missing.length) {
    return Response.json(
      { error: `Editing isn't set up yet. Add ${missing.join(" and ")} in Vercel, then redeploy.` },
      { status: 503 },
    );
  }
  const address = clientAddress(request);
  if (tooManyAttempts(address)) {
    return Response.json({ error: "Too many wrong passwords. Try again in 15 minutes." }, { status: 429 });
  }
  const { password } = (await request.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== "string" || !passwordMatches(password)) {
    await recordFailure(address);
    return Response.json({ error: "That password isn't right." }, { status: 401 });
  }
  const { value, maxAge } = newSession();
  (await cookies()).set(SESSION_COOKIE, value, { ...sessionCookie, maxAge });
  return Response.json({ signedIn: true });
}

/** Sign out. */
export async function DELETE(request: Request) {
  if (!fromThisSite(request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  (await cookies()).delete({ name: SESSION_COOKIE, ...sessionCookie });
  return Response.json({ signedIn: false });
}
