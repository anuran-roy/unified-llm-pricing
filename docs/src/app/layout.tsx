import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unified LLM Pricing — Live Dashboard",
  description:
    "Live dashboard and API for normalized LLM pricing across OpenAI, Anthropic, Google, Groq, OpenRouter, LiteLLM, Doubleword, Baseten, Wafer, and OrcaRouter.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <header className="border-b">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
              <div>
                <h1 className="text-lg font-semibold">Unified LLM Pricing</h1>
                <p className="text-sm text-muted-foreground">
                  Normalized pricing across 10 providers · updated daily
                </p>
              </div>
              <nav className="flex items-center gap-3 text-sm text-muted-foreground">
                <a href="/api/leaderboard" className="hover:text-foreground">
                  API: /api/leaderboard
                </a>
                <Button asChild size="sm">
                  <a
                    href="https://github.com/anuran-roy/unified-llm-pricing"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Star it on GitHub
                  </a>
                </Button>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t">
            <div className="mx-auto w-full max-w-6xl px-4 py-4 text-sm text-muted-foreground">
              <p>
                For the full raw data, please go to{" "}
                <a
                  href="https://raw.githubusercontent.com/anuran-roy/unified-llm-pricing/refs/heads/main/data/pricing.json"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  data/pricing.json
                </a>
                . Star it on GitHub:{" "}
                <a
                  href="https://github.com/anuran-roy/unified-llm-pricing"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  anuran-roy/unified-llm-pricing
                </a>
                .
              </p>
            </div>
          </footer>
        </TooltipProvider>
      </body>
    </html>
  );
}