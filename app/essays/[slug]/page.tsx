import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DraftLabel from "@/components/DraftLabel";
import JsonLd from "@/components/JsonLd";
import Prose from "@/components/Prose";
import SubscribeForm from "@/components/SubscribeForm";
import { newsletterEnabled, site } from "@/lib/config";
import { getEssay, getEssays, renderEssay } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

/** Every essay is generated at build time; any other slug is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return getEssays().map((essay) => ({ slug: essay.slug }));
}

export async function generateMetadata({ params }: PageProps<"/essays/[slug]">): Promise<Metadata> {
  const essay = getEssay((await params).slug);
  if (!essay) return {};
  return pageMetadata({
    title: essay.title,
    description: essay.summary,
    path: `/essays/${essay.slug}`,
    article: { publishedTime: essay.date, modifiedTime: essay.updated },
  });
}

export default async function EssayPage({ params }: PageProps<"/essays/[slug]">) {
  const essay = getEssay((await params).slug);
  if (!essay) notFound();
  const html = await renderEssay(essay);
  const url = `${site.url}/essays/${essay.slug}`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: essay.title,
          description: essay.summary,
          datePublished: essay.date,
          dateModified: essay.updated ?? essay.date,
          url,
          mainEntityOfPage: url,
          image: `${url}/opengraph-image`,
          author: { "@type": "Person", name: site.name, url: site.url },
        }}
      />

      <article>
        <header className="mb-12">
          <h1 className="font-serif text-[2rem] leading-[1.15] text-balance sm:text-[2.5rem]">
            {essay.title}
          </h1>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2 text-[0.9375rem] text-muted tabular-nums">
            <time dateTime={essay.date}>{essay.date}</time>
            {essay.updated && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Updated <time dateTime={essay.updated}>{essay.updated}</time>
                </span>
              </>
            )}
            {essay.draft && <DraftLabel className="ml-2" />}
          </p>
        </header>
        <Prose html={html} />
      </article>

      <hr className="mt-16 mb-12 border-rule" />

      {newsletterEnabled() && (
        <section aria-label="Subscribe" className="mb-12">
          <SubscribeForm />
        </section>
      )}

      <p className="text-[0.9375rem]">
        <Link href="/essays" className="link text-muted hover:text-ink">
          All essays
        </Link>
      </p>
    </>
  );
}
