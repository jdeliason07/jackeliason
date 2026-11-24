import Image from "next/image";
import { site } from "@/lib/config";

/**
 * Each venture as a bookplate: the logo, a line about it, the whole plate a link to its site.
 * On hover or keyboard focus the line gives way to a concrete detail (CSS only; see .plate in globals.css).
 */
export default function Ventures() {
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {site.ventures.map((venture) => (
        <li key={venture.url} className="flex min-w-0">
          <a href={venture.url} className="plate">
            <span className="flex h-12 items-center justify-center">
              <Image
                src={venture.logo.src}
                width={venture.logo.width}
                height={venture.logo.height}
                alt={venture.name}
                unoptimized
                className="plate-logo"
                style={{ maxHeight: venture.logo.displayHeight, width: "auto", height: "auto" }}
              />
            </span>
            {/* Both lines share one grid cell, so the plate never changes height. */}
            <span className="plate-lines mt-3 text-[0.9375rem] leading-snug text-muted italic">
              <span className="plate-description">{venture.description}</span>
              <span className="plate-detail">{venture.detail}</span>
            </span>
            <span className="smallcaps mt-3 block text-muted">
              Visit&nbsp;<span aria-hidden="true" className="plate-arrow">→</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
