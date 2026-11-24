import Link from "next/link";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <>
      <h1 className="text-center font-display text-[2.5rem] leading-tight sm:text-[3rem]">Not found</h1>
      <p className="mt-6 text-center text-lg sm:text-xl">
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
