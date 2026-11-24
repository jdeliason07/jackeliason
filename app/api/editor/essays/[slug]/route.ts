import { fromEssayFile, toEssayFile } from "@/lib/editor/essay-file";
import { GitHubError, readFile, writeFile } from "@/lib/editor/github";
import { fromThisSite, signedIn } from "@/lib/editor/session";
import { isSlug, validateEssay } from "@/lib/essay-rules";

const file = (slug: string) => `content/essays/${slug}.md`;
const MAX_LENGTH = 300_000; // characters; an essay, not a book

function problem(error: unknown) {
  if (error instanceof GitHubError) {
    return Response.json({ error: error.message }, { status: error.status === 409 ? 409 : 502 });
  }
  return Response.json({ error: "Something went wrong saving. Nothing was changed." }, { status: 500 });
}

/** One essay, with the sha that a save must quote back. */
export async function GET(_request: Request, { params }: RouteContext<"/api/editor/essays/[slug]">) {
  if (!(await signedIn())) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await params;
  if (!isSlug(slug)) return Response.json({ error: "Not an essay URL." }, { status: 400 });
  try {
    const found = await readFile(file(slug));
    if (!found) return Response.json({ error: "No essay at that URL." }, { status: 404 });
    const { fields, body, problems } = fromEssayFile(found.text);
    return Response.json({ slug, sha: found.sha, body, problems, ...fields });
  } catch (error) {
    return problem(error);
  }
}

/**
 * Create (no sha) or update (with the sha it was opened at) an essay. The fields
 * are checked by the build's own rules first, so a save can never break a deploy.
 */
export async function PUT(request: Request, { params }: RouteContext<"/api/editor/essays/[slug]">) {
  if (!fromThisSite(request)) return Response.json({ error: "Not allowed." }, { status: 403 });
  if (!(await signedIn())) return Response.json({ error: "Your session ended. Sign in again." }, { status: 401 });
  const { slug } = await params;
  if (!isSlug(slug)) {
    return Response.json(
      { error: "The URL can use lowercase letters, numbers, and single hyphens only." },
      { status: 400 },
    );
  }

  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input) return Response.json({ error: "Nothing to save." }, { status: 400 });
  const body = typeof input.body === "string" ? input.body : "";
  if (body.length > MAX_LENGTH) return Response.json({ error: "That essay is too long to save." }, { status: 413 });
  const sha = typeof input.sha === "string" && input.sha ? input.sha : undefined;

  const data: Record<string, unknown> = {
    title: typeof input.title === "string" ? input.title.trim() : input.title,
    date: input.date,
    summary: typeof input.summary === "string" ? input.summary.trim() : input.summary,
    ...(input.updated ? { updated: input.updated } : {}),
    ...(input.draft === true ? { draft: true } : {}),
  };
  const { fields, problems } = validateEssay(data, body);
  if (!fields) return Response.json({ error: "Fix these first.", problems }, { status: 400 });

  // The file is written exactly as the build will read it; check the round trip too.
  const text = toEssayFile(fields, body);
  if (!fromEssayFile(text).fields) {
    return Response.json({ error: "That essay couldn't be written safely. Nothing was changed." }, { status: 500 });
  }

  try {
    const verb = sha ? "Edit" : "Add";
    const saved = await writeFile(file(slug), text, `${verb} essay: ${fields.title}`, sha);
    const after = await readFile(file(slug));
    return Response.json({ saved: true, slug, draft: fields.draft, commit: saved.commit, commitUrl: saved.url, sha: after?.sha });
  } catch (error) {
    return problem(error);
  }
}
