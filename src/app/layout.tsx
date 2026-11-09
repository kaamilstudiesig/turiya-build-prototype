import type { Metadata } from "next";
import { Roboto_Flex } from "next/font/google";
import "./globals.css";

const flex = Roboto_Flex({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-flex",
});

export const metadata: Metadata = {
  title: "How a Turiya tour gets built",
  description:
    "Scroll to watch Abhishta Agri Farm Stay go from a drone map to a published 360° virtual tour.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${flex.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
