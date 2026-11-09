import BuildSection from "@/components/BuildSection";
import SmoothScroll from "@/components/SmoothScroll";
import tour from "@/data/tour.json";

export default function Home() {
  return (
    <main>
      <SmoothScroll />

      <section data-snap className="flex h-svh flex-col gap-[34px] pt-[34px] lg:pt-[55px]">
        <div className="mx-auto w-full max-w-6xl px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/tour/turiya.svg" alt="Turiya" className="mb-[34px] h-7 w-auto lg:mb-[55px]" />
          <h1 className="display max-w-[14ch] text-[clamp(2.6rem,7.4vw,5.6rem)]">
            Every tour starts as a warped photo.
          </h1>
          <p className="mt-[21px] max-w-[46ch] text-[17px] text-dim lg:text-[19px]">
            This is what our camera sees. Watch it become a place you can walk around.
          </p>
          <a
            href="#build"
            className="mt-[21px] inline-flex h-12 items-center gap-2.5 rounded-full bg-green px-6 text-[16px] font-medium text-[#14210d] transition-colors hover:bg-[#86c962]"
          >
            Watch the build
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 2.5v11M3.5 9 8 13.5 12.5 9" />
            </svg>
          </a>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tour/hero-intro.webp"
          alt="Flat, stretched 360° photo of a swimming pool"
          className="min-h-0 w-full flex-1 object-cover object-[50%_58%]"
        />
      </section>

      <BuildSection />

      <section id="next" data-snap className="bg-green text-[#14210d]">
        <div className="mx-auto flex min-h-svh max-w-6xl flex-col items-start justify-center gap-[21px] px-6 py-[89px]">
          <h2 className="display max-w-[16ch] text-[clamp(2.1rem,5.4vw,4rem)]">Your space could be next.</h2>
          <p className="max-w-[44ch] text-[17px]">
            That was {tour.stats.panoramas} panoramas and {tour.stats.hotspots} hotspots for one farm stay. Tell us about
            your place and we will plan the shoot.
          </p>
          <a
            href="https://www.turiya.co/#contact"
            className="mt-[13px] rounded-full bg-[#14210d] px-7 py-3.5 text-[16px] font-medium text-white transition-colors hover:bg-charcoal"
          >
            Book a shoot
          </a>
        </div>
      </section>
    </main>
  );
}
