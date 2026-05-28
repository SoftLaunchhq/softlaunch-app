import type { Config } from 'tailwindcss';

/**
 * SoftLaunch Tailwind Config (JS version)
 * All brand-* tokens must match exactly what globals.css and components use.
 */
const config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ─────────────────────────────────────────────────────────
      // BRAND COLOR TOKENS
      // Used as: bg-brand-*, text-brand-*, border-brand-*, ring-brand-*
      // Opacity modifiers work automatically: bg-brand-primary/10 etc.
      // ─────────────────────────────────────────────────────────
      colors: {
        brand: {
          // Backgrounds
          bg: '#070815', // deepest background (body)
          surface: '#0E1024', // card / panel surface
          'surface-elevated': '#141830', // elevated surface (modals, dropdowns)

          // Text
          text: '#F8FAFC', // primary text (near white)
          'text-muted': '#94A3B8', // secondary / body text
          'text-subtle': '#4B5578', // placeholder / hint text

          // Primary brand color — cyan
          primary: '#22D3EE',
          'primary-hover': '#06B6D4',

          // Accent — pink
          accent: '#EC4899',

          // Borders
          border: '#2A2E4F',
          'border-light': '#394072',

          // Semantic
          error: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
        },
      },

      // ─────────────────────────────────────────────────────────
      // BACKGROUND IMAGES
      // bg-brand-gradient → the signature gradient used on buttons, logos, etc.
      // ─────────────────────────────────────────────────────────
      backgroundImage: {
        'brand-gradient':
          'linear-gradient(135deg, #22D3EE 0%, #A855F7 55%, #EC4899 100%)',
        'mesh-gradient':
          'radial-gradient(at 20% 20%, rgba(34,211,238,0.18) 0px, transparent 50%), ' +
          'radial-gradient(at 80% 0%,  rgba(168,85,247,0.18) 0px, transparent 50%), ' +
          'radial-gradient(at 0%  80%, rgba(236,72,153,0.14) 0px, transparent 50%)',
      },

      // ─────────────────────────────────────────────────────────
      // TYPOGRAPHY
      // font-display → Fraunces (loaded in app/layout.tsx via next/font)
      // font-sans    → Inter
      // ─────────────────────────────────────────────────────────
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },

      // ─────────────────────────────────────────────────────────
      // BORDER RADIUS
      // ─────────────────────────────────────────────────────────
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },

      // ─────────────────────────────────────────────────────────
      // ANIMATIONS
      // ─────────────────────────────────────────────────────────
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
