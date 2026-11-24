import { fromEssayFile } from "@/lib/editor/essay-file";
import { GitHubError, listFiles, readFile } from "@/lib/editor/github";
import { signedIn } from "@/lib/editor/session";

/** Every essay in the repository, newest first, as the editor's picker shows them. */
export async function GET() {
  if (!(await signedIn())) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const files = await listFiles("content/essays");
    const essays = await Promise.all(
      files.map(async (file) => {
        const slug = file.name.slice(0, -".md".length);
        const found = await readFile(file.path);
        const { fields } = found ? fromEssayFile(found.text) : {};
        return { slug, title: fields?.title ?? slug, date: fields?.date ?? "", draft: fields?.draft ?? false };
      }),
    );
    essays.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : a.date < b.date ? 1 : -1));
    return Response.json({ essays });
  } catch (error) {
    const status = error instanceof GitHubError ? 502 : 500;
    return Response.json({ error: (error as Error).message }, { status });
  }
}
