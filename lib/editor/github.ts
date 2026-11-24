import { site } from "@/lib/config";

/**
 * The editor's storage is the repository itself: essays are read from and
 * committed to content/essays/ on the production branch through the GitHub
 * contents API. Every save is a commit, so Vercel redeploys it like any push.
 *
 * GITHUB_TOKEN: a fine-grained token for this repository only, with
 * "Contents: Read and write" (see README.md). GITHUB_API_URL exists only so
 * the editor can be tested against a stand-in server; leave it unset.
 */

const API = process.env.GITHUB_API_URL ?? "https://api.github.com";
const { owner, name, branch } = site.repository;

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API}/repos/${owner}/${name}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "jackeliason.com-editor",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return response;
}

const contentsPath = (file: string) => `/contents/${file.split("/").map(encodeURIComponent).join("/")}`;

async function failure(response: Response, doing: string): Promise<GitHubError> {
  const detail = await response.json().catch(() => ({}));
  const why =
    response.status === 401 || response.status === 403
      ? "GitHub refused the token. Check that GITHUB_TOKEN is current and can write this repository's contents."
      : `GitHub answered ${response.status} while ${doing}${detail?.message ? `: ${detail.message}` : "."}`;
  return new GitHubError(why, response.status);
}

/** A file's text and its blob sha (needed to update it), or null if it doesn't exist. */
export async function readFile(file: string): Promise<{ text: string; sha: string } | null> {
  const response = await github(`${contentsPath(file)}?ref=${encodeURIComponent(branch)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw await failure(response, `reading ${file}`);
  const data = (await response.json()) as { content?: string; sha: string; type: string };
  if (data.type !== "file" || data.content === undefined) throw new GitHubError(`${file} is not a file.`, 500);
  return { text: Buffer.from(data.content, "base64").toString("utf8"), sha: data.sha };
}

/** The Markdown files in a directory (empty if the directory doesn't exist yet). */
export async function listFiles(directory: string): Promise<{ name: string; path: string }[]> {
  const response = await github(`${contentsPath(directory)}?ref=${encodeURIComponent(branch)}`);
  if (response.status === 404) return [];
  if (!response.ok) throw await failure(response, `listing ${directory}`);
  const entries = (await response.json()) as { name: string; path: string; type: string }[];
  return entries.filter((entry) => entry.type === "file" && entry.name.endsWith(".md"));
}

/**
 * Creates or updates a file in one commit. Pass the sha the file had when it was
 * opened; if it has changed since, GitHub refuses and nothing is overwritten.
 */
export async function writeFile(
  file: string,
  text: string,
  message: string,
  sha?: string,
): Promise<{ commit: string; url: string }> {
  const response = await github(contentsPath(file), {
    method: "PUT",
    body: JSON.stringify({ message, content: Buffer.from(text, "utf8").toString("base64"), branch, ...(sha ? { sha } : {}) }),
  });
  if (response.status === 409 || (response.status === 422 && sha)) {
    throw new GitHubError("This essay changed since you opened it. Reload it, then make your edit again.", 409);
  }
  if (response.status === 422) {
    throw new GitHubError("An essay with this URL already exists. Choose another URL.", 409);
  }
  if (!response.ok) throw await failure(response, `saving ${file}`);
  const data = (await response.json()) as { commit: { sha: string; html_url: string } };
  return { commit: data.commit.sha, url: data.commit.html_url };
}
