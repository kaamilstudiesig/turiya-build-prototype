import type { Metadata } from "next";
import { Bricolage_Grotesque, Fraunces, Roboto_Flex } from "next/font/google";
import "./globals.css";

const flex = Roboto_Flex({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-flex",
});

// Hero headline: a heavy, tight grotesque, with one word set in a soft, heavy italic.
const bric = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth"], variable: "--font-bric" });
const script = Fraunces({ subsets: ["latin"], style: "italic", axes: ["SOFT", "WONK", "opsz"], variable: "--font-script" });

export const metadata: Metadata = {
  title: "Turiya, places you can walk into",
  description:
    "Turiya turns real places into 360° virtual tours for web, Google Maps and VR.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${flex.variable} ${bric.variable} ${script.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
