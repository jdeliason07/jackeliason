/** The site's contents, shared by the masthead and the floating nav. `preview` is the floating nav's hover line. */
export const nav = [
  { href: "/essays", label: "Essays", preview: "The permanent record" },
  { href: "/now", label: "Now", preview: "What I'm focused on now" },
  { href: "/library", label: "Library", preview: "Books I’ve read and music I love" },
  { href: "/meros", label: "Meros", preview: "Discipline, kept score" },
] as const;

/** An item is current on its own page and on any page beneath it (an essay is under Essays). */
export function isCurrent(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
