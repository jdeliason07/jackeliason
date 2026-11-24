import { Nothing_You_Could_Do } from "next/font/google";

/**
 * The essay hand: Nothing You Could Do, for an essay's title and text.
 * Defined here rather than in the root layout so only the pages that use it
 * (essays and the editor) load it.
 */
export const essayHand = Nothing_You_Could_Do({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-nothing",
});
