import BuildSection from "@/components/BuildSection";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import SmoothScroll from "@/components/SmoothScroll";

export default function Home() {
  return (
    <main>
      <SmoothScroll />

      <Hero />

      <BuildSection />

      <Footer />
    </main>
  );
}
