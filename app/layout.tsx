import type { Metadata, Viewport } from "next";
import { IM_Fell_English, Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import FloatingNav from "@/components/FloatingNav";
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

/**
 * Runs before first paint. Chapters (components/Reveal.tsx) start hidden only
 * when this marks the page ready: IntersectionObserver exists and the reader
 * hasn't asked for reduced motion. If the reveal code never starts (a script
 * failed to load), the mark is removed after 5s so nothing stays hidden.
 */
const revealScript = `(function(){try{var d=document.documentElement;if(!("IntersectionObserver" in window)||matchMedia("(prefers-reduced-motion: reduce)").matches)return;d.setAttribute("data-reveal","ready");setTimeout(function(){if(document.querySelector(".reveal")&&!("revealLive" in d.dataset))d.removeAttribute("data-reveal")},5000)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${newsreaderItalic.variable} ${fell.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: revealScript }} />
      </head>
      <body className="bg-paper text-ink">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:bg-paper focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <div className="px-6 pb-28 sm:px-8 sm:pb-32">
          <div className="mx-auto w-full max-w-[672px]">
            <Header />
            <main id="content">{children}</main>
            <Footer />
          </div>
        </div>
        <FloatingNav />
        <Analytics />
      </body>
    </html>
  );
}
