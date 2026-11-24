import Link from "next/link";
import EssayList from "@/components/EssayList";
import JsonLd from "@/components/JsonLd";
import SubscribeForm from "@/components/SubscribeForm";
import { newsletterEnabled, profiles, site } from "@/lib/config";
import { getEssays } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({ description: site.description, path: "/" });

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-5 text-[0.9375rem] text-muted">
      {children}
    </h2>
  );
}

export default function Home() {
  const essays = getEssays();
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
      <p className="font-serif text-[1.375rem] leading-[1.45] text-pretty sm:text-[1.5rem]">
        {site.introduction}
      </p>

      <section aria-labelledby="ventures" className="mt-20">
        <SectionTitle id="ventures">Ventures</SectionTitle>
        <ul className="space-y-3 font-serif text-lg leading-snug sm:space-y-2 sm:text-xl">
          {site.ventures.map((venture) => (
            <li key={venture.url} className="sm:grid sm:grid-cols-[13rem_1fr] sm:gap-x-6">
              <a href={venture.url} className="link">
                {venture.name}
              </a>
              <p className="text-muted">{venture.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="essays" className="mt-20">
        <SectionTitle id="essays">Essays</SectionTitle>
        <EssayList essays={essays.slice(0, 5)} />
        {essays.length > 0 && (
          <p className="mt-6 text-[0.9375rem]">
            <Link href="/essays" className="link text-muted hover:text-ink">
              All essays
            </Link>
          </p>
        )}
      </section>

      {newsletterEnabled() && (
        <section aria-label="Subscribe" className="mt-20">
          <SubscribeForm />
        </section>
      )}

      <section aria-labelledby="elsewhere" className="mt-20">
        <SectionTitle id="elsewhere">Elsewhere</SectionTitle>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem]">
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
