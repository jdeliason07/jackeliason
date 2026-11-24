import Prose from "@/components/Prose";
import { site } from "@/lib/config";
import { getPage, renderPage } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Canon",
  description: `The books, thinkers, essays, and ideas that have shaped ${site.name}'s worldview.`,
  path: "/canon",
});

export default async function CanonPage() {
  const html = await renderPage(getPage("canon"));

  return (
    <>
      <h1 className="mb-12 font-serif text-[2rem] leading-tight sm:text-[2.25rem]">Canon</h1>
      <Prose html={html} className="prose-canon" />
    </>
  );
}
