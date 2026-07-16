import type { Metadata } from "next";
import "./globals.css";

const [githubOwner = "", githubRepository = ""] =
  process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const publicBasePath =
  process.env.GITHUB_PAGES === "true"
  && githubRepository
  && githubRepository !== `${githubOwner}.github.io`
    ? `/${githubRepository}`
    : "";

export const metadata: Metadata = {
  title: "Existing Basement Layout",
  description: "An approximate, interactive SVG trace of the existing basement floor plan.",
  icons: {
    icon: `${publicBasePath}/favicon.svg`,
    shortcut: `${publicBasePath}/favicon.svg`,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
