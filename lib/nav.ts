/** The site's contents, shared by the masthead and the floating nav. `preview` is the floating nav's hover line. */
export const nav = [
  { href: "/essays", label: "Essays", preview: "The permanent record" },
  { href: "/now", label: "Now", preview: "What I'm focused on now" },
  { href: "/canon", label: "Canon", preview: "Books, thinkers, and ideas that shaped my worldview" },
] as const;

/** An item is current on its own page and on any page beneath it (an essay is under Essays). */
export function isCurrent(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
