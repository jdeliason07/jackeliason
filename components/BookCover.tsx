import Image from "next/image";
import type { Book } from "@/lib/library";

/** Covers without an image are set in type on one of three tones from the palette. */
const TONES = ["book-tone-wood", "book-tone-ink", "book-tone-deep"];

/** A book: its cover, and the title beneath. */
export default function BookCover({ book, index }: { book: Book; index: number }) {
  return (
    <figure className="book">
      {book.cover ? (
        <Image src={book.cover} alt="" width={400} height={600} unoptimized className="book-cover" draggable={false} />
      ) : (
        <div aria-hidden="true" className={`book-cover book-type ${TONES[index % TONES.length]}`}>
          <span className="book-type-title">{book.title}</span>
          <span className="book-type-author">{book.author}</span>
        </div>
      )}
      <figcaption className="book-title">{book.title}</figcaption>
    </figure>
  );
}
