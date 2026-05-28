import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const Card = ({ children, className, glow = false }: CardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}
      className={cn(
        "relative rounded-3xl border border-brand-border bg-brand-surface-elevated/40 p-6 backdrop-blur-xl transition-all duration-300 hover:border-brand-primary/30 hover:shadow-2xl hover:shadow-brand-primary/10",
        glow && "before:absolute before:-inset-[1px] before:rounded-[inherit] before:bg-brand-gradient before:opacity-20 before:blur-sm",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
