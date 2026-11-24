import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <>
      <h1 className="font-serif text-[2rem] leading-tight sm:text-[2.25rem]">Not found</h1>
      <p className="mt-6 font-serif text-lg sm:text-xl">
        There is nothing at this address. Try the{" "}
        <Link href="/essays" className="link">
          essays
        </Link>{" "}
        or the{" "}
        <Link href="/" className="link">
          homepage
        </Link>
        .
      </p>
    </>
  );
}
