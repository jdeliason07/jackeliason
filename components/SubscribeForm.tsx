import { newsletterEnabled, site } from "@/lib/config";

/**
 * A plain HTML form that POSTs straight to the newsletter provider.
 * No JavaScript, no iframe, no provider script. Renders nothing until
 * newsletter.formAction and newsletter.emailFieldName are set in lib/config.ts.
 */
export default function SubscribeForm({ id = "subscribe-email" }: { id?: string }) {
  if (!newsletterEnabled()) return null;

  return (
    <form action={site.newsletter.formAction} method="post">
      <label htmlFor={id} className="block font-serif text-lg sm:text-xl">
        New essays by email.
      </label>
      <div className="on-white mt-4 flex max-w-md gap-2 text-base sm:text-[0.9375rem]">
        <input
          id={id}
          type="email"
          name={site.newsletter.emailFieldName}
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="min-w-0 flex-1 rounded-full bg-white px-4 py-2 text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          className="shrink-0 cursor-pointer rounded-full bg-white px-5 py-2 font-medium text-ink hover:bg-white/90"
        >
          Subscribe
        </button>
      </div>
    </form>
  );
}
