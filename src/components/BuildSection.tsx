"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import tour from "@/data/tour.json";
import { S, resetState, spotEls } from "./state";

const PanoStage = dynamic(() => import("./PanoStage"), { ssr: false });

const STEPS = [
  { name: "Plan", line: "Fly the drone, map the property and decide where the camera stands." },
  { name: "Capture", line: "Shoot a full 360° at every stop. Each one comes back as a flat, stretched photo." },
  { name: "Stitch", line: "Wrap the flat photo into a sphere, then step inside it." },
  { name: "Hotspots", line: "Link the stops and tag what matters, so visitors can walk the place." },
  { name: "Publish", line: "Dress it in the client's brand and push it live." },
];
const VIEW_LABEL = ["Top view, Farm Overview", `${tour.hero.file}, flat`, "Stitching", tour.hero.title, tour.hero.title];
// Timeline seconds at which each step begins.
const T = [0, 3.6, 6, 10.5, 14.9, 19.2];
// Timeline seconds played per real second.
const SPEED = 1.35;

const pick = (title: string) => tour.hero.hotspots.find((h) => h.title === title)!;
const SPOTS = [pick("Kids Zone"), pick("Amphitheater / Campfire Area"), tour.hero.hotspots.find((h) => h.target === "node33")!];
const HERO_INDEX = tour.strip.findIndex((s) => s.id === tour.hero.id);
const STRIP = [...tour.strip.slice(0, 2), tour.strip[HERO_INDEX], ...tour.strip.slice(2).filter((s) => s.id !== tour.hero.id)];

const TEAM = [
  { name: "Capture", color: "#74b94e" },
  { name: "Stitch", color: "#f89833" },
  { name: "Hotspots", color: "#ffd700" },
  { name: "Brand", color: "#ffffff" },
];

const Field = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-0">
    <dt className="text-dim">{k}</dt>
    <dd className="num truncate text-right text-ink">{v}</dd>
  </div>
);

