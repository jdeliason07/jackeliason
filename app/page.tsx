import EssayList, { FeaturedEssay } from "@/components/EssayList";
import JsonLd from "@/components/JsonLd";
import SubscribeForm from "@/components/SubscribeForm";
import Ventures from "@/components/Ventures";
import { newsletterEnabled, profiles, site } from "@/lib/config";
import { getEssays } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ description: site.description, path: "/" });

export default function Home() {
  const essays = getEssays();
  const [latest, ...earlier] = essays;
  const links = profiles();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: site.name,
          url: site.url,
          ...(site.email && { email: `mailto:${site.email}` }),
          sameAs: links.map((link) => link.url),
        }}
      />

      <h1 className="sr-only">{site.name}</h1>

      {/* Section headings are for screen readers; the page itself stays wordless. */}
      <section aria-labelledby="essays">
        <h2 id="essays" className="sr-only">
          Essays
        </h2>
        {latest ? <FeaturedEssay essay={latest} /> : <EssayList essays={[]} />}
        {earlier.length > 0 && (
          <div className="mt-14">
            <EssayList essays={earlier.slice(0, 4)} />
          </div>
        )}
      </section>

      {newsletterEnabled() && (
        <section aria-label="Subscribe" className="mt-20 sm:mt-24">
          <SubscribeForm />
        </section>
      )}

      <section aria-labelledby="ventures" className="mt-20 sm:mt-28">
        <h2 id="ventures" className="sr-only">
          Ventures
        </h2>
        <Ventures />
      </section>

      <section aria-labelledby="elsewhere" className="mt-16 sm:mt-20">
        <h2 id="elsewhere" className="sr-only">
          Elsewhere
        </h2>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[1.0625rem] text-muted">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} rel="me" className="hover:text-ink">
                {link.name}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
