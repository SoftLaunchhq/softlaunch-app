"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { useUser, SignOutButton } from "@clerk/nextjs"
import { Menu, X, LogOut } from "lucide-react"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "./ThemeToggle"

const NAV_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/story",         label: "Our story" },
  { href: "/pricing",       label: "Pricing" },
  { href: "/faq",           label: "FAQ" },
]

export function Navbar() {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const { isSignedIn, isLoaded }  = useUser()
  const pathname = usePathname()

  // App pages have their own dedicated layouts — don't render Navbar there
  const isAppPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin")

  if (isAppPage) return null

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? "border-b border-brand-border bg-brand-bg/95 backdrop-blur-2xl shadow-panel"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <Image
            src="/logo.png"
            alt="SoftLaunch"
            width={44}
            height={40}
            className="object-contain w-9 h-auto"
            priority
          />
          <span className="font-display text-[17px] font-bold tracking-tight text-brand-text">
            SoftLaunch
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "text-brand-text"
                  : "text-brand-text-muted hover:text-brand-text"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs + Theme Toggle */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Theme toggle — sits between nav and CTA */}
          <ThemeToggle />

          {isLoaded && isSignedIn ? (
            <>
              <SignOutButton redirectUrl="/">
                <button className="flex items-center gap-1.5 text-sm font-medium text-brand-text-muted transition-colors hover:text-brand-text">
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </SignOutButton>
              <Link href="/dashboard" className="sl-button px-4 py-2 text-sm">
                Dashboard →
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-sm font-medium text-brand-text-muted transition-colors hover:text-brand-text"
              >
                Sign in
              </Link>
              <Link href="/waitlist" className="sl-button px-4 py-2 text-sm">
                Join waitlist
              </Link>
            </>
          )}
        </div>

        {/* Mobile: theme toggle + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg border border-brand-border p-2 text-brand-text-muted hover:border-brand-border-light hover:text-brand-text transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-brand-border bg-brand-bg/98 backdrop-blur-2xl md:hidden">
          <div className="mx-auto max-w-6xl px-5 py-5 flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-3 text-sm font-medium text-brand-text-muted hover:bg-brand-surface hover:text-brand-text transition-all"
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-3 flex flex-col gap-2 border-t border-brand-border pt-4">
              {isLoaded && isSignedIn ? (
                <>
                  <Link href="/dashboard" className="sl-button justify-center py-3 text-sm">
                    Dashboard →
                  </Link>
                  <SignOutButton redirectUrl="/">
                    <button className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-brand-text-muted hover:bg-brand-surface hover:text-brand-text transition-all w-full">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </SignOutButton>
                </>
              ) : (
                <>
                  <Link
                    href="/sign-in"
                    className="rounded-xl px-3 py-3 text-sm font-medium text-brand-text-muted hover:bg-brand-surface hover:text-brand-text transition-all"
                  >
                    Sign in
                  </Link>
                  <Link href="/waitlist" className="sl-button justify-center py-3 text-sm">
                    Join the waitlist
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
