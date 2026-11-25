import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { warnAboutPlaceholders } from "./lib/placeholders";

const nextConfig: NextConfig = {
  // Every page is generated at build time, so content/ is never read at
  // runtime. Keep it (and any drafts in it) out of the deployed server bundle.
  outputFileTracingExcludes: {
    "/**": ["./content/**/*"],
  },
  experimental: {
    // The site (app/(site)) and Earned (app/(earned)) have separate root layouts, so unmatched
    // addresses need a 404 of their own: app/global-not-found.tsx.
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default function config(phase: string): NextConfig {
  // Print once per build, in the main process only.
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.PLACEHOLDER_WARNING_SHOWN) {
    process.env.PLACEHOLDER_WARNING_SHOWN = "1";
    warnAboutPlaceholders();
  }
  return nextConfig;
}
