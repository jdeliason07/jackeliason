"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import PasswordForm from "./PasswordForm";

/**
 * The + in the corner of the essay pages. It opens the editor: for a new essay
 * from the archive, or for this essay from an essay's page. The editor asks for
 * the password first unless this browser is already signed in.
 */
export default function EditButton({ slug }: { slug?: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const target = slug ? `/write?essay=${encodeURIComponent(slug)}` : "/write";

  async function open() {
    try {
      const response = await fetch("/api/editor/session", { cache: "no-store" });
      const state = (await response.json()) as { signedIn?: boolean };
      if (state.signedIn) return router.push(target);
    } catch {
      // Fall through to the password; it reports any connection problem.
    }
    dialog.current?.showModal();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={slug ? "Edit this essay" : "Write a new essay"}
        className="fixed right-4 bottom-24 z-20 flex size-12 cursor-pointer items-center justify-center rounded-full bg-white text-[1.75rem] leading-none text-ink shadow-[0_10px_30px_-12px_rgb(42_31_22/0.55)] transition-transform hover:scale-105 active:scale-95 sm:right-6 sm:bottom-6 motion-reduce:transition-none"
      >
        <span aria-hidden="true" className="-mt-0.5">
          +
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-label="Sign in to write"
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-[1.25rem] bg-white p-6 shadow-[0_24px_60px_-20px_rgb(42_31_22/0.6)] backdrop:bg-ink/40 sm:p-8"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close(); // click outside the card closes it
        }}
      >
        <PasswordForm onSignedIn={() => router.push(target)} />
      </dialog>
    </>
  );
}
