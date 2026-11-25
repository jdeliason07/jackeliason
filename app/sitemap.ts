import type { MetadataRoute } from "next";
import { site } from "@/lib/config";
import { getEssays, getPage } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const essays = getEssays().filter((essay) => !essay.draft);
  const latest = essays.map((essay) => essay.updated ?? essay.date).sort().at(-1);

  return [
    { url: site.url, lastModified: latest },
    { url: `${site.url}/essays`, lastModified: latest },
    ...essays.map((essay) => ({
      url: `${site.url}/essays/${essay.slug}`,
      lastModified: essay.updated ?? essay.date,
    })),
    { url: `${site.url}/now`, lastModified: getPage("now").updated },
    { url: `${site.url}/canon` },
    { url: `${site.url}/library` },
  ];
}
