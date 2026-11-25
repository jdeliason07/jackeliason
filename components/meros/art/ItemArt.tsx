import Image from "next/image";
import { itemSrc } from "@/lib/meros/content/art";
import { itemById } from "@/lib/meros/content/items";

/** A catalog item's photograph: studio shots for things you carry, on-site shots for estate decorations. */
export default function ItemArt({ itemId, className = "h-14 w-14" }: { itemId: string; className?: string }) {
  const item = itemById(itemId);
  if (!item) return null;
  return (
    <Image
      src={itemSrc(item.id)}
      alt={item.name}
      width={360}
      height={360}
      unoptimized
      className={`shrink-0 rounded-xl border border-blood object-cover ${className}`}
    />
  );
}
