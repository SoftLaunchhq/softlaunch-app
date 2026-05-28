import type { Metadata, Viewport } from "next"
import { Inter, Fraunces } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { Navbar } from "@/components/Navbar"
import { ThemeProvider } from "@/components/ThemeProvider"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
})

export const metadata: Metadata = {
  title: {
    default: "SoftLaunch — Find Your People",
    template: "%s | SoftLaunch",
  },
  description:
    "The more ambitious you become, the more isolated you get. SoftLaunch matches driven people through structured 4-week cohorts — so you actually build real friendships.",
  keywords: [
    "friendship",
    "accountability",
    "ambitious people",
    "cohort",
    "Charlotte",
    "community",
    "SoftLaunch",
    "founders",
  ],
  authors: [{ name: "SoftLaunch" }],
  creator: "SoftLaunch",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://softlaunchhq.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://softlaunchhq.com",
    siteName: "SoftLaunch",
    title: "SoftLaunch — Find Your People",
    description:
      "Structured 4-week cohorts for ambitious people. Matched by drive, not job titles.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "SoftLaunch" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SoftLaunch — Find Your People",
    description: "Structured 4-week cohorts for ambitious people.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: "#060D0B",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary:          "#1DB896",
          colorBackground:       "#0C1814",
          colorInputBackground:  "#060D0B",
          colorInputText:        "#EDF7F4",
          colorText:             "#EDF7F4",
          colorTextSecondary:    "#7AADA0",
          colorNeutral:          "#162E28",
          borderRadius:          "0.75rem",
          fontFamily:            "var(--font-inter)",
        },
      }}
    >
      {/*
        suppressHydrationWarning: The no-flash script below mutates the class
        list before React hydrates, so server HTML (class="dark") and client
        HTML may differ if the user has "light" stored. suppressHydrationWarning
        tells React to ignore this mismatch on the <html> element only.
      */}
      <html lang="en" suppressHydrationWarning className="dark">
        <head>
          {/*
            No-flash theme script — runs synchronously before first paint.
            Reads localStorage and applies the correct class before React
            hydrates, eliminating the dark→light flicker on page load.
          */}
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('sl-theme');if(t==='light'){document.documentElement.classList.add('light');document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light')}}catch(e){}})()`,
            }}
          />
        </head>
        <body
          className={`${inter.variable} ${fraunces.variable} font-sans antialiased bg-brand-bg text-brand-text`}
          style={{
            /* Direct CSS-var fallback so the body background always
               responds to theme change even before Tailwind recompiles */
            backgroundColor: "rgb(var(--sl-bg))",
            color: "rgb(var(--sl-text))",
          }}
        >
          <ThemeProvider>
            <Navbar />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
