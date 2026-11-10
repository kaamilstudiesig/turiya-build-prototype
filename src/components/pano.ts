"use client";

import { useEffect, type RefObject } from "react";

// One full turn of a pano strip is this many times its height (strips are 2000 × 440).
const TURN = 2000 / 440;

// Makes every [data-pano] element inside `root` a tiny live panorama: its background strip
// drifts sideways forever (a 360° photo wraps seamlessly) and can be dragged to look around.
// data-pano holds the drift speed in px/s at a 110px tall strip; data-start is where to begin (0..1).
export function usePanoStrips(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const sec = root.current;
    if (!sec) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const strips = [...sec.querySelectorAll<HTMLElement>("[data-pano]")].map((el) => ({
      el,
      speed: Number(el.dataset.pano),
      x: 0,
      began: false,
      held: false,
      last: 0,
      px: 0,
    }));
    type Strip = (typeof strips)[number];
    const place = (p: Strip) => {
      const turn = p.el.clientHeight * TURN;
      if (!p.began) {
        p.x = -Number(p.el.dataset.start ?? 0) * turn;
        p.began = true;
      }
      p.el.style.backgroundPositionX = `${p.x % turn}px`;
    };

    let raf = 0, prev = performance.now(), onScreen = false;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      for (const p of strips) {
        // Drift slowly, pause while held and for a moment after letting go.
        if (!p.held && now - p.last > 1400) p.x -= p.speed * dt * (p.el.clientHeight / 110);
        place(p);
      }
      if (onScreen) raf = requestAnimationFrame(tick);
    };
    strips.forEach(place);

    // Only animate while the section is on screen.
    const io = new IntersectionObserver(([e]) => {
      const was = onScreen;
      onScreen = e.isIntersecting;
      if (onScreen && !was && !still) {
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(sec);

    const offs = strips.map((p) => {
      const down = (e: PointerEvent) => {
        p.held = true;
        p.px = e.clientX;
        p.el.setPointerCapture(e.pointerId);
      };
      const move = (e: PointerEvent) => {
        if (!p.held) return;
        p.x += e.clientX - p.px;
        p.px = e.clientX;
        if (still) place(p);
      };
      const up = () => {
        p.held = false;
        p.last = performance.now();
      };
      p.el.addEventListener("pointerdown", down);
      p.el.addEventListener("pointermove", move);
      p.el.addEventListener("pointerup", up);
      p.el.addEventListener("pointercancel", up);
      return () => {
        p.el.removeEventListener("pointerdown", down);
        p.el.removeEventListener("pointermove", move);
        p.el.removeEventListener("pointerup", up);
        p.el.removeEventListener("pointercancel", up);
      };
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      offs.forEach((off) => off());
    };
  }, [root]);
}
