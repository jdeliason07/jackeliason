import type { Metadata } from "next";
import { Cormorant_Garamond, Newsreader } from "next/font/google";
import Link from "next/link";
import Backdrop from "@/components/Backdrop";
import { site } from "@/lib/config";
import "./(site)/globals.css";

/**
 * The 404 for addresses that match no route. The site and Meros each have their own root
 * layout (app/(site) and app/(meros)), so there is no shared layout to compose a 404 from;
 * this page carries the site's look on its own.
 */
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-cormorant" });

export const metadata: Metadata = { title: `Not found · ${site.name}` };

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${newsreader.variable} ${cormorant.variable}`}>
      <body className="text-white">
        <Backdrop />
        <main className="mx-auto w-full max-w-[672px] px-6 pt-36 pb-28 sm:px-8">
          <h1 className="text-center font-display text-[3.5rem] leading-[1.02] sm:text-[5rem]">Not found</h1>
          <p className="mt-6 text-center text-lg sm:text-xl">
            There is nothing at this address. Try the{" "}
            <Link href="/essays" className="link">
              essays
            </Link>{" "}
            or the{" "}
            <Link href="/" className="link">
              homepage
            </Link>
            .
          </p>
        </main>
      </body>
    </html>
  );
}
