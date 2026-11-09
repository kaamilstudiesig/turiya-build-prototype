"use client";

import { useEffect } from "react";
import Lenis from "lenis";

// Fast start, soft landing: the page answers the wheel straight away.
const ease = (t: number) => 1 - Math.pow(1 - t, 4);
const GLIDE = 0.85;
// A wheel gesture counts as finished once the wheel has been quiet this long.
const QUIET = 280;

// Mouse and trackpad: one wheel gesture glides exactly one stop.
// Touch keeps native scrolling and uses CSS scroll snap (see globals.css).
export default function SmoothScroll() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let busy = false, waitForQuiet = false, last = 0, guard = 0, settle = 0;
    const stops = () =>
      [...document.querySelectorAll<HTMLElement>("[data-snap]")].map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));

    const glide = (to: number, duration = GLIDE) => {
      busy = true;
      clearTimeout(guard);
      // Never leave scrolling locked if the glide gets interrupted.
      guard = window.setTimeout(() => (busy = false), duration * 1000 + 400);
      lenis.scrollTo(to, {
        duration,
        easing: ease,
        lock: true,
        onComplete: () => {
          clearTimeout(guard);
          busy = false;
          waitForQuiet = true;
        },
      });
    };

    const step = (dir: 1 | -1) => {
      if (busy) return;
      const y = window.scrollY, all = stops();
      const to = dir > 0 ? all.find((v) => v > y + 2) : all.findLast((v) => v < y - 2);
      if (to !== undefined) glide(to);
    };

    const lenis = new Lenis({
      anchors: { duration: GLIDE, easing: ease },
      virtualScroll: (e) => {
        if (e.event.type !== "wheel") return true;
        const now = performance.now(), gap = now - last;
        last = now;
        if (busy) return false;
        // The rest of the same gesture (more wheel notches, trackpad momentum) must not
        // trigger a second jump, or one scroll would skip straight past a stop.
        if (waitForQuiet) {
          if (gap < QUIET) return false;
          waitForQuiet = false;
        }
        if (Math.abs(e.deltaY) >= 2) step(e.deltaY > 0 ? 1 : -1);
        return false;
      },
    });

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName)) && e.key === " ") return;
      const down = e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey);
      const up = e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey);
      if (!down && !up) return;
      e.preventDefault();
      step(down ? 1 : -1);
    };

    // If the page ever comes to rest between stops (scrollbar drag, Home/End), finish the move.
    const onScroll = () => {
      clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (busy) return;
        const y = window.scrollY;
        const near = stops().reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
        if (Math.abs(near - y) > 2) glide(near, 0.5);
      }, 180);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    let raf = requestAnimationFrame(function tick(t) {
      lenis.raf(t);
      raf = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(guard);
      clearTimeout(settle);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      lenis.destroy();
    };
  }, []);
  return null;
}
