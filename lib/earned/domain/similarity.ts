/**
 * Flags custom quests that look like an existing one so the same action isn't scored twice.
 * Heuristic, not detection: it compares meaningful words in the title and minimum action and asks
 * the owner to confirm. Template clones are caught exactly by their stable habit identity instead.
 */

const STOP = new Set(
  "a an and the to of in on at for my your with by from into before after each every day daily today one two set out up".split(" "),
);

export function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/(ing|ed|es|s)$/, ""))
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function similarity(a: { title: string; minimumAction: string }, b: { title: string; minimumAction: string }): number {
  return jaccard(keywords(`${a.title} ${a.minimumAction}`), keywords(`${b.title} ${b.minimumAction}`));
}

export const SIMILARITY_THRESHOLD = 0.5;
