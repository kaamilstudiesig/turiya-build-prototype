"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import tour from "@/data/tour.json";
import { S, resetState, spotEls } from "./state";

const PanoStage = dynamic(() => import("./PanoStage"), { ssr: false });

const STEPS = [
  { name: "Plan", line: `A drone maps the property. We mark every spot the camera will stand, ${tour.stats.panoramas} of them here.` },
  { name: "Capture", line: "Each stop is shot in full 360°. The camera hands back a flat, stretched photo like this one." },
  { name: "Stitch", line: "We wrap that flat photo into a sphere and put you in the middle of it." },
  { name: "Hotspots", line: "Stops get linked so visitors can walk around, and points of interest get tagged." },
  { name: "Publish", line: "The tour takes on the client's brand and goes live on web, Google Maps and VR." },
];
const VIEW_LABEL = ["Top view, Farm Overview", `${tour.hero.file}, flat`, "Stitching", tour.hero.title, tour.hero.title];
// Timeline seconds at which each step begins.
const T = [0, 3.6, 6, 10.5, 14.9, 19.2];
// Timeline seconds played per real second.
const SPEED = 1.3;

const pick = (title: string) => tour.hero.hotspots.find((h) => h.title === title)!;
const SPOTS = [pick("Kids Zone"), pick("Amphitheater / Campfire Area"), tour.hero.hotspots.find((h) => h.target === "node33")!];
const HERO_INDEX = tour.strip.findIndex((s) => s.id === tour.hero.id);
const STRIP = [...tour.strip.slice(0, 2), tour.strip[HERO_INDEX], ...tour.strip.slice(2).filter((s) => s.id !== tour.hero.id)];
const MAX_ZONE = Math.max(...tour.categories.map((c) => c.count));
const DESTINATIONS = ["Web and mobile", "Google Maps", "VR headset"];

// Light tints the dotted holder takes on, by what it is wrapped around.
const TINT = { stop: "#a8dc8a", photo: "#ffe27a", slider: "#ffc48a", hotspot: "#ffb37a", detail: "#e6edf2", brand: "#fbd277", publish: "#a8dc8a" };

const ICONS = [
  <g key="0"><path d="M8 14s4.5-4 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 10 8 14 8 14z" /><circle cx="8" cy="6.5" r="1.5" /></g>,
  <g key="1"><path d="M2.5 5.5h2l1-1.5h5l1 1.5h2v7h-11z" /><circle cx="8" cy="9" r="2.2" /></g>,
  <g key="2"><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c2 1.6 2 9.4 0 11M8 2.5c-2 1.6-2 9.4 0 11" /></g>,
  <g key="3"><circle cx="8" cy="8" r="5" /><circle cx="8" cy="8" r="1.4" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2" /></g>,
  <path key="4" d="M8 10.5v-8M4.5 6 8 2.5 11.5 6M3 13.5h10" />,
];

