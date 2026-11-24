import Link from "next/link";
import EssayList, { FeaturedEssay } from "@/components/EssayList";
import JsonLd from "@/components/JsonLd";
import Ornament from "@/components/Ornament";
import SubscribeForm from "@/components/SubscribeForm";
import Ventures from "@/components/Ventures";
import { newsletterEnabled, profiles, site } from "@/lib/config";
import { getEssays } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ description: site.description, path: "/" });

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="smallcaps mb-8 flex items-center gap-4 text-muted">
      <span aria-hidden="true" className="h-px flex-1 bg-rule" />
      {children}
      <span aria-hidden="true" className="h-px flex-1 bg-rule" />
    </h2>
  );
}

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

      <section aria-labelledby="essays">
        <SectionTitle id="essays">Essays</SectionTitle>
        {latest ? <FeaturedEssay essay={latest} /> : <EssayList essays={[]} />}
        {earlier.length > 0 && (
          <div className="mt-12">
            <EssayList essays={earlier.slice(0, 4)} />
          </div>
        )}
        {essays.length > 1 && (
          <p className="mt-8 text-center">
            <Link href="/essays" className="link smallcaps text-muted hover:text-ink">
              All essays <span aria-hidden="true">→</span>
            </Link>
          </p>
        )}
      </section>

      {newsletterEnabled() && (
        <section aria-label="Subscribe" className="mt-16 sm:mt-20">
          <SubscribeForm />
        </section>
      )}

      <Ornament className="mt-16 sm:mt-20" />
      <p className="mx-auto mt-8 max-w-[34rem] text-center text-[1.1875rem] leading-relaxed text-pretty italic sm:text-[1.3125rem]">
        {site.introduction}
      </p>

      <section aria-labelledby="ventures" className="mt-16 sm:mt-20">
        <SectionTitle id="ventures">Ventures</SectionTitle>
        <Ventures />
      </section>

      <section aria-labelledby="elsewhere" className="mt-16 sm:mt-20">
        <SectionTitle id="elsewhere">Elsewhere</SectionTitle>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[1.0625rem]">
          {links.map((link) => (
            <li key={link.url}>
              <a href={link.url} rel="me" className="link">
                {link.name}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
