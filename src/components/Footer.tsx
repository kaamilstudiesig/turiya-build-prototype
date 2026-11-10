"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// All taken from turiya.co: the contact block and the footer line.
const SITE = "https://www.turiya.co/";
const SOCIAL = [
  ["LinkedIn", "https://www.linkedin.com/company/turiya-avastha"],
  ["Instagram", "https://www.instagram.com/turiya_avastha/"],
  ["YouTube", "https://www.youtube.com/c/TuriyaAvastha"],
];
const PAGES = [["About", "#about"], ["Portfolio", "#portfolio"], ["Services", "#services"], ["FAQ", "#faq"]];

const link = "underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink";

export default function Footer() {
  const root = useRef<HTMLElement>(null);
  // The wordmark is revealed letter by letter, once, when the whole of it is in view.
  useEffect(() => {
    const sec = root.current!;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mark = sec.querySelector(".wordmark")!;
    const ctx = gsap.context(() => {
      gsap.set(".letter", { yPercent: 112, rotate: 6 });
      gsap.set(".rise", { y: 24, autoAlpha: 0 });
    }, sec);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio < 0.98) return;
        io.disconnect();
        ctx.add(() => {
          gsap.to(".rise", { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.07, ease: "expo.out" });
          gsap.to(".letter", { yPercent: 0, rotate: 0, duration: 1.25, stagger: 0.075, ease: "expo.out", delay: 0.1 });
        });
      },
      { threshold: [0.98] },
    );
    io.observe(mark);
    return () => {
      io.disconnect();
      ctx.revert();
    };
  }, []);

  return (
    <footer ref={root} id="next" data-snap className="relative flex h-svh flex-col justify-between overflow-hidden bg-mist px-4 pb-3 pt-[34px] text-ink lg:px-[34px] lg:pb-4 lg:pt-[55px]">
      <div className="flex flex-wrap items-end justify-between gap-x-[34px] gap-y-5">
        <h2 className="rise hero-type !text-[15vw] lg:!text-[min(7.6vw,13svh)]">
          <span className="uppercase">Your space</span>
          <br />
          <span className="uppercase">could be </span>
          <span className="hero-script">next.</span>
        </h2>
        <a href={`${SITE}#contact`} className="rise flex h-14 items-center gap-4 rounded-full bg-ink pl-7 pr-2 text-[17px] font-semibold text-white transition-colors hover:bg-[#22331a] lg:h-16 lg:text-[19px]">
          Book a shoot
          <span className="flex size-10 items-center justify-center rounded-full bg-orange text-ink lg:size-12">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
            </svg>
          </span>
        </a>
      </div>

      <div className="rise grid gap-x-[34px] gap-y-4 border-t-[1.5px] border-ink pt-4 text-[14px] font-medium leading-relaxed sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:pt-5 lg:text-[15px]">
        <address className="not-italic">
          <h3 className="mb-1.5 font-bold">Visit</h3>
          #1873, Level 3, 38th &lsquo;A&rsquo; Cross, 11th Main Rd., Jayanagar 4th &lsquo;T&rsquo; Block, Bengaluru 560041
        </address>
        <div>
          <h3 className="mb-1.5 font-bold">Talk</h3>
          <a className={link} href="mailto:namaste@turiya.co">namaste@turiya.co</a>
          <br />
          <a className={link} href="tel:+91-9900066693">+91 99000 66693</a>
        </div>
        <div>
          <h3 className="mb-1.5 font-bold">Follow</h3>
          <ul className="flex gap-4 lg:block">
            {SOCIAL.map(([name, href]) => (
              <li key={name}><a className={link} href={href}>{name}</a></li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="wordmark flex overflow-hidden uppercase text-green" aria-label="Turiya">
          {"Turiya".split("").map((ch, i) => (
            <span key={i} aria-hidden className="letter inline-block origin-bottom-left">{ch}</span>
          ))}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pt-2 text-[12px] font-medium lg:text-[13px]">
          <p>Copyright © 2026 Turiya Avastha Pvt. Ltd. All rights reserved.</p>
          <ul className="flex gap-4">
            {PAGES.map(([name, hash]) => (
              <li key={name}><a className={link} href={`${SITE}${hash}`}>{name}</a></li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
