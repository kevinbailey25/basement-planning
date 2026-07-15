import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basement Planning POC",
  description: "An interactive, layered SVG floor-plan viewer for basement planning.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
