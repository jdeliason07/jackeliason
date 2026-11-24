import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { warnAboutPlaceholders } from "./lib/placeholders";

const nextConfig: NextConfig = {
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
