import type { Metadata } from "next";
import { site } from "./config";

type PageMetadata = {
  /** Page title; the layout appends " · Jack Eliason". Omit for the homepage. */
  title?: string;
  description: string;
  /** Canonical path, e.g. "/essays/on-simplicity". */
  path: string;
  article?: { publishedTime: string; modifiedTime?: string };
};

/**
 * Complete metadata for one page. Next.js replaces (does not merge) nested
 * objects such as openGraph and alternates, so every page sets all of them.
 * Preview images come from the opengraph-image file beside each page.
 */
export function pageMetadata({ title, description, path, article }: PageMetadata): Metadata {
  const fullTitle = title ?? site.name;
  return {
    title: title ?? { absolute: site.name },
    description,
    alternates: {
      canonical: path,
      types: { "application/rss+xml": [{ url: "/rss.xml", title: `${site.name}: Essays` }] },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: site.name,
      locale: "en_US",
      ...(article
        ? {
            type: "article",
            publishedTime: article.publishedTime,
            modifiedTime: article.modifiedTime,
            authors: [site.url],
          }
        : { type: "website" }),
    },
    twitter: {
      card: "summary_large_image",
      site: site.xHandle,
      creator: site.xHandle,
      title: fullTitle,
      description,
    },
  };
}
