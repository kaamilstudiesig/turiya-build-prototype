"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Each pill is a live strip of a real 360° photo: the band around the horizon,
// which wraps seamlessly, so it can pan forever and be dragged like a tiny tour.
const PILLS = {
  pool: { src: "/tour/pill-node31.webp", speed: 22, start: 0.3 },
  courtyard: { src: "/tour/pill-node78.webp", speed: -17, start: 0.05 },
  garden: { src: "/tour/pill-node15.webp", speed: 19, start: 0.62 },
};
// Width of one full turn, as a multiple of the pill's height (the strip is 2000 × 440).
const TURN = 2000 / 440;

// `phone` is the width on small screens, where the headline wraps onto more lines.
const Pill = ({ k, width, phone = width }: { k: keyof typeof PILLS; width: string; phone?: string }) => (
  <span
    data-pill={k}
    aria-hidden
    className="pill inline-block h-[0.74em] w-[var(--phone)] shrink-0 lg:w-[var(--wide)] cursor-grab touch-pan-y select-none rounded-full border-ink bg-ink bg-[length:auto_100%] bg-repeat-x align-middle shadow-[0_0.06em_0_rgb(16_25_11/0.25)] active:cursor-grabbing"
    style={{ "--wide": width, "--phone": phone, borderWidth: "max(3px, 0.045em)", backgroundImage: `url(${PILLS[k].src})` } as React.CSSProperties}
  />
);

const Arrow = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d={d} />
  </svg>
);

export default function Hero() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const sec = root.current!;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pills = [...sec.querySelectorAll<HTMLElement>(".pill")].map((el) => {
      const cfg = PILLS[el.dataset.pill as keyof typeof PILLS];
      return { el, cfg, x: 0, held: false, last: 0, px: 0, began: false };
    });
    const place = (p: (typeof pills)[number]) => {
      const turn = p.el.clientHeight * TURN;
      if (!p.began) {
        p.x = -cfg0(p) * turn;
        p.began = true;
      }
      p.el.style.backgroundPositionX = `${p.x % turn}px`;
    };
    const cfg0 = (p: (typeof pills)[number]) => p.cfg.start;

    let raf = 0, prev = performance.now(), onScreen = true;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      for (const p of pills) {
        // Drift slowly, pause while held and for a moment after letting go.
        if (!p.held && now - p.last > 1400) p.x -= p.cfg.speed * dt * (p.el.clientHeight / 110);
        place(p);
      }
      if (onScreen) raf = requestAnimationFrame(tick);
    };
    pills.forEach(place);
    if (!still) raf = requestAnimationFrame(tick);

    // Only animate while the hero is on screen.
    const io = new IntersectionObserver(([e]) => {
      const was = onScreen;
      onScreen = e.isIntersecting;
      if (onScreen && !was && !still) {
        prev = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    io.observe(sec);

    const offs = pills.map((p) => {
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

    // One entrance: words rise, pills open like shutters, the rest follows.
    const ctx = gsap.context(() => {
      if (still) return;
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from(".word", { yPercent: 110, duration: 1.1, stagger: 0.07 }, 0.1);
      tl.from(".pill", { scaleX: 0, transformOrigin: "0% 50%", duration: 1.1, stagger: 0.12 }, 0.35);
      tl.from(".rise", { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.08 }, 0.7);
    }, sec);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      offs.forEach((off) => off());
      ctx.revert();
    };
  }, []);

  const word = "word inline-block";
  const clip = "inline-block overflow-hidden pb-[0.08em] align-middle";

  return (
    <section ref={root} data-snap className="relative flex h-svh flex-col justify-between overflow-hidden bg-green px-4 pb-5 pt-4 text-ink lg:px-[34px] lg:pb-[34px] lg:pt-[21px]">
      <nav className="rise flex items-center justify-between gap-3" aria-label="Main">
        <a href="https://www.turiya.co/" className="flex h-11 items-center rounded-full bg-ink px-4 lg:h-12 lg:px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tour/turiya.svg" alt="Turiya" className="h-5 w-auto lg:h-6" />
        </a>
        <div className="flex items-center gap-2 lg:gap-6">
          <a href="#build" className="hidden rounded-full px-3 py-2 text-[14px] font-semibold transition-colors hover:bg-ink/10 sm:block">How we build</a>
          <a href="https://www.turiya.co/#contact" className="flex h-11 items-center gap-3 rounded-full bg-ink pl-5 pr-1.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#22331a] lg:h-12 lg:text-[15px]">
            Book a shoot
            <span className="flex size-8 items-center justify-center rounded-full bg-orange text-ink lg:size-9"><Arrow d="M4.5 11.5l7-7M6 4.5h5.5V10" /></span>
          </a>
        </div>
      </nav>

      <h1 className="hero-type flex flex-wrap items-center gap-x-[0.16em] gap-y-[0.02em] uppercase" aria-label="Places you can walk into.">
        <span className={clip} aria-hidden><span className={word}>Places</span></span>
        <Pill k="pool" width="2.5em" phone="2.6em" />
        <span className={clip} aria-hidden><span className={word}>you</span></span>
        <span className="hidden basis-full lg:block" />
        <span className={clip} aria-hidden><span className={word}>can</span></span>
        <span className={`${clip} hero-script normal-case`} aria-hidden><span className={word}>walk</span></span>
        <span className="hidden basis-full lg:block" />
        <Pill k="courtyard" width="1.9em" />
        <span className={clip} aria-hidden><span className={word}>into.</span></span>
        <Pill k="garden" width="1.9em" phone="4.7em" />
      </h1>

      <div className="grid items-end gap-x-[34px] gap-y-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto]">
        <p className="rise max-w-[36ch] text-[16px] font-medium leading-snug lg:text-[21px]">
          Turiya is a Bengaluru immersive tech studio. We turn real places into 360° tours people can explore on web, Google Maps and VR.
        </p>
        <div className="rise hidden lg:block">
          <p className="mb-3 inline-flex -rotate-2 items-center gap-2.5 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white">
            <span className="size-2 rounded-full bg-orange" />
            Drag a pill to look around
          </p>
          <p className="max-w-[40ch] text-[13px] font-medium leading-relaxed">
            Hospitality, Education, Food &amp; Beverage, Retail, Health &amp; Wellness, Real Estate
          </p>
        </div>
        <a href="#build" className="rise flex h-12 items-center justify-between gap-3 rounded-full border-[1.5px] border-ink px-5 text-[15px] font-semibold transition-colors hover:bg-ink hover:text-white lg:h-[52px] lg:px-6">
          See how a tour is built
          <Arrow d="M8 2.5v11M3.5 9 8 13.5 12.5 9" />
        </a>
      </div>
    </section>
  );
}
