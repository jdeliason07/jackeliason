import type { Metadata, Viewport } from "next";
import { IM_Fell_English, Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { site } from "@/lib/config";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
});

// Italic is rarely above the fold, so it loads on first use instead of with every page.
const newsreaderItalic = Newsreader({
  subsets: ["latin"],
  style: "italic",
  preload: false,
  variable: "--font-newsreader-italic",
});

/** An old-style display face, after the Fell types of the 1670s: titles, the name, drop caps. */
const fell = IM_Fell_English({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fell",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  authors: [{ name: site.name, url: site.url }],
};

export const viewport: Viewport = {
  themeColor: "#fbfaf7",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${newsreaderItalic.variable} ${fell.variable}`}>
      <body className="bg-paper text-ink">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:bg-paper focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <div className="px-6 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto w-full max-w-[672px]">
            <Header />
            <main id="content">{children}</main>
            <Footer />
          </div>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
