import Prose from "@/components/Prose";
import { site } from "@/lib/config";
import { getPage, renderPage } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Now",
  description: `What ${site.name} is focused on now.`,
  path: "/now",
});

export default async function NowPage() {
  const page = getPage("now");
  const html = await renderPage(page);

  return (
    <>
      <header className="mb-12">
        <h1 className="font-serif text-[2rem] leading-tight sm:text-[2.25rem]">Now</h1>
        <p className="mt-4 text-[0.9375rem] text-muted">
          Updated <time dateTime={page.updated}>{page.updated}</time>
        </p>
      </header>
      <Prose html={html} />
    </>
  );
}
