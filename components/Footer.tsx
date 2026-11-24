import { site } from "@/lib/config";

/**
 * Just the email link, once lib/config.ts has an address; nothing until then.
 * The RSS feed needs no visible link: every page advertises it in <head> (lib/metadata.ts).
 */
export default function Footer() {
  if (!site.email) return null;

  return (
    <footer className="mt-24 text-center text-muted sm:mt-32">
      <a href={`mailto:${site.email}`} className="smallcaps hover:text-ink">
        Email
      </a>
    </footer>
  );
}
