import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    // Earned is private (sign-in required); keep it out of search entirely.
    rules: { userAgent: "*", allow: "/", disallow: "/earned" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
