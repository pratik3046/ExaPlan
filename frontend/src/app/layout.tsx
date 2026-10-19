import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ExaPlan — Automated Examination & Seating Management",
  description: "Automated examination invigilation and seating arrangement system for engineering colleges.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-[#F3F4F6] text-[#0F172A]">
        {children}
      </body>
    </html>
  );
}