const Icon = ({ children, size = 16 }: { children: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    {children}
  </svg>
);
const Check = () => <path d="M3.5 8.5l3 3 6-7" />;

const Field = ({ k, v }: { k: string; v: string }) => (
  <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-0">
    <dt className="text-dim">{k}</dt>
    <dd className="num truncate text-right text-ink">{v}</dd>
  </div>
);

// The Flat to Sphere control: a real slider one of the team drags.
const Slider = () => (
  <div>
    <div className="mb-2 flex justify-between opacity-80"><span>Flat</span><span>Sphere</span></div>
    <div className="bar-track relative h-1.5 rounded-full bg-raised">
      <div className="bar h-full origin-left rounded-full bg-green" />
      <span className="knob absolute left-0 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-green bg-white shadow-[0_2px_6px_rgb(0_0_0/0.5)]" />
    </div>
  </div>
);

const imgPreview = (id: string) => (id === "node30" || id === "node33" ? `/tour/prev-${id}.jpg` : null);

export default function BuildSection() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [active, setActive] = useState(false);
  const control = useRef({ replay: () => {}, jump: (i: number) => void i });
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
    // The section counts as "on screen" only when the page has come to rest on it.
    const settled = () => Math.abs(sec.getBoundingClientRect().top) < window.innerHeight * 0.04;

    const build = () => {
      ctx?.revert();
      tl = undefined;
      resetState();
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      const W = st.clientWidth, H = st.clientHeight;
      S.stage = { w: W, h: H };
      if (reduced) {
        S.cell = { x: 0, y: 0, w: W, h: H };
        Object.assign(S, { alpha: 1, fly: 1, bend: 1, zoom: 1, yaw: 20, pitch: -6, off: 0, live: true });
        return;
      }
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      const cell = rect(q(".cell")[0]);
      st.style.setProperty("--cell-x", `${cell.x}px`);
      st.style.setProperty("--cell-y", `${cell.y}px`);
      st.style.setProperty("--cell-r", `${W - cell.x - cell.w}px`);
      st.style.setProperty("--cell-b", `${H - cell.y - cell.h}px`);
      // Keep the scene clear of the caption that sits along the bottom of the viewport.
      const capH = Math.max(...q(".cap").map((el) => rect(el).h)) + 28;
      S.cell = { x: cell.x, y: cell.y, w: cell.w, h: cell.h - capH };
      const at = (cx: number, cy: number) => ({ cx, cy });
      const mid = at(S.cell.x + S.cell.w / 2, S.cell.y + S.cell.h / 2);
      st.style.setProperty("--cx", String(mid.cx));
      st.style.setProperty("--cy", String(mid.cy));

      ctx = gsap.context(() => {
        // Measure cursor targets before anything is moved.
        const pins = q(".pin").map(rect);
        type Box = { x: number; y: number; w: number; h: number; cx: number; cy: number };
        const box = (cx: number, cy: number, w: number, h: number): Box => ({ x: cx - w / 2, y: cy - h / 2, w, h, cx, cy });
        // Each pin's dot and label together, so the holder can wrap the whole thing.
        const pinBoxes = q(".pin").map((el) => {
          const rs = [...el.children].filter((c) => !c.classList.contains("pin-ring")).map(rect);
          const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
          const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
          return box((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0);
        });
        const ppu = Math.min((S.cell.w * 0.9) / (2 * Math.PI), (S.cell.h * 0.82) / Math.PI);
        const photo = box(mid.cx, mid.cy, 2 * Math.PI * ppu, Math.PI * ppu);
        const thumb = rect(q(".thumb-hero .thumb-box")[0]);
        const publish = rect(q(".publish")[0]);
        const side = rect(q(desktop ? ".chrome-right" : ".huds")[0]);
        const track = rect(q(desktop ? ".insp-2 .bar-track" : ".hud-2 .bar-track")[0]);
        const rows = desktop ? q(".hs-row").map(rect) : SPOTS.map(() => side);
        const swatch = desktop ? rect(q(".swatch")[0]) : box(cell.x + 68, cell.y + 36, 112, 48);
        S.thumb = { cx: thumb.cx, cy: thumb.cy, w: thumb.w };
        const clipCell = `inset(${cell.y}px ${W - cell.x - cell.w}px ${H - cell.y - cell.h}px ${cell.x}px)`;
        const bars = [...sec.querySelectorAll<HTMLElement>(".prog")];

        gsap.set(q(".pin, .hs"), { scale: 0, autoAlpha: 0 });
        gsap.set(q(".link"), { strokeDashoffset: 1 });
        gsap.set(q(".thumb img, .thumb figcaption"), { autoAlpha: 0, y: 10 });
        gsap.set(q(".insp:not(.insp-0), .cap:not(.cap-0), .hud:not(.hud-0), .hs-row, .hs-prev, .skin, .skin-on, .published, .hint, .thumb-ring, .click, .reticle"), { autoAlpha: 0 });
        gsap.set(q(".dest-check"), { autoAlpha: 0, scale: 0.4 });
        gsap.set(q(".skin"), { left: cell.x, top: cell.y, width: cell.w, height: cell.h });
        gsap.set(q(".bar, .zone-bar"), { scaleX: 0 });
        gsap.set(q(".view"), { clipPath: "inset(0px 0px 0px 0px)" });
        gsap.set(q(".thumb img"), { filter: "blur(6px)", scale: 0.92 });
        gsap.set(q(".holder, .scan, .pin-ring, .hs-ring, .flash, .live-ring, .click2"), { autoAlpha: 0 });
        gsap.set(q(".cur"), { x: mid.cx + 70, y: mid.cy + 90 });
        gsap.set(q(".arrow"), { transformOrigin: "0% 0%" });

        const labels: [number, string][] = [];
        const tag = q(".holder-tag")[0];
        const count = { pan: 0, hs: 0, zones: 0 };
        const write = (sel: string, v: number) => q(sel).forEach((el) => (el.textContent = String(Math.round(v))));

        const t = gsap.timeline({
          paused: true,
          defaults: { ease: "power2.out" },
          onUpdate: () => {
            const now = t.time();
            const k = T.findIndex((_, n) => now <= T[n + 1] + 0.001);
            setStep(k < 0 ? 4 : k);
            bars.forEach((el) => {
              const n = Number(el.dataset.i);
              el.style.transform = `scaleX(${Math.max(0, Math.min(1, (now - T[n]) / (T[n + 1] - T[n])))})`;
            });
            let text = "";
            for (const [when, name] of labels) if (when <= now) text = name;
            if (tag && tag.textContent !== text) tag.textContent = text;
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

        // One cursor does the work. It travels on a curve and leans into each move.
        let pos = at(mid.cx + 70, mid.cy + 90);
        const move = (p: { cx: number; cy: number }, when: number, d = 0.5, dx = 0, dy = 0) => {
          const to = at(p.cx + dx, p.cy + dy);
          const lean = Math.max(-10, Math.min(10, (to.cx - pos.cx) / 30));
          // Different easing on each axis bends the path into an arc.
          t.to(q(".cur"), { x: to.cx, duration: d, ease: "power3.inOut" }, when);
          t.to(q(".cur"), { y: to.cy, duration: d, ease: "sine.inOut" }, when);
          t.to(q(".arrow"), { rotation: lean, duration: d * 0.45, ease: "sine.out" }, when);
          t.to(q(".arrow"), { rotation: 0, duration: d * 0.55, ease: "back.out(2)" }, when + d * 0.45);
          pos = to;
        };
        const click = (when: number) => {
          t.to(q(".arrow"), { scale: 0.78, duration: 0.07, ease: "power2.in" }, when - 0.05);
          t.to(q(".arrow"), { scale: 1, duration: 0.25, ease: "back.out(3)" }, when + 0.02);
          t.fromTo(q(".click"), { scale: 0.3, autoAlpha: 0.9 }, { scale: 1.7, autoAlpha: 0, duration: 0.3, ease: "power1.out" }, when);
          t.fromTo(q(".click2"), { scale: 0.3, autoAlpha: 0.5 }, { scale: 3, autoAlpha: 0, duration: 0.5, ease: "power2.out" }, when + 0.04);
        };
        // The dotted holder morphs from one element to the next and takes that element's tint.
        const hold = (b: Box, color: string, name: string, when: number, d = 0.45, ease = "power3.inOut") => {
          const pad = 6;
          t.to(q(".holder"), { x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2, color, autoAlpha: 1, duration: d, ease }, when);
          labels.push([when + d * 0.4, name]);
        };
        const ring = (els: Element | Element[] | NodeListOf<Element>, when: number, to = 3) =>
          t.fromTo(els, { scale: 0.5, autoAlpha: 0.9 }, { scale: to, autoAlpha: 0, duration: 0.6, ease: "power2.out", stagger: 0.12 }, when);
        // Swap the side panel, the caption and the phone readout together.
        const swap = (from: number, to: number, when: number) => {
          t.to(q(`.insp-${from}, .cap-${from}, .hud-${from}`), { autoAlpha: 0, y: -8, filter: "blur(6px)", duration: 0.3 }, when);
          t.fromTo(q(`.insp-${to}, .cap-${to}, .hud-${to}`), { autoAlpha: 0, y: 12, filter: "blur(6px)" }, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.45 }, when + 0.2);
        };

        // 1. Plan: a scan sweeps the drone map, then the camera stops are dropped one by one
        t.fromTo(q(".scan"), { top: "0%", autoAlpha: 1 }, { top: "100%", duration: 1.3, ease: "power1.inOut" }, 0.05);
        t.to(q(".scan"), { autoAlpha: 0, duration: 0.2 }, 1.25);
        t.to(count, { pan: tour.stats.panoramas, duration: 2.9, ease: "none", onUpdate: () => write(".n-pan", count.pan) }, 0.4);
        t.to(q(".zone-bar"), { scaleX: 1, duration: 0.5, stagger: 0.12, ease: "power2.out" }, 0.5);
        gsap.set(q(".holder"), { x: pinBoxes[0].x, y: pinBoxes[0].y, width: pinBoxes[0].w, height: pinBoxes[0].h, color: TINT.stop });
        pins.forEach((p, i) => {
          const when = 0.3 + i * 0.5;
          move(p, when, 0.38);
          click(when + 0.38);
          t.to(q(".pin")[i], { scale: 1, autoAlpha: 1, duration: 0.3, ease: "back.out(3)" }, when + 0.38);
          ring(q(".pin")[i].querySelectorAll(".pin-ring"), when + 0.38, 3.4);
          t.to(q(".link")[i], { strokeDashoffset: 0, duration: 0.4, ease: "power1.inOut" }, when + 0.42);
          hold(pinBoxes[i], TINT.stop, "Camera stop", when + 0.34, 0.34, "back.out(1.4)");
        });

        // 2. Capture: the flat photos come in, one lifts out of the strip
        swap(0, 1, T[1]);
        t.to(q(".thumb img"), { autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.4, stagger: 0.045 }, T[1] + 0.02);
        t.to(q(".thumb figcaption"), { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.045 }, T[1] + 0.1);
        move(thumb, T[1] + 0.3, 0.52);
        hold(thumb, TINT.photo, "Flat photo", T[1] + 0.36, 0.46);
        click(T[1] + 0.85);
        t.to(q(".thumb-ring"), { autoAlpha: 1, duration: 0.12 }, T[1] + 0.85);
        t.to(q(".map"), { autoAlpha: 0, scale: 0.97, filter: "blur(4px)", duration: 0.6, ease: "power1.inOut" }, T[1] + 0.85);
        t.to(S, { alpha: 1, duration: 0.12, ease: "none" }, T[1] + 0.9);
        t.to(S, { fly: 1, duration: 1.15, ease: "expo.inOut" }, T[1] + 0.9);
        hold(photo, TINT.photo, "360° photo, still flat", T[1] + 0.9, 1.15, "expo.inOut");
        move(at(photo.x + photo.w, photo.y + photo.h), T[1] + 0.95, 1.1, -14, -12);

        // 3. Stitch: the cursor drags Flat to Sphere, the sheet curls and the camera steps inside
        t.set(q(".view"), { clipPath: clipCell }, T[2]);
        swap(1, 2, T[2]);
        move(at(track.x, track.cy), T[2] + 0.05, 0.55);
        hold(box(track.cx, track.cy, track.w + 14, 26), TINT.slider, "Projection", T[2] + 0.12, 0.48);
        click(T[2] + 0.6);
        t.to(q(".cur"), { x: track.x + track.w, duration: 3.1, ease: "power1.inOut" }, T[2] + 0.6);
        t.to(q(".knob"), { left: "100%", duration: 3.1, ease: "power1.inOut" }, T[2] + 0.6);
        t.to(q(".knob"), { scale: 1.3, duration: 0.2, ease: "back.out(3)" }, T[2] + 0.6);
        t.to(q(".knob"), { scale: 1, duration: 0.3 }, T[2] + 3.7);
        t.to(q(".bar"), { scaleX: 1, duration: 3.1, ease: "power1.inOut" }, T[2] + 0.6);
        pos = at(track.x + track.w, track.cy);
        t.to(S, { grid: 1, duration: 0.5 }, T[2]);
        t.to(S, { bend: 1, duration: 3.1, ease: "power1.inOut" }, T[2] + 0.6);
        t.to(S, { zoom: 1, duration: 2.7, ease: "power2.inOut" }, T[2] + 1.3);
        t.to(S, { grid: 0, duration: 0.7 }, T[2] + 3.6);
        // A soft flash as the sphere closes around the camera.
        t.fromTo(q(".flash"), { autoAlpha: 0 }, { autoAlpha: 0.28, duration: 0.18, ease: "power2.in" }, T[2] + 3.55);
        t.to(q(".flash"), { autoAlpha: 0, duration: 0.6, ease: "power2.out" }, T[2] + 3.73);

        // 4. Hotspots: turn to each real hotspot position, drop it, then fill in its details
        swap(2, 3, T[3]);
        t.to(q(".holder"), { autoAlpha: 0, duration: 0.2 }, T[3]);
        t.to(q(".reticle"), { autoAlpha: 1, duration: 0.3 }, T[3] + 0.2);
        t.to(count, { hs: tour.stats.hotspots, duration: 3.4, ease: "none", onUpdate: () => write(".n-hs", count.hs) }, T[3] + 0.6);
        SPOTS.forEach((h, i) => {
          const when = T[3] + i * 1.4;
          const preview = q(".hs")[i].querySelectorAll(".hs-prev");
          t.to(S, { yaw: h.lon, pitch: h.lat, duration: 0.95, ease: "power2.inOut" }, when);
          move(mid, when + 0.35, 0.6);
          hold(box(mid.cx, mid.cy, 60, 60), TINT.hotspot, "Hotspot", when + 0.4, 0.52);
          click(when + 1);
          t.to(q(".hs")[i], { scale: 1, autoAlpha: 1, duration: 0.3, ease: "back.out(3)" }, when + 1);
          ring(q(".hs")[i].querySelectorAll(".hs-ring"), when + 1, 4);
          t.to(q(".hs-row")[i], { autoAlpha: 1, duration: 0.25 }, when + 1.05);
          t.to(q(".hs-sel")[i], { autoAlpha: 0, duration: 0.2 }, when + 1.05);
          if (preview.length) {
            t.fromTo(preview, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "back.out(2)" }, when + 1.1);
            t.to(preview, { autoAlpha: 0, duration: 0.3 }, when + 2.3);
          }
          move(rows[i], when + 1.08, 0.3, 30, 0);
          hold(rows[i], TINT.detail, "Details", when + 1.1, 0.3);
        });
        t.to(q(".reticle"), { autoAlpha: 0, duration: 0.3 }, T[3] + 4);

        // 5. Publish: brand skin on, editor away, tour is live
        swap(3, 4, T[4]);
        t.to(q(".holder"), { autoAlpha: 0, duration: 0.2 }, T[4]);
        t.to(S, { yaw: 20, pitch: -6, duration: 1.6, ease: "power2.inOut" }, T[4]);
        t.to(q(".skin"), { autoAlpha: 1, duration: 0.4 }, T[4] + 0.3);
        move(swatch, T[4] + 0.55, 0.52);
        hold(swatch, TINT.brand, "Brand colours", T[4] + 0.6, 0.46);
        click(T[4] + 1.1);
        t.to(q(".skin-on"), { autoAlpha: 1, duration: 0.4 }, T[4] + 1.1);
        t.to(count, { zones: tour.stats.zones, duration: 0.6, ease: "none", onUpdate: () => write(".n-zones", count.zones) }, T[4] + 1.1);
        move(publish, T[4] + 1.65, 0.6);
        hold(publish, TINT.publish, "Publish", T[4] + 1.72, 0.5);
        click(T[4] + 2.25);
        t.to(q(".publish"), { scale: 0.94, duration: 0.08 }, T[4] + 2.22);
        t.to(q(".publish"), { scale: 1, duration: 0.35, ease: "back.out(3)" }, T[4] + 2.3);
        t.to(q(".published"), { autoAlpha: 1, duration: 0.15 }, T[4] + 2.25);
        t.to(q(".dest-check"), { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.12, ease: "back.out(3)" }, T[4] + 2.3);
        // The whole window lights up green for a beat when the tour goes live.
        t.fromTo(q(".live-ring"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, T[4] + 2.3);
        t.to(q(".live-ring"), { autoAlpha: 0, duration: 0.9, ease: "power2.out" }, T[4] + 2.9);

        const end = T[4] + 2.8, out = { duration: 1.1, ease: "expo.inOut" };
        t.to(q(".chrome-top"), { y: -cell.y, ...out }, end);
        t.to(q(".chrome-left"), { x: -cell.x, ...out }, end);
        t.to(q(".chrome-right"), { x: W - cell.x - cell.w, ...out }, end);
        t.to(q(".chrome-bottom"), { y: H - cell.y - cell.h, ...out }, end);
        t.to(q(".view"), { clipPath: "inset(0px 0px 0px 0px)", ...out }, end);
        t.to(q(".skin"), { left: 0, top: 0, width: W, height: H, ...out }, end);
        t.to(S, { off: 0, ...out }, end);
        t.to(q(".cur, .holder, .cap-4, .hud-4"), { autoAlpha: 0, duration: 0.4 }, end);
        t.to(q(".hint"), { autoAlpha: 1, duration: 0.4 }, end + 1.1);
        t.set({}, {}, T[5]);
      }, st);

      if (!tl) return;
      const made = tl as gsap.core.Timeline;
      if (finished) made.progress(1);
      else if (visible) made.play();
    };

    // Stop the video and the 3D the moment the page starts moving, so scrolling is never fought for frames.
    const sync = () => {
      const now = settled();
      if (now === visible) return;
      visible = now;
      setActive(now);
      if (!tl) return;
      if (now && !finished) tl.play();
      else if (!now) tl.pause();
    };

    control.current = {
      replay: () => {
        finished = false;
        setDone(false);
        tl?.restart();
      },
      jump: (i: number) => {
        finished = false;
        setDone(false);
        tl?.play(T[i] + 0.01);
      },
    };

    build();
    sync();
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 130) return;
        build();
      });
    };
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", sync);
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
        <h2 id="build-title" className="display text-[clamp(1.45rem,3vw,2.4rem)]">How we build the tours</h2>
        <p className="max-w-[40ch] text-[14px] text-dim lg:text-[15px] xl:text-right">
          A sped-up reconstruction from a real tour&apos;s files. It plays by itself.
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
            {SPOTS.map((h, i) => {
              const prev = imgPreview(h.target);
              return (
                <div key={h.id} ref={(el) => { spotEls[i] = el; }} className="absolute left-0 top-0 will-change-transform" style={{ visibility: "hidden" }}>
                  <div className={`hs relative ${reduced ? "" : "invisible"}`}>
                    <span className="hs-ring absolute -left-2.5 -top-2.5 size-5 rounded-full border-2 border-orange" />
                    <span className="hs-ring absolute -left-2.5 -top-2.5 size-5 rounded-full border border-white" />
                    <span className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-orange shadow-[0_2px_10px_rgb(0_0_0/0.45)]" />
                    <span className="glass absolute left-4 top-0 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium">{h.title}</span>
                    <span className="hs-sel absolute -left-7 -top-7 size-14 rounded-md border border-dashed border-green" />
                    {prev && !reduced && (
                      <span className="hs-prev absolute bottom-5 left-0 block w-40 -translate-x-1/2 overflow-hidden rounded-lg border border-white/40 bg-canvas shadow-[0_8px_21px_rgb(0_0_0/0.5)] lg:w-48">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={prev} alt="" className="aspect-[300/126] w-full object-cover" />
                        <span className="block px-2.5 py-1.5 text-[11px] text-dim">Opens <span className="text-ink">{h.title}</span></span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flash invisible absolute inset-0 bg-white" aria-hidden />
          <div className="reticle invisible absolute size-16 -translate-x-1/2 -translate-y-1/2" style={{ left: "calc(var(--cx) * 1px)", top: "calc(var(--cy) * 1px)" }} aria-hidden>
            <span className="absolute inset-x-0 top-1/2 h-px bg-white/70" />
            <span className="absolute inset-y-0 left-1/2 w-px bg-white/70" />
          </div>
        </div>

        {/* The tour's own interface, branded for the client */}
        <div className={`skin pointer-events-none absolute z-20 ${reduced ? "inset-0" : "invisible"}`}>
          <div className="absolute left-3 top-3 flex h-12 w-28 items-center justify-center rounded-lg border border-dashed border-white/60 text-[11px] text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.7)] lg:left-5 lg:top-5 lg:h-14 lg:w-32">
            Client logo
          </div>
          <div className="skin-on absolute left-3 top-3 flex h-12 w-28 items-center justify-center rounded-lg bg-white p-2 lg:left-5 lg:top-5 lg:h-14 lg:w-32">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tour/clientlogo.png" alt="Client logo" className="max-h-full" />
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

        {/* Captions and readouts over the viewport, like a video's lower third */}
        {!reduced && (
          <div className="pointer-events-none absolute z-40" style={{ left: "var(--cell-x, 0)", right: "var(--cell-r, 0)", top: "var(--cell-y, 0)", bottom: "var(--cell-b, 0)" }}>
            {STEPS.map((s, i) => (
              <div key={s.name} className={`cap cap-${i} glass absolute bottom-3 left-3 right-3 rounded-xl px-4 py-3 lg:bottom-4 lg:left-4 lg:right-auto lg:w-[440px] lg:px-5 lg:py-4`}>
                <p className="flex items-center gap-2.5 text-[17px] font-semibold lg:text-[21px]">
                  <span className="num flex size-6 items-center justify-center rounded-full bg-green text-[12px] font-bold text-[#14210d] [text-shadow:none] lg:size-7 lg:text-[13px]">{i + 1}</span>
                  {s.name}
                </p>
                <p className="mt-1 text-[13px] leading-snug lg:text-[15px]">{s.line}</p>
              </div>
            ))}
            <div className="huds absolute right-3 top-3 h-8 w-44 lg:hidden">
              <p className="hud hud-0 glass absolute right-0 top-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px]"><span className="n-pan num font-semibold">0</span> stops planned</p>
              <p className="hud hud-1 glass absolute right-0 top-0 max-w-full truncate rounded-full px-3 py-1.5 text-[12px]">{tour.hero.file}</p>
              <div className="hud hud-2 glass absolute right-0 top-0 w-44 rounded-xl px-3 pb-3 pt-2 text-[11px]"><Slider /></div>
              <p className="hud hud-3 glass absolute right-0 top-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px]"><span className="n-hs num font-semibold">0</span> hotspots</p>
              <p className="hud hud-4 glass absolute right-0 top-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px]">Web, Maps and VR</p>
            </div>
          </div>
        )}

        <p className={`hint pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center lg:bottom-20 ${reduced ? "" : "invisible"}`}>
          <span className="glass rounded-full px-4 py-2 text-[14px]">The tour is live. Drag to look around.</span>
        </p>

        {/* Editor chrome */}
        {!reduced && (
          <div className="pointer-events-none absolute inset-0 z-0 grid grid-cols-1 grid-rows-[48px_minmax(0,1fr)_auto] lg:grid-cols-[212px_minmax(0,1fr)_300px] lg:grid-rows-[48px_minmax(0,1fr)_104px]">
            <header className="chrome-top col-span-full flex items-center justify-between gap-3 border-b border-line bg-panel px-3 lg:px-4">
              <div className="flex min-w-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/tour/turiya.svg" alt="Turiya" className="h-5 w-auto" />
                <span className="hidden h-4 w-px bg-line sm:block" />
                <span className="hidden truncate text-dim sm:block">Farm stay tour</span>
              </div>
              <span className="hidden text-dim lg:block">{VIEW_LABEL[step]}</span>
              <div className="flex items-center gap-3">
                <span className="publish relative inline-block overflow-hidden rounded-full bg-raised px-4 py-1.5 font-medium text-ink ring-1 ring-line">
                  Publish
                  <span className="published invisible absolute inset-0 flex items-center justify-center bg-green text-[#14210d]">Live</span>
                </span>
              </div>
            </header>

            <aside className="chrome-left hidden flex-col justify-between overflow-hidden border-r border-line bg-panel p-3 lg:flex">
              <ol className="flex flex-col gap-0.5">
                {STEPS.map((s, i) => (
                  <li key={s.name} aria-current={i === step ? "step" : undefined} className={`rounded-lg px-3 py-2.5 transition-colors duration-300 ${i === step ? "bg-raised" : ""}`}>
                    <div className={`flex items-center gap-2.5 text-[14px] font-medium ${i === step ? "text-ink" : i < step ? "text-ink/75" : "text-dim"}`}>
                      <span className={i <= step ? "text-green" : ""}>
                        <Icon>{i < step || done ? <Check /> : ICONS[i]}</Icon>
                      </span>
                      {s.name}
                    </div>
                    <span className={`mt-2 block h-0.5 overflow-hidden rounded-full bg-line transition-opacity duration-300 ${i === step ? "opacity-100" : "opacity-0"}`}>
                      <span data-i={i} className="prog block h-full origin-left bg-green" style={{ transform: "scaleX(0)" }} />
                    </span>
                  </li>
                ))}
              </ol>
              <dl className="grid grid-cols-3 gap-1 border-t border-line pt-3">
                {[["n-pan", "panoramas"], ["n-hs", "hotspots"], ["n-zones", "zones"]].map(([c, l]) => (
                  <div key={c}>
                    <dd className={`${c} num display text-[22px] text-ink`}>0</dd>
                    <dt className="text-[11px] text-dim">{l}</dt>
                  </div>
                ))}
              </dl>
            </aside>

            <div className="cell relative overflow-hidden [container-type:size] lg:col-start-2">
              <div className="map absolute inset-0 overflow-hidden">
                <div className="absolute left-1/2 top-1/2 aspect-[3/2] w-[max(122cqw,150cqh)] -translate-x-[41%] -translate-y-1/2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/tour/aerial.webp" alt="Drone view of a farm stay from directly above" className="size-full object-cover" />
                  <svg viewBox="0 0 300 200" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
                    {tour.pins.map((p) => (
                      <line key={p.id} className="link" x1="150" y1="100" x2={p.x * 300} y2={p.y * 200} pathLength={1} strokeDasharray="1" stroke="#74b94e" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    ))}
                  </svg>
                  <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-green ring-2 ring-canvas" />
                  {tour.pins.map((p) => (
                    <span key={p.id} className="pin absolute" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
                      <span className="pin-ring absolute -left-2 -top-2 size-4 rounded-full border border-green" />
                      <span className="pin-ring absolute -left-2 -top-2 size-4 rounded-full border border-green" />
                      <span className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-green bg-white shadow-[0_2px_8px_rgb(0_0_0/0.5)]" />
                      <span className={`absolute top-0 -translate-y-1/2 whitespace-nowrap rounded-full bg-canvas/90 px-2.5 py-0.5 text-[11px] text-ink ${p.x > 0.5 ? "right-3.5" : "left-3.5"}`}>{p.title}</span>
                    </span>
                  ))}
                </div>
                <span className="scan absolute inset-x-0 top-0 h-px bg-green shadow-[0_0_13px_3px_rgb(116_185_78/0.7)]" aria-hidden />
                <p className="glass num absolute left-3 top-3 rounded-full px-3 py-1.5 text-[11px] lg:left-4 lg:top-4 lg:text-[12px]">
                  {tour.aerial.lat.toFixed(4)}° N, {tour.aerial.lon.toFixed(4)}° E
                </p>
              </div>
              <div className="cell-frame absolute inset-0 ring-1 ring-inset ring-line" />
            </div>

            <aside className="chrome-right relative hidden border-l border-line bg-panel lg:block">
              <section className="insp insp-0 absolute inset-0 p-5">
                <h3 className="mb-1 text-[15px] font-medium">Shot list</h3>
                <p className="mb-4 text-dim"><span className="n-pan num text-ink">0</span> of {tour.stats.panoramas} stops planned</p>
                <ul className="flex flex-col gap-3">
                  {tour.categories.map((c) => (
                    <li key={c.title}>
                      <div className="mb-1.5 flex justify-between"><span>{c.title}</span><span className="num text-dim">{c.count}</span></div>
                      <span className="block h-1 rounded-full bg-raised">
                        <span className="zone-bar block h-full origin-left rounded-full bg-green" style={{ width: `${Math.max(6, (c.count / MAX_ZONE) * 100)}%` }} />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="insp insp-1 absolute inset-0 p-5">
                <h3 className="mb-3 text-[15px] font-medium">Source photo</h3>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/tour/flat-${tour.hero.id}.webp`} alt="" className="mb-3 aspect-[2/1] w-full rounded-md object-cover ring-1 ring-line" />
                <dl>
                  <Field k="File" v={tour.hero.file} />
                  <Field k="Stop" v={tour.hero.title} />
                  <Field k="Covers" v="360° × 180°" />
                  <Field k="Shape" v="Flat, 2:1" />
                </dl>
              </section>
              <section className="insp insp-2 absolute inset-0 p-5">
                <h3 className="mb-4 text-[15px] font-medium">Projection</h3>
                <Slider />
                <dl className="mt-5">
                  <Field k="Cube faces" v="6" />
                  <Field k="Face size" v="2250 px" />
                  <Field k="Guide lines" v="15° apart" />
                </dl>
              </section>
              <section className="insp insp-3 absolute inset-0 p-5">
                <h3 className="mb-1 text-[15px] font-medium">Hotspots</h3>
                <p className="mb-3 text-dim"><span className="n-hs num text-ink">0</span> across the whole tour</p>
                <div className="flex flex-col gap-2">
                  {SPOTS.map((h) => {
                    const prev = imgPreview(h.target);
                    return (
                      <div key={h.id} className="hs-row flex items-center gap-3 rounded-lg bg-raised p-2">
                        {prev ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={prev} alt="" className="h-11 w-16 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="flex h-11 w-16 shrink-0 items-center justify-center rounded bg-line text-orange"><Icon size={18}>{ICONS[3]}</Icon></span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{h.title}</p>
                          <p className="num truncate text-[12px] text-dim">{h.kind}, pan {h.pan.toFixed(0)}° tilt {h.tilt.toFixed(0)}°</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="insp insp-4 absolute inset-0 p-5">
                <h3 className="mb-3 text-[15px] font-medium">Brand and publish</h3>
                <div className="mb-3 flex h-16 items-center justify-center rounded-md bg-white p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/tour/clientlogo.png" alt="" className="max-h-full" />
                </div>
                <div className="swatch mb-1 flex gap-2">
                  <span className="h-8 flex-1 rounded-md bg-client ring-1 ring-white/20" />
                  <span className="h-8 flex-1 rounded-md bg-client-accent" />
                </div>
                <dl>
                  <Field k="Colours" v="#086139, #FBB825" />
                  <Field k="Typeface" v="Noto Sans" />
                </dl>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {DESTINATIONS.map((d) => (
                    <li key={d} className="flex items-center justify-between rounded-lg bg-raised px-3 py-2">
                      {d}
                      <span className="dest-check flex size-5 items-center justify-center rounded-full bg-green text-[#14210d]"><Icon size={12}><Check /></Icon></span>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>

            <div className="chrome-bottom col-span-full border-t border-line bg-panel lg:row-start-3">
              <ul className="flex h-[72px] gap-2 overflow-hidden px-3 py-2.5 lg:h-[104px] lg:gap-3 lg:px-4 lg:py-3">
                {STRIP.map((s) => (
                  <li key={s.id} className="w-[100px] shrink-0 lg:w-auto lg:min-w-0 lg:flex-1">
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
            </div>
          </div>
        )}

        {/* The dotted holder wraps whatever is being worked on and takes its tint */}
        {!reduced && (
          <div
            className="holder invisible pointer-events-none absolute left-0 top-0 z-[45] rounded-lg border-2 border-dotted border-current"
            style={{ color: TINT.stop, background: "color-mix(in srgb, currentColor 12%, transparent)" }}
            aria-hidden
          >
            {["-left-1 -top-1", "-right-1 -top-1", "-left-1 -bottom-1", "-right-1 -bottom-1"].map((c) => (
              <span key={c} className={`absolute size-1.5 rounded-[1px] bg-current ${c}`} />
            ))}
            <span className="absolute -top-[22px] left-0 whitespace-nowrap rounded-[4px] bg-current px-1.5 text-[10px] font-semibold leading-[16px]">
              <span className="holder-tag text-[#14210d]" />
            </span>
          </div>
        )}
        <div className="live-ring invisible pointer-events-none absolute inset-0 z-[46] rounded-2xl shadow-[inset_0_0_0_2px_var(--color-green),inset_0_0_55px_rgb(116_185_78/0.35)]" aria-hidden />

        {/* The cursor that does the work */}
        {!reduced && (
          <div className="cur pointer-events-none absolute left-0 top-0 z-50" aria-hidden>
            <span className="click absolute -left-4 -top-4 size-8 rounded-full border-2 border-white" />
            <span className="click2 absolute -left-4 -top-4 size-8 rounded-full border border-white" />
            <svg viewBox="0 0 22 26" className="arrow h-[22px] w-[19px] origin-top-left drop-shadow-[0_2px_5px_rgb(0_0_0/0.55)] lg:h-[26px] lg:w-[22px]">
              <path d="M2 2v19l5.2-4.6 3.4 7.6 3.2-1.4-3.4-7.5H18L2 2z" fill="#fff" stroke="#1d2125" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="absolute left-4 top-6 whitespace-nowrap rounded-full rounded-tl-sm bg-green px-2.5 py-0.5 text-[10px] font-medium text-[#14210d] lg:text-[11px]">Turiya</span>
          </div>
        )}
      </div>

      {!reduced && (
        <footer className="flex shrink-0 items-center gap-2 lg:gap-5">
          <button
            type="button"
            onClick={() => control.current.replay()}
            aria-label="Replay"
            className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-raised px-3.5 text-[14px] font-medium text-ink ring-1 ring-line transition-colors hover:bg-line lg:px-4"
          >
            <Icon><path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" /><path d="M2.5 2.5v3h3" /></Icon>
            <span className="hidden sm:inline">Replay</span>
          </button>
          <ol className="flex min-w-0 flex-1 gap-1.5 lg:gap-2" aria-label="Chapters">
            {STEPS.map((s, i) => (
              <li key={s.name} className="min-w-0 flex-1">
                <button type="button" onClick={() => control.current.jump(i)} aria-label={`Play from step ${i + 1}, ${s.name}`} className="group flex h-11 w-full flex-col justify-center gap-1.5 text-left">
                  <span className={`hidden truncate text-[12px] transition-colors sm:block ${i === step && !done ? "text-ink" : "text-dim group-hover:text-ink"}`}>{s.name}</span>
                  <span className="block h-1 overflow-hidden rounded-full bg-raised">
                    <span data-i={i} className="prog block h-full origin-left bg-green" style={{ transform: "scaleX(0)" }} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <a
            href="#next"
            className={`flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium transition-colors duration-500 lg:px-5 ${done ? "bg-green text-[#14210d]" : "bg-raised text-ink ring-1 ring-line"}`}
          >
            <span className="hidden sm:inline">Keep scrolling</span>
            <span className="sm:hidden">Next</span>
            <Icon><path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" /></Icon>
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
