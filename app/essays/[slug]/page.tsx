import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DraftLabel from "@/components/DraftLabel";
import JsonLd from "@/components/JsonLd";
import Prose from "@/components/Prose";
import ReadingProgress from "@/components/ReadingProgress";
import SubscribeForm from "@/components/SubscribeForm";
import { newsletterEnabled, site } from "@/lib/config";
import { getEssay, getEssays, renderEssay } from "@/lib/content";
import { formatDate } from "@/lib/format";
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
      <ReadingProgress />
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
        <header className="mb-12 text-center">
          <p className="smallcaps flex flex-wrap items-baseline justify-center gap-x-2">
            <time dateTime={essay.date}>{formatDate(essay.date)}</time>
            {essay.updated && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Updated <time dateTime={essay.updated}>{formatDate(essay.updated)}</time>
                </span>
              </>
            )}
            {essay.draft && <DraftLabel className="ml-2" />}
          </p>
          <h1 className="mt-4 font-display text-[2.75rem] leading-[1.05] text-balance sm:text-[3.75rem]">
            {essay.title}
          </h1>
        </header>
        <div className="surface">
          <Prose html={html} className="dropcap" />
        </div>
      </article>

      {newsletterEnabled() && (
        <section aria-label="Subscribe" className="mt-16">
          <SubscribeForm />
        </section>
      )}
    </>
  );
}
