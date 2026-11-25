"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";

/**
 * Where an item sits, given its distance from the centre in slots (0 = centre, ±1 = beside it):
 * the centre item is largest and flat; one smaller, angled item shows on each side, facing in;
 * anything further fades away. Shared by the server render (the starting position, so nothing
 * jumps on load) and the scroll handler.
 */
function place(offset: number): { transform: string; opacity: number; focus: number; z: number } {
  const near = Math.min(Math.abs(offset), 1);
  const far = Math.min(Math.max(Math.abs(offset) - 1, 0), 1);
  const side = Math.sign(offset);
  return {
    transform: `perspective(1100px) translateX(${(-side * (near * 16 + far * 12)).toFixed(2)}%) rotateY(${(-side * near * 48).toFixed(2)}deg) scale(${(1 - near * 0.3 - far * 0.15).toFixed(3)})`,
    opacity: Math.max(0, Math.min(1, 1 - (Math.abs(offset) - 1.2) / 0.5)),
    focus: 1 - near,
    z: 100 - Math.round(Math.abs(offset) * 10),
  };
}

/**
 * A horizontal carousel in the manner of Cover Flow. It is an ordinary scrolling row with
 * snap points (swipe, trackpad, shift-scroll, or the arrow keys once focused), so scrolling
 * down the page is never captured. Clicking a side item, or the arrows, brings it to the centre.
 */
export default function Coverflow({ label, className, children }: { label: string; className: string; children: React.ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const items = Children.toArray(children);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const row = track.current;
    if (!row) return;
    const slots = [...row.children] as HTMLElement[];
    let frame = 0;
    let slot = slots[0]?.offsetWidth || 1;

    const render = () => {
      frame = 0;
      const position = row.scrollLeft / slot;
      slots.forEach((item, index) => {
        const { transform, opacity, focus, z } = place(index - position);
        const face = item.firstElementChild as HTMLElement;
        face.style.transform = transform;
        face.style.opacity = String(opacity);
        face.style.setProperty("--focus", focus.toFixed(3));
        item.style.zIndex = String(z);
      });
      setCurrent(Math.round(position));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };
    const resize = new ResizeObserver(() => {
      slot = slots[0]?.offsetWidth || 1;
      schedule();
    });
    resize.observe(row);
    row.addEventListener("scroll", schedule, { passive: true });
    schedule();
    return () => {
      row.removeEventListener("scroll", schedule);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  const go = useCallback(
    (index: number) => {
      const row = track.current;
      const first = row?.firstElementChild as HTMLElement | null;
      if (!row || !first) return;
      const target = Math.max(0, Math.min(items.length - 1, index));
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollTo({ left: target * first.offsetWidth, behavior: still ? "auto" : "smooth" });
    },
    [items.length],
  );

  return (
    <div className={`coverflow ${className}`}>
      <ul ref={track} className="coverflow-track" tabIndex={0} aria-label={label}>
        {items.map((item, index) => {
          const start = place(index);
          return (
            <li key={index} className="coverflow-item" style={{ zIndex: start.z }} onClick={() => index !== current && go(index)}>
              <div
                className="coverflow-face"
                style={{ transform: start.transform, opacity: start.opacity, ["--focus" as string]: start.focus }}
              >
                {item}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="coverflow-controls">
        <button type="button" aria-label="Previous" disabled={current <= 0} onClick={() => go(current - 1)}>
          ←
        </button>
        <button type="button" aria-label="Next" disabled={current >= items.length - 1} onClick={() => go(current + 1)}>
          →
        </button>
      </div>
    </div>
  );
}