export default function BuildSection() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [active, setActive] = useState(false);
  const replay = useRef<() => void>(() => {});
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // The page snaps to this section once, then the whole build plays like a video.
  useEffect(() => {
    const st = stage.current!, sec = root.current!;
    const q = gsap.utils.selector(st);
    let ctx: gsap.Context | undefined;
    let tl: gsap.core.Timeline | undefined;
    let visible = false, finished = false, lastW = 0, lastH = 0;

    const rect = (el: Element) => {
      const r = el.getBoundingClientRect(), s = st.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, cx: r.left - s.left + r.width / 2, cy: r.top - s.top + r.height / 2 };
    };

    const build = () => {
      ctx?.revert();
      tl = undefined;
      resetState();
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      S.stage = { w: st.clientWidth, h: st.clientHeight };
      if (reduced) {
        S.cell = { x: 0, y: 0, w: st.clientWidth, h: st.clientHeight };
        Object.assign(S, { alpha: 1, fly: 1, bend: 1, zoom: 1, yaw: 20, pitch: -6, off: 0, live: true });
        return;
      }
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      const cell = rect(q(".cell")[0]);
      S.cell = { x: cell.x, y: cell.y, w: cell.w, h: cell.h };
      st.style.setProperty("--cx", String(cell.cx));
      st.style.setProperty("--cy", String(cell.cy));

      ctx = gsap.context(() => {
        // Measure cursor targets before anything is moved.
        const pins = q(".pin").map(rect);
        const thumbs = q(".thumb-box").map(rect);
        const thumb = rect(q(".thumb-hero .thumb-box")[0]);
        const publish = rect(q(".publish")[0]);
        const insp = desktop ? rect(q(".chrome-right")[0]) : cell;
        const rail = desktop ? rect(q(".chrome-left")[0]) : cell;
        const swatch = desktop ? rect(q(".swatch")[0]) : cell;
        const track = desktop ? rect(q(".bar-track")[0]) : cell;
        const rows = desktop ? q(".hs-row").map(rect) : [];
        S.thumb = { cx: thumb.cx, cy: thumb.cy, w: thumb.w };
        const W = st.clientWidth, H = st.clientHeight;
        const clipCell = `inset(${cell.y}px ${W - cell.x - cell.w}px ${H - cell.y - cell.h}px ${cell.x}px)`;
        const at = (cx: number, cy: number) => ({ cx, cy });

        gsap.set(q(".pin, .hs"), { scale: 0, autoAlpha: 0 });
        gsap.set(q(".link"), { strokeDashoffset: 1 });
        gsap.set(q(".thumb img, .thumb figcaption"), { autoAlpha: 0, y: 10 });
        gsap.set(q(".insp:not(.insp-0), .hs-row, .skin, .skin-on, .published, .hint, .thumb-ring, .click, .reticle"), { autoAlpha: 0 });
        gsap.set(q(".skin"), { left: cell.x, top: cell.y, width: cell.w, height: cell.h });
        gsap.set(q(".bar"), { scaleX: 0 });
        gsap.set(q(".view"), { clipPath: "inset(0px 0px 0px 0px)" });
        // The team starts spread around the editor.
        [at(cell.cx + 90, cell.cy + 150), at(cell.x + 70, cell.y + cell.h - 60), at(insp.cx, insp.y + 130), at(cell.x + cell.w - 90, cell.y + 70)].forEach((p, k) =>
          gsap.set(q(`.cur-${k}`), { x: p.cx, y: p.cy }),
        );

        const bars = [...sec.querySelectorAll<HTMLElement>(".prog")];
        const count = { pan: 0, hs: 0, zones: 0 };
        const write = (sel: string, v: number) => q(sel).forEach((el) => (el.textContent = String(Math.round(v))));

        const t = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.out" },
          onUpdate: () => {
            const now = t.time();
            const k = T.findIndex((_, n) => now <= T[n + 1] + 0.001);
            const i = k < 0 ? 4 : k;
            setStep(i);
            bars.forEach((el) => {
              const n = Number(el.dataset.i);
              el.style.transform = `scaleX(${n < 0 ? now / T[5] : Math.max(0, Math.min(1, (now - T[n]) / (T[n + 1] - T[n])))})`;
            });
            const live = now > T[4] + 3.6;
            if (live !== S.live) {
              S.live = live;
              S.lastDrag = performance.now();
              if (!live) gsap.to(S, { dragYaw: 0, dragPitch: 0, duration: 0.5, overwrite: "auto" });
            }
          },
          onComplete: () => {
            finished = true;
            setDone(true);
          },
        });
        t.timeScale(SPEED);
        tl = t;

        // k = which team member: 0 Capture, 1 Stitch, 2 Hotspots, 3 Brand
        const go = (k: number, p: { cx: number; cy: number }, when: number, d = 0.5, dx = 0, dy = 0) =>
          desktop && t.to(q(`.cur-${k}`), { x: p.cx + dx, y: p.cy + dy, duration: d, ease: "power2.inOut" }, when);
        const click = (k: number, when: number) =>
          desktop && t.fromTo(q(`.cur-${k} .click`), { scale: 0.3, autoAlpha: 0.9 }, { scale: 1.7, autoAlpha: 0, duration: 0.3, ease: "power1.out" }, when);
        const swap = (from: number, to: number, when: number) => {
          t.to(q(`.insp-${from}`), { autoAlpha: 0, y: -8, duration: 0.3 }, when);
          t.fromTo(q(`.insp-${to}`), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35 }, when + 0.2);
        };

        // 1. Plan: three people drop pins on the drone map at once
        t.to(count, { pan: tour.stats.panoramas, duration: 2.8, ease: "none", onUpdate: () => write(".n-pan", count.pan) }, 0.4);
        const pinTeam = [0, 1, 3];
        pins.forEach((p, i) => {
          const when = 0.35 + i * 0.42, k = pinTeam[i % 3];
          go(k, p, when, 0.5);
          click(k, when + 0.5);
          t.to(q(".pin")[i], { scale: 1, autoAlpha: 1, duration: 0.22, ease: "back.out(2.4)" }, when + 0.5);
          t.to(q(".link")[i], { strokeDashoffset: 0, duration: 0.4, ease: "power1.inOut" }, when + 0.54);
        });
        go(2, at(insp.cx - 40, insp.y + 100), 0.5, 0.6);
        go(2, at(insp.cx + 30, insp.y + 230), 1.8, 0.8);

        // 2. Capture: the flat photos come in, one lifts out of the strip
        swap(0, 1, T[1]);
        t.to(q(".thumb img, .thumb figcaption"), { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.04 }, T[1] + 0.05);
        go(0, thumb, T[1] + 0.35, 0.5);
        go(1, thumbs[6], T[1] + 0.2, 0.6);
        go(3, thumbs[9], T[1] + 0.3, 0.6);
        go(2, at(insp.cx, insp.y + 140), T[1] + 0.4, 0.6);
        click(0, T[1] + 0.85);
        t.to(q(".thumb-ring"), { autoAlpha: 1, duration: 0.12 }, T[1] + 0.85);
        t.to(q(".map"), { autoAlpha: 0, scale: 0.97, duration: 0.6, ease: "power1.inOut" }, T[1] + 0.85);
        t.to(S, { alpha: 1, duration: 0.12, ease: "none" }, T[1] + 0.9);
        t.to(S, { fly: 1, duration: 1.15, ease: "power3.inOut" }, T[1] + 0.9);
        go(0, at(cell.x + cell.w * 0.8, cell.y + cell.h * 0.82), T[1] + 1.2, 0.7);

        // 3. Stitch: someone drags Flat to Sphere, the sheet curls and the camera steps inside
        t.set(q(".view"), { clipPath: clipCell }, T[2]);
        swap(1, 2, T[2]);
        go(1, at(track.x, track.cy), T[2], 0.4);
        click(1, T[2] + 0.4);
        if (desktop) t.to(q(".cur-1"), { x: track.x + track.w, duration: 3.3, ease: "power1.inOut" }, T[2] + 0.4);
        go(0, at(cell.x + 60, cell.y + cell.h - 50), T[2] + 0.6, 0.8);
        go(3, at(cell.x + cell.w - 70, cell.y + 60), T[2] + 0.8, 0.8);
        go(2, thumbs[3], T[2] + 1, 0.9);
        t.to(S, { grid: 1, duration: 0.5 }, T[2]);
        t.to(S, { bend: 1, duration: 3.3, ease: "power1.inOut" }, T[2] + 0.4);
        t.to(q(".bar"), { scaleX: 1, duration: 3.3, ease: "power1.inOut" }, T[2] + 0.4);
        t.to(S, { zoom: 1, duration: 2.9, ease: "power2.inOut" }, T[2] + 1.1);
        t.to(S, { grid: 0, duration: 0.7 }, T[2] + 3.6);

        // 4. Hotspots: turn to each real hotspot position, one drops it, another fills it in
        swap(2, 3, T[3]);
        t.to(q(".reticle"), { autoAlpha: 1, duration: 0.3 }, T[3] + 0.2);
        t.to(count, { hs: tour.stats.hotspots, duration: 3.4, ease: "none", onUpdate: () => write(".n-hs", count.hs) }, T[3] + 0.6);
        go(3, at(cell.x + cell.w - 120, cell.y + cell.h - 80), T[3] + 0.5, 0.7);
        SPOTS.forEach((h, i) => {
          const when = T[3] + i * 1.4;
          t.to(S, { yaw: h.lon, pitch: h.lat, duration: 0.95, ease: "power2.inOut" }, when);
          go(2, cell, when + 0.45, 0.5);
          click(2, when + 1);
          t.to(q(".hs")[i], { scale: 1, autoAlpha: 1, duration: 0.25, ease: "back.out(2.2)" }, when + 1);
          t.to(q(".hs-row")[i], { autoAlpha: 1, duration: 0.25 }, when + 1.05);
          t.to(q(".hs-sel")[i], { autoAlpha: 0, duration: 0.3 }, when + 1.5);
          go(2, cell, when + 1.12, 0.3, 90, 96);
          if (rows[i]) go(1, rows[i], when + 1.1, 0.4, 40, 0);
          go(0, thumbs[1 + i * 2], when + 0.6, 0.6);
        });
        t.to(q(".reticle"), { autoAlpha: 0, duration: 0.3 }, T[3] + 4);

        // 5. Publish: brand skin on, editor away, tour is live
        swap(3, 4, T[4]);
        t.to(S, { yaw: 20, pitch: -6, duration: 1.6, ease: "power2.inOut" }, T[4]);
        t.to(q(".skin"), { autoAlpha: 1, duration: 0.4 }, T[4] + 0.3);
        go(0, at(rail.cx, rail.y + rail.h - 60), T[4] + 0.5, 0.7);
        go(1, at(insp.cx, insp.y + 210), T[4] + 0.8, 0.6);
        go(2, at(cell.cx - 120, cell.cy + 40), T[4] + 0.6, 0.6);
        go(3, swatch, T[4] + 0.6, 0.5);
        click(3, T[4] + 1.1);
        t.to(q(".skin-on"), { autoAlpha: 1, duration: 0.4 }, T[4] + 1.1);
        t.to(count, { zones: tour.stats.zones, duration: 0.6, ease: "none", onUpdate: () => write(".n-zones", count.zones) }, T[4] + 1.1);
        go(3, publish, T[4] + 1.7, 0.55);
        click(3, T[4] + 2.25);
        t.to(q(".published"), { autoAlpha: 1, duration: 0.15 }, T[4] + 2.25);

        const end = T[4] + 2.6, out = { duration: 1.1, ease: "expo.inOut" };
        t.to(q(".chrome-top"), { y: -cell.y, ...out }, end);
        t.to(q(".chrome-left"), { x: -cell.x, ...out }, end);
        t.to(q(".chrome-right"), { x: W - cell.x - cell.w, ...out }, end);
        t.to(q(".chrome-bottom"), { y: H - cell.y - cell.h, ...out }, end);
        t.to(q(".view"), { clipPath: "inset(0px 0px 0px 0px)", ...out }, end);
        t.to(q(".skin"), { left: 0, top: 0, width: W, height: H, ...out }, end);
        t.to(S, { off: 0, ...out }, end);
        t.to(q(".cursor"), { autoAlpha: 0, duration: 0.4 }, end);
        t.to(q(".hint"), { autoAlpha: 1, duration: 0.4 }, end + 1.1);
        t.set({}, {}, T[5]);
      }, st);

      if (!tl) return;
      const made = tl as gsap.core.Timeline;
      if (finished) made.progress(1);
      else if (visible) made.play();
    };

    replay.current = () => {
      finished = false;
      setDone(false);
      tl?.restart();
    };

    build();
    const io = new IntersectionObserver(
      ([e]) => {
        // Start only once the page has all but landed on the section, never mid-glide.
        const r = e.intersectionRatio;
        if (r >= 0.92) visible = true;
        else if (r < 0.5) visible = false;
        setActive(visible);
        if (!tl) return;
        if (visible && !finished) tl.play();
        else if (!visible) tl.pause();
      },
      { threshold: [0, 0.5, 0.92, 1] },
    );
    io.observe(sec);
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 130) return;
        build();
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", onResize);
      ctx?.revert();
    };
  }, [reduced]);

  // Drag to look around once the tour is live
  useEffect(() => {
    const el = stage.current!.querySelector<HTMLElement>(".drag")!;
    let down = false, px = 0, py = 0;
    const start = (e: PointerEvent) => {
      if (!S.live) return;
      down = true; px = e.clientX; py = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!down) return;
      const k = 0.16;
      S.dragYaw -= (e.clientX - px) * k;
      S.dragPitch = Math.max(-70 - S.pitch, Math.min(70 - S.pitch, S.dragPitch + (e.clientY - py) * k));
      px = e.clientX; py = e.clientY;
      S.lastDrag = performance.now();
    };
    const end = () => { down = false; el.style.cursor = ""; };
    el.addEventListener("pointerdown", start);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return () => {
      el.removeEventListener("pointerdown", start);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
  }, []);

  const live = step === 4 || reduced;

  return (
    <section
      ref={root}
      id="build"
      data-snap
      aria-labelledby="build-title"
      className={`relative flex flex-col gap-[13px] bg-pit px-3 pb-3 pt-[21px] lg:gap-[21px] lg:px-[34px] lg:pb-[21px] lg:pt-[34px] ${reduced ? "" : "h-svh"}`}
    >
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-x-[34px] gap-y-1">
        <h2 id="build-title" className="display text-[clamp(1.45rem,3vw,2.4rem)]">How we built the {tour.project} tour</h2>
        <p className="max-w-[40ch] text-[14px] text-dim lg:text-[15px] xl:text-right">
          A sped-up reconstruction from the real tour files. It plays by itself.
        </p>
      </header>

      <div
        ref={stage}
        className={`dotgrid relative min-h-0 overflow-hidden rounded-2xl border border-line bg-canvas text-[13px] shadow-[0_34px_89px_-34px_rgb(0_0_0/0.8)] ${reduced ? "h-[70svh]" : "flex-1"}`}
      >
        <div className="view pointer-events-none absolute inset-0 z-10">
        <PanoStage spots={SPOTS} active={active} />

        {/* Hotspots, glued to the scene by the frame loop */}
        <div className="absolute inset-0">
          {SPOTS.map((h, i) => (
            <div key={h.id} ref={(el) => { spotEls[i] = el; }} className="absolute left-0 top-0 will-change-transform" style={{ visibility: "hidden" }}>
              <div className={`hs relative ${reduced ? "" : "invisible"}`}>
                <span className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange shadow-[0_2px_10px_rgb(0_0_0/0.45)]" />
                <span className="absolute left-4 top-0 -translate-y-1/2 whitespace-nowrap rounded-full bg-canvas/90 px-3 py-1 text-[12px] font-medium text-ink">
                  {h.title}
                </span>
                <span className="hs-sel absolute -left-7 -top-7 size-14 rounded-md border border-dashed border-green" />
              </div>
            </div>
          ))}
        </div>
        <div className="reticle invisible absolute size-16 -translate-x-1/2 -translate-y-1/2" style={{ left: "calc(var(--cx) * 1px)", top: "calc(var(--cy) * 1px)" }} aria-hidden>
          <span className="absolute inset-x-0 top-1/2 h-px bg-white/70" />
          <span className="absolute inset-y-0 left-1/2 w-px bg-white/70" />
        </div>
        </div>

        {/* The tour's own interface, branded for the client */}
        <div className={`skin pointer-events-none absolute z-20 ${reduced ? "inset-0" : "invisible"}`}>
          <div className="absolute left-4 top-4 flex h-14 w-32 items-center justify-center rounded-lg border border-dashed border-white/50 text-[11px] text-white/70 lg:left-6 lg:top-6">
            Client logo
          </div>
          <div className="skin-on absolute left-4 top-4 flex h-14 w-32 items-center justify-center rounded-lg bg-white p-2 lg:left-6 lg:top-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tour/clientlogo.png" alt={`${tour.project} logo`} className="max-h-full" />
          </div>
          <div className="absolute inset-x-0 bottom-5 hidden justify-center lg:flex">
            <ul className="relative flex gap-1 rounded-full bg-[#4a4f54] p-1 text-[12px] text-white">
              {tour.categories.map((c, i) => (
                <li key={c.title} className={`whitespace-nowrap rounded-full px-3 py-1.5 ${i === 3 ? "bg-white/20" : ""}`}>{c.title}</li>
              ))}
              <li aria-hidden className="skin-on absolute inset-0 flex gap-1 rounded-full bg-client p-1">
                {tour.categories.map((c, i) => (
                  <span key={c.title} className={`whitespace-nowrap rounded-full px-3 py-1.5 ${i === 3 ? "bg-client-accent font-medium text-[#1d2125]" : ""}`}>{c.title}</span>
                ))}
              </li>
            </ul>
          </div>
        </div>

        <div className="drag absolute inset-0 z-30 touch-pan-y" style={{ pointerEvents: live ? "auto" : "none", cursor: live ? "grab" : undefined }} />

        <p className={`hint pointer-events-none absolute inset-x-0 bottom-8 z-40 flex justify-center lg:bottom-20 ${reduced ? "" : "invisible"}`}>
          <span className="rounded-full bg-canvas/85 px-4 py-2 text-[14px] text-ink">The tour is live. Drag to look around.</span>
        </p>

        {/* Editor chrome */}
        {!reduced && (
          <div className="pointer-events-none absolute inset-0 z-0 grid grid-cols-1 grid-rows-[52px_minmax(0,1fr)_auto_auto] lg:grid-cols-[264px_minmax(0,1fr)_300px] lg:grid-rows-[52px_minmax(0,1fr)_116px]">
            <header className="chrome-top col-span-full flex items-center justify-between border-b border-line bg-panel px-4 lg:px-5">
              <div className="flex min-w-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tour/turiya.svg" alt="Turiya" className="h-5 w-auto" />
                <span className="h-4 w-px bg-line" />
                <span className="truncate text-dim">{tour.project}</span>
              </div>
              <span className="hidden text-dim lg:block">{VIEW_LABEL[step]}</span>
              <span className="publish relative overflow-hidden rounded-full bg-raised px-4 py-1.5 font-medium text-ink ring-1 ring-line">
                Publish
                <span className="published invisible absolute inset-0 flex items-center justify-center bg-green text-[#14210d]">Live</span>
              </span>
            </header>

            <aside className="chrome-left hidden flex-col justify-between overflow-hidden border-r border-line bg-panel p-4 lg:flex">
              <ol className="flex flex-col gap-1">
                {STEPS.map((s, i) => (
                  <li key={s.name} aria-current={i === step ? "step" : undefined} className={`rounded-lg px-3 py-2.5 transition-colors duration-300 ${i === step ? "bg-raised" : ""}`}>
                    <div className="flex items-baseline gap-3">
                      <span className={`num text-[12px] ${i === step ? "text-green" : "text-dim"}`}>0{i + 1}</span>
                      <span className={`text-[15px] font-medium ${i === step ? "text-ink" : i < step ? "text-ink/75" : "text-dim"}`}>{s.name}</span>
                    </div>
                    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ${i === step ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                      <div className="overflow-hidden pl-[30px] text-dim">
                        <p className="pt-1.5">{s.line}</p>
                        <span className="mt-3 block h-0.5 overflow-hidden rounded-full bg-line"><span data-i={i} className="prog block h-full origin-left bg-green" style={{ transform: "scaleX(0)" }} /></span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <dl className="grid grid-cols-3 gap-2 border-t border-line pt-4">
                {[["n-pan", "panoramas"], ["n-hs", "hotspots"], ["n-zones", "zones"]].map(([c, l]) => (
                  <div key={c}>
                    <dd className={`${c} num display text-[26px] text-ink`}>0</dd>
                    <dt className="text-[11px] text-dim">{l}</dt>
                  </div>
                ))}
              </dl>
            </aside>

            <div className="cell relative overflow-hidden [container-type:size] lg:col-start-2">
              <div className="map absolute inset-0 overflow-hidden">
                <div className="absolute left-1/2 top-1/2 aspect-[3/2] w-[max(122cqw,150cqh)] -translate-x-[41%] -translate-y-1/2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/tour/aerial.webp" alt="Drone view of Abhishta Agri Farm Stay from directly above" className="size-full object-cover" />
                  <svg viewBox="0 0 300 200" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
                    {tour.pins.map((p) => (
                      <line key={p.id} className="link" x1="150" y1="100" x2={p.x * 300} y2={p.y * 200} pathLength={1} strokeDasharray="1" stroke="#74b94e" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    ))}
                  </svg>
                  <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-green ring-2 ring-canvas" />
                  {tour.pins.map((p) => (
                    <span key={p.id} className="pin absolute" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
                      <span className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-green bg-white shadow-[0_2px_8px_rgb(0_0_0/0.5)]" />
                      <span className={`absolute top-0 -translate-y-1/2 whitespace-nowrap rounded-full bg-canvas/90 px-2.5 py-0.5 text-[11px] text-ink ${p.x > 0.5 ? "right-3.5" : "left-3.5"}`}>{p.title}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="cell-frame absolute inset-0 ring-1 ring-inset ring-line" />
            </div>

            <aside className="chrome-right relative hidden border-l border-line bg-panel lg:block">
              <section className="insp insp-0 absolute inset-0 p-5">
                <h3 className="mb-3 text-[15px] font-medium">Shot list</h3>
                <dl>
                  {tour.categories.map((c) => <Field key={c.title} k={c.title} v={String(c.count)} />)}
                </dl>
                <p className="mt-4 text-dim">{tour.stats.panoramas} panoramas planned across {tour.stats.zones} zones.</p>
              </section>
              <section className="insp insp-1 absolute inset-0 p-5">
                <h3 className="mb-3 text-[15px] font-medium">Source photo</h3>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/tour/flat-${tour.hero.id}.webp`} alt="" className="mb-3 aspect-[2/1] w-full rounded-md object-cover" />
                <dl>
                  <Field k="File" v={tour.hero.file} />
                  <Field k="Stop" v={tour.hero.title} />
                  <Field k="Shape" v="Flat, 2:1" />
                </dl>
              </section>
              <section className="insp insp-2 absolute inset-0 p-5">
                <h3 className="mb-3 text-[15px] font-medium">Projection</h3>
                <div className="mb-2 flex justify-between text-dim"><span>Flat</span><span>Sphere</span></div>
                <div className="bar-track h-1.5 overflow-hidden rounded-full bg-raised"><div className="bar h-full origin-left bg-green" /></div>
                <dl className="mt-4">
                  <Field k="Cube faces" v="6" />
                  <Field k="Face size" v="2250 px" />
                </dl>
              </section>
              <section className="insp insp-3 absolute inset-0 p-5">
                <h3 className="mb-3 text-[15px] font-medium">Hotspots</h3>
                <div className="flex flex-col gap-2">
                  {SPOTS.map((h) => (
                    <dl key={h.id} className="hs-row rounded-lg bg-raised px-3 py-1">
                      <Field k={h.kind} v={h.title} />
                      <Field k="Pan / tilt" v={`${h.pan.toFixed(1)}° / ${h.tilt.toFixed(1)}°`} />
                    </dl>
                  ))}
                </div>
              </section>
              <section className="insp insp-4 absolute inset-0 p-5">
                <h3 className="mb-3 text-[15px] font-medium">Brand skin</h3>
                <div className="mb-4 flex h-20 items-center justify-center rounded-md bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/tour/clientlogo.png" alt="" className="max-h-full" />
                </div>
                <div className="swatch mb-3 flex gap-2">
                  <span className="h-9 flex-1 rounded-md bg-client ring-1 ring-white/20" />
                  <span className="h-9 flex-1 rounded-md bg-client-accent" />
                </div>
                <dl>
                  <Field k="Primary" v="#086139" />
                  <Field k="Accent" v="#FBB825" />
                  <Field k="Typeface" v="Noto Sans" />
                </dl>
              </section>
            </aside>

            <div className="chrome-bottom col-span-full border-t border-line bg-panel lg:row-start-3">
              <ul className="flex h-[84px] gap-2 overflow-hidden px-3 py-3 lg:h-[116px] lg:gap-3 lg:px-5 lg:py-3">
                {STRIP.map((s) => (
                  <li key={s.id} className="w-[104px] shrink-0 lg:w-auto lg:min-w-0 lg:flex-1">
                    <figure className={`thumb relative ${s.id === tour.hero.id ? "thumb-hero" : ""}`}>
                      <div className="relative">
                        <div className="thumb-box relative aspect-[2/1] overflow-hidden rounded-md border border-dashed border-line">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/tour/flat-${s.id}.webp`} alt={`Flat 360° photo: ${s.title}`} className="absolute inset-0 size-full object-cover" />
                        </div>
                        {s.id === tour.hero.id && <span className="thumb-ring absolute -inset-[3px] rounded-lg ring-2 ring-green" />}
                      </div>
                      <figcaption className="mt-1.5 hidden truncate text-[11px] text-dim lg:block">{s.file}</figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-4 pb-5 pt-3 lg:hidden">
                <div className="mb-2 flex gap-1.5" aria-hidden>
                  {STEPS.map((s, i) => (
                    <span key={s.name} className="h-1 flex-1 overflow-hidden rounded-full bg-raised">
                      <span data-i={i} className="prog block h-full origin-left bg-green" style={{ transform: "scaleX(0)" }} />
                    </span>
                  ))}
                </div>
                <p className="text-[17px] font-medium text-ink"><span className="num mr-2 text-green">0{step + 1}</span>{STEPS[step].name}</p>
                <p className="min-h-[3.2em] text-[14px] text-dim">{STEPS[step].line}</p>
              </div>
            </div>
          </div>
        )}

        {/* The team: stand-in cursors that do the work on desktop */}
        {!reduced &&
          TEAM.map((m, k) => (
            <div key={m.name} className={`cursor cur-${k} pointer-events-none absolute left-0 top-0 z-50 hidden lg:block`} aria-hidden>
              <span className="click absolute -left-4 -top-4 size-8 rounded-full border-2" style={{ borderColor: m.color }} />
              <svg width="22" height="26" viewBox="0 0 22 26" className="drop-shadow-[0_2px_4px_rgb(0_0_0/0.5)]">
                <path d="M2 2v19l5.2-4.6 3.4 7.6 3.2-1.4-3.4-7.5H18L2 2z" fill={m.color} stroke="#1d2125" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <span className="absolute left-4 top-6 whitespace-nowrap rounded-full rounded-tl-sm px-2.5 py-0.5 text-[11px] font-medium text-[#14210d]" style={{ background: m.color }}>
                {m.name}
              </span>
            </div>
          ))}
      </div>

      {!reduced && (
        <footer className="flex shrink-0 items-center gap-3 lg:gap-5">
          <button
            type="button"
            onClick={() => replay.current()}
            className="flex h-11 items-center gap-2 rounded-full bg-raised px-4 text-[14px] font-medium text-ink ring-1 ring-line transition-colors hover:bg-line"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
              <path d="M2.5 2.5v3h3" />
            </svg>
            Replay
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="num hidden w-[19ch] whitespace-nowrap text-[13px] text-dim sm:block">{done ? "Tour is live" : `Step ${step + 1} of 5, ${STEPS[step].name}`}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-raised" role="presentation">
              <span data-i={-1} className="prog block h-full origin-left bg-green" style={{ transform: "scaleX(0)" }} />
            </span>
          </div>
          <a
            href="#next"
            className={`flex h-11 items-center gap-2 rounded-full px-5 text-[14px] font-medium transition-colors duration-500 ${done ? "bg-green text-[#14210d]" : "bg-raised text-ink ring-1 ring-line"}`}
          >
            Keep scrolling
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" />
            </svg>
          </a>
        </footer>
      )}

      {reduced && (
        <ol className="mx-auto grid max-w-5xl gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.name}>
              <p className="num text-green">0{i + 1}</p>
              <p className="text-[17px] font-medium">{s.name}</p>
              <p className="text-dim">{s.line}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
