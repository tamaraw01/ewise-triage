import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./landing.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "E-WISE",
  description:
    "Konsol triase citra limbah elektronik berbasis 14 klaster CLIP ViT-H/14 dari 2.660 citra e-waste.",
};

export const viewport: Viewport = {
  themeColor: "#171e19",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${plexSans.variable} ${plexMono.variable}`}>
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-amber focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-void"
        >
          Lompat ke konten
        </a>
        {children}
      </body>
    </html>
  );
}
