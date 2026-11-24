import { site } from "@/lib/config";
import { ogAlt, ogContentType, ogImage, ogSize } from "@/lib/og";

export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

/** The homepage shows the name only. */
export default function Image() {
  return ogImage({ title: site.name, byline: false });
}
