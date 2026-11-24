import EssayList from "@/components/EssayList";
import { site } from "@/lib/config";
import { getEssays } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Essays",
  description: `Every essay by ${site.name}, newest first.`,
  path: "/essays",
});

export default function EssaysPage() {
  return (
    <>
      <h1 className="mb-10 font-serif text-[2rem] leading-tight sm:text-[2.25rem]">Essays</h1>
      <EssayList essays={getEssays()} />
    </>
  );
}
