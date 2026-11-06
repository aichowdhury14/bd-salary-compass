import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif, Noto_Sans_Bengali } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CoachProvider } from "@/components/coach/CoachProvider";
import { ChatWidget } from "@/components/coach/ChatWidget";
import "./globals.css";

// The free AI coach (Groq, with Cloudflare Workers AI as backup) shows on every page only with
// NEXT_PUBLIC_AI_COACH=on plus GROQ_API_KEY and/or CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN. See README.
const AI_COACH_ENABLED = process.env.NEXT_PUBLIC_AI_COACH === "on";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const serif = IBM_Plex_Serif({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-plex-serif", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });
const bengali = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "600"], variable: "--font-bengali", display: "swap" });

export const metadata: Metadata = {
  title: { default: "BD Salary Compass", template: "%s · BD Salary Compass" },
  authors: [{ name: "Atiqul Islam Chowdhury" }],
  creator: "Atiqul Islam Chowdhury",
  description:
    "Free salary tools for Bangladesh: see if you're paid fairly at banks, multinationals, telecoms, software companies and more; work out take-home pay and income tax (Finance Act 2026); compare offers. Nothing you enter is stored.",
  openGraph: {
    title: "BD Salary Compass",
    description: "What your work is worth in Bangladesh, from Unilever and BAT to City Bank, Grameenphone and bKash.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable} ${bengali.variable}`}>
      <body className="min-h-dvh flex flex-col antialiased">
        <CoachProvider>
          <SiteHeader />
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</main>
          <SiteFooter />
          {AI_COACH_ENABLED && <ChatWidget />}
        </CoachProvider>
      </body>
    </html>
  );
}
