/**
 * The Library page (/library): books I've read and music I love, each as a carousel.
 *
 * Books: `cover` is an image in public/library/books/ (2:3, about 600px wide). A book
 * without one gets a typographic cover, so nothing ever shows a broken image.
 * Songs: each is a white record that reads "TITLE · ARTIST ·" around it as it spins.
 *
 * Entries marked `placeholder` are template entries: replace them with your own. The build
 * warns until they're gone (lib/placeholders.ts).
 */

export type Book = { title: string; author: string; cover?: string; placeholder?: true };
export type Song = { title: string; artist: string; placeholder?: true };

// TODO: Replace with the books you've read, most loved first.
export const books: Book[] = [
  { title: "Book one", author: "Author", placeholder: true },
  { title: "Book two", author: "Author", placeholder: true },
  { title: "Book three", author: "Author", placeholder: true },
  { title: "Book four", author: "Author", placeholder: true },
  { title: "Book five", author: "Author", placeholder: true },
  { title: "Book six", author: "Author", placeholder: true },
];

// TODO: Replace with your favorite songs.
export const songs: Song[] = [
  { title: "Song one", artist: "Artist", placeholder: true },
  { title: "Song two", artist: "Artist", placeholder: true },
  { title: "Song three", artist: "Artist", placeholder: true },
  { title: "Song four", artist: "Artist", placeholder: true },
  { title: "Song five", artist: "Artist", placeholder: true },
  { title: "Song six", artist: "Artist", placeholder: true },
];
