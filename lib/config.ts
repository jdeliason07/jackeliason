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
 * plain string, e.g. `introduction: "Your sentence."`, and the build warning
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

  // TODO: Replace with one understated sentence that introduces you.
  introduction: placeholder(
    "Placeholder introduction. Replace this sentence in lib/config.ts.",
  ),

  // TODO: Replace with the default description used by search engines and link previews.
  description: placeholder(
    "Essays by Jack Eliason. Placeholder description; replace it in lib/config.ts.",
  ),

  // TODO: Add the address shown as "Email" in the footer. While empty, the link is omitted.
  email: "",

  /** X handle used for link previews (twitter:site and twitter:creator). */
  xHandle: "@jack_d_eliason",

  /** Current ventures only, in display order. */
  ventures: [
    {
      name: "Korvo AI",
      description: "AI receptionist for small businesses.",
      url: "https://korvo.ai",
    },
    {
      name: "Vates",
      description:
        "A media company for people on the fence about chasing their dream.",
      url: "https://vates.store",
    },
    {
      name: "Race Against Cancers",
      description: "501(c)(3) nonprofit behind a 10K in Provo, Utah.",
      url: "https://raceagainstcancers.org",
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
