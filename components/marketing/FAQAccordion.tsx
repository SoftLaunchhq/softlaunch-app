"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Minus } from "lucide-react"
import { FAQ_ACCORDION_ITEMS } from "@/lib/faq"
import type { FAQItem } from "@/lib/faq"

interface FAQAccordionProps {
  items?: FAQItem[]
  className?: string
}

export function FAQAccordion({ items = FAQ_ACCORDION_ITEMS, className = "" }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => setOpenIndex(openIndex === i ? null : i)

  return (
    <div className={`flex flex-col divide-y divide-brand-border/50 ${className}`}>
      {items.map((item, i) => (
        <div key={i} className="py-1">
          <button
            onClick={() => toggle(i)}
            className="flex w-full items-start justify-between gap-4 py-4 text-left group"
            aria-expanded={openIndex === i}
          >
            <span className="text-[15px] font-medium text-brand-text leading-snug group-hover:text-brand-primary transition-colors duration-150">
              {item.q}
            </span>
            <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border border-brand-border bg-brand-surface flex items-center justify-center group-hover:border-brand-primary/50 transition-colors duration-150">
              {openIndex === i ? (
                <Minus className="w-3 h-3 text-brand-primary" />
              ) : (
                <Plus className="w-3 h-3 text-brand-text-muted" />
              )}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {openIndex === i && (
              <motion.div
                key="answer"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="pb-5 pr-9 text-sm leading-relaxed text-brand-text-muted">
                  {item.a}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
