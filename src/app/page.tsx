import BuildSection from "@/components/BuildSection";
import Hero from "@/components/Hero";
import SmoothScroll from "@/components/SmoothScroll";
import tour from "@/data/tour.json";

export default function Home() {
  return (
    <main>
      <SmoothScroll />

      <Hero />

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
