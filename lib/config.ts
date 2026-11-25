/**
 * Site configuration: the single source of identity for jackeliason.com.
 *
 * Every value that still needs your input is marked with "TODO:".
 * Search the project for "TODO:" to find them all. Production builds
 * print a warning for each one that is still unreplaced.
 */

const placeholderText = new Set<string>();

/**
 * Marks text that shipped with the template. Replace the whole call with a
 * plain string, e.g. `description: "Your sentence."`, and the build warning
 * for that value disappears.
 */
function placeholder(text: string): string {
  placeholderText.add(text);
  return text;
}

export function isPlaceholder(value: string): boolean {
  return placeholderText.has(value);
}

export const site = {
  name: "Jack Eliason",

  /** Canonical production domain: apex, https, no trailing slash. */
  url: "https://jackeliason.com",

  /** Where the in-site editor commits essays (see README.md, "Writing from the site"). */
  repository: { owner: "jdeliason07", name: "jackeliason", branch: "main" },

  /** The homepage's headline. Your name stays in the page title, metadata, and every other page's masthead. */
  greeting: "I’m Jack.",

  /** The homepage's title-page line under the greeting, one entry per line. */
  tagline: ["Founder of Korvo and Race Against Cancers.", "Co-founder of vates."],

  // TODO: Replace with the default description used by search engines and link previews.
  description: placeholder(
    "Essays by Jack Eliason. Placeholder description; replace it in lib/config.ts.",
  ),

  // TODO: Add the address shown as "Email" in the footer. While empty, the link is omitted.
  email: "",

  /** X handle used for link previews (twitter:site and twitter:creator). */
  xHandle: "@jack_d_eliason",

  /**
   * Current ventures only, in display order. Each renders as a button linking to its site:
   * the logo alone at rest; hovered or focused, the button widens and shows `blurb`
   * (what it is) and `detail` (the facts, in the accent). Touch screens show both always.
   * Logo files live in public/ventures/: `width` and `height` are the file's pixel size,
   * `displayHeight` its height on the page.
   */
  ventures: [
    {
      name: "Korvo AI",
      blurb: "Korvo is an AI receptionist for small businesses: it answers the phone after hours.",
      detail: "Performance-based pricing · No setup fee · No monthly fee",
      url: "https://korvo.ai",
      logo: { src: "/ventures/korvo.webp", width: 321, height: 108, displayHeight: 34 },
    },
    {
      name: "Vates",
      blurb: "Vates is a media company for people on the fence about chasing their dream. Its first piece is No. 01, a glass bottle.",
      detail: "No. 01 glass bottle · $49",
      url: "https://vates.store",
      logo: { src: "/ventures/vates.webp", width: 250, height: 120, displayHeight: 38 },
    },
    {
      name: "Race Against Cancers",
      blurb:
        "Race Against Cancers is a 501(c)(3) nonprofit behind a 10K in Provo, Utah: a community run for local families fighting cancer. 100% of every donation goes to those families.",
      detail: "First 10K · Nov 7, 2026 · 102 athletes",
      url: "https://raceagainstcancers.org",
      logo: { src: "/ventures/race-against-cancers.webp", width: 611, height: 66, displayHeight: 21 },
    },
  ],

  /** Shown under "Elsewhere" with rel="me", in this order. */
  social: [
    { name: "Instagram", url: "https://www.instagram.com/jack.d.eliason" },
    { name: "YouTube", url: "https://www.youtube.com/@jack.d.eliason" },
    { name: "TikTok", url: "https://www.tiktok.com/@jack.d.eliason" },
    { name: "X", url: "https://x.com/jack_d_eliason" },
    { name: "Threads", url: "https://www.threads.com/@jack.d.eliason" },
    { name: "LinkedIn", url: "https://www.linkedin.com/in/jack-eliason" },
  ],

  // TODO: Add your podcast URL. The "Podcast" link stays hidden while this is empty.
  podcast: "",

  /**
   * Subscribe form. It POSTs directly to your newsletter provider and is
   * hidden everywhere while formAction is empty. See README.md.
   */
  newsletter: {
    // TODO: Add your provider's form endpoint, e.g. "https://buttondown.com/api/emails/embed-subscribe/<username>".
    formAction: "",
    // TODO: Add the name the provider expects for the email field, e.g. "email" (Buttondown) or "email_address" (Kit).
    emailFieldName: "",
  },
};

/** Social profiles plus the podcast, when set. Used for "Elsewhere" and sameAs. */
export function profiles(): { name: string; url: string }[] {
  return site.podcast
    ? [...site.social, { name: "Podcast", url: site.podcast }]
    : site.social;
}

/** The subscribe form renders only when both values are set. */
export function newsletterEnabled(): boolean {
  return Boolean(site.newsletter.formAction && site.newsletter.emailFieldName);
}
