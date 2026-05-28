/**
 * FAQ data — server-safe (no "use client" here).
 * Import this file from both server components and client components.
 * NEVER put this data in a "use client" file and then re-export it.
 */

export interface FAQItem {
  q: string
  a: string
}

/** Primary FAQ items shown on the /faq page (2-column card grid) */
export const FAQ_PAGE_ITEMS: FAQItem[] = [
  {
    q: "What is SoftLaunch?",
    a: "The first platform that uses AI-matched 4-week cohorts or 1-on-1 matching to connect ambitious people. We then structure 4 weeks of meetups with built-in accountability so you actually become friends. Not just an introduction. Real relationships.",
  },
  {
    q: "Is this a dating app?",
    a: "SoftLaunch is for finding ambitious peers. People who match your drive, your hunger, your vision. What that becomes is up to you. Professional friendships, accountability partners, relationships, people who get it. We match you with the right people. Where it goes from there is yours to define.",
  },
  {
    q: "How is this different from TimeLeft or Bumble BFF?",
    a: "TimeLeft: One dinner, then you're on your own. No follow-through. Bumble BFF: Match, coffee, ghost. SoftLaunch: 4-week structured cohorts with accountability. We solve the follow-through problem.",
  },
  {
    q: "Who is this for?",
    a: "Ambitious people. Not based on income or job title. Based on internal drive. The Walmart employee climbing to GM. The hedge fund partner starting their own firm. The aspiring entrepreneur with no network yet. Anyone with hunger, vision, and growth mentality.",
  },
  {
    q: "How much does it cost?",
    a: "Week 1 is always free. Meet your cohort or 1-on-1 match, see if you click. No payment required. Premium is $30/month. Unlocks Weeks 2–4, unlimited cohorts, unlimited 1-on-1 matches, and Buzz coordination. Annual is $240/year. Save $120 and lock in your network.",
  },
  {
    q: "Where is it available?",
    a: "Launching in Charlotte, NC first. Manual cohorts starting April 2026. App launching summer 2026. Join the waitlist for us to expand to your city.",
  },
  {
    q: "How does matching work?",
    a: "10-question assessment surfaces your drive profile. Buzz (our AI) matches you with 3 compatible people for group cohorts or 1-on-1 connections based on ambition type, what you need from peers, and energy style. We (founders) review every match before groups are finalized. Hybrid approach: AI plus human touch.",
  },
  {
    q: "What happens after Week 4?",
    a: "You choose. Keep meeting with your cohort. Join a new cohort and meet more people. Take a break. It's flexible. The goal is to help you build a network over time, not just one group.",
  },
]

/** Accordion items used on the homepage FAQ section */
export const FAQ_ACCORDION_ITEMS: FAQItem[] = [
  {
    q: "How is SoftLaunch different from LinkedIn or a networking app?",
    a: "LinkedIn is a broadcast platform — you post, you hope. SoftLaunch is a matching platform. We study how you think, what you're building, and where you're at in life, then connect you with people who complement your specific ambition. No cold DMs. No follower counts. Just real people who get it.",
  },
  {
    q: "What's a \"cohort\" and how does it work?",
    a: "Every week, we place you in a small group of similarly ambitious people. You get a shared prompt — a question, a challenge, something worth talking about. You respond. You read theirs. Genuine conversation starts from there.",
  },
  {
    q: "What if I don't have time for another thing?",
    a: "We built this for people who already have too much on their plate. The weekly commitment is under 20 minutes. One prompt. A few responses. The relationships that come out of it do not feel like obligations — they feel like air.",
  },
  {
    q: "Is this only for entrepreneurs?",
    a: "No. SoftLaunch is for anyone who is building something — a company, a career, a creative practice, a second act. If ambition is a core part of who you are, you belong here.",
  },
  {
    q: "How does the matching actually work?",
    a: "We use your Drive Profile — a nuanced picture of your ambition style, values, growth edges, and life context — to match you with people who will genuinely challenge and support you. Not just \"also in tech.\" Real compatibility. Thought through.",
  },
  {
    q: "What does it cost?",
    a: "Your first week is always free. After that, it's $30/month. Cancel anytime, no questions asked.",
  },
  {
    q: "Is my information private?",
    a: "Yes. Your Drive Profile, your responses, and your conversations are never sold, never shared, never used to target you with ads. What you share inside SoftLaunch stays inside SoftLaunch. Full stop.",
  },
  {
    q: "When does it launch?",
    a: "We're opening to founding members soon — a small group who will shape what SoftLaunch becomes. Join the waitlist to be first in.",
  },
]
