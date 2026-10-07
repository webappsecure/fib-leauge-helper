import type { Metadata } from "next";
import Link from "next/link";
import { DiceToggle } from "@/components/dice-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { applySavedDiceSetting } from "@/lib/preferences/dice";
import "./globals.css";

export const metadata: Metadata = {
  title: "FIB League Helper",
  description: "A commissioner's companion for Fast Inning Baseball leagues.",
};

// Runs before first paint so a saved theme does not flash the other one.
const applySavedTheme = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySavedTheme + applySavedDiceSetting }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-base">
        <header className="flex items-center gap-4 bg-navy px-4 py-2 text-navy-ink">
          <Link href="/" className="text-lg font-bold">
            FIB <span className="text-accent">League Helper</span>
          </Link>
          <nav aria-label="Main" className="flex flex-1 gap-4">
            <Link
              href="/"
              className="border-b-2 border-transparent opacity-80 hover:border-accent hover:opacity-100"
            >
              Leagues
            </Link>
          </nav>
          <DiceToggle />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4">{children}</main>
      </body>
    </html>
  );
}
