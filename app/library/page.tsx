import BookCover from "@/components/BookCover";
import Coverflow from "@/components/Coverflow";
import Vinyl from "@/components/Vinyl";
import { site } from "@/lib/config";
import { books, songs } from "@/lib/library";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Library",
  description: `Books ${site.name} has read, and favorite music.`,
  path: "/library",
});

/** Books, then music below: two carousels. The entries live in lib/library.ts. */
export default function LibraryPage() {
  return (
    <>
      <h1 className="text-center font-display text-[2.75rem] leading-tight sm:text-[3.5rem]">Library</h1>

      <section aria-labelledby="books-heading" className="mt-10 sm:mt-14">
        <h2 id="books-heading" className="smallcaps text-center">
          Books
        </h2>
        <Coverflow label="Books I’ve read" className="coverflow-books">
          {books.map((book, index) => (
            <BookCover key={`${book.title}-${index}`} book={book} index={index} />
          ))}
        </Coverflow>
      </section>

      <section aria-labelledby="music-heading" className="mt-16 sm:mt-20">
        <h2 id="music-heading" className="smallcaps text-center">
          Music
        </h2>
        <Coverflow label="Favorite music" className="coverflow-records">
          {songs.map((song, index) => (
            <Vinyl key={`${song.title}-${index}`} song={song} index={index} />
          ))}
        </Coverflow>
      </section>
    </>
  );
}
