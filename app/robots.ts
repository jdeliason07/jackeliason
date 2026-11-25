import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    // Meros is private (sign-in required); keep it out of search entirely.
    rules: { userAgent: "*", allow: "/", disallow: "/meros" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
