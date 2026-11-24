import Prose from "@/components/Prose";
import { site } from "@/lib/config";
import { getPage, renderPage } from "@/lib/content";
import { formatDate } from "@/lib/format";
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
      <header className="mb-12 text-center">
        <h1 className="font-display text-[2.5rem] leading-tight sm:text-[3rem]">Now</h1>
        {page.updated && (
          <p className="smallcaps mt-3 text-muted">
            Updated <time dateTime={page.updated}>{formatDate(page.updated)}</time>
          </p>
        )}
      </header>
      <Prose html={html} />
    </>
  );
}
