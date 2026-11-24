import { notFound } from "next/navigation";
import { getEssay, getEssays } from "@/lib/content";
import { ogAlt, ogContentType, ogImage, ogSize } from "@/lib/og";

export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;
export const dynamicParams = false;

export function generateStaticParams() {
  return getEssays().map((essay) => ({ slug: essay.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const essay = getEssay((await params).slug);
  if (!essay) notFound();
  return ogImage({ title: essay.title, date: essay.date });
}
