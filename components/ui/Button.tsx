import React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    const sizeStyles = {
      sm: "px-4 py-1.5 text-xs",
      md: "px-6 py-2.5 text-sm",
      lg: "px-8 py-3.5 text-base",
    }

    const variantStyles = {
      primary: "bg-brand-gradient text-white shadow-lg shadow-brand-primary/20",
      secondary:
        "border border-brand-border bg-brand-surface-elevated/50 text-brand-text hover:border-brand-primary/50",
      ghost: "text-brand-text-muted hover:text-brand-text hover:bg-white/5",
    }

    // Cast to any to avoid Framer Motion / HTMLButtonElement onDrag type conflict.
    // The motion.button still functions correctly — the typing is the only issue.
    const motionProps = props as any

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative overflow-hidden rounded-xl font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/50",
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...motionProps}
      >
        {variant === "primary" && (
          <div className="absolute inset-0 opacity-0 hover:opacity-20 bg-white transition-opacity" />
        )}
        {children}
      </motion.button>
    )
  }
)

Button.displayName = "Button"
