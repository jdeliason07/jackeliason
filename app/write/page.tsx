import type { Metadata } from "next";
import { Suspense } from "react";
import Editor from "@/components/Editor";
import { essayHand } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Write",
  robots: { index: false, follow: false },
};

/** The in-site editor. Static shell; the editor itself checks the session and talks to app/api/editor. */
export default function WritePage() {
  return (
    <div className={essayHand.variable}>
      <h1 className="mb-10 text-center font-display text-[3.5rem] leading-[1.02] sm:text-[5rem]">Write</h1>
      <Suspense fallback={<p className="text-center italic">Opening the editor…</p>}>
        <Editor />
      </Suspense>
    </div>
  );
}
